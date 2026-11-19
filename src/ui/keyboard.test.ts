// S6 (M1.3): keys of the player map to commands; typing and shortcuts are left alone.
import { describe, expect, it } from 'vitest';
import { keyCommand, type KeyPress, type KeyTarget } from './keyboard';

const BODY: KeyTarget = { tag: 'body', type: '', editable: false, role: '' };
const press = (key: string, over: Partial<KeyPress> = {}): KeyPress => ({
  key,
  code: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  target: BODY,
  ...over,
});

describe('keyCommand', () => {
  it('Space plays or pauses by the state', () => {
    expect(keyCommand(press(' ', { code: 'Space' }), false)).toBe('player.play');
    expect(keyCommand(press(' ', { code: 'Space' }), true)).toBe('player.pause');
  });

  it('arrows step, D toggles the defence in any layout', () => {
    expect(keyCommand(press('ArrowRight'), false)).toBe('player.step');
    expect(keyCommand(press('ArrowLeft'), true)).toBe('player.back');
    for (const key of ['d', 'D', 'в', 'В']) {
      expect(keyCommand(press(key), false)).toBe('defence.toggle');
    }
    expect(keyCommand(press('ø', { code: 'KeyD' }), false)).toBe('defence.toggle');
  });

  it('ignores other keys and shortcuts', () => {
    for (const key of ['Enter', 'Escape', 'ArrowUp', 'a', 'Tab', '']) {
      expect(keyCommand(press(key), false)).toBeNull();
    }
    expect(keyCommand(press('d', { ctrlKey: true }), false)).toBeNull();
    expect(keyCommand(press('ArrowRight', { metaKey: true }), false)).toBeNull();
    expect(keyCommand(press('ArrowLeft', { altKey: true }), false)).toBeNull();
  });

  it('ignores every key while focus is in a text field', () => {
    const fields: KeyTarget[] = [
      { tag: 'input', type: '', editable: false, role: '' },
      { tag: 'input', type: 'search', editable: false, role: '' },
      { tag: 'textarea', type: '', editable: false, role: '' },
      { tag: 'select', type: '', editable: false, role: '' },
      { tag: 'div', type: '', editable: true, role: '' },
    ];
    for (const target of fields) {
      for (const key of [' ', 'ArrowRight', 'ArrowLeft', 'd']) {
        expect(keyCommand(press(key, { target }), false)).toBeNull();
      }
    }
  });

  it('leaves Space to a focused control elsewhere, but arrows and D still work there', () => {
    const button: KeyTarget = { tag: 'button', type: 'button', editable: false, role: '' };
    const roleButton: KeyTarget = { tag: 'span', type: '', editable: false, role: 'button' };
    for (const target of [button, roleButton]) {
      expect(keyCommand(press(' ', { code: 'Space', target }), false)).toBeNull();
      expect(keyCommand(press('ArrowRight', { target }), false)).toBe('player.step');
      expect(keyCommand(press('d', { target }), false)).toBe('defence.toggle');
    }
  });

  // Verifier M1.3 (S6: Space = play/pause): on the player's own buttons Space plays or pauses;
  // Enter still presses the focused button.
  it('Space on the player’s own controls plays or pauses', () => {
    const own: KeyTarget = {
      tag: 'button',
      type: 'button',
      editable: false,
      role: '',
      player: true,
    };
    expect(keyCommand(press(' ', { code: 'Space', target: own }), false)).toBe('player.play');
    expect(keyCommand(press(' ', { code: 'Space', target: own }), true)).toBe('player.pause');
    expect(keyCommand(press('Enter', { target: own }), false)).toBeNull();
  });

  it('a held Space or D does not toggle again; held arrows keep stepping', () => {
    expect(keyCommand(press(' ', { code: 'Space', repeat: true }), false)).toBeNull();
    expect(keyCommand(press('d', { repeat: true }), false)).toBeNull();
    expect(keyCommand(press('ArrowRight', { repeat: true }), false)).toBe('player.step');
    expect(keyCommand(press('ArrowLeft', { repeat: true }), false)).toBe('player.back');
  });

  it('ignores keys while an input method composes text', () => {
    expect(keyCommand(press('d', { isComposing: true }), false)).toBeNull();
    expect(keyCommand(press('ArrowRight', { isComposing: true }), false)).toBeNull();
    expect(keyCommand(press('Process', { code: 'KeyD' }), false)).toBeNull();
  });

  it('never takes arrows from a form control of any kind', () => {
    for (const type of ['checkbox', 'radio', 'range', 'button', 'color', 'file']) {
      const target: KeyTarget = { tag: 'input', type, editable: false, role: '' };
      expect(keyCommand(press('ArrowLeft', { target }), false), type).toBeNull();
      expect(keyCommand(press('ArrowRight', { target }), false), type).toBeNull();
    }
    for (const role of ['slider', 'listbox', 'radiogroup', 'textbox', 'spinbutton', 'tablist']) {
      const target: KeyTarget = { tag: 'div', type: '', editable: false, role };
      expect(keyCommand(press('ArrowRight', { target }), false), role).toBeNull();
    }
  });

  it('leaves Space and the arrows to a focused scroll region (the panel, a code box)', () => {
    for (const tag of ['section', 'pre']) {
      const target: KeyTarget = { tag, type: '', editable: false, role: '', scroll: true };
      expect(keyCommand(press(' ', { code: 'Space', target }), false), tag).toBeNull();
      expect(keyCommand(press('ArrowLeft', { target }), false), tag).toBeNull();
      expect(keyCommand(press('ArrowRight', { target }), true), tag).toBeNull();
      // D is not a scrolling key: the defence still toggles.
      expect(keyCommand(press('d', { target }), false), tag).toBe('defence.toggle');
    }
  });

  it('leaves every key to an open definition of a term (M2.4): the player takes none', () => {
    for (const tag of ['div', 'button']) {
      const target: KeyTarget = { tag, type: '', editable: false, role: '', dialog: true };
      for (const key of [' ', 'ArrowLeft', 'ArrowRight', 'd', 'в', 'Escape', 'Enter']) {
        expect(
          keyCommand(press(key, { code: key === ' ' ? 'Space' : '', target }), false),
        ).toBeNull();
      }
    }
  });
});
