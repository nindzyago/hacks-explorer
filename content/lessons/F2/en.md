# Brute force and credential stuffing

`lesson` F2 · `section` F · `wave` 1 · `format` 1

## Passport

- `cwe` 307, 308
- `owasp` A07:2021
- `attack` T1110.001, T1110.004
- `severity` high
- `impact` A way into someone's account with a password that leaked from another site
- `defence` Limited login attempts, a second factor and checking passwords against breaches
- `class` Credential guessing

## Sources

- [OWASP: Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Top 10:2021, A07 Identification and Authentication Failures](https://owasp.org/Top10/2021/A07_2021-Identification_and_Authentication_Failures/)
- [OWASP: Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [MITRE CWE-307: Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html)
- [MITRE CWE-308: Use of Single-factor Authentication](https://cwe.mitre.org/data/definitions/308.html)
- [MITRE ATT&CK T1110.001: Password Guessing](https://attack.mitre.org/techniques/T1110/001/)
- [MITRE ATT&CK T1110.003: Password Spraying](https://attack.mitre.org/techniques/T1110/003/)
- [MITRE ATT&CK T1110.004: Credential Stuffing](https://attack.mitre.org/techniques/T1110/004/)
- [NIST SP 800-63B-4: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)

## Participants

- `user` **Alice** — 192.0.2.24 · `term:victim`
- `server` **Shop** — shop.example · `icon:server` · `term:web-server`
- `attacker` **Hacker** — 203.0.113.66 · `term:attacker`
- `leak` **Leak** — forum.example · `icon:backup` · `term:data-breach`

## Zones

- `shop` Shop shop.example: `server`
- `outside` Outside the shop: `attacker`, `leak`

## Steps

### `signup` The same password

`user → server` · `legit`
Message: email and password · Result: account created

```http
POST /signup
email=alice@mail.example&password=sunny2024
```

#### Simple

Alice signs up at an online shop. She can't be bothered to invent a new password, so she uses the
one she already has on an old forum. Lots of people do the same.

#### Step by step

The shop takes the email address and the password and stores the password properly: a slow hash
with a salt. Nothing wrong on that side. The weak spot is the password itself: it **already lives
on another site**.

#### Deeper

An account is only as safe as every other place that holds the same password. The shop can't tell
that a password is reused elsewhere. NIST SP 800-63B requires checking a new password against a
list of common and already leaked ones, but that catches only passwords that leaked earlier:
Alice's will leak later.

### `leak` The forum leaks

`leak → attacker` · `attack`
Message: leaked pairs · Result: the hacker has them

```text
alice@mail.example   sunny2024
bob@mail.example     qwerty123
…
```

#### Simple

The old forum gets hacked, and its user database with passwords ends up in the open. The hacker
downloads a ready-made list: an email and a password, line after line.

#### Step by step

The forum stored passwords with a fast hash and no salt, so most of them have already been cracked
(the lesson “Hashes and salt” shows how). Now the hacker has pairs that **definitely worked** for
real people.

#### Deeper

Lists like this are gathered from many breaches and sold or posted whole. Credential stuffing
relies on people reusing passwords: in MITRE ATT&CK it is sub-technique T1110.004, with the pairs
taken from breaches of unrelated sites.

### `guess` Guessing blind

`attacker → server` · `attack` · `without-defence`
Message: top passwords · Result: no limit

```text
alice@mail.example  123456     ✗
alice@mail.example  password   ✗
alice@mail.example  qwerty     ✗
… thousands more, the site stays silent
```

#### Simple

First the hacker tries the easy way: popular passwords for Alice's email, one after another. The
shop answers “wrong password” and lets him try again, **forever**.

#### Step by step

The hacker's program sends login attempts automatically, thousands an hour. Alice's password is
not among the most common ones, so this way it will take a long time to find. But the site does
nothing to stop it: no delay, no lockout.

#### Deeper

This is password guessing through the login form, MITRE ATT&CK sub-technique T1110.001 “Password
Guessing”. A site that doesn't limit failed attempts has weakness CWE-307. There is also the
reverse, password spraying (T1110.003): one common password is tried against many accounts, so
that no single account hits its limit.

### `stuff` Pairs from the leak

`attacker → server` · `attack` · `without-defence`
Message: pairs from the leak · Result: Alice's pair works

```text
bob@mail.example    qwerty123  ✗
alice@mail.example  ⟦sunny2024⟧  ✓
```

#### Simple

Now the hacker takes the forum list and tries **each pair once**. Most don't work, but Alice's
password is the same. One attempt, and it's a hit.

#### Step by step

Each account gets one or two attempts, so a lockout after a few failures hardly ever triggers.
The attempts come from many addresses, so a limit per IP does little too.

#### Deeper

This is credential stuffing: OWASP describes it as testing username and password pairs obtained
from the breach of another site. The password is correct, so the site sees a normal login. OWASP
warns that blocking addresses can't be the main defence: stuffing tools spread requests over many
IPs, so each address sends only a few.

### `inside` Logged in as Alice

`server → attacker` · `attack` · `without-defence`
Message: session for alice · Result: the hacker is in

#### Simple

The shop opens Alice's session for the hacker. He sees her orders and address, and can order
something with her saved card.

#### Step by step

The site checked the password, it matched, and the site asked nothing more. One factor, the
password, decides everything.

#### Deeper

Logging in with only a password where more than one factor is needed is weakness CWE-308. The
OWASP Top 10 places credential stuffing and brute force under A07:2021 “Identification and
Authentication Failures”.

### `throttle` Limited attempts

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: the 100th failure · Result: password login off

```text
alice@mail.example  attempts 1–5   ✗  wait 1 s, 2 s, 4 s…
alice@mail.example  attempt ⟦100⟧   ✗  password login disabled
```

#### Simple

Now the shop counts failed attempts for each account. After a few failures it makes the next try
wait longer and longer, and past the limit password login is switched off. Blind guessing **comes
to a halt**.

#### Step by step

The counter belongs to the account, not to an address: switching IPs doesn't help. The delay grows
after each failure, and after at most 100 failures password login is switched off: a hundred
guesses instead of millions.

#### Deeper

NIST SP 800-63B caps consecutive failed attempts on one account at a hundred, after which that
way of signing in is disabled. To keep a hacker from locking the owner out on purpose, NIST also
suggests a bot check and a delay that grows after each failure. Against pair stuffing a counter
like this is weak on its own: there is only one attempt per account.

### `second` Right password, not enough

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: leaked password · Result: second factor needed

#### Simple

The hacker tries the leaked pair, and the password fits. But Alice has a **second factor** turned
on: the shop waits for a confirmation from her phone. The hacker doesn't have it, so the login
stays closed.

#### Step by step

The server checks the password and then asks for a second proof. Without it no session is
created, and Alice gets a notice about the attempt.

#### Deeper

OWASP calls multi-factor authentication the best defence against most password attacks, including
credential stuffing and password spraying. Checking passwords against breach lists helps too, but
only for passwords that leaked before they were chosen. When a password leaks later, the second
factor is what holds.

### `alert` A notice to Alice

`server → user` · `safe` · `with-defence`
Message: login attempt · Result: Alice changes it

#### Simple

The shop writes to Alice: someone typed your correct password but failed the second check. Alice
realises the password has leaked and changes it everywhere she reused it.

#### Step by step

The notice gives the time, the browser and the rough location of the attempt. If it wasn't Alice,
strangers know the password, and it's time to change it.

#### Deeper

OWASP advises telling users about unusual logins without flooding them with messages. A failed
second factor after a correct password is a strong sign that the password is compromised.

## How to defend

- **A second factor.** According to OWASP, the best defence against credential stuffing: a leaked
  password alone no longer opens the account. FIDO2 keys and passkeys are best.
- **Limited attempts per account.** A growing delay and a cap on consecutive failed attempts (no
  more than 100, per NIST). Count per account, not per IP.
- **Checking passwords against breaches.** At sign-up and on a password change the site compares
  the password with a list of common and leaked passwords and asks for another one.
- **Defences against automation.** Blocking addresses and bot checks help against simple attacks,
  but OWASP advises not to rely on them alone.
- **Login notices.** Tell users about a login from a new device and about a failed second factor.
- **For users:** a different password for every site (a password manager helps) and a second
  factor wherever it is offered.
