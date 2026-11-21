# Race conditions: two requests at once

`lesson` E4 · `section` E · `wave` 1 · `format` 1

## Passport

- `cwe` 362, 367
- `severity` medium
- `impact` A one-time action happens several times: a promo code, a bonus, a withdrawal, a vote
- `defence` Check and change in one atomic database operation
- `class` A race between the check and the action

## Sources

- [MITRE CWE-362: Concurrent Execution using Shared Resource with Improper Synchronization](https://cwe.mitre.org/data/definitions/362.html)
- [MITRE CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition](https://cwe.mitre.org/data/definitions/367.html)
- [OWASP WSTG-BUSL-05: Test Number of Times a Function Can Be Used Limits](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/10-Business_Logic_Testing/05-Test_Number_of_Times_a_Function_Can_Be_Used_Limits/)
- [RFC 9110: HTTP Semantics, section 9.2.2 Idempotent Methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Shop** — shop.example · `icon:server` · `term:web-server`
- `db` **Database** — promo_codes · `term:database`

## Zones

- `internet` Internet: `attacker`
- `site` Site shop.example: `server`, `db` · `term:trust-boundary`

## Steps

### `burst` Two requests in the same instant

`attacker → server` · `attack`
Message: 2 × apply promo code · Result: both accepted

```http
POST /cart/promo     code=WELCOME500
POST /cart/promo     code=WELCOME500
⟦both sent in the same millisecond⟧
```

#### Simple

The shop gives newcomers a **promo code** worth 500 roubles — once. The attacker sends two “apply
promo code” requests **at the same time**, as if pressing the button with both hands at once.

#### Step by step

Normally the second request would arrive after the first and get the answer “code already used”.
But here both arrive almost in the same instant. The shop's server handles requests in parallel,
so it starts on both at once.

#### Deeper

This kind of bug is called a **race condition**: the result depends on which of the parallel
handlers gets there first. The window for the race may last milliseconds, so attackers send many
identical requests at once: the more there are, the likelier one lands in the window.

### `check` Both checks say “the code is free”

`server → db` · `attack` · `without-defence`
Message: 2 × SELECT used · Result: false both times

```sql
SELECT used FROM promo_codes WHERE code = 'WELCOME500'
-- handler 1: used = false
-- handler 2: ⟦used = false⟧
```

#### Simple

Each handler first **asks** the database: “has the code been used yet?” Both ask before anyone has
managed to mark it, and both hear: “it's free”.

#### Step by step

The code is written in two steps: check first, act later. There is a gap between the check and the
action, and the second handler squeezes into it with its own check. Each check on its own is
honest; the answer simply goes stale before the action happens.

#### Deeper

MITRE calls this TOCTOU, *time-of-check time-of-use* (CWE-367): the state of a resource was
checked, but by the time it is used it has changed. It is a special case of CWE-362: a shared
resource that the code should access exclusively, but doesn't.

### `apply` Both discounts are written

`server → db` · `attack` · `without-defence`
Message: 2 × UPDATE and discount · Result: code marked, discount twice

```sql
UPDATE promo_codes SET used = true WHERE code = 'WELCOME500'
INSERT INTO discounts (cart, amount) VALUES (77, 500)
⟦INSERT INTO discounts (cart, amount) VALUES (77, 500)⟧
```

#### Simple

Both handlers are sure the code is free. Each marks it as used and **adds a discount**. The mark
is set twice — no harm there — but there are two discounts.

#### Step by step

The second `UPDATE` changes nothing: `used` is already `true`. But the discount `INSERT` runs in
both handlers, because each made its decision earlier, based on a stale answer.

#### Deeper

The more work between the check and the write (a call to another service, recalculating the
cart), the wider the window. Code that looks right with sequential requests breaks only with
simultaneous ones, which is why such bugs are hard to spot in ordinary tests.

### `double` A discount twice as big

`server → attacker` · `attack` · `without-defence`
Message: 2 × “discount applied” · Result: 1000 roubles instead of 500

```text
Cart 77: discount ⟦500 + 500⟧ = 1000
```

#### Simple

The attacker gets **two discounts** from one single-use code. Send ten requests at once, and there
may be even more.

#### Step by step

Both replies say “discount applied”, and the cart now has two discount lines. The shop has lost
money, and in the log it all looks like two ordinary requests.

#### Deeper

The same trick works wherever an action must happen a limited number of times: gift cards,
referral bonuses, withdrawals from an account, voting. OWASP suggests in WSTG-BUSL-05 checking
whether the same discount can be applied several times.

### `claim` The first handler takes the code atomically

`server → db` · `safe` · `with-defence`
Message: conditional UPDATE · Result: 1 row changed

```sql
UPDATE promo_codes SET used = true
WHERE code = 'WELCOME500' AND used = false
-- rows changed: 1 → add the discount
```

#### Simple

Now the check and the mark are **one command**. The database itself makes sure two handlers can't
each run half of it. The first one made it: the code is its own, the discount is added.

#### Step by step

The condition `used = false` sits right inside the `UPDATE`. The database changes the row only if
the code is still free and reports how many rows it changed. One row means this handler took the
code.

#### Deeper

CWE-362 recommends atomic operations and synchronization primitives. In a database that means a
conditional `UPDATE`, a transaction that locks the row, or a `UNIQUE` constraint on the pair “code —
order” that won't let a second discount be written.

### `second` The second handler gets zero rows

`server → db` · `attack` · `with-defence` · `stopped`
Message: the same UPDATE · Result: 0 rows changed, the attack failed

```sql
UPDATE promo_codes SET used = true
WHERE code = 'WELCOME500' AND ⟦used = false⟧
-- rows changed: 0 → code already used
```

#### Simple

The second handler tries to take the same code, but the database answers: **zero rows** — the code
is no longer free. It adds no discount. This is where the attack stops.

#### Step by step

Common relational databases run two `UPDATE`s of the same row one after the other: the second
waits until the first has finished and already sees `used = true`. The condition is false, the row
doesn't change.

#### Deeper

What matters is that the check is not separated from the action: there is no gap for a second
handler to squeeze into. A lock inside the application, within one process, is unreliable here: a
shop often has several servers, and the only thing they share is the database.

### `once` One discount and an honest refusal

`server → attacker` · `safe` · `with-defence`
Message: “applied” and “already used” · Result: a 500 rouble discount

```text
request 1: discount of 500 applied
request 2: promo code already used
```

#### Simple

The attacker gets one discount, like everyone else. The second request gets an ordinary refusal.

#### Step by step

The replies are the same as if the requests had come one after the other. However many
simultaneous requests arrive, the code works exactly once.

#### Deeper

Against accidental repeats, when a browser or the network sent a request again, an idempotency key
helps: the server remembers the key and answers a repeat with the earlier result. RFC 9110,
section 9.2.2: `POST` is not idempotent, a repeat may take effect a second time, so the protection
belongs on the server.

## How to defend

- **Check and action as one operation.** A conditional `UPDATE … WHERE used = false` with a check of
  the number of changed rows, a transaction that locks the row, or a `UNIQUE` constraint in the
  database.
- **Guard the shared resource where it is shared.** A lock in one process's memory won't help if
  there are several servers. Protect the data where it lives.
- **Limits on the server.** How many times a code or bonus can be used, or money withdrawn, is
  decided by the server, not by a button that greys out after a click.
- **Idempotency key.** For operations with money, a repeat of the same request returns the earlier
  result instead of running again.
- **Test concurrency.** Send dozens of identical requests at once to a test copy and check that the
  one-time action happened once.
