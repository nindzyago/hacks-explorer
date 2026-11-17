import { describe, expect, it } from 'vitest';
import { PROJECT } from './project';

describe('PROJECT', () => {
  it('has a name and a tagline in both launch languages', () => {
    expect(PROJECT.name).toBe('Hacks Explorer');
    expect(Object.keys(PROJECT.tagline).sort()).toEqual(['en', 'ru']);
    for (const text of Object.values(PROJECT.tagline)) expect(text.length).toBeGreaterThan(10);
  });
});
