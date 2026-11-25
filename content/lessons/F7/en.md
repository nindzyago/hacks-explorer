# Passkeys: signing in without a password

`lesson` F7 · `section` F · `wave` 3 · `format` 1

## Passport

- `owasp` A07:2021
- `attack` T1566.002
- `severity` high
- `impact` A password lured out by a fake page, and with it a way into the account
- `defence` A passkey instead of a password: the key is bound to the site's domain
- `class` Credential phishing

## Sources

- [W3C: Web Authentication Level 2](https://www.w3.org/TR/webauthn-2/)
- [OWASP: Passkey Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html)
- [OWASP: Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [NIST SP 800-63B-4: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [MITRE ATT&CK T1566.002: Spearphishing Link](https://attack.mitre.org/techniques/T1566/002/)
- [OWASP Top 10:2021, A07 Identification and Authentication Failures](https://owasp.org/Top10/2021/A07_2021-Identification_and_Authentication_Failures/)

## Participants

- `attacker` **Hacker** — 203.0.113.66 · `term:attacker`
- `user` **Alice** — 192.0.2.24 · `term:passkey`
- `fake` **Fake** — bank-login.example · `icon:browser` · `term:fake-page`
- `bank` **Bank** — bank.example · `term:domain`

## Zones

- `internet` Internet: `attacker`
- `forgery` Fake: `fake` · `danger` · `term:phishing`
- `bank-site` Bank: `bank`

## Steps

### `register` A key for the bank

`user → bank` · `safe` · `with-defence`
Message: public key · Result: the bank keeps it

```text
site (RP ID):  bank.example
public key:    MFkwEwYHKoZIzj0C…   → to the bank
private key:   stays on the phone
```

#### Simple

One day Alice turns on passkey sign-in at her bank. Her phone creates a **key pair** just for
bank.example. The public key goes to the bank; the private key never leaves the phone. There is no
password any more.

#### Step by step

The bank sends a random challenge and its domain. The phone asks for a fingerprint or a PIN,
creates a new key pair and notes which site it belongs to. The bank saves the public key with
Alice's account.

#### Deeper

This is how the WebAuthn standard works. A public key can only check a signature, not make one. So
a leak of the bank's database gives an attacker nothing to sign in with: there is no secret in it
to replay. A passkey can live on one device or be synced between devices by a password manager.

### `bait` An email with a link

`attacker → user` · `attack` · `icon:mail`
Message: email with a link · Result: the fake is open

```text
From: Bank <support@⟦bank-login.example⟧>
Link: https://⟦bank-login.example⟧/login
```

#### Simple

Alice gets an email that looks as if it came from her bank, with a sign-in link. The link leads to
a copy of the bank's site on someone else's domain. Alice opens it, as almost anyone would.

#### Step by step

The fake looks like the real sign-in page. The only difference is the address, and it is easy to
miss.

#### Deeper

A phishing email with a link is MITRE ATT&CK sub-technique T1566.002 “Spearphishing Link”. The
lesson “Phishing” covers this part in detail. What matters here is what comes next: what Alice
signs in with.

### `type` A password on the fake

`user → fake` · `attack` · `without-defence`
Message: login and password · Result: password typed

```text
address:   https://⟦bank-login.example⟧/login
login:     alice
password:  ••••••••
```

#### Simple

Alice signs in with her password, as always. A password is text a person knows and can **type
anywhere**, including on a fake page.

#### Step by step

The form sends the login and password to the fake's server. Nothing in a password says which site
it is meant for.

#### Deeper

NIST SP 800-63B states plainly that passwords are not phishing-resistant. Neither are SMS and app
codes: people type them by hand, and they are not tied to the site.

### `steal` The password reaches the hacker

`fake → attacker` · `attack` · `without-defence`
Message: alice / password · Result: stolen

#### Simple

The fake passes the password to the hacker and shows Alice “please try again later”.

#### Step by step

The login and password pair is now stored with the hacker. He can use it at once or sell it.

#### Deeper

If Alice reused this password on other sites, they are at risk too: that is credential stuffing.

### `login` Into the real bank

`attacker → bank` · `attack` · `without-defence`
Message: alice / password · Result: signed in

#### Simple

The hacker signs in to the real bank with Alice's password. To the bank it is an ordinary login.

#### Step by step

The bank compares the password with the stored hash, sees a match and opens a session.

#### Deeper

A password is a shared secret: both the person and the site know it (the site as a hash).
Anything that can be known can be lured out. A passkey works differently: only Alice's device
knows the secret.

### `ask` The fake asks for a passkey

`fake → user` · `attack` · `with-defence` · `stopped`
Message: passkey sign-in · Result: no key here

```text
page:          ⟦bank-login.example⟧
Alice's keys:  ⟦bank.example⟧
no match → the browser offers nothing
```

#### Simple

The fake asks Alice to sign in with a passkey. But the browser sees the page's address itself,
bank-login.example, and looks for a key for it. Alice's key was made for bank.example, so there is
**nothing to offer**. And Alice has no password she could type in.

#### Step by step

A page can't name someone else's domain to the browser: it may ask for a key only for its own
domain or a parent of it. bank.example is not a parent of bank-login.example; it is a different
domain.

#### Deeper

Under WebAuthn the site (RP ID) defaults to the page's domain, and the page may only name its own
domain or one further up the chain. NIST SP 800-63B calls this verifier name binding and names
WebAuthn as an example of a phishing-resistant standard. Even proxy phishing doesn't help here: the
bank won't accept a signature made for bank-login.example.

### `challenge` The real bank: a challenge

`bank → user` · `safe` · `with-defence`
Message: random challenge · Result: fingerprint asked

```text
site (RP ID):  bank.example
challenge:     9f3c1a7e5b2d8c04…   (new for every sign-in)
```

#### Simple

Alice didn't trust the email and opened the bank herself, from a bookmark. The bank sends a
**challenge**: a random number, new for every sign-in. The phone asks for a fingerprint or a PIN.

#### Step by step

The browser hands the phone the challenge, the site's domain and the page's address. The phone
finds the key for bank.example and, after checking the fingerprint, is ready to sign.

#### Deeper

The challenge protects against replay: an old signature won't fit a new challenge. WebAuthn advises
a challenge of at least 16 bytes. The fingerprint or PIN is checked on the phone itself and never
goes to the bank: the bank only gets a flag saying the check passed.

### `sign` Signature and sign-in

`user → bank` · `safe` · `with-defence`
Message: signed challenge · Result: signed in

```text
origin:     https://bank.example
challenge:  9f3c1a7e5b2d8c04…
signature:  with Alice's private key
```

#### Simple

The phone signs the challenge with the private key and sends the signature to the bank. The bank
checks it with Alice's public key. The signature is valid, so she is in. **Not a single secret**
crossed the network.

#### Step by step

The signed data includes the challenge, the page's address and a hash of the site's domain. The
bank checks all three: the challenge is the one it issued, the address is its own, the domain is
its own. Only then does it open a session.

#### Deeper

OWASP advises verifying every field of the response on the server with a maintained library, and
requiring user verification (fingerprint or PIN) when a passkey serves as multi-factor sign-in.
Passkeys don't save you from everything: a weak account recovery, a hijacked session used to add an
attacker's key, or a compromised sync account all get around them.

## How to defend

- **Passkeys instead of passwords.** The key is bound to the domain, a fake page has no key, and the
  site's database holds only the public key.
- **Checks on the server.** A maintained WebAuthn library; check the challenge, the page's address,
  the domain and the user-verification flag.
- **Safe recovery.** Account recovery must not be weaker than the passkey, or the attacker will go
  through it. Add a new key only after a fresh sign-in.
- **More than one key.** So that losing a phone doesn't force a weak fallback.
- **For users:** if a site offers a passkey, turn it on. If a page suddenly asks for a password
  while you sign in with a passkey, check the address.
