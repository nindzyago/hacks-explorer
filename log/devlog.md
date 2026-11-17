# Dev log

Append-only. Newest at the bottom. Sessions can end abruptly; this file plus a green tree is how
the next agent picks up.

## 2026-11-17 16:40 — M0.0 CraftSpec scaffold (agent: Claude)
Landed: владелец сказал «делаем» (K8, имя Hacks Explorer); записаны K9 (первый выпуск по три урока в разделе, раздел L про шифрование) и K10 (YAML, выпуски через GitHub, Cloudflare); план, каталог, архитектура, gaps и AGENTS.md приведены к этим решениям; добавлены docs/workflow.md, plan/claims.md, CLAUDE.md, CI-шаблон; git init.
Numbers: 75 уроков в 12 разделах, 36 в первом выпуске; 56 задач в M0–M5 (посчитано скриптом по файлам плана).
Not measured on real data: оценки часов не откалиброваны.
Still open: дашборд проекта описывает план до K7–K10; G10, G11, G12.

## 2026-11-17 17:45 — M0.1 Каркас репозитория и `npm run gate` (agent: Claude)
Landed: Vite 8 + Svelte 5 + TypeScript 6; `npm run gate` (prettier, eslint, svelte-check, vitest, structure-check, сборка); `scripts/structure-check.mjs` со слоями, запретом кода в `content/` и запретом чужих серверов; пустая страница с именем проекта; CI-файл `.github/workflows/gate.yml` (не запускался: удалённого репозитория нет).
Numbers: gate зелёный, 9 тестов в 2 файлах; сборка 10.9 КБ JS в gzip (вывод vite build). Подложенные нарушение слоёв, `!`, `any` и код в `content/` дают красный gate (проверено вручную, файлы удалены).
Not measured on real data: CI на GitHub не запускался; на Linux gate не проверялся.
Still open: `npx` на этой машине падает с MODULE_NOT_FOUND, инструменты запускаются через `npm run` и `node_modules/.bin`; LICENSE и ATTRIBUTION.md появятся в M4.4.

## 2026-11-17 20:45 — удалённый репозиторий (agent: Claude)
Landed: по слову владельца создан закрытый репозиторий `nindzyago/hacks-explorer`, `main` отправлена, `origin` настроен.
Numbers: первый прогон CI (gate, ubuntu-latest, Node 22) зелёный, run 44160754669.
Not measured on real data: —
Still open: предупреждение CI — actions/checkout@v4 и setup-node@v4 рассчитаны на Node 20, обновить версии действий в M0.5; сайт не выложен; репозиторий открывается перед выпуском 0.1 (M4.7).

## 2026-11-17 21:40 — M0.2 Реестр команд (agent: worker-M0.2, слил оркестратор)
Landed: `src/commands/registry.ts` (`createRegistry(getState)` → `register`, `run`, `list`), `src/commands/params.ts` (описание параметров данными и строгая проверка без приведения типов), тесты, `src/commands/README.md`; решение K13.
Numbers: 103 теста в 4 файлах, gate зелёный на main после слияния; сборка 10.91 КБ JS в gzip (реестр пока никем не импортируется).
Verifier: первый вердикт FAIL — `run` бросал исключение, когда команда бросала непечатаемое значение; исправлено коммитом a9a4249 с тестами, повторный вердикт PASS (14 из 16, затем все проверенные мутации ловятся тестами).
Not measured on real data: настоящих команд, состояния и адресов страницы ещё нет; «результаты переживают канал управления» проверено только через JSON, не через Playwright (M0.3). Пределы (строка 200, id 64) — догадки.
Still open: команды синхронные — пересмотреть в M1.3; изоляция воркеров даёт копию внешней папки ~/neuro, а не secviz: копии репозитория оркестратор создаёт сам в `.claude/worktrees/`; `plan/architecture.md` §1 всё ещё упоминает dependency-cruiser (K11 заменил скриптом).

## 2026-11-17 22:20 — M0.5 часть в репозитории (agent: worker-M0.5, слил оркестратор)
Landed: `wrangler.jsonc` (Workers со статикой, K14), `public/_headers` (строгая CSP и прочие заголовки), `.node-version`, `gate.yml` на pull request и push в main (actions v7, права только на чтение), `scripts/deploy-config.mjs` с защитными тестами, `docs/deploy.md` с шагами в панели Cloudflare.
Numbers: gate на main после слияния зелёный, 179 тестов в 5 файлах.
Verifier: PASS с замечаниями; замечания закрыты коммитом b986320 (дыры в защитных тестах, пометки непроверенного в deploy.md). Коммит b986320 отдельно верификатором не перепроверялся — только gate.
Not measured on real data: на Cloudflare и GitHub ничего не запускалось: новый workflow, сборка, `_headers` на живом сайте, адрес предпросмотра.
Still open: M0.5 не закрыт — остались шаги в панели Cloudflare с владельцем, тестовый PR, проверка чернового адреса; G13 (wrangler не закреплён).

## 2026-11-17 23:30 — M0.3 Канал управления (agent: worker-M0.3, слил оркестратор)
Landed: `src/control` (`window.__app`: `commands.list/run`, `state.get`) только в dev и в сборке `--mode e2e`; `src/core/state.ts`, `store.ts`; `createApp()`; команда `theme.set` и кнопка темы; Playwright в gate (`npm run e2e`), сервер `scripts/serve-static.mjs`; шаг установки Chromium в CI. Решения K15, K16.
Numbers: на main после слияния 211 модульных тестов в 9 файлах и 9 браузерных, gate зелёный; e2e идёт уже с настоящим `public/_headers`. Рабочая сборка 13.19 КБ JS в gzip (было 10.91). Gate на этой машине: 9.3 с → 13.2 с (тёплый запуск, по отчёту воркера).
Verifier: PASS с замечаниями низкой важности (18 из 20 мутаций ловятся; не покрыт try/catch в `commands.run`; `state.get`/`list` бросают при подменённом `structuredClone`; сервер тестов идёт по симлинкам внутри папки).
Not measured on real data: шаг установки Chromium в CI ещё не запускался на GitHub; только Chromium.
Still open: воркер не мог писать в выданный worktree, результат перенёс оркестратор патчем; надпись кнопки «Тёмная тема» зашита в компонент до появления i18n (M2.3); подписчик хранилища, бросивший исключение, даёт `failed` при уже изменённом состоянии.

## 2026-11-18 00:30 — M0.4 Детерминизм (agent: worker-M0.4, слил оркестратор)
Landed: `src/core/clock.ts`, `src/core/dump.ts`, команды `clock.set`/`clock.tick`, `__app.clock`, драйвер `src/time/real-time-driver.ts`, правила ESLint против системного времени (`scripts/timing-rules.mjs`), `e2e/determinism.spec.ts` (один сценарий дважды: дамп строкой и PNG побайтно). Решение K17.
Numbers: на main после слияния 305 модульных тестов в 14 файлах, 13 браузерных; gate зелёный. Рабочая сборка 15.69 КБ JS в gzip (было 13.19). Повтор e2e ×5 у верификатора: 65 из 65.
Verifier: два прохода, оба PASS с замечаниями; после первого закрыты дыры линтера и шесть мест без теста. Остались замечания низкой важности (три выжившие мутации в `control.ts`, экзотика в `stableDump`).
Not measured on real data: шаг 10 мс и пределы — догадки; сцены нет, 60 кадров в секунду не измерялись; побайтно равные PNG проверены только в Chromium на этой машине, на Linux в CI — первым же прогоном после отправки.
Still open: G14 (CSS-анимации); драйвер не перезапускается после ручной команды — M1.3; `plan/architecture.md` §1 не знает про `src/time`.

## 2026-11-18 01:10 — M0.5 закрыт, этап M0 закончен (оркестратор)
Landed: Worker `hacks-explorer` создан в панели Cloudflare (владелец подключил приложение Cloudflare к репозиторию), сборка по событиям GitHub; `main` выкладывается на https://hacks-explorer.mike-antipiev.workers.dev; тестовый pull request nindzyago/hacks-explorer#1 слит; `preview_urls: true` записан явно.
Numbers: на main 308 модульных тестов в 14 файлах и 13 браузерных; gate зелёный локально и в CI на Linux (в том числе побайтное сравнение снимков). На черновом адресе `/` и `/ru/lesson/B1` отвечают 200 с CSP, nosniff и noindex (curl). Предпросмотр PR: проверка Workers Builds зелёная, адрес https://m0-5-test-pr-hacks-explorer.mike-antipiev.workers.dev открывается, глубокая ссылка в Chrome открывает сайт.
Not measured on real data: предпросмотр pull request из форка; поведение при 100 предпросмотрах; время сборки Cloudflare с ростом проекта (первая — около двух минут).
Still open: G15 (нет комментария Cloudflare со ссылкой; 404 на глубокие ссылки для запросов не из браузера на предпросмотре); G13 (wrangler не закреплён); черновой адрес открыт по ссылке, Cloudflare Access не включён — решение владельца; дашборд проекта не обновлялся.
