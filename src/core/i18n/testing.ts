/**
 * For unit tests only (never imported by the site): the real interface strings of a language,
 * read from content/locales/<lang>/ui.md, as the `say` the core functions take. Tests of the core
 * check their words against the file the site ships, not against a copy.
 */
import { readFileSync } from 'node:fs';
import { fill, type Say } from './say';
import { parseUiFile, uiPath } from './ui-file';

export function sayFromFile(language: string): Say<string> {
  const path = uiPath(language);
  const parsed = parseUiFile(
    path,
    readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'),
  );
  if (!parsed.ok) throw new Error(`${path} has errors: ${JSON.stringify(parsed.errors)}`);
  const { entries } = parsed.file;
  return (key, params) => {
    const entry = entries.get(key);
    if (entry === undefined) throw new Error(`no key ${key} in ${path}`);
    return fill(entry.text, params);
  };
}
