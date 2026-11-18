/**
 * Keyboard of the lesson player (S6, M1.3): a key press becomes the id of a command; the page runs
 * it through the registry like a button does (K13). Pure, so it is tested without a browser.
 *
 * - Space: play or pause (`player.play` / `player.pause`, by the state);
 * - → and ←: a step forward and back;
 * - D (any layout: the key D, or the letters d and в): the defence on and off.
 *
 * Ignored: a key with Ctrl, ⌘ or Alt (browser and system shortcuts), focus in a text field or an
 * editable element, and Space on a button, link or other control — there Space presses the
 * control itself, as everywhere on the web (K69).
 */

/** What the decision needs to know about the element that has focus. */
export interface KeyTarget {
  /** Lower-case tag name, '' when unknown. */
  readonly tag: string;
  /** `type` of an `<input>`, lower case. */
  readonly type: string;
  readonly editable: boolean;
  /** The `role` attribute. */
  readonly role: string;
}

export interface KeyPress {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly target: KeyTarget;
}

export type KeyCommand =
  'player.play' | 'player.pause' | 'player.step' | 'player.back' | 'defence.toggle';

/** Inputs that take typing; a checkbox or a button-like input does not. */
const TEXT_INPUTS = new Set([
  '',
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
]);
const CONTROL_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'switch',
  'menuitem',
  'tab',
  'option',
  'radio',
]);

function typing(target: KeyTarget): boolean {
  if (target.editable) return true;
  if (target.tag === 'textarea' || target.tag === 'select') return true;
  return target.tag === 'input' && TEXT_INPUTS.has(target.type);
}

function control(target: KeyTarget): boolean {
  if (target.tag === 'button' || target.tag === 'a' || target.tag === 'summary') return true;
  if (target.tag === 'input') return true;
  return CONTROL_ROLES.has(target.role);
}

export function keyCommand(press: KeyPress, playing: boolean): KeyCommand | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null;
  if (typing(press.target)) return null;
  if (press.key === ' ' || press.code === 'Space') {
    if (control(press.target)) return null;
    return playing ? 'player.pause' : 'player.play';
  }
  if (press.key === 'ArrowRight') return 'player.step';
  if (press.key === 'ArrowLeft') return 'player.back';
  const letter = press.key.toLowerCase();
  if (press.code === 'KeyD' || letter === 'd' || letter === 'в') return 'defence.toggle';
  return null;
}

/** The focus of a DOM event as `KeyTarget`; anything else is an empty target. */
export function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof Element)) return { tag: '', type: '', editable: false, role: '' };
  const editable = target instanceof HTMLElement && target.isContentEditable;
  return {
    tag: target.tagName.toLowerCase(),
    type: (target.getAttribute('type') ?? '').toLowerCase(),
    editable,
    role: (target.getAttribute('role') ?? '').toLowerCase(),
  };
}
