#!/usr/bin/env node
// Release by tag (M4.6). Two jobs:
//   `node scripts/release.mjs notes vX.Y.Z` prints the CHANGELOG.md section of that version, the
//   body of the GitHub Release; nothing when there is no such section (the workflow then lets
//   GitHub generate the notes).
//   checkReleaseWorkflow() is the guard scripts/release.test.mjs runs on
//   .github/workflows/release.yml: what K12 and K14 decided stays true.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/**
 * The CHANGELOG.md section of one version, without its heading, trimmed; '' when there is none.
 * A section starts at `## 0.1.0`, `## [0.1.0]` or `## v0.1.0` (anything may follow after a space
 * or a dash) and ends at the next `## ` heading.
 * @param {string} changelog
 * @param {string} tag vX.Y.Z or X.Y.Z
 */
export function notesFor(changelog, tag) {
  const version = String(tag).replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) return '';
  const escaped = version.replace(/\./g, '\\.');
  const heading = new RegExp(`^## \\[?v?${escaped}\\]?(?:[\\s—–-].*)?$`);
  const lines = String(changelog).split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/**
 * Problems in the release workflow; [] when it is right.
 * @param {string} text
 */
export function checkReleaseWorkflow(text) {
  const yaml = String(text).replace(/(^|\s)#.*$/gm, '$1');
  const problems = [];
  if (!/^on:\s*\n {2}push:\s*\n {4}tags:\s*\[\s*'v\*\.\*\.\*'\s*\]\s*$/m.test(yaml)) {
    problems.push("must run on pushed tags 'v*.*.*' (and on nothing else that is pushed)");
  }
  if (/^ {4}branches:/m.test(yaml)) problems.push('must not run on branch pushes');
  if (/pull_request/.test(yaml)) problems.push('must not run on pull requests');
  if (!/^ {2}workflow_dispatch:\s*\n {4}inputs:\s*\n {6}tag:/m.test(yaml)) {
    problems.push('must offer a rollback by hand: workflow_dispatch with input tag');
  }
  const permissions = /^permissions:\s*\n((?: +.*\n?)+)/m.exec(yaml)?.[1]?.trim();
  if (permissions !== 'contents: read') {
    problems.push('top-level permissions must be exactly contents: read');
  }
  if (!/^concurrency:\s*\n(?: +.*\n)* +cancel-in-progress: false/m.test(yaml)) {
    problems.push('releases must queue, never cancel one another');
  }

  const jobs = jobBlocks(yaml);
  const gate = jobs.get('gate') ?? '';
  const release = jobs.get('release') ?? '';
  const rollback = jobs.get('rollback') ?? '';
  if (!/\bnpm ci\b/.test(gate) || !/\bnpm run gate\b/.test(gate)) {
    problems.push('job gate must install with npm ci and run npm run gate');
  }
  if (/contents:\s*write/.test(gate)) problems.push('job gate must not write');
  if (!/^ {4}needs:\s*gate\s*$/m.test(release)) problems.push('job release must need gate');
  if (!/\bgh release create\b[^\n]*--verify-tag/.test(release)) {
    problems.push('job release must create the GitHub Release of the existing tag');
  }
  if (!/node scripts\/release\.mjs notes\b/.test(release)) {
    problems.push('job release must take the notes from CHANGELOG.md');
  }
  for (const [name, body] of [
    ['release', release],
    ['rollback', rollback],
  ]) {
    if (!/git push --force origin "[^"]*:refs\/heads\/release"/.test(body)) {
      problems.push(`job ${name} must move the branch release`);
    }
  }
  for (const [name, body] of [
    ['gate', gate],
    ['release', release],
  ]) {
    if (!/^ {4}if:\s*github\.event_name == 'push'\s*$/m.test(body)) {
      problems.push(`job ${name} must run only for a pushed tag`);
    }
  }
  if (!/^ {4}if:\s*github\.event_name == 'workflow_dispatch'\s*$/m.test(rollback)) {
    problems.push('job rollback must run only by hand');
  }
  if (!/grep -Eq '\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$'/.test(rollback)) {
    problems.push('job rollback must accept only a vX.Y.Z tag');
  }
  // K12: no Cloudflare token in GitHub; Cloudflare deploys the branch by itself.
  if (/\bsecrets\s*[.[]/.test(yaml)) problems.push('must not use secrets');
  if (/wrangler|cloudflare/i.test(yaml)) {
    problems.push('must not deploy: Cloudflare builds the branch release by itself (K12, K14)');
  }
  // Script injection: an expression is only ever a value of a key (env, if, with), never shell.
  yaml.split('\n').forEach((line, index) => {
    if (!line.includes('${{')) return;
    if (/^\s*(?:-\s+)?run:/.test(line) || !/^\s*(?:-\s+)?[\w-]+:\s/.test(line)) {
      problems.push(`line ${index + 1}: \${{ … }} inside a shell command`);
    }
  });
  return problems;
}

/**
 * The text of each job under `jobs:`, by job id.
 * @param {string} yaml
 */
function jobBlocks(yaml) {
  /** @type {Map<string, string>} */
  const jobs = new Map();
  const at = yaml.search(/^jobs:\s*$/m);
  if (at === -1) return jobs;
  let name = '';
  for (const line of yaml.slice(at).split('\n').slice(1)) {
    if (/^\S/.test(line)) break;
    const head = /^ {2}([\w-]+):\s*$/.exec(line);
    if (head?.[1] !== undefined) {
      name = head[1];
      jobs.set(name, '');
    } else if (name !== '') {
      jobs.set(name, `${jobs.get(name) ?? ''}${line}\n`);
    }
  }
  return jobs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, tag] = process.argv.slice(2);
  if (command !== 'notes' || tag === undefined || !TAG.test(tag)) {
    console.error('usage: node scripts/release.mjs notes vX.Y.Z');
    process.exit(2);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const notes = notesFor(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), tag);
  if (notes !== '') process.stdout.write(`${notes}\n`);
}
