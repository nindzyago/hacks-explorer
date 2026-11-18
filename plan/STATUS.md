# Status

> Updated: 2026-11-17 by Claude (craftspec orchestrate)

**Current milestone:** M1 — Один урок насквозь: SQL-инъекция
**Next task:** после утверждения дизайнов — M1.1a (формат и валидатор на уроке B1), затем M1.2a
**Blockers (need a human):** design M1.1 awaiting approval; design M1.2 awaiting approval. Черновой адрес: https://hacks-explorer.mike-antipiev.workers.dev. Решения владельца без срока: G13 (версия wrangler), закрывать ли черновой адрес входом
**Dashboard:** https://claude.ai/artifact/3yjNxTxsZiRRjuw3jgw1Wp (закрыт, пока владелец не поделится; описывает план до K7–K10)

## Milestones

| Id | Milestone | State | Done / total |
|---|---|---|---|
| M0 | Каркас, gate, наблюдаемость | done | 5 / 5 |
| M1 | Один урок насквозь: SQL-инъекция | not started | 0 / 6 |
| M2 | Оболочка: панель уроков, языки, глубина, телефон | not started | 0 / 8 |
| M3 | Первый выпуск: по три урока в каждом разделе (36) | not started | 0 / 13 |
| M4 | Открытый выпуск 0.1 | not started | 0 / 7 |
| M5 | Остальные уроки (39) | not started | 0 / 17 |

## Designs

| Task | Revision | Status | Link | sha256 of the md |
|---|---|---|---|---|
| M1.1 Формат урока в Markdown | r2 | awaiting-approval (2026-11-18): новый D3 | https://claude.ai/artifact/Pert7Z6UKR1yd73v9vQukp · `plan/designs/M1.1.md` | 1a0a99f69726… |
| M1.2 Сцена | r2 | awaiting-approval (2026-11-18): D1 без ответа | https://claude.ai/artifact/2TTAMfjL1v9Y3CLMrKXc7Q · `plan/designs/M1.2.md` | 744c2b1b8b61… |

Ещё нужны перед M2.1 и M2.3.

## Checklist (current milestone)

- [ ] M1.1 Формат урока в Markdown [design r2 — ждёт ответа на D3]
- [ ] M1.2 Сцена [design r2 — ждёт ответа на D1]
- [ ] M1.3 Плеер
- [ ] M1.4 Панель объяснения
- [ ] M1.5 Переключатель защиты и лента событий
- [ ] M1.6 Урок B1 на русском

## Done: M0

- [x] M0.1 Каркас репозитория и одна команда `npm run gate`
- [x] M0.2 Реестр команд
- [x] M0.3 Канал управления
- [x] M0.4 Детерминизм
- [x] M0.5 CI и выкладка на Cloudflare
