// Acceptance for M0.1: the structure check, which is part of `npm run gate`,
// rejects layer violations and external requests, and never crashes on odd input.
import { describe, expect, it } from 'vitest';
import { checkFiles, layerOf } from './structure-check.mjs';

const file = (path, text) => ({ path, text });

describe('layerOf', () => {
  it('maps a path to its layer', () => {
    expect(layerOf('src/core/player/machine.ts')).toBe('core');
    expect(layerOf('src/services/i18n/index.ts')).toBe('services');
    expect(layerOf('src/commands/registry.ts')).toBe('commands');
    expect(layerOf('src/ui/App.svelte')).toBe('adapters');
    expect(layerOf('src/scene/Stage.svelte')).toBe('adapters');
    expect(layerOf('src/control/app.ts')).toBe('adapters');
    expect(layerOf('src/time/real-time-driver.ts')).toBe('adapters');
    expect(layerOf('src/main.ts')).toBe('entry');
    expect(layerOf('README.md')).toBe(null);
  });
});

describe('checkFiles', () => {
  it('accepts imports that go down the layers', () => {
    const problems = checkFiles([
      file('src/core/a.ts', "import { b } from './b';"),
      file('src/services/s.ts', "import { a } from '../core/a';"),
      file(
        'src/commands/c.ts',
        "import { s } from '../services/s';\nimport { a } from '../core/a';",
      ),
      file('src/ui/App.svelte', '<script lang="ts">import { c } from \'../commands/c\';</script>'),
      file('src/main.ts', "import App from './ui/App.svelte';"),
    ]);
    expect(problems).toEqual([]);
  });

  it('rejects core importing the interface', () => {
    const problems = checkFiles([file('src/core/a.ts', "import App from '../ui/App.svelte';")]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ rule: 'layers', path: 'src/core/a.ts', line: 1 });
  });

  it('rejects services importing commands, also through a dynamic import', () => {
    const problems = checkFiles([
      file('src/services/s.ts', "const c = await import('../commands/c');"),
    ]);
    expect(problems.map((p) => p.rule)).toEqual(['layers']);
  });

  it('rejects code inside content', () => {
    const problems = checkFiles([file('content/lessons/sql/lesson.ts', 'export default {};')]);
    expect(problems).toEqual([
      expect.objectContaining({ rule: 'content-is-data', path: 'content/lessons/sql/lesson.ts' }),
    ]);
  });

  it('accepts Markdown lessons with source links and images in content (M1.1a)', () => {
    const lesson =
      '## Источники\n\n- [CWE-89](https://cwe.mitre.org/data/definitions/89.html)\n\n' +
      'Текст со ссылкой [OWASP](https://owasp.org) — дело проверки уроков, не этой.';
    const problems = checkFiles([
      file('content/lessons/B1/ru.md', lesson),
      file('content/sources.md', '- `owasp.org` OWASP'),
      file('content/icons/server.jpg', ''),
      file('content/icons/db.png', ''),
      file('content/icons/user.webp', ''),
    ]);
    expect(problems).toEqual([]);
  });

  it.each([
    'content/lessons/B1/lesson.yaml',
    'content/lessons/B1/page.html',
    'content/icons/x.svg',
    'content/run.sh',
    'content/lessons/B1/ru.md.js',
  ])('rejects %s in content: Markdown and images only', (path) => {
    expect(checkFiles([file(path, '')])).toEqual([
      expect.objectContaining({ rule: 'content-is-data', path }),
    ]);
  });

  it('rejects requests to other servers in site code (L6)', () => {
    const problems = checkFiles([
      file('index.html', '<link href="https://fonts.example.com/a.css" rel="stylesheet">'),
      file('src/ui/App.svelte', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    ]);
    expect(problems).toEqual([
      expect.objectContaining({ rule: 'no-external-urls', path: 'index.html', line: 1 }),
    ]);
  });

  it('lets test files quote links as data, but not the code next to them', () => {
    const problems = checkFiles([
      file('src/core/lesson/lesson.test.ts', "const url = 'https://owasp.org';"),
      file('src/core/lesson/parse.ts', "const url = 'https://owasp.org';"),
    ]);
    expect(problems).toEqual([
      expect.objectContaining({ rule: 'no-external-urls', path: 'src/core/lesson/parse.ts' }),
    ]);
  });

  it('reports the line of the problem', () => {
    const problems = checkFiles([
      file('src/core/a.ts', "const x = 1;\n\nimport { s } from '../services/s';"),
    ]);
    expect(problems[0]?.line).toBe(3);
  });

  it('does not crash on empty, huge or malformed input', () => {
    expect(checkFiles([])).toEqual([]);
    expect(checkFiles([file('src/core/a.ts', '')])).toEqual([]);
    expect(checkFiles([file('src/core/a.ts', "import from from 'from' import(")])).toEqual([]);
    expect(checkFiles([file('src/core/big.ts', 'x'.repeat(2_000_000))])).toEqual([]);
    expect(() => checkFiles([{ path: 42, text: null }])).toThrow(TypeError);
  });
});

// M1.2a (design M1.2 E3): colours come from tokens only. The one file with literal colours is
// src/ui/tokens.css; anywhere else in src/ a hex, rgb()/hsl() or a named colour is a problem.
describe('no-literal-colours', () => {
  const rules = (files) => checkFiles(files).map((p) => `${p.rule} ${p.path}:${String(p.line)}`);

  it('lets tokens.css hold colours and the rest use them', () => {
    expect(
      rules([
        file('src/ui/tokens.css', ':root {\n  --ink: #15212c;\n  --x: rgb(1 2 3);\n}'),
        file(
          'src/ui/App.svelte',
          '<style>\n  p { color: var(--ink); border: 1px solid var(--line); }\n</style>',
        ),
        file('src/scene/Scene.svelte', '<rect class="zone" fill="none" stroke="currentColor" />'),
        file('src/main.ts', "document.getElementById('app');\nconst t = 'transparent';"),
      ]),
    ).toEqual([]);
  });

  it.each([
    ['a hex colour in CSS', 'src/ui/App.svelte', '<style>\n  p { color: #15212c; }\n</style>', 2],
    ['a short hex colour', 'src/ui/a.css', 'p {\n  background: #fff;\n}', 2],
    ['a hex colour in an SVG attribute', 'src/scene/S.svelte', '<rect fill="#EDF0F3" />', 1],
    ['a hex colour with alpha in TS', 'src/scene/colours.ts', "export const c = '#1f2a4480';", 1],
    ['rgb()', 'src/ui/a.css', 'p { color: rgb(21 33 44); }', 1],
    ['rgba()', 'src/ui/a.css', 'p { box-shadow: 0 0 2px rgba(0, 0, 0, 0.3); }', 1],
    ['hsl()', 'src/scene/S.svelte', '<rect fill="hsl(10 50% 50%)" />', 1],
    ['oklch()', 'src/ui/a.css', 'p { color: oklch(0.5 0.1 30); }', 1],
    ['a named colour in CSS', 'src/ui/a.css', 'p {\n  color: red;\n}', 2],
    ['a named colour in a border', 'src/ui/a.css', 'p { border: 1px solid DarkSlateGray; }', 1],
    ['a named colour in an SVG attribute', 'src/scene/S.svelte', '<circle stroke="white" />', 1],
    ['a named colour in a style attribute', 'src/ui/A.svelte', '<p style="color:navy">x</p>', 1],
    ['a named colour in a TS object', 'src/scene/s.ts', "const a = { fill: 'tomato' };", 1],
    ['a colour in index.html', 'index.html', '<meta name="theme-color" content="#f3f5f7" />', 1],
  ])('rejects %s', (_name, path, text, line) => {
    expect(rules([file(path, text)])).toEqual([`no-literal-colours ${path}:${String(line)}`]);
  });

  it('does not take ids, entities, Svelte blocks or words for colours', () => {
    expect(
      rules([
        file(
          'src/ui/App.svelte',
          '{#if ok}<a href="#main">&#123;</a>{/if}\n{#each xs as x}{x}{/each}\n<use href="#ic-db" />',
        ),
        file('src/core/a.ts', "// the red team; a white list\nconst colour = 'blue-ish';"),
        file('src/scene/s.ts', "const fill = 'url(#feather)';\nconst label = 'Red: attack';"),
      ]),
    ).toEqual([]);
  });

  // M1.2b: the M1.2a verifier's holes in the gate, closed before the messages get colours.
  it.each([
    ['a Svelte expression attribute', 'src/scene/S.svelte', '<rect fill={"red"} />'],
    [
      'a colour picked in an expression',
      'src/scene/S.svelte',
      "<rect fill={x ? 'red' : 'blue'} />",
    ],
    ['a style directive', 'src/ui/A.svelte', '<p style:background-color={"navy"}>x</p>'],
    ['a custom property', 'src/ui/A.svelte', '<style>p { --x: red; }</style>'],
    ['a component custom property', 'src/ui/A.svelte', '<Scene --accent="tomato" />'],
    ['a gradient', 'src/ui/a.css', 'p { background-image: linear-gradient(red, var(--ink)); }'],
    [
      'a repeating gradient',
      'src/ui/a.css',
      'p { mask: repeating-radial-gradient(circle, white 0 2px, var(--x) 3px); }',
    ],
    ['a drop shadow', 'src/ui/a.css', 'p { filter: drop-shadow(0 1px 2px black); }'],
    ['color() with a colour space', 'src/ui/a.css', 'p { accent: color(display-p3 1 0 0); }'],
    ['a logical border colour', 'src/ui/a.css', 'p { border-inline-start-color: maroon; }'],
    ['a scrollbar colour', 'src/ui/a.css', 'p { scrollbar-color: gray white; }'],
    ['a text emphasis colour', 'src/ui/a.css', 'p { text-emphasis-color: olive; }'],
    ['a webkit text fill colour', 'src/ui/a.css', 'p { -webkit-text-fill-color: teal; }'],
    ['setAttribute with a colour', 'src/scene/s.ts', "el.setAttribute('fill', 'red');"],
    ['setAttribute with a hex colour', 'src/scene/s.ts', "el.setAttribute('stroke', '#abc');"],
    ['style.setProperty with a colour', 'src/ui/s.ts', "el.style.setProperty('--x', 'red');"],
    ['a canvas fill style', 'src/scene/s.ts', "ctx.fillStyle = 'red';"],
    ['a canvas stroke style', 'src/scene/s.ts', "ctx.strokeStyle = 'navy';"],
    ['an SVG file', 'src/scene/shield.svg', '<svg><path fill="#d8432b" d="M0 0" /></svg>'],
    ['a named colour in an SVG file', 'src/scene/shield.svg', '<svg><path stroke="black" /></svg>'],
  ])('rejects %s (M1.2b)', (_name, path, text) => {
    expect(new Set(rules([file(path, text)]))).toEqual(new Set([`no-literal-colours ${path}:1`]));
  });

  it('keeps currentColor, transparent, tokens and fragment links allowed (M1.2b)', () => {
    expect(
      rules([
        file(
          'src/scene/S.svelte',
          '<rect fill={on ? "currentColor" : "transparent"} stroke={kindColour} />',
        ),
        file(
          'src/ui/a.css',
          'p { --x: var(--ink); background-image: linear-gradient(var(--a), transparent); }',
        ),
        file(
          'src/ui/b.css',
          'p { filter: drop-shadow(0 1px 2px var(--scene-ink)); scrollbar-color: currentColor transparent; }',
        ),
        file(
          'src/scene/s.ts',
          "el.setAttribute('fill', 'var(--scene-ink)');\nctx.fillStyle = colour;",
        ),
        file('src/scene/t.ts', "use.setAttribute('href', '#bad');\nlink.href = '#add';"),
        file(
          'src/ui/C.svelte',
          '<a href="#add">x</a>\n<use href="#cafe" />\n<p>Issue #123, задача #456</p>',
        ),
        file(
          'src/scene/u.ts',
          "const clip = 'url(#face)';\nfunction color(x: number) { return x; }",
        ),
        file('src/ui/D.svelte', '<p>{red}</p>\n<rect fill={palette.red} stroke={colours.white} />'),
        file(
          'src/ui/E.svelte',
          '<style>\n  p { border: 1px solid var(--line); outline-color: currentcolor; }\n</style>',
        ),
      ]),
    ).toEqual([]);
  });

  it('lets test files hold colours as data', () => {
    expect(rules([file('src/ui/tokens.test.ts', "expect(x).toBe('#f3f5f7');")])).toEqual([]);
  });
});

// M1.2c (carry-over of the M1.2b verifier): what slipped past the colour rule. In CSS — a .css
// file, a <style> block, a style="" attribute — any hex colour is an error whatever word stands
// before it; comments do not count. Hex-like id selectors in CSS count too (decided: rename the
// id). In markup prose «Issue #123» stays allowed.
describe('no-literal-colours, M1.2c', () => {
  const rules = (files) => checkFiles(files).map((p) => `${p.rule} ${p.path}:${String(p.line)}`);

  it.each([
    ['a hex after a border style', 'src/ui/a.css', 'p { border: 1px solid #123; }'],
    ['a hex after a dashed style', 'src/ui/a.css', 'p { outline: 2px dashed #456; }'],
    ['a hex after a border width word', 'src/ui/a.css', 'p { border: thin #000000; }'],
    ['a hex after a decoration line', 'src/ui/a.css', 'p { text-decoration: underline #000000; }'],
    ['a hex after a background keyword', 'src/ui/a.css', 'p { background: fixed #111; }'],
    [
      'a hex after a word in a style block',
      'src/ui/A.svelte',
      '<style>p { outline: medium #808; }</style>',
    ],
    [
      'a hex after a word in a style attribute',
      'src/ui/A.svelte',
      '<p style="border: thin #000">x</p>',
    ],
    ['a hex-like id selector in CSS', 'src/ui/a.css', '#cafe { margin: 0; }'],
    ['a colour set through style[]', 'src/scene/s.ts', "el.style['color'] = 'red';"],
    ['a colour set through style[""]', 'src/scene/s.ts', 'el.style["background-color"] = "navy";'],
    ['a 0x colour in a colour property', 'src/scene/s.ts', 'const a = { fill: 0xff0000 };'],
    ['a 0x colour in a canvas style', 'src/scene/s.ts', 'ctx.fillStyle = 0xff0000;'],
    ['a hex in a script string after a word', 'src/scene/s.ts', "const b = 'thin #000000';"],
    ['a hex in an attribute value after a word', 'src/scene/S.svelte', '<rect fill="x #123" />'],
  ])('rejects %s', (_name, path, text) => {
    expect(new Set(rules([file(path, text)]))).toEqual(new Set([`no-literal-colours ${path}:1`]));
  });

  it('does not count comments, prose numbers or fragment links', () => {
    expect(
      rules([
        file('src/ui/a.css', '/* issue #123: was #fff, solid #000 */\np { color: var(--ink); }'),
        file('src/ui/b.css', 'p { clip-path: url(#cafe); mask: url("#bad"); }'),
        file('src/scene/s.ts', "// issue #123, once #fff\n/* #abc */ const a = 'b'; // #def"),
        file(
          'src/ui/A.svelte',
          '<!-- #fff -->\n<p>Issue #123, задача #456</p>\n<a href="#add">x</a>',
        ),
        file(
          'src/ui/B.svelte',
          '<script lang="ts">\n  // #fff\n  const s = "a//b" + `c//d`;\n</script>\n<p>{s}</p>',
        ),
        file('src/scene/t.ts', 'const n = 0xff;\nconst big = { width: 0xff0000 };'),
      ]),
    ).toEqual([]);
  });
});

// M1.2c, design M1.2 E4 (gap G14): time on the page comes from the player clock only, so CSS
// animations and transitions, keyframes, SMIL and Svelte transition directives are not allowed
// in site code. `none` (a reset) is.
describe('no-css-animation', () => {
  const rules = (files) =>
    checkFiles(files)
      .filter((p) => p.rule === 'no-css-animation')
      .map((p) => `${p.path}:${String(p.line)}`);

  it.each([
    ['a transition', 'src/ui/a.css', 'p {\n  transition: opacity 0.2s;\n}', 2],
    ['a transition longhand', 'src/ui/a.css', 'p { transition-duration: 1s; }', 1],
    ['a prefixed transition', 'src/ui/a.css', 'p { -webkit-transition: all 1s; }', 1],
    ['an animation', 'src/ui/a.css', 'p { animation: spin 1s infinite; }', 1],
    [
      'an animation longhand in a style block',
      'src/ui/A.svelte',
      '<style>\n.a { animation-name: x; }\n</style>',
      2,
    ],
    ['keyframes', 'src/ui/a.css', '@keyframes spin {\n  to { opacity: 0; }\n}', 1],
    ['prefixed keyframes', 'src/ui/a.css', '@-webkit-keyframes spin {}', 1],
    ['a view transition', 'src/ui/a.css', 'main { view-transition-name: page; }', 1],
    ['smooth scrolling', 'src/ui/a.css', 'html { scroll-behavior: smooth; }', 1],
    [
      'a transition in a style attribute',
      'src/ui/A.svelte',
      '<p style="transition: all 1s">x</p>',
      1,
    ],
    ['a style directive', 'src/ui/A.svelte', '<p style:transition="opacity 1s">x</p>', 1],
    ['SMIL animate', 'src/scene/S.svelte', '<rect><animate attributeName="x" to="5" /></rect>', 1],
    [
      'SMIL animateTransform',
      'src/scene/s.svg',
      '<svg><g><animateTransform type="rotate" /></g></svg>',
      1,
    ],
    ['SMIL animateMotion', 'src/scene/S.svelte', '<g>\n<animateMotion path="M0 0" />\n</g>', 2],
    ['SMIL set', 'src/scene/S.svelte', '<rect><set attributeName="x" to="5" /></rect>', 1],
    ['a Svelte transition', 'src/ui/A.svelte', '{#if a}<p transition:fade>x</p>{/if}', 1],
    ['a Svelte in', 'src/ui/A.svelte', '<p\n  in:fly={{ y: 10 }}>x</p>', 2],
    ['a Svelte out', 'src/ui/A.svelte', '<p class="x" out:fade>x</p>', 1],
    [
      'a Svelte animate',
      'src/ui/A.svelte',
      '{#each xs as x (x)}<li animate:flip>{x}</li>{/each}',
      1,
    ],
    [
      'a directive after an arrow',
      'src/ui/A.svelte',
      '<p onclick={() => go(a > b)} in:fade>x</p>',
      1,
    ],
    ['style.transition', 'src/ui/s.ts', "el.style.transition = 'opacity 1s';", 1],
    ['style.animationDuration', 'src/ui/s.ts', "el.style.animationDuration = '1s';", 1],
    ['style[transition]', 'src/ui/s.ts', "el.style['transition'] = 'x';", 1],
    ['setProperty(animation)', 'src/ui/s.ts', "el.style.setProperty('animation', 'x 1s');", 1],
  ])('rejects %s', (_name, path, text, line) => {
    expect(rules([file(path, text)])).toEqual([`${path}:${String(line)}`]);
  });

  it('keeps resets, prose, names and other attributes allowed', () => {
    expect(
      rules([
        file(
          'src/ui/a.css',
          '/* no transition: 1s */\n@media (prefers-reduced-motion: reduce) {\n' +
            '  * { animation: none !important; transition: none; }\n}',
        ),
        file('src/ui/b.css', '.transition:hover { color: var(--ink); }\n#animation { margin: 0; }'),
        file(
          'src/ui/A.svelte',
          '<p>The animation of a transition; log in: now</p>\n' +
            '<p data-transition="x" class="in">x</p>\n<Set />',
        ),
        file(
          'src/scene/s.ts',
          '// no animation here\nconst transition = 1;\nconst animate = { in: 2 };',
        ),
        file(
          'src/ui/B.svelte',
          '<script>\n  const transition = (a) => a;\n</script>\n<p>{transition(1)}</p>',
        ),
      ]),
    ).toEqual([]);
  });

  it('applies to site code only, not to tests', () => {
    expect(rules([file('src/ui/a.test.ts', "el.style.transition = 'x';")])).toEqual([]);
  });
});

// M1.2d (carry-over of the M1.2c verifier, K61): ways past no-css-animation. SMIL in script
// strings, tags in capitals, Svelte style={…} values, cssText, Object.assign(el.style, …),
// style[`…`], the -o- and -ms- prefixes and CSS escapes in a property name (decided: any
// backslash escape in a CSS property name is an error, K63).
describe('no-css-animation, M1.2d', () => {
  const rules = (files) =>
    checkFiles(files)
      .filter((p) => p.rule === 'no-css-animation')
      .map((p) => `${p.path}:${String(p.line)}`);

  it.each([
    [
      'SMIL in a script string',
      'src/scene/s.ts',
      'el.innerHTML = \'<animate attributeName="x" />\';',
    ],
    [
      'SMIL set in a template string',
      'src/scene/s.ts',
      'g.innerHTML = `<set attributeName="x"/>`;',
    ],
    [
      'SMIL in a Svelte script string',
      'src/scene/S.svelte',
      '<script>\n  const s = "<animateMotion path=\'M0 0\'/>";\n</script>',
      2,
    ],
    [
      'SMIL created by name',
      'src/scene/s.ts',
      "const a = document.createElementNS(SVG, 'animateTransform');",
    ],
    [
      'SMIL in capitals',
      'src/scene/s.svg',
      '<svg><rect><ANIMATE attributeName="x" /></rect></svg>',
    ],
    [
      'SMIL in capitals in Svelte',
      'src/scene/S.svelte',
      '<rect><ANIMATE attributeName="x" /></rect>',
    ],
    ['SMIL in a lower-case-first mix', 'src/scene/S.svelte', '<rect><aNiMaTe to="1" /></rect>'],
    ['a Svelte style string', 'src/ui/A.svelte', '<p style={"transition: opacity 1s"}>x</p>'],
    ['a Svelte style template', 'src/ui/A.svelte', '<p style={`animation: ${a} 1s`}>x</p>'],
    [
      'a Svelte style concatenation',
      'src/ui/A.svelte',
      "<p style={'color: x; ' + 'transition: 1s'}>x</p>",
    ],
    ['cssText', 'src/ui/s.ts', "el.style.cssText = 'transition: opacity 1s';"],
    ['cssText added to', 'src/ui/s.ts', 'el.style.cssText += `; animation: spin 1s`;'],
    [
      'a style attribute from a script',
      'src/ui/s.ts',
      "el.setAttribute('style', 'transition: 1s');",
    ],
    ['Object.assign with a shorthand', 'src/ui/s.ts', 'Object.assign(el.style, { transition });'],
    [
      'Object.assign with a value',
      'src/ui/s.ts',
      "Object.assign(el.style, { animationName: 'x' });",
    ],
    [
      'Object.assign with a quoted key',
      'src/ui/s.ts',
      "Object.assign(this.el.style, { 'transition-duration': '1s' });",
    ],
    ['style[`transition`]', 'src/ui/s.ts', "el.style[`transition`] = 'x';"],
    ['an -o- prefix', 'src/ui/a.css', 'p { -o-transition: all 1s; }'],
    ['an -ms- prefix', 'src/ui/a.css', 'p { -ms-animation: x 1s; }'],
    ['-o- keyframes', 'src/ui/a.css', '@-o-keyframes spin {}'],
    ['a prefixed property from a script', 'src/ui/s.ts', "el.style.msTransition = '1s';"],
    ['an O prefix from a script', 'src/ui/s.ts', "el.style.OTransition = '1s';"],
    ['a CSS escape in a property', 'src/ui/a.css', 'p { tr\\61nsition: opacity 1s; }'],
    ['a CSS escape of a letter', 'src/ui/a.css', 'p {\n  an\\imation: x 1s;\n}', 2],
    ['a CSS escape in a style block', 'src/ui/A.svelte', '<style>p { \\74ransition: 1s; }</style>'],
    ['a CSS escape in a style attribute', 'src/ui/A.svelte', '<p style="tr\\61nsition: 1s">x</p>'],
  ])('rejects %s', (_name, path, text, line = 1) => {
    expect(rules([file(path, text)])).toEqual([`${path}:${String(line)}`]);
  });

  it('keeps hovers, resets, components, types, data keys and prose allowed', () => {
    expect(
      rules([
        file('src/ui/a.css', '.transition:hover { color: var(--ink); }\np { transition: none; }'),
        file('src/ui/b.css', '.md\\:flex { display: flex; }\n.a\\.b { margin: 0; }'),
        file(
          'src/ui/A.svelte',
          '<p class:in={on} class="set">x</p>\n<Set />\n<Animate x={1} />\n' +
            '<p style={`color: ${c}`}>x</p>\n<p style={"transition: none"}>x</p>',
        ),
        file(
          'src/scene/s.ts',
          'const seen: Set<string> = new Set<string>();\nconst m = new Map<string, Set<number>>();\n' +
            "const keys = { set: 1, animate: 2, transition: 3 };\nconst k = keys['set'];\n" +
            "const text = 'The animation of a transition';\nconst a = Array<Set<string>>();",
        ),
        file('src/scene/t.ts', "el.style.cssText = 'transition: none; color: var(--ink)';"),
        file('src/scene/u.ts', "Object.assign(options, { transition: 1 });\nel.style['color'];"),
        file(
          'src/ui/B.svelte',
          '<script lang="ts">\n  const s: Set<string> = new Set();\n</script>',
        ),
      ]),
    ).toEqual([]);
  });

  it('sees a colour set through style[`…`] too (no-literal-colours)', () => {
    const found = checkFiles([file('src/scene/s.ts', "el.style[`color`] = 'red';")]).map(
      (p) => p.rule,
    );
    expect(found).toEqual(['no-literal-colours']);
  });
});

// M1.2d, second round (verifier of M1.2d): the rule went by call shapes and missed others. Now
// it goes by content in script code: any string or template literal (multi-line too) holding
// an animation or transition declaration, @keyframes, a view transition or a SMIL tag; any
// string that is exactly an animating property name; any member write to .transition or
// .animation…; a SMIL element named in an element-creation call or <svelte:element this>.
describe('no-css-animation by content (M1.2d)', () => {
  const rules = (files) =>
    checkFiles(files)
      .filter((p) => p.rule === 'no-css-animation')
      .map((p) => `${p.path}:${String(p.line)}`);

  it.each([
    [
      'a cssText wrapped by Prettier',
      'src/ui/s.ts',
      "el.style.cssText =\n  'opacity: 1; transition: all 1s';",
      2,
    ],
    [
      'a multi-line template for cssText',
      'src/ui/s.ts',
      'el.style.cssText = `\n  opacity: 1;\n  animation: spin 1s;\n`;',
      1,
    ],
    ['insertRule', 'src/ui/s.ts', "sheet.insertRule('.a { transition: all 1s }');", 1],
    [
      'replaceSync with keyframes',
      'src/ui/s.ts',
      "sheet.replaceSync('@keyframes x { to { opacity: 0 } }');",
      1,
    ],
    ['a style element text', 'src/ui/s.ts', "styleEl.textContent = '.a { animation: x 1s }';", 1],
    ['a transition added to', 'src/ui/s.ts', "el.style.transition += ' 1s';", 1],
    ['an indexed transition added to', 'src/ui/s.ts', "el.style['transition'] += ' 1s';", 1],
    ['Reflect.set', 'src/ui/s.ts', "Reflect.set(el.style, 'transition', 'all 1s');", 1],
    ['attributeStyleMap', 'src/ui/s.ts', "el.attributeStyleMap.set('transition', 'all 1s');", 1],
    [
      'a camelCase name as a string',
      'src/ui/s.ts',
      "el.style[name ?? 'animationDuration'] = x;",
      1,
    ],
    [
      'a view transition in a string',
      'src/ui/s.ts',
      "const css = 'main { view-transition-name: a }';",
      1,
    ],
    [
      'an escaped property in a string',
      'src/ui/s.ts',
      "el.style.cssText = 'trans\\u0069tion: 1s';",
      1,
    ],
    [
      'a SMIL tag in a Svelte script template',
      'src/scene/S.svelte',
      '<script>\n  const s = `\n  <animate to="1" />`;\n</script>',
      2,
    ],
    [
      'svelte:element with a SMIL name',
      'src/scene/S.svelte',
      '<svelte:element this={"animate"} attributeName="x" />',
      1,
    ],
    [
      'svelte:element with a quoted SMIL name',
      'src/scene/S.svelte',
      '<svelte:element this="animateMotion" />',
      1,
    ],
    ['a member write on any object', 'src/ui/s.ts', 'box.animationName = name;', 1],
  ])('rejects %s', (_name, path, text, line) => {
    expect(rules([file(path, text)])).toEqual([`${path}:${String(line)}`]);
  });

  it('keeps selectors, resets, components, types, data and prose allowed', () => {
    expect(
      rules([
        file('src/ui/a.css', '.transition:hover { color: var(--ink); }\np { transition: none; }'),
        file('src/ui/A.svelte', '<p class:in={on}>The transition: a word in prose.</p>\n<Set />'),
        file(
          'src/scene/s.ts',
          "const steps = { transition: 'step', animation: 'none' };\n" +
            'const seen: Set<string> = new Set();\n' +
            "el.style.cssText = 'transition: none';\n" +
            "const label = 'Transition to the next step';\n" +
            "const k = 'transitions';\nconst e = 'animationend';\n" +
            "const tag = document.createElement('section');",
        ),
        file('src/scene/S.svelte', '<svelte:element this={tag} />\n<svelte:element this="g" />'),
      ]),
    ).toEqual([]);
  });
});
