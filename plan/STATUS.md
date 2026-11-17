# Status

> Updated: 2026-11-17 by Claude (craftspec orchestrate)

**Current milestone:** M1 — Один урок насквозь: SQL-инъекция
**Next task:** дизайны M1.1 (формат урока в YAML) и M1.2 (сцена) — нужны утверждённые дизайны в `plan/designs/` до начала работ
**Blockers (need a human):** нет. Черновой адрес: https://hacks-explorer.mike-antipiev.workers.dev (Cloudflare Workers, сборка по событиям GitHub). Решения владельца без срока: G13 (версия wrangler), закрывать ли черновой адрес входом
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

Пока нет. Нужны перед M1.1, M1.2, M2.1, M2.3.

## Checklist (current milestone)

- [x] M0.1 Каркас репозитория и одна команда `npm run gate`
- [x] M0.2 Реестр команд
- [x] M0.3 Канал управления
- [x] M0.4 Детерминизм
- [x] M0.5 CI и выкладка на Cloudflare
