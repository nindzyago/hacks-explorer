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
//                     no rgb()/hsl()/oklch()…, no named colour as the value of a colour property
//                     or SVG attribute. The one exception is src/ui/tokens.css.
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
const SITE = /\.(ts|js|svelte|css|html)$/;
const TEST = /\.test\.(ts|js)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
const URL = /https?:\/\/[^\s'"`<>)]+/g;
const ALLOWED_URL = /^http:\/\/www\.w3\.org\//;
const TOKENS_FILE = 'src/ui/tokens.css';
// Not after `&` (an entity like &#123;) or a word character; 3, 4, 6 or 8 hex digits, then a
// word boundary, so ids like #feather or #ic-db are not colours.
const HEX_COLOUR = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const COLOUR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
// A colour property or attribute and the value after it (CSS `prop: value`, markup
// `attr="value"`, a script object `prop: 'value'`).
const COLOUR_PROPERTY =
  /(?<![\w-])(?:fill|stroke|color|stop-color|flood-color|lighting-color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline))?(?:-color)?|outline(?:-color)?|text-decoration(?:-color)?|caret-color|accent-color|column-rule(?:-color)?|box-shadow|text-shadow)\s*[:=]\s*['"{]?([^;'"}\n]*)/gi;
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
const WORD = /[a-z]+(?:-[a-z]+)*/gi;

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
  for (const m of text.matchAll(HEX_COLOUR)) found.push([m.index, m[0]]);
  for (const m of text.matchAll(COLOUR_FUNCTION)) found.push([m.index, `${m[0]}…)`]);
  for (const m of text.matchAll(COLOUR_PROPERTY)) {
    for (const word of (m[1] ?? '').matchAll(WORD)) {
      if (NAMED_COLOURS.has(word[0].toLowerCase())) found.push([m.index, word[0]]);
    }
  }
  return found.sort((a, b) => a[0] - b[0]);
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
