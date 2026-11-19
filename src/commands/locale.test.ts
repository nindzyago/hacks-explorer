// M2.3, scenario S5: `locale.set` changes the language and nothing else; hostile values are
// refused. Also: every command's title is an interface string (K105).
import { describe, expect, it } from 'vitest';
import { UI_KEYS } from '../services/i18n/keys';
import { createApp } from './app';

function app(languages: readonly string[] = ['ru', 'en']) {
  const created = createApp({ languages });
  created.lessonLoaded('I1', { without: 5, with: 6 });
  return created;
}

describe('locale.set (S5)', () => {
  it('starts in Russian and is listed with the site languages', () => {
    const a = app();
    expect(a.store.get().locale).toBe('ru');
    expect(a.registry.list()).toContainEqual({
      id: 'locale.set',
      titleKey: 'command.locale.set',
      params: { lang: { kind: 'enum', values: ['ru', 'en'] } },
      enabled: true,
    });
  });

  it('keeps the lesson, step, mode, depth and speed', () => {
    const a = app();
    a.registry.run('lesson.open', { id: 'B1' });
    a.lessonLoaded('B1', { without: 5, with: 5 });
    a.registry.run('player.goto', { step: 3 });
    a.registry.run('defence.set', { on: true });
    a.registry.run('depth.set', { depth: 'deep' });
    a.registry.run('player.speed', { value: 2 });
    const before = a.store.get();
    expect(a.registry.run('locale.set', { lang: 'en' })).toEqual({ ok: true });
    const after = a.store.get();
    expect(after.locale).toBe('en');
    expect({ ...after, locale: before.locale }).toEqual(before);
    expect(after.player).toBe(before.player);
    expect(Object.isFrozen(after)).toBe(true);
  });

  it('setting the current language again changes nothing', () => {
    const a = app();
    const before = a.store.get();
    expect(a.registry.run('locale.set', { lang: 'ru' })).toEqual({ ok: true });
    expect(a.store.get()).toBe(before);
  });

  it('refuses a language the site does not have and any hostile value', () => {
    const a = app();
    const before = a.store.get();
    for (const params of [
      { lang: 'de' },
      { lang: 'EN' },
      { lang: ' en' },
      { lang: '__proto__' },
      { lang: 'x'.repeat(10_000) },
      { lang: 1 },
      { lang: null },
      { lang: ['en'] },
      {},
      { lang: 'en', extra: true },
      'en',
      null,
    ]) {
      const result = a.registry.run('locale.set', params);
      expect(result.ok ? 'ok' : result.error.code).toBe('invalid-params');
    }
    expect(a.store.get()).toBe(before);
  });

  it('accepts only Russian on a Russian-only site', () => {
    const a = app(['ru']);
    const result = a.registry.run('locale.set', { lang: 'en' });
    expect(result.ok ? 'ok' : result.error.code).toBe('invalid-params');
  });
});

describe('command titles', () => {
  it('are interface strings in every language (content/locales/<lang>/ui.md)', () => {
    const keys = new Set<string>(UI_KEYS);
    const titles = createApp()
      .registry.list()
      .map((c) => c.titleKey);
    expect(titles.length).toBeGreaterThan(10);
    expect(titles.filter((k) => !keys.has(k))).toEqual([]);
  });
});
