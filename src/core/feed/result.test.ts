// M1.5 verifier notes: a stopped result that already says «остановлено» is not prefixed again
// (I1 «остановлено: остановлено»), and a message payload keeps its words together.
import { describe, expect, it } from 'vitest';
import { keepTogether, resultText } from './result';

describe('resultText', () => {
  it('prefixes a stopped result with «остановлено:»', () => {
    expect(resultText({ kind: 'attack', stopped: true, result: 'ввод остался данными' })).toEqual({
      stopped: true,
      prefix: 'остановлено: ',
      text: 'ввод остался данными',
    });
  });

  it('does not repeat «остановлено» when the result already starts with it', () => {
    for (const result of ['остановлено', 'Остановлено защитой', '  остановлено: пароль']) {
      expect(resultText({ kind: 'safe', stopped: true, result })).toEqual({
        stopped: true,
        prefix: '',
        text: result,
      });
    }
    // A word that only begins the same way is not the word.
    expect(resultText({ kind: 'safe', stopped: true, result: 'остановленовый' }).prefix).toBe(
      'остановлено: ',
    );
  });

  it('marks other results by their kind', () => {
    expect(resultText({ kind: 'attack', stopped: false, result: 'x' })).toEqual({
      stopped: false,
      prefix: '! ',
      text: 'x',
    });
    expect(resultText({ kind: 'safe', stopped: false, result: 'x' }).prefix).toBe('✓ ');
    expect(resultText({ kind: 'legit', stopped: false, result: 'x' }).prefix).toBe('');
  });
});

describe('keepTogether', () => {
  it('joins the words of a payload with no-break spaces', () => {
    expect(keepTogether("параметр: admin' --")).toBe("параметр: admin' --");
    expect(keepTogether('a \t b')).toBe('a b');
    expect(keepTogether('')).toBe('');
  });
});
