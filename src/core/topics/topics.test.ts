// M2.1b (E3, K112): the catalog of topics — the file, the check across languages, the site
// data and the search of the lessons panel (S7).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkCatalogs } from './check';
import { MAX_CATALOG_FILE_BYTES, parseCatalogFile, type CatalogFile } from './file';
import { filterTopics, matchesAll, normalize, queryWords, readyCount } from './search';
import { readSiteTopics, toSiteTopics, topicsFile, type SiteTopics } from './site';

const RU = 'content/locales/ru/catalog.md';
const EN = 'content/locales/en/catalog.md';

function file(lang: string, body: string): string {
  return `# Каталог\n\n\`catalog\` ${lang} · \`format\` 1\n\nNotes are ignored.\n\n${body}`;
}

const SMALL_RU = file(
  'ru',
  '## `B` Веб: инъекции\n\n- `B1` SQL-инъекция\n- `B8` NoSQL-инъекция — В поле пароля приходит условие\n\n## `G` Сеть\n\n- `G1` Человек посередине\n',
);
const SMALL_EN = file(
  'en',
  '## `B` Web: injections\n\n- `B1` SQL injection\n- `B8` NoSQL injection\n\n## `G` Network\n\n- `G1` Man in the middle\n',
);

function parsed(path: string, text: string): CatalogFile {
  const result = parseCatalogFile(path, text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.file;
}

function errorsOf(path: string, text: unknown) {
  const result = parseCatalogFile(path, text);
  return result.ok ? [] : result.errors;
}

describe('parseCatalogFile', () => {
  it('reads sections and topics in file order, with the optional note', () => {
    const f = parsed(RU, SMALL_RU);
    expect(f.language).toBe('ru');
    expect(f.title).toBe('Каталог');
    expect(f.sections.map((s) => [s.id, s.title])).toEqual([
      ['B', 'Веб: инъекции'],
      ['G', 'Сеть'],
    ]);
    expect(f.sections[0]?.topics).toEqual([
      { id: 'B1', title: 'SQL-инъекция', note: null, line: 9 },
      { id: 'B8', title: 'NoSQL-инъекция', note: 'В поле пароля приходит условие', line: 10 },
    ]);
  });

  // UI2: the chips of the lessons column name a section by a short name after « · ».
  it('reads the short name of a section after « · », the full name without it', () => {
    const f = parsed(
      RU,
      file('ru', '## `B` Веб: инъекции · Инъекции\n\n- `B1` SQL\n\n## `G` Сеть\n\n- `G1` X\n'),
    );
    expect(f.sections.map((s) => [s.id, s.title, s.short])).toEqual([
      ['B', 'Веб: инъекции', 'Инъекции'],
      ['G', 'Сеть', null],
    ]);
  });

  it('names the file and the line of each error', () => {
    const errors = errorsOf(
      RU,
      file('ru', '## `B` Веб\n\n- `B1` SQL\n- `B1` Again\n- `C1` Wrong section\n- B2 no ticks\n'),
    );
    expect(errors.map((e) => [e.file, e.line, e.code])).toEqual([
      [RU, 10, 'duplicate'],
      [RU, 11, 'unknown-section'],
      [RU, 12, 'bad-line'],
    ]);
  });

  it.each([
    ['a bad section id', '## `M` Other\n\n- `M1` X\n', 'bad-line'],
    ['a lower case id', '## `B` Web\n\n- `b1` X\n', 'bad-line'],
    ['an id without number', '## `B` Web\n\n- `B` X\n', 'bad-line'],
    ['a topic before any section', '- `B1` X\n\n## `B` Web\n\n- `B2` Y\n', 'stray-content'],
    ['a section twice', '## `B` Web\n\n- `B1` X\n\n## `B` Web\n\n- `B2` Y\n', 'duplicate'],
    ['sections out of order', '## `C` B\n\n- `C1` X\n\n## `B` Web\n\n- `B2` Y\n', 'section-order'],
    ['an empty section', '## `B` Web\n\n## `C` Browser\n\n- `C1` X\n', 'empty-section'],
    ['markup in a title', '## `B` Web\n\n- `B1` <b>SQL</b>\n', 'not-allowed'],
    ['a hidden character', '## `B` Web\n\n- `B1` SQL\u202e\n', 'not-allowed'],
    ['a long title', `## \`B\` Web\n\n- \`B1\` ${'a'.repeat(81)}\n`, 'not-allowed'],
    ['an empty note', '## `B` Web\n\n- `B1` SQL — \n', 'not-allowed'],
    ['markup in a section name', '## `B` Web {x}\n\n- `B1` SQL\n', 'not-allowed'],
    ['an empty short name', '## `B` Web · \n\n- `B1` SQL\n', 'not-allowed'],
    ['a long short name', `## \`B\` Web · ${'a'.repeat(21)}\n\n- \`B1\` SQL\n`, 'not-allowed'],
    ['markup in a short name', '## `B` Web · <i>W</i>\n\n- `B1` SQL\n', 'not-allowed'],
  ])('rejects %s', (_name, body, code) => {
    expect(errorsOf(RU, file('ru', body)).map((e) => e.code)).toContain(code);
  });

  it('rejects a wrong header, a language not of its folder, a wrong path', () => {
    expect(errorsOf(RU, '# T\n\n`ui` ru · `format` 1\n').map((e) => e.code)).toEqual([
      'bad-header',
    ]);
    expect(errorsOf(RU, file('en', '## `B` W\n\n- `B1` X\n')).map((e) => e.code)).toEqual([
      'bad-header',
    ]);
    expect(errorsOf(RU, 'no title').map((e) => e.code)).toEqual(['missing-title']);
    expect(errorsOf('content/catalog.md', SMALL_RU).map((e) => e.code)).toEqual(['bad-path']);
    expect(errorsOf(RU, '').map((e) => e.code)).toEqual(['bad-header']);
  });

  it('treats hostile input as data', () => {
    for (const input of [null, 42, {}, ['x']]) {
      expect(errorsOf(RU, input).map((e) => e.code)).toEqual(['parse-failed']);
    }
    expect(errorsOf(RU, 'x'.repeat(MAX_CATALOG_FILE_BYTES + 1)).map((e) => e.code)).toEqual([
      'too-large',
    ]);
    // The limit is in UTF-8 bytes: 40 000 Cyrillic letters are 80 000 bytes.
    const cyrillic = errorsOf(RU, file('ru', `${'я'.repeat(40_000)}\n`));
    expect(cyrillic.map((e) => e.code)).toEqual(['too-large']);
    expect(cyrillic[0]?.message).toContain('bytes');
    const many = Array.from({ length: 99 }, (_, i) => `- \`B${String(i + 1)}\` T`).join('\n');
    const sections = ['B', 'C', 'D', 'E']
      .map((s) => `## \`${s}\` S\n\n${many.replaceAll('`B', `\`${s}`)}`)
      .join('\n\n');
    expect(errorsOf(RU, file('ru', sections)).map((e) => e.code)).toContain('too-large');
  });

  it('reads a byte order mark and Windows line ends', () => {
    expect(parsed(RU, `\ufeff${SMALL_RU.replaceAll('\n', '\r\n')}`).sections).toHaveLength(2);
  });
});

const B1 = { id: 'B1', section: 'B', language: 'ru' };

describe('checkCatalogs', () => {
  const context = {
    lessons: [B1],
    lessonPaths: ['content/lessons/B1/ru.md'],
    siteLanguages: ['ru'],
  };

  it('passes the base and a translation with the same topics', () => {
    const result = checkCatalogs(
      [
        { path: RU, text: SMALL_RU },
        { path: EN, text: SMALL_EN },
      ],
      { ...context, siteLanguages: ['ru', 'en'] },
    );
    expect(result.errors).toEqual([]);
    expect([...result.catalogs.keys()]).toEqual(['ru', 'en']);
  });

  it('names a topic the translation misses and one it adds', () => {
    const en = SMALL_EN.replace('- `B8` NoSQL injection\n', '- `B9` Extra\n');
    const { errors } = checkCatalogs(
      [
        { path: RU, text: SMALL_RU },
        { path: EN, text: en },
      ],
      context,
    );
    expect(errors.map((e) => [e.file, e.line, e.code, e.path])).toEqual([
      [EN, 1, 'missing-translation', 'B8'],
      [EN, 10, 'unknown-id', 'B9'],
    ]);
    expect(errors[0]?.message).toContain(`${RU}:10`);
  });

  it('wants the same sections and the same order', () => {
    const swapped = SMALL_EN.replace(
      '- `B1` SQL injection\n- `B8` NoSQL injection',
      '- `B8` NoSQL injection\n- `B1` SQL injection',
    );
    const order = checkCatalogs(
      [
        { path: RU, text: SMALL_RU },
        { path: EN, text: swapped },
      ],
      context,
    );
    // The error stands on the first topic out of place: B8, line 9 of the translation.
    expect(order.errors.map((e) => [e.code, e.line, e.path])).toEqual([['section-order', 9, 'B8']]);
    expect(order.errors[0]?.message).toContain('B1');
  });

  it('requires a catalog for every site language (K94) and the Russian one', () => {
    const { errors } = checkCatalogs([{ path: RU, text: SMALL_RU }], {
      ...context,
      siteLanguages: ['ru', 'en'],
    });
    expect(errors.map((e) => [e.file, e.code])).toEqual([[EN, 'missing-translation']]);
    const none = checkCatalogs([], context);
    expect(none.errors.map((e) => [e.file, e.code])).toEqual([[RU, 'missing-base']]);
  });

  it('wants every lesson folder in the catalog, in its section', () => {
    const { errors } = checkCatalogs([{ path: RU, text: SMALL_RU }], {
      lessons: [{ id: 'G1', section: 'B', language: 'ru' }],
      lessonPaths: ['content/lessons/C3/ru.md', 'content/lessons/G1/ru.md'],
      siteLanguages: ['ru'],
    });
    expect(errors.map((e) => [e.file, e.code])).toEqual([
      ['content/lessons/C3', 'unknown-id'],
      ['content/lessons/G1/ru.md', 'unknown-section'],
    ]);
  });

  it('does not ask again for a catalog that is there but broken', () => {
    const { errors } = checkCatalogs([{ path: RU, text: 'broken' }], context);
    expect(errors.map((e) => e.code)).toEqual(['missing-title']);
  });
});

describe('the catalogs of the repository', () => {
  const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

  it('hold all 75 topics in 12 sections A to L, in Russian and English', () => {
    for (const path of [RU, EN]) {
      const f = parsed(path, read(path));
      expect(f.sections.map((s) => s.id).join('')).toBe('ABCDEFGHIJKL');
      expect(f.sections.flatMap((s) => s.topics)).toHaveLength(75);
    }
    const network = parsed(RU, read(RU)).sections.find((s) => s.id === 'G');
    expect(network?.title).toBe('Сеть');
    expect(network?.topics.map((t) => t.id)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']);
  });

  it('agree with each other', () => {
    const { errors } = checkCatalogs(
      [
        { path: RU, text: read(RU) },
        { path: EN, text: read(EN) },
      ],
      { lessons: [], lessonPaths: [], siteLanguages: ['ru', 'en'] },
    );
    expect(errors).toEqual([]);
  });
});

describe('site topics', () => {
  const site = toSiteTopics(parsed(RU, SMALL_RU), new Set(['B1']));

  it('marks ready lessons and round-trips through JSON', () => {
    expect(topicsFile('ru')).toBe('data/topics/ru.json');
    expect(site.sections[0]?.topics.map((t) => [t.id, t.ready])).toEqual([
      ['B1', true],
      ['B8', false],
    ]);
    const back = readSiteTopics(JSON.parse(JSON.stringify(site)), 'ru');
    expect(back).toEqual({ ok: true, value: site });
  });

  it('gives each section a short name: its own, else the full name (UI2)', () => {
    const short = toSiteTopics(
      parsed(RU, file('ru', '## `B` Веб: инъекции · Инъекции\n\n- `B1` SQL\n')),
      new Set(),
    );
    expect(short.sections[0]?.short).toBe('Инъекции');
    expect(site.sections.map((s) => s.short)).toEqual(['Веб: инъекции', 'Сеть']);
    const without = JSON.parse(JSON.stringify(site)) as { sections: Record<string, unknown>[] };
    delete without.sections[0]?.['short'];
    expect(readSiteTopics(without, 'ru').ok).toBe(false);
  });

  it.each([
    ['not an object', 42],
    ['another format', { ...site, format: 2 }],
    ['another language', { ...site, language: 'en' }],
    ['a section twice', { ...site, sections: [site.sections[0], site.sections[0]] }],
    [
      'a topic of another section',
      {
        ...site,
        sections: [{ id: 'G', title: 'x', short: 'x', topics: site.sections[0]?.topics }],
      },
    ],
    [
      'ready not a boolean',
      {
        ...site,
        sections: [
          {
            id: 'B',
            title: 'x',
            short: 'x',
            topics: [{ id: 'B1', title: 'x', note: null, ready: 1 }],
          },
        ],
      },
    ],
    [
      'a bad id',
      {
        ...site,
        sections: [
          {
            id: 'B',
            title: 'x',
            short: 'x',
            topics: [{ id: 'B1<', title: 'x', note: null, ready: true }],
          },
        ],
      },
    ],
    ['inherited fields', Object.create(site) as unknown],
  ])('rejects %s', (_name, input) => {
    expect(readSiteTopics(input, 'ru').ok).toBe(false);
  });

  it('rejects a file for a language that is no code', () => {
    expect(readSiteTopics({ ...site, language: '../x' }, '../x').ok).toBe(false);
  });
});

describe('search (S7)', () => {
  const ru: SiteTopics = toSiteTopics(parsed(RU, read(RU)), new Set(['B1', 'I1']));
  const en: SiteTopics = toSiteTopics(parsed(EN, read(EN)), new Set(['B1', 'I1']));
  function read(path: string): string {
    return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  }
  const ids = (found: ReturnType<typeof filterTopics>) =>
    found.flatMap((f) => f.topics.map((t) => t.id));

  // UI2: every section of the site's catalogs has its own short name for the chips.
  it('every section of the ru and en catalogs has a short chip name', () => {
    for (const topics of [ru, en]) {
      for (const s of topics.sections) {
        expect(s.short.length, `${topics.language} ${s.id}`).toBeLessThanOrEqual(16);
      }
    }
  });

  it('normalizes case, ё and punctuation', () => {
    expect(normalize('  SQL-Инъекция!  ')).toBe('sql инъекция');
    expect(normalize('Ёжик')).toBe('ежик');
    expect(queryWords('  ')).toEqual([]);
    expect(queryWords('Подделка  отправителя')).toEqual(['подделка', 'отправителя']);
    expect(matchesAll(['ежик'], ['Ёжик'])).toBe(true);
  });

  it('«sql» finds B1 and B8, in Russian and in English', () => {
    expect(ids(filterTopics(ru.sections, { query: 'sql', section: null }))).toEqual(['B1', 'B8']);
    expect(ids(filterTopics(ru.sections, { query: 'SQL', section: null }))).toEqual(['B1', 'B8']);
    expect(ids(filterTopics(en.sections, { query: 'sql', section: null }))).toEqual(['B1', 'B8']);
  });

  it('finds by id, by section name and by several words', () => {
    expect(ids(filterTopics(ru.sections, { query: 'b8', section: null }))).toEqual(['B8']);
    expect(ids(filterTopics(ru.sections, { query: 'сеть', section: null }))).toHaveLength(7);
    expect(ids(filterTopics(en.sections, { query: 'network', section: null }))).toHaveLength(7);
    expect(ids(filterTopics(ru.sections, { query: 'xss хранимый', section: null }))).toEqual([
      'C2',
    ]);
    // ё = е: «Шифровальщик» has no ё, a query with it still finds; «отпечатков» via е.
    expect(ids(filterTopics(ru.sections, { query: 'приём', section: null }))).toEqual([]);
    expect(ids(filterTopics(ru.sections, { query: 'ЗЛОЙ двойник', section: null }))).toEqual([
      'G6',
    ]);
  });

  it('a section filter keeps one section; with a query both apply', () => {
    expect(ids(filterTopics(ru.sections, { query: '', section: 'G' }))).toEqual([
      'G1',
      'G2',
      'G3',
      'G4',
      'G5',
      'G6',
      'G7',
    ]);
    expect(filterTopics(ru.sections, { query: 'sql', section: 'G' })).toEqual([]);
    expect(filterTopics(ru.sections, { query: 'кракозябра', section: null })).toEqual([]);
  });

  it('an empty query shows all 75 topics; counts are per section', () => {
    expect(ids(filterTopics(ru.sections, { query: '', section: null }))).toHaveLength(75);
    const b = ru.sections.find((s) => s.id === 'B');
    expect(b === undefined ? null : readyCount(b)).toEqual({ ready: 1, count: 8 });
  });

  it('a huge query is cut, not slow', () => {
    const started = performance.now();
    filterTopics(ru.sections, { query: 'a '.repeat(100_000), section: null });
    expect(performance.now() - started).toBeLessThan(200);
  });
});
