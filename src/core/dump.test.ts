// Oracle: level A — dumps of equal states are equal byte for byte (M0.4).
import { describe, expect, it } from 'vitest';
import { stableDump } from './dump';

function textOf(value: unknown): string {
  const result = stableDump(value);
  if (!result.ok) throw new Error(`${result.error.code} at ${result.error.path}`);
  return result.text;
}

function codeOf(value: unknown): string {
  const result = stableDump(value);
  return result.ok ? 'ok' : `${result.error.code}@${result.error.path}`;
}

describe('stableDump', () => {
  it('does not depend on the order in which keys were added', () => {
    const a = { b: 1, a: { y: [1, 2, { q: null, p: true }], x: 'text' }, 10: 'ten', 9: 'nine' };
    const b = { 9: 'nine', a: { x: 'text', y: [1, 2, { p: true, q: null }] }, 10: 'ten', b: 1 };
    expect(textOf(a)).toBe(textOf(b));
    expect(textOf(a)).toBe(
      [
        '{',
        '  "10": "ten",',
        '  "9": "nine",',
        '  "a": {',
        '    "x": "text",',
        '    "y": [',
        '      1,',
        '      2,',
        '      {',
        '        "p": true,',
        '        "q": null',
        '      }',
        '    ]',
        '  },',
        '  "b": 1',
        '}',
      ].join('\n'),
    );
  });

  it('orders keys by UTF-16 code units, not by the rules of a language', () => {
    const value = { a: 1, B: 2, ä: 3, Z: 4, _: 5, я: 6, Я: 7, '': 8 };
    const keys = Array.from(textOf(value).matchAll(/"([^"]*)":/g), (match) => match[1]);
    expect(keys).toEqual(['', 'B', 'Z', '_', 'a', 'ä', 'Я', 'я']);
  });

  it('never calls toJSON: a function is not data', () => {
    let calls = 0;
    const withToJson = {
      n: 1,
      toJSON() {
        calls += 1;
        return 'replaced';
      },
    };
    expect(codeOf(withToJson)).toBe('unsupported@$.toJSON');
    expect(codeOf({ a: [withToJson] })).toBe('unsupported@$.a[0].toJSON');
    class Money {
      amount = 5;
      toJSON() {
        calls += 1;
        return 5;
      }
    }
    expect(codeOf(new Money())).toBe('unsupported@$');
    expect(codeOf({ price: new Money() })).toBe('unsupported@$.price');
    expect(calls).toBe(0);
  });

  it('rejects values that only look like plain arrays and objects', () => {
    class List extends Array<number> {}
    expect(codeOf(List.from([1, 2]))).toBe('unsupported@$');
    expect(codeOf({ list: Object.assign([1, 2], { note: 'extra' }) })).toBe('unsupported@$.list');
    const disguised = (value: object): unknown => {
      Object.setPrototypeOf(value, Object.prototype);
      return value;
    };
    expect(codeOf({ m: disguised(new Map([['k', 1]])) })).toBe('unsupported@$.m');
    expect(codeOf(disguised(new Set([1])))).toBe('unsupported@$');
    expect(codeOf(disguised(new WeakMap()))).toBe('unsupported@$');
    expect(codeOf(disguised(new WeakSet()))).toBe('unsupported@$');
    expect(codeOf(disguised(new Date(0)))).toBe('unsupported@$');
    expect(codeOf(disguised(/x/))).toBe('unsupported@$');
    expect(codeOf(disguised(new Error('x')))).toBe('unsupported@$');
    expect(codeOf(disguised(new Uint8Array(2)))).toBe('unsupported@$');
    expect(codeOf(disguised(new String('boxed')))).toBe('unsupported@$');
    expect(codeOf({ [Symbol.toStringTag]: 'Custom', a: 1 })).toBe('unsupported@$');
    for (const length of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2']) {
      const liar: unknown = new Proxy([1, 2], {
        get: (target, key): unknown => (key === 'length' ? length : Reflect.get(target, key)),
      });
      expect(codeOf([liar])).toBe('unreadable@$[0]');
    }
  });

  it('is valid JSON that reads back as the same data', () => {
    const value: unknown = JSON.parse(
      '{"text":"кавычки \\" и \\\\ и \\n перевод строки \\u2028","numbers":[0,1.5,-3,1e21,9007199254740991],' +
        '"empty":{"list":[],"object":{}},"__proto__":"own key","constructor":1}',
    );
    const text = textOf(value);
    expect(JSON.parse(text)).toEqual(value);
    expect(text).toContain('"__proto__": "own key"');
    expect(textOf([-0])).toBe('[\n  0\n]');
  });

  it('dumps primitives and null-prototype objects, skips undefined properties', () => {
    expect(textOf(null)).toBe('null');
    expect(textOf('a')).toBe('"a"');
    expect(textOf(3)).toBe('3');
    expect(textOf(false)).toBe('false');
    expect(textOf([])).toBe('[]');
    expect(textOf({})).toBe('{}');
    expect(textOf({ a: undefined, b: 1 })).toBe('{\n  "b": 1\n}');
    expect(textOf({ a: undefined })).toBe('{}');
    const bare = Object.assign(Object.create(null) as object, { k: 1 });
    expect(textOf(bare)).toBe('{\n  "k": 1\n}');
  });

  it('the same reference used twice is fine; a cycle is an error', () => {
    const shared = { n: 1 };
    expect(codeOf({ a: shared, b: shared, list: [shared, shared] })).toBe('ok');
    const loop: Record<string, unknown> = { name: 'loop' };
    loop.self = { back: loop };
    expect(codeOf(loop)).toBe('cycle@$.self.back');
    const ring: unknown[] = [];
    ring.push([ring]);
    expect(codeOf(ring)).toBe('cycle@$[0][0]');
  });

  it('rejects what JSON cannot hold, with the path', () => {
    expect(codeOf(undefined)).toBe('unsupported@$');
    expect(codeOf({ a: [1, Number.NaN] })).toBe('unsupported@$.a[1]');
    expect(codeOf({ a: Number.POSITIVE_INFINITY })).toBe('unsupported@$.a');
    expect(codeOf([undefined])).toBe('unsupported@$[0]');
    // eslint-disable-next-line no-sparse-arrays -- hostile on purpose
    expect(codeOf([1, , 3])).toBe('unsupported@$[1]');
    expect(codeOf({ f: () => 1 })).toBe('unsupported@$.f');
    expect(codeOf({ s: Symbol('s') })).toBe('unsupported@$.s');
    expect(codeOf({ n: 1n })).toBe('unsupported@$.n');
    expect(codeOf({ m: new Map() })).toBe('unsupported@$.m');
    expect(codeOf({ s: new Set([1]) })).toBe('unsupported@$.s');
    expect(codeOf({ e: new Error('x') })).toBe('unsupported@$.e');
    expect(codeOf({ r: /x/ })).toBe('unsupported@$.r');
    expect(
      codeOf(
        new (class Point {
          x = 1;
        })(),
      ),
    ).toBe('unsupported@$');
    expect(codeOf({ 'odd key': { 'a.b': Number.NaN } })).toBe('unsupported@$["odd key"]["a.b"]');
  });

  it('hides symbol keys and non-enumerable properties, like JSON', () => {
    const value = { a: 1, [Symbol('hidden')]: 2 };
    Object.defineProperty(value, 'secret', { value: 3, enumerable: false });
    expect(textOf(value)).toBe('{\n  "a": 1\n}');
  });

  it('never throws on hostile objects', () => {
    const getter = {
      get bad(): number {
        throw new Error('getter');
      },
    };
    expect(codeOf(getter)).toBe('unreadable@$.bad');
    const proxy: unknown = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('trap');
        },
      },
    );
    expect(codeOf({ p: proxy })).toBe('unreadable@$.p');
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(codeOf([revoked.proxy])).toBe('unreadable@$[0]');
  });

  it('refuses values that are too deep or too large instead of hanging', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 65; i += 1) deep = [deep];
    expect(codeOf(deep)).toMatch(/^too-deep@/);
    let fine: unknown = 1;
    for (let i = 0; i < 64; i += 1) fine = { v: fine };
    expect(codeOf(fine)).toBe('ok');
    let veryDeep: unknown = 1;
    for (let i = 0; i < 100_000; i += 1) veryDeep = [veryDeep];
    expect(codeOf(veryDeep)).toMatch(/^too-deep@/);
    expect(codeOf(Array.from({ length: 100_001 }, () => 0))).toMatch(/^too-large@/);
    expect(codeOf(Array.from({ length: 50_000 }, () => 0))).toBe('ok');
    expect(codeOf({ length: 4_000_000_000 })).toBe('ok');
    // The count runs over the whole dump, not per container.
    const wide = Object.fromEntries(
      Array.from({ length: 100_000 }, (_, i) => [`k${String(i)}`, 0]),
    );
    expect(codeOf(wide)).toMatch(/^too-large@/);
    delete wide['k0'];
    expect(codeOf(wide)).toBe('ok');
    const shared = Array.from({ length: 1000 }, () => 0);
    expect(codeOf(Array.from({ length: 99 }, () => shared))).toBe('ok');
    expect(codeOf(Array.from({ length: 100 }, () => shared))).toMatch(/^too-large@\$\[99\]/);
    const huge: unknown[] = [];
    huge.length = 4_000_000_000;
    expect(codeOf(huge)).toMatch(/^too-large@/);
  });

  it('the error is plain data with a short path', () => {
    const result = stableDump({ ['k'.repeat(500)]: { ['z'.repeat(500)]: Number.NaN } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.path.length).toBeLessThanOrEqual(200);
    expect(JSON.parse(JSON.stringify(result.error))).toEqual(result.error);
  });
});
