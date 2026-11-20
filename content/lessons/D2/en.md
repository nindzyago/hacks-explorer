# Privilege escalation

`lesson` D2 · `section` D · `wave` 1 · `format` 1

## Passport

- `cwe` 269, 862
- `owasp` A01:2021
- `severity` critical
- `impact` An ordinary customer becomes the shop's administrator
- `defence` Server-side role check
- `class` Broken access control

## Sources

- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Top 10:2021, A01 Broken Access Control](https://top10.owasp.org/2021/A01_2021-Broken_Access_Control)
- [MITRE CWE-269: Improper Privilege Management](https://cwe.mitre.org/data/definitions/269.html)
- [MITRE CWE-862: Missing Authorization](https://cwe.mitre.org/data/definitions/862.html)
- [RFC 9110: HTTP Semantics, 403 Forbidden](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4)

## Participants

- `admin` **Olga** — admin · `icon:user`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — users table · `term:database`

## Zones

- `internet` Internet: `admin`, `attacker`
- `site` Site shop.example: `server`, `db` · `term:trust-boundary`

## Steps

### `assign` Olga assigns a role

`admin → server` · `legit`
Message: role for no. 42 · Result: role assigned

```http
POST /admin/users/42/role
Cookie: session=…olga…

role=editor
```

#### Simple

Olga is the administrator of an online shop. In her panel she clicks a button and makes staff
member number 42 a catalogue **editor**.

#### Step by step

The button in the panel sends a request to the internal address `/admin/users/42/role` together
with Olga's session cookie. The server changes the role in the `users` table.

#### Deeper

Every user has a **role**: customer, editor, administrator. The role decides what a person may do.
Ordinary customers never see this button: the site only draws it for administrators. But hiding
a button is not the same as closing the address it points to.

### `peek` The attacker finds the address

`attacker → server` · `legit`
Message: GET /app.js · Result: address found

```javascript
// in the page code that everyone receives
fetch(`⟦/admin/users/${id}/role⟧`, …)
```

#### Simple

The attacker is an ordinary customer with their own account. They open the page code that the
browser downloads anyway and find the **internal address** for changing roles in it.

#### Step by step

The site's script is the same for everyone: it also contains the admin panel functions, they are
just not shown to customers. The address could also be found by guessing: `/admin`, `/manage`,
`/internal`.

#### Deeper

A hidden interface protects only against eyes. Whatever reaches the browser, the attacker can
read, and any request they can send themselves, without the button. OWASP says it plainly:
client-side checks help usability, but the server has to decide who may do what.

### `promote` Making themselves admin

`attacker → server` · `attack` · `without-defence`
Message: no. 77 → admin · Result: accepted

```http
POST /admin/users/77/role
Cookie: session=…attacker…

role=⟦admin⟧
```

#### Simple

The attacker sends the same request as Olga's button themselves, but for **their own** number 77
and with the role **admin**.

#### Step by step

The request carries the attacker's session; they logged in honestly. The server checks only one
thing: is the visitor logged in. There is no "but are they an administrator" check on this
address.

#### Deeper

This is **vertical** privilege escalation: a user gains rights of a higher level. Horizontal
escalation means reaching the data of a neighbour with the same role, as in the IDOR lesson. In
the MITRE catalogue the bug here is CWE-862 "Missing Authorization": the server performs no
permission check when someone calls the action.

### `guard` The server checks the role

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: no. 77 → admin · Result: attack failed

```http
POST /admin/users/77/role
Cookie: session=…attacker…

role=⟦admin⟧
```

#### Simple

The same request, but now on every internal address the server asks: **what role** does the
visitor have? The attacker's role is "customer", and the server stops them.

#### Step by step

The server takes the role from its own session record, not from the request. The rule for
`/admin/…` addresses is one for the whole site: let in the `admin` role only, nobody else.

#### Deeper

This is the "deny by default" principle: unless a rule explicitly allows it, the answer is no.
OWASP advises checking permissions on every request and in one shared place: an attacker only
needs to find one forgotten address.

### `write` The role is written

`server → db` · `attack` · `without-defence`
Message: role = admin for 77 · Result: attack

```sql
UPDATE users SET role = ⟦'admin'⟧
WHERE id = 77
```

#### Simple

The server obediently writes to the database: user 77 is now an **administrator**.

#### Step by step

The database query is built correctly, there is no injection. The bug is not in the database but
earlier: the server never asked whether this person may change roles.

#### Deeper

CWE-269 "Improper Privilege Management" describes it more broadly: the system assigns, changes,
tracks or checks privileges incorrectly, and someone ends up with power nobody intended. Here the
right to change roles effectively belongs to anyone who is logged in.

### `owned` The attacker is an administrator

`server → attacker` · `attack` · `without-defence`
Message: 200 OK, role admin · Result: rights taken over

```http
HTTP/1.1 200 OK
```

#### Simple

The attacker reloads the page and sees the **admin panel**: all orders, all customers, prices,
discounts.

#### Step by step

With the administrator role they can grant roles to others, change products and read every
customer's data. From the outside it looks like normal administrator work.

#### Deeper

In the OWASP Top 10:2021 this is item A01 "Broken Access Control". Its examples include acting as
an administrator while logged in as an ordinary user, and calling an API where POST, PUT and
DELETE have no access control.

### `deny` Refused: no rights

`server → attacker` · `safe` · `with-defence`
Message: 403 Forbidden · Result: role unchanged

```http
HTTP/1.1 403 Forbidden
```

#### Simple

The server answers: **not allowed**. The attacker's role stays the same, nothing is written to
the database.

#### Step by step

Under the HTTP standard, 403 means the server understood the request but refuses to carry it out.
The refusal goes into the log.

#### Deeper

RFC 9110 (section 15.5.4) allows answering 404 instead of 403 if the server does not want to
reveal that the address exists at all. The refusal log is useful: an ordinary user calling
internal addresses is a clear sign of an attack.

## How to defend

- **Server-side permission check on every request.** Every internal address checks the role of
  the visitor itself. A hidden button or a hidden address protects nothing.
- **Deny by default.** A new address stays closed until there is a rule that explicitly allows
  access.
- **One shared check.** Access rules live in one place and apply to all addresses instead of
  being rewritten in each.
- **Role from the server's session.** Who the visitor is and what role they have, the server takes
  from its own data, not from request fields.
- **Least privilege.** Each role gets only what it needs for the job; permissions are reviewed
  from time to time.
- **Tests and logs.** Automated tests log in as an ordinary user and call internal addresses — the
  answer must be a refusal. Refusals are logged, and frequent refusals raise an alarm.
