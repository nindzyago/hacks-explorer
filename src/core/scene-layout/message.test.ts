// M1.2b, oracle levels A and D (design M1.2 E2, E8, D3 a; scenarios S2, S11): where the message
// of the current step stands at a moment of the player clock, what it looks like, and which
// step is current in each mode.
import { describe, expect, it } from 'vitest';
import { layoutScene, type SceneInput } from './layout';
import {
  currentStep,
  layoutMessage,
  MESSAGE_HEIGHT,
  stepsInMode,
  TOKEN_RADIUS,
  travelProgress,
  TRAVEL_MS,
  type StepInput,
} from './message';

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
  step({ id: 'param', from: 'server', to: 'db', kind: 'safe', mode: 'with-defence' }),
  step({ id: 'empty', from: 'db', to: 'server', kind: 'safe', mode: 'with-defence' }),
  step({
    id: 'refuse',
    from: 'server',
    to: 'attacker',
    kind: 'safe',
    mode: 'with-defence',
    stopped: true,
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
    const m = layoutMessage(scene, glue, TRAVEL_MS / 2, false);
    expect(m?.x).toBeCloseTo((cx('server') + cx('db')) / 2, 6);
    expect(m?.y).toBe(scene.lane.y);
    expect(m?.arrived).toBe(false);
    expect(m?.trail).toEqual({ x1: cx('server'), x2: m?.x, y: scene.lane.y });
  });

  it('starts at the sender and ends at the receiver, with a ring around the receiver', () => {
    expect(layoutMessage(scene, glue, 0, false)?.x).toBeCloseTo(cx('server'), 6);
    const end = layoutMessage(scene, glue, TRAVEL_MS, false);
    expect(end?.x).toBeCloseTo(cx('db'), 6);
    expect(end?.arrived).toBe(true);
    expect(end?.ring).toEqual(scene.participants[2]?.area);
  });

  it('is at the receiver at once with reduced motion (S11)', () => {
    const m = layoutMessage(scene, glue, 0, true);
    expect(m?.x).toBeCloseTo(cx('db'), 6);
    expect(m?.arrived).toBe(true);
  });

  it('is the same for the same moment: a pure function', () => {
    expect(layoutMessage(scene, glue, 450, false)).toEqual(layoutMessage(scene, glue, 450, false));
  });

  it('doubles the colour of each kind by a sign and a word (E8)', () => {
    const at = (s: StepInput) => layoutMessage(scene, s, TRAVEL_MS, false);
    expect(at(glue)).toMatchObject({ kind: 'attack', sign: 'attack', word: 'вредное' });
    expect(at(step({ id: 's', kind: 'safe' }))).toMatchObject({ sign: 'safe', word: 'безопасное' });
    // A legit message shows its direction.
    expect(at(step({ id: 'r' }))).toMatchObject({ sign: 'right', word: 'обычное' });
    expect(at(step({ id: 'l', from: 'db', to: 'server' }))).toMatchObject({ sign: 'left' });
  });

  it('stops a stopped message at the participant that stopped it, with a shield (D3 a, S2)', () => {
    const refuse = B1_STEPS[7] ?? step({ id: 'missing' });
    // On the way it is a safe message like any other; the shield comes where it stops.
    const half = layoutMessage(scene, refuse, TRAVEL_MS / 2, false);
    expect(half).toMatchObject({ stopped: false, sign: 'safe', word: 'безопасное' });
    const end = layoutMessage(scene, refuse, TRAVEL_MS, false);
    expect(end).toMatchObject({ stopped: true, sign: 'stopped', word: 'остановлено' });
    const later = layoutMessage(scene, refuse, TRAVEL_MS * 20, false);
    expect(end?.x).toBeCloseTo(cx('attacker'), 6);
    // It stays there: nothing travels further down the line.
    expect(later).toEqual(end);
  });

  it('draws a plaque 24 px high whose text fits, cut with «…» on a narrow scene', () => {
    const m = layoutMessage(scene, glue, 0, false);
    expect(m?.plaque?.height).toBe(MESSAGE_HEIGHT);
    expect(m?.plaque?.text).toBe('GET /login');
    expect(m?.token).toBeNull();
    const narrow = layoutScene({ ...B1, width: 280 });
    const long = step({ id: 'long', message: 'SELECT * FROM users WHERE login = ? AND hash = ?' });
    const cut = layoutMessage(narrow, long, TRAVEL_MS, false);
    expect(cut?.plaque?.cut).toBe(true);
    expect(cut?.plaque?.text.endsWith('…')).toBe(true);
    const width = cut?.plaque?.width ?? Infinity;
    const x = cut?.x ?? Number.NaN;
    expect(x - width / 2).toBeGreaterThanOrEqual(0);
    expect(x + width / 2).toBeLessThanOrEqual(narrow.width);
  });

  it('keeps a plaque inside the scene at the first and last participant', () => {
    const long = step({ id: 'edge', from: 'server', to: 'attacker', message: 'x'.repeat(30) });
    const m = layoutMessage(scene, long, TRAVEL_MS, false);
    const width = m?.plaque?.width ?? Infinity;
    expect((m?.x ?? 0) - width / 2).toBeGreaterThanOrEqual(0);
  });

  it('draws an icon step as a round token instead of a plaque', () => {
    const mail = step({ id: 'bait', kind: 'attack', icon: 'mail' });
    const m = layoutMessage(scene, mail, 0, false);
    expect(m?.plaque).toBeNull();
    expect(m?.token).toEqual({ icon: 'mail', radius: TOKEN_RADIUS });
    expect(m?.sign).toBe('attack');
  });

  it('does not move a step from a participant to itself, and draws no trail', () => {
    const self = step({ id: 'self', from: 'server', to: 'server', kind: 'safe', stopped: true });
    const first = layoutMessage(scene, self, 0, false);
    const last = layoutMessage(scene, self, TRAVEL_MS, false);
    expect(first?.x).toBeCloseTo(cx('server'), 6);
    expect(first).toEqual(last);
    expect(first?.trail).toBeNull();
    expect(first?.arrived).toBe(true);
    expect(first?.sign).toBe('stopped');
  });

  it('gives nothing for a participant the scene does not have', () => {
    expect(layoutMessage(scene, step({ id: 'g', to: 'ghost' }), 0, false)).toBeNull();
  });

  it('leaves room above the lane for the word, below the zone labels', () => {
    const labelBottom = Math.max(...scene.zones.map((z) => z.label.box.y + z.label.box.height));
    const m = layoutMessage(scene, glue, 0, false);
    const wordTop = (m?.wordY ?? 0) - 11 * 0.8;
    expect(wordTop).toBeGreaterThan(labelBottom);
    expect(m?.wordY ?? Infinity).toBeLessThan(scene.lane.y - TOKEN_RADIUS);
  });
});
