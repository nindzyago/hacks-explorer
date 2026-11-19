/**
 * Keyboard of the lesson player (S6, M1.3): a key press becomes the id of a command; the page runs
 * it through the registry like a button does (K13). Pure, so it is tested without a browser.
 *
 * - Space: play or pause (`player.play` / `player.pause`, by the state) — also while focus is on
 *   one of the player's own buttons (step, back, restart, speed, a step number in the table):
 *   there Enter presses the button;
 * - → and ←: a step forward and back; held down they keep stepping (to the end of the lesson);
 * - D (any layout: the key D, or the letters d and в): the defence on and off.
 *
 * Ignored (K69): a key with Ctrl, ⌘ or Alt (browser and system shortcuts); a held Space or D
 * (auto-repeat would toggle again and again); a key while an input method composes text; every
 * key in a text field or an editable element; arrows in any form control or widget that uses
 * them itself (a checkbox, a slider, a list); Space on a button, link or control that is not the
 * player's — there Space presses the control itself, as everywhere on the web; Space and the
 * arrows in a focusable scroll region marked `data-own-keys` (the explanation panel, a code box):
 * there they scroll; every key inside an open definition of a glossary term (`data-dialog-keys`,
 * M2.4): it closes on Esc and the reader moves in it with Tab and Enter.
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
  /** Inside the player's own controls (`data-player-keys`): Space there is play/pause. */
  readonly player?: boolean;
  /**
   * A focusable scroll region of the page (`data-own-keys`: the explanation panel, a code box).
   * Space and the arrows scroll it, as everywhere on the web; the player leaves them alone.
   */
  readonly scroll?: boolean;
  /**
   * Inside an open definition of a glossary term (`data-dialog-keys`, M2.4): every key belongs
   * to it (Esc closes it, Tab and Enter move and press), the player takes none.
   */
  readonly dialog?: boolean;
}

export interface KeyPress {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** The key is held down and this is an auto-repeat. */
  readonly repeat: boolean;
  /** An input method (IME) is composing text. */
  readonly isComposing: boolean;
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
/** Widgets that move with the arrow keys themselves. */
const ARROW_ROLES = new Set([
  'slider',
  'spinbutton',
  'listbox',
  'option',
  'radio',
  'radiogroup',
  'menu',
  'menubar',
  'menuitem',
  'tab',
  'tablist',
  'tree',
  'treeitem',
  'grid',
  'combobox',
  'textbox',
  'searchbox',
  'scrollbar',
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

/** The keys a scroll region uses itself: Space and the arrows (K69, M1.4). */
function isScrollKey(press: KeyPress): boolean {
  return press.key === ' ' || press.code === 'Space' || press.key.startsWith('Arrow');
}

function usesArrows(target: KeyTarget): boolean {
  return target.tag === 'input' || ARROW_ROLES.has(target.role);
}

export function keyCommand(press: KeyPress, playing: boolean): KeyCommand | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null;
  if (press.isComposing || press.key === 'Process') return null;
  if (typing(press.target)) return null;
  if (press.target.dialog === true) return null;
  if (press.target.scroll === true && isScrollKey(press)) return null;
  if (press.key === ' ' || press.code === 'Space') {
    if (press.repeat) return null;
    if (control(press.target) && press.target.player !== true) return null;
    return playing ? 'player.pause' : 'player.play';
  }
  if (press.key === 'ArrowRight' || press.key === 'ArrowLeft') {
    if (usesArrows(press.target)) return null;
    return press.key === 'ArrowRight' ? 'player.step' : 'player.back';
  }
  const letter = press.key.toLowerCase();
  if (press.code === 'KeyD' || letter === 'd' || letter === 'в') {
    return press.repeat ? null : 'defence.toggle';
  }
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
    player: target.closest('[data-player-keys]') !== null,
    scroll: target.hasAttribute('data-own-keys'),
    dialog: target.closest('[data-dialog-keys]') !== null,
  };
}
