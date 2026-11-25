# Rainbow tables

`lesson` F3 · `section` F · `wave` 3 · `format` 1

## Passport

- `cwe` 759, 916
- `owasp` A02:2021
- `attack` T1110.002
- `severity` high
- `impact` Passwords from a leaked database in seconds, with no guessing on the spot
- `defence` A unique salt for every password and a slow hashing function
- `class` Weak password storage

## Sources

- [MITRE CWE-759: Use of a One-Way Hash without a Salt](https://cwe.mitre.org/data/definitions/759.html)
- [MITRE CWE-916: Use of Password Hash With Insufficient Computational Effort](https://cwe.mitre.org/data/definitions/916.html)
- [MITRE ATT&CK T1110.002: Password Cracking](https://attack.mitre.org/techniques/T1110/002/)
- [OWASP: Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Top 10:2021, A02 Cryptographic Failures](https://owasp.org/Top10/2021/A02_2021-Cryptographic_Failures/)
- [NIST SP 800-63B-4: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)

## Participants

- `db` **DB** — users · `term:database`
- `copy` **Leak** — hashes.txt · `icon:backup` · `term:data-breach`
- `attacker` **Hacker** — 203.0.113.66 · `term:attacker`
- `table` **Table** — MD5 · `icon:document` · `term:rainbow-table`

## Zones

- `site` Site intranet.example: `db`
- `outside` Outside the site: `copy`, `attacker`, `table`

## Steps

### `build` A table in advance

`attacker → table` · `attack`
Message: hash chains · Result: the table is ready

```text
chain:   password₁ →H→ hash →R₁→ password₂ →H→ hash →R₂→ … → password₁₀₀₀
stored:  password₁ … password₁₀₀₀   (the middle is not stored)
```

#### Simple

Long before any leak, the hacker computes hashes for a huge number of possible passwords once and
puts them into a table. Or just downloads a ready-made one. The table works for **any site** that
hashes passwords with the same function and no salt.

#### Step by step

Writing down every “password, hash” pair is out of the question: there are far too many. So the
table stores chains. Take a password, compute its hash, turn the hash into a new candidate
password, hash that, and so on a thousand times. Only the first and the last password of each
chain go into the table.

#### Deeper

The “hash to password” step is done by a reduction function (R in the picture). It does not
reverse the hash; it just turns a hash into a string of the right shape. Each link of the chain
uses its own reduction function, hence the word “rainbow”: this way chains merge with each other
less often. It is a trade-off between time and memory: the table is many times smaller than the
full list, and looking things up in it takes computation.

### `dump` Unsalted hashes leak

`db → copy` · `attack` · `without-defence`
Message: unsalted MD5 · Result: hashes leaked

```text
alice  94acd18c6fa4d651b7562445c2339b2c
bob    3fc0a7acf087f549ac2b266baf94b8b1
```

#### Simple

A company's internal site stores passwords as unsalted MD5. One day the users table leaks, and
the hashes end up with the hacker.

#### Step by step

The hash depends only on the password. So the hash of `sunny2024` here is the same as on any other
site with unsalted MD5, and the same as in a table computed a year ago.

#### Deeper

A hash without a salt is weakness CWE-759; its description names rainbow tables as a way to
compute hashes in advance. A fast function such as MD5 is also CWE-916: hashes are computed very
quickly both when the table is built and during the lookup.

### `lookup` Looking up the table

`attacker → table` · `attack` · `without-defence`
Message: Alice's hash · Result: chain found

```text
94acd18c… →R→ candidate →H→ … →  ⟦the end matches the end of chain 48 213⟧
```

#### Simple

The hacker takes Alice's hash and looks for it in the table. The lookup takes seconds or minutes,
not years of guessing.

#### Step by step

First he assumes the hash is in the last link: he applies the last reduction and checks whether the
result is among the chain ends. If not, he assumes the next-to-last link and computes from there to
the end of the chain, and so on. A match means the hash is somewhere inside that chain.

#### Deeper

Then he recomputes that chain from its start until he reaches the hash he wants: the password just
before it is the answer. A table doesn't find every password, only those that landed in its
chains. That is why it is built for a set chosen in advance: for example, all lowercase letters and
digits up to nine characters long.

### `found` The password is found

`table → attacker` · `attack` · `without-defence`
Message: sunny2024 · Result: password found

```text
94acd18c… → ⟦sunny2024⟧
```

#### Simple

The table gives out the password. The hacker didn't guess anything for this site: all the heavy
work was done in advance, once.

#### Step by step

The same lookup works for every hash in the leak that falls within the table's set. Identical
hashes of different people give away a shared password at once.

#### Deeper

In MITRE ATT&CK this is sub-technique T1110.002 “Password Cracking”: its description names both
systematic guessing and a pre-computed rainbow table. The cracking happens on the attacker's own
computers, so the site never learns about it and can no longer interfere.

### `dump-salted` Salted hashes leak

`db → copy` · `attack` · `with-defence`
Message: salted Argon2id · Result: hashes leaked

```text
alice  $argon2id$v=19$m=19456,t=2,p=1$<salt 1>$<hash 1>
bob    $argon2id$v=19$m=19456,t=2,p=1$<salt 2>$<hash 2>
```

#### Simple

Now the site adds its own random **salt** to every password and computes a slow hash. The
database leaks just the same, but the hashes in it are different now.

#### Step by step

The salt is stored next to the hash and isn't a secret. Its job is to make every password's hash
unique: even if Bob also chose `sunny2024`, his record would not match Alice's.

#### Deeper

NIST SP 800-63B requires a salt of at least 32 bits. The salt is chosen when the password is
stored, that is, after any table has already been built.

### `lookup-salted` The table misses

`attacker → table` · `attack` · `with-defence` · `stopped`
Message: salted hash · Result: not in the table

```text
argon2id("sunny2024", <salt 1>) ≠ ⟦any hash in the table⟧
```

#### Simple

The hacker looks for Alice's hash in the table but **doesn't find it**. The table was computed for
unsalted MD5, and here there is both a salt and a different function.

#### Step by step

The hash depends on the password and the salt together. For a table to work, it would have to be
built again for every salt. With salts of 32 bits or more that means billions of different tables,
one per possible salt.

#### Deeper

OWASP names protection against pre-computed tables as one of the jobs of a salt. Another job: equal
passwords are no longer visible, and without cracking no one can tell that Alice and Bob share a
password.

### `per-salt` Only slow guessing is left

`attacker → copy` · `attack` · `with-defence`
Message: guesses per salt · Result: slow and costly

#### Simple

All the hacker can do is try guesses for each user separately, with that user's salt and a slow
function. It is slow and expensive, and most passwords will never be found.

#### Step by step

Each guess costs noticeable time and memory and is good for one database row only. There is no
ready-made work done in advance any more.

#### Deeper

A truly simple password from the top of a dictionary will still be found. That is why the site
also refuses passwords from a list of common and leaked ones, and a secret key outside the
database (a “pepper”) makes a copy of the database alone useless.

## How to defend

- **A unique random salt.** One per password, at least 32 bits, stored next to the hash.
  Pre-computed tables are useless against it.
- **A slow password hashing function.** Argon2id, scrypt, bcrypt or PBKDF2 instead of MD5, SHA-1
  and SHA-256. Ready-made functions generate and store the salt themselves.
- **A pepper.** An extra secret key kept outside the database: one database leak is not enough.
- **A list of banned passwords.** The most common and already leaked passwords can't be chosen.
- **Rehashing old hashes.** If the database still has fast unsalted hashes, they are recomputed with
  a new function (details in the lesson “Hashes and salt”).
