# Equifax and Apache Struts (CVE-2017-5638)

`lesson` K5 · `section` K · `wave` 3 · `format` 1

## Passport

- `cwe` 755
- `owasp` A06:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
- `cves` CVE-2017-5638
- `severity` critical
- `impact` Commands on the server with no password, and through it a leak of personal data from the databases
- `defence` Install updates in time on every system that has the vulnerable component
- `class` Remote code execution in a web framework that was not updated

## Sources

- [NVD: CVE-2017-5638](https://nvd.nist.gov/vuln/detail/CVE-2017-5638)
- [Apache Struts: Security Bulletin S2-045](https://cwiki.apache.org/confluence/display/WW/S2-045)
- [Apache Struts: Security Bulletin S2-046](https://cwiki.apache.org/confluence/display/WW/S2-046)
- [Apache Struts: Announcements 2017](https://struts.apache.org/announce-2017)
- [Apache Struts: OGNL](https://struts.apache.org/tag-developers/ognl)
- [GAO-18-559: Actions Taken by Equifax and Federal Agencies in Response to the 2017 Breach](https://www.gao.gov/products/gao-18-559)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [MITRE CWE-755: Improper Handling of Exceptional Conditions](https://cwe.mitre.org/data/definitions/755.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)
- [OWASP Top 10:2021, A06 Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `portal` **Portal** — 198.51.100.20 · `icon:server` · `term:web-server`
- `db` **Databases** — 198.51.100.30 · `term:database`
- `admin` **Admins** — 198.51.100.40 · `icon:user` · `term:patch`

## Zones

- `internet` Internet: `attacker`
- `company` Company credit.example: `portal`, `db`, `admin` · `term:trust-boundary`

## Steps

### `bulletin` A fix is out

`admin → admin` · `legit`
Message: bulletin S2-045 · Result: fix released

```text
S2-045: possible code execution during file upload
Fix: update Struts to 2.3.32 or to 2.5.10 update 1
```

#### Simple

A **dangerous bug** was found in Apache Struts, a popular toolkit for building websites. Its
developers released a fix at once and warned everyone. Our company's administrators get the
warning too.

#### Step by step

The bug is in the part of Struts that accepts file uploads. The bulletin says which versions are
affected and what to update to. What is left is to find every site built on Struts and update it.

#### Deeper

Apache released Struts 2.3.32 and 2.5.10 update 1 (a four-number version) on 7 March 2017;
bulletin S2-045 lists versions
2.3.5–2.3.31 and 2.5–2.5.10 as affected. NVD published CVE-2017-5638 on 11 March. According to
the GAO report, on 10 March, 2 days after the US-CERT warning, unknown people were already
scanning Equifax for vulnerable servers. The first attack attempts came within days; the break-in itself, two months later.

### `missed` The email did not arrive

`admin → portal` · `legit` · `without-defence`
Message: patch email · Result: did not reach the portal's owners

#### Simple

The administrators sent out the warning, but **the recipient list was out of date**. The people
responsible for the dispute portal never got it. The portal stayed on the old version.

#### Step by step

A week later the company scanned its network, but the scan did not find the bug on the portal.
Everyone believed there was no hole. The portal faces the internet and is still vulnerable.

#### Deeper

That is how GAO report GAO-18-559 describes it, citing Equifax: an outdated mailing list and a
scan that missed the vulnerability. The company called this a failure of identification: they did
not know where the vulnerable component was running. This is item A06 of the OWASP Top 10:2021,
vulnerable and outdated components.

### `patch` The portal is updated

`admin → portal` · `safe` · `with-defence`
Message: Struts 2.3.32 · Result: portal updated

#### Simple

The administrators **know all their sites** built on Struts and update each one, the dispute
portal included.

#### Step by step

The company keeps a list of its programs and their components. It shows that the portal is built
on Struts. The update goes in quickly, internet-facing sites first.

#### Deeper

If updating at once is impossible, S2-045 offered temporary measures: a filter that drops requests
with an odd `Content-Type`, or a different upload parser. That is a stopgap, not a replacement for
the update. After updating, check against the component list, not only with a scan from outside.

### `exploit` A dangerous header

`attacker → portal` · `attack` · `without-defence`
Message: POST /upload · Result: command ran

```http
POST /upload
Content-Type: ⟦%{(#cmd='whoami')...}⟧
```

#### Simple

The attacker sends the portal a file upload request. In the header that should hold the data type
they put **an expression with a command**. The old Struts trips over the invalid header, and while
it handles the error, the attacker's command runs.

#### Step by step

The response shows that the command worked. The attacker can run any command on the portal with
the web application's rights, with no password and no help from anyone.

#### Deeper

NVD: the Jakarta Multipart parser in Struts 2 had incorrect exception handling and error-message
generation during file uploads, which let attackers run commands through a crafted `Content-Type`,
`Content-Disposition` or `Content-Length` header. Hence CWE-755, improper handling of exceptional
conditions. In the 2017 attacks the header contained a `#cmd=` string; Struts evaluates
expressions in the OGNL language. The score is 9.8 out of 10 under CVSS 3.1. CISA added the
vulnerability to the KEV catalog on 3 November 2021.

### `query` Thousands of queries to the databases

`portal → db` · `attack` · `without-defence`
Message: ~9000 queries · Result: 51 databases open

```sql
SELECT ⟦name, ssn, birth_date⟧ FROM people
```

#### Simple

From the portal the attackers go **further, to the databases**. Next to the data they find
passwords for other databases stored in plain text, and get into those too.

#### Step by step

At first the portal's own 3 databases are reachable. The passwords they found open 48 more
databases unrelated to the portal. The attackers send about 9,000 queries, and some of them
return personal data.

#### Deeper

According to GAO, the break-in itself began on 13 May 2017. Three weaknesses helped:
the databases were not separated from each other (no segmentation), the database passwords were
stored unencrypted, and nobody limited how often the databases could be queried. Normal work
needs nowhere near that many queries.

### `exfil` A slow leak

`portal → attacker` · `attack` · `without-defence`
Message: HTTPS, in pieces · Result: 76 days unnoticed

#### Simple

The data leaves for the attackers **in small portions** over an encrypted channel. From outside it
looks like ordinary traffic, and nobody notices.

#### Step by step

The company had a device that inspects encrypted traffic. But its certificate had expired about
10 months before the breach, and the device let such traffic through unchecked. The attack lasted
about 76 days.

#### Deeper

On 29 July 2017 an administrator replaced the expired certificate, traffic inspection came back,
and the intrusion was spotted at once. According to GAO, data of at least 145.5 million people
leaked: names, Social Security numbers, birth dates, addresses, driver's license numbers, and
card numbers of about 209,000 people. It all started with one library that was not updated.

### `blocked` The header is rejected

`attacker → portal` · `attack` · `with-defence` · `stopped`
Message: POST /upload · Result: error without execution, the attack failed

```http
POST /upload
Content-Type: ⟦%{(#cmd='whoami')...}⟧
```

#### Simple

The same request reaches the **updated** portal. Struts sees an invalid header and simply answers
with an error. The attacker's command does not run.

#### Step by step

The fixed version reports the error, but the content of the header is no longer executed. The
attacker gets no access to the server, and the way to the databases is closed.

#### Deeper

Bulletin S2-046 describes another path to the same vulnerability, CVE-2017-5638: through the
`Content-Disposition` or `Content-Length` headers. So filtering one header is no replacement for
the update. Such requests stay in the log, showing who tried the attack and when.

### `answer` An ordinary error

`portal → attacker` · `safe` · `with-defence`
Message: upload error · Result: the attack failed

#### Simple

The attacker gets the ordinary message "upload failed". No commands, no data.

#### Step by step

The portal works as before, and the databases stay out of reach from outside.

#### Deeper

Even if the attacker had got in, a second line of defence would have limited the damage: separate
databases, no plain-text passwords, a limit on query rate, and working traffic inspection.
According to GAO, after the breach Equifax introduced a new process to find and install fixes,
continuous traffic monitoring, and restrictions on traffic between internal servers.

## How to defend

- **Update in time.** The main defence: install the fix as soon as it is out, internet-facing
  systems first. Only days passed between the Struts fix and the first attack attempts.
- **Know your components.** A list of programs and libraries with versions (SBOM) shows where the
  vulnerable component runs. The warning must reach the people actually responsible for the
  system.
- **Check that you updated.** After an update, verify versions against the list, not only with a
  scan from outside.
- **Separate the databases.** Network segmentation and separate accounts stop one server from
  reaching every database.
- **Do not store passwords in plain text**, and limit how often databases can be queried.
- **Watch your defences.** A certificate that had expired 10 months before the breach switched off traffic inspection: keep track of certificate expiry dates.
