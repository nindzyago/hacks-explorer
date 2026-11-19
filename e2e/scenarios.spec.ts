// G18 (oracle D): scenarios S1 «Урок проходит по шагам» and S2 «Защита меняет исход»
// (scenarios/lesson-player.md) on every lesson in content/lessons, in Russian and English. What
// each step must show — its id, sender, receiver, the step count of each mode, which steps the
// defence stops — comes from the lesson's own built data. The B1 wording of the scenarios
// («у узла База», step 3 «остановлено») stays in player.spec.ts, defence.spec.ts and
// message.spec.ts; S3 for every lesson is in explain.spec.ts.
import type { Page } from '@playwright/test';
import type { SiteStep } from '../src/core/lesson/site';
import { stableDump } from '../src/core/dump';
import { stepsInMode } from '../src/core/scene-layout/message';
import { createLessonLoader } from '../src/services/catalog/catalog';
import { LANGS, LESSONS, lessonData, pageFetch, type Lang } from './lessons';
import { expect, openApp, test } from './support';

const TRAVEL_MS = 900;
const STEP_MS = 900 + 1500;
const STOPPED: Record<Lang, string> = { ru: 'остановлено', en: 'stopped' };
const STATUS: Record<Lang, (n: number, count: number) => string> = {
  ru: (n, count) => `Шаг ${String(n)} из ${String(count)}`,
  en: (n, count) => `Step ${String(n)} of ${String(count)}`,
};

async function run(page: Page, id: string, params?: unknown): Promise<void> {
  const result = await page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [
    id,
    params,
  ] as const);
  expect(result, id).toEqual({ ok: true });
}

async function tick(page: Page, ms: number): Promise<void> {
  expect(await page.evaluate((t) => window.__app?.clock.tick(t), ms)).toEqual({ ok: true });
}

async function player(page: Page) {
  return page.evaluate(() => window.__app?.state.get().player);
}

async function dump(page: Page): Promise<string> {
  const result = stableDump(await page.evaluate(() => window.__app?.state.get()));
  if (!result.ok) throw new Error(result.error.message);
  return result.text;
}

/** The lesson open in `lang`, step 1, defence off, the clock stopped at 0. */
async function fresh(page: Page, lang: Lang, id: string): Promise<void> {
  await openApp(page, `/${lang}/lesson/${id}`);
  await expect(page.getByTestId('scene')).toHaveAttribute('data-lesson', id);
  await page.evaluate(() => window.__app?.clock.set(0));
  await expect(page.getByTestId('step-row-1')).toBeVisible();
  await run(page, 'defence.set', { on: false });
  await run(page, 'player.goto', { step: 1 });
}

/** Centre x of the message body (plaque or token) and of the icons of two participants. */
async function positions(page: Page, from: string, to: string) {
  return page.evaluate(
    ([f, t]) => {
      const centre = (selector: string) => {
        const e = document.querySelector(selector);
        if (e === null) return Number.NaN;
        const r = e.getBoundingClientRect();
        return r.x + r.width / 2;
      };
      const body = document.querySelector('[data-testid="message-plaque"] .plaque')
        ? centre('[data-testid="message-plaque"] .plaque')
        : centre('[data-testid="message-token"]');
      return {
        body,
        from: centre(`[data-testid="participant-${f}"] [data-part="icon"]`),
        to: centre(`[data-testid="participant-${t}"] [data-part="icon"]`),
      };
    },
    [from, to] as const,
  );
}

/** The message stands nearer to participant `at` than to the other end of its step. */
async function standsAt(page: Page, step: SiteStep, at: 'from' | 'to', where: string) {
  if (step.from === step.to) return;
  const p = await positions(page, step.from, step.to);
  expect(Number.isNaN(p.body), `${where}: message drawn`).toBe(false);
  const near = Math.abs(p.body - p[at]);
  const far = Math.abs(p.body - p[at === 'from' ? 'to' : 'from']);
  expect(near, `${where}: the message stands at ${step[at]}`).toBeLessThan(far);
}

const happened = (page: Page) =>
  page.locator('[data-testid="steps-table"] tbody tr:not([data-mark="future"])');

// The generic checks play exactly the lessons the site ships: none left out, none extra.
test('the lessons the checks play are the lessons of the catalog, in Russian and English', async ({
  page,
}) => {
  await openApp(page);
  const catalog = await createLessonLoader({ fetch: pageFetch(page) }).catalog();
  if (!catalog.ok) throw new Error(catalog.error.message);
  const shipped = catalog.value.lessons
    .filter((l) => LANGS.every((lang) => l.translations.some((t) => t.language === lang)))
    .map((l) => l.id)
    .sort();
  expect(shipped).toEqual([...LESSONS]);
  expect(LESSONS.length).toBeGreaterThanOrEqual(10);
});

for (const id of LESSONS) {
  test.describe(id, () => {
    test('S1: every step forward is the next step of the data; back gives exactly the state before', async ({
      page,
    }) => {
      for (const lang of LANGS) {
        await fresh(page, lang, id);
        const data = await lessonData(page, id, lang);
        const steps = stepsInMode(data.steps, false);
        const count = steps.length;
        expect(count, `${id} ${lang}`).toBeGreaterThanOrEqual(2);
        await expect(page.getByTestId('player-status')).toContainText(STATUS[lang](1, count));
        for (let n = 2; n <= count; n += 1) {
          const step = steps[n - 1];
          if (step === undefined) throw new Error('no step');
          const where = `${id} ${lang} step ${String(n)} ${step.id}`;
          const before = await dump(page);
          await run(page, 'player.step');
          expect(await player(page), where).toMatchObject({ step: n, defence: false });
          await expect(page.getByTestId(`step-row-${String(n)}`), where).toHaveAttribute(
            'aria-current',
            'step',
          );
          await expect(page.getByTestId('player-status'), where).toContainText(
            STATUS[lang](n, count),
          );
          // The rows up to this step have happened (the feed in the table, K91).
          await expect(happened(page), where).toHaveCount(n);
          await expect(happened(page).last(), where).toHaveAttribute('data-step', step.id);
          // The clock is stopped: the message of the step stands at its sender.
          const message = page.getByTestId('message');
          await expect(message, where).toHaveAttribute('data-step', step.id);
          await expect(message, where).toHaveAttribute('data-from', step.from);
          await expect(message, where).toHaveAttribute('data-to', step.to);
          await expect(message, where).toHaveAttribute(
            'data-progress',
            step.from === step.to ? '1' : '0',
          );
          await standsAt(page, step, 'from', where);
          // Back gives exactly the state of the step before, then forward again.
          await run(page, 'player.back');
          expect(await dump(page), `${where}: back`).toBe(before);
          await expect(happened(page), `${where}: back`).toHaveCount(n - 1);
          await run(page, 'player.step');
        }
      }
    });

    test('S2: the defence stops what its data says, at the defender; a second toggle goes back', async ({
      page,
    }) => {
      for (const lang of LANGS) {
        await fresh(page, lang, id);
        const data = await lessonData(page, id, lang);
        const attack = stepsInMode(data.steps, false);
        const defended = stepsInMode(data.steps, true);
        const stopped = defended.filter((s) => s.stopped);
        // L4.3: the defence changes the outcome — at least one step is stopped.
        expect(stopped.length, `${id} ${lang}: stopped steps`).toBeGreaterThan(0);

        await run(page, 'defence.toggle');
        expect(await player(page)).toMatchObject({ step: 1, defence: true, playing: false });
        await run(page, 'player.play');
        // Play to the end: the lesson stops by itself after the last message arrives.
        for (let i = 0; i <= defended.length && (await player(page))?.playing === true; i += 1) {
          await tick(page, STEP_MS);
        }
        expect(await player(page), `${id} ${lang}`).toMatchObject({
          step: defended.length,
          defence: true,
          playing: false,
        });

        // The table is the defence course of the data, every row has happened; the stopped
        // steps, and only they, are marked «остановлено» with the shield.
        const rows = page.locator('[data-testid="steps-table"] tbody tr');
        expect(
          await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-step'))),
        ).toEqual(defended.map((s) => s.id));
        await expect(happened(page)).toHaveCount(defended.length);
        for (const [i, step] of defended.entries()) {
          const row = page.getByTestId(`step-row-${String(i + 1)}`);
          const where = `${id} ${lang} defence row ${String(i + 1)} ${step.id}`;
          if (step.stopped) {
            await expect(row, where).toHaveAttribute('data-mark', 'stopped');
            await expect(row.getByTestId('stopped-mark'), where).toBeVisible();
            await expect(row.getByTestId('step-mark'), where).toContainText(STOPPED[lang]);
          } else {
            await expect(row, where).not.toHaveAttribute('data-mark', 'stopped');
            await expect(row.getByTestId('stopped-mark'), where).toHaveCount(0);
          }
        }
        // Steps of the attack course alone do not happen with the defence.
        for (const step of attack.filter((s) => s.mode === 'without-defence')) {
          await expect(
            page.locator(`[data-testid="steps-table"] [data-step="${step.id}"]`),
            `${id} ${lang} ${step.id}`,
          ).toHaveCount(0);
        }

        // Each stopped message travels like any other and stays at its receiver with the shield.
        for (const step of stopped) {
          const n = defended.indexOf(step) + 1;
          const where = `${id} ${lang} defence step ${String(n)} ${step.id}`;
          await page.evaluate(() => window.__app?.clock.set(0));
          await run(page, 'player.goto', { step: n });
          const message = page.getByTestId('message');
          await expect(message, where).toHaveAttribute('data-step', step.id);
          if (step.from !== step.to) {
            await page.evaluate((ms) => window.__app?.clock.set(ms), TRAVEL_MS / 2);
            await expect(message, `${where}: on its way`).toHaveAttribute('data-stopped', 'false');
          }
          await page.evaluate((ms) => window.__app?.clock.set(ms), TRAVEL_MS);
          await expect(message, where).toHaveAttribute('data-stopped', 'true');
          // Green where it stops (M1.2d, K62).
          await expect(message, where).toHaveAttribute('data-paint', 'stopped');
          await expect(page.getByTestId('message-sign'), where).toHaveAttribute(
            'data-sign',
            'stopped',
          );
          await expect(page.getByTestId('message-word'), where).toHaveText(STOPPED[lang]);
          await standsAt(page, step, 'to', where);
          // Much later it is still there: nothing travels further.
          const at = (await positions(page, step.from, step.to)).body;
          await tick(page, 10_000);
          expect((await positions(page, step.from, step.to)).body, where).toBe(at);
        }

        // A second toggle: the attack course from the same step number (the last one if the
        // attack course is shorter).
        await run(page, 'player.goto', { step: defended.length });
        await run(page, 'defence.toggle');
        const back = Math.min(defended.length, attack.length);
        expect(await player(page), `${id} ${lang}`).toMatchObject({
          step: back,
          defence: false,
          playing: false,
        });
        await expect(page.getByTestId(`step-row-${String(back)}`)).toHaveAttribute(
          'aria-current',
          'step',
        );
        expect(
          await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-step'))),
        ).toEqual(attack.map((s) => s.id));
        await expect(
          page.locator('[data-testid="steps-table"] [data-testid="stopped-mark"]'),
        ).toHaveCount(0);
      }
    });
  });
}
