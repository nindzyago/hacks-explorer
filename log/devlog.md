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
