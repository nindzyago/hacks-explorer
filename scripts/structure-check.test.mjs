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

  it('lets test files hold colours as data', () => {
    expect(rules([file('src/ui/tokens.test.ts', "expect(x).toBe('#f3f5f7');")])).toEqual([]);
  });
});
