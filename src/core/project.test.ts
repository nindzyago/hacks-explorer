import { describe, expect, it } from 'vitest';
import { PROJECT, shownAddress } from './project';

describe('PROJECT', () => {
  it('has a name; the tagline is an interface string (M2.3, app.tagline)', () => {
    expect(PROJECT.name).toBe('Hacks Explorer');
    expect(Object.keys(PROJECT)).toEqual(['name', 'repository', 'genre']);
  });
});

describe('the two outside links (OPEN1)', () => {
  it('are the public repository and Protocol Explorer, over https', () => {
    expect(PROJECT.repository).toBe('https://github.com/nindzyago/hacks-explorer');
    expect(PROJECT.genre).toEqual({
      name: 'Protocol Explorer',
      url: 'https://protocol-explorer-alpha.vercel.app/',
    });
  });

  it('are shown without the scheme and the trailing slash', () => {
    expect(shownAddress(PROJECT.repository)).toBe('github.com/nindzyago/hacks-explorer');
    expect(shownAddress(PROJECT.genre.url)).toBe('protocol-explorer-alpha.vercel.app');
    expect(shownAddress('http://a.example/')).toBe('a.example');
  });
});
