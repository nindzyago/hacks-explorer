# Status

> Updated: 2026-11-19 by Claude (craftspec orchestrate)

**Current milestone:** M5 — остальные 65 уроков; перед ними UI2 (автопроигрывание, категории) и G17
**Next task:** UI2, G17, затем волна M5.1
**Blockers (need a human):** нет. Сайт: https://hacks.antipic.com · черновик: https://hacks-explorer.mike-antipiev.workers.dev
**Dashboard:** https://claude.ai/artifact/3yjNxTxsZiRRjuw3jgw1Wp (закрыт, пока владелец не поделится; описывает план до K7–K10)

## Milestones

| Id | Milestone | State | Done / total |
|---|---|---|---|
| M0 | Каркас, gate, наблюдаемость | done | 5 / 5 |
| M1 | Один урок насквозь: SQL-инъекция | done, принят владельцем 2026-11-19 | 6 / 6 |
| M2 | Оболочка: панель уроков, языки, глубина, телефон | done, принят владельцем 2026-11-19 | 10 / 10 |
| M3 | Первый выпуск: 10 уроков (K120) | done 2026-11-19 (браузерные тесты на все уроки — G18) | 10 / 10 |
| M4 | Выпуск 0.1 на hacks.antipic.com, репозиторий закрыт (K120) | done 2026-11-19, Release v0.1.1 | 7 / 7 |
| M6 | Чертёжный интерфейс, вариант A (K129) | done 2026-11-20 | 2 / 2 |
| M5 | Остальные 65 уроков, волнами (K132) | in progress | 0 / 4 волн |

## Designs

| Task | Revision | Status | Link | sha256 of the md |
|---|---|---|---|---|
| M1.1 Формат урока в Markdown | r2 | built 2026-11-18 (M1.1a–c) | https://claude.ai/artifact/Pert7Z6UKR1yd73v9vQukp · `plan/designs/M1.1.md` | 1a0a99f69726… |
| M1.2 Сцена | r2 | built 2026-11-18 (M1.2a–d) | https://claude.ai/artifact/2TTAMfjL1v9Y3CLMrKXc7Q · `plan/designs/M1.2.md` | 744c2b1b8b61… |
| M2.1 Один экран и панель уроков | r1 | built 2026-11-19 (M2.1a–b) | https://claude.ai/artifact/EVskVTmiKxSKJuqEGP2xJq · `plan/designs/M2.1.md` | 3d8120473027… |
| M6 Чертёжный интерфейс | r1 | approved 2026-11-20 r1 (чат) | https://claude.ai/artifact/T1rQpowFaTSwEMWwMiHq4M · `plan/designs/M6.md` | — |
| M2.3 Языки | r2 | built 2026-11-19 (M2.3a–b) | https://claude.ai/artifact/47Hamqgnwd7Wfwi2WMowd4 · `plan/designs/M2.3.md` | 30c72746110c… |



## Checklist (current milestone)

- [x] M3.0 Иконки выпуска
- [x] M3.1 C1 Отражённый XSS
- [x] M3.2 C4 CSRF
- [x] M3.3 D1 IDOR
- [x] M3.4 F1 Хеш и соль
- [x] M3.5 G1 Человек посередине
- [x] M3.6 H2 Шифровальщик
- [x] M3.7 J1 Prompt injection
- [x] M3.8 K1 Log4Shell
- [x] M3.9 Главная и «О проекте»

## Done: M2 (принят владельцем 2026-11-19)

- [x] M2.1a Один экран
- [x] M2.1b Панель уроков и словаря
- [x] M2.2 Адреса: ссылка на урок, шаг и режим
- [x] M2.3a Языки в коде, полнота в gate
- [x] M2.3b Английские версии B1 и I1
- [x] M2.4 Словарь терминов и всплывающие определения
- [x] M2.5 Калькулятор CVSS 3.1
- [x] M2.6 Телефон (без тёмной темы)
- [x] M2.7 Доступность
- [x] M2.8 Проверки контента в gate

## Done: M1 (принят владельцем 2026-11-19)

- [x] M1.1a–c Формат урока в Markdown, данные для сайта, урок I1
- [x] M1.2a–d Сцена
- [x] M1.3 Плеер
- [x] M1.4 Панель объяснения
- [x] M1.5 Защита и лента событий
- [x] M1.6 Урок B1 на русском

## Done: M0

- [x] M0.1 Каркас репозитория и одна команда `npm run gate`
- [x] M0.2 Реестр команд
- [x] M0.3 Канал управления
- [x] M0.4 Детерминизм
- [x] M0.5 CI и выкладка на Cloudflare
