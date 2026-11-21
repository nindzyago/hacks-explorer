# Web cache poisoning

`lesson` E2 · `section` E · `wave` 1 · `format` 1

## Passport

- `severity` high
- `impact` Every visitor of the page gets a harmful response from the cache without sending anything suspicious themselves
- `defence` Addresses from the site's settings, not from request headers; everything that changes the response goes into the cache key
- `class` Swapping a response in a shared cache

## Sources

- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [RFC 7239: Forwarded HTTP Extension](https://www.rfc-editor.org/rfc/rfc7239.html)
- [OWASP WSTG-INPV-17: Testing for Host Header Injection](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/07-Input_Validation_Testing/17-Testing_for_Host_Header_Injection/)
- [MDN: X-Forwarded-Host](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-Host)
- [MDN: Vary](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `browser` **Visitor** — browser, 192.0.2.24 · `icon:browser` · `term:victim`
- `cache` **Cache** — 198.51.100.5 · `icon:server` · `term:web-cache`
- `server` **Server** — news.example · `term:web-server`

## Zones

- `internet` Internet: `attacker`
- `home` Home: `browser`
- `site` Site news.example: `cache`, `server` · `term:trust-boundary`

## Steps

### `send` A request with an extra header

`attacker → cache` · `attack`
Message: GET /news + a foreign header · Result: not in the cache, passed on

```http
GET /news
Host: news.example
⟦X-Forwarded-Host: evil.example⟧
```

#### Simple

A news site has a **web cache** in front of it: it remembers ready-made pages and hands them out
to visitors itself, so the server doesn't build the same page a thousand times. The attacker asks
for the news front page and adds **an extra header** with his own domain.

#### Step by step

The cache looks for a stored response by its **cache key**: the method and the address, here `GET`
and `news.example/news`. The `X-Forwarded-Host` header is not part of the key; the cache doesn't
even look at it. There is no fresh copy, so the cache passes the whole request to the server,
attacker's header included.

#### Deeper

RFC 9111, section 2: the cache key consists of at least the request method and the target URI.
The standard adds request headers to the key through the `Vary` response header (section 4.1).
Anything that changes the response but stays out of the key is a hole: two different requests get
one entry. The attacker picks the moment the old copy has expired, so that his request comes first.

### `forward` The cache passes the request on

`cache → server` · `attack` · `without-defence`
Message: GET /news + X-Forwarded-Host · Result: the server trusted the header

```http
GET /news
Host: news.example
⟦X-Forwarded-Host: evil.example⟧
```

#### Simple

The server gets the request and sees the `X-Forwarded-Host` header. It thinks: “I must have been
opened under another name, I'll build links from that one” — and **trusts** someone else's value.

#### Step by step

A header like this is usually set by a proxy in front of the server, to say which site name the
visitor typed. The news.example server takes the domain for its script address from it. From
the header alone the server cannot tell whether its own proxy set it or a visitor sent it.

#### Deeper

According to MDN, `X-Forwarded-Host` is a de facto standard that is not part of any specification;
the standard replacement is the `Forwarded` header from RFC 7239. RFC 7239 itself warns that any
node on the path, the client included, may change such a header, so it cannot be relied upon
(section 8.1).

### `reflect` A response with the attacker's script lands in the cache

`server → cache` · `attack` · `without-defence`
Message: news page · Result: stored in the cache for 5 minutes

```text
Cache-Control: max-age=300
<script src="https://⟦evil.example⟧/app.js"></script>
```

#### Simple

The server builds a page whose main script loads **from the attacker's domain**. The cache doesn't
know the page is spoiled and **remembers** it for everyone.

#### Step by step

The response allows itself to be kept for 300 seconds (`max-age=300`). The cache stores it under
the key `GET news.example/news` — the same key every visitor's request looks up. The header that
made the response different is not recorded in the key.

#### Deeper

RFC 9111 calls this cache poisoning in section 7.1: a harmful response stored in a cache reaches
many users at once. A swapped host name can spoil a page in different places: a script link, a
redirect address, a stylesheet link. Anything the server builds from headers the cache ignores is
dangerous.

### `visit` A visitor opens the news

`browser → cache` · `legit`
Message: GET /news · Result: a copy is in the cache

```http
GET /news
Host: news.example
```

#### Simple

An ordinary reader opens the news site. Her request is perfectly clean: no strange headers.

#### Step by step

The cache computes the key: `GET news.example/news`. A fresh copy is already stored under that
key, so the request never reaches the server.

#### Deeper

The victim doesn't have to follow a strange link or press anything: OWASP stresses in WSTG-INPV-17
that victims receive the poisoned content even though they never sent anything harmful themselves.
This is what sets cache poisoning apart from reflected XSS.

### `serve` The cache hands out the poisoned page

`cache → browser` · `attack` · `without-defence`
Message: page from the cache · Result: attacker's script for every reader

```html
<script src="https://⟦evil.example⟧/app.js"></script>
```

#### Simple

The reader gets the spoiled page, and her browser loads **the attacker's script**. The same happens
to everyone who opens the news until the copy expires.

#### Step by step

The browser sees a `<script>` tag pointing at evil.example and runs the loaded code as part of the
news site: it can read the page, send requests in the reader's name, show fake forms.

#### Deeper

In 5 minutes the copy expires, but the attacker can repeat his request again and again to be first
each time. One request every few minutes, and the page is poisoned for the whole audience.

### `ignore` The server doesn't trust the header

`cache → server` · `attack` · `with-defence` · `stopped`
Message: GET /news + X-Forwarded-Host · Result: header not used, the attack failed

```text
site address in the settings: https://news.example
⟦X-Forwarded-Host: evil.example⟧  → not used
```

#### Simple

The server takes the site's name **from its own settings**, not from request headers. Whatever a
visitor sends, the links point to news.example. This is where the attack stops.

#### Step by step

The site address is written once in the configuration. The server takes `X-Forwarded-Host` only
from its own proxy, which overwrites whatever the visitor sent, and only if the value is on the
list of allowed names; otherwise it ignores it.

#### Deeper

A second layer sits in the cache. It can remove headers the server should not see, or put into
the key everything that affects the response: the server lists such headers in `Vary`. Then
different requests get different entries, and nobody is handed someone else's copy.

### `clean` A clean page in the cache

`server → cache` · `safe` · `with-defence`
Message: news page · Result: stored, links to its own domain

```html
<script src="https://news.example/app.js"></script>
```

#### Simple

The server returns a normal page whose script loads from the site itself. The cache stores it, and
that is safe.

#### Step by step

The response does not depend on the attacker's header: for any request to `/news` the server
builds the same page. So one entry for everyone is the right thing for the cache to do.

#### Deeper

The rule is simple: one cache key must hold a response that is the same for every request with
that key. If the response does differ, the difference must go into the key, or the response must
not be cached.

### `serve-clean` The visitor gets the real page

`cache → browser` · `safe` · `with-defence`
Message: page from the cache · Result: only the site's own scripts

```html
<script src="https://news.example/app.js"></script>
```

#### Simple

The reader gets the page from the cache quickly, as intended, and there's nothing foreign in it.

#### Step by step

The browser loads the script from news.example. The attacker's attempt left no trace: the cache
holds the same page any other visitor would get.

#### Deeper

Pages that depend on the visitor (an account page, a cart) should not go into a shared cache at
all: mark such a response `Cache-Control: private` or `no-store`.

## How to defend

- **Addresses from settings.** Take the site name for links, scripts and redirects from the
  configuration, not from the `Host`, `X-Forwarded-Host` or `Forwarded` headers.
- **Don't trust forwarding headers.** Use them only if your own proxy set them, and check the value
  against a list of allowed names. Let the proxy strip such headers when they arrive from outside.
- **Everything that changes the response goes into the cache key.** If the response depends on a
  header, list it in `Vary` or configure the cache key so that different requests don't share one
  entry.
- **Nothing personal in a shared cache.** Mark responses that differ from person to person
  `Cache-Control: private` or `no-store`.
- **Test the whole chain.** Send a request with a foreign `X-Forwarded-Host` to a test copy and see
  whether the page other people then get has changed.
