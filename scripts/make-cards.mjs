#!/usr/bin/env node
// Draws the social cards (M4.3): `npm run cards` (needs ImageMagick 7, `magick`, on the PATH; not
// part of the gate). One PNG 1200×630 per lesson per site language and a site card per language,
// into public/cards/, from the lesson title, its class (passport `class`), up to three of its
// participant icons, the site fonts (public/fonts/) and colours (src/ui/tokens.css). Only cards
// whose inputs changed are drawn again (`--all` draws every one). Each card carries the hash of its
// inputs (scripts/cards.ts), which the gate checks. Prints the ATTRIBUTION.md rows of new cards.
//
// The site fonts are subsets by script (Cyrillic, Latin), so text is set word by word, each run of
// letters in the subset that has them; both subsets share the metrics, so the runs line up.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;
const LEFT = 72;
const TEXT_WIDTH = 640;
const CYRILLIC = /\p{Script=Cyrillic}/u;

function magick(args) {
  return execFileSync('magick', args, { cwd: ROOT, encoding: 'utf8' });
}

/** A label of one run of text: ImageMagick reads it from a file, so no character is special. */
function runImage(dir, text, font, size, colour, stroke) {
  const name = join(dir, `t${String(runImage.n++)}`);
  writeFileSync(`${name}.txt`, text.replace(/%/g, '%%'));
  magick([
    '-background',
    'none',
    '-fill',
    colour,
    ...(stroke > 0 ? ['-stroke', colour, '-strokewidth', String(stroke)] : []),
    '-font',
    join(ROOT, font),
    '-pointsize',
    String(size),
    `label:@${name}.txt`,
    `PNG32:${name}.png`,
  ]);
  return `${name}.png`;
}
runImage.n = 0;

/** Splits a word into runs of one script: Cyrillic letters, and everything else. */
function runs(word) {
  const out = [];
  for (const ch of word) {
    const cyr = CYRILLIC.test(ch);
    const last = out.at(-1);
    if (last !== undefined && last.cyr === cyr) last.text += ch;
    else out.push({ cyr, text: ch });
  }
  return out;
}

function width(png) {
  return Number(magick(['identify', '-format', '%w', png]));
}
function height(png) {
  return Number(magick(['identify', '-format', '%h', png]));
}

/** One image per word, the runs of a word side by side. */
function wordImage(dir, word, style) {
  const parts = runs(word).map((r) =>
    runImage(
      dir,
      r.text,
      r.cyr ? style.cyrillic : style.latin,
      style.size,
      style.colour,
      style.stroke,
    ),
  );
  if (parts.length === 1) return parts[0];
  const out = join(dir, `w${String(runImage.n++)}.png`);
  magick(['-background', 'none', ...parts, '+append', `PNG32:${out}`]);
  return out;
}

/** Words set into lines no wider than `max`; null when it takes more than `maxLines`. */
function setText(dir, text, style, max, maxLines) {
  const words = text.split(/\s+/).filter((w) => w !== '');
  const space = Math.round(style.size * 0.27);
  const lines = [];
  let line = [];
  let lineWidth = 0;
  for (const word of words) {
    const png = wordImage(dir, word, style);
    const w = width(png);
    if (line.length > 0 && lineWidth + space + w > max) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }
    line.push({ png, w });
    lineWidth += (line.length > 1 ? space : 0) + w;
  }
  if (line.length > 0) lines.push(line);
  if (lines.length > maxLines) return null;
  const lineHeight = Math.round(style.size * style.leading);
  return { lines, space, lineHeight, height: lines.length * lineHeight };
}

/** The largest size from `sizes` at which the text fits. */
function fit(dir, text, style, sizes, max, maxLines) {
  for (const size of sizes) {
    const set = setText(dir, text, { ...style, size }, max, maxLines);
    if (set !== null) return set;
  }
  throw new Error(`text does not fit a card: ${text}`);
}

function place(set, x, y) {
  const args = [];
  set.lines.forEach((line, i) => {
    let at = x;
    for (const word of line) {
      args.push(
        word.png,
        '-geometry',
        `+${String(at)}+${String(y + i * set.lineHeight)}`,
        '-composite',
      );
      at += word.w + set.space;
    }
  });
  return args;
}

function draw(spec, out) {
  const dir = mkdtempSync(join(tmpdir(), 'hacks-card-'));
  try {
    const p = spec.palette;
    const sans = { latin: spec.fonts.sansLatin, cyrillic: spec.fonts.sansCyrillic };
    const brand = setText(
      dir,
      spec.brand.toUpperCase(),
      {
        latin: spec.fonts.monoLatin,
        cyrillic: spec.fonts.monoLatin,
        size: 26,
        colour: p.muted,
        stroke: 0,
        leading: 1.2,
      },
      TEXT_WIDTH,
      1,
    );
    const title = fit(
      dir,
      spec.title,
      { ...sans, colour: p['scene-ink'], stroke: 1.6, leading: 1.12 },
      [76, 68, 60, 54],
      TEXT_WIDTH,
      3,
    );
    const subtitle =
      spec.subtitle.trim() === ''
        ? null
        : fit(
            dir,
            spec.subtitle,
            { ...sans, colour: p.muted, stroke: 0, leading: 1.3 },
            [34, 30, 27],
            TEXT_WIDTH,
            3,
          );
    // The text block sits in the middle of the space between the brand line and the stripe.
    const top = 64 + 26 + 40;
    const bottom = H - 12 - 56;
    const block = title.height + (subtitle === null ? 0 : 28 + subtitle.height);
    const titleY = Math.max(top, Math.round(top + (bottom - top - block) / 2));
    const args = ['-size', `${String(W)}x${String(H)}`, `xc:${p['scene-paper']}`];
    args.push(...place(brand, LEFT, 64));
    args.push(...place(title, LEFT, titleY));
    if (subtitle !== null) args.push(...place(subtitle, LEFT, titleY + title.height + 28));
    // Icons on the right: a large one, then two smaller ones under it.
    const slots = [
      { x: 820, y: 70, w: 300 },
      { x: 770, y: 345, w: 200 },
      { x: 985, y: 345, w: 200 },
    ];
    if (spec.icons.length === 2) {
      slots[0] = { x: 790, y: 90, w: 240 };
      slots[1] = { x: 930, y: 330, w: 240 };
    }
    if (spec.icons.length === 1) slots[0] = { x: 800, y: 130, w: 340 };
    spec.icons.forEach((icon, i) => {
      const slot = slots[i];
      args.push('(', join(ROOT, icon), '-resize', `${String(slot.w)}x`, ')');
      args.push('-geometry', `+${String(slot.x)}+${String(slot.y)}`, '-composite');
    });
    // The stripe at the bottom: the attack, then the defence.
    args.push(
      '-fill',
      p.attack,
      '-draw',
      `rectangle 0,${String(H - 12)} ${String(W / 2 - 1)},${String(H - 1)}`,
    );
    args.push(
      '-fill',
      p.defence,
      '-draw',
      `rectangle ${String(W / 2)},${String(H - 12)} ${String(W - 1)},${String(H - 1)}`,
    );
    args.push(
      '+profile',
      '*',
      '-set',
      'comment',
      `${spec.cardPrefix}${spec.hash}`,
      '-colors',
      '192',
      '-define',
      'png:exclude-chunks=date,time,bKGD,cHRM,gAMA,sRGB,vpAg,zTXt,iTXt',
      '-define',
      'png:compression-level=9',
      `PNG8:${out}`,
    );
    magick(args);
    if (height(out) !== H || width(out) !== W) throw new Error(`${out}: wrong size`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const all = process.argv.includes('--all');
  const { module: data } = await runnerImport('./scripts/lesson-data.ts', {
    root: ROOT,
    configFile: false,
    logLevel: 'error',
  });
  const { module: cards } = await runnerImport('./scripts/cards.ts', {
    root: ROOT,
    configFile: false,
    logLevel: 'error',
  });
  const { readContent } = await import('./content-files.mjs');
  const result = data.buildLessonData(readContent(ROOT));
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
  const specs = cards.cardSpecs(result, ROOT);
  const attribution = readFileSync(join(ROOT, 'ATTRIBUTION.md'), 'utf8');
  let drawn = 0;
  const rows = [];
  for (const spec of specs) {
    const out = join(ROOT, spec.file);
    const bytes = existsSync(out) ? readFileSync(out) : null;
    if (!all && cards.cardProblem(spec, bytes) === null) continue;
    mkdirSync(dirname(out), { recursive: true });
    draw({ ...spec, cardPrefix: cards.CARD_HASH_PREFIX }, out);
    drawn += 1;
    const problem = cards.cardProblem(spec, readFileSync(out));
    console.log(
      `${spec.file}  ${String(statSync(out).size)} bytes${problem === null ? '' : `  ${problem}`}`,
    );
    if (!attribution.includes(`| \`${spec.file}\` |`)) {
      const icons = spec.icons.map((path) => path.replace(/^content\/icons\/|\.webp$/g, ''));
      rows.push(
        `| \`${spec.file}\` | ${spec.title.replace(/\|/g, '/')} | \`npm run cards\`: lesson text, icons ${icons.join(', ')} |`,
      );
    }
  }
  if (rows.length > 0)
    console.log(`\nAdd to ATTRIBUTION.md, section of the cards:\n${rows.join('\n')}`);
  console.log(`${String(drawn)} of ${String(specs.length)} cards drawn`);
}

await main();
