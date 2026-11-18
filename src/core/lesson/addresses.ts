/**
 * L4.2: lessons use only documentation addresses — IPv4 192.0.2.0/24, 198.51.100.0/24,
 * 203.0.113.0/24 (RFC 5737), IPv6 2001:db8::/32 (RFC 3849), names under .example, .test,
 * .invalid, .localhost and example.com/.net/.org (RFC 2606).
 *
 * A heuristic over plain text: a domain is a dotted name whose last label is a real top-level
 * domain from the list below. Names with an unknown ending (`Node.js`, `index.html`) are not
 * taken for domains; two-letter country endings are (`users.id`, `ru.md` count as domains).
 */

export interface ForeignAddress {
  readonly value: string;
  readonly kind: 'ip' | 'domain';
  /** UTF-16 index in the scanned text. */
  readonly index: number;
}

const IPV4 = /(?<![\p{N}.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\p{N}|\.\p{N})/gu;
const IPV6 = /(?<![\p{L}\p{N}_:.])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![\p{L}\p{N}_:])/gu;
const DOMAIN =
  /(?<![\p{L}\p{N}\p{M}_.-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}-]{0,61}[\p{L}\p{N}\p{M}])?\.)+\p{L}[\p{L}\p{M}]{1,62}(?![\p{L}\p{N}\p{M}_-]|\.[\p{L}\p{N}])/gu;

const DOC_IPV4 = ['192.0.2.', '198.51.100.', '203.0.113.'];
const DOC_TLDS = new Set(['example', 'test', 'invalid', 'localhost']);
const DOC_SECOND_LEVEL = new Set(['example.com', 'example.net', 'example.org']);

// Assigned country-code endings (ISO 3166 based) and the common generic ones.
const CC =
  'ac ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo bq br ' +
  'bs bt bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ' +
  'ee eg er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy ' +
  'hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz ' +
  'la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx ' +
  'my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ' +
  'ro rs ru rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st su sv sx sy sz tc td tf tg th tj ' +
  'tk tl tm tn to tr tt tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw';
const GENERIC =
  'com net org info biz edu gov mil int arpa app dev xyz online site website tech store shop ' +
  'cloud top club blog news live pro name mobi asia tel travel jobs museum aero coop page link ' +
  'click space fun icu vip art wiki email digital network systems solutions company agency ' +
  'studio design media group world today life global center support zone ltd inc win bid loan ' +
  'work science party review trade date stream download men moscow tokyo london berlin ' +
  'google amazon apple microsoft yandex bank insurance finance money pay security ' +
  'рф рус москва дети онлайн сайт орг ком укр бел срб қаз';
const TLDS = new Set([...CC.split(' '), ...GENERIC.split(' ')]);

function isDocumentationIpv4(octets: readonly number[]): boolean {
  const text = octets.join('.');
  return DOC_IPV4.some((prefix) => text.startsWith(prefix));
}

/** Parses an IPv6 address into 8 groups, or null when it is not one. */
function ipv6Groups(text: string): number[] | null {
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const part = (s: string) => (s === '' ? [] : s.split(':'));
  const head = part(halves[0] ?? '');
  const tail = halves.length === 2 ? part(halves[1] ?? '') : [];
  const all = [...head, ...tail];
  if (!all.every((g) => /^[0-9A-Fa-f]{1,4}$/.test(g))) return null;
  if (halves.length === 1 && all.length !== 8) return null;
  if (halves.length === 2 && all.length > 7) return null;
  if (all.length === 0) return null;
  const zeros = new Array<number>(8 - all.length).fill(0);
  return [...head, ...zeros, ...tail].map((g) => (typeof g === 'number' ? g : parseInt(g, 16)));
}

function isDocumentationDomain(name: string): boolean {
  const labels = name.toLowerCase().split('.');
  const tld = labels.at(-1) ?? '';
  if (DOC_TLDS.has(tld)) return true;
  return DOC_SECOND_LEVEL.has(labels.slice(-2).join('.'));
}

/** Every IP address and domain in `text` that is not from a documentation range. */
export function findForeignAddresses(text: string): ForeignAddress[] {
  const found: ForeignAddress[] = [];
  for (const match of text.matchAll(IPV4)) {
    const octets = match.slice(1, 5).map(Number);
    if (octets.some((n) => n > 255)) continue;
    if (!isDocumentationIpv4(octets))
      found.push({ value: match[0], kind: 'ip', index: match.index });
  }
  for (const match of text.matchAll(IPV6)) {
    const groups = ipv6Groups(match[0]);
    if (groups === null) continue;
    if (groups[0] === 0x2001 && groups[1] === 0xdb8) continue;
    found.push({ value: match[0], kind: 'ip', index: match.index });
  }
  for (const match of text.matchAll(DOMAIN)) {
    const tld = match[0].slice(match[0].lastIndexOf('.') + 1).toLowerCase();
    if (!TLDS.has(tld) && !DOC_TLDS.has(tld)) continue;
    if (!isDocumentationDomain(match[0])) {
      found.push({ value: match[0], kind: 'domain', index: match.index });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}
