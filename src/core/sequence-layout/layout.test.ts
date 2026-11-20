// M6.2 (design M6 §5): the sequence view's layout — lanes in scene order, one row per step of
// the current course, labels that fit, any width and any data without a throw (L0).
import { describe, expect, it } from 'vitest';
import { checkContent } from '../lesson/check';
import type { Lesson } from '../lesson/types';
import {
  clean,
  currentNumber,
  layoutSequence,
  LABEL_SIZE,
  MAX_ROWS,
  MIN_WIDTH,
  PAD,
  rowPaint,
  rowSign,
  wrap,
  type Box,
  type RowInput,
  type SequenceInput,
  type SequenceLayout,
  type SequenceText,
} from './layout';

const files = import.meta.glob<string>('../../../content/lessons/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const sources = import.meta.glob<string>('../../../content/sources.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const content = checkContent(
  Object.entries(files).map(([path, text]) => ({
    path: path.replace(/^(\.\.\/)+/, ''),
    text,
  })),
  { path: 'content/sources.md', text: Object.values(sources)[0] ?? '' },
);
const LESSONS: readonly Lesson[] = content.lessons;

const say = (_key: 'sequence.row', params?: Readonly<Record<string, string | number>>) =>
  `Step ${String(params?.['number'] ?? '?')} — ${String(params?.['title'] ?? '')}`;

const inMode = (lesson: Lesson, defence: boolean) =>
  lesson.steps.filter(
    (s) => s.mode === 'both' || s.mode === (defence ? 'with-defence' : 'without-defence'),
  );

const inside = (inner: Box, outer: Box, slack = 0.01) =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack;

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const textWidth = (t: SequenceText) =>
  Math.max(0, ...t.lines.map((l) => Array.from(l.text).length * t.fontSize * 0.6));

/** Every invariant the view relies on, for any layout. */
function valid(layout: SequenceLayout, label: string): void {
  const view = { x: 0, y: 0, width: layout.width, height: layout.height };
  expect(Number.isFinite(layout.width) && Number.isFinite(layout.height), label).toBe(true);
  for (const lane of layout.lanes) {
    expect(inside(lane.iconBox, view), `${label} icon ${lane.id}`).toBe(true);
    expect(lane.iconBox.y + lane.iconBox.height, label).toBeLessThan(layout.lifelineTop);
  }
  let last = layout.lifelineTop;
  for (const row of layout.rows) {
    const where = `${label} row ${String(row.number)}`;
    expect(row.band.y, `${where} below the one before`).toBeGreaterThanOrEqual(last - 0.01);
    last = row.band.y + row.band.height;
    expect(inside(row.band, view), `${where} band`).toBe(true);
    expect(inside(row.labelBox, row.band), `${where} label box in band`).toBe(true);
    expect(inside(row.separator.box, row.band), `${where} separator in band`).toBe(true);
    expect(overlap(row.separator.box, row.labelBox), `${where} separator over label`).toBe(false);
    expect(row.labelBox.x, where).toBeGreaterThanOrEqual(PAD - 0.01);
    expect(row.labelBox.x + row.labelBox.width, where).toBeLessThanOrEqual(
      layout.width - PAD + 0.01,
    );
    // The lines fit the box they are drawn in.
    expect(row.label.x + textWidth(row.label), where).toBeLessThanOrEqual(
      row.labelBox.x + row.labelBox.width + 0.01,
    );
    for (const l of row.label.lines) {
      expect(l.y, where).toBeLessThan(row.labelBox.y + row.labelBox.height);
    }
    if (row.shape === 'arrow') {
      expect(row.y, `${where} arrow under its label`).toBeGreaterThan(
        row.labelBox.y + row.labelBox.height,
      );
      expect(row.y, where).toBeLessThan(row.band.y + row.band.height);
    }
  }
  expect(layout.lifelineBottom).toBeGreaterThanOrEqual(last);
  expect(layout.lifelineBottom).toBeLessThanOrEqual(layout.height);
}

describe('every lesson in content/lessons', () => {
  it('is there, all ten of them in two languages', () => {
    expect(content.errors).toEqual([]);
    expect(LESSONS.length).toBeGreaterThanOrEqual(20);
  });

  for (const width of [320, 366, 760, 1000]) {
    it(`gives one valid row per step of each course at ${String(width)} px`, () => {
      for (const lesson of LESSONS) {
        for (const defence of [false, true]) {
          const steps = inMode(lesson, defence);
          for (const step of [1, Math.ceil(steps.length / 2), steps.length]) {
            const label = `${lesson.id} ${lesson.language} ${defence ? 'with' : 'without'} #${String(step)}`;
            const layout = layoutSequence(
              { participants: lesson.participants, steps: lesson.steps, defence, step, width },
              say,
            );
            expect(
              layout.rows.map((r) => r.stepId),
              label,
            ).toEqual(steps.map((s) => s.id));
            expect(
              layout.lanes.map((l) => l.id),
              label,
            ).toEqual(lesson.participants.map((p) => p.id));
            expect(layout.current, label).toBe(step);
            expect(
              layout.rows.map((r) => r.state),
              label,
            ).toEqual(
              steps.map((_, i) => (i + 1 < step ? 'past' : i + 1 === step ? 'current' : 'future')),
            );
            for (const row of layout.rows) {
              const s = steps[row.number - 1];
              expect(row.shape, label).toBe(s !== undefined && s.from !== s.to ? 'arrow' : 'note');
              expect(row.paint, label).toBe(s?.stopped === true ? 'stopped' : s?.kind);
            }
            valid(layout, label);
          }
        }
      }
    });
  }

  it('cuts no label, name or separator of a lesson at a laptop width', () => {
    for (const lesson of LESSONS) {
      for (const defence of [false, true]) {
        const layout = layoutSequence(
          { participants: lesson.participants, steps: lesson.steps, defence, step: 1, width: 760 },
          say,
        );
        const cut = [
          ...layout.rows.flatMap((r) => [r.label, r.separator]),
          ...layout.lanes.flatMap((l) => (l.note === null ? [l.name] : [l.name, l.note])),
        ].filter((t) => t.cut);
        expect(
          cut.map((t) => t.full),
          `${lesson.id} ${lesson.language}`,
        ).toEqual([]);
      }
    }
  });

  it('cuts no message label of a lesson at a phone width (366 px)', () => {
    for (const lesson of LESSONS) {
      for (const defence of [false, true]) {
        const layout = layoutSequence(
          { participants: lesson.participants, steps: lesson.steps, defence, step: 1, width: 366 },
          say,
        );
        expect(
          layout.rows.filter((r) => r.label.cut || r.separator.cut).map((r) => r.label.full),
          `${lesson.id} ${lesson.language}`,
        ).toEqual([]);
      }
    }
  });
});

const lanes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${String(i)}`,
    name: `Name ${String(i)}`,
    note: i % 2 === 0 ? `192.0.2.${String(i)}` : '',
    icon: 'server',
  }));

const step = (over: Partial<RowInput> = {}): RowInput => ({
  id: 's',
  title: 'Title',
  from: 'p0',
  to: 'p1',
  kind: 'legit',
  mode: 'both',
  stopped: false,
  message: 'GET /',
  ...over,
});

const base: SequenceInput = {
  participants: lanes(3),
  steps: [
    step({ id: 'a' }),
    step({ id: 'b', from: 'p1', to: 'p0', kind: 'attack' }),
    step({ id: 'c', from: 'p2', to: 'p2', kind: 'safe' }),
    step({ id: 'd', mode: 'with-defence', stopped: true, kind: 'attack', to: 'p2' }),
    step({ id: 'e', mode: 'without-defence' }),
  ],
  defence: false,
  step: 2,
  width: 600,
};

describe('rows', () => {
  it('follow the course: the defence swaps the steps of its mode', () => {
    expect(layoutSequence(base, say).rows.map((r) => r.stepId)).toEqual(['a', 'b', 'c', 'e']);
    expect(layoutSequence({ ...base, defence: true }, say).rows.map((r) => r.stepId)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('point the way of the message, a step to itself is a note on its lane', () => {
    const [a, b, c] = layoutSequence(base, say).rows;
    expect(a?.x2).toBeGreaterThan(a?.x1 ?? 0);
    expect(b?.x2).toBeLessThan(b?.x1 ?? 0);
    expect(c).toMatchObject({ shape: 'note' });
    expect(c?.x1).toBe(c?.x2);
    expect(c?.x1).toBe(layoutSequence(base, say).lanes[2]?.x);
  });

  it('a stopped step is green on arrival, its kind on the way', () => {
    const d = layoutSequence({ ...base, defence: true }, say).rows[3];
    expect(d).toMatchObject({ stopped: true, paint: 'stopped', kind: 'attack' });
    if (d === undefined) throw new Error('no row');
    expect(rowPaint(d, false)).toBe('attack');
    expect(rowPaint(d, true)).toBe('stopped');
    expect(rowSign(d, false)).toBe('attack');
    expect(rowSign(d, true)).toBe('stopped');
  });

  it('signs double the colour', () => {
    const rows = layoutSequence(base, say).rows;
    expect(rows.map((r) => rowSign(r, true))).toEqual(['right', 'attack', 'safe', 'right']);
    expect(rowSign({ kind: 'legit', stopped: false, shape: 'note', x1: 5, x2: 5 }, true)).toBe(
      'here',
    );
    expect(rowSign({ kind: 'legit', stopped: false, shape: 'arrow', x1: 9, x2: 5 }, true)).toBe(
      'left',
    );
  });

  it('the separator says the step number and title through `say`', () => {
    const rows = layoutSequence(base, say).rows;
    expect(rows[1]?.separator.full).toBe('Step 2 — Title');
  });

  it('marks the past, the current and the future', () => {
    expect(layoutSequence(base, say).rows.map((r) => r.state)).toEqual([
      'past',
      'current',
      'future',
      'future',
    ]);
  });
});

describe('long text', () => {
  it('wraps at spaces, breaks a word longer than a line, cuts past the last line', () => {
    expect(wrap('aa bb cc', 5, 3)).toEqual({ lines: ['aa bb', 'cc'], cut: false });
    expect(wrap('abcdefghij', 4, 3)).toEqual({ lines: ['abcd', 'efgh', 'ij'], cut: false });
    expect(wrap('a b c d e f g h', 3, 2)).toEqual({ lines: ['a b', 'c …'], cut: true });
    expect(wrap('bank-login.example', 12, 3)).toEqual({
      lines: ['bank-login.', 'example'],
      cut: false,
    });
    expect(wrap('', 5, 2)).toEqual({ lines: [], cut: false });
    expect(wrap('abc', 0, 0)).toEqual({ lines: ['…'], cut: true });
  });

  it('a long label keeps its full text and stays inside the view', () => {
    const message = 'SELECT * FROM users WHERE login = admin AND 1=1 '.repeat(20);
    const layout = layoutSequence({ ...base, steps: [step({ message })], width: 320 }, say);
    const row = layout.rows[0];
    expect(row?.label.cut).toBe(true);
    expect(row?.label.full).toBe(clean(message));
    expect(row?.label.lines.length).toBe(3);
    expect(row?.label.lines.at(-1)?.text.endsWith('…')).toBe(true);
    valid(layout, 'long');
  });

  it('a long name or note wraps into two lines, then is cut', () => {
    const layout = layoutSequence(
      {
        ...base,
        participants: [{ id: 'p0', name: 'W'.repeat(300), note: 'n '.repeat(300), icon: 'x' }],
        width: 320,
      },
      say,
    );
    const lane = layout.lanes[0];
    expect(lane?.name.lines.length).toBe(2);
    expect(lane?.name.cut).toBe(true);
    expect(lane?.note?.cut).toBe(true);
    expect(lane?.name.box.width).toBeLessThanOrEqual(320 - 2 * PAD);
    valid(layout, 'names');
  });

  it('labels are 11 px or more', () => {
    expect(LABEL_SIZE).toBeGreaterThanOrEqual(11);
  });
});

describe('hostile input (L0)', () => {
  it.each([
    ['no participants', { participants: [] }],
    ['no steps', { steps: [] }],
    ['NaN width', { width: Number.NaN }],
    ['negative width', { width: -50 }],
    ['infinite width', { width: Number.POSITIVE_INFINITY }],
    ['huge width', { width: 1e9 }],
    ['NaN step', { step: Number.NaN }],
    ['step past the end', { step: 999 }],
    ['negative step', { step: -3 }],
    ['fraction step', { step: 2.7 }],
    ['infinite step', { step: Number.POSITIVE_INFINITY }],
    ['unknown sender and receiver', { steps: [step({ from: 'zz', to: 'yy' })] }],
    ['unknown receiver', { steps: [step({ to: 'yy' })] }],
    ['unknown sender', { steps: [step({ from: 'yy' })] }],
    ['repeated participant ids', { participants: [...lanes(2), ...lanes(2)] }],
    ['the most participants of the format', { participants: lanes(6) }],
    ['far more participants than the format allows', { participants: lanes(60) }],
    [
      'empty texts',
      {
        participants: [{ id: 'p0', name: '', note: '', icon: '' }],
        steps: [step({ title: '', message: '' })],
      },
    ],
    ['control characters', { steps: [step({ message: 'a\u0000b\nc d\te', title: '\u0007' })] }],
    ['many steps', { steps: Array.from({ length: 500 }, (_, i) => step({ id: `s${String(i)}` })) }],
    ['not arrays', { participants: null, steps: 'x' } as unknown as Partial<SequenceInput>],
  ])('%s: lays out without a throw, every box inside the view', (_name, over) => {
    const layout = layoutSequence({ ...base, ...over }, say);
    valid(layout, _name);
    expect(layout.width).toBeGreaterThanOrEqual(MIN_WIDTH);
    expect(layout.rows.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(JSON.parse(JSON.stringify(layout))).toEqual(layout);
  });

  it('an unknown lane makes a note on the lane it has, or in the middle', () => {
    const layout = layoutSequence(
      {
        ...base,
        steps: [step({ to: 'yy' }), step({ from: 'zz', to: 'p2' }), step({ from: 'a', to: 'b' })],
      },
      say,
    );
    const [one, two, three] = layout.rows;
    expect(one).toMatchObject({ shape: 'note', x1: layout.lanes[0]?.x });
    expect(two).toMatchObject({ shape: 'note', x1: layout.lanes[2]?.x });
    expect(three).toMatchObject({ shape: 'note', x1: layout.width / 2 });
  });

  it('the current step follows the player rules', () => {
    expect(currentNumber(0, 5)).toBe(1);
    expect(currentNumber(9, 5)).toBe(5);
    expect(currentNumber(2.9, 5)).toBe(2);
    expect(currentNumber(Number.NaN, 5)).toBe(1);
    expect(currentNumber(3, 0)).toBe(0);
  });

  it('is the same for the same input', () => {
    expect(layoutSequence(base, say)).toEqual(layoutSequence(base, say));
  });
});
