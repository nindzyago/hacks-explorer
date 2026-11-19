# Учебная атака

`lesson` X1 · `section` X · `wave` 2 · `format` 1

## Паспорт

- `cwe` 89, 564
- `owasp` A03:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
- `cves` CVE-2021-44288
- `severity` high
- `impact` Чужие данные
- `defence` Проверка на сервере

## Источники

- [OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/index.html)

## Участники

- `attacker` **Атакующий** — 203.0.113.66
- `user` **Посетитель** — 2001:db8::24 · `icon:laptop`
- `site` **Сайт** — shop.example

## Зоны

- `outside` Снаружи: `attacker`
- `inside` Внутри: `user`, `site` · `danger`

## Шаги

### `send` Отправка

`attacker → site` · `attack` · `icon:mail`
Сообщение: письмо · Итог: доставлено

```http
GET /?q=⟦evil⟧ HTTP/1.1
Host: shop.example
```

#### Просто

Атакующий шлёт **запрос** на `shop.example`.

#### По шагам

1. Первый пункт.
2. Второй *пункт*.

#### Глубже

Подробности: адрес 192.0.2.10, сеть 198.51.100.0/24, почта anna@mail.test.

### `pass` Пропуск

`site → user` · `attack` · `without-defence`
Сообщение: ответ · Итог: атака прошла

#### Просто

Сайт пропускает.

#### По шагам

Сайт пропускает запрос.

#### Глубже

Сайт пропускает запрос без проверки.

### `block` Отказ

`site → attacker` · `safe` · `with-defence` · `stopped`
Сообщение: отказ · Итог: остановлено

#### Просто

Сайт отказывает.

#### По шагам

Сайт проверяет запрос и отказывает.

#### Глубже

Сайт сверяет запрос со списком разрешённого.

## Как защититься

Проверяйте запрос на сервере.
