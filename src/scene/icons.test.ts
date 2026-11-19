// M1.2a: the eight icons cut from the prototype sheets reach the site under their names; an
// unknown or hostile name gives null (the scene draws a placeholder, never a broken image).
import { describe, expect, it } from 'vitest';
import { iconNames, iconUrl } from './icons';

describe('icons', () => {
  // M3.0 (K121): the eight of sheets A–C and six of sheets D–E.
  it('has the fourteen icons of content/icons', () => {
    expect(iconNames()).toEqual([
      'assistant',
      'attacker',
      'backup',
      'bank',
      'browser',
      'db',
      'document',
      'log',
      'mail',
      'phone',
      'router',
      'server',
      'user',
      'workstation',
    ]);
  });

  it('gives each a URL of this site', () => {
    for (const name of iconNames()) {
      const url = iconUrl(name);
      expect(url, name).toMatch(/^\/.*\.webp$/);
    }
  });

  it.each([
    'database',
    '',
    'DB',
    '__proto__',
    'constructor',
    'toString',
    '../icons/db',
    'db.webp',
    42,
    null,
    undefined,
    {},
  ])('gives null for %s', (name) => {
    expect(iconUrl(name)).toBe(null);
  });
});
