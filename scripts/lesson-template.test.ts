// M4.1, oracle level D (scenario S8): a new lesson made from the lesson template
// (docs/lesson-template/<lang>.md) passes the content gate without code changes. The test copies
// the real content into a temporary folder, puts the template into a lesson folder that does not
// exist yet, fills the placeholders and runs everything the build checks: the lesson checker,
// the translation check against ru.md, the glossaries, the catalogs and K94. CI6: the copy holds
// B1 alone (the checks are the same next to every other lesson, building all of them costs time
// in proportion to their number, and the content gate checks them anyway), so a free topic exists
// in it even when all 75 topics of the catalog have their lesson.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkLesson, formatError } from '../src/core/lesson/check';
import { ROOT, readContent } from './content-files.mjs';
import { buildLessonData } from './lesson-data';
import { lessonIdOf, onlyLessons, writeContent } from './test-content';

const TEMPLATE_DIR = join(ROOT, 'docs', 'lesson-template');
const LANGUAGES = ['ru', 'en'] as const;
const TITLES: Record<(typeof LANGUAGES)[number], string> = {
  ru: 'Пробный урок',
  en: 'A trial lesson',
};
const PLACEHOLDER = /\{\{[A-Z]+\}\}/g;

function template(lang: string): string {
  return readFileSync(join(TEMPLATE_DIR, `${lang}.md`), 'utf8');
}

function fill(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (p) => values[p.slice(2, -2)] ?? p);
}

/** The content the new lesson joins: the real content with B1 alone. */
const base = onlyLessons(readContent(), ['B1']);

/** The first topic of the Russian catalog that has no lesson folder in `base`. */
function freeTopic(): string {
  const catalog = readFileSync(join(ROOT, 'content', 'locales', 'ru', 'catalog.md'), 'utf8');
  const taken = new Set(base.lessons.map((f) => lessonIdOf(f.path)));
  const ids = [...catalog.matchAll(/^- `([A-Z][0-9]+)` /gm)].map((m) => m[1] ?? '');
  const free = ids.find((id) => !taken.has(id));
  if (free === undefined) throw new Error('every topic of the catalog already has a lesson');
  return free;
}

const work = mkdtempSync(join(tmpdir(), 'lesson-template-'));
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('the lesson template (M4.1)', () => {
  const id = freeTopic();
  const values = (lang: (typeof LANGUAGES)[number]) => ({
    ID: id,
    SECTION: id.slice(0, 1),
    TITLE: TITLES[lang],
    CWE: '89',
  });

  it('has the same placeholders in every language and nothing else to fill', () => {
    for (const lang of LANGUAGES) {
      expect([...new Set(template(lang).match(PLACEHOLDER))].sort()).toEqual([
        '{{CWE}}',
        '{{ID}}',
        '{{SECTION}}',
        '{{TITLE}}',
      ]);
      expect(fill(template(lang), values(lang))).not.toMatch(PLACEHOLDER);
    }
  });

  // {{TITLE}} left as it is still parses (a title is free text), like the sample sentences the
  // author must rewrite: those are for review, CONTRIBUTING.md says so.
  it('with {{ID}}, {{SECTION}} or {{CWE}} left unfilled, it is not a lesson: the gate stops it', () => {
    for (const lang of LANGUAGES) {
      for (const name of ['ID', 'SECTION', 'CWE']) {
        const partial = Object.fromEntries(
          Object.entries(values(lang)).filter(([key]) => key !== name),
        );
        const result = checkLesson(
          `content/lessons/${id}/${lang}.md`,
          fill(template(lang), partial),
          { sourceDomains: ['owasp.org', 'mitre.org'] },
        );
        expect(result.lesson, `${lang}: {{${name}}} left`).toBeNull();
        expect(result.errors.map(formatError).join('\n')).toContain(
          `content/lessons/${id}/${lang}.md:`,
        );
      }
    }
  });

  it(`filled and copied into a new lesson folder, it passes the content gate in every site language`, () => {
    const root = join(work, 'project');
    writeContent(root, base);
    mkdirSync(join(root, 'content', 'lessons', id));
    for (const lang of LANGUAGES) {
      writeFileSync(
        join(root, 'content', 'lessons', id, `${lang}.md`),
        fill(template(lang), values(lang)),
      );
    }
    const content = readContent(root);
    const result = buildLessonData(content);
    expect(result.ok ? '' : result.errors.join('\n')).toBe('');
    if (!result.ok) return;
    for (const lang of LANGUAGES) {
      const pattern = new RegExp(`^data/lessons/${id}\\.${lang}\\.[0-9a-f]{8}\\.json$`);
      expect(result.files.some((f) => pattern.test(f.path))).toBe(true);
    }
    const catalog = result.files.find((f) => f.path === 'data/catalog.json');
    expect(catalog?.text).toContain(`"id":"${id}"`);
    expect(catalog?.text).toContain(`"title":"${TITLES.en}"`);
  });
});
