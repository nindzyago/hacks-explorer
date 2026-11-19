# {{TITLE}}

`lesson` {{ID}} · `section` {{SECTION}} · `wave` 1 · `format` 1

## Passport

- `cwe` {{CWE}}
- `severity` high
- `impact` What the attacker gets, in one line
- `defence` The main defence, in two or three words
- `class` The class of the attack, in one line

## Sources

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [MITRE CWE](https://cwe.mitre.org/)

## Participants

- `attacker` **Attacker** — 203.0.113.66
- `server` **Web server** — 198.51.100.10
- `db` **Database** — users table

## Zones

- `internet` Internet: `attacker`
- `site` Site app.example: `server`, `db`

## Steps

### `ask` An ordinary request

`attacker → server` · `legit`
Message: GET /page · Result: page

```http
GET /page
```

#### Simple

The first step shows how the system works without an attack. One or two sentences for a
beginner, no jargon.

#### Step by step

What exactly goes out and what comes back. Here you can name fields and addresses.

#### Deeper

Details for the curious: standards, special cases, why it is built this way.

### `trick` A harmful request

`attacker → server` · `attack`
Message: harmful data · Result: accepted

```http
POST /page
field=⟦harmful part⟧
```

#### Simple

The attacker sends the same thing, but with a **harmful part**. In the step's code it is
wrapped in a pair of marks at its start and end.

#### Step by step

Each step is one message from one participant to another. The line under the heading names
where it comes from, where it goes and its kind: `legit`, `attack` or `safe`.

#### Deeper

Addresses and domains are teaching ones only: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24,
2001:db8::/32 and names under `.example`. No ready-to-run exploits: a lesson explains the
mechanism.

### `pass` The server's mistake

`server → db` · `attack` · `without-defence`
Message: harmful data · Result: attack

#### Simple

A step marked `without-defence` is shown only with the defence off.

#### Step by step

Here the harmful data reaches its target and the attack works.

#### Deeper

Describe which mistake in the code or the settings allowed it, and the CWE from the passport.

### `stop` The defence works

`server → db` · `attack` · `with-defence` · `stopped`
Message: harmful data · Result: attack failed

#### Simple

A step marked `with-defence` and `stopped` is shown only with the defence on: the scene puts a
shield at the receiver.

#### Step by step

Show what exactly the defence checks or changes.

#### Deeper

Why the defence works and what it does not protect against.

## How to defend

List the measures by importance, the main one first. Every fact must be in one of the sources
above.
