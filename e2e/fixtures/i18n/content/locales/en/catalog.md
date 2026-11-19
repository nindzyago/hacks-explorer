# Lesson catalog

`catalog` en · `format` 1

Every topic of the site by section (M2.1, K111). A section is `` ## `B` Name ``, a topic is
`` - `B1` Name ``. A lesson is ready when its file `content/lessons/<id>/<language>.md` exists.
The Russian catalog is the base: this file keeps the same sections and topics in the same order.

## `A` Basics

- `A1` Vulnerability, exploit, patch
- `A2` CVE: the passport of a vulnerability
- `A3` CVSS: how severity is scored
- `A4` RCE: someone else's code on your server
- `A5` What we protect: confidentiality, integrity, availability
- `A6` Classes of flaws: CWE and the OWASP Top 10
- `A7` Attack surface and trust boundaries
- `A8` Stages of an attack: from reconnaissance to the goal

## `B` Web: injections

- `B1` SQL injection
- `B2` OS command injection
- `B3` Path traversal
- `B4` Unrestricted file upload
- `B5` Insecure deserialization
- `B6` Server-side template injection (SSTI)
- `B7` XXE: XML external entities
- `B8` NoSQL injection

## `C` Web: the browser

- `C1` Reflected XSS
- `C2` Stored XSS
- `C3` DOM-based XSS
- `C4` CSRF: requests on someone else's behalf
- `C5` Clickjacking
- `C6` CORS mistakes
- `C7` Open redirects

## `D` Web: access and sessions

- `D1` Someone else's data by number (IDOR)
- `D2` Privilege escalation
- `D3` Session hijacking and fixation
- `D4` Attacks on JWT
- `D5` OAuth mistakes
- `D6` User enumeration
- `D7` Mass assignment
- `D8` SSRF: the server goes where it should not

## `E` Web: infrastructure

- `E1` HTTP request smuggling
- `E2` Web cache poisoning
- `E3` Host header attacks
- `E4` Race conditions: two requests at once
- `E5` Prototype pollution

## `F` Passwords and sign-in

- `F1` Hashes and salt: how passwords are stored
- `F2` Brute force and credential stuffing
- `F3` Rainbow tables
- `F6` Second factor and how it is bypassed
- `F7` Passkeys: signing in without a password

## `G` Network

- `G1` Man in the middle
- `G2` DNS poisoning
- `G3` SSL stripping and downgrade
- `G4` DDoS: SYN flood and amplification
- `G5` Port scanning
- `G6` Evil twin Wi-Fi
- `G7` BGP hijacking

## `H` Malware and memory

- `H1` Buffer overflow
- `H2` Ransomware
- `H3` Trojans and command and control
- `H4` Worms
- `H5` Supply chain attacks
- `H6` Dangerous dependencies and typosquatting

## `I` People

- `I1` Phishing
- `I2` Spear phishing and payment fraud
- `I3` Sender spoofing: SPF, DKIM, DMARC
- `I4` A call "from the security team"
- `I5` Malicious ads and fake updates

## `J` AI

- `J1` Prompt injection
- `J2` Hidden commands for AI agents
- `J3` Poisoning model data
- `J4` Slopsquatting

## `K` Famous cases

- `K1` Log4Shell (CVE-2021-44228)
- `K2` Heartbleed (CVE-2014-0160)
- `K3` WannaCry and EternalBlue (CVE-2017-0144)
- `K4` Shellshock (CVE-2014-6271)
- `K5` Equifax and Apache Struts (CVE-2017-5638)
- `K6` SolarWinds (2020)
- `K7` The xz backdoor (CVE-2024-3094)

## `L` Encryption and certificates

- `L1` Encryption: one key and a key pair
- `L2` Signatures and certificates
- `L3` HTTPS: how the browser checks a site
- `L4` Certificate warnings: what they mean
- `L5` End-to-end encryption in messengers
