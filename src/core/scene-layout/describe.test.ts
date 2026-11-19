// M1.2a (design M1.2 E9): a still scene has a text description for screen readers.
import { describe, expect, it } from 'vitest';
import { sayFromFile } from '../i18n/testing';
import { describeScene, describeStep, sceneTitle } from './describe';

const say = sayFromFile('ru');
const en = sayFromFile('en');

describe('describeScene', () => {
  it('names participants in order and the members of each zone', () => {
    expect(
      describeScene(
        {
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
        },
        say,
      ),
    ).toBe(
      'Участники слева направо: Атакующий (203.0.113.66), Поддельная страница, Банк (bank.example). ' +
        'Зоны доверия: Интернет: Атакующий; Подделка (опасная): Поддельная страница.',
    );
  });

  it('says so when there is nobody', () => {
    expect(describeScene({ participants: [], zones: [] }, say)).toBe('На схеме нет участников.');
  });

  it('titles the scene by the lesson', () => {
    expect(sceneTitle('SQL-инъекция', say)).toBe('Схема урока «SQL-инъекция»');
  });
});

// M1.2b (design M1.2 E9): the current step in words, for screen readers and under the scene.
describe('describeStep', () => {
  const participants = [
    { id: 'attacker', name: 'Атакующий', note: '' },
    { id: 'server', name: 'Веб-сервер', note: '' },
    { id: 'db', name: 'База данных', note: '' },
  ];
  const base = {
    id: 'glue',
    title: 'Сервер склеивает запрос',
    from: 'server',
    to: 'db',
    kind: 'attack',
    mode: 'without-defence',
    stopped: false,
    icon: null,
    message: "SELECT … 'admin' --",
  } as const;

  it('names the number, the title, who sends to whom and the kind of message', () => {
    expect(describeStep(participants, { number: 3, count: 5, step: base }, say)).toBe(
      'Шаг 3 из 5. Сервер склеивает запрос: Веб-сервер → База данных, ' +
        "вредное сообщение «SELECT … 'admin' --».",
    );
  });

  it('says where a stopped message stopped', () => {
    const param = {
      ...base,
      title: 'Запрос с параметром',
      mode: 'with-defence',
      stopped: true,
      message: "параметр: admin' --",
    } as const;
    expect(describeStep(participants, { number: 3, count: 5, step: param }, say)).toBe(
      'Шаг 3 из 5. Запрос с параметром: Веб-сервер → База данных, вредное сообщение ' +
        "«параметр: admin' --» остановлено у участника «База данных».",
    );
  });

  it('does not name the participant twice for a stopped step that stays put (I1 autofill)', () => {
    const autofill = {
      ...base,
      title: 'Менеджер паролей молчит',
      from: 'attacker',
      to: 'attacker',
      kind: 'safe',
      stopped: true,
      message: 'пароль не подставлен',
    } as const;
    expect(describeStep(participants, { number: 3, count: 5, step: autofill }, say)).toBe(
      'Шаг 3 из 5. Менеджер паролей молчит: у участника «Атакующий», безопасное сообщение ' +
        '«пароль не подставлен» остановлено.',
    );
  });

  it('describes a step that stays with one participant', () => {
    const self = { ...base, from: 'db', to: 'db', kind: 'legit', message: 'проверка' } as const;
    expect(describeStep(participants, { number: 1, count: 1, step: self }, say)).toBe(
      'Шаг 1 из 1. Сервер склеивает запрос: у участника «База данных», обычное сообщение «проверка».',
    );
  });

  it("speaks the reader's language (M2.3): the same parts in English", () => {
    const param = { ...base, mode: 'with-defence', stopped: true, message: "admin' --" } as const;
    expect(describeStep(participants, { number: 3, count: 5, step: param }, en)).toBe(
      'Step 3 of 5. Сервер склеивает запрос: Веб-сервер → База данных, harmful message ' +
        "“admin' --”, stopped at “База данных”.",
    );
    expect(describeScene({ participants: [], zones: [] }, en)).toBe(
      'The diagram has no participants.',
    );
    expect(describeStep(participants, null, en)).toBe('This lesson has no steps in this mode.');
  });

  it('says when the mode has no steps', () => {
    expect(describeStep(participants, null, say)).toBe('В этом режиме у урока нет шагов.');
  });
});
