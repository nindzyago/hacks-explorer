# Session hijacking and fixation

`lesson` D3 · `section` D · `wave` 1 · `format` 1

## Passport

- `cwe` 384
- `owasp` A07:2021
- `attack` T1539, T1550.004
- `severity` high
- `impact` Getting into the victim's account without her password
- `defence` New session ID after login
- `class` Session hijacking

## Sources

- [OWASP: Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Top 10:2021, A07 Identification and Authentication Failures](https://top10.owasp.org/2021/A07_2021-Identification_and_Authentication_Failures)
- [MITRE CWE-384: Session Fixation](https://cwe.mitre.org/data/definitions/384.html)
- [MITRE ATT&CK T1539: Steal Web Session Cookie](https://attack.mitre.org/techniques/T1539/)
- [MITRE ATT&CK T1550.004: Web Session Cookie](https://attack.mitre.org/techniques/T1550/004/)
- [RFC 6265: HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.5)

## Participants

- `user` **Anna** — 192.0.2.24 · `term:victim`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`

## Zones

- `internet` Internet: `user`, `attacker`
- `site` Site shop.example: `server` · `term:trust-boundary`

## Steps

### `visit` The attacker gets a session

`attacker → server` · `legit`
Message: GET /login · Result: sid K7Q2 issued

```http
HTTP/1.1 200 OK
Set-Cookie: sid=K7Q2…
```

#### Simple

A site remembers a visitor by a **session ID** — a long random string in a cookie. The attacker
simply opens the login page, and the site hands them such an ID: `K7Q2…`. They have not logged in.

#### Step by step

The server starts a session even before login: for example, to remember the shopping cart. It
sends the ID in the `Set-Cookie` header, and the browser attaches it to every following request.

#### Deeper

Until someone logs in, the session is worth nothing. It becomes valuable at the moment of login:
the server marks it "this is Anna". Whoever knows the ID of such a session is Anna as far as the
site is concerned — no password needed any more.

### `plant` A planted link

`attacker → user` · `attack`
Message: link with a planted sid · Result: Anna opened it

```text
https://shop.example/login?sid=⟦K7Q2…⟧
```

#### Simple

The attacker sends Anna a link to the real shop site. But the link carries **their** session ID.
Anna sees a familiar address and opens it.

#### Step by step

This site can take the session ID from the page address, not only from the cookie. So Anna's
browser now works in session `K7Q2…`, whose ID the attacker knows in advance.

#### Deeper

This is session **fixation**: the attacker does not steal the ID, they impose their own in
advance. MITRE lists other ways to plant the ID too: through XSS, or through a sibling site on the
same domain that sets a cookie for the whole domain.

### `login` Anna logs in

`user → server` · `legit`
Message: login and password · Result: password correct

```http
POST /login
Cookie: sid=K7Q2…

login=anna&password=…
```

#### Simple

Anna enters her login and password. Everything is honest: only she knows the password, the
attacker does not see it.

#### Step by step

The login request goes with the planted session ID. The server checks the password, and it is
correct.

#### Deeper

Neither the password nor a second factor helps here: the attack starts **after** a successful
login. Only one thing matters — what the server does with the session ID once Anna is in.

### `keep` The ID stays the same

`server → user` · `attack` · `without-defence`
Message: logged in, same sid · Result: K7Q2 is Anna's session

```http
HTTP/1.1 302 Found
Location: /account
```

#### Simple

The server says "welcome" and records in session `K7Q2…` that this is **Anna**. It does not
change the session ID.

#### Step by step

There is no new cookie in the response. The session whose ID the attacker knows has become the
session of the logged-in Anna.

#### Deeper

In the MITRE catalogue this is CWE-384 "Session Fixation": a user logs in without the existing
session ID being invalidated. The OWASP Top 10:2021 names reusing the session ID after a
successful login among the bugs of item A07 "Identification and Authentication Failures".

### `rotate` A new ID after login

`server → user` · `safe` · `with-defence`
Message: logged in, new sid · Result: K7Q2 destroyed

```http
HTTP/1.1 302 Found
Set-Cookie: sid=⟦Z9M4…⟧; Secure; HttpOnly; SameSite=Lax
```

#### Simple

After login the server gives Anna a **brand-new** session ID and destroys the old `K7Q2…`. The ID
the attacker knew no longer means anything.

#### Step by step

The new ID is random, nobody has seen it. The old session is deleted on the server, not only in
the browser.

#### Deeper

OWASP requires renewing the session ID on any change of privilege level, and login is the most
common such case. Cookie attributes protect against theft: `Secure` — send only over HTTPS,
`HttpOnly` — hide from page scripts (RFC 6265), `SameSite` — do not attach to most requests
coming from other sites (`Strict` — to none).

### `replay` The attacker walks in

`attacker → server` · `attack` · `without-defence`
Message: old sid K7Q2 · Result: logged in as Anna

```http
GET /account
Cookie: sid=⟦K7Q2…⟧
```

#### Simple

The attacker opens the site with **their old session ID**. The server sees Anna's session and
shows her account: address, orders, saved cards.

#### Step by step

No password is needed: to the server the session ID is the pass. The attacker acts as Anna until
the session ends.

#### Deeper

Session **theft** ends the same way: the ID leaks through XSS if the cookie lacks `HttpOnly`,
over plain HTTP without `Secure`, through malware on the victim's computer or through a phishing
proxy. In MITRE ATT&CK the theft is T1539 and logging in with someone else's cookie is T1550.004;
it notes that this can bypass some second-factor protections as well.

### `refused` The session is gone

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: old sid K7Q2 · Result: attack failed

```http
GET /account
Cookie: sid=⟦K7Q2…⟧
```

#### Simple

The attacker comes with the old ID, but that session **no longer exists**. The server asks them
to log in, and the attacker does not have Anna's password.

#### Step by step

The server does not find `K7Q2…` among live sessions and sends the visitor to the login page.
The suspicious attempt is worth logging.

#### Deeper

Accepting the ID only from the cookie, never from the page address, closes this planting route.
Strict mode (the server accepts only IDs it issued itself) would not help here: `K7Q2…` was issued
by the server. It stops IDs the attacker makes up. OWASP warns that an ID in the address leaks
through history, logs and the Referer header and makes fixation easier.

## How to defend

- **New session ID after login.** The server issues a new random ID at login and on any privilege
  change, and destroys the old one. This is the main defence against fixation.
- **ID only in the cookie.** The session ID is not accepted from the page address or form fields,
  and the server rejects unknown IDs entirely — only the ones it issued itself count.
- **Cookie attributes.** `Secure`, `HttpOnly` and `SameSite=Strict` or `Lax` make theft over an
  open network, through XSS and from other sites harder.
- **Long random IDs.** At least 64 bits of randomness from a cryptographic generator, so the ID
  cannot be guessed.
- **Sessions end.** Idle timeouts and an absolute session lifetime; on logout the session is
  destroyed on the server.
