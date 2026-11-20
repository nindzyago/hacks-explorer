# OAuth mistakes

`lesson` D5 · `section` D · `wave` 3 · `format` 1

## Passport

- `cwe` 601
- `owasp` A01:2021
- `severity` high
- `impact` Logging into someone else's account on a site with a stolen authorization code
- `defence` Exact redirect_uri matching
- `class` Authorization code theft

## Sources

- [RFC 6749: The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html#section-10.6)
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [RFC 7636: Proof Key for Code Exchange (PKCE)](https://www.rfc-editor.org/rfc/rfc7636.html)
- [OWASP: OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [MITRE CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)

## Participants

- `user` **Anna** — browser · `term:victim`
- `attacker` **Attacker** — evil.example · `term:attacker`
- `client` **PhotoPrint** — print.example · `icon:server`
- `idp` **Login service** — id.example · `icon:server`

## Zones

- `internet` Internet: `user`, `attacker`
- `app` Site print.example: `client`
- `id` Service id.example: `idp` · `term:trust-boundary`

## Steps

### `start` Logging in through a login service

`user → client` · `legit`
Message: "Log in with ID" · Result: off to id.example

```text
https://id.example/authorize
  ?client_id=print
  &redirect_uri=https://print.example/cb
  &state=…
```

#### Simple

Anna visits a photo printing site and clicks "Log in with ID". She needs no password for the
printing site: a **login service** where she already has an account will vouch for her.

#### Step by step

The site sends Anna's browser to `id.example` and says: "I am the `print` app, send the user back
to this address". That return address is called `redirect_uri`.

#### Deeper

This is how **OAuth 2.0** (RFC 6749) works in its authorization code flavour. The login service
gives the app not a password but a one-time **code**, and the app exchanges it for an access
token. The app registered its return address with the login service in advance:
`https://print.example/cb`.

### `bait` A link with someone else's return address

`attacker → user` · `attack`
Message: a link · Result: Anna opened it

```text
https://id.example/authorize
  ?client_id=print
  &redirect_uri=⟦https://print.example.evil.example/cb⟧
```

#### Simple

The attacker sends Anna a link to the **real** login service. Everything in it is as usual except
the return address: it leads to the attacker's site.

#### Step by step

The address `print.example.evil.example` starts the same way as the real one, but it is a
different domain — it belongs to the attacker. Anna sees the familiar `id.example` page and
notices nothing.

#### Deeper

RFC 6749 (section 10.6) describes exactly this attack: the attacker swaps the return address in
the login request and gets the victim to open such a link. The login service shows the victim a
normal request from an app she knows.

### `loose` Matching by the start of the address

`user → idp` · `attack` · `without-defence`
Message: foreign address · Result: address accepted

```text
registered: https://print.example/cb
checked:    starts with https://print.example
received:   ⟦https://print.example.evil.example/cb⟧
```

#### Simple

The login service checks the return address **carelessly**: only that it starts with the
site's address `https://print.example`. The foreign address passes this check.

#### Step by step

Anna logged in to `id.example` earlier, so the service asks straight away: "Allow PhotoPrint
access?" Anna clicks "Allow" — she really does use this printing site.

#### Deeper

RFC 9700 (section 4.1) explains how matching by pattern or by part of the address leads to code
theft, and notes that such flaws have been exploited on real services. In the MITRE catalogue the
closest weakness is CWE-601 "URL Redirection to Untrusted Site": a redirect to an address the user
supplied.

### `exact` Exact address matching

`user → idp` · `attack` · `with-defence` · `stopped`
Message: foreign address · Result: attack failed

```text
registered: https://print.example/cb
received:   ⟦https://print.example.evil.example/cb⟧
```

#### Simple

The login service compares the return address with the registered one **in full, character by
character**. They do not match — the service goes no further.

#### Step by step

The whole string is compared, with no patterns and no "starts with". Any difference means a
refusal, and no code is created at all.

#### Deeper

RFC 9700 (section 2.1) requires the login service to use exact string matching. There is a single
exception: the port in a `localhost` address for native apps installed on the user's device. Such
a check is simpler than patterns and closes this gap; the return page itself must also not contain
an open redirect.

### `leak` The code goes to the attacker

`idp → attacker` · `attack` · `without-defence`
Message: Anna's code · Result: the attacker has the code

```http
HTTP/1.1 302 Found
Location: https://print.example.evil.example/cb?code=⟦SplxlO…⟧
```

#### Simple

The login service sends Anna's browser to the return address — that is, to the attacker. The
browser carries Anna's **authorization code** along.

#### Step by step

The browser follows the redirect by itself; Anna only sees a page flash by. The attacker's site
records the code from the address.

#### Deeper

The code is short-lived: RFC 6749 recommends a lifetime of at most 10 minutes and lets the code be
used only once. That is enough for the attacker — they put the code to use at once.

### `inject` The code is slipped to PhotoPrint

`attacker → client` · `attack` · `without-defence`
Message: /cb with Anna's code · Result: accepted

```http
GET /cb?code=⟦SplxlO…⟧
Host: print.example
```

#### Simple

The attacker opens PhotoPrint's **real** return address themselves and puts the stolen code in it.
PhotoPrint thinks this is an ordinary return from the login service.

#### Step by step

The attacker started their own login on PhotoPrint beforehand, so they have their own session on
the site. Into the login service's response they write Anna's code instead of their own.

#### Deeper

RFC 9700 (section 4.5) calls this authorization code injection. Usually **PKCE** (RFC 7636) stops
it: at the start of login the app makes up a secret `code_verifier`, puts only its hash into the
request, and the code is bound to that hash. But here the attacker built the login request and
could put in the hash from their own PhotoPrint session: RFC 9700 (section 4.5.4) admits this
bypass. So the key is not to let the code go to a foreign address.

### `exchange` Exchanging the code for a token

`client → idp` · `attack` · `without-defence`
Message: code → token · Result: logged in as Anna

```http
POST /token

grant_type=authorization_code
&code=⟦SplxlO…⟧
```

#### Simple

PhotoPrint exchanges the code for a token at the login service. The code is real, the app is real —
the service issues **Anna's token**. The attacker ends up in Anna's PhotoPrint account: her
photos, address, orders.

#### Step by step

The login service checked that the code was issued to this app and has not been used yet. Whose
browser started the login, it does not check.

#### Deeper

RFC 6749 (section 4.1.3) requires one more check: `redirect_uri` in the exchange must match the one
in the login request. It would also catch the attack, but RFC 9700 notes that services often skip
it. Against code theft and injection in general, RFC 9700 (section 2.1.1) requires PKCE from public
apps and recommends it for the rest.

### `error` An error instead of a redirect

`idp → user` · `safe` · `with-defence`
Message: wrong address · Result: no code issued

```http
HTTP/1.1 400 Bad Request
```

#### Simple

The login service shows Anna an error: **the return address does not match**. It sends her
nowhere and creates no code.

#### Step by step

The attacker has nothing to steal: no code, no redirect to their site. Anna sees an odd error and
can report it.

#### Deeper

RFC 6749 (section 4.1.2, error response): with an invalid return address the login service should
tell the account owner about the error, and it must not automatically redirect the browser to that
address.

## How to defend

- **Exact redirect_uri matching.** The login service compares the return address with the
  registered one in full, with no patterns and no prefix matching. This is the main defence.
- **PKCE for every app.** The app sends the hash of a one-time secret at login and the secret
  itself when exchanging the code. A code leaked from a genuine login is useless without the
  secret. RFC 9700 requires PKCE from public apps and recommends it for the rest. Against a
  tampered link like the one in this lesson it does not always help, so exact address matching is
  a must.
- **Check redirect_uri at code exchange.** The address in the exchange must match the one in the
  login request.
- **state against CSRF.** The app puts a random `state` bound to the user's browser into the login
  request and checks it on return (RFC 6749, section 10.12). PKCE protects against CSRF as well.
- **No open redirects.** Neither the app nor the login service forwards the browser to any address
  taken from a request parameter: codes leak through such addresses too.
- **Short-lived, one-time codes.** RFC 6749 recommends a code lifetime of at most 10 minutes; a
  code is not accepted a second time.
