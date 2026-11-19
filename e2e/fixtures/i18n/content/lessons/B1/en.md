# A training attack

`lesson` B1 · `section` B · `wave` 1 · `format` 1

## Passport

- `cwe` 89
- `owasp` A03:2021
- `severity` high
- `impact` Someone else's data
- `defence` A check on the server

## Sources

- [OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/index.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Site** — shop.example
- `db` **Database** — 192.0.2.10

## Zones

- `outside` Outside: `attacker`
- `inside` Inside: `server`, `db` · `danger`

## Steps

### `send` Sending

`attacker → server` · `legit`
Message: form · Result: accepted

#### Simple

The attacker sends a form.

#### Step by step

The attacker fills in a form and sends it.

#### Deeper

The form goes to the server as a plain request.

### `read` Reading

`server → server` · `legit`
Message: reading the form · Result: read

#### Simple

The site reads the form.

#### Step by step

The site takes the form apart.

#### Deeper

The site takes the field values as they are.

### `pass` Let through

`server → db` · `attack` · `without-defence`
Message: glued query · Result: the attack worked

```sql
SELECT * FROM users WHERE name = '⟦admin' --⟧'
```

#### Simple

The site lets a harmful query through.

#### Step by step

The site glues the query to the form text.

#### Deeper

The glued query changes its meaning.

### `block` Refusal

`server → db` · `attack` · `with-defence` · `stopped`
Message: query with a parameter · Result: stopped

```sql
SELECT * FROM users WHERE name = ?
```

#### Simple

The site does not let text become a command.

#### Step by step

The site sends the text apart from the query.

#### Deeper

A parameter does not change what the query means.

### `done` Answer

`db → server` · `safe`
Message: answer · Result: done

#### Simple

The database answers.

#### Step by step

The database returns rows.

#### Deeper

The answer goes to the site.

## How to defend

Pass values as parameters.
