// M1.6 (re-verification of M1.4): a step title or result with one long unbreakable word must
// not push the page sideways through the «Ход атаки» table (the feed is inside it, K91). The built B1 is
// changed on its way to the page (the checker accepts such words), as in explain.spec.ts.
import type { Page } from '@playwright/test';
import { expect, openApp, test } from './support';

const LONG = 'Сверхдлиннаяподписьшагабезединогопробелачтобыпроверитьперенос'.repeat(2);

async function run(page: Page, id: string, params?: unknown) {
  return page.evaluate(([i, p]) => window.__app?.commands.run(i, p), [id, params] as const);
}

async function openLongWords(page: Page): Promise<void> {
  await page.route('**/data/lessons/B1.ru.*.json', async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as Record<string, unknown>;
    const steps = (data['steps'] as Record<string, unknown>[]).map((step) => ({
      ...step,
      title: `${String(step['title'])} ${LONG}`,
      result: `${String(step['result'])} ${LONG}`,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...data, steps }),
    });
  });
  await openApp(page);
  await expect(page.getByTestId('steps-table')).toBeVisible();
}

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
] as const) {
  test.describe(`long words in the steps table at ${String(viewport.width)}`, () => {
    test.use({ viewport });

    test('a long title or result never scrolls the page sideways', async ({ page }) => {
      await openLongWords(page);
      await expect(page.getByTestId('step-row-1')).toContainText(LONG);
      for (const on of [false, true]) {
        expect(await run(page, 'defence.set', { on })).toEqual({ ok: true });
        // The last step: every row has happened and carries its mark.
        expect(await run(page, 'player.goto', { step: 5 })).toEqual({ ok: true });
        await expect(page.getByTestId('step-row-5')).not.toHaveAttribute('data-mark', 'future');
        const sideways = await page.evaluate(() => {
          const root = document.documentElement;
          const table = document.querySelector<HTMLElement>('[data-testid="steps-table"]');
          const area = document.querySelector<HTMLElement>('[data-testid="steps-area"]');
          return {
            page: root.scrollWidth - root.clientWidth,
            table: table === null ? -1 : table.getBoundingClientRect().right - root.clientWidth,
            area: area === null ? -1 : area.scrollWidth - area.clientWidth,
          };
        });
        expect(sideways.page, `page, defence ${String(on)}`).toBe(0);
        expect(sideways.table, `table, defence ${String(on)}`).toBeLessThanOrEqual(0);
        expect(sideways.area, `steps area, defence ${String(on)}`).toBe(0);
      }
    });
  });
}
