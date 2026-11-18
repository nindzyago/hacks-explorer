#!/usr/bin/env node
// Structure check, part of `npm run gate`.
//
// Rules (AGENTS.md, "Инварианты архитектуры" and L6):
//   layers            core < services < commands < adapters (ui, scene, control, time) < entry;
//                     a file may import its own layer or a lower one.
//   content-is-data   content/ holds Markdown and images only; nothing executable. Links inside
//                     lessons are checked by the lesson checker (src/core/lesson), not here.
//   no-external-urls  site code never points at another server. Test files (*.test.ts) are not
//                     site code: they never reach the reader and may quote links as data.
//   no-literal-colours  colours come from tokens (design M1.2 E3): in site code no hex colour,
//                     no rgb()/hsl()/oklch()/color(space …), no named colour as the value of a
//                     colour property, custom property or attribute (also a Svelte expression
//                     `fill={…}` or `style:x={…}`, a setAttribute/setProperty call, a canvas
//                     fillStyle), nor inside a gradient or drop-shadow(). .svg files count.
//                     Fragment links (`href="#add"`, `url(#cafe)`) and «Issue #123» in prose are
//                     not colours. The one exception is src/ui/tokens.css.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RANK = { core: 0, services: 1, commands: 2, adapters: 3, entry: 4 };
const DIR_LAYER = {
  core: 'core',
  services: 'services',
  commands: 'commands',
  ui: 'adapters',
  scene: 'adapters',
  control: 'adapters',
  time: 'adapters',
};
const CODE = /\.(ts|js|mjs|cjs|svelte)$/;
const CONTENT_DATA = /\.(md|jpg|jpeg|png|webp)$/;
const SITE = /\.(ts|js|svelte|css|html|svg)$/;
const TEST = /\.test\.(ts|js)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
const URL = /https?:\/\/[^\s'"`<>)]+/g;
const ALLOWED_URL = /^http:\/\/www\.w3\.org\//;
const TOKENS_FILE = 'src/ui/tokens.css';
// Not after `&` (an entity like &#123;) or a word character; 3, 4, 6 or 8 hex digits, then a
// word boundary, so ids like #feather or #ic-db are not colours.
const HEX_COLOUR = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
// What may stand right before a hex that is not a colour: a link to a fragment (`href="#add"`,
// `url(#cafe)`, `setAttribute('href', '#x')`, `.href = '#x'`).
const FRAGMENT_BEFORE =
  /(?:(?:href|xlink:href)\s*=\s*\{?\s*['"]?|url\(\s*['"]?|['"]href['"]\s*,\s*['"]|\.href\s*=\s*['"])$/i;
// A number in prose («Issue #123», «задача #456»): only digits, after a word of letters and a
// space. CSS words that come before a colour (`solid #123`) do not count as prose.
const PROSE_WORD = /(?<![\w-])(\p{L}+) $/u;
const CSS_WORDS = new Set(
  'solid dashed dotted double groove ridge inset outset none hidden and or to at in'.split(' '),
);
const COLOUR_FUNCTION =
  /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w.$-])color\(\s*(?:srgb(?:-linear)?|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz(?:-d50|-d65)?|from)\b/gi;
// Any name followed by `:` or `=` (CSS `prop: value`, markup `attr="value"`, Svelte
// `attr={…}` and `style:prop={…}`, a script `prop: 'value'` or `obj.prop = 'value'`). Whether
// the name is about colour is decided by COLOUR_NAME.
const NAME_VALUE = /(?<![\w-])(-{0,2}[a-z][\w-]*)\s*(?::(?!:)|=(?![=>]))\s*/gi;
const COLOUR_NAME =
  /^--|colou?r|fill|stroke|background|border|outline|shadow|column-rule|text-emphasis|text-decoration/i;
// Arguments of these functions are colours wherever they stand (`mask: linear-gradient(red…)`).
const COLOUR_ARGUMENTS =
  /(?<![\w-])(?:(?:repeating-)?(?:linear|radial|conic)-gradient|drop-shadow)\(/gi;
// Script calls that set a colour: setAttribute('fill', …), style.setProperty('--x', …).
const SET_CALL = /\b(setAttribute|setProperty)\(\s*(['"])([\w:-]+)\2\s*,/g;
// CSS named colours (CSS Color 4), without transparent and currentcolor, which are not literal.
const NAMED_COLOURS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
// A bare word: not a part of a longer name (`--red`, `palette.red`, `$red`), not a call.
const WORD = /(?<![\w.$-])[a-z]+(?:-[a-z]+)*(?![\w(-])/gi;
const QUOTED = /(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

/** @param {string} path repo-relative, forward slashes @returns {keyof typeof RANK | null} */
export function layerOf(path) {
  const parts = path.split('/');
  if (parts[0] !== 'src') return null;
  if (parts.length === 2) return 'entry';
  return DIR_LAYER[parts[1] ?? ''] ?? null;
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/**
 * @param {{ path: string, text: string }[]} files
 * @returns {{ rule: string, path: string, line: number, message: string }[]}
 */
export function checkFiles(files) {
  const problems = [];
  for (const file of files) {
    if (typeof file.path !== 'string' || typeof file.text !== 'string') {
      throw new TypeError('checkFiles expects { path: string, text: string }');
    }
    const { path, text } = file;

    if (path.startsWith('content/') && !CONTENT_DATA.test(path)) {
      problems.push({
        rule: 'content-is-data',
        path,
        line: 1,
        message: CODE.test(path)
          ? 'content/ holds data only (Markdown, images); move code to src/'
          : 'content/ holds Markdown (.md) and images (.jpg, .png, .webp) only',
      });
    }

    const from = layerOf(path);
    if (from !== null && CODE.test(path)) {
      for (const match of text.matchAll(IMPORT)) {
        const spec = match[2];
        if (spec === undefined || !spec.startsWith('.')) continue;
        const target = posix.normalize(posix.join(posix.dirname(path), spec));
        const to = layerOf(target);
        if (to === null || RANK[to] <= RANK[from]) continue;
        problems.push({
          rule: 'layers',
          path,
          line: lineAt(text, match.index),
          message: `${from} must not import ${to} (${spec})`,
        });
      }
    }

    if ((path === 'index.html' || path.startsWith('src/')) && SITE.test(path) && !TEST.test(path)) {
      for (const match of text.matchAll(URL)) {
        if (ALLOWED_URL.test(match[0])) continue;
        problems.push({
          rule: 'no-external-urls',
          path,
          line: lineAt(text, match.index),
          message: `site code must not reference another server: ${match[0]}`,
        });
      }
    }

    if (
      (path === 'index.html' || path.startsWith('src/')) &&
      SITE.test(path) &&
      !TEST.test(path) &&
      path !== TOKENS_FILE
    ) {
      for (const [index, what] of literalColours(text)) {
        problems.push({
          rule: 'no-literal-colours',
          path,
          line: lineAt(text, index),
          message: `a literal colour (${what}); use a token from ${TOKENS_FILE}`,
        });
      }
    }
  }
  return problems;
}

/** Literal colours in one file of site code, as `[index, what]` pairs in file order. */
function literalColours(text) {
  const found = [];
  for (const m of text.matchAll(HEX_COLOUR)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (FRAGMENT_BEFORE.test(before)) continue;
    const prose = PROSE_WORD.exec(before);
    if (/^#\d+$/.test(m[0]) && prose?.[1] && !CSS_WORDS.has(prose[1].toLowerCase())) continue;
    found.push([m.index, m[0]]);
  }
  for (const m of text.matchAll(COLOUR_FUNCTION)) found.push([m.index, `${m[0]}…)`]);
  const named = (index, value) => {
    for (const word of value.matchAll(WORD)) {
      if (NAMED_COLOURS.has(word[0].toLowerCase())) found.push([index, word[0]]);
    }
  };
  for (const m of text.matchAll(NAME_VALUE)) {
    if (!COLOUR_NAME.test(m[1] ?? '')) continue;
    const start = m.index + m[0].length;
    const first = text[start];
    if (first === '{') {
      // A Svelte expression: only its string literals can be literal colours.
      for (const q of enclosed(text, start, '{', '}').matchAll(QUOTED)) named(m.index, q[2] ?? '');
    } else if (first === "'" || first === '"' || first === '`') {
      const end = text.indexOf(first, start + 1);
      named(m.index, text.slice(start + 1, end === -1 ? undefined : end));
    } else {
      named(m.index, /^[^;\n}>]*/.exec(text.slice(start))?.[0] ?? '');
    }
  }
  for (const m of text.matchAll(COLOUR_ARGUMENTS)) {
    named(m.index, enclosed(text, m.index + m[0].length - 1, '(', ')'));
  }
  for (const m of text.matchAll(SET_CALL)) {
    const attribute = m[3] ?? '';
    if (m[1] === 'setAttribute' ? !COLOUR_NAME.test(attribute) : false) continue;
    const args = enclosed(text, m.index + m[1].length, '(', ')');
    for (const q of args.slice(args.indexOf(',')).matchAll(QUOTED)) named(m.index, q[2] ?? '');
  }
  const seen = new Set();
  return found
    .filter(([index, what]) => {
      const key = `${String(index)} ${what}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a[0] - b[0]);
}

/** The text from `text[start]` (an `open` bracket) to its matching `close`, at most 2000 chars. */
function enclosed(text, start, open, close) {
  let depth = 0;
  const end = Math.min(text.length, start + 2000);
  for (let i = start; i < end; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }
  return text.slice(start + 1, end);
}

function walk(root, dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const paths = ['index.html'];
  for (const dir of ['src', 'content']) {
    try {
      walk(root, join(root, dir), paths);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const files = [];
  for (const path of paths) {
    if (path.startsWith('content/')) {
      // Only the name matters here; the lesson checker reads the text.
      files.push({ path, text: '' });
      continue;
    }
    if (!CODE.test(path) && !SITE.test(path)) continue;
    try {
      files.push({ path, text: readFileSync(join(root, path), 'utf8') });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const problems = checkFiles(files);
  for (const p of problems) console.error(`${p.path}:${p.line}  ${p.rule}  ${p.message}`);
  if (problems.length > 0) {
    console.error(`structure-check: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(`structure-check: ${files.length} file(s), no problems`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
