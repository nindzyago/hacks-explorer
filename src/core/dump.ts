/**
 * Deterministic state dump: JSON text with object keys in a fixed order, so the dumps of two
 * runs can be compared byte for byte. Never throws; what JSON cannot hold is an error with the
 * path to the value, not a silent `null`. Behaviour and limits are described in README.md.
 */

export type DumpErrorCode = 'unsupported' | 'cycle' | 'unreadable' | 'too-deep' | 'too-large';

/** Plain data. `path` looks like `$.scene.nodes[3].x`, cut to 200 characters from the left. */
export interface DumpError {
  readonly code: DumpErrorCode;
  readonly path: string;
  readonly message: string;
}

export type DumpResult =
  { readonly ok: true; readonly text: string } | { readonly ok: false; readonly error: DumpError };

export const MAX_DUMP_DEPTH = 64;
export const MAX_DUMP_VALUES = 100_000;
const MAX_PATH_LENGTH = 200;
const INDENT = '  ';
const SIMPLE_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const REASON: Readonly<Record<DumpErrorCode, string>> = {
  unsupported: 'is not JSON data (only null, booleans, finite numbers, strings, arrays, objects)',
  cycle: 'contains itself',
  unreadable: 'could not be read',
  'too-deep': `is nested deeper than ${String(MAX_DUMP_DEPTH)} levels`,
  'too-large': `makes the dump larger than ${String(MAX_DUMP_VALUES)} values`,
};

class DumpFailure extends Error {
  readonly code: DumpErrorCode;
  readonly path: string;

  constructor(code: DumpErrorCode, path: string) {
    super(code);
    this.code = code;
    this.path = path;
  }
}

interface Context {
  values: number;
  /** Containers on the way from the root to the current value. */
  readonly open: Set<object>;
}

function keyPath(path: string, key: string): string {
  return SIMPLE_KEY.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

/** True when `check` accepts `value` as its own kind (it throws for anything else). */
function passes(check: () => unknown): boolean {
  try {
    check();
    return true;
  } catch {
    return false;
  }
}

/** A Map, Set, typed array and the like stay what they are even with a swapped prototype. */
function isBuiltIn(value: object): boolean {
  if (Object.prototype.toString.call(value) !== '[object Object]') return true;
  if (ArrayBuffer.isView(value)) return true;
  return (
    passes(() => Map.prototype.has.call(value, 0)) ||
    passes(() => Set.prototype.has.call(value, 0)) ||
    passes(() => WeakMap.prototype.has.call(value, value)) ||
    passes(() => WeakSet.prototype.has.call(value, value))
  );
}

/** What kind of container `value` is; throws on a revoked proxy and the like. */
function shapeOf(value: object): 'array' | 'object' | 'other' {
  const proto: unknown = Object.getPrototypeOf(value);
  if (Array.isArray(value)) return proto === Array.prototype ? 'array' : 'other';
  if (proto !== null && proto !== Object.prototype) return 'other';
  return isBuiltIn(value) ? 'other' : 'object';
}

function write(value: unknown, path: string, depth: number, context: Context): string {
  context.values += 1;
  if (context.values > MAX_DUMP_VALUES) throw new DumpFailure('too-large', path);
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new DumpFailure('unsupported', path);
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new DumpFailure('unsupported', path);

  if (context.open.has(value)) throw new DumpFailure('cycle', path);
  if (depth >= MAX_DUMP_DEPTH) throw new DumpFailure('too-deep', path);

  let shape: 'array' | 'object' | 'other';
  let keys: string[] = [];
  let length = 0;
  try {
    shape = shapeOf(value);
    if (shape === 'array') length = lengthOf(value);
    if (shape === 'object') keys = Object.keys(value).sort();
  } catch {
    throw new DumpFailure('unreadable', path);
  }
  if (shape === 'other') throw new DumpFailure('unsupported', path);
  if (length > MAX_DUMP_VALUES - context.values) throw new DumpFailure('too-large', path);
  // An array with named properties besides its items: JSON would drop them silently.
  if (shape === 'array' && hasExtraKeys(value, length, path)) {
    throw new DumpFailure('unsupported', path);
  }

  const pad = INDENT.repeat(depth + 1);
  const parts: string[] = [];
  context.open.add(value);
  if (shape === 'array') {
    for (let index = 0; index < length; index += 1) {
      const itemPath = `${path}[${String(index)}]`;
      const item = read(value, String(index), itemPath);
      // A hole or `undefined` would silently become `null` in JSON.
      if (item === undefined) throw new DumpFailure('unsupported', itemPath);
      parts.push(pad + write(item, itemPath, depth + 1, context));
    }
  } else {
    for (const key of keys) {
      const itemPath = keyPath(path, key);
      const item = read(value, key, itemPath);
      if (item === undefined) continue;
      parts.push(`${pad}${JSON.stringify(key)}: ${write(item, itemPath, depth + 1, context)}`);
    }
  }
  context.open.delete(value);

  const [open, close] = shape === 'array' ? ['[', ']'] : ['{', '}'];
  if (parts.length === 0) return open + close;
  return `${open}\n${parts.join(',\n')}\n${INDENT.repeat(depth)}${close}`;
}

/** Throws when `length` is not what a real array can have (a lying proxy). */
function lengthOf(array: object): number {
  const length: unknown = Reflect.get(array, 'length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
    throw new TypeError('bad length');
  }
  return length;
}

function hasExtraKeys(array: object, length: number, path: string): boolean {
  try {
    return Object.keys(array).some((key) => !(Number(key) < length) || String(Number(key)) !== key);
  } catch {
    throw new DumpFailure('unreadable', path);
  }
}

function read(container: object, key: string, path: string): unknown {
  try {
    const item: unknown = Reflect.get(container, key);
    return item;
  } catch {
    throw new DumpFailure('unreadable', path);
  }
}

function cutPath(path: string): string {
  return path.length <= MAX_PATH_LENGTH ? path : `…${path.slice(1 - MAX_PATH_LENGTH)}`;
}

/**
 * JSON text of `value`: two-space indent, object keys sorted by UTF-16 code units, properties
 * holding `undefined` left out. Equal data gives equal text.
 */
export function stableDump(value: unknown): DumpResult {
  try {
    return { ok: true, text: write(value, '$', 0, { values: 0, open: new Set() }) };
  } catch (error) {
    const code = error instanceof DumpFailure ? error.code : 'unreadable';
    const path = cutPath(error instanceof DumpFailure ? error.path : '$');
    return { ok: false, error: { code, path, message: `${path} ${REASON[code]}` } };
  }
}
