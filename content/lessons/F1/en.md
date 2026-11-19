# Hashes and salt: how passwords are stored

`lesson` F1 · `section` F · `wave` 1 · `format` 1

## Passport

- `cwe` 916, 759
- `owasp` A02:2021
- `attack` T1110.002
- `severity` high
- `impact` Users' passwords from a leaked database: a way into this site and into other sites with the same password
- `defence` A slow password hashing function (Argon2id) and a unique salt
- `class` Weak password storage

## Sources

- [OWASP: Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Top 10:2021, A02 Cryptographic Failures](https://owasp.org/Top10/2021/A02_2021-Cryptographic_Failures/)
- [MITRE CWE-916: Use of Password Hash With Insufficient Computational Effort](https://cwe.mitre.org/data/definitions/916.html)
- [MITRE CWE-759: Use of a One-Way Hash without a Salt](https://cwe.mitre.org/data/definitions/759.html)
- [MITRE ATT&CK T1110.002: Password Cracking](https://attack.mitre.org/techniques/T1110/002/)
- [NIST SP 800-63B-4: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [RFC 9106: Argon2 Memory-Hard Function for Password Hashing](https://www.rfc-editor.org/rfc/rfc9106.html)

## Participants

- `user` **Alice** — 192.0.2.24 · `icon:user`
- `server` **Server** — forum.example · `term:web-server`
- `db` **Database** — users table · `term:database`
- `copy` **Leaked copy** — users.sql · `icon:backup` · `term:data-breach`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`

## Zones

- `site` Site forum.example: `server`, `db` · `term:trust-boundary`
- `outside` Outside the site: `copy`, `attacker`

## Steps

### `signup` Signing up

`user → server` · `legit`
Message: POST /signup · Result: password accepted

```http
POST /signup
login=alice&password=sunny2024
```

#### Simple

Alice creates an account on a forum and picks a password. The site has to remember it somehow to
let Alice in again tomorrow. This whole lesson is about **in what form** it remembers it.

#### Step by step

The browser sends the login and password to the server over HTTPS. The server receives the
password in plain text: otherwise it could not check it. Then it decides what to write to the
database.

#### Deeper

Storing the password itself is out: any database leak hands over every password at once.
Encrypting is bad too: the key lives somewhere nearby, and with it the passwords decrypt. OWASP
advises encryption only in rare cases where the original password is really needed. Logging in
does not need it: comparing a **hash** is enough. A hash function is one-way: a password turns
into a hash at once, but a hash turns back into a password only by guessing.

### `fast` A fast hash without salt

`server → db` · `legit` · `without-defence`
Message: SHA-256(password) · Result: unsalted hash stored

```text
alice  965ccdd7…5775ac7
bob    965ccdd7…5775ac7
carol  e0efc1e7…e23d27ea
```

#### Simple

The server runs the password through the fast hash function SHA-256 and writes the result to the
database. The password itself is not there. But Alice and Bob happen to have the **same password**,
and their hashes are the same too.

#### Step by step

The hash depends only on the password. Equal passwords give equal hashes for every user of this
site and of any other site that does the same.

#### Deeper

SHA-256 is fine for checking that files are intact, but not for passwords: it was built to be
fast. Storing passwords with a fast hash is weakness CWE-916, and a hash without salt is its
special case CWE-759. Both are mapped to item A02:2021 “Cryptographic Failures” of the OWASP Top 10.

### `slow` A slow hash with salt

`server → db` · `safe` · `with-defence`
Message: Argon2id + salt · Result: everyone gets their own hash

```text
alice  $argon2id$v=19$m=19456,t=2,p=1$<salt 1>$<hash 1>
bob    $argon2id$v=19$m=19456,t=2,p=1$<salt 2>$<hash 2>
```

#### Simple

Now the server adds a **salt** to the password: a random string, different for every user. And it
computes the hash with the slow hash function Argon2id. Alice and Bob have the same password, but
their records in the database differ.

#### Step by step

The server takes a fresh random salt, hashes the password together with the salt and writes the
salt, the hash and the settings as one string. At login it takes the salt and the settings from
that string, hashes the password just typed and compares.

#### Deeper

Argon2id is described in RFC 9106 (September 2021). It spends time and memory on every hash on
purpose. OWASP gives the minimum settings: 19 MiB of memory (`m=19456` in KiB), 2 passes (`t=2`),
1 thread (`p=1`). The salt is not a secret: per NIST SP 800-63B it is at least 32 bits long and is
stored with the hash. Its job is to make the hash of every password unique.

### `dump` The database leaks

`db → copy` · `attack`
Message: copy of the users table · Result: database leaked

#### Simple

One day a copy of the database ends up with strangers. How exactly does not matter for this
lesson. What matters is that the attacker can now work on it as long as they like **on their own
machines**, and the site will never know.

#### Step by step

Leaks happen for many reasons: SQL injection, a backup in an open storage bucket, an
administrator's stolen laptop. Passwords should be stored as if the leak had already happened.

#### Deeper

Limiting login attempts does not help here: the attacker is not knocking on the login form, they
test guesses on their own computers. This is guessing with no contact with the site; in MITRE
ATT&CK it is sub-technique T1110.002 “Password Cracking”. The only protection left is how the
record in the database was made.

### `crack` Guessing from a word list

`attacker → copy` · `attack` · `without-defence`
Message: hashes of common passwords · Result: passwords found

```text
sha256("sunny2024") = ⟦965ccdd7…5775ac7⟧  → alice, bob
```

#### Simple

The attacker takes a list of common passwords, hashes them and looks for matches in the copy. A
fast hash takes no time to compute, so a huge list can be checked. A match means the password is
found, and **for Alice and Bob at once**.

#### Step by step

Equal hashes show even without guessing: the attacker sees right away that these people share a
password. Finding it once reveals it for every row with the same hash.

#### Deeper

Without salt, hashes can be computed in advance, once for all sites using the same function: that
is how the rainbow tables mentioned in CWE-759 work. A long random password will not be found by
guessing even here. But many people choose passwords from a dictionary, and a fast hash gives
those away almost at once.

### `login` Logging in as Alice

`attacker → server` · `attack` · `without-defence`
Message: alice / sunny2024 · Result: logged in

#### Simple

The attacker logs in to the forum as Alice. To the site it is an ordinary login with the right
password.

#### Step by step

The server hashes the password typed, compares it with the record in the database, sees a match
and lets them in.

#### Deeper

Worse, many people reuse one password on different sites. The attacker can try the found login and
password on email or a bank (this is credential stuffing). So a leak from a small forum hurts
other services too.

### `crack-slow` Guessing hits the price

`attacker → copy` · `attack` · `with-defence` · `stopped`
Message: hashes of common passwords · Result: every guess is costly, guessing stalls

```text
argon2id("sunny2024", <salt 1>) → ⟦no match⟧
argon2id("sunny2024", <salt 2>) → ⟦no match⟧
```

#### Simple

The attacker tries the same list, but now every guess costs **noticeable time and memory**, and it
has to be computed separately for every user: each has their own salt. Guessing drags on so long
that almost all of the database stays unread.

#### Step by step

Tables computed in advance are useless: the salt is not known in advance. Equal passwords no
longer show. Every row needs its own guessing, and every check is slow.

#### Deeper

A slow function is a price for guessing that the site sets itself: a fraction of a second goes
unnoticed for one user logging in, but for millions of guesses it adds up to huge costs. Argon2id
also needs a lot of memory, which makes guessing expensive on graphics cards and on special chips
alike. A really weak password like `123456` will still be found first, so the site also refuses to
let people choose such passwords.

## How to defend

- **A slow password hashing function.** OWASP's first choice is Argon2id (at least 19 MiB of
  memory, 2 passes, 1 thread). Without it, scrypt; on legacy systems, bcrypt with a work factor of
  10 or more; where FIPS-140 is required, PBKDF2 with HMAC-SHA-256 and 600,000 iterations.
- **No fast hashes.** MD5, SHA-1 and SHA-256 on their own are not fit for passwords.
- **A unique random salt.** One per password, at least 32 bits, stored next to the hash. The
  functions above do this themselves.
- **A secret key kept apart from the database (a “pepper”).** NIST advises passing the hash
  through a key that is stored outside the database, preferably in a hardware security module.
  Then a copy of the database alone is not enough.
- **bcrypt's limits.** Most implementations use only the first 72 bytes of the password.
- **A list of banned passwords.** When a password is set, the site checks it against a list of
  common and already leaked passwords and refuses them.
- **Rehashing old hashes.** If the database holds fast hashes, the password is hashed again with
  the new function the next time the user logs in.
