// M1.2b, oracle levels A and D (design M1.2 E2, E8, D3 a; scenarios S2, S11): where the message
// of the current step stands at a moment of the player clock, what it looks like, and which
// step is current in each mode.
import { describe, expect, it } from 'vitest';
import { sayFromFile } from '../i18n/testing';
import { layoutScene, MIN_SQUEEZE, type Rect, type SceneInput, type SceneLayout } from './layout';
import {
  currentStep,
  layoutMessage,
  MESSAGE_FONT_SIZE,
  MESSAGE_HEIGHT,
  stepsInMode,
  TOKEN_RADIUS,
  travelProgress,
  TRAVEL_MS,
  type StepInput,
} from './message';

const say = sayFromFile('ru');

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

const step = (over: Partial<StepInput> & Pick<StepInput, 'id'>): StepInput => ({
  title: over.id,
  from: 'attacker',
  to: 'server',
  kind: 'legit',
  mode: 'both',
  stopped: false,
  icon: null,
  message: 'GET /login',
  ...over,
});

/** The steps of B1 as the lesson file has them. */
const B1_STEPS: readonly StepInput[] = [
  step({ id: 'form' }),
  step({ id: 'trick', kind: 'attack', message: "admin' --" }),
  step({ id: 'glue', from: 'server', to: 'db', kind: 'attack', mode: 'without-defence' }),
  step({ id: 'answer', from: 'db', to: 'server', kind: 'attack', mode: 'without-defence' }),
  step({ id: 'enter', from: 'server', to: 'attacker', kind: 'attack', mode: 'without-defence' }),
  step({
    id: 'param',
    from: 'server',
    to: 'db',
    kind: 'attack',
    mode: 'with-defence',
    stopped: true,
    message: "параметр: admin' --",
  }),
  step({ id: 'empty', from: 'db', to: 'server', kind: 'safe', mode: 'with-defence' }),
  step({
    id: 'refuse',
    from: 'server',
    to: 'attacker',
    kind: 'safe',
    mode: 'with-defence',
    message: 'Неверный вход',
  }),
];

const scene = layoutScene({ ...B1, width: 760 });
const cx = (id: string) => scene.participants.find((p) => p.id === id)?.cx ?? Number.NaN;

describe('stepsInMode and currentStep', () => {
  it('take the shared steps and the steps of the mode, in lesson order (K20)', () => {
    expect(stepsInMode(B1_STEPS, false).map((s) => s.id)).toEqual([
      'form',
      'trick',
      'glue',
      'answer',
      'enter',
    ]);
    expect(stepsInMode(B1_STEPS, true).map((s) => s.id)).toEqual([
      'form',
      'trick',
      'param',
      'empty',
      'refuse',
    ]);
  });

  it('number steps from 1 and keep a number past the end at the last step', () => {
    expect(currentStep(B1_STEPS, false, 3)).toMatchObject({ number: 3, count: 5 });
    expect(currentStep(B1_STEPS, false, 3)?.step.id).toBe('glue');
    expect(currentStep(B1_STEPS, true, 3)?.step.id).toBe('param');
    expect(currentStep(B1_STEPS, true, 99)).toMatchObject({ number: 5, count: 5 });
    expect(currentStep(B1_STEPS, true, 0)).toMatchObject({ number: 1 });
    expect(currentStep(B1_STEPS, true, Number.NaN)).toMatchObject({ number: 1 });
    expect(currentStep(B1_STEPS, true, -4)).toMatchObject({ number: 1 });
    expect(currentStep(B1_STEPS, true, 2.7)).toMatchObject({ number: 2 });
  });

  it('give nothing when the mode has no steps', () => {
    expect(currentStep([step({ id: 'x', mode: 'with-defence' })], false, 1)).toBeNull();
    expect(currentStep([], true, 1)).toBeNull();
  });
});

describe('travelProgress', () => {
  it('eases from 0 to 1 over TRAVEL_MS and is exactly 1/2 in the middle', () => {
    expect(travelProgress(0, false)).toBe(0);
    expect(travelProgress(TRAVEL_MS / 2, false)).toBe(0.5);
    expect(travelProgress(TRAVEL_MS, false)).toBe(1);
    expect(travelProgress(TRAVEL_MS * 10, false)).toBe(1);
    // Slow at the ends, fast in the middle.
    expect(travelProgress(TRAVEL_MS / 4, false)).toBeLessThan(0.25);
    expect(travelProgress((3 * TRAVEL_MS) / 4, false)).toBeGreaterThan(0.75);
  });

  it('is at the target at once with reduced motion (S11)', () => {
    expect(travelProgress(0, true)).toBe(1);
  });

  it('treats time before the step and nonsense as the start', () => {
    expect(travelProgress(-50, false)).toBe(0);
    expect(travelProgress(Number.NaN, false)).toBe(0);
    expect(travelProgress(Number.POSITIVE_INFINITY, false)).toBe(1);
  });
});

describe('layoutMessage', () => {
  const glue = B1_STEPS[2] ?? step({ id: 'missing' });

  it('stands at the middle of the path in the middle of the step (M1.2b acceptance)', () => {
    const m = layoutMessage(scene, glue, TRAVEL_MS / 2, false, say);
    expect(m?.x).toBeCloseTo((cx('server') + cx('db')) / 2, 6);
    expect(m?.y).toBe(scene.lane.y);
    expect(m?.arrived).toBe(false);
    expect(m?.trail).toEqual({ x1: cx('server'), x2: m?.x, y: scene.lane.y });
  });

  it('starts at the sender and ends at the receiver, with a ring around the receiver', () => {
    expect(layoutMessage(scene, glue, 0, false, say)?.x).toBeCloseTo(cx('server'), 6);
    const end = layoutMessage(scene, glue, TRAVEL_MS, false, say);
    expect(end?.x).toBeCloseTo(cx('db'), 6);
    expect(end?.arrived).toBe(true);
    expect(end?.ring).toEqual(scene.participants[2]?.area);
  });

  it('is at the receiver at once with reduced motion (S11)', () => {
    const m = layoutMessage(scene, glue, 0, true, say);
    expect(m?.x).toBeCloseTo(cx('db'), 6);
    expect(m?.arrived).toBe(true);
  });

  it('is the same for the same moment: a pure function', () => {
    expect(layoutMessage(scene, glue, 450, false, say)).toEqual(
      layoutMessage(scene, glue, 450, false, say),
    );
  });

  it('doubles the colour of each kind by a sign and a word (E8)', () => {
    const at = (s: StepInput) => layoutMessage(scene, s, TRAVEL_MS, false, say);
    expect(at(glue)).toMatchObject({ kind: 'attack', sign: 'attack', word: 'вредное' });
    expect(at(step({ id: 's', kind: 'safe' }))).toMatchObject({ sign: 'safe', word: 'безопасное' });
    // A legit message shows its direction.
    expect(at(step({ id: 'r' }))).toMatchObject({ sign: 'right', word: 'обычное' });
    expect(at(step({ id: 'l', from: 'db', to: 'server' }))).toMatchObject({ sign: 'left' });
  });

  it('stops a stopped message at the participant that stopped it, with a shield (D3 a, S2)', () => {
    // B1 with the defence, step 3: the harmful query reaches the database as data.
    const param = currentStep(B1_STEPS, true, 3)?.step ?? step({ id: 'missing' });
    expect(param.id).toBe('param');
    // On the way it is a harmful message like any other; the shield comes where it stops.
    const half = layoutMessage(scene, param, TRAVEL_MS / 2, false, say);
    expect(half).toMatchObject({ kind: 'attack', stopped: false, sign: 'attack', word: 'вредное' });
    expect(half?.x).toBeCloseTo((cx('server') + cx('db')) / 2, 6);
    const end = layoutMessage(scene, param, TRAVEL_MS, false, say);
    expect(end).toMatchObject({ kind: 'attack', stopped: true, sign: 'stopped' });
    expect(end?.word).toBe('остановлено');
    const later = layoutMessage(scene, param, TRAVEL_MS * 20, false, say);
    expect(end?.x).toBeCloseTo(cx('db'), 6);
    // It stays there: nothing travels further down the line.
    expect(later).toEqual(end);
  });

  it('draws a plaque 24 px high whose text fits, cut with «…» on a narrow scene', () => {
    const m = layoutMessage(scene, glue, 0, false, say);
    expect(m?.plaque?.height).toBe(MESSAGE_HEIGHT);
    expect(m?.plaque?.text).toBe('GET /login');
    expect(m?.token).toBeNull();
    const narrow = layoutScene({ ...B1, width: 280 });
    const long = step({ id: 'long', message: 'SELECT * FROM users WHERE login = ? AND hash = ?' });
    const cut = layoutMessage(narrow, long, TRAVEL_MS, false, say);
    expect(cut?.plaque?.cut).toBe(true);
    expect(cut?.plaque?.text.endsWith('…')).toBe(true);
    const width = cut?.plaque?.width ?? Infinity;
    const x = cut?.x ?? Number.NaN;
    expect(x - width / 2).toBeGreaterThanOrEqual(0);
    expect(x + width / 2).toBeLessThanOrEqual(narrow.width);
  });

  it('rests a wide plaque inside the receiver zone on a phone, off the neighbour frame', () => {
    const phone = layoutScene({ ...B1, width: 356 });
    const param = currentStep(B1_STEPS, true, 3)?.step ?? step({ id: 'missing' });
    const m = layoutMessage(phone, param, TRAVEL_MS, false, say);
    const site = phone.zones.find((z) => z.id === 'site')?.rect;
    const w = m?.plaque?.width ?? Infinity;
    expect(w).toBeGreaterThan(phone.participants[2]?.area.width ?? 0);
    expect((m?.x ?? 0) - w / 2).toBeGreaterThanOrEqual(site?.x ?? Infinity);
    expect((m?.x ?? 0) + w / 2).toBeLessThanOrEqual((site?.x ?? 0) + (site?.width ?? 0));
    // At the first participant a plaque wider than its one-column zone stays in the scene.
    const refuse = currentStep(B1_STEPS, true, 5)?.step ?? step({ id: 'missing' });
    const r = layoutMessage(phone, refuse, TRAVEL_MS, false, say);
    expect((r?.x ?? 0) - (r?.plaque?.width ?? 0) / 2).toBeGreaterThanOrEqual(0);
  });

  it('keeps a plaque inside the scene at the first and last participant', () => {
    const long = step({ id: 'edge', from: 'server', to: 'attacker', message: 'x'.repeat(30) });
    const m = layoutMessage(scene, long, TRAVEL_MS, false, say);
    const width = m?.plaque?.width ?? Infinity;
    expect((m?.x ?? 0) - width / 2).toBeGreaterThanOrEqual(0);
  });

  it('draws an icon step as a round token instead of a plaque', () => {
    const mail = step({ id: 'bait', kind: 'attack', icon: 'mail' });
    const m = layoutMessage(scene, mail, 0, false, say);
    expect(m?.plaque).toBeNull();
    expect(m?.token).toEqual({ icon: 'mail', radius: TOKEN_RADIUS });
    expect(m?.sign).toBe('attack');
  });

  it('does not move a step from a participant to itself, and draws no trail', () => {
    const self = step({ id: 'self', from: 'server', to: 'server', kind: 'safe', stopped: true });
    const first = layoutMessage(scene, self, 0, false, say);
    const last = layoutMessage(scene, self, TRAVEL_MS, false, say);
    expect(first?.x).toBeCloseTo(cx('server'), 6);
    expect(first).toEqual(last);
    expect(first?.trail).toBeNull();
    expect(first?.arrived).toBe(true);
    expect(first?.sign).toBe('stopped');
  });

  it('gives nothing for a participant the scene does not have', () => {
    expect(layoutMessage(scene, step({ id: 'g', to: 'ghost' }), 0, false, say)).toBeNull();
  });

  it('leaves room above the lane for the word, below the zone labels', () => {
    const labelBottom = Math.max(...scene.zones.map((z) => z.label.box.y + z.label.box.height));
    const m = layoutMessage(scene, glue, 0, false, say);
    const wordTop = (m?.wordY ?? 0) - 11 * 0.8;
    // M1.2d: at least 10 px of paper, so that the word does not read as a second line of the
    // zone label above it («Подделка» / «вредное» on a phone).
    expect(wordTop - labelBottom).toBeGreaterThanOrEqual(14);
    expect(m?.wordY ?? Infinity).toBeLessThan(scene.lane.y - TOKEN_RADIUS);
  });

  it('stands the word 6 px over the body, so its line box meets no token or plaque (CI1)', () => {
    // The browser's line box of 11 px JetBrains Mono reaches up to 6 px under the baseline
    // (Chromium on Linux, unhinted; 5 on macOS): with the baseline 6 px over the body that box
    // at most touches the token or the plaque, it is never on it.
    const token = step({ id: 'token', icon: 'mail' });
    const tallest = step({ id: 'plaque', message: 'one two three four five six seven eight' });
    for (const s of [glue, token, tallest]) {
      for (const ms of [0, TRAVEL_MS]) {
        const m = layoutMessage(scene, s, ms, false, say);
        if (m === null) throw new Error('no message');
        // The top of what is drawn: the token's circle (its body box also holds the badge
        // room), or the plaque.
        const top = m.token === null ? m.body.y : m.y - TOKEN_RADIUS;
        expect(top - m.wordY, `${s.id} at ${String(ms)}`).toBeGreaterThanOrEqual(6);
      }
    }
  });
});

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

/** The steps of I1 as the lesson file has them. */
const I1_STEPS: readonly StepInput[] = [
  step({ id: 'bait', to: 'user', kind: 'attack', icon: 'mail', message: 'письмо' }),
  step({ id: 'click', from: 'user', to: 'fake', message: 'открыть ссылку' }),
  step({
    id: 'type',
    from: 'user',
    to: 'fake',
    kind: 'attack',
    mode: 'without-defence',
    message: 'логин и пароль',
  }),
  step({
    id: 'steal',
    from: 'fake',
    to: 'attacker',
    kind: 'attack',
    mode: 'without-defence',
    message: 'пароль',
  }),
  step({ id: 'login', to: 'bank', kind: 'attack', mode: 'without-defence', message: 'вход' }),
  step({
    id: 'autofill',
    from: 'user',
    to: 'user',
    kind: 'safe',
    mode: 'with-defence',
    stopped: true,
    message: 'пароль не подставлен',
  }),
  step({
    id: 'leak',
    to: 'bank',
    kind: 'attack',
    mode: 'with-defence',
    stopped: true,
    message: 'чужой пароль',
  }),
  step({
    id: 'second',
    from: 'bank',
    to: 'attacker',
    kind: 'safe',
    mode: 'with-defence',
    message: 'нужен код',
  }),
];

const inside = (r: Rect, outer: { x1: number; x2: number; y1: number; y2: number }) =>
  r.x >= outer.x1 - 1e-6 &&
  r.x + r.width <= outer.x2 + 1e-6 &&
  r.y >= outer.y1 - 1e-6 &&
  r.y + r.height <= outer.y2 + 1e-6;
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * The room a message may take at participant `id`: its zone frame 2 px in, or its own column
 * frame when it has no zone; from the scene top to its bottom.
 */
function room(layout: SceneLayout, id: string) {
  const p = layout.participants.find((x) => x.id === id);
  const zone = layout.zones.find((z) => z.members.includes(id))?.rect;
  const x1 = zone === undefined ? (p?.span.x1 ?? 0) : zone.x;
  const x2 = zone === undefined ? (p?.span.x2 ?? 0) : zone.x + zone.width;
  return { x1: x1 + 2, x2: x2 - 2, y1: zone?.y ?? 0, y2: layout.height };
}

// M1.2c (carry-over of the M1.2b verifier): on a phone the stopped plaque «чужой пароль» stuck
// out of the bank zone over the «Подделка» frame, «остановлено» crossed the bank frame and
// «пароль не подставлен» spanned three zones. At both ends of every step, in both modes, the
// plaque or token and its word stay in the zone of the participant they stand at, off every
// text and off the icons of the others; nothing is shrunk below 85% or 11 px.
describe('the message at rest fits its zone (M1.2c)', () => {
  for (const [name, input, steps] of [
    ['B1', B1, B1_STEPS],
    ['I1', I1, I1_STEPS],
  ] as const) {
    for (const width of [334, 349, 356, 364, 390, 760, 926]) {
      it(`${name} at ${String(width)} px`, () => {
        const layout = layoutScene({ ...input, width });
        const texts = [
          ...layout.participants.flatMap((p) => [
            { what: `${p.id} name`, box: p.name.box },
            ...(p.note === null ? [] : [{ what: `${p.id} note`, box: p.note.box }]),
          ]),
          ...layout.zones.map((z) => ({ what: `${z.id} label`, box: z.label.box })),
        ];
        for (const s of steps) {
          for (const [t, at] of [
            [0, s.from],
            [TRAVEL_MS, s.to],
          ] as const) {
            const m = layoutMessage(layout, s, t, false, say);
            if (m === null) throw new Error(`no message for ${s.id}`);
            const where = `${s.id} at ${at}, ${String(width)} px`;
            const icons = layout.participants
              .filter((p) => p.id !== s.from && p.id !== s.to)
              .map((p) => ({ what: `${p.id} icon`, box: p.icon }));
            for (const [part, box] of [
              ['body', m.body],
              ['word', m.wordBox],
            ] as const) {
              expect(inside(box, room(layout, at)), `${where}: ${part} in its zone`).toBe(true);
              for (const other of [...texts, ...icons]) {
                expect(overlap(box, other.box), `${where}: ${part} × ${other.what}`).toBe(false);
              }
            }
            expect(overlap(m.body, m.wordBox), `${where}: body × word`).toBe(false);
            // M1.2d (second round): the plaque or token covers no icon and no ring line at
            // all, the step's own included: it stops above the ring.
            for (const p of layout.participants) {
              expect(overlap(m.body, p.icon), `${where}: body × ${p.id} icon`).toBe(false);
              const line = {
                x: p.area.x - 1,
                y: p.area.y - 1,
                width: p.area.width + 2,
                height: p.area.height + 2,
              };
              expect(overlap(m.body, line), `${where}: body × ${p.id} ring`).toBe(false);
            }
            const natural = Array.from(m.word).length * (MESSAGE_FONT_SIZE * 0.6 + 0.5);
            expect(m.wordBox.width).toBeGreaterThanOrEqual(natural * MIN_SQUEEZE - 1e-6);
            for (const line of m.plaque?.lines ?? []) {
              const full = Array.from(line.text).length * MESSAGE_FONT_SIZE * 0.6;
              expect(line.fit ?? full).toBeGreaterThanOrEqual(full * MIN_SQUEEZE - 1e-6);
            }
            expect(m.plaque?.lines.length ?? 1).toBeLessThanOrEqual(3);
          }
        }
      });
    }
  }

  it('keeps the whole words of the I1 stopped plaques on a phone, in two lines', () => {
    // A real phone: 390 px less the page padding (12 px on a phone, M1.2c) and border.
    const phone = layoutScene({ ...I1, width: 364 });
    const leak = layoutMessage(phone, I1_STEPS[6] ?? step({ id: 'x' }), TRAVEL_MS, false, say);
    expect(leak?.plaque?.lines.map((l) => l.text)).toEqual(['чужой', 'пароль']);
    expect(leak?.plaque?.cut).toBe(false);
    const autofill = layoutMessage(phone, I1_STEPS[5] ?? step({ id: 'x' }), 0, false, say);
    expect(autofill?.plaque?.lines.map((l) => l.text)).toEqual(['пароль не', 'подставлен']);
    expect(autofill?.word).toBe('остановлено');
    // On a wide scene the same plaque is one line, as before.
    const wide = layoutScene({ ...I1, width: 926 });
    expect(
      layoutMessage(wide, I1_STEPS[6] ?? step({ id: 'x' }), TRAVEL_MS, false, say)?.plaque?.lines,
    ).toHaveLength(1);
  });

  it('starts the trail where the message starts, also when that is off the column centre', () => {
    for (const width of [356, 926]) {
      const layout = layoutScene({ ...B1, width });
      const param = B1_STEPS[5] ?? step({ id: 'x' });
      const start = layoutMessage(layout, param, 1, false, say);
      const later = layoutMessage(layout, param, TRAVEL_MS, false, say);
      expect(start?.trail?.x1).toBeCloseTo(
        layoutMessage(layout, param, 0, false, say)?.x ?? NaN,
        1,
      );
      expect(later?.trail?.x1).toBe(start?.trail?.x1);
      expect(later?.trail?.x2).toBe(later?.x);
    }
  });
});

// M1.2d (style guide: a stopped message is green with a shield and «остановлено»; red belongs
// to the attacker and its messages only). A stopped message travels in the colour of its kind
// and turns into the defence colour where it stops; the receiver ring follows the message, so
// it stays red while a harmful message travels or arrives unstopped (K62).
describe('the colour of a message (M1.2d)', () => {
  const param = B1_STEPS[5] ?? step({ id: 'x' });
  const glue = B1_STEPS[2] ?? step({ id: 'x' });

  it('paints a stopped harmful message red on its way and green where it stops', () => {
    for (const t of [0, TRAVEL_MS / 2, TRAVEL_MS - 1]) {
      expect(layoutMessage(scene, param, t, false, say)).toMatchObject({
        paint: 'attack',
        trailPaint: 'attack',
        sign: 'attack',
        word: 'вредное',
      });
    }
    for (const t of [TRAVEL_MS, TRAVEL_MS * 20]) {
      expect(layoutMessage(scene, param, t, false, say)).toMatchObject({
        paint: 'stopped',
        sign: 'stopped',
        word: 'остановлено',
        // The line behind it shows the harmful message that came.
        trailPaint: 'attack',
      });
    }
  });

  it('keeps a harmful message that is not stopped red all the way, ring included', () => {
    for (const t of [0, TRAVEL_MS / 2, TRAVEL_MS, TRAVEL_MS * 20]) {
      expect(layoutMessage(scene, glue, t, false, say)?.paint).toBe('attack');
    }
  });

  it('paints a stopped step that does not move green at once, other kinds as their kind', () => {
    const autofill = I1_STEPS[5] ?? step({ id: 'x' });
    const i1 = layoutScene({ ...I1, width: 760 });
    expect(layoutMessage(i1, autofill, 0, false, say)?.paint).toBe('stopped');
    expect(layoutMessage(scene, step({ id: 's', kind: 'safe' }), 0, false, say)?.paint).toBe(
      'safe',
    );
    expect(layoutMessage(scene, step({ id: 'l' }), TRAVEL_MS, false, say)?.paint).toBe('legit');
    // With reduced motion the stopped message is there, and green, at once (S11).
    expect(layoutMessage(scene, param, 0, true, say)?.paint).toBe('stopped');
  });
});

// M1.2d: on a 360 px phone (334 px of scene) «пароль не подставлен» was cut to «пароль не…».
// A compact plaque now hangs its text around the sign: the sign takes room on the first line
// only, the next lines start under it, up to three lines. No plaque of B1 or I1 is cut on
// 360, 375 and 390 px phones.
describe('compact plaques on narrow phones (M1.2d)', () => {
  const PHONES = [334, 349, 364];

  it('keeps «пароль не подставлен» whole at 360 and 375 px', () => {
    for (const width of PHONES) {
      const layout = layoutScene({ ...I1, width });
      for (const s of [I1_STEPS[5], I1_STEPS[6]]) {
        if (s === undefined) throw new Error('no step');
        const m = layoutMessage(layout, s, TRAVEL_MS, false, say);
        expect(m?.plaque?.cut, `${s.id} at ${String(width)}`).toBe(false);
        expect(m?.plaque?.text, `${s.id} at ${String(width)}`).toBe(s.message);
      }
    }
    const narrow = layoutScene({ ...I1, width: 334 });
    const autofill = layoutMessage(narrow, I1_STEPS[5] ?? step({ id: 'x' }), 0, false, say);
    expect(autofill?.plaque?.lines.map((l) => l.text)).toEqual(['пароль не', 'подставлен']);
  });

  it('starts the first line after the sign and the next lines under it', () => {
    const narrow = layoutScene({ ...I1, width: 334 });
    const plaque = layoutMessage(narrow, I1_STEPS[5] ?? step({ id: 'x' }), 0, false, say)?.plaque;
    if (plaque === null || plaque === undefined) throw new Error('no plaque');
    const [first, second] = plaque.lines;
    expect(first?.x).toBe(plaque.textX);
    expect(second?.x).toBeLessThan(plaque.textX);
    expect(second?.x).toBeGreaterThanOrEqual(3);
    // The sign stands at the first line.
    expect(plaque.signY).toBeCloseTo((first?.y ?? 0) - 4, 6);
    // Every line ends inside the plaque.
    for (const line of plaque.lines) {
      const drawn = line.fit ?? Array.from(line.text).length * MESSAGE_FONT_SIZE * 0.6;
      expect(line.x + drawn).toBeLessThanOrEqual(plaque.width - 3 + 1e-6);
    }
  });

  it('uses up to three lines, 42 px high, before it cuts', () => {
    const narrow = layoutScene({ ...I1, width: 334 });
    const three = step({ id: 'three', to: 'user', message: 'пароль не подставлен сюда' });
    const plaque = layoutMessage(narrow, three, TRAVEL_MS, false, say)?.plaque;
    expect(plaque?.lines).toHaveLength(3);
    expect(plaque?.height).toBe(42);
    expect(plaque?.cut).toBe(false);
    const long = step({ id: 'long', to: 'user', message: 'один два три четыре пять шесть семь' });
    const cut = layoutMessage(narrow, long, TRAVEL_MS, false, say)?.plaque;
    expect(cut?.lines).toHaveLength(3);
    expect(cut?.cut).toBe(true);
    expect(cut?.text.endsWith('…')).toBe(true);
  });

  it('cuts no plaque of B1 and I1 on a phone', () => {
    for (const [input, steps] of [
      [B1, B1_STEPS],
      [I1, I1_STEPS],
    ] as const) {
      for (const width of PHONES) {
        const layout = layoutScene({ ...input, width });
        for (const s of steps) {
          const m = layoutMessage(layout, s, TRAVEL_MS, false, say);
          if (m?.plaque === null || m?.plaque === undefined) continue;
          expect(m.plaque.cut, `${s.id} at ${String(width)}`).toBe(false);
        }
      }
    }
  });
});
