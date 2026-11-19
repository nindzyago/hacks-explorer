// M4.1, oracle level A: the files a public repository needs exist and keep what the plan asks of
// them. The text itself is reviewed by people; this only guards the facts that must not drift.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './content-files.mjs';

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('project documents (M4.1)', () => {
  it.each([
    'README.md',
    'README.ru.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
    '.github/pull_request_template.md',
    '.github/ISSUE_TEMPLATE/bug.md',
    '.github/ISSUE_TEMPLATE/lesson-mistake.md',
    '.github/ISSUE_TEMPLATE/new-lesson.md',
    '.github/ISSUE_TEMPLATE/new-language.md',
    'docs/lesson-template/ru.md',
    'docs/lesson-template/en.md',
    'docs/new-language.md',
  ])('%s exists', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(true);
  });

  it.each(['README.md', 'README.ru.md'])(
    '%s names Protocol Explorer as the source of the idea',
    (path) => {
      expect(read(path)).toContain('Protocol Explorer');
    },
  );

  it('the Code of Conduct is the Contributor Covenant 2.1, attributed under CC BY 4.0', () => {
    const text = read('CODE_OF_CONDUCT.md');
    expect(text).toContain('Contributor Covenant][homepage], version 2.1');
    expect(text).toContain('creativecommons.org/licenses/by/4.0');
    expect(text).not.toContain('[INSERT CONTACT METHOD]');
    expect(read('ATTRIBUTION.md')).toContain('CODE_OF_CONDUCT.md');
  });

  it('CONTRIBUTING sends people to AGENTS.md for the rules', () => {
    expect(read('CONTRIBUTING.md')).toContain('[AGENTS.md](AGENTS.md)');
  });

  it('SECURITY says how to report privately and that there is no bounty', () => {
    const text = read('SECURITY.md');
    expect(text).toContain('Report a vulnerability');
    expect(text).toMatch(/no bug bounty/i);
  });

  it('every issue template has a name and a description', () => {
    for (const name of ['bug', 'lesson-mistake', 'new-lesson', 'new-language']) {
      const text = read(`.github/ISSUE_TEMPLATE/${name}.md`);
      expect(text).toMatch(/^---\nname: .+\nabout: .+\n/);
    }
  });
});
