# Ассеты и их лицензии

Закон L1: каждый ассет записан здесь. Код проекта под MIT, тексты и схемы уроков под CC BY-SA 4.0
(`AGENTS.md`). Полноту списка проверяет gate (`scripts/licenses.test.mjs`, M4.4): любая
картинка, шрифт, звук или видео в репозитории и любой файл в `public/`, кроме `_headers`, должны
стоять первой ячейкой строки таблицы ниже; у строки должен быть источник (столбец «Источник» или
«Лист»), файл из строки должен существовать, шрифт должен быть под SIL OFL. Лицензии зависимостей
проверяет тот же тест — раздел «Зависимости» в конце.

## Иконки участников

Иконки в стиле ризографии (K5): восемь из листов A–C и шесть из листов D–E. Сгенерированы владельцем проекта в Magnific (модель
Nano Banana) тремя листами 1024×434 — `prototype/assets/sheet-a.jpg`, `sheet-b.jpg`,
`sheet-c.jpg`; лист одобрен владельцем (K42, дизайн M1.2 D1 a). Иконки вырезаны из листов как есть
командой `sh scripts/cut-icons.sh` (ImageMagick): вырезка 310×275, мягкие края 24 px уходят в
прозрачность, WebP качества 82 с прозрачностью.

**Лицензия: использование на сайте разрешено условиями Magnific; выпуск под CC BY-SA в открытом
репозитории — решение владельца** (пробел G10, раздел «Условия Magnific» ниже). Если владелец решит,
что нельзя, — иконки перерисовываются (дизайн M1.2, вариант D1 b).

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
бумаги. Лицензия та же, что у листов A–C (G10).

### Листы

| Файл | Источник | Лицензия |
|---|---|---|
| `prototype/assets/sheet-a.jpg` | Magnific, Nano Banana; сгенерировал владелец проекта | условия Magnific для ИИ-контента (ниже) |
| `prototype/assets/sheet-b.jpg` | Magnific, Nano Banana; сгенерировал владелец проекта | условия Magnific для ИИ-контента (ниже) |
| `prototype/assets/sheet-c.jpg` | Magnific, Nano Banana; сгенерировал владелец проекта | условия Magnific для ИИ-контента (ниже) |
| `prototype/assets/sheet-d.jpg` | Magnific, Google Nano Banana 2.1, платный тариф владельца, 2026-11-19 (K121) | условия Magnific для ИИ-контента (ниже) |
| `prototype/assets/sheet-e.jpg` | Magnific, Google Nano Banana 2.1, платный тариф владельца, 2026-11-19 (K121) | условия Magnific для ИИ-контента (ниже) |

### Условия Magnific (G10)

Прочитаны 2026-11-19 на двух страницах справки Magnific:
`https://www.magnific.com/ai/docs/ai-content-and-copyright` (AI, stock content and copyright) и
`https://www.magnific.com/ai/docs/usage-rights-general-rules` (Usage rights: general rules). Ниже
пересказ своими словами и короткие цитаты; юридическую силу имеют сами условия Magnific (Terms and
Conditions for AI Products), а не этот пересказ.

1. **Коммерческое использование.** На платном тарифе выход ИИ можно использовать в том числе
   коммерчески: «Paid plans include a commercial license for AI-generated content». На бесплатном —
   только личное использование и с указанием авторства. Ограничения «главный / второстепенный
   элемент», которое действует для стоковых картинок, у ИИ-контента нет. Править выход можно как
   угодно (вырезать, менять цвета, совмещать).
2. **Авторское право не гарантировано.** Magnific прямо пишет, что не может гарантировать
   авторское право на выход ИИ во всех юрисдикциях: «Magnific cannot guarantee copyright ownership
   of AI-generated output in all jurisdictions». Правовой статус такого контента зависит от страны
   и меняется.
3. **Чужие права — на пользователе.** Пользователь сам отвечает за то, чтобы картинка не нарушала
   права третьих лиц (чужие персонажи, произведения, знаки, узнаваемые люди). Стандартная
   юридическая защита (возмещение по претензиям) на ИИ-контент не распространяется.
4. **Общие правила для «всего контента Magnific»** запрещают распространять ресурсы в исходном
   или редактируемом виде, класть их в коллекции, которые другие могут скачать, и передавать их по
   сублицензии. Страница про ИИ-контент перечисляет, чем ИИ-контент отличается от стока, но этот
   запрет в отличиях не упомянут, то есть прямо не снят. Открытый репозиторий с иконками под
   CC BY-SA 4.0 — это и раздача для скачивания, и разрешение другим использовать дальше, поэтому
   здесь условия читаются неоднозначно.

**Что из этого следует для проекта.** Иконки на сайте `hacks.antipic.com` (собственный сайт, без
продажи иконок отдельно) укладываются в пункт 1 — при условии, что все листы сделаны на платном
тарифе. Листы D и E — да (K121); **для листов A–C тариф на момент генерации не записан, это должен
подтвердить владелец.** Можно ли выложить эти иконки под CC BY-SA 4.0 в открытый репозиторий —
**решение владельца до открытия репозитория** (пункты 2 и 4; при сомнении — L1.3 и вариант D1 b,
перерисовать). Пока репозиторий закрыт (K120), иконки никому не раздаются, кроме как картинками
на сайте.

## Карточки для соцсетей

Картинки 1200×630 для превью ссылок (Open Graph, Twitter card, M4.3): по одной на урок и язык и
карточка сайта на язык (страница «О проекте» и главный адрес). Нарисованы скриптом
`npm run cards` (`scripts/make-cards.mjs`, ImageMagick) из названия урока и класса атаки
(паспорт, `class`), до трёх иконок участников урока (`content/icons/`, их лицензия — выше) и
шрифтов сайта Onest и JetBrains Mono (SIL OFL, ниже). Лицензия — как у текстов и схем уроков,
CC BY-SA 4.0, с оговоркой G10 про иконки. Устаревшую карточку (поменялись название, иконки,
цвета или вёрстка) ловит gate (`scripts/cards.test.ts`).

| Файл | Что | Источник |
|---|---|---|
| `public/cards/about.ru.png` | карточка сайта и «О проекте», ru | `npm run cards` из текста урока, иконок (user, workstation, server) и шрифтов сайта |
| `public/cards/A1.ru.png` | карточка урока A1, ru | `npm run cards` из текста урока, иконок (user, workstation, server) и шрифтов сайта |
| `public/cards/A2.ru.png` | карточка урока A2, ru | `npm run cards` из текста урока, иконок (workstation, document, db) и шрифтов сайта |
| `public/cards/A3.ru.png` | карточка урока A3, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/A4.ru.png` | карточка урока A4, ru | `npm run cards` из текста урока, иконок (server, attacker, db) и шрифтов сайта |
| `public/cards/A5.ru.png` | карточка урока A5, ru | `npm run cards` из текста урока, иконок (attacker, user, server) и шрифтов сайта |
| `public/cards/A6.ru.png` | карточка урока A6, ru | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/A7.ru.png` | карточка урока A7, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/A8.ru.png` | карточка урока A8, ru | `npm run cards` из текста урока, иконок (attacker, mail, workstation) и шрифтов сайта |
| `public/cards/B1.ru.png` | карточка урока B1, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/C1.ru.png` | карточка урока C1, ru | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/C2.ru.png` | карточка урока C2, ru | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/C3.ru.png` | карточка урока C3, ru | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/C4.ru.png` | карточка урока C4, ru | `npm run cards` из текста урока, иконок (attacker, document, browser) и шрифтов сайта |
| `public/cards/C5.ru.png` | карточка урока C5, ru | `npm run cards` из текста урока, иконок (attacker, document, browser) и шрифтов сайта |
| `public/cards/C6.ru.png` | карточка урока C6, ru | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/D1.ru.png` | карточка урока D1, ru | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D2.ru.png` | карточка урока D2, ru | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D3.ru.png` | карточка урока D3, ru | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D4.ru.png` | карточка урока D4, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/D5.ru.png` | карточка урока D5, ru | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D6.ru.png` | карточка урока D6, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/D7.ru.png` | карточка урока D7, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/D8.ru.png` | карточка урока D8, ru | `npm run cards` из текста урока, иконок (server, attacker, db) и шрифтов сайта |
| `public/cards/E1.ru.png` | карточка урока E1, ru | `npm run cards` из текста урока, иконок (user, attacker, router) и шрифтов сайта |
| `public/cards/F1.ru.png` | карточка урока F1, ru | `npm run cards` из текста урока, иконок (user, server, db) и шрифтов сайта |
| `public/cards/G1.ru.png` | карточка урока G1, ru | `npm run cards` из текста урока, иконок (user, attacker, router) и шрифтов сайта |
| `public/cards/H2.ru.png` | карточка урока H2, ru | `npm run cards` из текста урока, иконок (attacker, workstation, server) и шрифтов сайта |
| `public/cards/I1.ru.png` | карточка урока I1, ru | `npm run cards` из текста урока, иконок (attacker, user, browser) и шрифтов сайта |
| `public/cards/J1.ru.png` | карточка урока J1, ru | `npm run cards` из текста урока, иконок (attacker, server, assistant) и шрифтов сайта |
| `public/cards/K1.ru.png` | карточка урока K1, ru | `npm run cards` из текста урока, иконок (server, attacker, log) и шрифтов сайта |
| `public/cards/B2.ru.png` | карточка урока B2, ru | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/B3.ru.png` | карточка урока B3, ru | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B4.ru.png` | карточка урока B4, ru | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B5.ru.png` | карточка урока B5, ru | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/B6.ru.png` | карточка урока B6, ru | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B7.ru.png` | карточка урока B7, ru | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B8.ru.png` | карточка урока B8, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/C7.ru.png` | карточка урока C7, ru | `npm run cards` из текста урока, иконок (attacker, browser, bank) и шрифтов сайта |
| `public/cards/E2.ru.png` | карточка урока E2, ru | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/E3.ru.png` | карточка урока E3, ru | `npm run cards` из текста урока, иконок (attacker, server, mail) и шрифтов сайта |
| `public/cards/E4.ru.png` | карточка урока E4, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/E5.ru.png` | карточка урока E5, ru | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/H4.ru.png` | карточка урока H4, ru | `npm run cards` из текста урока, иконок (attacker, workstation, server) и шрифтов сайта |
| `public/cards/H5.ru.png` | карточка урока H5, ru | `npm run cards` из текста урока, иконок (attacker, document, server) и шрифтов сайта |
| `public/cards/H6.ru.png` | карточка урока H6, ru | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/I2.ru.png` | карточка урока I2, ru | `npm run cards` из текста урока, иконок (attacker, user, bank) и шрифтов сайта |
| `public/cards/about.en.png` | карточка сайта и «О проекте», en | `npm run cards` из текста урока, иконок (user, workstation, server) и шрифтов сайта |
| `public/cards/A1.en.png` | карточка урока A1, en | `npm run cards` из текста урока, иконок (user, workstation, server) и шрифтов сайта |
| `public/cards/A2.en.png` | карточка урока A2, en | `npm run cards` из текста урока, иконок (workstation, document, db) и шрифтов сайта |
| `public/cards/A3.en.png` | карточка урока A3, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/A4.en.png` | карточка урока A4, en | `npm run cards` из текста урока, иконок (server, attacker, db) и шрифтов сайта |
| `public/cards/A5.en.png` | карточка урока A5, en | `npm run cards` из текста урока, иконок (attacker, user, server) и шрифтов сайта |
| `public/cards/A6.en.png` | карточка урока A6, en | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/A7.en.png` | карточка урока A7, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/A8.en.png` | карточка урока A8, en | `npm run cards` из текста урока, иконок (attacker, mail, workstation) и шрифтов сайта |
| `public/cards/B1.en.png` | карточка урока B1, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/C1.en.png` | карточка урока C1, en | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/C2.en.png` | карточка урока C2, en | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/C3.en.png` | карточка урока C3, en | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/C4.en.png` | карточка урока C4, en | `npm run cards` из текста урока, иконок (attacker, document, browser) и шрифтов сайта |
| `public/cards/C5.en.png` | карточка урока C5, en | `npm run cards` из текста урока, иконок (attacker, document, browser) и шрифтов сайта |
| `public/cards/C6.en.png` | карточка урока C6, en | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/D1.en.png` | карточка урока D1, en | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D2.en.png` | карточка урока D2, en | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D3.en.png` | карточка урока D3, en | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D4.en.png` | карточка урока D4, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/D5.en.png` | карточка урока D5, en | `npm run cards` из текста урока, иконок (user, attacker, server) и шрифтов сайта |
| `public/cards/D6.en.png` | карточка урока D6, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/D7.en.png` | карточка урока D7, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/D8.en.png` | карточка урока D8, en | `npm run cards` из текста урока, иконок (server, attacker, db) и шрифтов сайта |
| `public/cards/E1.en.png` | карточка урока E1, en | `npm run cards` из текста урока, иконок (user, attacker, router) и шрифтов сайта |
| `public/cards/F1.en.png` | карточка урока F1, en | `npm run cards` из текста урока, иконок (user, server, db) и шрифтов сайта |
| `public/cards/G1.en.png` | карточка урока G1, en | `npm run cards` из текста урока, иконок (user, attacker, router) и шрифтов сайта |
| `public/cards/H2.en.png` | карточка урока H2, en | `npm run cards` из текста урока, иконок (attacker, workstation, server) и шрифтов сайта |
| `public/cards/I1.en.png` | карточка урока I1, en | `npm run cards` из текста урока, иконок (attacker, user, browser) и шрифтов сайта |
| `public/cards/J1.en.png` | карточка урока J1, en | `npm run cards` из текста урока, иконок (attacker, server, assistant) и шрифтов сайта |
| `public/cards/K1.en.png` | карточка урока K1, en | `npm run cards` из текста урока, иконок (server, attacker, log) и шрифтов сайта |
| `public/cards/B2.en.png` | карточка урока B2, en | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/B3.en.png` | карточка урока B3, en | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B4.en.png` | карточка урока B4, en | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B5.en.png` | карточка урока B5, en | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/B6.en.png` | карточка урока B6, en | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B7.en.png` | карточка урока B7, en | `npm run cards` из текста урока, иконок (attacker, server, document) и шрифтов сайта |
| `public/cards/B8.en.png` | карточка урока B8, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/C7.en.png` | карточка урока C7, en | `npm run cards` из текста урока, иконок (attacker, browser, bank) и шрифтов сайта |
| `public/cards/E2.en.png` | карточка урока E2, en | `npm run cards` из текста урока, иконок (attacker, browser, server) и шрифтов сайта |
| `public/cards/E3.en.png` | карточка урока E3, en | `npm run cards` из текста урока, иконок (attacker, server, mail) и шрифтов сайта |
| `public/cards/E4.en.png` | карточка урока E4, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/E5.en.png` | карточка урока E5, en | `npm run cards` из текста урока, иконок (attacker, server, db) и шрифтов сайта |
| `public/cards/H4.en.png` | карточка урока H4, en | `npm run cards` из текста урока, иконок (attacker, workstation, server) и шрифтов сайта |
| `public/cards/H5.en.png` | карточка урока H5, en | `npm run cards` из текста урока, иконок (attacker, document, server) и шрифтов сайта |
| `public/cards/H6.en.png` | карточка урока H6, en | `npm run cards` из текста урока, иконок (attacker, server, workstation) и шрифтов сайта |
| `public/cards/I2.en.png` | карточка урока I2, en | `npm run cards` из текста урока, иконок (attacker, user, bank) и шрифтов сайта |

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

## Зависимости

Все пакеты npm проекта — инструменты разработки и сборки (`devDependencies`); в собранный сайт
попадает только код Svelte (MIT). Закон L1 проверяет `scripts/licenses.mjs` (запуск руками:
`npm run licenses`; в gate — через `scripts/licenses.test.mjs`): каждый установленный пакет в
`node_modules`, вложенные тоже, и каждый пакет из `package-lock.json` (так проверяются и пакеты
только для Linux, которые ставит CI) должны быть под MIT, Apache-2.0, BSD-n-Clause, ISC, Zlib или
MPL-2.0. Выражение SPDX читается по правилам: `A OR B` — достаточно одной, `A AND B` — нужны обе,
`WITH` не допускается. Пакет без лицензии валит проверку.

На 2026-11-19 (macOS, 211 установленных пакетов): MIT 166, Apache-2.0 21, BSD-2-Clause 8, ISC 8,
MPL-2.0 4, BSD-3-Clause 2, BlueOak-1.0.0 2. В lockfile ещё один пакет под 0BSD.

Исключения (записаны в `scripts/licenses.mjs` вместе с причиной; исключение действует только для
этого пакета с этой лицензией):

| Пакет | Лицензия | Почему можно |
|---|---|---|
| `minimatch` | BlueOak-1.0.0 | разрешительная лицензия, одобрена OSI, как MIT плюс патентная оговорка; только разработка (через eslint и typescript-eslint), на сайт не попадает |
| `@isaacs/nonrecursive-glob-match` | BlueOak-1.0.0 | то же, зависимость `minimatch` |
| `tslib` | 0BSD | BSD без условия об уведомлении, мягче BSD-2-Clause; необязательный пакет разработки (запасной WebAssembly-вариант инструментов сборки), на macOS и Linux x64 не ставится |

Новое исключение добавляется только с решением владельца (L3).

## Тексты чужих авторов

| Файл | Что | Источник | Лицензия |
|---|---|---|---|
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1; изменён только способ связи в разделе «Enforcement» | https://www.contributor-covenant.org/version/2/1/code_of_conduct/ (скачано 2026-11-19) | CC BY 4.0 |
