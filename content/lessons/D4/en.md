# Attacks on JWT

`lesson` D4 · `section` D · `wave` 3 · `format` 1

## Passport

- `cwe` 347
- `owasp` A01:2021, A02:2021
- `severity` critical
- `impact` Administrator rights from a home-made token
- `defence` Signature check with a fixed algorithm
- `class` Access token forgery

## Sources

- [RFC 7519: JSON Web Token (JWT)](https://www.rfc-editor.org/rfc/rfc7519.html)
- [RFC 7518: JSON Web Algorithms, the none algorithm](https://www.rfc-editor.org/rfc/rfc7518.html#section-3.6)
- [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
- [OWASP: JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)
- [MITRE CWE-347: Improper Verification of Cryptographic Signature](https://cwe.mitre.org/data/definitions/347.html)
- [OWASP Top 10:2021, A01 Broken Access Control](https://top10.owasp.org/2021/A01_2021-Broken_Access_Control)
- [OWASP Top 10:2021, A02 Cryptographic Failures](https://top10.owasp.org/2021/A02_2021-Cryptographic_Failures)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **API server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — users table · `term:database`

## Zones

- `internet` Internet: `attacker`
- `site` Service api.example: `server`, `db` · `term:trust-boundary`

## Steps

### `login` A normal login

`attacker → server` · `legit`
Message: login and password · Result: password correct

```http
POST /login

login=boris&password=…
```

#### Simple

The attacker is an ordinary user of the service. They log in with their own login and password,
like everyone else.

#### Step by step

The server checks the password. Instead of a session ID it will hand out a **token** — a pass the
client shows with every request.

#### Deeper

The handy thing about a token is that the server does not have to store sessions: everything it
needs is written in the token itself. But then the server must be sure that it wrote the token
itself and nobody else did.

### `token` The server issues a JWT

`server → attacker` · `legit`
Message: JWT, role user · Result: token issued

```text
{"alg":"HS256","typ":"JWT"}
{"sub":"77","role":"user","exp":…}
signature: HMAC(server secret)
```

#### Simple

The server issues a **JWT** in three parts: header, data and signature. The data says: user 77,
role `user`. The server signs it with its secret.

#### Step by step

The parts are base64url-encoded and joined with dots. That is encoding, not encryption: anyone can
decode the token and read what is inside. Only the signature protects it.

#### Deeper

The format is defined in RFC 7519. The `alg` header says which algorithm signed the token: here
HS256, that is HMAC with SHA-256 and a shared secret. The `exp` field is the token's expiry time.
OWASP points out that a signed JWT is not confidential: no passwords or personal data belong in it.

### `forge` The attacker rewrites the token

`attacker → attacker` · `attack`
Message: alg none, role admin · Result: forgery ready

```text
{"alg":"⟦none⟧","typ":"JWT"}
{"sub":"77","role":"⟦admin⟧","exp":…}
signature: ⟦(empty)⟧
```

#### Simple

The attacker changes the role in the data to **admin**. They cannot sign it — they have no
secret. So they write in the header "algorithm: **none**", meaning "no signature", and simply drop
the signature.

#### Step by step

All of this happens on the attacker's side, without contacting the server: decode, change two
fields, encode back. The only question is whether the server will believe it.

#### Deeper

The value `none` does exist in the standard: RFC 7518 (section 3.6) describes an unsigned token.
But the same section says implementations **must not** accept such tokens by default. RFC 8725
describes another attack on `alg`: a token with RS256 is rewritten to HS256, and the library
checks an HMAC using the RSA public key as the secret.

### `accept` The server trusts the header

`attacker → server` · `attack` · `without-defence`
Message: Bearer with alg none · Result: accepted

```http
GET /admin/users
Authorization: Bearer ⟦eyJhbGciOiJub25lIi…⟧
```

#### Simple

The server reads the token header, sees "no signature" and **believes** it: nothing to check. The
data says `admin` — so admin it is.

#### Step by step

The server hands the token to a library and asks "is this token valid?". The library takes the
algorithm from the token itself, not from the server's settings. The `none` algorithm always
passes the check.

#### Deeper

In the MITRE catalogue this is CWE-347 "Improper Verification of Cryptographic Signature": the
signature is not checked or is checked incorrectly. The root of the bug is that the one being
checked makes the decision about the check: the received token picks the algorithm.

### `verify` The signature is checked strictly

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: Bearer with alg none · Result: attack failed

```http
GET /admin/users
Authorization: Bearer ⟦eyJhbGciOiJub25lIi…⟧
```

#### Simple

Now the server itself knows which algorithm signs its tokens — **HS256 only**. It rejects a token
with `none` at once, before reading the role.

#### Step by step

The list of allowed algorithms is set in the server's configuration. A token with a different
algorithm, without a signature or with a wrong signature is not accepted. The role in the token is
read only after the check.

#### Deeper

RFC 8725 (section 3.1) requires libraries to let the caller set the allowed algorithms and to use
no others, and each key to be used with exactly one algorithm. That closes both `none` and the
RS256-to-HS256 swap.

### `dump` A query as admin

`server → db` · `attack` · `without-defence`
Message: all users · Result: attack

```sql
SELECT * FROM users
```

#### Simple

The server treats the attacker as an administrator and pulls **all users** from the database.

#### Step by step

The server does have a role check, but it looks at the token, and the attacker wrote the token.
The permission check works correctly — on false data.

#### Deeper

The OWASP Top 10:2021 lists replaying or tampering with a JWT among the examples of item A01
"Broken Access Control". OWASP maps CWE-347 to A02 "Cryptographic Failures".

### `leak` The data leaks

`server → attacker` · `attack` · `without-defence`
Message: list of users · Result: rights taken over

```http
HTTP/1.1 200 OK
```

#### Simple

The attacker gets **admin access** without an administrator's password — with a single home-made
token.

#### Step by step

The same trick works for any user: just put someone else's number in the token's `sub`.

#### Deeper

There is another road to forgery — a **weak secret**. If HS256 is signed with a short or
dictionary password, an attacker with one real token guesses the secret on their own machine,
without any requests to the server (RFC 8725, section 2.2), and then signs whatever they like.

### `reject` Refused: token not accepted

`server → attacker` · `safe` · `with-defence`
Message: 401 Unauthorized · Result: no access

```http
HTTP/1.1 401 Unauthorized
```

#### Simple

The server answers: **the token is invalid**. The attacker does not get the list of users.

#### Step by step

The refusal goes into the log. An unsigned token from a client is a clear sign of an attack.

#### Deeper

A strict signature check works together with other measures: an HS256 secret of at least 256 bits
(RFC 7518, section 3.2) that is random rather than a password (RFC 8725, section 3.5), a short
`exp`, checks of `iss` and `aud`. A JWT that has been
issued is hard to revoke, so OWASP advises keeping its lifetime short.

## How to defend

- **Always verify the signature and choose the algorithm yourself.** The server sets the list of
  allowed algorithms in its configuration; `alg` from the token decides nothing. `none` is not
  accepted.
- **One key, one algorithm.** A key for RS256 is never used as an HMAC secret; that closes
  algorithm confusion.
- **A strong secret.** For HS256 — a random secret of at least 256 bits from a cryptographic
  generator, not a password.
- **Short lifetime.** The `exp` field is checked; tokens live briefly, and a denylist handles
  revocation.
- **Check who issued it and for whom.** The `iss` and `aud` fields are compared with the expected
  values.
- **Nothing secret inside.** Anyone who gets a JWT can read it: the signature protects it from
  changes, not from reading.
