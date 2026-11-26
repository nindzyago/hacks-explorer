# Logins and people

`glossary` en · `category` people

## `phishing` Phishing

`category` people · `see` fake-page, proxy-phishing, social-engineering, mitre-attack · `lessons` I1

Forms: phishing

A trick in which someone writes to a person in the name of a bank, a boss or a support team and
lures them to a fake page or asks them to share a secret. In MITRE ATT&CK it is technique T1566.

## `social-engineering` Social engineering

`category` people · `see` phishing · `lessons` I1

Forms: social engineering

An attack on a person rather than a program: urgency, fear, authority and trust push someone into
doing what the attacker needs, such as opening a link, reading out a code or sending money.

## `fake-page` Fake page

`category` people · `see` domain, phishing, password-manager · `lessons` I1, F6, F7

Forms: fake page, fake pages

A copy of a real login page at someone else's address. Whatever is typed into it goes to the
attacker. You can tell it apart by the domain in the address bar, not by its look: pictures and a
logo are easy to copy.

## `domain` Domain

`category` people · `see` fake-page, password-manager, passkey · `lessons` I1, F6, F7

Forms: domain, domains

The name of a site in its address, for example `bank.example`. Whose site it is depends on the end
of the name, not on familiar words inside it: `login.bank.example` belongs to `bank.example`, while
`bank.example.evil.example` belongs to `evil.example`; `bank-login.example` is a different domain
too, however similar it looks. The lessons take domains from the training zone `.example`; there
are no real companies here.

## `password-manager` Password manager

`category` people · `see` domain, fake-page, second-factor · `lessons` I1

Forms: password manager, password managers

A program that stores passwords and fills them in only on the site the password was saved for. On
a fake page it will not offer the password, and that is a reason to check the address.

## `second-factor` Second factor

`category` people · `see` passkey, proxy-phishing, password-manager · `lessons` I1, F2, F6, F7

Forms: second factor, second factors, two-factor authentication

One more confirmation of a login besides the password: a code from an app or an SMS, a
notification on a phone, a hardware key. A single stolen password is then not enough. Codes from
SMS and apps can be phished on a fake page; FIDO2 keys and passkeys cannot.

## `passkey` Passkey

`category` people · `see` second-factor, domain · `lessons` I1, F6, F7

Forms: passkey, passkeys

A login without a password, with a key stored on a device or in a password manager. The key is
bound to the site's domain, so the browser will not let it be used on a fake page. It is built on the
WebAuthn and FIDO2 standards, like FIDO2 hardware keys, which often serve as a second factor next
to a password.

## `proxy-phishing` Proxy phishing

`category` people · `see` phishing, second-factor, passkey · `lessons` I1, F6

Forms: proxy phishing

Phishing in which the fake page instantly forwards everything typed into it to the real site and
shows the real site's answers. This way the attacker gets the password, the one-time code and an
open session. Login methods bound to the domain, such as passkeys, resist it.

## `user-enumeration` User enumeration

`category` people · `see` attacker, phishing · `lessons` D6

Forms: user enumeration, account enumeration

Reconnaissance in which the attacker finds out which logins or email addresses exist on a site.
The hints are different answers to "no such user" and "wrong password", the sign-up and password
recovery forms, and differing response times. The list of real logins then feeds password
guessing and phishing.

## `brute-force` Brute force

`category` people · `see` credential-stuffing, rate-limiting, password-hashing · `lessons` F2

Forms: brute force, brute-force, password guessing

Trying to guess a password one option after another: popular passwords, dictionary words, every
combination of characters. Through a login form it is held back by rate limiting; against leaked
hashes, by a slow salted hashing function. In MITRE ATT&CK it is technique T1110.

## `credential-stuffing` Credential stuffing

`category` people · `see` brute-force, data-breach, second-factor · `lessons` F2

Forms: credential stuffing

An attack in which login and password pairs leaked from one site are tried on others: people
often reuse passwords. Each account gets a single attempt, so rate limiting barely notices it. A
second factor is the best defence. In MITRE ATT&CK it is sub-technique T1110.004.

## `rate-limiting` Rate limiting

`category` people · `see` brute-force, credential-stuffing · `lessons` F2

Forms: rate limiting, rate limit, rate limits, throttling

A rule by which a site counts failed logins for each account, makes each next try wait longer and
switches login off past a limit. Per NIST, no more than 100 consecutive failed attempts. It leaves
an attacker at most a hundred guesses per account instead of millions, and it hardly notices
credential stuffing.

## `otp` One-time code

`category` people · `see` second-factor, proxy-phishing, sim-swap · `lessons` F6

Forms: one-time code, one-time codes, one-time password, one-time passwords, TOTP

A short code, usually six digits, that works once and only for a short time: it arrives by SMS or
is computed by an app (TOTP, usually a new one every 30 seconds). It serves as a second factor.
People type it by hand, so a fake page can lure it out and relay it.

## `mfa-fatigue` MFA fatigue

`category` people · `see` second-factor, social-engineering · `lessons` F6

Forms: MFA fatigue, push fatigue, push bombing

A way around a second factor in which an attacker with a valid password starts a login again and
again until the person taps “Yes” on the prompt just to make it stop. Number matching and a limit
on prompts help. In MITRE ATT&CK it is technique T1621.

## `sim-swap` SIM swap

`category` people · `see` otp, second-factor · `lessons` F6

Forms: SIM swap, SIM swaps, SIM swapping

Tricking a mobile carrier: a fraudster gets the victim's number moved to his own SIM card and
receives the victim's texts and calls, sign-in codes included. That is why NIST SP 800-63B treats
codes over the phone network as a restricted method, and SMS is among the weakest second factors.

## `webauthn` WebAuthn

`category` people · `see` passkey, key-pair, domain · `lessons` F6, F7

Forms: WebAuthn

A W3C standard by which a site and a browser sign a person in with a key instead of a password:
the site keeps a public key, the device signs a random challenge with the private one. The
signature is bound to the site's domain, so a fake page can't use it. Passkeys and FIDO2 keys run
on it.

## `key-pair` Key pair

`category` people · `see` webauthn, passkey · `lessons` F7, L1, L2

Forms: key pair, key pairs, private key, private keys, public key, public keys

Two linked keys. The private one is kept secret: it makes signatures and decrypts. The public one
can be given to anyone: it only checks signatures and encrypts what only the private key's owner
can open. It can't be used to forge a signature.

## `spear-phishing` Spear phishing

`category` people · `see` phishing, social-engineering, bec · `lessons` I2

Forms: spear phishing, spearphishing

Phishing prepared for a particular person or company, with real names, job titles and business
gathered from open sources. That makes it more convincing than a mass mailing. In MITRE ATT&CK
phishing is technique T1566, and the targeted variant is called spearphishing.

## `bec` BEC

`category` people · `see` spear-phishing, lookalike-domain, out-of-band · `lessons` I2

Forms: BEC, Business Email Compromise

Business Email Compromise: payment fraud through correspondence. The attacker writes as an
executive or a supplier from a compromised or fake mailbox and asks for money to be sent to their
own account. The main defence is confirming any change of bank details by calling a known number.

## `lookalike-domain` Lookalike domain

`category` people · `see` domain, bec, dmarc · `lessons` I2

Forms: lookalike domain, lookalike domains

A domain that differs from the real one by a letter or a hyphen: `acme-example.example` instead of
`acme.example`. It is a real domain owned by the attacker and can pass SPF, DKIM and DMARC checks, so
look at the address itself.

## `out-of-band` Second channel

`category` people · `see` bec, social-engineering · `lessons` I2

Forms: second channel, independent channel

Checking a request through a different way of reaching someone that the attacker does not
control: a call to a number from the directory or the contract, meeting in person. A reply in the
same thread does not count as a second channel.
