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
