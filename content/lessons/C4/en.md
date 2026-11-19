# CSRF: requests on someone else's behalf

`lesson` C4 · `section` C · `wave` 1 · `format` 1

## Passport

- `cwe` 352
- `owasp` A01:2021
- `severity` high
- `impact` A money transfer or another bank action in the customer's name without her knowledge
- `defence` CSRF token and an origin check
- `class` Cross-site request forgery

## Sources

- [OWASP: Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP: Cross Site Request Forgery (CSRF)](https://owasp.org/www-community/attacks/csrf)
- [OWASP Top 10:2021, A01 Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/)
- [MITRE CWE-352: Cross-Site Request Forgery (CSRF)](https://cwe.mitre.org/data/definitions/352.html)
- [MITRE CAPEC-62: Cross Site Request Forgery](https://capec.mitre.org/data/definitions/62.html)
- [RFC 9110: HTTP Semantics, 9.2.1 Safe Methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods)
- [W3C: Fetch Metadata Request Headers](https://www.w3.org/TR/fetch-metadata/)
- [MDN: Cross-site request forgery (CSRF)](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF)
- [MDN: Set-Cookie, the SameSite attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `evil` **Cat site** — cats.example · `icon:document` · `term:csrf`
- `user` **Customer** — browser, 192.0.2.24 · `icon:browser` · `term:victim`
- `bank` **Bank** — bank.example · `term:domain`

## Zones

- `internet` Internet: `attacker`
- `forgery` Other site: `evil` · `danger` · `term:csrf`
- `home` Home: `user`
- `bank-site` Bank: `bank`

## Steps

### `login` Logging in to the bank

`user → bank` · `legit`
Message: login and password · Result: logged in, cookie saved

```http
Set-Cookie: session=7f3a...; Secure; HttpOnly
```

#### Simple

The customer logs in to her online bank. The bank gives the browser a **pass**: a session cookie.
From now on the browser shows this pass to the bank by itself with every request, so the password
is not asked again.

#### Step by step

The browser sends the login and password. The bank checks them, opens a session and tells the
browser to remember the cookie `session`. The customer does not log out and opens other sites in
the same browser.

#### Deeper

The browser attaches the cookie to every request to `bank.example`, no matter who started the
request: the bank itself or another site's page. If the bank did not set the `SameSite` attribute,
the behaviour depends on the browser: Chromium-based browsers treat such a cookie as `Lax`, Firefox
and Safari do not. But default `Lax` has a grace period: a cookie set no more than two minutes ago
is still sent with a POST navigation from another site. The customer has just logged in. In this lesson the bank did not set the attribute.

### `plant` A trap on another site

`attacker → evil` · `attack`
Message: hidden form · Result: page ready

```html
<form action="https://bank.example/transfer"
      method="POST">
  <input name="to" value="⟦attacker-account⟧">
  <input name="sum" value="⟦50000⟧">
```

#### Simple

The attacker makes a page with cat pictures. Hidden in it is an **invisible transfer form** for the
bank: to him, 50,000.

#### Step by step

The form is filled in beforehand and points at the bank's transfer address. A small script will
submit it as soon as the page opens. The attacker does not need the customer's password and does
not know it.

#### Deeper

All the attacker needs to know is what a transfer request looks like: the address and the field
names. He can see them by opening his own account at the same bank. The only thing that differs
between customers is the pass, and the victim's browser will supply it. The attack is called
*Cross-Site Request Forgery*; in the MITRE catalogue it is weakness CWE-352 and attack
pattern CAPEC-62.

### `visit` The customer opens the page

`user → evil` · `legit`
Message: GET / · Result: page open

#### Simple

The customer gets a link: "Look at these cats!". She opens it in the same browser where she was
just using her bank.

#### Step by step

The browser loads the page `cats.example`. It looks harmless. Nothing has to be typed: opening the
page is enough.

#### Deeper

The other site can be a perfectly real one: the form could be planted on a hacked forum or in an
ad. Only one thing matters: the request to the bank will be started by another site, not by the
bank.

### `form` The form sends itself

`evil → user` · `attack`
Message: auto-submit · Result: browser sends a request to the bank

#### Simple

The script on the cat page **presses "Send" by itself**. The customer sees nothing and clicks
nothing.

#### Step by step

The page tells the browser to submit the hidden form to `bank.example/transfer`. The browser obeys:
sending forms to other sites is allowed, that is how the web works.

#### Deeper

The *same-origin policy* stops another site's page from **reading** the bank's answers, but does
not stop it from **sending** requests there. The attacker does not need the answer anyway: he is
after the side effect. If the bank moved money on a `GET`, even an image with the transfer address
would do. Under RFC 9110 the `GET` method is safe: with it the client does not ask for any change
on the server. That is why actions are done only through `POST` and other unsafe methods, and
those are protected.

### `forged` A request with someone else's pass

`user → bank` · `attack` · `without-defence`
Message: POST /transfer · Result: cookie attached

```http
POST /transfer
Origin: https://⟦cats.example⟧
Sec-Fetch-Site: ⟦cross-site⟧
Cookie: session=7f3a...

to=⟦attacker-account⟧&sum=⟦50000⟧
```

#### Simple

The request goes to the bank from the customer's browser. The browser **attaches the customer's
pass on its own**. To the bank it looks as if the customer asked for the transfer herself.

#### Step by step

The bank sees a valid session cookie and the right fields. It does not check where the request
came from.

#### Deeper

The hint is right in the request: the `Origin` header names the other site, and
`Sec-Fetch-Site: cross-site` says the request was started from another site. A bank that ignores them and does not expect a secret token cannot
tell the forgery from a real transfer. This is weakness CWE-352: the site does not check that the
user actually meant to send the request.

### `done` Transfer completed

`bank → user` · `attack` · `without-defence`
Message: transfer of 50,000 · Result: money sent to the attacker

#### Simple

The bank sends the money to the attacker's account. The customer only finds out from her
statement.

#### Step by step

The bank's answer comes back to the browser, but the cat page cannot see it. The transfer is
already done.

#### Deeper

In the same way, an attacker can change the email or password in a profile, add a payee, send a message:
anything the site does on a single request from a logged-in user. In the OWASP Top 10:2021, CWE-352
belongs to A01 "Broken Access Control".

### `blocked` No token, no transfer

`user → bank` · `attack` · `with-defence` · `stopped`
Message: POST, no token · Result: request rejected

```http
POST /transfer
Origin: https://⟦cats.example⟧
Sec-Fetch-Site: ⟦cross-site⟧
Cookie: session=7f3a...

to=attacker-account&sum=50000
⟦(no csrf_token field)⟧
```

#### Simple

Now the bank puts a **secret CSRF token** into each of its forms: a random string that only the
bank and its own page know. The forged form does not know it and cannot send it. The pass is the
same, but without the token the bank does not make the transfer. This is where the attack stops.

#### Step by step

The bank compares the token from the form with the one it keeps in the session. No token, so the
request is rejected. Besides, the bank sees `Sec-Fetch-Site: cross-site` and does not accept such
requests to change data.

#### Deeper

The token is random, tied to the session and not kept in a cookie, so the browser will not attach
it on its own. Another site cannot read it from the bank's page: the same-origin policy prevents
that. The token is not put in the address, where it would leak into history and logs. One more
layer is the cookie attribute `SameSite=Lax` or `Strict`: then the browser does not attach the
cookie to such a request from another site.

### `refuse` Refusal

`bank → user` · `safe` · `with-defence`
Message: 403 · Result: transfer not made

#### Simple

The bank refuses. The money stays where it was, and the customer noticed nothing.

#### Step by step

The bank returns error `403` and records the attempt in its log.

#### Deeper

The defence breaks if the bank's site has an XSS vulnerability: an attacker's script running on
the bank's own page can read the token. So a CSRF token does not replace protection against XSS.

## How to defend

- **A CSRF token in every form that changes something.** Random, tied to the session, checked by
  the server on every request. Not in the address and not only in a cookie.
- **Check where the request came from.** The server looks at `Sec-Fetch-Site` and rejects requests
  to change data that come from other sites; if that header is missing, it rejects the request
  or compares `Origin` in full.
- **`GET` changes nothing.** Transfers, password changes and deletions go only through `POST` and
  other unsafe methods.
- **The `SameSite` attribute on the session cookie.** `Lax` or `Strict`, set explicitly rather than
  left to the browser's default. This is an extra layer, not a replacement for the token.
- **Confirm important actions.** For a transfer or a password change, ask for the password again
  or a code.
- **Protection against XSS.** A script on the site's own page gets around any CSRF defence.
- **For customers:** log out of the bank when you are done, and don't keep it open next to
  unfamiliar sites.
