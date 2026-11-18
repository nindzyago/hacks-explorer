/**
 * What the reader is told when a lesson does not open (M1.2b, L0.1): Russian text for each
 * loader code. The code itself stays on the page as `data-code` for tests and bug reports.
 * Strings move to i18n with M2.3.
 */
import type { LoadError } from '../services/catalog/catalog';

export type ShownErrorCode = LoadError['code'] | 'timeout';

const TEXTS: Readonly<Record<ShownErrorCode, string>> = {
  'not-found': 'Такого урока нет или он ещё не переведён на этот язык.',
  network: 'Нет связи с сайтом. Проверьте подключение к интернету и попробуйте снова.',
  'bad-data':
    'Файл урока повреждён или устарел. Попробуйте снова; если не поможет — обновите страницу.',
  timeout: 'Урок загружается слишком долго. Проверьте подключение и попробуйте снова.',
};

export function loadErrorText(code: ShownErrorCode): string {
  return TEXTS[code];
}
