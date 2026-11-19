// M4.3: every page the site links has its social card in public/cards/, 1200×630, at most 100 KB,
// drawn from what the lesson says now (title, class, icons) with the site fonts and colours.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readContent, ROOT } from './content-files.mjs';
import { buildLessonData } from './lesson-data';
import {
  CARD_HASH_PREFIX,
  MAX_CARD_BYTES,
  cardIcons,
  cardPalette,
  cardProblem,
  cardSpecs,
  readPng,
} from './cards';
import type { CardSpec } from './cards';

const data = buildLessonData(readContent());
if (!data.ok) throw new Error(data.errors.join('\n'));
const specs = cardSpecs(data, ROOT);

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}
/** A tiny real PNG of the given size with optional text chunks. */
function png(width: number, height: number, texts: Record<string, string> = {}): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  const rows = Buffer.alloc((width + 1) * height);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...Object.entries(texts).map(([k, v]) => chunk('tEXt', Buffer.from(`${k}\0${v}`, 'latin1'))),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('the committed cards', () => {
  it('cover every lesson in every site language and the site card per language', () => {
    const languages = data.locales.languages.map((l) => l.code);
    expect(specs).toHaveLength(data.pages.length + languages.length);
    expect(new Set(specs.map((s) => s.file)).size).toBe(specs.length);
  });

  it.each(specs.map((s) => [s.file, s] as const))(
    '%s is there, 1200×630, ≤ 100 KB, drawn from the current lesson',
    (_file, spec: CardSpec) => {
      const path = join(ROOT, spec.file);
      expect(cardProblem(spec, existsSync(path) ? readFileSync(path) : null)).toBeNull();
    },
  );

  it('show the lesson title and class and up to three of its icons', () => {
    for (const lesson of data.pages) {
      const spec = specs.find((s) => s.file === `public/cards/${lesson.id}.${lesson.language}.png`);
      expect(spec?.title).toBe(lesson.title);
      expect(spec?.subtitle).toBe(lesson.passport.class ?? '');
      expect(spec?.icons.length).toBeGreaterThan(0);
      expect(spec?.icons.length).toBeLessThanOrEqual(3);
    }
  });

  it('are listed in ATTRIBUTION.md (L1)', () => {
    const attribution = readFileSync(join(ROOT, 'ATTRIBUTION.md'), 'utf8');
    for (const spec of specs) expect(attribution).toContain(`| \`${spec.file}\` |`);
  });
});

describe('cardProblem', () => {
  const spec = specs[0];
  if (spec === undefined) throw new Error('no cards');
  const good = png(1200, 630, { comment: `${CARD_HASH_PREFIX}${spec.hash}` });

  it('accepts a card of the right size with the hash of its spec', () => {
    expect(cardProblem(spec, good)).toBeNull();
  });

  it('names a missing, broken, wrong-sized, stale or heavy card and how to fix it', () => {
    expect(cardProblem(spec, null)).toContain('npm run cards');
    expect(cardProblem(spec, Buffer.from('not a png'))).toContain('not a PNG');
    expect(
      cardProblem(spec, png(1200, 600, { comment: `${CARD_HASH_PREFIX}${spec.hash}` })),
    ).toContain('1200×600');
    expect(cardProblem({ ...spec, hash: '0000' }, good)).toContain('npm run cards');
    expect(cardProblem(spec, png(1200, 630))).toContain('npm run cards');
    const heavy = Buffer.concat([
      good.subarray(0, good.length - 12),
      chunk('tEXt', Buffer.alloc(MAX_CARD_BYTES, 65)),
      good.subarray(good.length - 12),
    ]);
    expect(cardProblem(spec, heavy)).toContain(`at most ${String(MAX_CARD_BYTES)}`);
  });

  it('the hash changes with the title, the class or the icons', () => {
    const lesson = data.pages[0];
    if (lesson === undefined) throw new Error('no lessons');
    const base = cardSpecs({ locales: data.locales, pages: [lesson] }, ROOT);
    const changed = [
      { ...lesson, title: `${lesson.title}!` },
      { ...lesson, passport: { ...lesson.passport, class: 'x' } },
      { ...lesson, icons: [...lesson.icons].reverse() },
    ].map((l) => cardSpecs({ locales: data.locales, pages: [l] }, ROOT));
    const hashOf = (list: CardSpec[]) => list.find((s) => s.kind === 'lesson')?.hash;
    for (const list of changed) expect(hashOf(list)).not.toBe(hashOf(base));
  });
});

describe('readPng and the inputs of a card are hostile-proof', () => {
  it('reads nothing from truncated or foreign bytes', () => {
    const good = png(4, 3, { comment: 'x' });
    expect(readPng(good)).toEqual({ width: 4, height: 3, texts: new Map([['comment', 'x']]) });
    expect(readPng(Buffer.alloc(0))).toBeNull();
    expect(readPng(good.subarray(0, 40))).toBeNull();
    expect(readPng(Buffer.from('GIF89a........................................'))).toBeNull();
  });

  it('takes only icon names that are files of content/icons, each once, three at most', () => {
    expect(
      cardIcons(['server', '../../etc/passwd', 'server', 'nope', 'db', 'user', 'mail'], ROOT),
    ).toEqual(['content/icons/server.webp', 'content/icons/db.webp', 'content/icons/user.webp']);
  });

  it('paints with the design tokens and fails loudly without them', () => {
    const tokens = readFileSync(join(ROOT, 'src/ui/tokens.css'), 'utf8');
    expect(cardPalette(tokens)['scene-paper']).toMatch(/^#[0-9a-f]{6}$/);
    expect(() => cardPalette(':root {}')).toThrow('--scene-paper');
  });
});
