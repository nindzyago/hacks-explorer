// M1.2a, oracle level D (design M1.2 §5 «Раскладка», «Телефон»): participants stand in one line
// in the listed order, zones are rectangles around their members, and at 760 and 390 px nothing
// leaves the scene or overlaps; icons shrink on a narrow scene, text stays at least 11 px.
import { describe, expect, it } from 'vitest';
import {
  layoutScene,
  MIN_FONT_SIZE,
  MIN_WIDTH,
  MAX_WIDTH,
  type Rect,
  type SceneInput,
  type SceneLayout,
} from './layout';

const B1: SceneInput = {
  participants: [
    { id: 'attacker', name: 'Атакующий', note: '203.0.113.66' },
    { id: 'server', name: 'Веб-сервер', note: '198.51.100.10' },
    { id: 'db', name: 'База данных', note: 'таблица users' },
  ],
  zones: [
    { id: 'internet', label: 'Интернет', members: ['attacker'], danger: false },
    { id: 'site', label: 'Сайт shop.example', members: ['server', 'db'], danger: false },
  ],
};

const I1: SceneInput = {
  participants: [
    { id: 'attacker', name: 'Атакующий', note: '203.0.113.66' },
    { id: 'user', name: 'Сотрудник', note: '192.0.2.24' },
    { id: 'fake', name: 'Поддельная страница', note: 'bank-login.example' },
    { id: 'bank', name: 'Банк', note: 'bank.example' },
  ],
  zones: [
    { id: 'internet', label: 'Интернет', members: ['attacker'], danger: false },
    { id: 'office', label: 'Офис', members: ['user'], danger: false },
    { id: 'forgery', label: 'Подделка', members: ['fake'], danger: true },
    { id: 'bank-site', label: 'Банк', members: ['bank'], danger: false },
  ],
};

/** Six participants (the most a lesson may have, K19) with long names and notes. */
const SIX: SceneInput = {
  participants: [
    { id: 'a', name: 'Атакующий', note: '203.0.113.66' },
    { id: 'b', name: 'Почтовый сервер компании', note: 'mail.corp.example' },
    { id: 'c', name: 'Сотрудник', note: '192.0.2.24' },
    { id: 'd', name: 'Поддельная страница', note: 'bank-login.example' },
    { id: 'e', name: 'Внутренняя база данных', note: 'таблица users и таблица orders' },
    { id: 'f', name: 'Банк', note: '' },
  ],
  zones: [
    { id: 'net', label: 'Интернет', members: ['a'], danger: false },
    { id: 'corp', label: 'Внутренняя сеть компании', members: ['b', 'c'], danger: false },
    { id: 'forgery', label: 'Подделка', members: ['d'], danger: true },
    { id: 'inside', label: 'Хранилище', members: ['e', 'f'], danger: false },
  ],
};

const inside = (r: Rect, outer: Rect) =>
  r.x >= outer.x - 1e-6 &&
  r.y >= outer.y - 1e-6 &&
  r.x + r.width <= outer.x + outer.width + 1e-6 &&
  r.y + r.height <= outer.y + outer.height + 1e-6;

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Every box a participant draws: icon, name, note. */
function participantBoxes(layout: SceneLayout): { owner: string; what: string; box: Rect }[] {
  return layout.participants.flatMap((p) => [
    { owner: p.id, what: 'icon', box: p.icon },
    { owner: p.id, what: 'name', box: p.name.box },
    ...(p.note === null ? [] : [{ owner: p.id, what: 'note', box: p.note.box }]),
  ]);
}

function problems(layout: SceneLayout): string[] {
  const out: string[] = [];
  const scene: Rect = { x: 0, y: 0, width: layout.width, height: layout.height };
  const boxes = [
    ...participantBoxes(layout),
    ...layout.zones.map((z) => ({ owner: z.id, what: 'zone label', box: z.label.box })),
  ];
  for (const b of boxes) {
    if (!inside(b.box, scene)) out.push(`${b.owner} ${b.what} leaves the scene`);
  }
  for (const z of layout.zones) {
    if (!inside(z.rect, scene)) out.push(`zone ${z.id} leaves the scene`);
    if (!inside(z.label.box, z.rect)) out.push(`zone ${z.id} label leaves its frame`);
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a === undefined || b === undefined) continue;
      if (overlap(a.box, b.box)) out.push(`${a.owner} ${a.what} overlaps ${b.owner} ${b.what}`);
    }
  }
  for (let i = 0; i < layout.zones.length; i += 1) {
    for (let j = i + 1; j < layout.zones.length; j += 1) {
      const a = layout.zones[i];
      const b = layout.zones[j];
      if (a !== undefined && b !== undefined && overlap(a.rect, b.rect)) {
        out.push(`zone ${a.id} overlaps zone ${b.id}`);
      }
    }
  }
  return out;
}

function fontSizes(layout: SceneLayout): number[] {
  return [
    ...layout.participants.flatMap((p) => [p.name.fontSize, p.note?.fontSize ?? MIN_FONT_SIZE]),
    ...layout.zones.map((z) => z.label.fontSize),
  ];
}

describe('layoutScene', () => {
  for (const [name, input] of [
    ['B1', B1],
    ['I1', I1],
    ['six participants with long labels', SIX],
  ] as const) {
    for (const width of [760, 390]) {
      it(`${name} at ${String(width)} px: nothing leaves the scene or overlaps`, () => {
        const layout = layoutScene({ ...input, width });
        expect(layout.width).toBe(width);
        expect(problems(layout)).toEqual([]);
        expect(Math.min(...fontSizes(layout))).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      });
    }
  }

  it('puts participants in one line in the listed order', () => {
    const layout = layoutScene({ ...I1, width: 760 });
    expect(layout.participants.map((p) => p.id)).toEqual(['attacker', 'user', 'fake', 'bank']);
    const xs = layout.participants.map((p) => p.cx);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(new Set(layout.participants.map((p) => p.icon.y)).size).toBe(1);
    // Evenly spaced.
    const gaps = xs.slice(1).map((x, i) => x - (xs[i] ?? 0));
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0] ?? 0, 6);
  });

  it('draws a zone around exactly its members', () => {
    const layout = layoutScene({ ...B1, width: 760 });
    const site = layout.zones.find((z) => z.id === 'site');
    const internet = layout.zones.find((z) => z.id === 'internet');
    if (site === undefined || internet === undefined) throw new Error('zones missing');
    for (const p of layout.participants) {
      const member = p.id === 'attacker' ? internet : site;
      const other = p.id === 'attacker' ? site : internet;
      for (const box of [p.icon, p.name.box, p.note?.box ?? p.icon]) {
        expect(inside(box, member.rect), `${p.id} inside its zone`).toBe(true);
        expect(overlap(box, other.rect), `${p.id} outside the other zone`).toBe(false);
      }
    }
    expect(site.danger).toBe(false);
    expect(layoutScene({ ...I1, width: 760 }).zones.find((z) => z.id === 'forgery')?.danger).toBe(
      true,
    );
  });

  it('runs the lane from the first participant to the last, between zone labels and icons', () => {
    const layout = layoutScene({ ...B1, width: 760 });
    const first = layout.participants[0];
    const last = layout.participants.at(-1);
    expect(layout.lane.x1).toBe(first?.cx);
    expect(layout.lane.x2).toBe(last?.cx);
    for (const z of layout.zones) {
      expect(layout.lane.y).toBeGreaterThan(z.label.box.y + z.label.box.height);
    }
    for (const p of layout.participants) expect(layout.lane.y).toBeLessThan(p.icon.y);
  });

  it('shrinks icons on a narrow scene and keeps their proportions', () => {
    const wide = layoutScene({ ...B1, width: 760 }).participants[0]?.icon;
    const narrow = layoutScene({ ...B1, width: 390 }).participants[0]?.icon;
    if (wide === undefined || narrow === undefined) throw new Error('no icon');
    expect(wide.width).toBe(150);
    expect(narrow.width).toBeLessThan(wide.width);
    expect(narrow.width).toBeGreaterThanOrEqual(80);
    expect(narrow.height / narrow.width).toBeCloseTo(275 / 310, 6);
  });

  it('wraps a long label instead of shrinking it below 11 px', () => {
    const layout = layoutScene({ ...I1, width: 390 });
    const fake = layout.participants.find((p) => p.id === 'fake');
    expect(fake?.name.lines.map((l) => l.text)).toEqual(['Поддельная', 'страница']);
    expect(fake?.note?.lines.length).toBeGreaterThan(1);
    expect(fake?.note?.lines.map((l) => l.text).join('')).toBe('bank-login.example');
  });

  it('has no note block for an empty note', () => {
    expect(layoutScene({ ...SIX, width: 760 }).participants[5]?.note).toBe(null);
  });

  it('is deterministic', () => {
    expect(layoutScene({ ...SIX, width: 390 })).toEqual(layoutScene({ ...SIX, width: 390 }));
  });

  describe('hostile input', () => {
    it.each([Number.NaN, -5, 0, 10, Number.POSITIVE_INFINITY, 1e9])('width %s is clamped', (w) => {
      const layout = layoutScene({ ...B1, width: w });
      expect(layout.width).toBeGreaterThanOrEqual(MIN_WIDTH);
      expect(layout.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(Number.isFinite(layout.height)).toBe(true);
      expect(problems(layout)).toEqual([]);
    });

    it('lays out no participants as an empty scene', () => {
      const layout = layoutScene({ participants: [], zones: [], width: 390 });
      expect(layout.participants).toEqual([]);
      expect(layout.zones).toEqual([]);
      expect(layout.height).toBeGreaterThan(0);
    });

    it('skips unknown zone members and empty zones', () => {
      const layout = layoutScene({
        participants: B1.participants,
        zones: [
          { id: 'ghost', label: 'Призрак', members: ['nobody'], danger: false },
          { id: 'mixed', label: 'Смесь', members: ['nobody', 'db'], danger: false },
        ],
        width: 760,
      });
      expect(layout.zones.map((z) => z.id)).toEqual(['mixed']);
    });

    it('keeps an absurdly long label inside the scene in at most three lines', () => {
      const long = 'Оченьдлинноеназваниебезпробелов'.repeat(6);
      const layout = layoutScene({
        participants: [
          { id: 'a', name: long, note: long },
          { id: 'b', name: 'B', note: 'b' },
        ],
        zones: [{ id: 'z', label: long, members: ['a'], danger: false }],
        width: 390,
      });
      expect(problems(layout)).toEqual([]);
      const a = layout.participants[0];
      expect(a?.name.lines.length).toBeLessThanOrEqual(3);
      expect(a?.name.lines.at(-1)?.text.endsWith('…')).toBe(true);
      expect(layout.zones[0]?.label.lines.length).toBeLessThanOrEqual(3);
    });
  });
});
