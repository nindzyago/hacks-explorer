// Acceptance for M1.1a (design M1.1 r2, oracle level D, scenario S8): a valid lesson parses into
// data; every broken variant gives an error naming the file, the line and the reason.
import { describe, expect, it } from 'vitest';
import { checkContent, checkLesson, formatError } from './check';
import type { LessonError } from './types';
import validRu from './fixtures/valid-ru.md?raw';
import validEn from './fixtures/valid-en.md?raw';
import enMismatch from './fixtures/en-mismatch.md?raw';
import noDefenceStep from './fixtures/s8-no-defence-step.md?raw';
import noDefenceSection from './fixtures/s8-no-defence-section.md?raw';
import badAddress from './fixtures/s8-bad-address.md?raw';
import noSources from './fixtures/s8-no-sources.md?raw';
import missingLevel from './fixtures/missing-level.md?raw';

const FILE = 'content/lessons/X1/ru.md';
const DOMAINS = ['owasp.org', 'mitre.org'];

function check(text: string, file = FILE) {
  return checkLesson(file, text, { sourceDomains: DOMAINS });
}
function codes(errors: readonly LessonError[]) {
  return errors.map((e) => e.code);
}
/** Replace exactly one occurrence, so a test never silently checks the unchanged fixture. */
function edit(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`edit: need one "${from}"`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}
function lineOf(text: string, needle: string): number {
  const at = text.indexOf(needle);
  if (at < 0) throw new Error(`lineOf: no "${needle}"`);
  return text.slice(0, at).split('\n').length;
}

describe('a valid lesson', () => {
  const result = check(validRu);

  it('has no errors', () => {
    expect(result.errors).toEqual([]);
  });

  it('becomes lesson data', () => {
    const lesson = result.lesson;
    expect(lesson).toMatchObject({
      id: 'X1',
      section: 'X',
      wave: 2,
      format: 1,
      language: 'ru',
      title: 'Учебная атака',
      passport: {
        cwe: [89, 564],
        owasp: ['A03:2021'],
        attack: ['T1190'],
        cvss: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
        cves: ['CVE-2021-44228'],
        severity: 'high',
        impact: 'Чужие данные',
        defence: 'Проверка на сервере',
      },
      sources: [
        {
          title: 'OWASP Cheat Sheet',
          url: 'https://cheatsheetseries.owasp.org/index.html',
          position: { line: 18, column: 3 },
        },
      ],
      participants: [
        { id: 'attacker', name: 'Атакующий', note: '203.0.113.66', icon: 'attacker' },
        { id: 'user', name: 'Посетитель', note: '2001:db8::24', icon: 'laptop' },
        { id: 'site', name: 'Сайт', note: 'shop.example', icon: 'site' },
      ],
      zones: [
        { id: 'outside', label: 'Снаружи', members: ['attacker'], danger: false },
        { id: 'inside', label: 'Внутри', members: ['user', 'site'], danger: true },
      ],
      defence: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Проверяйте запрос на сервере.' }],
        },
      ],
    });
  });

  it('accepts a harmful message stopped by the defence (D3 a: attack · with-defence · stopped)', () => {
    const text = edit(
      validRu,
      '`site → attacker` · `safe` · `with-defence` · `stopped`',
      '`site → attacker` · `attack` · `with-defence` · `stopped`',
    );
    const stopped = check(text);
    expect(stopped.errors).toEqual([]);
    expect(stopped.lesson?.steps.at(-1)).toMatchObject({
      kind: 'attack',
      mode: 'with-defence',
      stopped: true,
    });
  });

  it('keeps steps with their service line, plaque texts, code and three levels', () => {
    const steps = result.lesson?.steps ?? [];
    expect(steps.map((s) => [s.id, s.from, s.to, s.kind, s.mode, s.stopped])).toEqual([
      ['send', 'attacker', 'site', 'attack', 'both', false],
      ['pass', 'site', 'user', 'attack', 'without-defence', false],
      ['block', 'site', 'attacker', 'safe', 'with-defence', true],
    ]);
    const send = steps[0];
    expect(send).toMatchObject({
      title: 'Отправка',
      icon: 'mail',
      message: 'письмо',
      result: 'доставлено',
      position: { line: 33, column: 1 },
      code: {
        type: 'code',
        lang: 'http',
        segments: [
          { text: 'GET /?q=', marked: false },
          { text: 'evil', marked: true },
          { text: ' HTTP/1.1\nHost: shop.example', marked: false },
        ],
      },
    });
    expect(send?.levels.simple).toEqual([
      {
        type: 'paragraph',
        position: { line: 45, column: 1 },
        children: [
          { type: 'text', value: 'Атакующий шлёт ' },
          { type: 'strong', children: [{ type: 'text', value: 'запрос' }] },
          { type: 'text', value: ' на ' },
          { type: 'code', value: 'shop.example' },
          { type: 'text', value: '.' },
        ],
      },
    ]);
    expect(send?.levels.detailed[0]).toMatchObject({ type: 'list', ordered: true });
    expect(steps[1]?.code).toBe(null);
    expect(steps[1]?.icon).toBe(null);
  });

  it('survives JSON unchanged', () => {
    expect(JSON.parse(JSON.stringify(result.lesson))).toEqual(result.lesson);
  });
});

describe('S8: a wrong lesson does not get into the build', () => {
  it('fails without a with-defence step, naming the file, the section and the line', () => {
    const { errors, lesson } = check(noDefenceStep);
    expect(lesson).toBe(null);
    expect(errors).toEqual([
      expect.objectContaining({
        file: FILE,
        code: 'no-defence-step',
        path: 'steps',
        line: lineOf(noDefenceStep, '## Шаги'),
      }),
    ]);
  });

  it('fails without «Как защититься»', () => {
    expect(check(noDefenceSection).errors).toEqual([
      expect.objectContaining({ code: 'no-defence-section', path: 'defence', line: 1 }),
    ]);
  });

  it('fails on an address outside the documentation ranges, with file, line and column', () => {
    const { errors } = check(badAddress);
    expect(errors).toEqual([
      expect.objectContaining({
        code: 'address',
        line: lineOf(badAddress, 'google.com'),
        column: 21,
        message: expect.stringContaining('google.com') as unknown,
      }),
      expect.objectContaining({
        code: 'address',
        line: lineOf(badAddress, '8.8.8.8'),
        column: 20,
        message: expect.stringContaining('8.8.8.8') as unknown,
      }),
    ]);
  });

  it('fails with an empty «Источники»', () => {
    expect(codes(check(noSources).errors)).toEqual(['no-sources']);
  });

  it('fails when a step misses a level, naming the step', () => {
    const { errors } = check(missingLevel);
    expect(errors).toEqual([
      expect.objectContaining({
        code: 'missing-level',
        path: 'steps.pass',
        line: lineOf(missingLevel, '### `pass`'),
        message: expect.stringContaining('Глубже') as unknown,
      }),
    ]);
  });

  it('every error formats as file:line:column: message', () => {
    const [error] = check(noSources).errors;
    expect(error && formatError(error)).toMatch(/^content\/lessons\/X1\/ru\.md:\d+:\d+: \S/);
  });
});

describe('the header line and the title', () => {
  it('needs a title first', () => {
    expect(codes(check(edit(validRu, '# Учебная атака\n', '')).errors)).toContain('missing-title');
  });

  it.each([
    ['`lesson` X1 · `section` X · `wave` 2 · `format` 2', 'bad-value'],
    ['`lesson` X1 · `section` X · `wave` 2', 'bad-header'],
    ['`lesson` X2 · `section` X · `wave` 2 · `format` 1', 'bad-value'],
    ['`lesson` X1 · `section` Y · `wave` 2 · `format` 1', 'bad-value'],
    ['`lesson` X1 · `section` X · `wave` 9 · `format` 1', 'bad-value'],
    ['`lesson` X1 · `section` X · `wave` 2 · `format` 1 · `level` 3', 'unknown-word'],
    ['`lesson` X1 · `lesson` X1 · `section` X · `wave` 2 · `format` 1', 'duplicate'],
    ['lesson X1, format 1', 'bad-header'],
  ])('rejects %s', (header, code) => {
    const text = edit(validRu, '`lesson` X1 · `section` X · `wave` 2 · `format` 1', header);
    const { errors } = check(text);
    expect(codes(errors)).toContain(code);
    expect(errors.find((e) => e.code === code)?.line).toBe(3);
  });

  it('takes the lesson id from the folder and the language from the file name', () => {
    expect(codes(check(validRu, 'content/lessons/X1/de.md').errors)).toEqual(['unknown-language']);
    expect(codes(check(validRu, 'content/lessons/x1/ru.md').errors)).toEqual(['bad-path']);
    expect(codes(check(validRu, 'lessons/X1/ru.md').errors)).toEqual(['bad-path']);
    expect(codes(check(validRu, 'content/lessons/X1/ru.txt').errors)).toEqual(['bad-path']);
  });
});

describe('sections', () => {
  it('rejects an unknown section, naming the known ones', () => {
    const { errors } = check(edit(validRu, '## Зоны', '## Зоны доверия'));
    expect(errors[0]).toMatchObject({ code: 'unknown-section', line: lineOf(validRu, '## Зоны') });
    expect(errors[0]?.message).toContain('Паспорт');
  });

  it('rejects «Песочница» in format 1', () => {
    const text = `${validRu}\n## Песочница\n\nПопробуйте сами.\n`;
    expect(codes(check(text).errors)).toEqual(['sandbox-not-allowed']);
  });

  it('rejects sections out of order and twice', () => {
    const swapped = edit(
      edit(validRu, '## Паспорт', '## ВРЕМЕННО'),
      '## Источники',
      '## Паспорт',
    ).replace('## ВРЕМЕННО', '## Источники');
    expect(codes(check(swapped).errors)).toContain('section-order');
    const twice = `${validRu}\n## Зоны\n\n- \`more\` Ещё: \`site\`\n`;
    expect(codes(check(twice).errors)).toContain('duplicate');
  });

  it.each(['## Паспорт', '## Источники', '## Участники', '## Шаги'])('requires %s', (heading) => {
    const at = validRu.indexOf(heading);
    const next = validRu.indexOf('\n## ', at + 1);
    const text = validRu.slice(0, at) + validRu.slice(next + 1);
    expect(codes(check(text).errors)).toContain('missing-section');
  });

  it('allows no zones', () => {
    const at = validRu.indexOf('## Зоны');
    const text = validRu.slice(0, at) + validRu.slice(validRu.indexOf('## Шаги'));
    expect(check(text).errors).toEqual([]);
  });

  it('rejects text before the first section and deeper headings out of place', () => {
    expect(codes(check(edit(validRu, '## Паспорт', 'Вступление.\n\n## Паспорт')).errors)).toEqual([
      'stray-content',
    ]);
    expect(codes(check(edit(validRu, '## Зоны', '### Лишнее\n\n## Зоны')).errors)).toContain(
      'stray-content',
    );
  });
});

describe('passport', () => {
  it.each([
    ['- `cwe` 89, 564', '- `cwe` CWE-89', 'bad-value'],
    ['- `owasp` A03:2021', '- `owasp` A3', 'bad-value'],
    ['- `attack` T1190', '- `attack` 1190', 'bad-value'],
    ['- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', '- `cvss` 9.8', 'bad-value'],
    // M2.5: the vector is read by src/core/cvss, not only by its shape.
    [
      '- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      '- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N',
      'bad-value',
    ],
    [
      '- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      '- `cvss` CVSS:3.1/AV:Q/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      'bad-value',
    ],
    [
      '- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      '- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/AV:N',
      'bad-value',
    ],
    [
      '- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      '- `cvss` CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      'bad-value',
    ],
    ['- `cves` CVE-2021-44228', '- `cves` 2021-44228', 'bad-value'],
    ['- `severity` high', '- `severity` very high', 'bad-value'],
    ['- `severity` high', '- `danger` high', 'unknown-word'],
    ['- `severity` high', '- `cwe` 79', 'duplicate'],
    ['- `severity` high', '- severity high', 'bad-line'],
  ])('rejects %s → %s', (from, to, code) => {
    expect(codes(check(edit(validRu, from, to)).errors)).toContain(code);
  });

  it('needs the defence name and severity in an attack lesson', () => {
    expect(codes(check(edit(validRu, '- `defence` Проверка на сервере\n', '')).errors)).toEqual([
      'no-defence-name',
    ]);
    expect(codes(check(edit(validRu, '- `severity` high\n', '')).errors)).toEqual([
      'no-defence-name',
    ]);
  });
});

describe('sources', () => {
  it('allows links only to listed domains, over https', () => {
    const other = edit(validRu, 'https://cheatsheetseries.owasp.org', 'https://evil.example');
    expect(check(other).errors).toEqual([
      expect.objectContaining({ code: 'source-domain', line: 18 }),
    ]);
    const http = edit(validRu, 'https://cheatsheetseries.owasp.org', 'http://owasp.org');
    expect(codes(check(http).errors)).toEqual(['source-domain']);
    const lookalike = edit(validRu, 'https://cheatsheetseries.owasp.org', 'https://notowasp.org');
    expect(codes(check(lookalike).errors)).toEqual(['source-domain']);
  });

  it('wants each source as one link', () => {
    const text = edit(validRu, '- [OWASP Cheat Sheet]', '- Читайте [OWASP Cheat Sheet]');
    expect(codes(check(text).errors)).toEqual(['bad-line']);
  });
});

describe('participants and zones', () => {
  it('rejects a seventh participant (K19: one line holds six)', () => {
    const more = ['p4', 'p5', 'p6', 'p7'].map((id) => `- \`${id}\` **${id}**`).join('\n');
    const text = edit(
      validRu,
      '- `site` **Сайт** — shop.example',
      `- \`site\` **Сайт** — shop.example\n${more}`,
    );
    expect(codes(check(text).errors)).toEqual(['too-many-participants']);
    const six = edit(
      validRu,
      '- `site` **Сайт** — shop.example',
      `- \`site\` **Сайт** — shop.example\n${more.split('\n').slice(0, 3).join('\n')}`,
    );
    expect(check(six).errors).toEqual([]);
  });

  it.each([
    ['- `site` **Сайт** — shop.example', '- `Site` **Сайт** — shop.example', 'bad-value'],
    ['- `site` **Сайт** — shop.example', '- `__proto__` **Сайт**', 'bad-value'],
    ['- `site` **Сайт** — shop.example', '- `site` Сайт — shop.example', 'bad-line'],
    ['- `site` **Сайт** — shop.example', '- `user` **Сайт**', 'duplicate'],
    [
      '- `user` **Посетитель** — 2001:db8::24 · `icon:laptop`',
      '- `user` **Посетитель** · `icon:Laptop!`',
      'bad-value',
    ],
  ])('rejects participant line %s → %s', (from, to, code) => {
    expect(codes(check(edit(validRu, from, to)).errors)).toContain(code);
  });

  it('rejects a zone with an unknown participant, naming the known ones', () => {
    const { errors } = check(edit(validRu, 'Внутри: `user`, `site`', 'Внутри: `user`, `website`'));
    expect(errors).toEqual([
      expect.objectContaining({
        code: 'unknown-participant',
        path: 'zones.inside',
        line: lineOf(validRu, '- `inside`'),
        message: expect.stringContaining('attacker, user, site') as unknown,
      }),
    ]);
  });

  it('rejects zones that are not a run of neighbours or that overlap', () => {
    const gap = edit(
      edit(validRu, 'Снаружи: `attacker`', 'Снаружи: `attacker`, `site`'),
      'Внутри: `user`, `site`',
      'Внутри: `user`',
    );
    expect(codes(check(gap).errors)).toEqual(['zone-not-contiguous']);
    const overlap = edit(validRu, 'Снаружи: `attacker`', 'Снаружи: `attacker`, `user`');
    expect(codes(check(overlap).errors)).toEqual(['zone-overlap']);
  });
});

describe('steps', () => {
  it('rejects a step to an unknown participant, naming the known ones', () => {
    const text = edit(validRu, '`site → user` · `attack`', '`site → database` · `attack`');
    expect(check(text).errors).toEqual([
      expect.objectContaining({
        code: 'unknown-participant',
        path: 'steps.pass',
        line: lineOf(validRu, '`site → user`'),
        message: 'step `pass`: unknown participant `database`; known: attacker, user, site',
      }),
    ]);
  });

  it.each([
    [
      '`site → user` · `attack` · `without-defence`',
      '`site → user` · `evil` · `without-defence`',
      'unknown-word',
    ],
    [
      '`site → user` · `attack` · `without-defence`',
      '`site → user` · `attack` · `sometimes`',
      'unknown-word',
    ],
    [
      '`site → user` · `attack` · `without-defence`',
      '`site → user` · `attack` · `without-defence` · `with-defence`',
      'duplicate',
    ],
    ['`site → user` · `attack` · `without-defence`', '`site -> user` · `attack`', 'bad-line'],
    [
      '`site → user` · `attack` · `without-defence`',
      '`site → user` · `attack` · `without-defence` · `stopped`',
      'stopped-without-defence',
    ],
    ['Сообщение: ответ · Итог: атака прошла', 'Ответ, атака прошла', 'bad-line'],
    ['Сообщение: ответ · Итог: атака прошла', 'Сообщение: ответ', 'bad-line'],
    ['### `pass` Пропуск', '### Пропуск', 'bad-line'],
    ['### `pass` Пропуск', '### `send` Пропуск', 'duplicate'],
    [
      '#### Глубже\n\nСайт пропускает запрос без проверки.',
      '#### Ещё глубже\n\nТекст.',
      'unknown-level',
    ],
    ['#### Глубже\n\nСайт пропускает запрос без проверки.', '#### Глубже\n', 'missing-level'],
  ])('rejects %s → %s', (from, to, code) => {
    expect(codes(check(edit(validRu, from, to)).errors)).toContain(code);
  });

  it('wants levels in order', () => {
    const text = edit(
      validRu,
      '#### Просто\n\nСайт отказывает.\n\n#### По шагам\n\nСайт проверяет запрос и отказывает.',
      '#### По шагам\n\nСайт проверяет запрос и отказывает.\n\n#### Просто\n\nСайт отказывает.',
    );
    expect(codes(check(text).errors)).toEqual(['section-order']);
  });

  it('keeps a code block inside a level as part of the text', () => {
    const text = edit(
      validRu,
      'Сайт сверяет запрос со списком разрешённого.',
      'Сайт сверяет запрос.\n\n```\nallow ⟦/admin⟧\n```',
    );
    const { lesson, errors } = check(text);
    expect(errors).toEqual([]);
    expect(lesson?.steps[2]?.levels.deep[1]).toMatchObject({
      type: 'code',
      lang: '',
      segments: [
        { text: 'allow ', marked: false },
        { text: '/admin', marked: true },
      ],
    });
  });

  it.each(['```\na ⟦b\n```', '```\na ⟦b ⟦c⟧⟧\n```', '```\na b⟧\n```', 'Текст ⟦вне кода⟧.'])(
    'rejects broken marks: %s',
    (snippet) => {
      const text = edit(validRu, 'Сайт отказывает.', `Сайт отказывает.\n\n${snippet}`);
      expect(codes(check(text).errors)).toEqual(['bad-mark']);
    },
  );
});

describe('text (design E4)', () => {
  it.each([
    ['HTML', 'Сайт <b>отказывает</b>.', 'html'],
    ['an HTML block', '<div>\nСайт отказывает.\n</div>', 'html'],
    ['an image', 'Сайт ![схема](a.png) отказывает.', 'image'],
    ['a link', 'Сайт [отказывает](https://owasp.org).', 'link'],
    ['an autolink', 'Сайт <https://owasp.org> отказывает.', 'link'],
    ['a reference link', 'Сайт [отказывает][r].\n\n[r]: https://owasp.org', 'link'],
    ['a quote', '> Сайт отказывает.', 'not-allowed'],
    ['a heading inside text', '##### Сайт', 'not-allowed'],
    ['a rule', 'Сайт\n\n---\n\nотказывает.', 'not-allowed'],
  ])('rejects %s in a step', (_name, snippet, code) => {
    const text = edit(validRu, 'Сайт отказывает.', snippet);
    const { errors } = check(text);
    expect(codes(errors)).toContain(code);
    expect(errors.find((e) => e.code === code)?.path).toBe('steps.block.simple');
  });

  it('rejects links in «Как защититься» too', () => {
    const text = edit(validRu, 'Проверяйте запрос на сервере.', 'См. [OWASP](https://owasp.org).');
    // The target is a real site outside the sources section: an address error as well.
    expect(codes(check(text).errors)).toEqual(['link', 'address']);
  });
});

describe('documentation addresses anywhere in the file (L4.2)', () => {
  it.each([
    ['in the title', '# Учебная атака', '# Атака на 10.0.0.1'],
    ['in a participant note', '— shop.example', '— shop.com'],
    ['in a zone label', 'Внутри:', 'Сеть evil.org:'],
    ['in a plaque', 'Сообщение: письмо', 'Сообщение: письмо от 1.2.3.4'],
    ['in code', 'Host: shop.example', 'Host: bank.ru'],
    ['in inline code', 'на `shop.example`', 'на `shop.co.uk`'],
    ['IPv6 outside 2001:db8::/32', '2001:db8::24', '2001:db9::24'],
    ['an e-mail', 'anna@mail.test', 'anna@gmail.com'],
  ])('rejects an address %s', (_name, from, to) => {
    expect(codes(check(edit(validRu, from, to)).errors)).toEqual(['address']);
  });

  it('does not look into source links, which point at real sites', () => {
    expect(check(validRu).errors).toEqual([]);
  });
});

describe('translations (K21)', () => {
  const sources = { path: 'content/sources.md', text: '- `owasp.org` OWASP\n' };
  const ru = { path: 'content/lessons/X1/ru.md', text: validRu };

  it('accepts an en.md whose service lines match ru.md', () => {
    const result = checkContent([ru, { path: 'content/lessons/X1/en.md', text: validEn }], sources);
    expect(result.errors).toEqual([]);
    expect(result.lessons.map((l) => `${l.id}/${l.language}`)).toEqual(['X1/ru', 'X1/en']);
  });

  it('rejects an en.md with another recipient in a step', () => {
    const result = checkContent(
      [ru, { path: 'content/lessons/X1/en.md', text: enMismatch }],
      sources,
    );
    expect(result.errors).toEqual([
      expect.objectContaining({
        file: 'content/lessons/X1/en.md',
        code: 'translation-mismatch',
        path: 'steps.pass',
        line: lineOf(enMismatch, '`site → attacker`'),
        message: 'step `pass` goes site → attacker here but site → user in ru.md',
      }),
    ]);
  });

  it.each([
    [
      'participants',
      '- `site` **Site** — shop.example',
      '- `site` **Site** — shop.example · `icon:shop`',
    ],
    ['zones', 'Inside: `user`, `site` · `danger`', 'Inside: `user`, `site`'],
    ['passport', '- `cwe` 89, 564', '- `cwe` 89'],
    ['header', '`wave` 2', '`wave` 3'],
    ['step marks', '`safe` · `with-defence` · `stopped`', '`safe` · `with-defence`'],
    ['step order', '### `pass` Let through', '### `pass2` Let through'],
  ])('rejects an en.md that differs in %s', (_name, from, to) => {
    const result = checkContent(
      [ru, { path: 'content/lessons/X1/en.md', text: edit(validEn, from, to) }],
      sources,
    );
    expect(codes(result.errors)).toContain('translation-mismatch');
  });

  it('rejects a translation without ru.md and stray files', () => {
    const result = checkContent(
      [
        { path: 'content/lessons/X1/en.md', text: validEn },
        { path: 'content/lessons/X1/notes.txt', text: 'x' },
      ],
      sources,
    );
    expect(codes(result.errors)).toEqual(['missing-base', 'unexpected-file']);
  });

  it('with only ru.md the translation rule has nothing to do', () => {
    expect(checkContent([ru], sources).errors).toEqual([]);
  });

  it('reports a broken sources file', () => {
    const result = checkContent([ru], { path: 'content/sources.md', text: '- owasp.org\n' });
    expect(result.errors[0]).toMatchObject({ file: 'content/sources.md', code: 'bad-line' });
  });
});

describe('passport class (K71): optional text, present in every language or in none', () => {
  const withClass = (text: string, from: string, value: string) =>
    edit(text, from, `${from}\n- \`class\` ${value}`);
  const ruClass = withClass(validRu, '- `defence` Проверка на сервере', 'Инъекция');
  const enClass = withClass(validEn, '- `defence` Server-side check', 'Injection');
  const sources = { path: 'content/sources.md', text: '- `owasp.org` OWASP\n' };

  it('reads the class as text in the lesson language', () => {
    const result = check(ruClass);
    expect(result.errors).toEqual([]);
    expect(result.lesson?.passport.class).toBe('Инъекция');
  });

  it('is null when the line is absent', () => {
    expect(check(validRu).lesson?.passport.class).toBeNull();
  });

  it('rejects a second class line', () => {
    const twice = withClass(ruClass, '- `class` Инъекция', 'Ещё одна');
    expect(codes(check(twice).errors)).toEqual(['duplicate']);
  });

  it('rejects markup in the class', () => {
    const marked = edit(ruClass, '`class` Инъекция', '`class` Инъекция <br>');
    expect(codes(check(marked).errors)).toEqual(['html']);
  });

  it('accepts translations that both have a class', () => {
    const result = checkContent(
      [
        { path: 'content/lessons/X1/ru.md', text: ruClass },
        { path: 'content/lessons/X1/en.md', text: enClass },
      ],
      sources,
    );
    expect(result.errors).toEqual([]);
  });

  it.each([
    ['only ru.md', ruClass, validEn],
    ['only en.md', validRu, enClass],
  ])('rejects a class present in %s', (_name, ru, en) => {
    const result = checkContent(
      [
        { path: 'content/lessons/X1/ru.md', text: ru },
        { path: 'content/lessons/X1/en.md', text: en },
      ],
      sources,
    );
    expect(result.errors).toEqual([
      expect.objectContaining({
        file: 'content/lessons/X1/en.md',
        code: 'translation-mismatch',
        path: 'passport.class',
      }),
    ]);
  });
});
