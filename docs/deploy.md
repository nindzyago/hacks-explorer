# Выкладка на Cloudflare

Решения: K10, K12, K13. Сайт — Cloudflare Workers со статикой. Cloudflare сам собирает
репозиторий по событиям GitHub (Workers Builds через приложение Cloudflare в GitHub). В GitHub
нет ни одного секрета Cloudflare; GitHub Actions только проверяет (`gate`).

## Что откуда берётся

| Событие | Что делает Cloudflare | Адрес |
|---|---|---|
| push в `main` | `npm run build`, затем `npx wrangler deploy` | черновой: `https://hacks-explorer.<поддомен>.workers.dev` |
| push в любую другую ветку, pull request | `npm run build`, затем `npx wrangler preview` | предпросмотр: `https://<ветка>-hacks-explorer.<поддомен>.workers.dev`, ссылка приходит комментарием в pull request |
| pull request из форка | ничего: Cloudflare форки не собирает | нет; `gate` в GitHub Actions при этом работает |

`<поддомен>` — поддомен `workers.dev` учётной записи (Workers & Pages → справа Subdomain).

Файлы в репозитории: `wrangler.jsonc` (имя Worker, папка `dist`, отдача `index.html` на
неизвестные адреса), `public/_headers` (заголовки безопасности), `.node-version` (Node 22 для
сборки). Их проверяет `scripts/deploy-config.test.mjs` в `npm run gate`.

## Один раз в панели Cloudflare (делает владелец)

Названия пунктов и полей взяты из документации Cloudflare на 2026-11-17 (Workers Builds:
configuration, build branches, GitHub integration; custom domains). Сама панель при этом не
открывалась: если пункт называется иначе, ориентироваться на значение поля.

1. `dash.cloudflare.com` → учётная запись, где зона `antipic.com` → слева **Workers & Pages** →
   **Create application** → **GitHub**.
2. GitHub попросит поставить приложение **Cloudflare Workers & Pages**: учётная запись
   `nindzyago` → **Only select repositories** → `hacks-explorer` → **Install & Authorize**.
3. Вернувшись в Cloudflare, выбрать и заполнить:

   | Поле | Значение |
   |---|---|
   | Git account | `nindzyago` |
   | Git repository | `nindzyago/hacks-explorer` |
   | Project name (имя Worker) | `hacks-explorer` — ровно как `name` в `wrangler.jsonc`, иначе сборка падает |
   | Git branch (основная ветка) | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` (значение по умолчанию) |
   | Preview command | `npx wrangler preview` (значение по умолчанию) |
   | Root directory | пусто |
   | API token | не трогать: Cloudflare создаёт токен сам и хранит у себя, в GitHub он не попадает |
   | Build variables and secrets | пусто |

4. **Save and Deploy.** Первая сборка выкладывает `main` на черновой адрес.
5. Worker `hacks-explorer` → **Settings** → **Build** → **Branch control**: в списке веток
   выбрана `main`, галочка **Enable Preview Builds** стоит.
6. Worker `hacks-explorer` → **Settings** → **Domains & Routes**: `workers.dev` включён, Preview
   URLs включены. Здесь же виден полный черновой адрес — записать его в `plan/STATUS.md`.
7. Не включать Web Analytics и другие добавки, которые вставляют в страницу свой скрипт (L6;
   политика из `_headers` такой скрипт всё равно заблокирует).

Домен `hacks.antipic.com` сейчас **не подключается**: это публикация, её разрешает владелец в
M4.7.

## Проверка (тестовый pull request)

1. Открыть черновой адрес: страница «Hacks Explorer»; адрес вида `/ru/lesson/B1` открывает ту же
   страницу, а не 404.
2. Завести ветку в этом же репозитории, открыть pull request: проверка `gate` зелёная, проверка
   Workers Builds зелёная, в комментарии Cloudflare есть Preview URL, и он открывается.
3. В инструментах разработчика → Network → документ: в ответе есть `content-security-policy`,
   `x-content-type-options: nosniff`, `x-robots-tag: noindex`; в консоли нет ошибок CSP.
4. Журнал сборок: Worker → **Deployments** → внизу **View build history**.

## Что нужно знать

- Черновой адрес и предпросмотры открыты всем, кто знает ссылку, хотя репозиторий закрыт.
  Поисковикам они запрещены заголовком. Закрыть входом можно через Cloudflare Access — решает
  владелец.
- Политика в `_headers` запрещает встроенные скрипты и стили (`<script>` без `src`, `<style>`,
  `style="…"` в разметке). `npm run dev` и `npm run preview` эти заголовки не отдают, поэтому
  нарушение видно только на адресе Cloudflare.
- Предпросмотры закрытых pull request Cloudflare сам не удаляет; лимит бесплатного тарифа — 100
  на Worker, при переполнении удаляется самый старый. Сборка: 3000 минут в месяц, одна за раз,
  не дольше 20 минут.
- В комментарии «No Preview URL» при зелёной сборке — проверить шаг 6 и что Preview command
  равна `npx wrangler preview`.
- Сборка упала на `npm ci` с рассинхроном — указать точную версию в `packageManager` в
  `package.json` (образ Cloudflare использует npm 10.9.2).

## Позже

- **M4.6, выпуск по тегу:** появляется ветка `release`; в **Settings** → **Build** →
  **Branch control** основная ветка меняется на `release`. После этого `main` становится обычным
  предпросмотром, и черновой адрес меняется на
  `https://main-hacks-explorer.<поддомен>.workers.dev`.
- **M4.7, публикация:** **Settings** → **Domains & Routes** → **Add** → **Custom Domain** →
  `hacks.antipic.com` → **Add Custom Domain**. Cloudflare сам создаёт запись DNS и сертификат; у
  имени не должно быть записи CNAME.
