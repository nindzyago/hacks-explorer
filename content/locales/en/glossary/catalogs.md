# Catalogs and scores

`glossary` en · `category` catalogs

## `cwe` CWE

`category` catalogs · `see` cve, owasp · `lessons` B1, A6

Forms: CWE

Common Weakness Enumeration, a catalog of weakness types in software and hardware, maintained by
MITRE. A CWE names a class of mistake, not a specific vulnerability: for example, CWE-89 is SQL
injection.

## `cve` CVE

`category` catalogs · `see` cwe, cvss · `lessons` A2

Forms: CVE

Common Vulnerabilities and Exposures, a shared list of known vulnerabilities in specific products.
Each one gets a number like CVE-2021-44228, so that everyone talks about the same flaw.

## `cvss` CVSS

`category` catalogs · `see` cve · `lessons` A3

Forms: CVSS

Common Vulnerability Scoring System, a scale of vulnerability severity from 0 to 10. The score is
built from properties: whether it can be attacked over the network, how hard that is, whether
privileges or user action are needed, and what suffers: confidentiality, integrity or
availability.

## `owasp` OWASP

`category` catalogs · `see` cwe, injection · `lessons` B1, A6

Forms: OWASP, OWASP Top 10

Open Worldwide Application Security Project, an open community for web application security. Its
best-known document is the OWASP Top 10, a list of the ten main risk categories; in the 2021
edition, which the lessons refer to, injection is A03. A new edition came out in 2025.

## `mitre-attack` MITRE ATT&CK

`category` catalogs · `see` phishing, cwe · `lessons` I1, A8

Forms: MITRE ATT&CK, ATT&CK

MITRE's open knowledge base of attacker tactics and techniques, built from real-world attacks.
Each technique has its own number: T1566 is phishing, T1566.002 is spearphishing with a link.

## `cna` CNA

`category` catalogs · `see` cve, nvd · `lessons` A2

Forms: CNA

CVE Numbering Authority, an organization the CVE Program has authorized to assign CVE numbers and
publish records within its scope. Often it is the vendor itself: Apache, for example, for its own
projects.

## `nvd` NVD

`category` catalogs · `see` cve, cvss · `lessons` A2

Forms: NVD

National Vulnerability Database, the vulnerability database of NIST, part of the US government.
It takes CVE records and usually adds its own CVSS score, the CWE weakness class and the list of affected
products.

## `kev` KEV

`category` catalogs · `see` cve, epss · `lessons` A3

Forms: KEV

Known Exploited Vulnerabilities, a CISA catalog of vulnerabilities already used in real attacks.
Being in KEV is a signal to fix it first, whatever its CVSS score.

## `epss` EPSS

`category` catalogs · `see` cvss, kev · `lessons` A3

Forms: EPSS

Exploit Prediction Scoring System, a FIRST model that every day gives each CVE a probability from
0 to 1 that it will be exploited in attacks within the next 30 days.

## `attack-tactic` ATT&CK tactic

`category` catalogs · `see` mitre-attack · `lessons` A8

Forms: tactic, tactics

The goal of an attack step in MITRE ATT&CK, its "why": reconnaissance, initial access,
execution, persistence and so on up to impact. A technique is "how" the goal is reached.
Tactics line up into an attack chain.
