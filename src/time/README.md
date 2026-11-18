# src/time — драйвер реального времени

Слой L3 (адаптер). `real-time-driver.ts` — единственный файл сайта, которому можно читать
системное время и заказывать кадры (решение K17). Он раз в кадр подаёт прошедшие миллисекунды
в часы плеера (`src/core/clock.ts`). Всё остальное берёт время у часов.

```ts
import { createRealTimeDriver } from './real-time-driver';

const driver = createRealTimeDriver(clock); // в браузере: performance.now + requestAnimationFrame
driver.start(); // пуск
driver.stop(); // пауза; тесты и канал управления дальше двигают часы сами
driver.running; // boolean
```

## Поведение

- Сайт запускает драйвер в `src/main.ts` сразу после создания приложения. Первая же принятая
  команда `clock.set` или `clock.tick` (тест, канал управления) останавливает его насовсем:
  дальше часы двигает только тот, кто их остановил. Отклонённая команда драйвер не трогает.
- Пока не вызван `start`, драйвер ничего не делает и кадров не заказывает. `start` и `stop`
  можно вызывать повторно.
- Время, прошедшее на паузе, не доигрывается: отсчёт начинается с момента `start`.
- Часам подаются целые миллисекунды, дробная часть переносится на следующий кадр.
- Кадр длиннее `maxFrameMs` (по умолчанию 100 мс: скрытая вкладка, отладчик) считается за
  `maxFrameMs`; анимация после возврата на вкладку продолжается, а не прыгает.
- Системное время, которое пошло назад или оказалось не числом, пропускается.
- Когда часы дошли до своего предела (24 часа), драйвер останавливается сам.
- Подписчик часов может остановить драйвер изнутри шага.

## Срок загрузки урока (`load-timer.ts`, M1.2b)

`withDeadline(работа, мс, приТаймауте)` — результат работы или `приТаймауте()`, если работа не
кончилась за `мс`; таймер снимается, когда работа кончилась раньше. `App.svelte` ждёт урок
`LOAD_TIMEOUT_MS` = 15 с и показывает «Урок загружается слишком долго» с кнопкой «Попробовать
снова». Это сетевой срок по стенным часам, а не время анимации, поэтому файлу разрешён
`setTimeout` (второе исключение в `scripts/timing-rules.mjs`); на сцену он не влияет.

## Запрет в остальном коде

Правила ESLint лежат в `scripts/timing-rules.mjs`, тест — `scripts/timing-lint.test.mjs`.
Действуют на весь код сайта: `src/**` с расширениями `.ts`, `.js`, `.mjs`, `.cjs`, `.svelte`
(значит, и `.svelte.ts`, `.svelte.js`), кроме файла драйвера, `load-timer.ts` и тестов
`*.test.*`. Запрещено:

- `Date`, `performance`, `setTimeout`, `setInterval`, `setImmediate`, `requestAnimationFrame`,
  `cancelAnimationFrame`, `requestIdleCallback`, `Animation`, `KeyframeEffect`,
  `DocumentTimeline` — и напрямую, и через `window.`, `globalThis.`, `self.`;
- `Math.random`, `crypto.getRandomValues`, `crypto.randomUUID`, а также `window.Math`,
  `window.crypto` и то же через `globalThis.` и `self.`;
- `.animate(…)` и `.getAnimations()` у любого объекта, `document.timeline`;
- импорт `svelte/motion`, `svelte/transition`, `svelte/animate` и `SvelteDate` из
  `svelte/reactivity`; динамический `import()` этих четырёх модулей.

Комментарием `eslint-disable` в коде сайта правило не выключить (`noInlineConfig`): сам
комментарий становится ошибкой gate. Исключение делается в `eslint.config.js` или в
`scripts/timing-rules.mjs`, где его видно при просмотре. В тестах комментарии разрешены, но
лишний `eslint-disable`, который ничего не выключает, — ошибка во всём проекте.

### Чего линтер не видит

Это проверка от случайной ошибки, а не от умысла. Мимо неё проходит:

- глобальный объект под другим именем: `const w = window; w.setTimeout(…)`,
  `const { setTimeout } = window`, `Reflect.get(globalThis, 'Date')`, `window['Date']` с
  вычисляемым ключом, `eval` и `new Function`;
- `import()` с вычисляемым адресом модуля;
- время из других источников: `Intl.DateTimeFormat().format()` без аргумента, `event.timeStamp`,
  `document.lastModified`, заголовки ответа сети, `AudioContext.currentTime`, время видео;
- случайность из других источников: порядок ответов сети, `crypto.subtle.generateKey`;
- код зависимостей в `node_modules`.

Анимации в CSS (`transition`, `animation`, `@keyframes`, переходы вида, плавная прокрутка), SMIL
(`<animate>` и родня) и директивы Svelte `transition:`, `in:`, `out:`, `animate:` идут от
системного времени; их ловит не ESLint, а правило `no-css-animation` в
`scripts/structure-check.mjs` (M1.2c, G14). Мимо него проходят стили, собранные строкой во время
работы (`el.setAttribute('style', s)`, `el.style.cssText = s`), и CSS из зависимостей.
Снимки в тестах делаются с `animations: 'disabled'`.

## Ограничения

- Драйвер работает и в рабочей сборке, хотя до плеера (M1.3) часы там никто не слушает: один
  пустой вызов на кадр. Пуск и паузу плеера нужно будет связать с `start` и `stop`.
- После остановки командой драйвер сам не запускается; команды «вернуть реальное время» нет.
- Источник кадров (`FrameSource`) подменяется вторым аргументом; в тестах он ручной.
- Скорости воспроизведения нет: появится в M1.3.
