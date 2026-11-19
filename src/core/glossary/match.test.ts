import { describe, expect, it } from 'vitest';
import type { SiteBlock, SiteInline } from '../lesson/site';
import { createMatcher, linkTerms, normalise } from './match';

const matcher = createMatcher([
  { id: 'query', forms: ['запрос', 'запроса', 'запросу', 'запросом', 'запросе', 'запросы'] },
  { id: 'database', forms: ['база данных', 'базы данных', 'базе данных', 'базу данных'] },
  { id: 'sql', forms: ['SQL'] },
  { id: 'sql-injection', forms: ['SQL-инъекция', 'SQL-инъекции'] },
  { id: 'param', forms: ['параметризованный запрос', 'параметризованного запроса'] },
  { id: 'hash', forms: ['хеш', 'хеша'] },
  { id: 'attack', forms: ['MITRE ATT&CK', 'ATT&CK'] },
]);

const p = (text: string): SiteBlock => ({
  type: 'paragraph',
  children: [{ type: 'text', value: text }],
});

/** A paragraph as `text[id:word]text`, so a test reads like the sentence. */
function show(nodes: readonly SiteInline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return n.value;
        case 'term':
          return `[${n.id}:${show(n.children)}]`;
        case 'code':
          return `\`${n.value}\``;
        case 'strong':
          return `**${show(n.children)}**`;
        case 'emphasis':
          return `*${show(n.children)}*`;
        case 'break':
          return '\n';
      }
    })
    .join('');
}

function linked(blocks: SiteBlock[], skip: string | null = null): string[] {
  return linkTerms(blocks, matcher, skip).map((b) =>
    b.type === 'paragraph' ? show(b.children) : JSON.stringify(b),
  );
}

describe('linkTerms', () => {
  it('finds listed Russian forms, any case, keeping the text as written', () => {
    expect(linked([p('Сервер отправляет Запрос в базу данных.')])).toEqual([
      'Сервер отправляет [query:Запрос] в [database:базу данных].',
    ]);
  });

  it('finds only listed forms, not every word that starts the same', () => {
    expect(linked([p('Запросами и запросник не являются формами.')])).toEqual([
      'Запросами и запросник не являются формами.',
    ]);
  });

  it('matches whole words only: letters, digits, _ and - around a form block it', () => {
    expect(linked([p('перезапрос, запрос2, _запрос, SQL-запрос, запрос-ответ')])).toEqual([
      'перезапрос, запрос2, _запрос, SQL-запрос, запрос-ответ',
    ]);
    expect(linked([p('«запрос», (SQL)')])).toEqual(['«[query:запрос]», ([sql:SQL])']);
  });

  it('treats ё as е and a line break inside a multi-word form as a space', () => {
    const m = createMatcher([{ id: 'hash', forms: ['ещё хеш'] }]);
    const out = linkTerms([p('Это Еще\nхеш.')], m);
    expect(out[0]?.type === 'paragraph' && show(out[0].children)).toBe('Это [hash:Еще\nхеш].');
  });

  it('prefers the longest form at a place and never finds a shorter one inside it', () => {
    expect(linked([p('Это SQL-инъекция, а потом SQL.')])).toEqual([
      'Это [sql-injection:SQL-инъекция], а потом [sql:SQL].',
    ]);
    expect(linked([p('Параметризованный запрос и потом запрос.')])).toEqual([
      '[param:Параметризованный запрос] и потом [query:запрос].',
    ]);
  });

  it('the longest form wins even when a shorter form of another term starts there', () => {
    const m = createMatcher([
      { id: 'short', forms: ['база'] },
      { id: 'long', forms: ['база данных'] },
    ]);
    const out = linkTerms([p('Это база данных, а это база.')], m);
    expect(out[0]?.type === 'paragraph' && show(out[0].children)).toBe(
      'Это [long:база данных], а это [short:база].',
    );
  });

  it('looks across the edge of bold and italic for word boundaries', () => {
    const bold = (before: string, word: string, after: string): SiteBlock => ({
      type: 'paragraph',
      children: [
        { type: 'text', value: before },
        { type: 'strong', children: [{ type: 'text', value: word }] },
        { type: 'text', value: after },
      ],
    });
    // «**SQL**-инъекция» is one word: `SQL` alone is not linked inside it.
    expect(linked([bold('Это ', 'SQL', '-инъекция.')])).toEqual(['Это **SQL**-инъекция.']);
    expect(linked([bold('про', 'SQL', ' и')])).toEqual(['про**SQL** и']);
    expect(linked([bold('Это ', 'SQL', ' и')])).toEqual(['Это **[sql:SQL]** и']);
    // Nested: the edge is the edge of the outer node too.
    const nested: SiteBlock = {
      type: 'paragraph',
      children: [
        {
          type: 'emphasis',
          children: [{ type: 'strong', children: [{ type: 'text', value: 'SQL' }] }],
        },
        { type: 'text', value: '-запрос' },
      ],
    };
    expect(linked([nested])).toEqual(['***SQL***-запрос']);
  });

  it('links a term once per block, at its first occurrence', () => {
    expect(linked([p('Запрос, ещё запрос.'), p('Новый абзац: запрос.')])).toEqual([
      '[query:Запрос], ещё запрос.',
      'Новый абзац: [query:запрос].',
    ]);
  });

  it('counts a whole list as one block', () => {
    const list: SiteBlock = {
      type: 'list',
      ordered: false,
      items: [[p('Первый запрос.')], [p('Второй запрос и хеш.')]],
    };
    const [out] = linkTerms([list], matcher);
    expect(
      out?.type === 'list' &&
        out.items.map((i) => i.map((b) => (b.type === 'paragraph' ? show(b.children) : ''))),
    ).toEqual([['Первый [query:запрос].'], ['Второй запрос и [hash:хеш].']]);
  });

  it('never searches code: inline code and code blocks stay as they are', () => {
    const block: SiteBlock = {
      type: 'paragraph',
      children: [
        { type: 'code', value: 'SELECT запрос FROM SQL' },
        { type: 'text', value: ' — это SQL' },
      ],
    };
    expect(linked([block])).toEqual(['`SELECT запрос FROM SQL` — это [sql:SQL]']);
    const code: SiteBlock = {
      type: 'code',
      lang: 'sql',
      segments: [{ text: 'SQL запрос', marked: false }],
    };
    expect(linkTerms([code], matcher)).toEqual([code]);
  });

  it('finds terms inside bold and italic, but not across their edge', () => {
    const block: SiteBlock = {
      type: 'paragraph',
      children: [
        { type: 'strong', children: [{ type: 'text', value: 'хеш' }] },
        { type: 'text', value: ' и ' },
        { type: 'emphasis', children: [{ type: 'text', value: 'база' }] },
        { type: 'text', value: ' данных' },
      ],
    };
    expect(linked([block])).toEqual(['**[hash:хеш]** и *база* данных']);
  });

  it('keeps forms with & and spaces and skips the term a definition belongs to', () => {
    expect(linked([p('Техника в MITRE ATT&CK и SQL.')], 'sql')).toEqual([
      'Техника в [attack:MITRE ATT&CK] и SQL.',
    ]);
  });

  it('leaves text without terms untouched and empty input empty', () => {
    expect(linked([p('Ничего нет.')])).toEqual(['Ничего нет.']);
    expect(linkTerms([], matcher)).toEqual([]);
    expect(linkTerms([p('запрос')], createMatcher([]))).toEqual([p('запрос')]);
  });

  it('is deterministic and does not change its input', () => {
    const input = [p('Запрос и SQL.')];
    const copy = JSON.stringify(input);
    expect(JSON.stringify(linkTerms(input, matcher))).toBe(
      JSON.stringify(linkTerms(input, matcher)),
    );
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('is quick on a long hostile text', () => {
    const many = createMatcher(
      Array.from({ length: 300 }, (_, i) => ({
        id: `t${String(i)}`,
        forms: [`ааа${'а'.repeat(i % 40)}б`],
      })),
    );
    const started = Date.now();
    linkTerms([p('а'.repeat(60_000))], many);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('normalise', () => {
  it('keeps the length, so indexes stay valid', () => {
    for (const s of ['ЁЛКА', 'İstanbul', '😀 Запрос\tтекст', 'ß']) {
      expect(normalise(s).length).toBe(s.length);
    }
  });
});
