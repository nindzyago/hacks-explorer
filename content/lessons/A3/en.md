# CVSS: how severity is scored

`lesson` A3 · `section` A · `wave` 2 · `format` 1

## Passport

- `cwe` 434
- `owasp` A04:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
- `severity` critical
- `impact` The attacker's own code on the server: reading, changing and deleting data
- `defence` Patch in order of severity and threat
- `class` Scoring a vulnerability's severity with CVSS 3.1

## Sources

- [FIRST: CVSS v3.1 Specification Document](https://www.first.org/cvss/v3.1/specification-document)
- [FIRST: CVSS v4.0 Specification Document](https://www.first.org/cvss/v4.0/specification-document)
- [FIRST: CVSS v4.0](https://www.first.org/cvss/v4-0/)
- [FIRST: Exploit Prediction Scoring System (EPSS)](https://www.first.org/epss/)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [MITRE CWE-434: Unrestricted Upload of File with Dangerous Type](https://cwe.mitre.org/data/definitions/434.html)
- [OWASP Top 10:2021, A04 Insecure Design](https://owasp.org/Top10/2021/A04_2021-Insecure_Design/)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — 198.51.100.10 · `term:web-server`
- `db` **Database** — orders · `term:database`
- `admin` **Admin** — installs patches · `icon:workstation`

## Zones

- `internet` Internet: `attacker`
- `site` Site shop.example: `server`, `db`, `admin`

## Steps

### `priority` What to fix first

`admin → server` · `safe` · `with-defence`
Message: the 9.8 patch first · Result: installed

#### Simple

The admin got twenty advisories this week. They fix **first** what is most severe and already
used in attacks. The bug in the contact form scores 9.8 out of 10, so it gets closed today.

#### Step by step

A CVSS score says how bad a bug is if it gets used. The KEV catalog says it is already being used.
EPSS gives the probability that it will be used within the next 30 days.

#### Deeper

9.8 does not mean «you'll be hacked tomorrow». Per the CVSS 3.1 specification, the base score
reflects the vulnerability's intrinsic characteristics, which are constant over time, and assumes
the reasonable worst case. The KEV catalog is kept by CISA. EPSS is a FIRST model: every day it
gives each CVE a probability from 0 to 1.

### `reach` From where, and how hard

`attacker → server` · `attack`
Message: POST /contact with a file · Result: accepted

```text
CVSS:3.1/⟦AV:N/AC:L⟧/PR:N/UI:N/S:U/C:H/I:H/A:H   9.8
AV:A  adjacent network                           8.8
AV:L  only on the machine itself                 8.4
AV:P  needs physical access                      6.8
AC:H  needs special conditions                   8.1
```

#### Simple

A CVSS score is the answers to eight questions. The first two: **from where** can you attack, and
**how hard** is it. Here: from anywhere on the internet, with no special conditions, because the
contact form accepts an attachment from anyone.

#### Step by step

The answers are written as a short **vector**: `AV:N` means over the network, `AC:L` means low
complexity. Change one answer and the score moves. If the attack only worked from an adjacent
network it would be 8.8; with physical access, 6.8. In the table above each row changes one value,
the rest stay as in the first row.

#### Deeper

Attack Vector takes N, A, L, P; Attack Complexity takes L or H. AC:H means success depends on
conditions the attacker does not control. A CVSS 3.1 vector always starts with `CVSS:3.1/` and
holds all eight base metrics.

### `run` The file runs

`server → server` · `attack` · `without-defence`
Message: attachment shell.php executed · Result: the attacker's code runs

```text
CVSS:3.1/AV:N/AC:L/⟦PR:N/UI:N⟧/S:U/C:H/I:H/A:H   9.8
PR:L  needs a normal login                       8.8
PR:H  needs an admin login                       7.2
UI:R  needs a user                               8.8
PR:L + UI:R                                      8.0
PR:H + UI:R                                      6.8
```

#### Simple

The server saved the attachment into the site folder and **ran** it as a program. Nobody logged
in, nobody clicked anything. That covers two more questions: is a **login** needed, and is a **user**
needed.

#### Step by step

`PR:N` means no privileges are needed, `UI:N` means no human action is needed. If the form were
only for logged-in users, it would be 8.8; only for admins, 7.2. If the attack needed a user's
click, 8.8; login and click together, 8.0.

#### Deeper

Privileges Required: N, L, H; User Interaction: N or R. The weakness class is CWE-434: the program
accepts a dangerous file type and processes it itself. In the OWASP Top 10:2021 this CWE belongs to
A04, insecure design.

### `impact` What suffers

`server → db` · `attack` · `without-defence`
Message: read, change, delete orders · Result: all reachable

```text
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/⟦S:U/C:H/I:H/A:H⟧   9.8
C:H  read only                                   7.5
A:H  stop only                                   7.5
C:L  little can be read                          5.3
S:C  harm goes beyond the program               10.0
```

#### Simple

The last questions are about **consequences**. The attacker's code can read orders, change them
and wipe them. All three properties suffer: confidentiality, integrity and availability.

#### Step by step

C, I and A take H (fully), L (partly) or N (none). If the bug only allowed reading, it would be
7.5; reading a little, 5.3. Scope `S:C`, harm that goes beyond the vulnerable program, would raise
the score to 10.0.

#### Deeper

S:U means the harm stays within the same authority as the vulnerable program. S:C is used when,
for example, a bug in one program gives access to what another one controls. That is how NVD
scored Log4Shell: 10.0 (lesson K1).

### `score` The total

`server → attacker` · `attack` · `without-defence`
Message: 9.8, critical · Result: the data is with the attacker

```text
0.0         none
0.1 – 3.9   low
4.0 – 6.9   medium
7.0 – 8.9   high
9.0 – 10.0  critical
```

#### Simple

All the answers together give **9.8 out of 10**, critical. In practice: an attacker from the
internet, without a password, got the shop's data.

#### Step by step

The number comes from a formula in the specification and is rounded up to one decimal. The word
comes from the table above. The mildest answers give very little: physical access, special
conditions, admin rights, a user's click and minor reading make 1.6.

#### Deeper

CVSS 4.0 adds the Attack Requirements (AT) metric, splits «needs a user» into two values, Passive
and Active, and retires Scope: impact is scored separately for the vulnerable system (VC, VI, VA)
and for subsequent systems (SC, SI, SA). The temporal metrics are renamed Threat there, and a score
is labelled by what it includes: CVSS-B, CVSS-BT, CVSS-BE, CVSS-BTE.

### `patched` The attachment doesn't run

`server → server` · `attack` · `with-defence` · `stopped`
Message: attachment shell.php · Result: stored as a file, the attack failed

#### Simple

The patch is already in. The server keeps attachments **outside the site folder** and only as
data: they cannot be run.

#### Step by step

The file type is checked against an allowlist, and the server picks the file name itself. The
file `shell.php` stays just bytes on disk.

#### Deeper

The base score of 9.8 does not change after the patch: it describes the bug itself. Changes on
your side are covered by the other CVSS metric groups: temporal (for example, whether an official
fix exists) and environmental (how important the system is and what you have already closed).

### `answer` A normal reply

`server → attacker` · `safe` · `with-defence`
Message: thanks, message received · Result: the attack failed

#### Simple

The attacker gets the form's polite reply, like any visitor. The code did not run.

#### Step by step

The message with its attachment reached the shop as an ordinary message.

#### Deeper

The score helped set the order: of twenty advisories, this one was closed first, before the
attacker came.

## How to defend

- **Fix in order.** First vulnerabilities from the KEV catalog and those with a high CVSS score in
  internet-facing systems. EPSS hints at what is most likely to be exploited.
- **Don't read the number alone.** The base score is a property of the bug, not of your network.
  Take into account where the system sits and what it holds.
- **Look at the vector.** `PR:N` and `UI:N` mean the attack needs neither a login nor a person:
  such a bug is the easiest to exploit.
- **Shrink the attack surface.** Forms that accept files only where needed; attachments outside
  the site folder and with no right to run.
