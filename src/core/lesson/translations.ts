/**
 * K21: a translation has the same service lines as ru.md. Texts differ; ids, routes, kinds,
 * marks, icons, zones and passport codes do not.
 */
import type { Reporter } from './report';
import { START } from './report';
import type { Lesson, Position } from './types';

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function compareTranslation(
  base: Lesson,
  other: Lesson,
  reporter: Reporter,
  where: { header: Position; passport: Position },
): void {
  const differ = (at: Position, path: string, message: string) => {
    reporter.add(at, path, 'translation-mismatch', message);
  };
  const ru = `${base.language}.md`;

  for (const key of ['section', 'wave', 'format'] as const) {
    if (base[key] !== other[key]) {
      differ(
        where.header,
        'header',
        `\`${key}\` is ${String(other[key])} here but ${String(base[key])} in ${ru}`,
      );
    }
  }
  for (const key of ['cwe', 'owasp', 'attack', 'cvss', 'cves', 'severity'] as const) {
    if (!same(base.passport[key], other.passport[key])) {
      differ(where.passport, `passport.${key}`, `passport \`${key}\` differs from ${ru}`);
    }
  }
  for (const key of ['defence', 'class'] as const) {
    if ((base.passport[key] === null) !== (other.passport[key] === null)) {
      differ(
        where.passport,
        `passport.${key}`,
        `passport \`${key}\` is present in only one of this file and ${ru}`,
      );
    }
  }

  const shape = (l: Lesson) =>
    l.participants.map((p) => `${p.id}:${p.icon}${p.term === null ? '' : ` term:${p.term}`}`);
  if (!same(shape(base), shape(other))) {
    differ(
      other.participants[0]?.position ?? START,
      'participants',
      `participants are ${shape(other).join(', ')} here but ${shape(base).join(', ')} in ${ru} (id:icon, in order)`,
    );
  }

  const zoneShape = (l: Lesson) =>
    l.zones.map(
      (z) =>
        `${z.id}[${z.members.join(',')}]${z.danger ? ' danger' : ''}${z.term === null ? '' : ` term:${z.term}`}`,
    );
  if (!same(zoneShape(base), zoneShape(other))) {
    differ(
      other.zones[0]?.position ?? START,
      'zones',
      `zones are ${zoneShape(other).join(', ')} here but ${zoneShape(base).join(', ')} in ${ru}`,
    );
  }

  const baseIds = base.steps.map((s) => s.id);
  const otherIds = other.steps.map((s) => s.id);
  if (!same(baseIds, otherIds)) {
    differ(
      other.steps[0]?.position ?? START,
      'steps',
      `steps are ${otherIds.join(', ')} here but ${baseIds.join(', ')} in ${ru}`,
    );
    return;
  }
  base.steps.forEach((b, i) => {
    const o = other.steps[i];
    if (o === undefined) return;
    const path = `steps.${o.id}`;
    if (b.from !== o.from || b.to !== o.to) {
      differ(
        o.servicePosition,
        path,
        `step \`${o.id}\` goes ${o.from} → ${o.to} here but ${b.from} → ${b.to} in ${ru}`,
      );
    }
    for (const key of ['kind', 'mode', 'stopped', 'icon'] as const) {
      if (b[key] !== o[key]) {
        differ(
          o.servicePosition,
          path,
          `step \`${o.id}\`: ${key} is ${String(o[key])} here but ${String(b[key])} in ${ru}`,
        );
      }
    }
  });

  if ((base.defence === null) !== (other.defence === null)) {
    differ(START, 'defence', `the defence section is present in only one of this file and ${ru}`);
  }
}
