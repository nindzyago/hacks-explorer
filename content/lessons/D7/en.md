# Mass assignment

`lesson` D7 · `section` D · `wave` 3 · `format` 1

## Passport

- `cwe` 915
- `owasp` A08:2021
- `severity` high
- `impact` An ordinary user makes himself an administrator
- `defence` An allowlist of the fields that may be changed
- `class` Overwriting object fields

## Sources

- [OWASP: Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
- [OWASP API Security Top 10 2023: API3 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- [OWASP Top 10:2021 A08: Software and Data Integrity Failures](https://owasp.org/Top10/2021/A08_2021-Software_and_Data_Integrity_Failures/)
- [MITRE CWE-915: Improperly Controlled Modification of Dynamically-Determined Object Attributes](https://cwe.mitre.org/data/definitions/915.html)

## Participants

- `attacker` **Attacker** — ordinary user · `term:attacker`
- `server` **API server** — shop.example · `term:web-server`
- `db` **Database** — users table · `term:database`

## Zones

- `internet` Internet: `attacker`
- `site` Shop shop.example: `server`, `db`

## Steps

### `form` An ordinary profile edit

`attacker → server` · `legit`
Message: name and city · Result: saved

```http
PATCH /api/profile
Host: shop.example

{"name": "Oleg", "city": "Tver"}
```

#### Simple

The attacker is registered in the shop as an **ordinary customer**. He opens his profile, changes
his name and city and clicks "Save".

#### Step by step

The profile page sends the server JSON with two fields: `name` and `city`. The server saves them;
everything works as intended.

#### Deeper

The attacker looks in the browser's developer tools at exactly what goes to the server. A request
can be repeated and edited by hand: the server sees only the bytes of the request, not the
buttons of the form.

### `extra` An extra field in the JSON

`attacker → server` · `attack` · `without-defence`
Message: plus isAdmin: true · Result: accepted

```http
PATCH /api/profile

{"name": "Oleg", "city": "Tver", ⟦"isAdmin": true⟧}
```

#### Simple

The attacker adds to the same request a field that is **not in the form**: `"isAdmin": true`. He
guessed the name: such fields are often called the same way.

#### Step by step

The server itself may drop hints: if `GET /api/profile` returns the whole user object including
`isAdmin: false`, the field name is already known.

#### Deeper

OWASP calls this **mass assignment**, and different frameworks have other names for it too:
autobinding and object injection. In the OWASP API Security Top 10 2023 this flaw became part of
API3 "Broken Object Property Level Authorization": a user changes a property of an object he
should have no access to.

### `bind` The server copies everything

`server → db` · `attack` · `without-defence`
Message: isAdmin = true · Result: saved

```js
const user = await db.users.find(me);
Object.assign(user, ⟦request.body⟧);
await user.save();
```

#### Simple

The server **does not pick** fields: it takes the whole JSON it received and copies it into the
user object. Along with the name and city, `isAdmin = true` goes into the database.

#### Step by step

The code is convenient: one line instead of a list of fields. The programmer assumed only the
form's fields would arrive, but the client sends whatever it likes.

#### Deeper

MITRE describes this as CWE-915: the product receives input that sets several fields of an object
at once and does not control which of them may be changed. Many frameworks can bind request
parameters to an object on their own; without an explicit list of allowed fields, that binding is
open to everyone.

### `admin` Into the admin panel

`attacker → server` · `attack` · `without-defence`
Message: GET /admin · Result: in as admin

```http
GET /admin
Host: shop.example
```

#### Simple

The attacker opens the **admin panel**. The server checks the database, sees `isAdmin = true` and
lets him in.

#### Step by step

Now he sees the orders, addresses and phone numbers of every customer and can change prices. He
needed neither a password nor someone else's account.

#### Deeper

The same trick works with any field a user must not touch: balance, discount, a "verified"
status, the owner of a record. OWASP places CWE-915 in A08:2021 "Software and Data Integrity
Failures": the server trusts data whose integrity it never checked.

### `allow` Allowed fields only

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: plus isAdmin: true · Result: the attack failed

```js
const { name, city } = request.body;
// the server never reads ⟦isAdmin⟧
```

#### Simple

The server takes **only** `name` and `city` from the request, by an allowlist. It simply does not
read the `isAdmin` field.

#### Step by step

The extra field causes no error; it is silently dropped. The server could also answer with an
error for any unknown field: that makes the attempt easier to spot in the log.

#### Deeper

OWASP advises not binding input straight to database objects, but using a separate data transfer
object (DTO) that has only the fields the user may change. The other option is an explicit
allowlist of fields when binding. A blocklist of "everything except isAdmin" is worse: a new
sensitive field added a year later will be left open.

### `save-safe` Name and city go to the database

`server → db` · `safe` · `with-defence`
Message: name, city · Result: isAdmin untouched

```sql
UPDATE users SET name = ?, city = ? WHERE id = ?
```

#### Simple

**Only the name and city** are written to the database. The attacker still has `isAdmin = false`.

#### Step by step

Rights are changed only by a separate administrator request, and the server checks that an
administrator sent it.

#### Deeper

The list of changeable fields is set by the server, not by the client. It is worth keeping next
to the permission checks: who may touch which field. Then a new column in the table does not
become editable by itself.

## How to defend

- **An allowlist of fields.** The server lists explicitly what each request may change, and
  ignores or rejects the rest.
- **A separate object for input.** The request is bound to a DTO that has only the editable
  fields, not to the database object.
- **Not a blocklist.** A ban on particular fields is forgotten when a new one appears in the model.
- **Rights are checked on the server.** Role, balance and record owner change only through
  separate actions that check who is asking.
- **Do not send out too much.** An API response contains only the fields the client needs, so
  internal field names give no hints about what to add.
