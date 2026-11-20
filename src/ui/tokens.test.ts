// M1.2a, oracle level B (style guide R9): the tokens hold the light palette of the style guide,
// and every pair of tokens used as text on a background has a contrast of at least 4.5:1
// (WCAG 2.x relative luminance).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8');

/** Custom properties of the file, `var(--x)` resolved. */
function tokens(text: string): Map<string, string> {
  const raw = new Map<string, string>();
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) raw.set(name, value.trim());
  }
  const resolve = (value: string, depth = 0): string => {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (ref?.[1] === undefined || depth > 8) return value;
    return resolve(raw.get(ref[1]) ?? value, depth + 1);
  };
  return new Map([...raw].map(([name, value]) => [name, resolve(value)]));
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match?.[1] === undefined) throw new Error(`not a #rrggbb colour: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const t = tokens(css);
const colour = (name: string): string => {
  const value = t.get(name);
  if (value === undefined) throw new Error(`no token ${name}`);
  return value;
};

describe('tokens', () => {
  it('hold the light palette of the style guide', () => {
    expect({
      paper: colour('--paper'),
      panel: colour('--panel'),
      ink: colour('--ink'),
      muted: colour('--muted'),
      line: colour('--line'),
      attack: colour('--attack'),
      defence: colour('--defence'),
      legit: colour('--legit'),
      caution: colour('--caution'),
    }).toEqual({
      paper: '#f3f5f7',
      panel: '#ffffff',
      ink: '#15212c',
      muted: '#5e6c7a',
      line: '#c7d0d9',
      attack: '#d8432b',
      defence: '#0b8a78',
      legit: '#2b67d6',
      caution: '#b97a00',
    });
  });

  it('have no dark theme yet (K43)', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).not.toMatch(/data-theme|prefers-color-scheme/);
  });

  // Text token on background token. Add a pair whenever a new token becomes text.
  const TEXT_PAIRS: readonly (readonly [string, string])[] = [
    ['--ink', '--paper'],
    ['--ink', '--panel'],
    ['--muted', '--paper'],
    ['--muted', '--panel'],
    ['--legit', '--panel'],
    ['--legit', '--paper'],
    ['--scene-ink', '--scene-paper'],
    ['--scene-muted', '--scene-paper'],
    ['--scene-attack-text', '--scene-paper'],
    ['--scene-ink', '--scene-placeholder'],
    // M1.2b: plaque text on each kind, and the word above a message on the scene paper.
    ['--scene-message-text', '--scene-message-attack'],
    ['--scene-message-text', '--scene-message-safe'],
    ['--scene-message-text', '--scene-message-legit'],
    ['--scene-message-attack', '--scene-paper'],
    ['--scene-message-safe', '--scene-paper'],
    ['--scene-message-legit', '--scene-paper'],
    // M1.2d: a stopped message is green, its word on the paper and its label on the plaque.
    ['--scene-message-text', '--scene-message-stopped'],
    ['--scene-message-stopped', '--scene-paper'],
    // M6.2: the sequence view — names, separators and steps yet to come on its paper, the
    // separator of the current step on its band, labels in the colour of their kind on the
    // paper and white on a filled label of the current step.
    ['--seq-ink', '--seq-paper'],
    ['--seq-muted', '--seq-paper'],
    ['--seq-ink', '--seq-band'],
    ['--scene-message-attack', '--seq-paper'],
    ['--scene-message-safe', '--seq-paper'],
    ['--scene-message-legit', '--seq-paper'],
    ['--scene-message-stopped', '--seq-paper'],
    // M1.3: the «Ход атаки» table — white numbers on a later step (muted), results in the
    // colour of their kind on the panel and on the current row (paper).
    ['--scene-message-text', '--muted'],
    ['--scene-message-attack', '--panel'],
    ['--scene-message-attack', '--paper'],
    ['--scene-message-safe', '--panel'],
    ['--scene-message-safe', '--paper'],
    ['--panel', '--ink'],
    // M1.5: the event feed — marks in the colour of their kind on the panel and on the current
    // line (paper); the pressed «С защитой» button and the defence name.
    ['--scene-message-legit', '--panel'],
    ['--scene-message-legit', '--paper'],
    ['--scene-message-stopped', '--panel'],
    ['--scene-message-stopped', '--paper'],
    // M1.4: lesson code and its harmful part, and links of the sources.
    ['--code-ink', '--code-paper'],
    ['--code-mark', '--code-paper'],
    ['--code-mark', '--panel'],
  ];

  it('paint a stopped message in the defence green, never in red (M1.2d)', () => {
    expect(colour('--scene-message-stopped')).toBe(colour('--scene-message-safe'));
    expect(colour('--scene-message-stopped')).not.toBe(colour('--scene-message-attack'));
  });

  it.each(TEXT_PAIRS)('%s on %s has a contrast of at least 4.5:1', (fg, bg) => {
    expect(contrast(colour(fg), colour(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('measures contrast the WCAG way', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    // The red of the style guide is too light for small text on the scene paper: hence
    // --scene-attack-text.
    expect(contrast(colour('--scene-attack'), colour('--scene-paper'))).toBeLessThan(4.5);
  });

  it('give the smallest text 11 px', () => {
    expect(t.get('--text-xs')).toBe('0.6875rem');
  });
});
