# CORS misconfiguration

`lesson` C6 · `section` C · `wave` 3 · `format` 1

## Passport

- `cwe` 942
- `owasp` A05:2021
- `severity` high
- `impact` Someone else's site reads the user's personal data from an API in the user's name
- `defence` An exact list of allowed origins
- `class` Overly broad cross-site access policy

## Sources

- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN: Access-Control-Allow-Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin)
- [MDN: Access-Control-Allow-Credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials)
- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [WHATWG Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [MITRE CWE-942: Permissive Cross-domain Security Policy with Untrusted Domains](https://cwe.mitre.org/data/definitions/942.html)
- [OWASP Top 10:2021, A05 Security Misconfiguration](https://owasp.org/Top10/2021/A05_2021-Security_Misconfiguration/)
- [OWASP Top 10:2021, A01 Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/)
- [MDN: Set-Cookie, the SameSite attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

## Participants

- `evil` **Attacker's site** — evil.example · `icon:attacker` · `term:attacker`
- `browser` **Victim's browser** — 192.0.2.24 · `term:victim`
- `api` **Shop API** — api.shop.example · `icon:server` · `term:cors`

## Zones

- `evil-site` Someone else's site: `evil` · `danger` · `term:same-origin-policy`
- `home` Home: `browser`
- `site` Shop: `api` · `term:trust-boundary`

## Steps

### `visit` A page with a hidden request

`evil → browser` · `attack`
Message: page with a script · Result: opened

```js
fetch('https://api.shop.example/profile', { ⟦credentials: 'include'⟧ })
```

#### Simple

The victim visits someone else's site, say one with free games. While she looks at the page, the
site's script **quietly asks her shop's API** for her personal profile.

#### Step by step

The script calls `fetch` to api.shop.example and asks for credentials to be attached:
`credentials: 'include'`. Then the browser adds the shop's cookies to the request, if the victim
has any.

#### Deeper

The browser lets any site send such a request. What matters is whether the script can **read the
response**. By default it cannot, and that is the same-origin policy: an origin is the scheme,
host and port, and evil.example and api.shop.example are different ones.

### `request` The request goes out with the cookie

`browser → api` · `attack`
Message: GET /profile · Result: request accepted

```http
GET /profile
Host: api.shop.example
Origin: ⟦https://evil.example⟧
Cookie: session=7f3a9c
```

#### Simple

The browser sends the request to the shop and attaches the victim's **pass**, the session
cookie. It also honestly says who is asking: an `Origin` header with the other site's address.

#### Step by step

This is a simple `GET` request without special headers, so there is no preflight check (an
`OPTIONS` request): the browser sends the request itself right away. The server sees the cookie
and finds the victim's profile.

#### Deeper

The cookie goes along with a `fetch` from another site only if it is marked `SameSite=None` and
the browser does not block third-party cookies.
According to MDN, with `Lax` and `Strict` the browser does not attach cookies to such requests.
Here the API serves widgets on different sites, so its cookie is `SameSite=None`.

### `reflect` The server allows whoever asks

`api → browser` · `attack` · `without-defence`
Message: profile and CORS headers · Result: the browser allowed reading

```http
Access-Control-Allow-Origin: ⟦https://evil.example⟧
Access-Control-Allow-Credentials: true

{"name": "Anna", "phone": "...", "address": "..."}
```

#### Simple

The shop's server is “friendly”: whoever asks, it answers **“you may”**. The browser sees the
permission and hands the profile to the other site's script.

#### Step by step

The server copies the `Origin` value from the request into the `Access-Control-Allow-Origin`
header and adds `Access-Control-Allow-Credentials: true`. That is the bug: any site gets the
permission, not just the shop's own.

#### Deeper

The `*` wildcard cannot be used with credentials: according to MDN, the browser returns an error.
So developers who “just need it to work” reflect `Origin` as is. This is weakness CWE-942: the
cross-site access policy trusts untrusted domains. In the OWASP Top 10:2021 such a
misconfiguration belongs to A05, and A01 names CORS misconfiguration directly.

### `leak` The profile goes to the attacker

`browser → evil` · `attack` · `without-defence`
Message: name, phone, address · Result: leaked

#### Simple

The script got the response and **sent the profile** to the attacker's server. The victim noticed
nothing.

#### Step by step

The script reads the response body as JSON and forwards it to evil.example. In the same way it
can read the order history or any other API response the victim herself can see.

#### Deeper

Reflecting `Origin` is not the only danger. Allowing `null` is wrong too: according to MDN, any
site can get that origin, for example through a sandboxed frame. A check on the end of the name is
also unreliable: the rule “ends with shop.example” lets the stranger evilshop.example through.

### `check` The server checks Origin against a list

`api → api` · `attack` · `with-defence` · `stopped`
Message: foreign Origin · Result: not on the list, no permission

```text
allowed: https://shop.example, https://m.shop.example
came:    ⟦https://evil.example⟧  →  no CORS headers
```

#### Simple

Now the server has **an exact list of its own sites**. evil.example is not on it and gets no
permission to read. This is where the attack stops.

#### Step by step

The server compares `Origin` with each address on the list as a whole. If it matches, it puts that
address into `Access-Control-Allow-Origin`. If not, it adds no CORS headers at all.

#### Deeper

If the response depends on `Origin`, MDN says to also send `Vary: Origin`, so that a cache does
not give one site's response to another. And remember: CORS only decides who may **read** the
response. The request itself still reaches the server, so defence against request forgery (CSRF)
is a separate job.

### `blocked` The browser does not hand over the response

`api → browser` · `safe` · `with-defence`
Message: response without CORS permission · Result: the script got an error

```http
HTTP/1.1 200 OK
Vary: Origin
```

#### Simple

The response reaches the browser, but **it has no permission for the other site**. The browser
does not show it to the script, which only gets a network error.

#### Step by step

The browser checks the CORS headers. There is no `Access-Control-Allow-Origin`, so the same-origin
policy forbids reading. The profile stays in the victim's browser and never reaches the other
site's script.

#### Deeper

The browser enforces the protection, but the server makes the decision: it hands out the
permissions. So a CORS bug is always a server configuration bug, and it is fixed in the API's code
or configuration.

## How to defend

- **An exact list.** Allow only your own sites, written out in full: scheme, host and port.
  Compare `Origin` with the list as a whole, without “starts with” or “ends with” checks.
- **Do not reflect Origin.** Copying the request header into `Access-Control-Allow-Origin` means
  allowing everyone.
- **Do not allow `null`.** Any site can get that origin.
- **Credentials only where needed.** Set `Access-Control-Allow-Credentials: true` only for
  addresses your own sites really need with cookies. Keep the `*` wildcard for open data that
  needs no login.
- **`Vary: Origin`.** If the response depends on `Origin`, tell caches about it.
- **SameSite for the session cookie.** With `Lax` or `Strict`, the browser will not attach the
  cookie to a `fetch` from another site.
- **CORS does not protect against CSRF.** It decides who reads the response; the request still
  reaches the server.
