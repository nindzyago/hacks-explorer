/**
 * L4.2: lessons use only documentation addresses — IPv4 192.0.2.0/24, 198.51.100.0/24,
 * 203.0.113.0/24 (RFC 5737), IPv6 2001:db8::/32 (RFC 3849), names under .example, .test,
 * .invalid, .localhost and example.com/.net/.org (RFC 2606).
 *
 * A heuristic over plain text (the rule and its limits are in README.md, «Адреса»):
 * - the text is NFKC-normalised and zero-width characters are dropped first;
 * - IP addresses are checked everywhere;
 * - a dotted name is a host when it is URL-like (after `scheme://` or `@`, starting with `www.`,
 *   followed by `:port` or `/path`), has a punycode label, mixes Latin and Cyrillic letters, or
 *   ends with a well-known host TLD, or with a phishing-popular TLD that is also a common field
 *   name (`top`, `store`, `info`…) and does not look like code. Other dotted names (`users.id`,
 *   `file.py`) are identifiers.
 */

export interface ForeignAddress {
  /** As normalised: fullwidth characters folded, zero-width characters removed. */
  readonly value: string;
  readonly kind: 'ip' | 'domain';
  /** UTF-16 index in the original text. */
  readonly index: number;
}

const IPV4 = /(?<![\p{N}.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\p{N}|\.\p{N})/gu;
const IPV6_RUN = /[0-9A-Fa-f:]{3,}/g;
const LABEL = '[\\p{L}\\p{N}](?:[\\p{L}\\p{N}\\p{M}-]{0,61}[\\p{L}\\p{N}\\p{M}])?';
const TLD = '(?:xn--[a-z0-9-]{1,59}|\\p{L}[\\p{L}\\p{M}]{1,62})';
const DOMAIN = new RegExp(
  `(?<![\\p{L}\\p{N}\\p{M}_.-])(?:${LABEL}\\.)+${TLD}(?![\\p{L}\\p{N}\\p{M}_-]|\\.[\\p{L}\\p{N}])`,
  'giu',
);
const ZERO_WIDTH = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/u;

const DOC_IPV4 = ['192.0.2.', '198.51.100.', '203.0.113.'];
const DOC_TLDS = new Set(['example', 'test', 'invalid', 'localhost']);
const DOC_SECOND_LEVEL = new Set(['example.com', 'example.net', 'example.org']);

/**
 * Endings that are hosts on their own. Endings that are also common identifiers or file
 * extensions (id, py, md, so, sh, rs, js, name, email, date…) count only in a URL-like place.
 * `cc` also names C++ files (`main.cc`): a known collision, see README «Адреса».
 */
const HOST_TLDS = new Set(
  (
    'com net org edu gov mil biz ru su рф рус ua by kz uk de fr cn jp kr br ca au nl es se ch eu ' +
    'us io co tv xyz tech zip mov ai cc gg ly icu buzz cfd sbs'
  ).split(' '),
);

/**
 * Endings popular with phishing hosts that also name fields in code (`window.top`, `this.store`,
 * `logger.info`, `Makefile.in`, `div.app`). They are hosts unless the name looks like code
 * (`looksLikeCode`).
 */
const CODE_LIKE_TLDS = new Set(
  'app dev site store shop top info online me to it in pl pw live click vip club link'.split(' '),
);

/**
 * Labels that mark a name as a chain of fields (`this.props.store`), a CSS selector
 * (`div.app`) or a build file (`Makefile.in`, `Dockerfile.dev`), not a host. Lowercase.
 */
const CODE_RECEIVERS = new Set(
  // objects and modules in JS and Python
  (
    'this self cls super window document navigator globalthis process module exports console ' +
    'logger log logging req res request response ctx context app config settings options opts ' +
    'props state store vm os sys system path event err error el elem element node style rect ' +
    'bounds offset pos position box stack parent item items data user status btn ' +
    // build and dependency files
    'makefile dockerfile configure setup requirements manifest ' +
    // HTML elements in CSS selectors
    'a abbr article aside b body button canvas code dd div dl dt em footer form h1 h2 h3 h4 h5 h6 ' +
    'header html i img input label li main nav ol option p pre section select small span strong ' +
    'table tbody td textarea th thead tr ul'
  ).split(' '),
);

/** File extensions of `name.<ext>.in` build templates (`config.h.in`, `setup.py.in`). */
const TEMPLATE_EXTENSIONS = new Set(
  'h c py cfg txt json yml yaml toml ini conf xml mk am'.split(' '),
);

/**
 * `receiver.field` with a code-like ending: every label before the ending is a receiver (in a
 * template, the one before `in` may be a file extension); or a two-label name is called or
 * indexed right away (`tensor.to(…)`, `items.shop[0]`). A receiver does not shield a longer
 * name with a foreign label (`this.evil.top`).
 */
function looksLikeCode(labels: readonly string[], after: string): boolean {
  if (labels.length === 2 && /^[([]/.test(after)) return true;
  const head = labels.slice(0, -1);
  if (labels.at(-1) === 'in' && head.length >= 2 && TEMPLATE_EXTENSIONS.has(head.at(-1) ?? '')) {
    head.pop();
  }
  return head.every((label) => CODE_RECEIVERS.has(label));
}

interface Normalised {
  readonly text: string;
  /** For each UTF-16 unit of `text`, its index in the original. */
  readonly origin: readonly number[];
}

function normalise(original: string): Normalised {
  let text = '';
  const origin: number[] = [];
  for (let i = 0; i < original.length;) {
    const cp = original.codePointAt(i) ?? 0;
    const ch = String.fromCodePoint(cp);
    if (!ZERO_WIDTH.test(ch)) {
      const folded = ch.normalize('NFKC');
      text += folded;
      for (let k = 0; k < folded.length; k += 1) origin.push(i);
    }
    i += ch.length;
  }
  origin.push(original.length);
  return { text, origin };
}

/** Parses an IPv6 address into 8 groups, or null when it is not one. */
function ipv6Groups(text: string): number[] | null {
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const part = (s: string) => (s === '' ? [] : s.split(':'));
  const head = part(halves[0] ?? '');
  const tail = halves.length === 2 ? part(halves[1] ?? '') : [];
  const all = [...head, ...tail];
  if (all.length === 0 || !all.every((g) => /^[0-9A-Fa-f]{1,4}$/.test(g))) return null;
  if (halves.length === 1 && all.length !== 8) return null;
  if (halves.length === 2 && all.length > 7) return null;
  const groups = (list: readonly string[]) => list.map((g) => parseInt(g, 16));
  return [...groups(head), ...new Array<number>(8 - all.length).fill(0), ...groups(tail)];
}

function shift<T extends { offset: number }>(found: T | null, by: number): T | null {
  return found === null ? null : { ...found, offset: found.offset + by };
}

/**
 * An IPv6 address inside a run of hex digits and colons. A run glued to letters (`std::`) is
 * not an address; a run after `word:` (`addr:2606:…`) is tried without its first groups.
 */
function ipv6In(run: string, glued: boolean): { value: string; offset: number } | null {
  // An address has at most 39 characters; a longer run is tried from its last 39 only, so a
  // 64 KB run of `1:` costs linear time.
  if (run.length > 45) {
    const cut = run.indexOf(':', run.length - 40);
    return cut < 0 ? null : shift(ipv6In(run.slice(cut), true), cut);
  }
  let offset = 0;
  if (glued) {
    if (!run.startsWith(':') || run.startsWith('::')) return null;
    offset = 1;
  }
  for (let start = offset; start < run.length;) {
    const value = run.slice(start);
    if (value.split(':').length >= 3 && ipv6Groups(value) !== null) return { value, offset: start };
    const next = run.indexOf(':', start + 1);
    if (next < 0 || run.startsWith('::', start)) return null;
    start = next + 1;
  }
  return null;
}

function hasLatinAndCyrillic(name: string): boolean {
  return /[a-z]/i.test(name) && /[Ѐ-ӿ]/.test(name);
}

function isDocumentationName(labels: readonly string[]): boolean {
  if (DOC_TLDS.has(labels.at(-1) ?? '')) return true;
  return DOC_SECOND_LEVEL.has(labels.slice(-2).join('.'));
}

function isHost(name: string, before: string, after: string): boolean {
  const labels = name.toLowerCase().split('.');
  if (labels.some((l) => l.startsWith('xn--'))) return true;
  if (hasLatinAndCyrillic(name)) return true;
  if (/[a-z][a-z0-9+.-]*:\/\/$/i.test(before) || before.endsWith('@')) return true;
  if (labels[0] === 'www' || /^:\d/.test(after) || after.startsWith('/')) return true;
  const tld = labels.at(-1) ?? '';
  if (HOST_TLDS.has(tld)) return true;
  return CODE_LIKE_TLDS.has(tld) && !looksLikeCode(labels, after);
}

/** Every IP address and domain in `text` that is not from a documentation range. */
export function findForeignAddresses(original: string): ForeignAddress[] {
  const { text, origin } = normalise(original);
  const at = (i: number) => origin[i] ?? original.length;
  const found: ForeignAddress[] = [];
  for (const match of text.matchAll(IPV4)) {
    const octets = match.slice(1, 5).map(Number);
    if (octets.some((n) => n > 255)) continue;
    const dotted = octets.join('.');
    if (DOC_IPV4.some((prefix) => dotted.startsWith(prefix))) continue;
    found.push({ value: match[0], kind: 'ip', index: at(match.index) });
  }
  for (const match of text.matchAll(IPV6_RUN)) {
    const before = text.charAt(match.index - 1);
    const after = text.charAt(match.index + match[0].length);
    if (/[\p{L}\p{N}_]/u.test(after) || before === '.') continue;
    const ip = ipv6In(match[0], /[\p{L}\p{N}_]/u.test(before));
    if (ip === null) continue;
    const groups = ipv6Groups(ip.value);
    if (groups?.[0] === 0x2001 && groups[1] === 0xdb8) continue;
    found.push({ value: ip.value, kind: 'ip', index: at(match.index + ip.offset) });
  }
  for (const match of text.matchAll(DOMAIN)) {
    const name = match[0];
    const labels = name.toLowerCase().split('.');
    if (isDocumentationName(labels)) continue;
    const before = text.slice(Math.max(0, match.index - 16), match.index);
    const after = text.slice(match.index + name.length, match.index + name.length + 2);
    if (!isHost(name, before, after)) continue;
    found.push({ value: name, kind: 'domain', index: at(match.index) });
  }
  return found.sort((a, b) => a.index - b.index);
}
