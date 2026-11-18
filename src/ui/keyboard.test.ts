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

  it('leaves Space to a focused control, but arrows and D still work there', () => {
    const button: KeyTarget = { tag: 'button', type: 'button', editable: false, role: '' };
    const roleButton: KeyTarget = { tag: 'span', type: '', editable: false, role: 'button' };
    for (const target of [button, roleButton]) {
      expect(keyCommand(press(' ', { code: 'Space', target }), false)).toBeNull();
      expect(keyCommand(press('ArrowRight', { target }), false)).toBe('player.step');
      expect(keyCommand(press('d', { target }), false)).toBe('defence.toggle');
    }
    const checkbox: KeyTarget = { tag: 'input', type: 'checkbox', editable: false, role: '' };
    expect(keyCommand(press('ArrowLeft', { target: checkbox }), false)).toBe('player.back');
  });
});
