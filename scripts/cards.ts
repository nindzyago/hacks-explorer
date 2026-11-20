// The social cards (M4.3): what each card shows and how to tell that a committed card is out of
// date. The cards are drawn offline by `npm run cards` (scripts/make-cards.mjs, ImageMagick) and
// committed in public/cards/; the build only links them (scripts/site-pages.ts). Each PNG carries
// the hash of everything it was drawn from in a text chunk; the gate (scripts/cards.test.ts)
// recomputes it, so a changed lesson title, icon, font, colour or layout version with an old card
// fails with "run npm run cards".
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT } from '../src/core/project';
import type { PageLesson, SiteLocalesData } from './lesson-data';
import { CARD_HEIGHT, CARD_WIDTH, lessonCardFile, siteCardFile } from './site-pages';

/** Bump when the drawing in make-cards.mjs changes: every card is then drawn again. */
export const CARD_LAYOUT_VERSION = 1;
/** A card is fetched by every link preview; it stays small. */
export const MAX_CARD_BYTES = 100 * 1024;
/** The key of the PNG text chunk that holds the hash. */
export const CARD_HASH_KEY = 'comment';
export const CARD_HASH_PREFIX = 'hacks-explorer-card ';
/** At most this many participant icons on a card. */
export const CARD_ICONS = 3;

/** The fonts a card is drawn with (the site's own, L6): sans by script, and the mono. */
export const CARD_FONTS = {
  sansLatin: 'public/fonts/onest-latin.woff2',
  sansCyrillic: 'public/fonts/onest-cyrillic.woff2',
  monoLatin: 'public/fonts/jetbrains-mono-latin.woff2',
} as const;

/** Token names from src/ui/tokens.css the card is painted with, as `--card-<name>` (M6.1). */
export const CARD_TOKENS = ['scene-paper', 'scene-ink', 'muted', 'attack', 'defence'] as const;
export type CardPalette = Readonly<Record<(typeof CARD_TOKENS)[number], string>>;

export interface CardSpec {
  /** The file in the repository, `public/cards/K1.ru.png`. */
  readonly file: string;
  readonly kind: 'lesson' | 'site';
  readonly lang: string;
  readonly title: string;
  readonly subtitle: string;
  /** The brand line at the top. */
  readonly brand: string;
  /** Icon files in the repository, `content/icons/server.webp`. */
  readonly icons: readonly string[];
  readonly palette: CardPalette;
  readonly fonts: typeof CARD_FONTS;
  readonly hash: string;
}

/** The colours of the card, read from the design tokens (no colour lives in two places). */
export function cardPalette(tokensCss: string): CardPalette {
  const get = (name: (typeof CARD_TOKENS)[number]): string => {
    const match = new RegExp(`--card-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(tokensCss);
    if (match?.[1] === undefined) {
      throw new Error(`src/ui/tokens.css: no colour --card-${name} for the cards (M4.3)`);
    }
    return match[1].toLowerCase();
  };
  return {
    'scene-paper': get('scene-paper'),
    'scene-ink': get('scene-ink'),
    muted: get('muted'),
    attack: get('attack'),
    defence: get('defence'),
  };
}

function sha(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The icons a card shows: the lesson's participants' icons that exist, in order, at most three. */
export function cardIcons(icons: readonly string[], root: string): string[] {
  return [...new Set(icons)]
    .filter((name) => /^[a-z][a-z0-9-]*$/.test(name))
    .map((name) => `content/icons/${name}.webp`)
    .filter((path) => existsSync(join(root, path)))
    .slice(0, CARD_ICONS);
}

/**
 * Every card the site links: one per lesson per site language, and the site card per language
 * (the page «About» and the home address).
 */
export function cardSpecs(
  data: { readonly locales: SiteLocalesData; readonly pages: readonly PageLesson[] },
  root: string,
): CardSpec[] {
  const palette = cardPalette(readFileSync(join(root, 'src/ui/tokens.css'), 'utf8'));
  const fontHashes = Object.values(CARD_FONTS).map((path) => sha(readFileSync(join(root, path))));
  const spec = (s: Omit<CardSpec, 'hash' | 'palette' | 'fonts' | 'brand'>): CardSpec => {
    const full = { ...s, brand: PROJECT.name, palette, fonts: CARD_FONTS };
    const hash = sha(
      JSON.stringify({
        layout: CARD_LAYOUT_VERSION,
        size: [CARD_WIDTH, CARD_HEIGHT],
        kind: full.kind,
        lang: full.lang,
        title: full.title,
        subtitle: full.subtitle,
        brand: full.brand,
        icons: full.icons.map((path) => sha(readFileSync(join(root, path)))),
        palette,
        fonts: fontHashes,
      }),
    ).slice(0, 16);
    return { ...full, hash };
  };
  const sorted = [...data.pages].sort((a, b) => a.id.localeCompare(b.id));
  const cards: CardSpec[] = [];
  for (const { code: lang } of data.locales.languages) {
    const strings = data.locales.strings[lang] ?? {};
    const own = sorted.filter((l) => l.language === lang);
    cards.push(
      spec({
        file: `public/${siteCardFile(lang)}`,
        kind: 'site',
        lang,
        title: PROJECT.name,
        subtitle: strings['app.tagline'] ?? '',
        icons: cardIcons(
          own.flatMap((l) => l.icons),
          root,
        ),
      }),
    );
    for (const lesson of own) {
      cards.push(
        spec({
          file: `public/${lessonCardFile(lesson.id, lang)}`,
          kind: 'lesson',
          lang,
          title: lesson.title,
          subtitle: lesson.passport.class ?? '',
          icons: cardIcons(lesson.icons, root),
        }),
      );
    }
  }
  return cards;
}

export interface PngInfo {
  readonly width: number;
  readonly height: number;
  /** tEXt chunks, keyword → text. */
  readonly texts: ReadonlyMap<string, string>;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads the size and the text chunks of a PNG; null for anything that is not one. */
export function readPng(bytes: Buffer): PngInfo | null {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const texts = new Map<string, string>();
  let at = 8;
  let ended = false;
  while (at + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const end = at + 12 + length;
    if (end > bytes.length) return null;
    if (type === 'tEXt') {
      const data = bytes.subarray(at + 8, at + 8 + length);
      const zero = data.indexOf(0);
      if (zero > 0) texts.set(data.toString('latin1', 0, zero), data.toString('latin1', zero + 1));
    }
    if (type === 'IEND') {
      ended = true;
      break;
    }
    at = end;
  }
  // A cut file has no IEND: it is not a card, whatever its header says.
  return ended ? { width, height, texts } : null;
}

/** Why a committed card does not fit its spec, or null when it does. */
export function cardProblem(spec: CardSpec, bytes: Buffer | null): string | null {
  const fix = 'run `npm run cards` and commit public/cards/ (M4.3)';
  if (bytes === null) return `${spec.file}: no card; ${fix}`;
  const png = readPng(bytes);
  if (png === null) return `${spec.file}: not a PNG; ${fix}`;
  if (png.width !== CARD_WIDTH || png.height !== CARD_HEIGHT) {
    return `${spec.file}: ${String(png.width)}×${String(png.height)}, must be ${String(CARD_WIDTH)}×${String(CARD_HEIGHT)}; ${fix}`;
  }
  if (bytes.length > MAX_CARD_BYTES) {
    return `${spec.file}: ${String(bytes.length)} bytes, at most ${String(MAX_CARD_BYTES)}`;
  }
  if (png.texts.get(CARD_HASH_KEY) !== `${CARD_HASH_PREFIX}${spec.hash}`) {
    return `${spec.file}: drawn from other text, icons or layout than the lesson has now; ${fix}`;
  }
  return null;
}
