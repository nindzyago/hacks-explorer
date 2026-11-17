/**
 * Command parameters: a plain-data description and a strict validator.
 *
 * Parameters arrive from the page address and the control channel, so every value is hostile
 * (AGENTS.md L0.2). Nothing is coerced: `"3"` is not an integer. See README.md.
 */

export type ParamSpec =
  | { readonly kind: 'string'; readonly maxLength?: number; readonly optional?: boolean }
  | {
      readonly kind: 'integer' | 'number';
      readonly min?: number;
      readonly max?: number;
      readonly optional?: boolean;
    }
  | { readonly kind: 'boolean'; readonly optional?: boolean }
  | { readonly kind: 'enum'; readonly values: readonly string[]; readonly optional?: boolean };

export type ParamsSpec = Readonly<Record<string, ParamSpec>>;

type ValueOf<P> = P extends { readonly kind: 'string' }
  ? string
  : P extends { readonly kind: 'enum'; readonly values: readonly (infer V)[] }
    ? V
    : P extends { readonly kind: 'integer' | 'number' }
      ? number
      : P extends { readonly kind: 'boolean' }
        ? boolean
        : never;

/** The object a command's `run` receives for a given spec. An absent optional is `undefined`. */
export type ParamsOf<S> = {
  readonly [K in keyof S]: S[K] extends { readonly optional: true }
    ? ValueOf<S[K]> | undefined
    : ValueOf<S[K]>;
};

/** `param` is '' when the problem is about the parameters as a whole. */
export interface ParamProblem {
  readonly param: string;
  readonly problem: string;
}

export type ParamsResult<S> =
  | { readonly ok: true; readonly params: ParamsOf<S> }
  | { readonly ok: false; readonly problems: readonly ParamProblem[] };

export const DEFAULT_MAX_STRING_LENGTH = 200;
const MAX_PROBLEMS = 20;
const MAX_NAME_LENGTH = 40;
const PARAM_NAME = /^[a-z][a-zA-Z0-9]*$/;

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function rangeProblem(value: number, min: number, max: number): string | null {
  if (value >= min && value <= max) return null;
  return `must be between ${String(min)} and ${String(max)}`;
}

/** Why `value` does not fit `spec`, or null when it fits. `undefined` means "absent". */
function valueProblem(spec: ParamSpec, value: unknown): string | null {
  if (value === undefined) return spec.optional === true ? null : 'is required';
  switch (spec.kind) {
    case 'string': {
      if (typeof value !== 'string') return 'must be a string';
      const max = spec.maxLength ?? DEFAULT_MAX_STRING_LENGTH;
      return value.length <= max ? null : `must be at most ${String(max)} characters`;
    }
    case 'integer':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) return 'must be an integer';
      return rangeProblem(
        value,
        spec.min ?? Number.MIN_SAFE_INTEGER,
        spec.max ?? Number.MAX_SAFE_INTEGER,
      );
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'must be a finite number';
      return rangeProblem(value, spec.min ?? -Number.MAX_VALUE, spec.max ?? Number.MAX_VALUE);
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean';
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value)
        ? null
        : `must be one of: ${spec.values.join(', ')}`;
  }
}

/** The checked narrowing: true only when every parameter of `spec` fits and nothing is extra. */
function conforms<S extends ParamsSpec>(spec: S, value: unknown): value is ParamsOf<S> {
  if (!isPlainObject(value)) return false;
  for (const name of Object.keys(value)) if (!Object.hasOwn(spec, name)) return false;
  for (const [name, paramSpec] of Object.entries(spec)) {
    const own = Object.hasOwn(value, name) ? value[name] : undefined;
    if (valueProblem(paramSpec, own) !== null) return false;
  }
  return true;
}

function cut(name: string): string {
  return name.length <= MAX_NAME_LENGTH ? name : `${name.slice(0, MAX_NAME_LENGTH)}…`;
}

function failure(problems: readonly ParamProblem[]): {
  readonly ok: false;
  readonly problems: readonly ParamProblem[];
} {
  if (problems.length <= MAX_PROBLEMS) return { ok: false, problems };
  const rest = problems.length - MAX_PROBLEMS;
  return {
    ok: false,
    problems: [
      ...problems.slice(0, MAX_PROBLEMS),
      { param: '', problem: `and ${String(rest)} more` },
    ],
  };
}

/**
 * Checks hostile `raw` against `spec`. On success returns a fresh object holding only the
 * described parameters; every value of `raw` is read exactly once. Never throws.
 */
export function checkParams<S extends ParamsSpec>(spec: S, raw: unknown): ParamsResult<S> {
  try {
    const source: unknown = raw === undefined ? {} : raw;
    if (!isPlainObject(source)) {
      return failure([{ param: '', problem: 'parameters must be a plain object' }]);
    }
    const problems: ParamProblem[] = [];
    const entries: [string, unknown][] = [];
    for (const [name, paramSpec] of Object.entries(spec)) {
      const value = Object.hasOwn(source, name) ? source[name] : undefined;
      const problem = valueProblem(paramSpec, value);
      if (problem !== null) problems.push({ param: name, problem });
      else if (value !== undefined) entries.push([name, value]);
    }
    for (const name of Object.keys(source)) {
      if (!Object.hasOwn(spec, name)) {
        problems.push({ param: cut(name), problem: 'unknown parameter' });
      }
    }
    if (problems.length > 0) return failure(problems);
    // No prototype: a parameter named `constructor` or `toString` must not read as inherited.
    const params: unknown = Object.setPrototypeOf(Object.fromEntries(entries), null);
    if (conforms(spec, params)) return { ok: true, params };
    return failure([{ param: '', problem: 'parameters could not be read' }]);
  } catch {
    return failure([{ param: '', problem: 'parameters could not be read' }]);
  }
}

function boundsProblem(name: string, spec: ParamSpec & { kind: 'integer' | 'number' }) {
  const fits = spec.kind === 'integer' ? Number.isSafeInteger : Number.isFinite;
  for (const bound of [spec.min, spec.max]) {
    if (bound !== undefined && !fits(bound)) return `${name}: bounds must be ${spec.kind}s`;
  }
  if (spec.min !== undefined && spec.max !== undefined && spec.min > spec.max) {
    return `${name}: min is above max`;
  }
  return null;
}

/** Mistakes in a spec written by a developer; checked once, when the command is registered. */
export function specProblems(spec: ParamsSpec): string[] {
  const problems: string[] = [];
  for (const [name, paramSpec] of Object.entries(spec)) {
    if (!PARAM_NAME.test(name)) {
      problems.push(`${cut(name)}: parameter names look like "step" or "lessonId"`);
      continue;
    }
    switch (paramSpec.kind) {
      case 'string': {
        const max = paramSpec.maxLength;
        if (max !== undefined && (!Number.isSafeInteger(max) || max < 0)) {
          problems.push(`${name}: maxLength must be a non-negative integer`);
        }
        break;
      }
      case 'integer':
      case 'number': {
        const problem = boundsProblem(name, paramSpec);
        if (problem !== null) problems.push(problem);
        break;
      }
      case 'boolean':
        break;
      case 'enum':
        if (paramSpec.values.length === 0) problems.push(`${name}: enum needs values`);
        else if (new Set(paramSpec.values).size !== paramSpec.values.length) {
          problems.push(`${name}: enum values repeat`);
        }
        break;
    }
  }
  return problems;
}
