# User enumeration

`lesson` D6 · `section` D · `wave` 3 · `format` 1

## Passport

- `cwe` 204, 208
- `owasp` A07:2021
- `severity` medium
- `impact` A list of the site's real logins for password guessing and phishing
- `defence` The same answer and timing for any login error, limits on attempts
- `class` Leak through differing responses

## Sources

- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Top 10:2021 A07: Identification and Authentication Failures](https://owasp.org/Top10/2021/A07_2021-Identification_and_Authentication_Failures/)
- [MITRE CWE-204: Observable Response Discrepancy](https://cwe.mitre.org/data/definitions/204.html)
- [MITRE CWE-208: Observable Timing Discrepancy](https://cwe.mitre.org/data/definitions/208.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — mail.example · `term:web-server`
- `db` **Database** — users table · `term:database`

## Zones

- `internet` Internet: `attacker`
- `site` Mail mail.example: `server`, `db`

## Steps

### `try-unknown` Logging in with a made-up login

`attacker → server` · `attack`
Message: login ivan42 · Result: checking

```http
POST /login
Host: mail.example

login=⟦ivan42⟧&password=qwerty
```

#### Simple

The attacker tries to log in to the mail service as `ivan42` with any password. He has no idea
whether such a person exists: what he wants is not to get in, but the **server's answer**.

#### Step by step

The server looks for `ivan42` in the database and finds nothing. What it says next depends on how
the programmer wrote the error message.

#### Deeper

User enumeration is not password cracking but reconnaissance. The attacker builds a list of real
logins, so that later he guesses passwords only for them or sends their owners phishing emails.
In the MITRE catalogue this weakness is CWE-204 "Observable Response Discrepancy": the product
answers differently and so gives away its internal state to an outsider.

### `leak-unknown` "No such user"

`server → attacker` · `attack` · `without-defence`
Message: "No such user" · Result: ivan42 does not exist

```text
Error: ⟦user not found⟧
```

#### Simple

The server says it plainly: **there is no such login**. For an ordinary person that is a helpful
hint; for the attacker it answers the question "does ivan42 exist?".

#### Step by step

The attacker notes: `ivan42` is a miss. He will check the next login from his word list the same
way.

#### Deeper

Such hints are not limited to the login form. The password recovery form says "email sent" or "we
have no such address", the sign-up form says "login taken". Each of them answers the same
question, and all three need protecting.

### `same-unknown` A generic answer

`server → attacker` · `safe` · `with-defence`
Message: "Wrong login or password" · Result: learned nothing

```text
Error: wrong login or password
```

#### Simple

The server answers with **one generic phrase**: wrong login or password. It does not say which
part was wrong.

#### Step by step

The attacker cannot tell whether the login does not exist or the password simply did not match.
The question "does ivan42 exist?" stays unanswered.

#### Deeper

This is exactly what OWASP advises in its Authentication Cheat Sheet: the same message when the
login is wrong, the password is wrong, the account does not exist or is locked. For password
recovery: "if that address is registered, we have sent it an email"; for sign-up: "an activation
link has been sent to the address you gave".

### `try-known` Logging in with a real login

`attacker → server` · `attack`
Message: login anna · Result: checking

```http
POST /login
Host: mail.example

login=⟦anna⟧&password=qwerty
```

#### Simple

The next login on the list is `anna`. Again the password is a guess: the attacker only needs the
**answer**.

#### Step by step

This person does have a mailbox. The server finds her row in the database and checks the password
against the hash, and of course it does not match.

#### Deeper

The attacker runs through thousands of logins with a program: common first names, surnames,
staff addresses found in public sources. Every server answer sorts a login into one of two piles.

### `leak-known` "Wrong password"

`server → attacker` · `attack` · `without-defence`
Message: "Wrong password" · Result: anna exists

```text
Error: ⟦wrong password⟧
```

#### Simple

This time the server says **"wrong password"**. So the login was right: `anna` exists on this mail
service.

#### Step by step

Even if the texts were the same, the **timing** could give it away. For `ivan42` the server
answered at once: there was no hash to check. For `anna` it computed a slow password hash, and the
answer came noticeably later.

#### Deeper

MITRE lists the timing difference as a weakness of its own: CWE-208 "Observable Timing
Discrepancy". Slow password hashing is there to resist guessing, but it also makes the gap
visible when no hash is computed at all for a missing login. A few repeats are enough for the
attacker to tell a fast answer from a slow one.

### `same-known` Same answer, same time

`server → attacker` · `safe` · `with-defence`
Message: "Wrong login or password" · Result: anna not revealed

```text
Error: wrong login or password
```

#### Simple

For `anna` the server answers with **the same phrase** and in about **the same time** as for
`ivan42`. The answers cannot be told apart.

#### Step by step

When the login does not exist, the server still computes a hash, of a dummy value prepared in
advance. Both branches follow the same path and take the same time.

#### Deeper

OWASP warns that the logic itself creates the gap: a "quick exit" when the user is not found. The
advice is to follow the same path whatever the login and password are. The HTTP status code and
the page the server redirects to after an error must be the same too.

### `burst` Thousands of logins in a row

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: 10,000 more tries · Result: the attack failed

```text
try 11: ⟦login=olga⟧ → too many attempts, please wait
```

#### Simple

The attacker tries to **run through** logins even faster. The server notices the stream of failed
logins and starts **slowing them down**.

#### Step by step

After a few failures the server answers "please wait" and does not check logins at all. Running
through thousands of names now takes weeks.

#### Deeper

OWASP Top 10:2021, in item A07, advises limiting or increasingly delaying failed login attempts
without locking out the real owners, and logging all failures. The Authentication Cheat Sheet
adds that the lockout counter belongs to the account, not to the attacker's address. Against
trying many logins from many addresses, server-wide limits help as well.

## How to defend

- **One phrase for all errors.** "Wrong login or password" whether the login is missing, the
  password did not match or the account is locked. The same status code and the same page address.
- **The same timing.** When the login does not exist, the server still computes a password hash,
  so the answer does not come noticeably faster.
- **Password recovery and sign-up.** "If that address is registered, we have sent an email"; at
  sign-up, an email to the given address instead of "login taken" on screen.
- **Limits on attempts.** A growing pause or a temporary lock after failures, overall limits on the
  number of logins, and every failure written to the log.
- **Login that is stronger than the username.** Even if the list of logins leaks, long passwords
  and a second factor leave guessing pointless.
