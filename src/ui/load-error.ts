/**
 * What the reader is told when a lesson does not open (M1.2b, L0.1): the interface string of
 * each loader code (M2.3, content/locales/<lang>/ui.md). The code itself stays on the page as
 * `data-code` for tests and bug reports.
 */
import type { LoadError } from '../services/catalog/catalog';
import type { UiKey } from '../services/i18n/keys';

export type ShownErrorCode = LoadError['code'] | 'timeout';

const KEYS: Readonly<Record<ShownErrorCode, UiKey>> = {
  'not-found': 'lesson.error.notFound',
  network: 'lesson.error.network',
  'bad-data': 'lesson.error.badData',
  timeout: 'lesson.error.timeout',
};

export function loadErrorKey(code: ShownErrorCode): UiKey {
  return KEYS[code];
}
