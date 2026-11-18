// M1.2a (design M1.2 E9): a still scene has a text description for screen readers.
import { describe, expect, it } from 'vitest';
import { describeScene, sceneTitle } from './describe';

describe('describeScene', () => {
  it('names participants in order and the members of each zone', () => {
    expect(
      describeScene({
        participants: [
          { id: 'attacker', name: 'Атакующий', note: '203.0.113.66' },
          { id: 'fake', name: 'Поддельная страница', note: '' },
          { id: 'bank', name: 'Банк', note: 'bank.example' },
        ],
        zones: [
          { id: 'internet', label: 'Интернет', members: ['attacker'], danger: false },
          { id: 'forgery', label: 'Подделка', members: ['fake', 'ghost'], danger: true },
          { id: 'empty', label: 'Пусто', members: ['ghost'], danger: false },
        ],
      }),
    ).toBe(
      'Участники слева направо: Атакующий (203.0.113.66), Поддельная страница, Банк (bank.example). ' +
        'Зоны доверия: Интернет: Атакующий; Подделка (опасная): Поддельная страница.',
    );
  });

  it('says so when there is nobody', () => {
    expect(describeScene({ participants: [], zones: [] })).toBe('На схеме нет участников.');
  });

  it('titles the scene by the lesson', () => {
    expect(sceneTitle('SQL-инъекция')).toBe('Схема урока «SQL-инъекция»');
  });
});
