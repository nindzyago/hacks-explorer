# SSL stripping and downgrade

`lesson` G3 · `section` G · `wave` 2 · `format` 1

## Passport

- `cwe` 319, 757
- `owasp` A02:2021
- `attack` T1557, T1689
- `severity` high
- `impact` The password and cookies travel in plain text even though the bank supports HTTPS
- `defence` HSTS with preload, only TLS 1.2 and newer
- `class` Encryption removed by a man in the middle

## Sources

- [RFC 6797: HTTP Strict Transport Security (HSTS)](https://www.rfc-editor.org/rfc/rfc6797.html)
- [RFC 8996: Deprecating TLS 1.0 and TLS 1.1](https://www.rfc-editor.org/rfc/rfc8996.html)
- [RFC 7568: Deprecating Secure Sockets Layer Version 3.0](https://www.rfc-editor.org/rfc/rfc7568.html)
- [RFC 7507: TLS Fallback Signaling Cipher Suite Value (SCSV) for Preventing Protocol Downgrade Attacks](https://www.rfc-editor.org/rfc/rfc7507.html)
- [RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446.html)
- [MITRE ATT&CK T1689: Downgrade Attack](https://attack.mitre.org/techniques/T1689/)
- [MITRE CAPEC-620: Drop Encryption Level](https://capec.mitre.org/data/definitions/620.html)
- [MITRE CWE-757: Selection of Less-Secure Algorithm During Negotiation](https://cwe.mitre.org/data/definitions/757.html)
- [OWASP: HTTP Strict Transport Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)
- [NVD: CVE-2014-3566](https://nvd.nist.gov/vuln/detail/CVE-2014-3566)

## Participants

- `user` **Visitor** — laptop, 192.0.2.24 · `term:victim`
- `attacker` **Attacker** — 192.0.2.66 · `term:mitm`
- `bank` **Bank** — bank.example · `term:domain`

## Zones

- `cafe` Café Wi-Fi: `user`, `attacker`
- `internet` Internet: `bank`

## Steps

### `type` An address without https

`user → attacker` · `legit` · `without-defence`
Message: http://bank.example · Result: the first request in plain text

```http
GET http://bank.example/
```

#### Simple

The visitor types just bank.example into the browser, without `https://`, or follows an old
`http://` link. Many browsers try HTTPS first, but if that fails and HTTPS-only mode is off, they
fall back to plain HTTP. The attacker is already in the middle, for example as in the "Man in the
middle" lesson, can make the HTTPS attempt fail, and gets the HTTP request first.

#### Step by step

Normally the site answers such a request with a redirect to `https://`, and from then on everything
is encrypted. The attacker has to make sure that redirect never reaches the visitor.

#### Deeper

The first step is the dangerous one: a request over HTTP has no protection at all. RFC 6797 calls
this weakness the Bootstrap MITM Vulnerability (section 14.6): until the browser knows the site
is HTTPS-only, the first request can be intercepted.

### `upgrade` The attacker talks to the bank over HTTPS

`attacker → bank` · `legit` · `without-defence`
Message: HTTPS to the bank · Result: the bank sees an ordinary secure login

```text
to the bank:     https://bank.example/  (TLS, all correct)
to the visitor:  http://bank.example/   (no encryption)
```

#### Simple

The attacker goes to the bank **over HTTPS** himself, like any browser. For the bank everything is
fine: the connection is encrypted, the certificate is real. It is just that the other end is the
attacker, not the visitor.

#### Step by step

The attacker keeps two conversations: a secure one with the bank and an open one with the
visitor. He passes the bank's pages to the visitor and the visitor's requests to the bank.

#### Deeper

There is no need to swap certificates as in the "Man in the middle" lesson: the attacker talks to
the visitor without TLS at all, so the browser has nothing to check. That is why the attack is
called SSL stripping: the encryption is not broken, it is simply removed from the stretch to the
victim.

### `strip` Links without https

`attacker → user` · `attack` · `without-defence`
Message: https → http · Result: the login form will send the password unencrypted

```html
<form action="⟦http⟧://bank.example/login" method="post">
```

#### Simple

The attacker takes the bank's page and **changes every `https` to `http`**: in links, in the login
form, in redirects. The visitor sees a familiar page. The address bar shows no sign of a secure
connection, and some browsers even say "Not secure", but few people notice.

#### Step by step

The browser never got a single instruction to switch to HTTPS, so it keeps talking HTTP. As far as
the browser is concerned there is no error: the site simply opened without encryption.

#### Deeper

MITRE ATT&CK describes this switch from HTTPS to HTTP in technique T1689 "Downgrade Attack", and
MITRE CAPEC in pattern CAPEC-620 "Drop Encryption Level". A related attack lowers not the protocol
but the TLS version: the man in the middle breaks the handshake, and a browser that retries with an
older version falls back to a weak one. The POODLE attack (CVE-2014-3566, 2014) exploits a flaw in
SSL 3.0, and attackers reached it by forcing exactly such a fallback.

### `login` Password in plain text

`user → attacker` · `attack` · `without-defence`
Message: password over HTTP · Result: the attacker has the password, login succeeds

```http
POST http://bank.example/login
login=anna&password=⟦Cat2024⟧
```

#### Simple

The visitor enters a login and password. The form goes out over HTTP, and the attacker **reads
the password**. Then he forwards the form to the bank over HTTPS, and the login works as usual.

#### Step by step

The bank sees a secure connection and the right password. The visitor sees the account page. The
password and the session cookie are already with the attacker.

#### Deeper

Sending a password without encryption is CWE-319 "Cleartext Transmission of Sensitive
Information"; in the OWASP Top 10:2021 it falls under A02 "Cryptographic Failures". The bank may
never learn about the attack: on its side it sees only HTTPS.

### `preload` The browser picks HTTPS straight away

`user → attacker` · `safe` · `with-defence`
Message: straight to https · Result: the bank is on the HSTS preload list

```text
bank.example is on the HSTS preload list → straight to https://bank.example/
```

#### Simple

Now the bank has turned on **HSTS** and joined the preload list built into browsers. The visitor
again types just bank.example, but the browser itself changes the address to `https://` before
sending anything.

#### Step by step

There is no open HTTP request any more. The browser starts a TLS handshake and expects a
certificate for bank.example from the bank.

#### Deeper

Under RFC 6797, a browser that knows a site is HTTPS-only rewrites any `http://` link to
`https://` on its own and does not let the user click past a certificate error. The preload list
covers the first visit. According to MDN, to get on the list a site sends
`Strict-Transport-Security` with a `max-age` of at least one year (31536000 seconds),
`includeSubDomains` and `preload`.

### `redirect` An attempt to bring back http

`attacker → user` · `attack` · `with-defence` · `stopped`
Message: go to http · Result: the browser switched back to https itself, the swap failed

```http
HTTP/1.1 302 Found
Location: ⟦http⟧://bank.example/login
```

#### Simple

The attacker tries to send the browser back to `http`, for example with a redirect from a page on
some other, unprotected site. But the browser remembers the HSTS rule for bank.example and **changes
`http` to `https` itself**. Stripping the encryption failed; this is where the attack stops.

#### Step by step

The attacker cannot swap the certificate either: he does not have the real one, and HSTS does not
let anyone click past a certificate error. All he can do is pass encrypted packets along without
reading them.

#### Deeper

HSTS covers subdomains too if the header includes `includeSubDomains`. Without it, the attacker
can lure the browser to some subdomain of the bank over HTTP, and cookies the site sets for the
whole domain stay at risk (RFC 6797, section 14.4).

### `old` An attempt to lower the version

`attacker → bank` · `attack` · `with-defence` · `stopped`
Message: only TLS 1.0 · Result: the bank refused: old versions are switched off

```text
I support: ⟦TLS 1.0⟧
bank's reply: protocol version not supported, connection closed
```

#### Simple

The attacker tries another route: break the handshake so the browser and the bank settle on an
**old, weak version** of TLS. But the bank simply cannot speak the old versions: it has switched
them off. The handshake does not happen.

#### Step by step

The bank accepts only TLS 1.2 and TLS 1.3. Under the same rules, the browser must not offer the
old versions either. There is nothing to fall back to.

#### Deeper

RFC 7568 (2015) banned SSL 3.0, and RFC 8996 (2021) banned TLS 1.0 and 1.1: they must not be used
or negotiated. TLS 1.3 has its own protection (RFC 8446, section 4.1.3): a server that agreed to a
lower version leaves a special marker in its random value, and a browser that sees it aborts the
connection. Before that, a separate signal, TLS_FALLBACK_SCSV (RFC 7507), guarded against
downgrade on retries; once the old versions were banned, RFC 8996 made it obsolete.

### `secure` A secure login

`user → bank` · `safe` · `with-defence`
Message: TLS 1.3 · Result: the password is encrypted

#### Simple

The browser and the bank agree on **TLS 1.3** and check the certificate. The packets still pass
through the attacker, but all he sees is ciphertext.

#### Step by step

The visitor enters the password, and it goes inside the encrypted connection. The attacker cannot
change the links or the form: the browser would notice any change.

#### Deeper

The defence works because the decision "HTTPS only" is made by the browser, not by a page the man
in the middle can rewrite. HSTS and the preload list move that decision to where the attacker
cannot reach.

## How to defend

- **HTTPS on the whole site and a redirect from HTTP.** Not a single page, form or image over
  `http://`.
- **HSTS with a long lifetime.** A `Strict-Transport-Security` header with a `max-age` of at
  least one year and `includeSubDomains`: the browser goes only over HTTPS and does not let anyone
  click past a certificate error.
- **The HSTS preload list.** Add the domain to the list built into browsers: then even the very
  first visit is protected.
- **Only TLS 1.2 and 1.3.** Switch off SSL 3.0, TLS 1.0 and TLS 1.1 on servers (RFC 7568,
  RFC 8996).
- **Cookies marked `Secure`.** The browser will not send such cookies over HTTP, even if the
  attacker lures it there.
- **For visitors: watch the address bar and turn on HTTPS-only mode.** If a bank's site suddenly
  opens without HTTPS or marked "Not secure", especially on a shared network, do not enter your
  password.
