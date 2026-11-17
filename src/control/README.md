# src/control — канал управления

Слой L3 (адаптер): может импортировать `src/core`, `src/services`, `src/commands`. Даёт тестам
и агентам `window.__app` — тот же реестр команд и то же состояние, что у интерфейса
(архитектура §4).

## API

```ts
window.__app.commands.list(); // [{ id, titleKey, params, enabled }]
window.__app.commands.run('theme.set', { theme: 'dark' }); // { ok: true } | { ok: false, error }
window.__app.state.get(); // { theme: 'dark' } — всё состояние приложения (src/core/state.ts)
```

Из Playwright:

```ts
import { expect, openApp, test } from './support'; // e2e/support.ts

test('…', async ({ page }) => {
  await openApp(page); // открыть страницу, дождаться приложения и канала
  await page.evaluate(() => window.__app?.commands.run('theme.set', { theme: 'dark' }));
  expect(await page.evaluate(() => window.__app?.state.get())).toEqual({ theme: 'dark' });
  await page.screenshot({ path: test.info().outputPath('dark.png') });
});
```

## Поведение

- Канал есть только в dev-сервере (`npm run dev`) и в сборке для тестов
  (`npm run build:e2e` → `dist-e2e/`). В рабочей сборке (`npm run build` → `dist/`) его нет:
  условие в `src/main.ts` становится константой `false`, и сборщик выбрасывает весь модуль.
  Это проверяет `e2e/production/production.spec.ts`: в `dist/` нет строки `__app`, в браузере
  нет `window.__app`, а интерфейс работает.
- Всё, что возвращает канал, — простые данные, копия: их можно менять, приложение этого не
  заметит. Они проходят через `page.evaluate` без потерь.
- `commands.run` не бросает исключений ни на каких аргументах; ошибка — данные с `code`
  (таблица кодов в `src/commands/README.md`).
- `window.__app` и его части заморожены, скрипт страницы не может их подменить.
- Канал ничего не добавляет к командам: что нельзя сделать командой, нельзя и через канал.

## Как добавить часть канала (часы в M0.4)

В `control.ts` два места с пометкой `EXTENSION POINT`: поле в интерфейсе `AppControl` и поле в
объекте, который собирает `createControl(app)`. Сам источник (часы) добавляется в `AppContext`
(`src/commands/app.ts`), оттуда его берут и команды, и канал. Аргументы враждебны: проверять
их так же, как параметры команд, и возвращать простые данные.

## Тесты e2e

- `npm run e2e` (входит в `npm run gate`): собирает `dist/` и `dist-e2e/`, поднимает два
  сервера `scripts/serve-static.mjs` и гоняет Chromium без окна, окно 1280×720.
  Проект `e2e` — тесты `e2e/*.spec.ts` на сборке с каналом; проект `production` — тесты
  `e2e/production/` на рабочей сборке.
- Сервер отдаёт сайт так же, как выкладка: заголовки из `_headers` в папке сборки (там CSP),
  на неизвестный адрес — `index.html`, ничего за пределами папки. Нет `_headers` — без
  заголовков.
- `test` из `e2e/support.ts` валит тест, если страница написала ошибку в консоль, бросила
  исключение или запрос не прошёл. Нарушение CSP попадает в консоль, поэтому встроенный
  стиль или скрипт делает gate красным.
- Снимки и прочие файлы тестов — в `test-results/` (не в git), путь даёт
  `testInfo.outputPath('имя.png')`.
- Порты: 4173 и 4174; в своём worktree — `E2E_PORT=42xx npm run e2e` (занимает два подряд).
- Браузер ставится один раз: `./node_modules/.bin/playwright install chromium`.

## Ограничения

- Часов (`clock.set`, `clock.tick`) пока нет — задача M0.4.
- `state.get()` отдаёт состояние целиком; выборки по частям нет.
- Только Chromium. Firefox и WebKit не проверяются.
- Сервер для тестов не понимает в `_headers` шаблоны с `:имя` и строки `! Заголовок`.
- Dev-сервер заголовки из `_headers` не ставит: CSP проверяется только на собранном сайте.
