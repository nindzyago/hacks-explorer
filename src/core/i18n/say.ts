/**
 * How code below the interface gets words in the reader's language (M2.3): it is handed a
 * function that turns a key into text, `{name}` filled from `params`. The core names the keys it
 * needs as a union of string literals; the interface passes the translator of src/services/i18n,
 * whose keys include them (a missing one is a type error there). The core holds no words itself.
 */
export type SayParams = Readonly<Record<string, string | number>>;

export type Say<K extends string> = (key: K, params?: SayParams) => string;

const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]{0,31})\}/g;

/** Puts `params` into `{name}`; a name without a value stays as it is, so it shows. */
export function fill(text: string, params?: SayParams): string {
  if (params === undefined) return text;
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    if (!Object.hasOwn(params, name)) return whole;
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * OPEN1: a sentence with a link in it. The text around the first `{name}`, so the interface can
 * put an element (a link) in its place and every language keeps its own word order. Null when the
 * text has no `{name}`: the interface then shows the text and the element after it.
 */
export function aroundPlaceholder(
  text: string,
  name: string,
): { readonly before: string; readonly after: string } | null {
  const mark = `{${name}}`;
  const at = text.indexOf(mark);
  if (at < 0) return null;
  return { before: text.slice(0, at), after: text.slice(at + mark.length) };
}
