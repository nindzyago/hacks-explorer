import { describe, expect, it } from 'vitest';
import { PROJECT } from './project';

describe('PROJECT', () => {
  it('has a name; the tagline is an interface string (M2.3, app.tagline)', () => {
    expect(PROJECT.name).toBe('Hacks Explorer');
    expect(Object.keys(PROJECT)).toEqual(['name']);
  });
});
