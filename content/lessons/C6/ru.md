# Ошибки CORS

`lesson` C6 · `section` C · `wave` 3 · `format` 1

## Паспорт

- `cwe` 942
- `owasp` A05:2021
- `severity` high
- `impact` Чужой сайт читает личные данные пользователя из API от его имени
- `defence` Точный список разрешённых происхождений
- `class` Слишком широкая политика доступа между сайтами

## Источники

- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN: Access-Control-Allow-Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin)
- [MDN: Access-Control-Allow-Credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials)
- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [WHATWG Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [MITRE CWE-942: Permissive Cross-domain Security Policy with Untrusted Domains](https://cwe.mitre.org/data/definitions/942.html)
- [OWASP Top 10:2021, A05 Security Misconfiguration](https://owasp.org/Top10/2021/A05_2021-Security_Misconfiguration/)
- [OWASP Top 10:2021, A01 Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/)
- [MDN: Set-Cookie, атрибут SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

## Участники

- `evil` **Сайт атакующего** — evil.example · `icon:attacker` · `term:attacker`
- `browser` **Браузер жертвы** — 192.0.2.24 · `term:victim`
- `api` **API магазина** — api.shop.example · `icon:server` · `term:cors`

## Зоны

- `evil-site` Чужой сайт: `evil` · `danger` · `term:same-origin-policy`
- `home` Дом: `browser`
- `site` Магазин: `api` · `term:trust-boundary`

## Шаги

### `visit` Страница со скрытым запросом

`evil → browser` · `attack`
Сообщение: страница со скриптом · Итог: открыта

```js
fetch('https://api.shop.example/profile', { ⟦credentials: 'include'⟧ })
```

#### Просто

Жертва заходит на чужой сайт, например с бесплатными играми. Пока она смотрит на страницу,
скрипт этого сайта **тихо просит у API её магазина** личный профиль.

#### По шагам

Скрипт вызывает `fetch` к api.shop.example и просит приложить учётные данные: `credentials:
'include'`. Тогда браузер добавит к запросу cookie магазина, если они у жертвы есть.

#### Глубже

Отправить такой запрос браузер разрешает любому сайту. Важно другое: сможет ли скрипт
**прочитать ответ**. По умолчанию нет, и это правило одного происхождения (*same-origin policy*):
происхождение — это схема, имя и порт, а evil.example и api.shop.example — разные.

### `request` Запрос уходит с cookie

`browser → api` · `attack`
Сообщение: GET /profile · Итог: запрос принят

```http
GET /profile
Host: api.shop.example
Origin: ⟦https://evil.example⟧
Cookie: session=7f3a9c
```

#### Просто

Браузер отправляет запрос в магазин и прикладывает **пропуск** жертвы, cookie сессии. Ещё он
честно пишет, кто спрашивает: заголовок `Origin` с адресом чужого сайта.

#### По шагам

Это простой запрос `GET` без особых заголовков, поэтому предварительной проверки
(*preflight*, запрос `OPTIONS`) нет: браузер сразу шлёт сам запрос. Сервер видит cookie и
находит профиль жертвы.

#### Глубже

Cookie уходит с запросом `fetch` с чужого сайта, только если он помечен `SameSite=None`. По MDN
при `Lax` и `Strict` браузер не прикладывает cookie к таким запросам. Здесь API работает с
виджетами на разных сайтах, поэтому его cookie — `SameSite=None`.

### `reflect` Сервер разрешает всем, кто спросил

`api → browser` · `attack` · `without-defence`
Сообщение: профиль и заголовки CORS · Итог: браузер разрешил чтение

```http
Access-Control-Allow-Origin: ⟦https://evil.example⟧
Access-Control-Allow-Credentials: true

{"name": "Анна", "phone": "...", "address": "..."}
```

#### Просто

Сервер магазина устроен «по-доброму»: кто бы ни спросил, он отвечает **«тебе можно»**. Браузер
видит разрешение и отдаёт профиль скрипту чужого сайта.

#### По шагам

Сервер копирует значение `Origin` из запроса в заголовок `Access-Control-Allow-Origin` и
добавляет `Access-Control-Allow-Credentials: true`. Это и есть ошибка: разрешение получает любой
сайт, а не только свои.

#### Глубже

Звёздочку `*` с учётными данными использовать нельзя: по MDN браузер вернёт ошибку. Поэтому
разработчики, которым «надо, чтобы работало», отражают `Origin` как есть. Это ошибка CWE-942:
политика доступа между сайтами доверяет недоверенным. В OWASP Top 10:2021 такая ошибка
настройки входит в A05, а неверный CORS прямо назван в A01.

### `leak` Профиль уходит атакующему

`browser → evil` · `attack` · `without-defence`
Сообщение: имя, телефон, адрес · Итог: утекли

#### Просто

Скрипт получил ответ и **отправил профиль** на сервер атакующего. Жертва ничего не заметила.

#### По шагам

Скрипт читает тело ответа как JSON и пересылает его на evil.example. Так же он может прочитать
историю заказов или любой другой ответ API, который видит сама жертва.

#### Глубже

Опасно не только отражение `Origin`. Разрешать `null` нельзя: по MDN такое происхождение может
получить любой сайт, например через песочницу в рамке. Ненадёжна и проверка по концу имени:
правило «кончается на shop.example» пропустит и чужой evilshop.example.

### `check` Сервер сверяет Origin со списком

`api → api` · `attack` · `with-defence` · `stopped`
Сообщение: чужой Origin · Итог: не в списке, разрешения нет

```text
разрешены: https://shop.example, https://m.shop.example
пришёл:    ⟦https://evil.example⟧  →  заголовков CORS нет
```

#### Просто

Теперь у сервера есть **точный список своих сайтов**. evil.example в нём нет, и разрешение на
чтение он не получает. Здесь атака и останавливается.

#### По шагам

Сервер сравнивает `Origin` с каждым адресом списка целиком. Совпало — ставит этот адрес в
`Access-Control-Allow-Origin`. Не совпало — заголовки CORS не добавляет вовсе.

#### Глубже

Если ответ зависит от `Origin`, по MDN нужно отправлять и `Vary: Origin`, чтобы кэш не выдал
ответ для одного сайта другому. И помните: CORS решает только, кому можно **читать** ответ.
Сам запрос всё равно доходит до сервера, поэтому от подделки запросов (CSRF) защищаются
отдельно.

### `blocked` Браузер не отдаёт ответ

`api → browser` · `safe` · `with-defence`
Сообщение: ответ без разрешения CORS · Итог: скрипт получил ошибку

```http
HTTP/1.1 200 OK
Vary: Origin
```

#### Просто

Ответ приходит в браузер, но **разрешения для чужого сайта в нём нет**. Браузер не показывает
его скрипту, и тот получает только ошибку сети.

#### По шагам

Браузер проверяет заголовки CORS. `Access-Control-Allow-Origin` нет, значит, чтение запрещено
правилом одного происхождения. Профиль остаётся в браузере жертвы и в чужой скрипт не попадает.

#### Глубже

Защиту здесь выполняет браузер, а решает сервер: он выдаёт разрешения. Поэтому ошибка CORS —
всегда ошибка настройки сервера, и исправляют её в коде или конфигурации API.

## Как защититься

- **Точный список.** Разрешайте только свои сайты, перечисленные полностью: схема, имя и порт.
  Сравнивайте `Origin` со списком целиком, без проверок «начинается с» или «кончается на».
- **Не отражайте Origin.** Копировать заголовок запроса в `Access-Control-Allow-Origin` — значит
  разрешить всем.
- **Не разрешайте `null`.** Такое происхождение может получить любой сайт.
- **Учётные данные — только где нужно.** `Access-Control-Allow-Credentials: true` ставьте лишь для
  адресов, которые правда нужны своим сайтам с cookie. Звёздочку `*` оставьте для открытых
  данных без входа.
- **`Vary: Origin`.** Если ответ зависит от `Origin`, скажите об этом кэшам.
- **SameSite для cookie сессии.** С `Lax` или `Strict` браузер не приложит cookie к `fetch` с
  чужого сайта.
- **CORS не защищает от CSRF.** Он решает, кто читает ответ, а запрос всё равно доходит до сервера.
