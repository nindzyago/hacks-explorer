// Oracle: level D (L0.2: every input is hostile), exact asserts.
import { describe, expect, it } from 'vitest';
import { checkParams, specProblems, type ParamsSpec } from './params';

const spec = {
  id: { kind: 'string', maxLength: 8 },
  step: { kind: 'integer', min: 0, max: 99 },
  speed: { kind: 'number', min: 0.25, max: 4 },
  on: { kind: 'boolean' },
  mode: { kind: 'enum', values: ['plain', 'defence'] },
  note: { kind: 'string', optional: true },
} as const satisfies ParamsSpec;

const good = { id: 'B1', step: 3, speed: 1, on: true, mode: 'plain' };

function problemsOf(raw: unknown, against: ParamsSpec = spec) {
  const result = checkParams(against, raw);
  return result.ok ? [] : result.problems;
}

describe('checkParams', () => {
  it('accepts a matching object and returns a clean copy', () => {
    const raw = { ...good, note: 'hi' };
    const result = checkParams(spec, raw);
    expect(result).toEqual({ ok: true, params: raw });
    if (result.ok) expect(result.params).not.toBe(raw);
  });

  it('treats a missing or undefined optional parameter as absent', () => {
    expect(checkParams(spec, good)).toEqual({ ok: true, params: good });
    expect(checkParams(spec, { ...good, note: undefined })).toEqual({ ok: true, params: good });
  });

  it('treats undefined params as an empty object', () => {
    expect(checkParams({}, undefined)).toEqual({ ok: true, params: {} });
    expect(problemsOf(undefined, { on: { kind: 'boolean' } })).toEqual([
      { param: 'on', problem: 'is required' },
    ]);
  });

  it.each([
    ['null', null],
    ['a string', 'step=3'],
    ['a number', 3],
    ['an array', [1, 2]],
    ['a function', () => 1],
    ['a Map', new Map([['step', 3]])],
    ['a Date', new Date(0)],
    ['a Set', new Set(['step'])],
    ['an Error', new Error('step')],
  ])('refuses params that are not a plain object: %s', (_label, raw) => {
    expect(problemsOf(raw)).toEqual([{ param: '', problem: 'parameters must be a plain object' }]);
  });

  it('accepts an object without a prototype', () => {
    const raw: unknown = Object.assign(Object.create(null), { on: true });
    expect(checkParams({ on: { kind: 'boolean' } }, raw)).toEqual({
      ok: true,
      params: { on: true },
    });
  });

  it.each([
    ['missing', {}, 'is required'],
    ['null', { step: null }, 'must be an integer'],
    ['numeric string (no coercion)', { step: '3' }, 'must be an integer'],
    ['fraction', { step: 1.5 }, 'must be an integer'],
    ['NaN', { step: Number.NaN }, 'must be an integer'],
    ['Infinity', { step: Number.POSITIVE_INFINITY }, 'must be an integer'],
    ['negative', { step: -1 }, 'must be between 0 and 99'],
    ['too big', { step: 100 }, 'must be between 0 and 99'],
    ['huge', { step: 1e300 }, 'must be an integer'],
    ['object', { step: { value: 3 } }, 'must be an integer'],
  ])('integer: %s', (_label, patch, problem) => {
    const rest = { id: 'B1', speed: 1, on: true, mode: 'plain' };
    expect(problemsOf({ ...rest, ...patch })).toEqual([{ param: 'step', problem }]);
  });

  it('integer without bounds stays within safe integers', () => {
    const open: ParamsSpec = { n: { kind: 'integer' } };
    expect(checkParams(open, { n: -5 })).toEqual({ ok: true, params: { n: -5 } });
    expect(problemsOf({ n: 2 ** 60 }, open)).toEqual([
      { param: 'n', problem: 'must be an integer' },
    ]);
  });

  it.each([
    ['string', { speed: '1' }, 'must be a finite number'],
    ['NaN', { speed: Number.NaN }, 'must be a finite number'],
    ['Infinity', { speed: Number.NEGATIVE_INFINITY }, 'must be a finite number'],
    ['too small', { speed: 0 }, 'must be between 0.25 and 4'],
    ['too big', { speed: 4.01 }, 'must be between 0.25 and 4'],
  ])('number: %s', (_label, patch, problem) => {
    expect(problemsOf({ ...good, ...patch })).toEqual([{ param: 'speed', problem }]);
  });

  it.each([
    ['number', { id: 1 }, 'must be a string'],
    ['array', { id: ['B1'] }, 'must be a string'],
    ['too long', { id: 'x'.repeat(9) }, 'must be at most 8 characters'],
  ])('string: %s', (_label, patch, problem) => {
    expect(problemsOf({ ...good, ...patch })).toEqual([{ param: 'id', problem }]);
  });

  it('string without maxLength is capped at 200 characters', () => {
    expect(checkParams(spec, { ...good, note: 'x'.repeat(200) }).ok).toBe(true);
    expect(problemsOf({ ...good, note: 'x'.repeat(1_000_000) })).toEqual([
      { param: 'note', problem: 'must be at most 200 characters' },
    ]);
  });

  it.each([
    ['truthy string', { on: 'true' }],
    ['number', { on: 1 }],
    ['null', { on: null }],
  ])('boolean: %s', (_label, patch) => {
    expect(problemsOf({ ...good, ...patch })).toEqual([
      { param: 'on', problem: 'must be a boolean' },
    ]);
  });

  it.each([
    ['other value', { mode: 'attack' }],
    ['wrong case', { mode: 'Plain' }],
    ['number', { mode: 0 }],
    ['inherited key', { mode: 'constructor' }],
  ])('enum: %s', (_label, patch) => {
    expect(problemsOf({ ...good, ...patch })).toEqual([
      { param: 'mode', problem: 'must be one of: plain, defence' },
    ]);
  });

  it('refuses unknown parameters, cutting long names', () => {
    expect(problemsOf({ ...good, extra: 1, ['k'.repeat(500)]: 2 })).toEqual([
      { param: 'extra', problem: 'unknown parameter' },
      { param: `${'k'.repeat(40)}…`, problem: 'unknown parameter' },
    ]);
  });

  it('caps the number of reported problems', () => {
    const raw: Record<string, number> = {};
    for (let i = 0; i < 10_000; i += 1) raw[`k${String(i)}`] = i;
    const problems = problemsOf(raw, {});
    expect(problems).toHaveLength(21);
    expect(problems[20]).toEqual({ param: '', problem: 'and 9980 more' });
  });

  it('ignores inherited and __proto__ tricks', () => {
    const inherited: unknown = Object.create({ on: true });
    expect(problemsOf(inherited, { on: { kind: 'boolean' } })).toEqual([
      { param: '', problem: 'parameters must be a plain object' },
    ]);

    const parsed: unknown = JSON.parse('{"__proto__": {"on": true}, "on": false}');
    expect(problemsOf(parsed, { on: { kind: 'boolean' } })).toEqual([
      { param: '__proto__', problem: 'unknown parameter' },
    ]);
    expect(Object.prototype).not.toHaveProperty('on');
  });

  it('reads every value once and survives objects that throw', () => {
    let reads = 0;
    const flipping = {
      get on() {
        reads += 1;
        return reads === 1 ? true : 'gotcha';
      },
    };
    expect(checkParams({ on: { kind: 'boolean' } }, flipping)).toEqual({
      ok: true,
      params: { on: true },
    });
    expect(reads).toBe(1);

    const throwing = {
      get on(): boolean {
        throw new Error('trap');
      },
    };
    expect(problemsOf(throwing, { on: { kind: 'boolean' } })).toEqual([
      { param: '', problem: 'parameters could not be read' },
    ]);

    const proxy: unknown = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('trap');
        },
      },
    );
    expect(problemsOf(proxy, {})).toEqual([{ param: '', problem: 'parameters could not be read' }]);
  });
});

describe('specProblems', () => {
  it('accepts a sound spec', () => {
    expect(specProblems(spec)).toEqual([]);
    expect(specProblems({})).toEqual([]);
  });

  it.each<[string, ParamsSpec]>([
    ['bad name', { 'my-param': { kind: 'boolean' } }],
    ['__proto__ name', { ['__proto__']: { kind: 'boolean' } }],
    ['min above max', { n: { kind: 'integer', min: 2, max: 1 } }],
    ['non-finite bound', { n: { kind: 'number', max: Number.NaN } }],
    ['fractional integer bound', { n: { kind: 'integer', min: 0.5 } }],
    ['empty enum', { e: { kind: 'enum', values: [] } }],
    ['duplicate enum value', { e: { kind: 'enum', values: ['a', 'a'] } }],
    ['negative maxLength', { s: { kind: 'string', maxLength: -1 } }],
  ])('refuses: %s', (_label, bad) => {
    expect(specProblems(bad)).toHaveLength(1);
  });
});

describe('checkParams with a polluted Object.prototype (N2b)', () => {
  it('reads own properties only and hands the command nothing inherited', () => {
    const polluted = {
      step: { kind: 'integer' },
      note: { kind: 'string', optional: true },
    } as const;
    try {
      Object.defineProperty(Object.prototype, 'step', { value: 5, configurable: true });
      Object.defineProperty(Object.prototype, 'note', { value: 'evil', configurable: true });

      expect(problemsOf({}, polluted)).toEqual([{ param: 'step', problem: 'is required' }]);

      const result = checkParams(polluted, { step: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.params.step).toBe(1);
        expect(result.params.note).toBeUndefined();
      }
    } finally {
      Reflect.deleteProperty(Object.prototype, 'step');
      Reflect.deleteProperty(Object.prototype, 'note');
    }
    expect(Object.prototype).not.toHaveProperty('step');
    expect(Object.prototype).not.toHaveProperty('note');
  });
});

// M1.3 (verifier): a speed of 0.5, 1 or 2 and a lesson id like B1 are checked as parameters, so
// a bad value is `invalid-params`, not a failure inside the command.
describe('number values and string patterns', () => {
  const s = {
    speed: { kind: 'number', values: [0.5, 1, 2] },
    id: { kind: 'string', maxLength: 8, pattern: '[A-Z][0-9]{1,3}' },
  } as const satisfies ParamsSpec;

  it('accepts listed numbers and whole matches', () => {
    expect(checkParams(s, { speed: 0.5, id: 'B1' })).toMatchObject({ ok: true });
    expect(checkParams(s, { speed: 2, id: 'K123' })).toMatchObject({ ok: true });
  });

  it.each([
    [{ speed: 1.5, id: 'B1' }, 'speed'],
    [{ speed: Number.NaN, id: 'B1' }, 'speed'],
    [{ speed: 1, id: 'b1' }, 'id'],
    [{ speed: 1, id: 'B1\n' }, 'id'],
    [{ speed: 1, id: 'xB1' }, 'id'],
    [{ speed: 1, id: 'B1234' }, 'id'],
  ])('rejects %j at %s', (raw, param) => {
    const result = checkParams(s, raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((p) => p.param)).toEqual([param]);
  });

  it('finds bad values and patterns in a spec', () => {
    expect(specProblems({ a: { kind: 'number', values: [] } })).toHaveLength(1);
    expect(specProblems({ a: { kind: 'number', values: [1, Number.NaN] } })).toHaveLength(1);
    expect(specProblems({ a: { kind: 'integer', values: [1.5] } })).toHaveLength(1);
    expect(specProblems({ a: { kind: 'string', pattern: '(' } })).toHaveLength(1);
    expect(specProblems(s)).toEqual([]);
  });
});
