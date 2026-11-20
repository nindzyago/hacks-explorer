# What we protect: confidentiality, integrity, availability

`lesson` A5 · `section` A · `wave` 2 · `format` 1

## Passport

- `cwe` 862, 770
- `owasp` A01:2021
- `attack` T1565.001, T1499
- `severity` high
- `impact` Someone else's test results read, changed, and the service down
- `defence` Each of the three properties gets its own protection
- `class` Attack on confidentiality, integrity and availability

## Sources

- [NIST CSRC Glossary: confidentiality](https://csrc.nist.gov/glossary/term/confidentiality)
- [NIST CSRC Glossary: integrity](https://csrc.nist.gov/glossary/term/integrity)
- [NIST CSRC Glossary: availability](https://csrc.nist.gov/glossary/term/availability)
- [NIST CSRC Glossary: authenticity](https://csrc.nist.gov/glossary/term/authenticity)
- [NIST CSRC Glossary: non-repudiation](https://csrc.nist.gov/glossary/term/non_repudiation)
- [NIST CSRC Glossary: denial of service](https://csrc.nist.gov/glossary/term/denial_of_service)
- [FIRST: CVSS v3.1 Specification Document](https://www.first.org/cvss/v3.1/specification-document)
- [OWASP Cheat Sheet Series: Threat Modeling](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)
- [MDN: 429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429)
- [OWASP Top 10:2021, A01 Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/)
- [MITRE CWE-862: Missing Authorization](https://cwe.mitre.org/data/definitions/862.html)
- [MITRE CWE-770: Allocation of Resources Without Limits or Throttling](https://cwe.mitre.org/data/definitions/770.html)
- [MITRE ATT&CK T1565.001: Stored Data Manipulation](https://attack.mitre.org/techniques/T1565/001/)
- [MITRE ATT&CK T1499: Endpoint Denial of Service](https://attack.mitre.org/techniques/T1499/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `patient` **Patient** — Anna · `icon:user`
- `server` **Server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — test results · `term:database`

## Zones

- `internet` Internet: `attacker`, `patient`
- `clinic` Clinic clinic.example: `server`, `db`

## Steps

### `visit` Her own results

`patient → server` · `legit`
Message: my results · Result: shown

```http
GET /results/1001
```

#### Simple

Anna opens her test results in the clinic's patient portal. For this to work, three things
are needed: **confidentiality** — only she and her doctor see them, **integrity** — the numbers
are the ones the lab entered, **availability** — the site answers when she needs it.

#### Step by step

These three properties are called the CIA triad, after the first letters of confidentiality,
integrity and availability. Next the attacker hits each of them in turn, and each time a
different protection is needed.

#### Deeper

NIST's definitions, taken from US law (44 U.S.C. § 3542): confidentiality is preserving
authorized restrictions on access to and disclosure of information; integrity is guarding
against improper modification or destruction of information, including non-repudiation and
authenticity; availability is timely and reliable access to and use of information.

### `read` Someone else's results

`attacker → server` · `attack` · `without-defence`
Message: /results/1002 · Result: shown

```http
GET /results/⟦1002⟧
```

#### Simple

The attacker signs in to their own account and changes the number in the address to the next
one. The server shows **someone else's** results. This hits confidentiality: the data is intact,
the site works, but an outsider can see it.

#### Step by step

The server checked that the person is signed in, but not **whose** results these are. By
going through the numbers, the attacker can collect every patient's results.

#### Deeper

The class of flaw is CWE-862, missing authorization. In the OWASP Top 10:2021 it is A01, broken
access control. In a CVSS 3.1 score such a leak sets a high confidentiality impact, `C:H`.

### `read-check` Not yours, not shown

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: /results/1002 · Result: 403

```http
GET /results/⟦1002⟧
```

#### Simple

The server compares the record's **owner** with the person signed in. Record 1002 is not
theirs, so the answer is "forbidden".

#### Step by step

The check runs on the server for every record, not in the interface: the attacker can always
type the address by hand. The refusal is written to the log.

#### Deeper

Confidentiality is protected by access checks, encryption at rest and in transit, and the rule
of giving everyone the minimum. Encryption helps when data leaks around the server, for example
as a copy of the database.

### `tamper` Changed result

`attacker → server` · `attack` · `without-defence`
Message: glucose = 5.1 · Result: changed

```http
PATCH /results/⟦1002⟧  glucose=⟦5.1⟧
```

#### Simple

Through the same hole the attacker does not read but **changes** someone's result: high blood
sugar becomes normal. This hits integrity: the site works, but its data can no longer be
trusted.

#### Step by step

The server writes the new value to the database. The doctor opens the result and sees a normal
number. The change is hard to spot: the record looks like any other.

#### Deeper

In ATT&CK this is T1565.001, stored data manipulation: it is used to affect business processes and
decisions, or to hide activity. In CVSS 3.1 it is a high integrity impact, `I:H`.

### `tamper-check` Only the lab may edit

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: glucose = 5.1 · Result: 403

```http
PATCH /results/⟦1002⟧  glucose=⟦5.1⟧
```

#### Simple

Only the **lab** may change a result. A patient may only read, and only their own. The request
is rejected.

#### Step by step

Every change, allowed or not, goes into the log: who, when, what it was and what it became. So
a forged change can be found and rolled back.

#### Deeper

Integrity is protected by write permissions, a change log, backups and digital signatures: a
signature shows that data came from whoever signed it and has not been changed. NIST counts
authenticity and non-repudiation as parts of integrity.

### `flood` Flood of requests

`attacker → server` · `attack` · `without-defence`
Message: 10,000 requests/s · Result: overload

```http
GET /results/search?q=⟦*⟧   ×10,000 per second
```

#### Simple

The third hit is not at the data but at the **service**. The attacker sends thousands of heavy
search requests. The server spends all its strength on them.

#### Step by step

Each search through the whole database takes a second of work. The server does not limit how
many requests it accepts from one address, and the queue grows.

#### Deeper

The class of flaw is CWE-770: resources handed out without limits. In ATT&CK this is T1499,
endpoint denial of service: against a server or an application. NIST defines denial of service
as preventing authorized access to resources or delaying time-critical operations.

### `down` The site does not answer

`server → patient` · `legit` · `without-defence`
Message: 503 · Result: unavailable

#### Simple

Anna opens her results again, but the site **does not answer**. Nothing was stolen or changed,
yet the service cannot be used. This hits availability.

#### Step by step

The clinic is harmed too: patients cannot book, doctors cannot see results.

#### Deeper

In CVSS 3.1 the availability metric, unlike the other two, is not about data but about the
component itself: whether it can work. All three metrics take the same values: high `H`, low
`L`, none `N`.

### `flood-limit` Request limit

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: 10,000 requests/s · Result: excess dropped

```http
GET /results/search?q=⟦*⟧   ×10,000 per second
```

#### Simple

The server accepts **no more** than ten searches a minute from one address. The rest are
dropped at once, with almost no work.

#### Step by step

The limit sits in front of the heavy part, the database search. Excess requests get code 429,
"too many requests".

#### Deeper

Availability is protected by limits, spare capacity, standby servers and copies of the data.
Against a large distributed attack from thousands of addresses one limit is not enough: help
from the provider or a delivery network is needed.

### `up` Results are back

`server → patient` · `safe` · `with-defence`
Message: my results · Result: shown

#### Simple

Anna sees her results, **real** ones and on time. All three properties hold.

#### Step by step

Three hits were stopped by three different protections: the owner check, write permissions and
the request limit.

#### Deeper

OWASP's threat modeling with STRIDE links threats to properties: information disclosure breaks
confidentiality, tampering breaks integrity, denial of service breaks availability.

## How to defend

- **Ask about each property.** For each piece of data and each service, decide what is worse:
  being read, being changed or being unavailable. The protection depends on the answer.
- **Confidentiality.** Check access to every record on the server, encrypt data at rest and in
  transit, give access only to those who need it.
- **Integrity.** Allow changes only to those responsible for them, keep a change log, keep
  backups, sign important data.
- **Availability.** Limit the number of requests, keep spare capacity and standby servers, check
  that backups can be restored.
