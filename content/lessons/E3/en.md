# Host header attacks

`lesson` E3 · `section` E · `wave` 1 · `format` 1

## Passport

- `cwe` 640
- `owasp` A07:2021
- `severity` high
- `impact` Taking over someone else's account: the password reset link goes to the attacker
- `defence` The site address for links comes from settings, not from the Host header
- `class` Swapping the link in a password reset email

## Sources

- [OWASP WSTG-INPV-17: Testing for Host Header Injection](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/07-Input_Validation_Testing/17-Testing_for_Host_Header_Injection/)
- [OWASP: Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [MITRE CWE-640: Weak Password Recovery Mechanism for Forgotten Password](https://cwe.mitre.org/data/definitions/640.html)
- [OWASP Top 10:2021, A07 Identification and Authentication Failures](https://owasp.org/Top10/2021/A07_2021-Identification_and_Authentication_Failures/)
- [RFC 9110: HTTP Semantics, section 7.2 Host](https://www.rfc-editor.org/rfc/rfc9110.html#name-host-and-authority)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Shop** — shop.example · `icon:server` · `term:web-server`
- `mail` **Anna's mail** — inbox · `icon:mail`
- `browser` **Anna** — browser, 192.0.2.24 · `icon:browser` · `term:victim`

## Zones

- `internet` Internet: `attacker`
- `site` Site shop.example: `server` · `term:trust-boundary`
- `home` Anna's side: `mail`, `browser`

## Steps

### `forgot` “I forgot my password” in someone else's name

`attacker → server` · `attack`
Message: password reset for Anna · Result: accepted

```http
POST /forgot-password
Host: ⟦evil.example⟧

email=anna@mail.example
```

#### Simple

The attacker opens the online shop's “Forgot your password?” form and enters **Anna's** email
address. But in the request he swaps the **Host header** — the name of the site the browser is
talking to — for his own domain.

#### Step by step

A browser writes the `Host` header with the site name into every request by itself. But the
attacker sends the request with his own program instead of a browser, and writes whatever he
likes there. The shop's server answers to any name, so the request still gets through.

#### Deeper

RFC 9110, section 7.2: the `Host` header carries the host and port from the target URI, so that one
server can serve several sites. It is data from the client, like any other. OWASP notes in
WSTG-INPV-17 that if a server rejects a foreign `Host`, testers also try `X-Forwarded-Host`, which
some servers honour instead.

### `letter` An email with a link to a foreign domain

`server → mail` · `attack` · `without-defence`
Message: “Password reset” email · Result: the link points to evil.example

```text
To set a new password, follow the link:
https://⟦evil.example⟧/reset?token=Q7xK2m
```

#### Simple

The shop creates a secret **reset link** for Anna. It takes the site address for the link from
the Host header — and the result is a link **to the attacker's site**. The email goes to Anna, a
real one, from the shop.

#### Step by step

The reset code glues the link together like this: `https://` + the `Host` value +
`/reset?token=` + a new token. The token is real and works for Anna's account. Only the domain in
front of it is wrong.

#### Deeper

This is a genuine email from the shop with its own sender address: nothing needs to be forged, the
shop put someone else's link in it by itself. MITRE has no separate entry for this mistake; the
closest class is a weak password recovery mechanism, CWE-640.

### `click` Anna clicks the link

`browser → attacker` · `attack` · `without-defence`
Message: GET /reset with the token · Result: the token is with the attacker

```http
GET /reset?token=⟦Q7xK2m⟧
Host: evil.example
```

#### Simple

Anna didn't ask for a reset, but the email looks real, and she clicks the link. Her browser opens
the attacker's site and **brings the secret token there**.

#### Step by step

The token sits right in the link's address, so the attacker's server sees it in the very first
line of the request and records it. Anna may see an error or a blank page — it no longer matters.

#### Deeper

OWASP calls this password reset poisoning in WSTG-INPV-17: the victim follows the link, and the
secret token ends up with the attacker. What is broken is not the token but the address the server
stuck in front of it.

### `takeover` The attacker sets a new password

`attacker → server` · `attack` · `without-defence`
Message: new password · Result: account taken over

```http
POST /reset
Host: shop.example

token=⟦Q7xK2m⟧&password=…
```

#### Simple

The attacker goes to the **real** shop site with Anna's token and sets a new password. Now he can
sign in to her account, and Anna can't.

#### Step by step

The server checks the token: it was issued for Anna, hasn't been used and hasn't expired.
Everything matches, and the password changes.

#### Deeper

A short token lifetime and single use, which OWASP recommends, don't help here: the attacker uses
the token right away, while it is fresh. The defence has to come earlier — where the link is built.

### `config` The link is built from settings

`server → server` · `attack` · `with-defence` · `stopped`
Message: foreign Host · Result: not used, the attack failed

```text
site address in the settings: https://shop.example
⟦Host: evil.example⟧  → not used for links
```

#### Simple

The shop takes the site address for links **from its own settings**, not from the Host header.
Whatever the attacker writes, the link points to shop.example. This is where the attack stops.

#### Step by step

The site address is written once in the configuration. The reset code builds the link from it and
the token. The `Host` header is no longer needed for that.

#### Deeper

The OWASP Forgot Password Cheat Sheet says plainly not to rely on `Host` when creating reset URLs:
the address is hard-coded or checked against a list of trusted domains. A second layer is a web
server that answers only to its own names and rejects requests with a foreign `Host`.

### `letter-safe` An email with the real link

`server → mail` · `safe` · `with-defence`
Message: “Password reset” email · Result: the link points to shop.example

```text
To set a new password, follow the link:
https://shop.example/reset?token=Q7xK2m
```

#### Simple

Anna gets an email she didn't ask for, but the link in it leads **to the shop itself**. The
attacker gets no token.

#### Step by step

Only Anna knows the link and the token in it. The attacker saw nothing but the reply “email sent”
and can do nothing with it.

#### Deeper

It is worth adding a line to the email: “if you didn't ask for a reset, simply ignore this
email”. Then the person won't panic and won't start changing things on their own.

### `read-safe` Anna didn't ask for a reset and leaves the email alone

`mail → browser` · `safe` · `with-defence`
Message: the shop's email · Result: the password is unchanged

```text
token Q7xK2m is unused and will expire soon
```

#### Simple

Anna sees a reset email she didn't ask for and simply leaves it alone. Her password stays the same.

#### Step by step

An unused token expires on its own. Even if Anna clicks the link, she lands on the real shop site,
where only she can set a new password.

#### Deeper

The reset request by itself changes nothing in the account. OWASP advises changing nothing, for
example not locking the account, until a valid token is presented, and answering the same way for
existing and non-existing email addresses.

## How to defend

- **Site address from settings.** Build links in emails, redirects and absolute addresses from the
  site's settings, not from the `Host`, `X-Forwarded-Host` or `Forwarded` headers.
- **Only your own names.** The web server passes to the application only requests for names on
  the allowed list and rejects a foreign `Host` before the application sees it.
- **Forwarding headers only from your own proxy.** Use `X-Forwarded-Host` only if your proxy set
  it, and check the value against the list.
- **Proper reset tokens.** From a cryptographically secure random number generator, long, single
  use, with a limited lifetime, as OWASP recommends. They won't save you from a swapped link, but
  they narrow the window for other attacks.
- **Check every email.** Email confirmation, invitations, sign-in links — wherever the server puts
  the site address into an email, it must come from the configuration.
