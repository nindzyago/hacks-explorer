#!/usr/bin/env node
// Licence check of the dependencies (law L1, task M4.4), part of `npm run gate` through
// scripts/licenses.test.mjs. Run by hand: `npm run licenses`.
//
// Every package npm installed (node_modules, nested node_modules and scopes included) and every
// package the lockfile names (so the Linux-only optional packages of CI are checked on a Mac too)
// must carry a licence from the L1 list, or be named in EXCEPTIONS below with a reason. A licence
// expression is read the SPDX way: `A OR B` passes when one side passes, `A AND B` when both do,
// `A WITH exception` is never allowed. A package with no licence, or a licence written in any
// other form, fails: nobody can say it is allowed. No dependency of its own (L3).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Licences L1 allows for code. Fonts are not npm packages; ATTRIBUTION.md holds them (SIL OFL). */
export const ALLOWED = ['MIT', 'Apache-2.0', 'ISC', 'Zlib', 'MPL-2.0'];
/** BSD-2-Clause, BSD-3-Clause and the other BSD-<n>-Clause forms. */
const BSD = /^BSD-\d-Clause(?:-[A-Za-z]+)*$/;

/**
 * Packages allowed with a licence outside the list. Keyed by package name and licence, so the
 * same licence on another package, or a new licence on this one, stops the gate again.
 * @type {ReadonlyArray<{ name: string, license: string, reason: string }>}
 */
export const EXCEPTIONS = [
  {
    name: 'minimatch',
    license: 'BlueOak-1.0.0',
    reason:
      'Blue Oak Model License 1.0.0: permissive, OSI-approved, like MIT plus a patent grant. ' +
      'Development only (through eslint and typescript-eslint), never part of the site.',
  },
  {
    name: '@isaacs/nonrecursive-glob-match',
    license: 'BlueOak-1.0.0',
    reason: 'Same licence and author as minimatch; development only, never part of the site.',
  },
  {
    name: 'tslib',
    license: '0BSD',
    reason:
      'Zero-clause BSD: BSD without the notice condition, so less demanding than BSD-2-Clause. ' +
      'Optional development package (the WebAssembly fallback of the build tools, through ' +
      '@emnapi), not installed on macOS or Linux x64, never part of the site.',
  },
];

/**
 * Is one SPDX licence id allowed by L1?
 * @param {string} id
 */
export function allowedId(id) {
  return ALLOWED.includes(id) || BSD.test(id);
}

/**
 * Does an SPDX expression pass? `OR` needs one side, `AND` needs both; parentheses group;
 * `WITH`, `+`, `LicenseRef-…` and anything not an expression fail.
 * @param {unknown} expression
 * @returns {boolean}
 */
export function allowedExpression(expression) {
  if (typeof expression !== 'string') return false;
  const tokens = expression.match(/\(|\)|[^\s()]+/g);
  if (tokens === null) return false;
  let at = 0;
  /** @returns {boolean | null} null when the expression is malformed */
  const primary = () => {
    const token = tokens[at];
    if (token === undefined) return null;
    at += 1;
    if (token === '(') {
      const inner = or();
      if (inner === null || tokens[at] !== ')') return null;
      at += 1;
      return inner;
    }
    if (token === ')' || /^(AND|OR|WITH)$/i.test(token)) return null;
    if (/^with$/i.test(tokens[at] ?? '')) return null;
    return allowedId(token);
  };
  /** @returns {boolean | null} */
  const and = () => {
    let value = primary();
    while (value !== null && /^AND$/i.test(tokens[at] ?? '')) {
      at += 1;
      const right = primary();
      value = right === null ? null : value && right;
    }
    return value;
  };
  /** @returns {boolean | null} */
  function or() {
    let value = and();
    while (value !== null && /^OR$/i.test(tokens[at] ?? '')) {
      at += 1;
      const right = and();
      value = right === null ? null : value || right;
    }
    return value;
  }
  const value = or();
  return value === true && at === tokens.length;
}

/**
 * The licence a package.json declares, as one string: `license`, or the old `licenses` array
 * joined with OR (any of them may be chosen), or the old `license: { type }` object.
 * @param {unknown} manifest
 * @returns {string | null}
 */
export function declaredLicense(manifest) {
  if (manifest === null || typeof manifest !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (manifest);
  const typeOf = (/** @type {unknown} */ value) =>
    typeof value === 'string'
      ? value
      : value !== null && typeof value === 'object' && 'type' in value
        ? typeof value.type === 'string'
          ? value.type
          : null
        : null;
  const single = typeOf(record.license);
  if (single !== null && single.trim() !== '') return single.trim();
  if (Array.isArray(record.licenses) && record.licenses.length > 0) {
    const all = record.licenses.map(typeOf);
    if (all.every((type) => type !== null && type.trim() !== '')) {
      return all.length === 1 ? String(all[0]) : all.map((type) => `(${type})`).join(' OR ');
    }
  }
  return null;
}

/**
 * Problems in a list of packages: one line for each package whose licence is neither allowed
 * nor an exception.
 * @param {ReadonlyArray<{ name: string, license: string | null, where: string }>} packages
 * @param {ReadonlyArray<{ name: string, license: string }>} [exceptions]
 * @returns {string[]}
 */
export function checkPackages(packages, exceptions = EXCEPTIONS) {
  const problems = [];
  for (const pkg of packages) {
    if (allowedExpression(pkg.license)) continue;
    if (exceptions.some((e) => e.name === pkg.name && e.license === pkg.license)) continue;
    problems.push(
      `${pkg.name} (${pkg.where}): licence ${pkg.license ?? 'not declared'} is not in L1 ` +
        'and not an exception in scripts/licenses.mjs',
    );
  }
  return problems;
}

/**
 * Every package installed under `root/node_modules`, nested ones and scopes included.
 * @param {string} root
 * @returns {{ name: string, license: string | null, where: string }[]}
 */
export function installedPackages(root) {
  /** @type {{ name: string, license: string | null, where: string }[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.name.startsWith('@')) {
        walk(path);
        continue;
      }
      const manifestPath = join(path, 'package.json');
      if (!existsSync(manifestPath)) continue;
      /** @type {unknown} */
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch {
        manifest = null;
      }
      const name =
        manifest !== null &&
        typeof manifest === 'object' &&
        'name' in manifest &&
        typeof manifest.name === 'string'
          ? manifest.name
          : path.slice(root.length + 1);
      found.push({
        name,
        license: declaredLicense(manifest),
        where: path.slice(root.length + 1),
      });
      walk(join(path, 'node_modules'));
    }
  };
  walk(join(root, 'node_modules'));
  return found;
}

/**
 * Every package the lockfile (lockfileVersion 2 or 3) names, installed here or not.
 * @param {unknown} lock
 * @returns {{ name: string, license: string | null, where: string }[]}
 */
export function lockedPackages(lock) {
  if (lock === null || typeof lock !== 'object' || !('packages' in lock)) {
    throw new Error('package-lock.json has no "packages" (lockfileVersion 2 or newer needed)');
  }
  const packages = lock.packages;
  if (packages === null || typeof packages !== 'object') {
    throw new Error('package-lock.json "packages" is not an object');
  }
  return Object.entries(packages)
    .filter(
      ([path, value]) =>
        path !== '' && !(value !== null && typeof value === 'object' && 'link' in value),
    )
    .map(([path, value]) => ({
      name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
      license: declaredLicense(value),
      where: `package-lock.json ${path}`,
    }));
}

/**
 * The whole check for a project folder.
 * @param {string} root
 * @returns {{ problems: string[], licences: Map<string, number>, count: number }}
 */
export function checkProject(root) {
  const installed = installedPackages(root);
  const locked = lockedPackages(JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')));
  const all = [...installed, ...locked];
  const licences = new Map();
  for (const pkg of installed) {
    const key = pkg.license ?? 'not declared';
    licences.set(key, (licences.get(key) ?? 0) + 1);
  }
  return { problems: checkPackages(all), licences, count: installed.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { problems, licences, count } = checkProject(root);
  console.log(`${count} installed packages:`);
  for (const [licence, n] of [...licences].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${licence}`);
  }
  for (const e of EXCEPTIONS) console.log(`exception: ${e.name} ${e.license}: ${e.reason}`);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
