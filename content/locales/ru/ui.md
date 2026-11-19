# Интерфейс

`ui` ru · `format` 1

Строки интерфейса сайта (M2.3, K105). Строка — `` - `ключ` Текст ``; ключи одинаковы во всех
языках и берутся из этого файла, `{имя}` — значение, которое подставляет код. Перевод держит те
же ключи и те же `{имена}`; новая строка сначала появляется здесь.

## Сайт

- `app.tagline` Как устроены атаки и как от них защититься
- `app.language` Язык сайта
- `format.decimal` ,

## Страница не найдена

- `page.notFound.title` Такой страницы нет
- `page.notFound.text` Проверьте адрес или откройте урок с главной.
- `page.home` На главную

## Загрузка урока

- `lesson.loading` Загружаем урок…
- `lesson.error.title` Не удалось открыть урок.
- `lesson.error.notFound` Такого урока нет или он ещё не переведён на этот язык.
- `lesson.error.network` Нет связи с сайтом. Проверьте подключение к интернету и попробуйте снова.
- `lesson.error.badData` Файл урока повреждён или устарел. Попробуйте снова; если не поможет — обновите страницу.
- `lesson.error.timeout` Урок загружается слишком долго. Проверьте подключение и попробуйте снова.
- `lesson.retry` Попробовать снова
- `lesson.noSteps` В этом режиме у урока нет шагов.

## Плеер

- `player.label` Управление уроком
- `player.status` Шаг {step} из {count}
- `player.statusUnknown` Шаг {step}
- `player.back` Шаг назад
- `player.play` Пуск
- `player.pause` Пауза
- `player.next` Шаг вперёд
- `player.nextShort` Шаг
- `player.restart` Сначала
- `player.speed` Скорость {speed}, нажать — {next}

## Защита

- `defence.mode` Режим урока
- `defence.off` Без защиты
- `defence.on` С защитой
- `defence.name` Защита: {name}
- `defence.isOff` Защита выключена

## Объяснение

- `explain.title` Объяснение
- `explain.depths` Глубина объяснения
- `explain.depth.simple` Просто
- `explain.depth.steps` По шагам
- `explain.depth.deep` Глубже
- `explain.step` Шаг {number} из {count}. {title}
- `explain.passport` Паспорт
- `explain.defence` Как защититься
- `explain.sources` Источники
- `explain.more` Ниже ещё ↓
- `code.step` Код шага
- `code.label` Код: {label}
- `code.compare` {label} — для сравнения

## Паспорт

- `passport.class` Класс
- `passport.severity` Тяжесть
- `passport.impact` Что получает атакующий
- `passport.defence` Защита
- `severity.none` нет
- `severity.low` низкая
- `severity.medium` средняя
- `severity.high` высокая
- `severity.critical` критическая
- `cwe.22` Обход пути к файлу
- `cwe.78` Внедрение команд ОС
- `cwe.79` Межсайтовый скриптинг (XSS)
- `cwe.89` SQL-инъекция
- `cwe.352` Подделка межсайтового запроса (CSRF)
- `cwe.918` Подделка запроса со стороны сервера (SSRF)

## Ход атаки

- `log.title` Ход атаки
- `steps.number` №
- `steps.step` Шаг
- `steps.from` Кто
- `steps.to` Кому
- `steps.sent` Что отправлено
- `steps.result` Итог
- `steps.mark` Отметка
- `steps.goto` Шаг {number}: {title}
- `steps.notYet` ещё не было

## Отметки сообщений

- `mark.legit` обычное
- `mark.attack` вредное
- `mark.safe` безопасное
- `mark.stopped` остановлено
- `mark.moving` в пути

## Схема

- `scene.title` Схема урока «{title}»
- `scene.empty` На схеме нет участников.
- `scene.participants` Участники слева направо: {list}.
- `scene.zones` Зоны доверия: {list}.
- `scene.dangerZone` {label} (опасная)
- `scene.step` Шаг {number} из {count}. {title}: {route}, {kind} сообщение «{message}».
- `scene.stepStopped` Шаг {number} из {count}. {title}: {route}, {kind} сообщение «{message}» остановлено.
- `scene.stepStoppedAt` Шаг {number} из {count}. {title}: {route}, {kind} сообщение «{message}» остановлено у участника «{name}».
- `scene.stays` у участника «{name}»
- `scene.term` {name}: что это

## Словарь

- `glossary.title` Словарь
- `glossary.close` Закрыть
- `glossary.loading` Загружаем словарь…
- `glossary.error` Не удалось загрузить словарь.
- `glossary.unknown` Такого слова в словаре нет.
- `glossary.see` См. также
- `glossary.lessons` Уроки

## Названия команд

- `command.theme.set` Тема оформления
- `command.depth.set` Глубина объяснения
- `command.locale.set` Язык сайта
- `command.glossary.open` Открыть определение
- `command.glossary.close` Закрыть определение
- `command.clock.set` Перевести часы плеера
- `command.clock.tick` Сдвинуть часы плеера
- `command.player.play` Пуск
- `command.player.pause` Пауза
- `command.player.step` Шаг вперёд
- `command.player.back` Шаг назад
- `command.player.goto` Перейти к шагу
- `command.player.speed` Скорость
- `command.defence.toggle` Переключить защиту
- `command.defence.set` Включить или выключить защиту
- `command.lesson.open` Открыть урок
