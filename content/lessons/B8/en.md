# NoSQL injection

`lesson` B8 · `section` B · `wave` 3 · `format` 1

## Passport

- `cwe` 943
- `owasp` A03:2021
- `attack` T1190
- `severity` high
- `impact` Logging in as someone else, reading other people's data
- `defence` Type check: only a string in the password field
- `class` Injecting an operator into a database query

## Sources

- [OWASP: NoSQL Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html)
- [OWASP WSTG: Testing for NoSQL Injection](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05.6-Testing_for_NoSQL_Injection/)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [MITRE CWE-943: Improper Neutralization of Special Elements in Data Query Logic](https://cwe.mitre.org/data/definitions/943.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — users collection · `term:database`

## Zones

- `internet` Internet: `attacker`
- `site` Site notes.example: `server`, `db` · `term:trust-boundary`

## Steps

### `normal` An ordinary login

`attacker → server` · `legit`
Message: login admin, password as a string · Result: wrong password

```json
{"login": "admin", "password": "qwerty"}
```

#### Simple

The attacker opens the login page and tries to log in as `admin` with a guessed password. The site
answers: wrong password. But the attacker sees **in what shape** the browser sends the login and
password: as JSON.

#### Step by step

The login form sends the server a small JSON document with two fields. The server looks in the
database for a user whose login and password both match.

#### Deeper

The database here is a document database, like MongoDB: instead of tables and the SQL language it
holds JSON-like documents, and queries are written as objects too. There are many such databases;
they are called NoSQL.

### `swap` A password that is a condition

`attacker → server` · `attack`
Message: password: {"$ne": ""} · Result: accepted as JSON

```json
{"login": "admin", "password": ⟦{"$ne": ""}⟧}
```

#### Simple

Now the attacker puts into the password field **not a string but a small object**: `{"$ne": ""}`.
To the database this is the condition “not equal to the empty string”.

#### Step by step

JSON allows any value in a field: a string, a number, a list or an object. The server parses this
JSON without errors: the format is valid.

#### Deeper

Words starting with `$` are MongoDB query operators: `$ne` means “not equal”, `$gt` “greater
than”, `$regex` “matches a pattern”. Ordinary data does not need them, but in a query they change
its meaning.

### `find` A query with a condition

`server → db` · `attack` · `without-defence`
Message: find: password not empty · Result: attack

```js
users.findOne({ login: "admin",
                password: ⟦{ $ne: "" }⟧ })
```

#### Simple

The server takes the fields from the JSON it received and puts them into the query **as they
are**. Instead of “password equals qwerty” the query now says “password is not empty”.

#### Step by step

The server code was written expecting a string in that field. But the language did not check the
type, and the attacker's object took the password's place whole, operator included.

#### Deeper

This is weakness CWE-943: a query to a data store is built so that special elements in the input
change its logic. OWASP stresses that building the query as an object rather than by gluing strings
does not help when the value sent is itself an object.

### `match` admin found

`db → server` · `attack` · `without-defence`
Message: admin document · Result: “password matched”

```text
login: "admin", password: ⟦anything not empty⟧ → found
```

#### Simple

The administrator's password is, of course, not empty. The condition holds, and the database
**returns the admin's document** as if the password were right.

#### Step by step

The server reasons: if the database found a user with this login and password, the password is
correct. The password check has been handed over entirely to the query, and the query has been
fooled.

#### Deeper

For simplicity the server here compares the password right in the query. A real site keeps a hash
of the password in the database, but the mistake is the same: an operator in the input will
replace the condition in any field the server searches by.

### `session` Logged in as admin

`server → attacker` · `attack` · `without-defence`
Message: admin session cookie · Result: login without a password

```http
Set-Cookie: session=⟦admin session⟧
```

#### Simple

The server opens an administrator session. The attacker **has logged in without a password**.

#### Step by step

From here the attacker has everything the administrator has: read every user's notes, change
settings, delete data.

#### Deeper

It is the counterpart of the classic SQL injection `' OR 1=1 --`, only without quotes or comments:
the query contains none of the “dangerous” characters filters usually look for. What was swapped is
the data type, not the text.

### `type` A type check

`server → server` · `attack` · `with-defence` · `stopped`
Message: password is not a string · Result: rejected, the attack failed

```js
if (typeof password !== "string")
  → 400  // ⟦{"$ne": ""}⟧ is an object
```

#### Simple

With the defence on, the server first checks: **is the password a string?** An object is not a
string, and the request is rejected before it reaches the database. The attack stops here.

#### Step by step

Each field is checked by its own rule: the login is a string of up to 64 characters, the password
is a string. The server lets nothing else through; nothing goes to the database.

#### Deeper

This is OWASP's advice: check the expected simple type of a value before building the filter, and
do not pass client-supplied objects through as field values. OWASP also warns that checking “is
there a `$` anywhere in the JSON” is a denylist and is weaker than checking each field.

### `deny` Refusal

`server → attacker` · `safe` · `with-defence`
Message: 400 bad request · Result: the attack failed

```http
HTTP/1.1 400 Bad Request
```

#### Simple

The attacker gets a refusal, as with any invalid input. No login.

#### Step by step

Ordinary users never notice this check: their browser sends the password as a string anyway.

#### Deeper

The refusal is worth writing to the log: an object in the password field is almost certainly an
attack attempt, not a typo.

## How to defend

- **Check the type of every field.** Login and password are strings. An object, a list or a number
  in such a field means refusal.
- **Do not pass client objects into the query.** Put values into the filter only after checking
  them, not the whole JSON as received.
- **No operators from the client.** Do not accept operators such as `$where`, `$regex` or `$expr`
  from received data unless you truly need them.
- **Code checks the password, not the query.** Find the user by login, then verify the password in
  code with a password hashing function.
- **No code in queries.** Do not use `$where` with received strings, and turn off JavaScript
  execution on the database server if it is not needed.
- **Fewer rights.** The site's database account can do only what the site needs.
