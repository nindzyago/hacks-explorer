# Status

> Updated: 2026-11-17 by Claude (craftspec orchestrate)

**Current milestone:** M2 — Оболочка: панель уроков, языки, глубина, телефон
**Next task:** M2.3a (языки в коде) и затем M2.1b (панель уроков), M2.3b (английский), M2.6, M2.7
**Blockers (need a human):** нет. Черновой адрес: https://hacks-explorer.mike-antipiev.workers.dev
**Dashboard:** https://claude.ai/artifact/3yjNxTxsZiRRjuw3jgw1Wp (закрыт, пока владелец не поделится; описывает план до K7–K10)

## Milestones

| Id | Milestone | State | Done / total |
|---|---|---|---|
| M0 | Каркас, gate, наблюдаемость | done | 5 / 5 |
| M1 | Один урок насквозь: SQL-инъекция | done, принят владельцем 2026-11-19 | 6 / 6 |
| M2 | Оболочка: панель уроков, языки, глубина, телефон | in progress | 0 / 8 |
| M3 | Первый выпуск: по три урока в каждом разделе (36) | not started | 0 / 13 |
| M4 | Открытый выпуск 0.1 | not started | 0 / 7 |
| M5 | Остальные уроки (39) | not started | 0 / 17 |

## Designs

| Task | Revision | Status | Link | sha256 of the md |
|---|---|---|---|---|
| M1.1 Формат урока в Markdown | r2 | built 2026-11-18 (M1.1a–c) | https://claude.ai/artifact/Pert7Z6UKR1yd73v9vQukp · `plan/designs/M1.1.md` | 1a0a99f69726… |
| M1.2 Сцена | r2 | built 2026-11-18 (M1.2a–d) | https://claude.ai/artifact/2TTAMfjL1v9Y3CLMrKXc7Q · `plan/designs/M1.2.md` | 744c2b1b8b61… |

| M2.1 Один экран и панель уроков | r1 | approved 2026-11-19 r1 | https://claude.ai/artifact/EVskVTmiKxSKJuqEGP2xJq | 3d8120473027… |
| M2.3 Языки | r2 | approved 2026-11-19 r2 (D1 словами владельца) | https://claude.ai/artifact/47Hamqgnwd7Wfwi2WMowd4 | 30c72746110c… |



## Checklist (current milestone)

- [x] M2.1a Один экран
- [ ] M2.1b Панель уроков и словаря
- [x] M2.2 Адреса: ссылка на урок, шаг и режим
- [x] M2.3a Языки в коде, полнота в gate
- [ ] M2.3b Английские версии B1 и I1
- [x] M2.4 Словарь терминов и всплывающие определения
- [x] M2.5 Калькулятор CVSS 3.1
- [ ] M2.6 Телефон (без тёмной темы)
- [ ] M2.7 Доступность
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
