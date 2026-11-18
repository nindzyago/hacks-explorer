/**
 * Small text rules of the «Ход атаки» table and the event feed (M1.5, verifier notes).
 */
import type { MessageKind } from '../lesson/types';

const STOPPED_WORD = 'остановлено';
const MARK: Readonly<Record<MessageKind, string>> = { legit: '', attack: '! ', safe: '✓ ' };

/**
 * The result column of a step: a stopped step gets the shield and «остановлено: » before its
 * result, unless the result already starts with the word «остановлено» (I1 «Итог: остановлено»);
 * other steps get the sign of their kind.
 */
export function resultText(step: {
  readonly kind: MessageKind;
  readonly stopped: boolean;
  readonly result: string;
}): { readonly stopped: boolean; readonly prefix: string; readonly text: string } {
  if (!step.stopped) return { stopped: false, prefix: MARK[step.kind], text: step.result };
  const says = new RegExp(`^\\s*${STOPPED_WORD}(?![\\p{L}\\p{N}])`, 'iu').test(step.result);
  return { stopped: true, prefix: says ? '' : `${STOPPED_WORD}: `, text: step.result };
}

/**
 * A message payload as one unbreakable piece: runs of white space become one no-break space, so
 * «admin' --» never splits into «admin'» / «--». A payload wider than its box is still broken
 * by `overflow-wrap: anywhere` where it is shown.
 */
export function keepTogether(text: string): string {
  return text.replace(/\s+/g, ' ');
}
