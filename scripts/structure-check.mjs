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
//                     OPEN1: src/core/project.ts may name exactly two addresses, the public
//                     repository and Protocol Explorer, which the site shows as plain links.
//   no-literal-colours  colours come from tokens (design M1.2 E3): in site code no hex colour,
//                     no rgb()/hsl()/oklch()/color(space …), no named colour as the value of a
//                     colour property, custom property or attribute (also a Svelte expression
//                     `fill={…}` or `style:x={…}`, a setAttribute/setProperty call, a canvas
//                     fillStyle), nor inside a gradient or drop-shadow(). .svg files count.
//                     Fragment links (`href="#add"`, `url(#cafe)`) and «Issue #123» in prose are
//                     not colours. The one exception is src/ui/tokens.css.
//                     M1.2c: in CSS (a .css file, a <style> block, a style="" attribute) every
//                     hex is a colour, whatever word stands before it, hex-like id selectors
//                     (`#cafe {`) included; in a script every hex in code is; in markup prose a
//                     number after a word («Issue #123») is not. Comments never count. Also
//                     `el.style['color'] = …` (M1.2d: and `` style[`color`] ``) and a 0x number
//                     as the value of a colour property.
//                     Not seen: a colour built at run time (`'#' + hex`, a variable).
//   no-css-animation  time comes from the player clock (design M1.2 E4, gap G14): no CSS
//                     `animation*`, `transition*`, `@keyframes`, view transitions or
//                     `scroll-behavior: smooth` (a value of `none` is a reset and allowed), no
//                     SMIL `<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`, no
//                     Svelte `transition:`, `in:`, `out:`, `animate:` or `style:transition`
//                     directives, no `style.transition`/`style.animation…` from a script. The
//                     Web Animations API and svelte/transition are the ESLint timing rules'.
//                     M1.2d (K63): also -o-/-ms- prefixes; SMIL tags in any case (a PascalCase
//                     tag in a .svelte file is a component); any backslash escape in a CSS
//                     property name. In script code and Svelte `{…}` expressions the rule goes
//                     by content: any string or template literal (multi-line too, \u and \x
//                     escapes decoded) holding an animating declaration, @keyframes, a view
//                     transition or a SMIL tag; any string that is exactly an animating property
//                     name (`'transition'`, `'animationDuration'`); any member write to
//                     `.transition…`/`.animation…` (=, +=, ||=…); Object.assign(el.style, {
//                     transition }); a SMIL element in createElement(NS) or <svelte:element
//                     this>. A key `transition` in a plain object is data. Not seen: CSS built
//                     at run time by joining pieces of a name (`'trans' + 'ition'`).
//   ui-strings        M2.3 (K105): words a reader sees live in content/locales/<lang>/ui.md, not
//                     in code. Site code under src/ has no Cyrillic letter outside comments (a
//                     string, a template, markup text, an attribute). Tests are not site code.
//                     The language tables of the content checker are exempt (UI_STRINGS_EXEMPT,
//                     each with its reason). In index.html only the content of the description
//                     meta may be Cyrillic: the Russian default of `app.description` (K109),
//                     which the page replaces at run time. Not seen: words of a Latin-script
//                     language, and
//                     letters written as \u escapes (the keyboard's \u0432 for the D key).
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
/**
 * OPEN1: the two outside links the site names (the public repository and the idea of the genre),
 * plain `<a href>` a reader follows, never a request (L6). Exactly these strings, in this one file.
 */
const LINKS_FILE = 'src/core/project.ts';
const ALLOWED_LINKS = new Set([
  'https://github.com/nindzyago/hacks-explorer',
  'https://protocol-explorer-alpha.vercel.app/',
]);
const TOKENS_FILE = 'src/ui/tokens.css';
const CYRILLIC = /\p{Script=Cyrillic}/u;
/** Files of src/ that may hold Cyrillic letters in code, and why. */
export const UI_STRINGS_EXEMPT = new Map([
  ['src/core/lesson/headings.ts', 'the section headings of a lesson file in each language (K24)'],
  ['src/core/glossary/words.ts', 'the headings of a glossary file in each language (K98)'],
  ['src/core/lesson/addresses.ts', 'Cyrillic top-level domains (.рф) for the address rule'],
  ['src/core/scene-layout/layout.ts', 'glyph widths of the scene font'],
  ['src/core/glossary/match.ts', 'ё is matched as е (K99)'],
  ['src/core/lesson/parse.ts', 'examples in messages to lesson authors (the gate, not readers)'],
  [
    'src/core/glossary/check.ts',
    'examples in messages to glossary authors (the gate, not readers)',
  ],
]);
// Not after `&` (an entity like &#123;) or a word character; 3, 4, 6 or 8 hex digits, then a
// word boundary, so ids like #feather or #ic-db are not colours.
const HEX_COLOUR = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
// What may stand right before a hex that is not a colour: a link to a fragment (`href="#add"`,
// `url(#cafe)`, `setAttribute('href', '#x')`, `.href = '#x'`).
const FRAGMENT_BEFORE =
  /(?:(?:href|xlink:href)\s*=\s*\{?\s*['"]?|url\(\s*['"]?|['"]href['"]\s*,\s*['"]|\.href\s*=\s*['"])$/i;
// A number in markup prose («Issue #123», «задача #456»): only digits, after a word of letters
// and a space. In CSS and scripts a word before a hex does not make it a number (M1.2c).
const PROSE_WORD = /(?<![\w-])\p{L}+ $/u;
// A 0x number as the value of a colour property (`fill: 0xff0000`).
const HEX_NUMBER = /(?<![\w.])0x[0-9a-f]{3,8}\b/gi;
// `el.style['color'] = …`: the property is a string.
const STYLE_INDEX = /\bstyle\s*\[\s*(['"`])([\w-]+)\1\s*\]\s*=(?!=)\s*/g;
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

/** index.html with the value of its description meta blanked, keeping every line (K109). */
function withoutDescription(html) {
  return html.replace(
    /(<meta\s+name=(["'])description\2\s+content=)(["'])([^"']*)\3/i,
    (_m, head, _q, quote, value) => `${head}${quote}${value.replace(/[^\n]/g, ' ')}${quote}`,
  );
}

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
        if (path === LINKS_FILE && ALLOWED_LINKS.has(match[0])) continue;
        problems.push({
          rule: 'no-external-urls',
          path,
          line: lineAt(text, match.index),
          message: `site code must not reference another server: ${match[0]}`,
        });
      }
    }

    const site = (path === 'index.html' || path.startsWith('src/')) && SITE.test(path);
    if (site && !TEST.test(path)) {
      for (const [index, what] of animations(path, text)) {
        problems.push({
          rule: 'no-css-animation',
          path,
          line: lineAt(text, index),
          message: `${what}: time comes from the player clock (design M1.2 E4), not from CSS`,
        });
      }
    }

    const words =
      path === 'index.html' || (path.startsWith('src/') && !UI_STRINGS_EXEMPT.has(path));
    if (site && !TEST.test(path) && words) {
      const { text: blanked } = parts(path, text);
      const code = path === 'index.html' ? withoutDescription(blanked) : blanked;
      const seen = new Set();
      for (const [index, line] of code.split('\n').entries()) {
        const at = CYRILLIC.exec(line);
        if (at === null || seen.has(index)) continue;
        seen.add(index);
        const word = /[\p{L}\p{M}-]+/u.exec(line.slice(at.index))?.[0] ?? at[0];
        problems.push({
          rule: 'ui-strings',
          path,
          line: index + 1,
          message: `"${word}" in code: words a reader sees go to content/locales/ru/ui.md and are read with t(key) (M2.3)`,
        });
      }
    }

    if (site && !TEST.test(path) && path !== TOKENS_FILE) {
      for (const [index, what] of literalColours(path, text)) {
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

/**
 * The parts of a file of site code (M1.2c): `css` (a stylesheet, a <style> block, a style=""
 * attribute), `script` (a script file or a <script> block) and `markup` (the rest of an HTML,
 * SVG or Svelte file). `text` is the file with comments blanked out, keeping every index and
 * line: CSS and script block comments, script line comments (outside strings), HTML comments.
 * @returns {{ text: string, kindAt: (index: number) => 'css' | 'script' | 'markup' }}
 */
function parts(path, source) {
  const ext = /\.(\w+)$/.exec(path)?.[1] ?? '';
  /** @type {{ kind: 'css' | 'script', start: number, end: number }[]} */
  const spans = [];
  if (ext === 'css') spans.push({ kind: 'css', start: 0, end: source.length });
  else if (ext === 'ts' || ext === 'js') {
    spans.push({ kind: 'script', start: 0, end: source.length });
  } else {
    const lower = source.toLowerCase();
    for (const m of source.matchAll(/<(script|style)\b[^>]*>/gi)) {
      const name = (m[1] ?? '').toLowerCase();
      const start = m.index + m[0].length;
      const close = lower.indexOf(`</${name}`, start);
      spans.push({
        kind: name === 'style' ? 'css' : 'script',
        start,
        end: close === -1 ? source.length : close,
      });
    }
    for (const m of source.matchAll(/(?<=\s)style\s*=\s*(["'])([^"']*)\1/gi)) {
      const start = m.index + m[0].length - 1 - (m[2] ?? '').length;
      if (!spans.some((sp) => start >= sp.start && start < sp.end)) {
        spans.push({ kind: 'css', start, end: start + (m[2] ?? '').length });
      }
    }
  }
  const kindAt = (index) =>
    spans.find((sp) => index >= sp.start && index < sp.end)?.kind ?? 'markup';
  const out = source.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < source.length) {
    const kind = kindAt(i);
    const c = source[i];
    const two = source.slice(i, i + 2);
    if (kind === 'script' && (c === "'" || c === '"' || c === '`')) {
      let j = i + 1;
      while (j < source.length && source[j] !== c && !(c !== '`' && source[j] === '\n')) {
        j += source[j] === '\\' ? 2 : 1;
      }
      i = j + 1;
      continue;
    }
    let stop = -1;
    if (kind !== 'markup' && two === '/*') {
      const end = source.indexOf('*/', i + 2);
      stop = end === -1 ? source.length : end + 2;
    } else if (kind === 'script' && two === '//') {
      const end = source.indexOf('\n', i);
      stop = end === -1 ? source.length : end;
    } else if (kind === 'markup' && source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      stop = end === -1 ? source.length : end + 3;
    }
    if (stop === -1) i += 1;
    else {
      blank(i, stop);
      i = stop;
    }
  }
  return { text: out.join(''), kindAt };
}

/** Literal colours in one file of site code, as `[index, what]` pairs in file order. */
function literalColours(path, source) {
  const { text, kindAt } = parts(path, source);
  const found = [];
  for (const m of text.matchAll(HEX_COLOUR)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (FRAGMENT_BEFORE.test(before)) continue;
    // Only in markup prose is «word #123» a number rather than a colour.
    if (kindAt(m.index) === 'markup' && /^#\d+$/.test(m[0]) && PROSE_WORD.test(before)) continue;
    found.push([m.index, m[0]]);
  }
  for (const m of text.matchAll(COLOUR_FUNCTION)) found.push([m.index, `${m[0]}…)`]);
  const named = (index, value) => {
    for (const word of value.matchAll(WORD)) {
      if (NAMED_COLOURS.has(word[0].toLowerCase())) found.push([index, word[0]]);
    }
    for (const hex of value.matchAll(HEX_COLOUR)) found.push([index, hex[0]]);
    for (const hex of value.matchAll(HEX_NUMBER)) found.push([index, hex[0]]);
  };
  const valueAt = (index, start) => {
    const first = text[start];
    if (first === '{') {
      // A Svelte expression: only its string literals can be literal colours.
      for (const q of enclosed(text, start, '{', '}').matchAll(QUOTED)) named(index, q[2] ?? '');
      for (const hex of enclosed(text, start, '{', '}').matchAll(HEX_NUMBER)) {
        found.push([index, hex[0]]);
      }
    } else if (first === "'" || first === '"' || first === '`') {
      const end = text.indexOf(first, start + 1);
      named(index, text.slice(start + 1, end === -1 ? undefined : end));
    } else {
      named(index, /^[^;\n}>]*/.exec(text.slice(start))?.[0] ?? '');
    }
  };
  for (const m of text.matchAll(STYLE_INDEX)) {
    if (COLOUR_NAME.test(m[2] ?? '')) valueAt(m.index, m.index + m[0].length);
  }
  for (const m of text.matchAll(NAME_VALUE)) {
    if (COLOUR_NAME.test(m[1] ?? '')) valueAt(m.index, m.index + m[0].length);
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
      // One report per colour and line: a hex in a colour value is found twice.
      const key = `${String(lineAt(text, index))} ${what.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a[0] - b[0]);
}

// no-css-animation (M1.2c, design M1.2 E4, G14). A CSS property that animates: `animation…`,
// `transition…` (also -webkit-/-moz-), a view transition. Not after `.`, `#` or a word
// character: `.transition:hover` is a selector.
// M1.2d: the -o- and -ms- prefixes too.
const PREFIX = '(?:-webkit-|-moz-|-o-|-ms-)?';
const CSS_ANIMATED = new RegExp(
  `(?<![\\w.#-])(${PREFIX}(?:animation|transition)(?:-[a-z-]+)?|view-transition(?:-[a-z]+)?)\\s*:(?!:)\\s*([^;}]*)`,
  'gi',
);
const CSS_AT = new RegExp(
  `@${PREFIX}keyframes\\b|@view-transition\\b|(?<![\\w-])scroll-behavior\\s*:\\s*smooth\\b`,
  'gi',
);
// M1.2d: a backslash escape in a CSS property name (`tr\61nsition`) is always an error: a
// declaration starts after `{`, `;` or the quote of a style attribute.
const CSS_ESCAPED_NAME = /(?<=[{;"']\s*)(-?(?:[a-z_-]|\\[^\n])(?:[\w-]|\\[^\n])*)\s*:(?!:)/gi;
const SMIL_NAMES = '(?:animate|animateTransform|animateMotion|animateColor|set)';
const SMIL = new RegExp(`^<(${SMIL_NAMES})(?=[\\s/>])`, 'i');
// A SMIL tag written inside a script string (M1.2d).
const SMIL_IN_STRING = new RegExp(`<\\s*(${SMIL_NAMES})(?=[\\s/>])`, 'gi');
const SMIL_CREATE = new RegExp(
  `\\bcreateElement(?:NS)?\\(\\s*(?:[^,()]+,\\s*)?(['"\`])(${SMIL_NAMES})\\1`,
  'gi',
);
const DIRECTIVE = new RegExp(
  `(?<=\\s)(?:(?:transition|in|out|animate):[A-Za-z_$]|style:${PREFIX}(?:animation|transition)\\b)`,
  'g',
);
// M1.2d, by content: a string that is exactly an animating property name, kebab or camel case
// (`'transition'`, `'animation-duration'`, `'webkitTransition'`, `'viewTransitionName'`).
// `'transitions'`, `'animationend'` and prose are other words.
const ANIMATED_NAME = new RegExp(
  `^(?:${PREFIX}(?:animation|transition)(?:-[a-z-]+)?|view-transition(?:-[a-z]+)?|` +
    '(?:(?:webkit|moz|ms|o|Webkit|Moz|Ms|O)(?:Animation|Transition)|animation|transition|viewTransition)(?:[A-Z]\\w*)?)$',
);
// A member write to an animating property, of any object: `.transition = …`, `+=`, `||=`.
const ANIMATED_MEMBER =
  /\.\s*(?:(?:webkit|moz|ms|o|Webkit|Moz|Ms|O)(?:Animation|Transition)|animation|transition)\w*\s*(?:\+|-|\|\||&&|\?\?)?=(?!=)/g;
// Object.assign(el.style, { transition }) (M1.2d): the keys of the object are properties.
const ASSIGN_STYLE = /\bObject\.assign\(\s*[\w$.]*\bstyle\s*,/g;
const STYLE_KEY =
  /(?<=[{,]\s*)(['"`]?)((?:webkit|moz|ms|o)?-?(?:animation|transition)[\w-]*)\1\s*(?=[:,}])/gi;

/** Svelte component names are PascalCase (`<Set />`): not SMIL in a .svelte file (M1.2d). */
const isComponent = (path, name) => path.endsWith('.svelte') && /^[A-Z](?=.*[a-z])/.test(name);

/** CSS animations in a piece of CSS text (`transition: none` is a reset and allowed). */
function cssAnimated(css) {
  const out = [];
  for (const m of css.matchAll(CSS_ANIMATED)) {
    if (/^none(\s*!important)?$/i.test((m[2] ?? '').trim())) continue;
    out.push(m[1] ?? 'animation');
  }
  return out;
}

/**
 * The string and template literals of `text` where `inScript(index)`, as `[index, body]`:
 * a template may span lines; `\uXXXX`, `\u{…}` and `\xXX` escapes are decoded, so
 * `'transition: 1s'` reads as what it is (M1.2d).
 */
function literals(text, inScript) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if ((c === "'" || c === '"' || c === '`') && inScript(i)) {
      let j = i + 1;
      while (j < text.length && text[j] !== c && !(c !== '`' && text[j] === '\n')) {
        j += text[j] === '\\' ? 2 : 1;
      }
      const body = text
        .slice(i + 1, j)
        .replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (_m, a, b, d) =>
          String.fromCodePoint(Number.parseInt(a ?? b ?? d, 16)),
        );
      out.push([i, body]);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

/** How deep in `{…}` index `k` of a tag is, past quoted attribute values. */
function depthAt(tag, k) {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < k; i += 1) {
    const c = tag[i];
    if (depth === 0 && quote !== '') {
      if (c === quote) quote = '';
    } else if (depth === 0 && (c === '"' || c === "'")) quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') depth = Math.max(0, depth - 1);
  }
  return depth;
}

/** What in a script literal makes it CSS that animates, or SMIL; null when nothing does. */
function animatedLiteral(body) {
  const css = cssAnimated(body);
  if (css.length > 0) return css[0] ?? 'animation';
  const at = new RegExp(CSS_AT.source, 'i').exec(body);
  if (at !== null) return at[0];
  const smil = SMIL_IN_STRING.exec(body);
  SMIL_IN_STRING.lastIndex = 0;
  if (smil !== null) return `<${smil[1] ?? ''}> in a string`;
  if (ANIMATED_NAME.test(body.trim())) return `'${body.trim()}'`;
  return null;
}

/** Animations in one file of site code, as `[index, what]` pairs in file order. */
function animations(path, source) {
  const { text, kindAt } = parts(path, source);
  const found = [];
  for (const m of text.matchAll(CSS_ANIMATED)) {
    if (kindAt(m.index) !== 'css') continue;
    if (/^none(\s*!important)?$/i.test((m[2] ?? '').trim())) continue;
    found.push([m.index, m[1] ?? 'animation']);
  }
  for (const m of text.matchAll(CSS_AT)) {
    if (kindAt(m.index) === 'css') found.push([m.index, m[0]]);
  }
  for (const m of text.matchAll(CSS_ESCAPED_NAME)) {
    if (kindAt(m.index) === 'css' && (m[1] ?? '').includes('\\')) {
      found.push([m.index, `an escaped property name ${m[1] ?? ''}`]);
    }
  }
  for (const [start, tag] of tags(text, kindAt)) {
    const smil = SMIL.exec(tag);
    if (smil !== null && !isComponent(path, smil[1] ?? '')) {
      found.push([start, `<${smil[1] ?? ''}>`]);
    }
    for (const d of tag.matchAll(DIRECTIVE)) found.push([start + d.index, d[0]]);
    // Svelte expressions in a tag (`style={…}`, any `{…}`): their literals are script.
    for (const [index, body] of literals(tag, (k) => depthAt(tag, k) > 0)) {
      const what = animatedLiteral(body);
      if (what !== null) found.push([start + index, what]);
    }
    // <svelte:element this="animate"> or this={"animate"} (M1.2d).
    if (/^<svelte:element\b/.test(tag)) {
      const name = /\sthis\s*=\s*(?:\{\s*)?(['"`])([^'"`]*)\1/.exec(tag)?.[2] ?? '';
      if (new RegExp(`^${SMIL_NAMES}$`, 'i').test(name)) found.push([start, `<${name}>`]);
    }
  }
  // Script code (M1.2d, by content): literals, member writes, Object.assign onto a style,
  // SMIL elements made by name.
  for (const [index, body] of literals(text, (k) => kindAt(k) === 'script')) {
    const what = animatedLiteral(body);
    if (what !== null) found.push([index, what]);
  }
  for (const m of text.matchAll(ANIMATED_MEMBER)) {
    if (kindAt(m.index) === 'script') found.push([m.index, m[0]]);
  }
  for (const m of text.matchAll(ASSIGN_STYLE)) {
    if (kindAt(m.index) !== 'script') continue;
    const args = enclosed(text, m.index + m[0].indexOf('('), '(', ')');
    for (const key of args.matchAll(STYLE_KEY)) found.push([m.index, `style ${key[2] ?? ''}`]);
  }
  for (const m of text.matchAll(SMIL_CREATE)) {
    if (kindAt(m.index) === 'script') found.push([m.index, `<${m[2] ?? ''}>`]);
  }
  const seen = new Set();
  return found
    .sort((a, b) => a[0] - b[0])
    .filter(([index]) => {
      // One report per line.
      const line = lineAt(text, index);
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });
}

/**
 * The opening tags of the markup, as `[index, text]`: from `<name` to the `>` that ends the
 * tag, past quoted values and `{…}` expressions (`onclick={() => a > b}`).
 */
function tags(text, kindAt) {
  const out = [];
  for (const m of text.matchAll(/<[A-Za-z]/g)) {
    if (kindAt(m.index) !== 'markup') continue;
    let depth = 0;
    let quote = '';
    let i = m.index + 1;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (quote !== '') {
        if (c === quote) quote = '';
      } else if (c === '{') depth += 1;
      else if (c === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (c === '"' || c === "'")) quote = c;
      else if (depth === 0 && c === '>') break;
    }
    out.push([m.index, text.slice(m.index, i + 1)]);
  }
  return out;
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
