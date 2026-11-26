# HTTPS: how the browser checks a site

`lesson` L3 · `section` L · `wave` 1 · `format` 1

## Passport

- `cwe` 297
- `owasp` A07:2021
- `attack` T1557
- `severity` high
- `impact` The password goes to an attacker holding a real certificate for another name, if the name isn't matched
- `defence` Matching the site's name against the certificate on every connection
- `class` Server impersonation in a secure connection

## Sources

- [RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446.html)
- [RFC 9525: Service Identity in TLS](https://www.rfc-editor.org/rfc/rfc9525.html)
- [RFC 5280: Internet X.509 Public Key Infrastructure Certificate and CRL Profile](https://www.rfc-editor.org/rfc/rfc5280.html)
- [RFC 7748: Elliptic Curves for Security](https://www.rfc-editor.org/rfc/rfc7748.html)
- [MITRE CWE-297: Improper Validation of Certificate with Host Mismatch](https://cwe.mitre.org/data/definitions/297.html)
- [MITRE ATT&CK T1557: Adversary-in-the-Middle](https://attack.mitre.org/techniques/T1557/)
- [OWASP Top 10:2021, A07 Identification and Authentication Failures](https://top10.owasp.org/2021/A07_2021-Identification_and_Authentication_Failures/)
- [OWASP: Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)

## Participants

- `user` **Browser** — 192.0.2.24 · `icon:browser` · `term:tls`
- `attacker` **Attacker** — 192.0.2.66 · `term:attacker`
- `site` **Shop** — shop.example · `icon:server` · `term:domain`

## Zones

- `cafe` Café Wi-Fi: `user`, `attacker`
- `internet` Internet: `site`

## Steps

### `hello` Hello, I need shop.example

`user → site` · `legit`
Message: ClientHello: shop.example · Result: the shop got it

```text
ClientHello
  site:       shop.example
  versions:   TLS 1.3, TLS 1.2
  key share:  X25519, 9f2c 41d0 77ab
```

#### Simple

A visitor types https://shop.example. Before sending anything important, the browser greets the
site: it names the site it wants and straight away brings its **half** of the future shared key.

#### Step by step

In the first TLS message (ClientHello) the browser lists the versions and ciphers it supports, the
site's name and a single-use public key for the key exchange. All of this still travels
unencrypted.

#### Deeper

In TLS 1.3 (RFC 8446) the browser usually sends a key share (the key_share extension) right away,
for a Diffie-Hellman key exchange, for example on the X25519 curve (RFC 7748). That makes the
handshake shorter than in older versions: everything after the site's ServerHello reply is
already encrypted.

### `reply` The site's answer

`site → user` · `safe`
Message: key, certificate, signature · Result: the browser checks

```text
ServerHello          site's key share: X25519, 3a7e 90c4 12bd
--- everything below is encrypted ---
Certificate          shop.example certificate and chain
CertificateVerify    signature over the handshake so far with the site's key
Finished
```

#### Simple

The site answers with its half of the key. From the two halves both the browser and the site get
**the same shared key**, and an eavesdropper doesn't. Then, already encrypted, the site sends its
certificate and a signature proving it holds the certificate's private key.

#### Step by step

The certificate says: "this key belongs to shop.example". The CertificateVerify signature proves
the other side owns that certificate's private key and didn't just pass someone else's
certificate along.

#### Deeper

Per RFC 8446, the server in TLS is always authenticated, the client only optionally.
CertificateVerify is a signature over the handshake so far made with the certificate's private key.
It ties the certificate to this conversation and to the key shares exchanged, so an old signature
can't be replayed in another connection.

### `checks` Three checks

`user → user` · `safe`
Message: name, dates, chain · Result: all good, padlock shown

```text
name:     shop.example = shop.example        yes
dates:    2026-11-01 to 2027-01-30, now     yes
chain:    shop.example ← CA ← root           yes
signature: CertificateVerify valid           yes
```

#### Simple

The browser checks: the certificate was issued **for shop.example exactly**, it hasn't expired, and
the chain of signatures leads to a certificate authority it trusts. Everything matches, and a
padlock appears in the address bar.

#### Step by step

If any check fails, the browser doesn't carry on quietly; it shows a warning. What such warnings
mean is the subject of the next lesson.

#### Deeper

The name is matched per RFC 9525: the name from the address is compared with the dNSName entries in
the certificate, the old Common Name field must not be used for this, and a wildcard is allowed
only as the whole left-most label (`*.shop.example`). The session key in TLS 1.3 is single-use:
RFC 8446 removed static RSA key exchange, and every key exchange with public keys provides **forward secrecy**. If the
site's key is ever stolen, conversations recorded earlier can't be decrypted with it.

### `cafe` The same login from a café

`user → attacker` · `legit`
Message: ClientHello · Result: reached the attacker

#### Simple

A week later the visitor opens the same shop from a café. On the café network an attacker has
already stepped into the middle, as in the lesson "Man in the middle". The browser's hello
reaches him.

#### Step by step

The browser doesn't know its packets go through the attacker. It does the same as at home: names
shop.example and waits for an answer.

#### Deeper

The attacker can't forge a certificate for shop.example: the authority's signature would give him
away (the lesson "Signatures and certificates"). So he takes another route: a **real** certificate,
obtained honestly for his own domain shop-pay.example.

### `fake` A certificate for another name

`attacker → user` · `attack` · `without-defence`
Message: wrong name · Result: name not matched, accepted

```text
opened:       shop.example
certificate:  ⟦shop-pay.example⟧, CA signature valid, dates valid
```

#### Simple

The attacker answers with his certificate. The signature is real, the dates are fine, the chain
leads to a trusted authority. Only the name differs. Imagine a program that **doesn't match the
name**: to it, everything looks fine.

#### Step by step

The program checked the signature and the chain and decided the certificate is good. But it is
good for shop-pay.example, not for the shop.

#### Deeper

Checking the chain without matching the name is CWE-297: any certificate that any trusted authority
issued to anyone will do. Browsers always match the name; the mistakes turn up in mobile apps,
scripts and libraries where matching was switched off or written by hand.

### `leak` The password to the attacker

`user → attacker` · `attack` · `without-defence`
Message: password · Result: the attacker read it

```http
POST /login
login=anna&password=⟦Kot2024⟧
```

#### Simple

The connection is encrypted, but with the attacker. He decrypts the password, keeps it and
forwards the request to the real shop so that nobody notices anything.

#### Step by step

The encryption works honestly; the shared key is just shared with the attacker, not the shop. A
secure connection with the wrong party protects nothing.

#### Deeper

That is why in TLS checking **who** the connection is with matters as much as the encryption
itself. OWASP places CWE-297 under A07:2021 Identification and Authentication Failures.

### `mismatch` The name doesn't match

`attacker → user` · `attack` · `with-defence` · `stopped`
Message: wrong name · Result: name mismatch, connection closed

```text
opened:       shop.example
certificate:  ⟦shop-pay.example⟧   name does not match
```

#### Simple

The browser matches the name: shop.example is open, but the certificate was issued for
shop-pay.example. **No match**. The browser closes the connection and shows a warning. The password
doesn't leave.

#### Step by step

The signature and the chain are valid, but the name check is one of the required ones, and without
it the certificate is not accepted.

#### Deeper

The attacker could try to get a certificate for shop.example itself, but the authority would ask
him to prove he controls the domain. If he still fooled an authority, that certificate would show
up in the transparency logs, and the shop's owner could notice it.

## How to defend

- **Use HTTPS across the whole site, and only TLS 1.3 and 1.2.** OWASP advises TLS 1.3 by default,
  TLS 1.2 only for compatibility, and older versions switched off.
- **Don't switch off name matching in your code.** The library must check both the chain and the
  server name. A home-made certificate check is almost always worse than a ready-made one.
- **List all the site's names in the certificate.** Wildcards only where truly needed, and not for
  systems at different trust levels.
- **Key exchange with forward secrecy only.** In TLS 1.2, switch off RSA key exchange and keep
  ECDHE.
- **Don't click past a browser warning.** It means one of the checks failed.
