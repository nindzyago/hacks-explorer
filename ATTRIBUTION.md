# Ассеты и их лицензии

Закон L1: каждый ассет записан здесь. Код проекта под MIT, тексты и схемы уроков под CC BY-SA 4.0
(`AGENTS.md`). Полноту списка проверяет gate (`scripts/content.test.mjs`): файл в
`content/icons/` или `public/fonts/`, которого здесь нет, валит проверку.

## Иконки участников

Иконки в стиле ризографии (K5): восемь из листов A–C и шесть из листов D–E. Сгенерированы владельцем проекта в Magnific (модель
Nano Banana) тремя листами 1024×434 — `prototype/assets/sheet-a.jpg`, `sheet-b.jpg`,
`sheet-c.jpg`; лист одобрен владельцем (K42, дизайн M1.2 D1 a). Иконки вырезаны из листов как есть
командой `sh scripts/cut-icons.sh` (ImageMagick): вырезка 310×275, мягкие края 24 px уходят в
прозрачность, WebP качества 82 с прозрачностью.

**Лицензия: не проверена.** Условия Magnific на публикацию сгенерированных картинок ещё не
проверены (пробел G10); проверяются до открытия репозитория (M4.4). Если условия не позволят —
иконки перерисовываются (дизайн M1.2, вариант D1 b).

| Файл | Лист | Вырезка (x, y) | Что изображено |
|---|---|---|---|
| `content/icons/attacker.webp` | A | 60, 78 | атакующий за ноутбуком |
| `content/icons/server.webp` | A | 370, 78 | веб-сервер с глобусом |
| `content/icons/db.webp` | A | 677, 78 | база данных |
| `content/icons/user.webp` | B | 67, 78 | пользователь |
| `content/icons/mail.webp` | B | 380, 64 | письмо |
| `content/icons/router.webp` | C | 41, 82 | роутер |
| `content/icons/browser.webp` | C | 350, 78 | окно браузера с формой входа |
| `content/icons/bank.webp` | C | 675, 78 | банк |
| `content/icons/workstation.webp` | D | 50, 78 | рабочий компьютер |
| `content/icons/backup.webp` | D | 355, 78 | диск резервных копий |
| `content/icons/assistant.webp` | D | 685, 80 | ИИ-ассистент |
| `content/icons/document.webp` | E | 99, 78 | документ или веб-страница |
| `content/icons/log.webp` | E | 379, 78 | журнал сервера |
| `content/icons/phone.webp` | E | 639, 78 | смартфон |

Листы D и E (`prototype/assets/sheet-d.jpg`, `sheet-e.jpg`) сгенерированы 2026-11-19 оркестратором
проекта в Magnific (Google Nano Banana 2.1, платный тариф владельца) по образцу иконок листа A
(K121): листы 1584×672 уменьшены до 1024×434; лист E дополнительно уменьшен до 80% с полями цвета
бумаги. Лицензия та же, что у листов A–C: не проверена до M4.4 (G10).

## Шрифты

Оба шрифта под SIL Open Font License 1.1; текст лицензии лежит рядом со шрифтами. Файлы — те, что
раздаёт Google Fonts (`fonts.gstatic.com`, ответ на запрос
`https://fonts.googleapis.com/css2?family=Onest:wght@400;500;700&family=JetBrains+Mono:wght@400;700`,
скачано 2026-11-18): переменные шрифты, подмножества «cyrillic» и «latin» в WOFF2, без изменений.
Сайт раздаёт их сам (L6), к Google не обращается.

| Файл | Шрифт | Подмножество | Источник | Лицензия |
|---|---|---|---|---|
| `public/fonts/onest-cyrillic.woff2` | Onest v11, 400–700 | cyrillic | Google Fonts | SIL OFL 1.1 |
| `public/fonts/onest-latin.woff2` | Onest v11, 400–700 | latin | Google Fonts | SIL OFL 1.1 |
| `public/fonts/jetbrains-mono-cyrillic.woff2` | JetBrains Mono v24, 400–700 | cyrillic | Google Fonts | SIL OFL 1.1 |
| `public/fonts/jetbrains-mono-latin.woff2` | JetBrains Mono v24, 400–700 | latin | Google Fonts | SIL OFL 1.1 |
| `public/fonts/OFL-onest.txt` | текст лицензии Onest | — | https://raw.githubusercontent.com/google/fonts/main/ofl/onest/OFL.txt | — |
| `public/fonts/OFL-jetbrainsmono.txt` | текст лицензии JetBrains Mono | — | https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/OFL.txt | — |

- Onest: Copyright 2021 The Onest Project Authors (https://github.com/googlefonts/onest).
- JetBrains Mono: Copyright 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono).

Имена шрифтов в файлах не изменены; по OFL изменённую версию нельзя называть так же — если
шрифты будут перерезаны на подмножества самостоятельно, это нужно учесть.

## Тексты чужих авторов

| Файл | Что | Источник | Лицензия |
|---|---|---|---|
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1; изменён только способ связи в разделе «Enforcement» | https://www.contributor-covenant.org/version/2/1/code_of_conduct/ (скачано 2026-11-19) | CC BY 4.0 |
