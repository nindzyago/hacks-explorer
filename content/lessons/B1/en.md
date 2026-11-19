# SQL injection

`lesson` B1 · `section` B · `wave` 1 · `format` 1

## Passport

- `cwe` 89
- `owasp` A03:2021
- `severity` critical
- `impact` Logging in as someone else, reading and changing data in the database
- `defence` Parameterized query
- `class` Injection into a database query

## Sources

- [OWASP: SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP: Query Parameterization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [OWASP: Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [MITRE CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — users table · `term:database`

## Zones

- `internet` Internet: `attacker`
- `site` Site shop.example: `server`, `db` · `term:trust-boundary`

## Steps

### `form` Login form

`attacker → server` · `legit`
Message: GET /login · Result: login page

```http
GET /login
```

#### Simple

The attacker opens the login page of an online shop. Nothing bad yet: every visitor does this.

#### Step by step

The browser asks for the page `/login`. The server sends back a form with two fields: “Login” and
“Password”.

#### Deeper

So far this is just a request for a page. The filled-in form will go in the next request,
`POST /login`, with the fields `login` and `password`. The server will put them into a query to
the `users` table written in SQL, the language a site uses to ask its database questions.

The example is simplified: the password is compared right inside the query. Well-built sites
store a hash of the password, not the password itself, but that does not matter for injection:
the login still ends up in the query.

### `trick` A tricky login

`attacker → server` · `attack`
Message: admin' -- · Result: accepted as text

```http
POST /login
login=⟦admin' --⟧&password=123
```

#### Simple

In the “Login” field he types `admin`, followed by a quote and two hyphens. To a person these
characters mean nothing. But in the language of database queries they have a **special meaning**.

#### Step by step

The “Login” field carries the string `admin' --`, with any password. The server accepts it as
ordinary text.

#### Deeper

In SQL a quote opens and closes a text value, and `--` starts a comment. The browser sends the
quote and the space encoded (`%27` and `+`), and the server decodes them back. The input by itself
has done nothing yet: the danger is in what the server does with it next.

### `glue` The server glues the query together

`server → db` · `attack` · `without-defence`
Message: SELECT ... · Result: attack

```sql
SELECT * FROM users WHERE
login = '⟦admin' --⟧' AND password = '123'
```

#### Simple

The server takes what the visitor typed and **pastes it straight into the question to the
database**. The quote from the input ends the login too early, and the two hyphens tell the
database to stop reading. The password check is crossed out.

#### Step by step

The server builds the query by joining strings: a piece of the query, the visitor's input, another
piece of the query. The finished text goes to the database.

#### Deeper

The input has become part of the query's code: this is exactly the weakness CWE-89. The quote
from the input closed the value `'admin'`. Next comes `--`, which in most databases is a comment
to the end of the line (MySQL needs a space after `--`). The database skips the rest of the line:
the extra quote and the check `AND password = '123'`.

### `answer` The database answers

`db → server` · `attack` · `without-defence`
Message: admin record · Result: found without a password

#### Simple

The database faithfully does what it was sent: find the user admin. Nobody asked it about the
password.

#### Step by step

The database returns the record of the user admin. It cannot tell the intended query from the
spoiled one: to the database it is all just query text.

#### Deeper

With the comment dropped, the database ran `SELECT * FROM users WHERE login = 'admin'`. The same
weakness lets an attacker change the query in other ways:

- add a condition that is always true and get every row of the table;
- attach rows from another table with `UNION`;
- if the site shows no data, work it out from indirect signs in the response (blind injection).

### `enter` Logged in without a password

`server → attacker` · `attack` · `without-defence`
Message: Hello, admin · Result: logged in

#### Simple

The server sees that the database found a user and lets the attacker in as admin. Usually that is
the administrator. The attacker never learned the password: he did not need it.

#### Step by step

The server treats the login as successful, creates a session for admin and shows the account page.

#### Deeper

The result is a bypassed login check. The same weakness elsewhere on the site lets an attacker
read and change data: everything the site can reach in the database. The weakness class is CWE-89;
in the OWASP Top 10:2021 it falls under A03 Injection.

### `param` Query with a parameter

`server → db` · `attack` · `with-defence` · `stopped`
Message: parameter: admin' -- · Result: input stayed data, attack failed

```sql
SELECT * FROM users WHERE
login = ? AND password = ?

parameter 1: ⟦admin' --⟧
parameter 2: 123
```

#### Simple

Now the server sends the database the question and the visitor's answers **separately**, like a
blank form and what was written into it. The harmful input `admin' --` reaches the database, but
only as a filled-in value. The quote and the hyphens in it are just characters; they do not
change the question. This is where the attack stops.

#### Step by step

The server sends a query with placeholders `?` and, separately, the values for them. The query is
never joined with the input, so the input cannot become part of it.

#### Deeper

This is a parameterized query (also called a *prepared statement*), the main defence according to
OWASP. The structure of the query is fixed in advance, and a value only goes into its own slot and
is always treated as data. The placeholder depends on the database and the library: `?`, `$1`,
`:login`.

### `empty` No such user

`db → server` · `safe` · `with-defence`
Message: 0 rows · Result: nothing found

#### Simple

The database looks for a user whose login is the whole of `admin' --`, quote and hyphens
included. There is no such user.

#### Step by step

The database compares the values with logins and passwords as plain text and returns an empty
result.

#### Deeper

The value `admin' --` is compared with the `login` column as a whole, character by character. The
quote and `--` are not code here but part of the text. OWASP strongly discourages replacing
parameters with hand-made escaping of quotes: it is easy to get wrong.

### `refuse` Refused

`server → attacker` · `safe` · `with-defence`
Message: Invalid login · Result: not logged in

#### Simple

The server answers: wrong login or password. The attack has failed.

#### Step by step

The server returns an ordinary login error and reveals nothing about how it works inside.

#### Deeper

Even if the database hits an error, the visitor still sees only a generic message. The server
writes the details to its own log. The database's error text would show the attacker how the
query is built.

## How to defend

- **Parameterized queries.** The server passes the query and the values to the database
  separately. The visitor's input stays data, whatever it contains. This is the main defence.
- **An allow-list for parts of the query.** A table or column name and the sort direction cannot
  be passed as a parameter. The server picks them only from its own predefined options.
- **Stored procedures do not help by themselves.** If the procedure builds its query from strings
  again, injection is possible there too.
- **Do not escape by hand.** Home-made handling of quotes is an unreliable substitute for
  parameters.
- **Least privilege.** The database account the site uses can do only what the site needs. This
  does not stop injection, but it limits the damage.
- **No database errors for visitors.** The visitor sees a generic message; the details stay in
  the server's log.
