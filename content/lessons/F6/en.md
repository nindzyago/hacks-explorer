# Second factor and how it is bypassed

`lesson` F6 · `section` F · `wave` 1 · `format` 1

## Passport

- `owasp` A07:2021
- `attack` T1621, T1111, T1539
- `severity` high
- `impact` A way into an account protected by a password and a code from a phone
- `defence` A phishing-resistant second factor: FIDO2 keys and passkeys
- `class` Second factor bypass

## Sources

- [OWASP: Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [NIST SP 800-63B-4: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [MITRE ATT&CK T1621: Multi-Factor Authentication Request Generation](https://attack.mitre.org/techniques/T1621/)
- [MITRE ATT&CK T1111: Multi-Factor Authentication Interception](https://attack.mitre.org/techniques/T1111/)
- [MITRE ATT&CK T1539: Steal Web Session Cookie](https://attack.mitre.org/techniques/T1539/)
- [OWASP Top 10:2021, A07 Identification and Authentication Failures](https://owasp.org/Top10/2021/A07_2021-Identification_and_Authentication_Failures/)
- [RFC 6238: TOTP: Time-Based One-Time Password Algorithm](https://www.rfc-editor.org/rfc/rfc6238.html)
- [W3C: Web Authentication Level 2](https://www.w3.org/TR/webauthn-2/)

## Participants

- `user` **Alice** — 192.0.2.24 · `term:victim`
- `proxy` **Fake** — bank-login.example · `icon:browser` · `term:fake-page`
- `bank` **Bank** — bank.example · `term:domain`
- `attacker` **Hacker** — 203.0.113.66 · `term:attacker`

## Zones

- `forgery` Fake: `proxy` · `danger` · `term:proxy-phishing`
- `bank-site` Bank: `bank`
- `internet` Internet: `attacker`

## Steps

### `stolen` A password is not enough

`attacker → bank` · `attack`
Message: leaked password · Result: second factor needed

#### Simple

The hacker has Alice's password: it leaked from another site. He signs in to the bank, and the
password fits. But the bank also asks for a **second factor**: a confirmation from Alice's phone.
Without it, the login stays closed.

#### Step by step

The bank checks the password, then sends Alice a notification or waits for a one-time code. Until
that second step is passed, there is no session. A stolen password alone gets him nothing more.

#### Deeper

Second factors come in different kinds. A code by SMS, a code from an app (TOTP: usually a new one
every 30 seconds, the default RFC 6238 recommends), a “confirm this login” notification, a hardware
key or a passkey. An SMS code can be taken even without Alice: in a SIM swap, a fraudster talks the
mobile carrier into moving her number to his SIM card. NIST SP 800-63B treats delivering codes over
the phone network as a restricted method. Next the hacker tries to get around the second factor.

### `fatigue` A flood of prompts

`bank → user` · `attack` · `without-defence`
Message: “Is it you?” ×20 · Result: Alice tapped “Yes”

```text
Bank: Confirm sign-in   [Yes] [No]
Bank: Confirm sign-in   [Yes] [No]
… ×20, at night
```

#### Simple

The hacker signs in with Alice's password again and again, and each time the bank sends “Confirm
sign-in” to her phone. At night the twentieth prompt arrives, and Alice, just to make it stop,
**taps “Yes”**.

#### Step by step

The prompt doesn't say who is signing in or from where, and a single tap on “Yes” approves it. The
bank doesn't limit the number of requests. Sometimes the hacker also calls, posing as support: “tap
it so we can block the access”.

#### Deeper

This is MFA fatigue. In MITRE ATT&CK it is technique T1621: an attacker with a valid password
floods a person with requests until they accept one. NIST advises limiting the number of
notifications sent since the last successful login.

### `phish` Password and code on a fake

`user → proxy` · `attack` · `without-defence`
Message: password and code · Result: the fake has the code

```text
address:  https://⟦bank-login.example⟧/
login:    alice
code:     492731
```

#### Simple

Another way, one that doesn't count on a slip. Alice gets an email with a link to a copy of the
bank's site. She types her password and then the code from her app: the page asks for it, after
all.

#### Step by step

The fake keeps nothing for later. It passes everything typed **straight away** to the real bank
and shows Alice the bank's real answers. The code is still valid, since only seconds have passed.

#### Deeper

This is proxy phishing: OWASP describes ready-made kits that relay traffic between the person and
the real site and capture passwords and session tokens on the fly. A code typed by hand doesn't
know which site it is typed into. That is why NIST SP 800-63B doesn't count SMS and app codes as
phishing-resistant.

### `relay` The bank opens a session

`proxy → bank` · `attack` · `without-defence`
Message: password and code · Result: session for the hacker

```http
POST /login
login=alice&password=…&code=⟦492731⟧
```

#### Simple

The bank sees a correct password and a correct code and opens a session. But the session cookie
goes to the fake, and from there to the hacker. He is in Alice's account, and the second factor
was formally passed.

#### Step by step

The fake shows Alice an “error” or lets her carry on, and keeps the cookie. With it the hacker
moves around the bank's site with no password and no code, for as long as the session lives.

#### Deeper

Intercepting one-time codes is MITRE ATT&CK technique T1111, stealing a session cookie is T1539.
The description of T1539 says outright that session cookies can be used to bypass some
multi-factor authentication.

### `match` The number on the login screen

`bank → user` · `attack` · `with-defence` · `stopped`
Message: “Enter the number” · Result: login refused

```text
Bank: Sign-in from a new device. Enter the number: [ __ ]
Alice isn't signing in and ⟦sees no number⟧
```

#### Simple

Now the prompt asks not for “Yes” but for the **number** shown on the sign-in screen. Alice isn't
signing in, so there is no screen with a number. Tapping “Yes” without looking is no longer
possible.

#### Step by step

Only the person who is actually signing in sees the number. The bank also limits the number of
requests, stops sending them after a few refusals, and warns Alice.

#### Deeper

For push prompts OWASP advises a challenge with an answer, such as number matching, a rate limit on
requests and watching for bursts of prompts. Against proxy phishing the number doesn't help: the
fake can show it to Alice itself.

### `key` The key won't fit the fake

`proxy → user` · `attack` · `with-defence` · `stopped`
Message: key request · Result: no key for this domain

```text
Alice's key was made for:  ⟦bank.example⟧
the page asks for:         ⟦bank-login.example⟧
```

#### Simple

Instead of a code, Alice now has a FIDO2 key or a passkey. The fake asks her to sign in with the
key, but the key is **bound to the bank's domain**. For a different domain the browser simply won't
offer it.

#### Step by step

The browser fills in the page's domain itself rather than taking the page's word for it. The key
signs an answer only for the site it was made for. There is nothing to relay: the fake can't get a
signature for bank.example.

#### Deeper

NIST SP 800-63B calls this protection verifier name binding, and names WebAuthn as an example of a
standard that provides it. OWASP explicitly recommends such sign-in methods against proxy phishing
and prompt floods.

### `report` Alice tells the bank

`user → bank` · `safe` · `with-defence`
Message: “It wasn’t me” · Result: password changed

#### Simple

Alice tells the bank she didn't confirm anything. The bank resets her password and sees where the
attempts came from.

#### Step by step

A correct password followed by a failed second factor, when Alice wasn't signing in, means
strangers know the password. It gets changed, and the login attempts get checked.

#### Deeper

For a failed second factor OWASP advises notifying the person with the time, browser and location,
and suggesting a password change. Against proxy phishing it also advises watching for unusual
events: a login from an unfamiliar network, “impossible travel” (two logins from far-apart places
in a row), a sudden change of second-factor method.

## How to defend

- **A phishing-resistant second factor.** FIDO2 keys and passkeys are bound to the site's domain:
  on a fake they don't work. This protects against both proxy phishing and prompt floods.
- **If push prompts, then with number matching.** And with a limit on the number of requests.
- **Not SMS, if there is a choice.** An app code is better than an SMS code; against SIM swaps
  OWASP suggests a carrier account PIN or port-out protection.
- **An eye on the unusual.** An unfamiliar network, two logins from far-apart places in a row, a
  change of second-factor method, many requests in a row: all are reasons to warn the person.
- **For users:** don't confirm a sign-in you didn't start, and don't type codes on a page from an
  email link. Such a request means someone already has your password.
