// Acceptance for M4.6 (repository side): a pushed tag vX.Y.Z runs the gate, creates the GitHub
// Release with the CHANGELOG.md notes and moves the branch `release` that Cloudflare deploys;
// a run by hand with an older tag moves it back (rollback). The tag itself and the deploy happen
// on GitHub and Cloudflare and are not tested here (docs/deploy.md). Oracle level A.
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TAG, checkReleaseWorkflow, notesFor } from './release.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const WORKFLOW = read('.github/workflows/release.yml');

describe('the repository as committed', () => {
  it('has a release workflow that says what K12 and K14 decided', () => {
    expect(checkReleaseWorkflow(WORKFLOW)).toEqual([]);
  });

  it('has notes for 0.1.1 in CHANGELOG.md', () => {
    const notes = notesFor(read('CHANGELOG.md'), 'v0.1.1');
    expect(notes).toContain('SQL');
    expect(notes).not.toMatch(/^## /m);
  });

  it('prints the notes from the command line the workflow runs', () => {
    const out = execFileSync('node', ['scripts/release.mjs', 'notes', 'v0.1.1'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(out.trim()).toBe(notesFor(read('CHANGELOG.md'), 'v0.1.1'));
    expect(
      execFileSync('node', ['scripts/release.mjs', 'notes', 'v99.0.0'], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    ).toBe('');
  });

  // The four refusals run at once: one node start each, in parallel, so a loaded machine
  // does not push four serial starts past the test timeout.
  it('refuses a malformed tag on the command line', async () => {
    const tags = ['0.1.0', 'v0.1', 'v0.1.0-rc.1', '$(id)'];
    const codes = await Promise.all(
      tags.map(
        (tag) =>
          new Promise((resolve) => {
            execFile('node', ['scripts/release.mjs', 'notes', tag], { cwd: ROOT }, (error) => {
              resolve(error === null ? 0 : (error.code ?? 1));
            });
          }),
      ),
    );
    expect(codes.every((code) => code !== 0)).toBe(true);
  });
});

describe('release notes', () => {
  const changelog = [
    '# Changes',
    '',
    '## 0.2.0 (готовится)',
    '',
    '- two',
    '',
    '## [0.1.0] — 2026-12-01',
    '',
    '### Lessons',
    '- one',
    '',
    '## 0.0.1',
    '- zero',
  ].join('\n');

  it('takes one section, without its heading, up to the next one', () => {
    expect(notesFor(changelog, 'v0.1.0')).toBe('### Lessons\n- one');
    expect(notesFor(changelog, '0.2.0')).toBe('- two');
    expect(notesFor(changelog, 'v0.0.1')).toBe('- zero');
  });

  it('gives nothing for a missing version or a version that only starts the same', () => {
    expect(notesFor(changelog, 'v0.3.0')).toBe('');
    expect(notesFor(changelog, 'v0.1.00')).toBe('');
    expect(notesFor('## 0.1.01\n- no', 'v0.1.0')).toBe('');
    expect(notesFor('## 0x1x0\n- no', 'v0.1.0')).toBe('');
  });

  it('survives hostile input', () => {
    for (const tag of ['', 'v', 'v1.2', '../../etc', 'v1.2.3.4', '.*']) {
      expect(notesFor(changelog, tag)).toBe('');
    }
    expect(notesFor('', 'v0.1.0')).toBe('');
    expect(notesFor('## 0.1.0\r\n- crlf\r\n', 'v0.1.0')).toBe('- crlf');
  });

  it('knows a release tag', () => {
    expect(TAG.test('v0.1.0')).toBe(true);
    expect(TAG.test('v10.20.30')).toBe(true);
    for (const tag of ['0.1.0', 'v0.1', 'v0.1.0-rc.1', 'v0.1.0\n', 'release']) {
      expect(TAG.test(tag)).toBe(false);
    }
  });
});

// Mutations of the real workflow: each breaks one promise and must be caught.
describe('the release workflow guard', () => {
  const broken = (from, to) => {
    expect(WORKFLOW).toContain(from);
    return checkReleaseWorkflow(WORKFLOW.replace(from, to));
  };

  it.each([
    ['no tag trigger', "tags: ['v*.*.*']", "tags: ['*']"],
    ['runs on branches', "    tags: ['v*.*.*']", "    tags: ['v*.*.*']\n    branches: [main]"],
    ['no rollback', 'workflow_dispatch:', 'workflow_call:'],
    ['writes everywhere', 'permissions:\n  contents: read', 'permissions:\n  contents: write'],
    ['cancels a release', 'cancel-in-progress: false', 'cancel-in-progress: true'],
    ['no gate', 'run: npm run gate', 'run: npm test'],
    ['release without gate', '    needs: gate\n', ''],
    ['no Release', 'gh release create', 'gh release list'],
    ['notes not from CHANGELOG', 'node scripts/release.mjs notes', 'echo'],
    ['branch not moved', 'git push --force origin "$(git rev-parse HEAD)', 'echo "'],
    ['rollback does not move', 'git push --force origin "$sha', 'echo "$sha'],
    ['rollback on a push', "if: github.event_name == 'workflow_dispatch'", 'if: always()'],
    [
      'release on a dispatch',
      "    needs: gate\n    if: github.event_name == 'push'",
      '    needs: gate',
    ],
    [
      'any rollback ref',
      `grep -Eq '^v[0-9]+\\.[0-9]+\\.[0-9]+$'; then\n            echo "::error::$TAG`,
      `true; then\n            echo "::error::$TAG`,
    ],
    [
      'Cloudflare token',
      'GH_TOKEN: ${{ github.token }}',
      'CLOUDFLARE_API_TOKEN: ${{ secrets.CF }}',
    ],
    ['deploys from GitHub', 'run: npm ci', 'run: npm ci && npx wrangler deploy'],
    ['shell injection', 'echo "::error::$TAG is not vX.Y.Z"', 'echo "${{ inputs.tag }}"'],
    // CI7: the gate runs in parts; every part runs and each knows the count.
    ['a part left out', 'shard: [1, 2, 3, 4, 5]', 'shard: [1, 2, 3]'],
    ['parts out of order', 'shard: [1, 2, 3, 4, 5]', 'shard: [1, 1, 3, 4]'],
    ['a wrong count', 'E2E_SHARD: ${{ matrix.shard }}/5', 'E2E_SHARD: ${{ matrix.shard }}/4'],
    ['no part number', 'E2E_SHARD: ${{ matrix.shard }}/5', 'E2E_SHARD: 1/4'],
    ['not in parts', '      matrix:\n        shard: [1, 2, 3, 4, 5]\n', ''],
  ])('catches: %s', (_name, from, to) => {
    expect(broken(from, to).length).toBeGreaterThan(0);
  });

  it('refuses an empty or foreign file', () => {
    expect(checkReleaseWorkflow('').length).toBeGreaterThan(5);
    expect(checkReleaseWorkflow(read('.github/workflows/gate.yml')).length).toBeGreaterThan(5);
  });
});
