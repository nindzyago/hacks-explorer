/**
 * Content rules on a parsed lesson (design E7, scenario S8, AGENTS.md L4 and L5).
 */
import { findForeignAddresses } from './addresses';
import type { LanguageWords } from './headings';
import type { ParsedLesson } from './parse';
import type { Reporter } from './report';
import { START, createLocator, quote } from './report';

/** One line of the scene holds six participants (decision K19). */
export const MAX_PARTICIPANTS = 6;

/** A lesson is about an attack when any of its messages is an attack. */
export function isAttackLesson(parsed: ParsedLesson): boolean {
  return parsed.draft.steps.some((s) => s.kind === 'attack');
}

function hostAllowed(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

function checkSources(parsed: ParsedLesson, reporter: Reporter, domains: readonly string[]): void {
  const { draft, anchors } = parsed;
  if (anchors.sections.sources !== undefined && parsed.sourceLines === 0) {
    reporter.add(
      anchors.sections.sources,
      'sources',
      'no-sources',
      'a lesson needs at least one open source (L5)',
    );
  }
  for (const source of draft.sources) {
    let host: string | null = null;
    try {
      const url = new URL(source.url);
      const plain = url.username === '' && url.password === '' && url.port === '';
      if (url.protocol === 'https:' && plain) host = url.hostname;
    } catch {
      host = null;
    }
    if (host === null || !hostAllowed(host, domains)) {
      reporter.add(
        source.position,
        'sources',
        'source-domain',
        `source ${quote(source.url, 80)} must be an https link without a user or port to a domain from content/sources.md: ${domains.join(', ')}`,
      );
    }
  }
}

function checkScene(parsed: ParsedLesson, reporter: Reporter): void {
  const { participants, zones, steps } = parsed.draft;
  const extra = participants[MAX_PARTICIPANTS];
  if (extra !== undefined) {
    reporter.add(
      extra.position,
      'participants',
      'too-many-participants',
      `a lesson has at most ${String(MAX_PARTICIPANTS)} participants: one line of the scene holds no more`,
    );
  }
  const ids = participants.map((p) => p.id);
  const known = ids.join(', ');
  const owner = new Map<string, string>();
  for (const zone of zones) {
    const path = `zones.${zone.id}`;
    const unknown = zone.members.filter((m) => !ids.includes(m));
    for (const m of unknown) {
      reporter.add(
        zone.position,
        path,
        'unknown-participant',
        `zone \`${zone.id}\`: unknown participant \`${quote(m, 32)}\`; known: ${known}`,
      );
    }
    if (unknown.length > 0) continue;
    const places = zone.members.map((m) => ids.indexOf(m)).sort((a, b) => a - b);
    const first = places[0] ?? 0;
    if (places.some((place, i) => place !== first + i)) {
      reporter.add(
        zone.position,
        path,
        'zone-not-contiguous',
        `zone \`${zone.id}\` must hold neighbours in the participants line: participants stand in one line and a zone is one frame`,
      );
    }
    for (const m of zone.members) {
      const other = owner.get(m);
      if (other !== undefined) {
        reporter.add(
          zone.position,
          path,
          'zone-overlap',
          `participant \`${m}\` is already in zone \`${other}\`; zones do not overlap`,
        );
      } else owner.set(m, zone.id);
    }
  }
  for (const step of steps) {
    const path = `steps.${step.id}`;
    for (const end of [step.from, step.to]) {
      if (!ids.includes(end)) {
        reporter.add(
          step.servicePosition,
          path,
          'unknown-participant',
          `step \`${step.id}\`: unknown participant \`${quote(end, 32)}\`; known: ${known}`,
        );
      }
    }
    if (step.stopped && step.mode !== 'with-defence') {
      reporter.add(
        step.servicePosition,
        path,
        'stopped-without-defence',
        `step \`${step.id}\`: \`stopped\` needs \`with-defence\`: only the defence stops a message`,
      );
    }
  }
}

function checkDefence(parsed: ParsedLesson, reporter: Reporter, words: LanguageWords): void {
  if (!isAttackLesson(parsed)) return;
  const { draft, anchors } = parsed;
  if (anchors.sections.steps !== undefined && !draft.steps.some((s) => s.mode === 'with-defence')) {
    reporter.add(
      anchors.sections.steps,
      'steps',
      'no-defence-step',
      'an attack lesson needs at least one `with-defence` step (L4.3)',
    );
  }
  if (anchors.sections.defence === undefined) {
    reporter.add(
      START,
      'defence',
      'no-defence-section',
      `an attack lesson needs the section «${words.sections.defence}» (L4.3)`,
    );
  }
  const missing = [
    draft.passport.defence === null ? '`defence`' : null,
    draft.passport.severity === null ? '`severity`' : null,
  ].filter((x) => x !== null);
  if (missing.length > 0) {
    reporter.add(
      anchors.sections.passport ?? START,
      'passport',
      'no-defence-name',
      `an attack lesson needs ${missing.join(' and ')} in the passport`,
    );
  }
}

function inRanges(index: number, ranges: readonly (readonly [number, number])[]): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/** L4.2 over the whole file, except the links of «Источники», which point at real sites. */
function checkAddresses(
  parsed: ParsedLesson,
  text: string,
  reporter: Reporter,
  locate: (index: number) => { line: number; column: number },
): void {
  const parts: string[] = [];
  let from = 0;
  const ranges = [...parsed.sourceLinkRanges].sort((a, b) => a[0] - b[0]);
  for (const [start, end] of ranges) {
    if (start < from) continue;
    parts.push(text.slice(from, start), ' '.repeat(end - start));
    from = end;
  }
  parts.push(text.slice(from));
  for (const found of findForeignAddresses(parts.join(''))) {
    const message =
      found.kind === 'ip'
        ? `address ${quote(found.value, 45)} is not in a documentation range (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32)`
        : `domain ${quote(found.value, 80)} is not a documentation name (example.com, example.org, example.net, *.example, *.test)`;
    reporter.add(locate(found.index), 'text', 'address', message);
  }
}

/** ⟦…⟧ marks the harmful part of code; elsewhere it is a mistake. */
function checkMarks(
  parsed: ParsedLesson,
  text: string,
  reporter: Reporter,
  locate: (index: number) => { line: number; column: number },
): void {
  let lastLine = 0;
  for (const match of text.matchAll(/[⟦⟧]/g)) {
    if (inRanges(match.index, parsed.codeRanges)) continue;
    const at = locate(match.index);
    if (at.line === lastLine) continue;
    lastLine = at.line;
    reporter.add(at, 'text', 'bad-mark', 'marks ⟦…⟧ are allowed only inside code blocks');
  }
}

export function checkRules(
  parsed: ParsedLesson,
  text: string,
  reporter: Reporter,
  options: { sourceDomains: readonly string[]; words: LanguageWords },
): void {
  checkSources(parsed, reporter, options.sourceDomains);
  checkScene(parsed, reporter);
  checkDefence(parsed, reporter, options.words);
  const locate = createLocator(text);
  checkAddresses(parsed, text, reporter, locate);
  checkMarks(parsed, text, reporter, locate);
}
