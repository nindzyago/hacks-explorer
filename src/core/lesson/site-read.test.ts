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

  it('survives text nested too deep and huge arrays without throwing', () => {
    let deep: unknown = { type: 'text', value: 'x' };
    for (let i = 0; i < 100_000; i += 1) deep = { type: 'strong', children: [deep] };
    const nested = broken((d) => {
      const steps = d['steps'] as { levels: { simple: unknown[] } }[];
      steps[0]?.levels.simple.push({ type: 'paragraph', children: [deep] });
    });
    expect(readSiteLesson(nested, WANT).ok).toBe(false);
    const many = broken((d) => (d['sources'] = Array.from({ length: 200_000 }, () => 1)));
    expect(readSiteLesson(many, WANT).ok).toBe(false);
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
    ['a lesson twice', { format: 1, lessons: [good.lessons[0], good.lessons[0]] }],
  ];
  it.each(bad)('rejects %s', (_, input) => {
    const result = readCatalog(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('bad-data');
  });
});
