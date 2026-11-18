// M1.1b, oracle level D: the site reads lesson data as hostile input (L0.2). Good data comes
// back typed; anything else is a `bad-data` error, never an exception.
import { describe, expect, it } from 'vitest';
import { checkLesson } from './check';
import validRu from './fixtures/valid-ru.md?raw';
import type { SiteCatalog, SiteLesson } from './site';
import { toSiteLesson } from './site';
import { readCatalog, readSiteLesson } from './site-read';

function goodLesson(): SiteLesson {
  const { lesson, errors } = checkLesson('content/lessons/X1/ru.md', validRu, {
    sourceDomains: ['owasp.org'],
  });
  if (lesson === null) throw new Error(JSON.stringify(errors));
  return toSiteLesson(lesson);
}
const WANT = { id: 'X1', language: 'ru' };

/** A deep copy through JSON, the way the data travels. */
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
/** A JSON copy of the good lesson with one change made by `change`. */
function broken(change: (data: Record<string, unknown>) => void): unknown {
  const data = json(goodLesson());
  if (typeof data !== 'object' || data === null) throw new Error('not an object');
  change(data as Record<string, unknown>);
  return data;
}

describe('readSiteLesson', () => {
  it('reads good data back unchanged', () => {
    const lesson = goodLesson();
    const result = readSiteLesson(json(lesson), WANT);
    expect(result).toEqual({ ok: true, value: lesson });
  });

  it('keeps the text tree: paragraphs, lists, bold, code, marked code', () => {
    const result = readSiteLesson(json(goodLesson()), WANT);
    if (!result.ok) throw new Error(result.error.message);
    const step = result.value.steps[0];
    expect(step?.code?.segments).toContainEqual({ text: 'evil', marked: true });
    const first = step?.levels.simple[0];
    expect(first?.type).toBe('paragraph');
    const kinds = first?.type === 'paragraph' ? first.children.map((c) => c.type) : [];
    expect(kinds.slice(0, 4)).toEqual(['text', 'strong', 'text', 'code']);
    expect(step?.levels.detailed[0]).toMatchObject({ type: 'list', ordered: true });
  });

  const cases: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['a string', '<p>hi</p>'],
    ['an array', []],
    ['another format', broken((d) => (d['format'] = 2))],
    ['another lesson id', broken((d) => (d['id'] = 'B2'))],
    ['another language', broken((d) => (d['language'] = 'en'))],
    ['a title that is not text', broken((d) => (d['title'] = 7))],
    ['no steps field', broken((d) => delete d['steps'])],
    ['a wave of 1.5', broken((d) => (d['wave'] = 1.5))],
    [
      'a step from an unknown participant',
      broken((d) => {
        const steps = d['steps'] as Record<string, unknown>[];
        if (steps[0]) steps[0]['from'] = 'nobody';
      }),
    ],
    [
      'an unknown message kind',
      broken((d) => {
        const steps = d['steps'] as Record<string, unknown>[];
        if (steps[0]) steps[0]['kind'] = 'evil';
      }),
    ],
    [
      'an HTML node in the text',
      broken((d) => {
        const steps = d['steps'] as { levels: { simple: unknown[] } }[];
        steps[0]?.levels.simple.push({ type: 'html', value: '<script>alert(1)</script>' });
      }),
    ],
    [
      'a text node without text',
      broken((d) => {
        const steps = d['steps'] as { levels: { simple: { children: unknown[] }[] } }[];
        steps[0]?.levels.simple[0]?.children.push({ type: 'text', value: 5 });
      }),
    ],
    [
      'a zone with an unknown member',
      broken((d) => {
        const zones = d['zones'] as { members: unknown[] }[];
        zones[0]?.members.push('ghost');
      }),
    ],
    [
      'a source that is not https',
      broken((d) => {
        const sources = d['sources'] as { url: unknown }[];
        if (sources[0]) sources[0].url = 'javascript:alert(1)';
      }),
    ],
    [
      'a passport severity out of the list',
      broken((d) => ((d['passport'] as Record<string, unknown>)['severity'] = 'extreme')),
    ],
  ];
  it.each(cases)('rejects %s', (_, input) => {
    const result = readSiteLesson(input, WANT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('bad-data');
  });

  it('names where the data is wrong', () => {
    const result = readSiteLesson(
      broken((d) => {
        const steps = d['steps'] as Record<string, unknown>[];
        if (steps[0]) steps[0]['kind'] = 'evil';
      }),
      WANT,
    );
    expect(!result.ok && result.error.message).toMatch(/^steps\[0\]\.kind: /);
  });

  /** The error message, or '' when the data was read. */
  function messageOf(input: unknown): string {
    const result = readSiteLesson(input, WANT);
    return result.ok ? '' : result.error.message;
  }
  function pushText(block: unknown) {
    return broken((d) => {
      const steps = d['steps'] as { levels: { simple: unknown[] } }[];
      steps[0]?.levels.simple.push(block);
    });
  }

  it('stops at text nested too deep, inline or in lists, without throwing', () => {
    let deep: unknown = { type: 'text', value: 'x' };
    for (let i = 0; i < 100_000; i += 1) deep = { type: 'strong', children: [deep] };
    expect(messageOf(pushText({ type: 'paragraph', children: [deep] }))).toMatch(
      /: expected text nested at most 32 deep$/,
    );
    let lists: unknown = { type: 'paragraph', children: [] };
    for (let i = 0; i < 40; i += 1) lists = { type: 'list', ordered: false, items: [[lists]] };
    expect(messageOf(pushText(lists))).toMatch(/: expected text nested at most 32 deep$/);
    // 30 levels of lists are still text.
    let fine: unknown = { type: 'paragraph', children: [] };
    for (let i = 0; i < 30; i += 1) fine = { type: 'list', ordered: false, items: [[fine]] };
    expect(messageOf(pushText(fine))).toBe('');
  });

  it('stops at lists longer than 2000 items', () => {
    const source = { title: 't', url: 'https://owasp.org/' };
    const many = broken((d) => (d['sources'] = Array.from({ length: 2001 }, () => source)));
    expect(messageOf(many)).toBe('sources: expected at most 2000 items');
    const most = broken((d) => (d['sources'] = Array.from({ length: 2000 }, () => source)));
    expect(messageOf(most)).toBe('');
  });

  it('rejects a participant, zone or step id given twice', () => {
    const twice = (field: string) =>
      broken((d) => {
        const items = d[field] as unknown[];
        items.push(items[0]);
      });
    expect(messageOf(twice('participants'))).toBe('participants: expected each id once');
    expect(messageOf(twice('zones'))).toBe('zones: expected each id once');
    expect(messageOf(twice('steps'))).toBe('steps: expected each id once');
  });

  it('ignores __proto__ and extra fields', () => {
    const data = broken((d) => {
      d['extra'] = 1;
    });
    const withProto = JSON.parse(
      JSON.stringify(data).replace('{', '{"__proto__":{"polluted":true},'),
    ) as unknown;
    const result = readSiteLesson(withProto, WANT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.value)).not.toContain('extra');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('readCatalog', () => {
  const good: SiteCatalog = {
    format: 1,
    lessons: [
      {
        id: 'B1',
        section: 'B',
        wave: 1,
        translations: [
          { language: 'ru', title: 'SQL-инъекция', hash: '0123abcd' },
          { language: 'en', title: 'SQL injection', hash: 'ffff0000' },
        ],
      },
    ],
  };

  it('reads good data back unchanged', () => {
    expect(readCatalog(json(good))).toEqual({ ok: true, value: good });
  });

  const bad: [string, unknown][] = [
    ['null', null],
    ['format 2', { ...good, format: 2 }],
    ['lessons not a list', { format: 1, lessons: {} }],
    ['a bad id', { format: 1, lessons: [{ ...good.lessons[0], id: '../x' }] }],
    [
      'a hash that is a path',
      {
        format: 1,
        lessons: [
          { ...good.lessons[0], translations: [{ language: 'ru', title: 't', hash: '../../x' }] },
        ],
      },
    ],
    [
      'a language that is a path',
      {
        format: 1,
        lessons: [
          {
            ...good.lessons[0],
            translations: [{ language: '../ru', title: 't', hash: '0123abcd' }],
          },
        ],
      },
    ],
    ['no translations', { format: 1, lessons: [{ ...good.lessons[0], translations: [] }] }],
  ];
  it.each(bad)('rejects %s', (_, input) => {
    const result = readCatalog(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('bad-data');
  });

  it('names a lesson or a language given twice', () => {
    const twice = readCatalog({ format: 1, lessons: [good.lessons[0], good.lessons[0]] });
    expect(!twice.ok && twice.error.message).toBe('lessons: expected each lesson once');
    const ru = { language: 'ru', title: 't', hash: '0123abcd' };
    const languages = readCatalog({
      format: 1,
      lessons: [{ ...good.lessons[0], translations: [ru, { ...ru, hash: 'ffff0000' }] }],
    });
    expect(!languages.ok && languages.error.message).toBe(
      'lessons[0].translations: expected each language once',
    );
  });
});
