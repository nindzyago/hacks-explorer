# Attack surface and trust boundaries

`lesson` A7 · `section` A · `wave` 2 · `format` 1

## Passport

- `cwe` 306
- `owasp` A05:2021
- `attack` T1595, T1190
- `severity` high
- `impact` The customer database leaks through a forgotten test server
- `defence` Fewer points exposed, checks at every boundary
- `class` An extra way in and too much trust

## Sources

- [NIST CSRC Glossary: attack surface](https://csrc.nist.gov/glossary/term/attack_surface)
- [NIST CSRC Glossary: least privilege](https://csrc.nist.gov/glossary/term/least_privilege)
- [OWASP Cheat Sheet Series: Attack Surface Analysis](https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html)
- [OWASP Cheat Sheet Series: Threat Modeling](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)
- [OWASP Top 10:2021, A05 Security Misconfiguration](https://owasp.org/Top10/2021/A05_2021-Security_Misconfiguration/)
- [MITRE CWE-306: Missing Authentication for Critical Functionality](https://cwe.mitre.org/data/definitions/306.html)
- [MITRE ATT&CK T1595: Active Scanning](https://attack.mitre.org/techniques/T1595/)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `site` **Site** — 198.51.100.10 · `icon:server` · `term:web-server`
- `test` **Test** — 198.51.100.77 · `icon:server`
- `db` **Database** — customers · `term:database`

## Zones

- `internet` Internet: `attacker`
- `edge` Visible outside: `site`, `test`
- `inside` Inside: `db`

## Steps

### `map` What sticks out

`attacker → attacker` · `attack`
Message: network scan · Result: two servers

#### Simple

The attacker checks the company's addresses and sees who answers. **Two** answer: the site and
some test server. Everything that can be reached from outside is the **attack surface**.

#### Step by step

The company opened the site on purpose. The test server, a copy of the site for trying out
updates, was set up for a week a year ago and forgotten. It is not on the company's list, but it
is on the internet.

#### Deeper

NIST defines the attack surface as the set of points on the boundary of a system where an
attacker can try to enter, affect the system or extract data from it. Probing someone's
addresses is T1595 in ATT&CK, active scanning, under the reconnaissance tactic.

### `visit` Home page

`attacker → site` · `legit`
Message: GET / · Result: page

```http
GET / HTTP/1.1
Host: www.shop.example
```

#### Simple

The site answers as it would any visitor. A **trust boundary** runs here: the site checks
everything that comes from the internet and takes nothing on faith.

#### Step by step

A trust boundary is where data passes from someone who cannot be trusted to something that
trusts it. On the diagram it is the frame of a zone. At this boundary the site checks sign-in,
permissions and input.

#### Deeper

OWASP threat modeling starts with a picture: data flows, data stores and trust boundaries. Then
come four questions: what are we working on, what can go wrong, what are we going to do about
it, did we do a good enough job.

### `test-hit` Forgotten admin panel

`attacker → test` · `attack` · `without-defence`
Message: GET /admin · Result: in without a password

```http
GET ⟦/admin⟧ HTTP/1.1
Host: test.shop.example
```

#### Simple

The test server has an admin panel **with no password**: it was handier for testing. The
attacker walks in as if they owned it.

#### Step by step

The site was protected, the test server was not: nobody counted it as part of the system. To
the attacker it is just another door, only unlocked.

#### Deeper

The class of flaw is CWE-306, missing authentication for a critical function. In the OWASP Top
10:2021 it is A05, security misconfiguration, which includes unnecessary ports, services, pages
and accounts.

### `test-closed` Test closed from outside

`attacker → test` · `attack` · `with-defence` · `stopped`
Message: GET /admin · Result: no answer

```http
GET ⟦/admin⟧ HTTP/1.1
Host: test.shop.example
```

#### Simple

The company took an **inventory**: what is visible from outside and why. A test server has no
business on the internet, so it was closed off. The request does not get through.

#### Step by step

The test server is reachable only from the office over a secure connection, and only with a
sign-in. The attack surface shrank by a whole server.

#### Deeper

The OWASP attack surface analysis cheat sheet advises understanding which parts of a system are
open to attack, looking for ways to reduce them and noticing when the surface changes. A new
server or a new technology changes it more than one more page like the others.

### `pivot` The database trusts its own

`test → db` · `attack` · `without-defence`
Message: query to clients · Result: done

```sql
SELECT * FROM ⟦clients⟧
```

#### Simple

From the test server the attacker reaches the **database**. The database lets in anyone inside
the network: if you are inside, you must be one of us.

#### Step by step

The trust boundary was drawn around the whole network, not around the database. Once the
attacker got onto any server inside, the database was open to them.

#### Deeper

Trust based on network location is what makes an extra way in dangerous. STRIDE sorts threats
into six kinds: spoofing, tampering, repudiation, information disclosure, denial of service,
elevation of privilege. Here it is information disclosure.

### `least` Everyone gets their minimum

`site → db` · `safe` · `with-defence`
Message: orders only · Result: allowed

```sql
SELECT status FROM orders WHERE id = ?
```

#### Simple

The database lets in only the **site**, with its own password, and only to what it needs: the
orders. The trust boundary now also runs around the database.

#### Step by step

Even if some server inside is broken into, the database asks for a password, and the site's
account has exactly the rights its job needs.

#### Deeper

This is the principle of least privilege: per NIST, a system restricts the access of users and
processes to the minimum needed for their tasks. Together with the closed test server, that is
two lines of defence.

### `leak` Customers leaked

`db → test` · `attack` · `without-defence`
Message: clients table · Result: leaked

#### Simple

The database hands **all customers** to the test server, and the attacker takes them from there.
The site itself is well protected: the attack went around it.

#### Step by step

One extra point exposed outside and one trust drawn too wide inside were enough.

#### Deeper

That is why defence starts with an inventory: you cannot protect a server you do not know about.
And every trust boundary is checked as if an attacker sat on the other side.

## How to defend

- **Know your surface.** Keep a list of everything visible from the internet: servers, pages,
  ports. Compare it with what is actually visible.
- **Remove what is not needed.** Close or delete test copies, old pages, extra ports and
  accounts.
- **Check at every boundary.** Sign-in, permissions and input are checked wherever data comes
  from a less trusted place, not only at the edge of the network.
- **Give the minimum of rights.** Each program has its own account and only the access it needs.
- **Draw a threat model.** A data flow diagram with trust boundaries shows where to ask "what can
  go wrong".
