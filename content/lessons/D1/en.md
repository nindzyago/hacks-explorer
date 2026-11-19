# Someone else's data by number (IDOR)

`lesson` D1 · `section` D · `wave` 1 · `format` 1

## Passport

- `cwe` 639
- `owasp` A01:2021
- `severity` high
- `impact` Reading other people's orders: the customer's name, address and phone number
- `defence` Server-side owner check
- `class` Broken access control

## Sources

- [OWASP: Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Top 10:2021, A01 Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/)
- [OWASP API Security Top 10 2023, API1 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [MITRE CWE-639: Authorization Bypass Through User-Controlled Key](https://cwe.mitre.org/data/definitions/639.html)
- [RFC 9110: HTTP Semantics, 403 and 404](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4)

## Participants

- `user` **Anna** — 192.0.2.24 · `term:victim`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — orders table · `term:database`

## Zones

- `internet` Internet: `user`, `attacker`
- `site` Site shop.example: `server`, `db` · `term:trust-boundary`

## Steps

### `order` Anna's order

`user → server` · `legit`
Message: new order · Result: order no. 1002

```http
POST /orders
Cookie: session=…anna…
```

#### Simple

Anna buys a kettle in an online shop. The shop saves the order and gives it **number 1002**. The
order holds her name, delivery address and phone number.

#### Step by step

Anna's browser sends the order together with her session cookie: that is how the server knows it
is her. The server writes the order into the `orders` table and remembers whose it is.

#### Deeper

Order numbers go in a row: 1001, 1002, 1003. That is handy for the shop, but it means the
neighbouring numbers are easy to guess. On its own this is not a bug yet: what matters is how the
server hands out an order by its number.

### `own` Own order

`attacker → server` · `legit`
Message: GET /orders/1001 · Result: own order

```http
GET /orders/1001
Cookie: session=…attacker…
```

#### Simple

The attacker also has an account in the shop and bought something cheap. Their order is
**1001**. Opening it, they see the number right in the page address.

#### Step by step

The browser asks for the page `/orders/1001`. The server shows the order: all fair, it is theirs.

#### Deeper

The attacker is not breaking the login here: they are an ordinary customer with their own
password and their own session. So the site's login check lets them through. The real question
is whether the server checks **whose** order it is asked to show.

### `swap` Another number

`attacker → server` · `attack`
Message: GET /orders/1002 · Result: accepted

```http
GET /orders/⟦1002⟧
Cookie: session=…attacker…
```

#### Simple

The attacker changes one digit in the address: **1002** instead of 1001. It is Anna's order, but
the attacker does not know that — they just want to see what is there.

#### Step by step

The session is the same — the attacker's. Only the number in the address changed. To the server
this is a normal request from a logged-in customer.

#### Deeper

The number in the address points straight at a record in the database (a *direct object
reference*). Anything that comes from the browser the attacker can change: the address, form
fields, the body of an API request. Hence the name of the bug: IDOR, insecure direct object
reference.

### `lookup` Lookup by number only

`server → db` · `attack` · `without-defence`
Message: WHERE id = 1002 · Result: attack

```sql
SELECT * FROM orders
WHERE id = ⟦1002⟧
```

#### Simple

The server checked that the visitor is logged in and goes straight to finding the order **by its
number alone**. It never asks whose order it is.

#### Step by step

The server takes the number from the address and puts it into the database query. The query is
safe from injection, but it has no condition “the order belongs to whoever is asking”.

#### Deeper

Login (who you are) is checked, authorization (what you may do) is not. In the MITRE catalog
this is CWE-639 “Authorization Bypass Through User-Controlled Key”: getting around the
permission check through a key the user controls. The same page lists other names for this bug:
IDOR and BOLA.

### `leak` Someone else's order

`server → attacker` · `attack` · `without-defence`
Message: Anna's order 1002 · Result: someone else's data leaked

```text
Order 1002
Recipient: Anna
Address and phone: …
```

#### Simple

The server shows the attacker **Anna's order**: name, address, phone. Anna will never know.

#### Step by step

The database found order 1002, and the server sent all of it back. No error, no warning: for the
server everything went as usual.

#### Deeper

By trying numbers one after another, all the shop's orders could be pulled out this way. The same
bug on requests that change data lets someone edit or cancel other people's orders. In the OWASP
Top 10:2021 this is item A01 “Broken Access Control”, which moved up there from fifth place;
viewing someone else's record by its identifier is named in it directly.

### `owner` Lookup with the owner

`server → db` · `attack` · `with-defence` · `stopped`
Message: 1002 and owner 77 · Result: the attack failed

```sql
SELECT * FROM orders
WHERE id = ⟦1002⟧
  AND owner_id = 77  -- from the session
```

#### Simple

Now the server asks the database: find order 1002, **but only if it belongs to whoever is
asking**. The server knows who is asking from the session, not from the address. This is where
the attack stops.

#### Step by step

The order number still comes from the address. But a second condition is added: the owner is the
user from the attacker's session (their number is 77). It cannot be faked through the address.

#### Deeper

This is an object-level access check: on every request for a record the server makes sure this
user may see or change it. OWASP advises doing this on the server, for every object and every
request, with one shared mechanism rather than anew in each place. A handy pattern is to look
for the record not in the whole table but among the current user's records.

### `notfound` No such order

`server → attacker` · `safe` · `with-defence`
Message: 404 Not Found · Result: someone else's order not shown

```http
HTTP/1.1 404 Not Found
```

#### Simple

The database found no order 1002 **among the attacker's orders**. The server answers: there is no
such order. Anna's data stays private.

#### Step by step

The server returns 404. The attacker does not even learn whether someone else has an order with
that number.

#### Deeper

The server could also answer 403 Forbidden (“not allowed”). But the HTTP standard (RFC 9110,
section 15.5.4) lets a server that wants to hide the very existence of a forbidden resource answer
404 instead. Then trying numbers gives nothing away. The refusal itself is worth writing to the
log: many refusals in a row from one user look like someone trying numbers.

## How to defend

- **Owner check on every request.** The server makes sure the record belongs to the logged-in user
  or that they have rights to it. For reading, changing and deleting — always. This is the main
  defence.
- **The user comes from the session.** The server learns who is asking from its own session, not
  from a number or name in the address, a form or the request body.
- **One shared check.** Access rules are set in one place and apply everywhere, and access is
  closed by default.
- **Random numbers do not cure it.** Long random identifiers (such as UUIDs) are harder to guess,
  but a number can leak through a link or a log. OWASP treats them only as an extra layer, not a
  replacement for the check.
- **Tests for foreign access.** An automated test logs in as one user and asks for another user's
  record: the answer must be a refusal.
- **Log of refusals.** Access refusals are logged, and frequent refusals from one user raise an
  alarm.
