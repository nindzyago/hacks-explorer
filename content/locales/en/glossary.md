# Glossary

`glossary` en · `format` 1

## Sections

- `basics` Basics
- `web` Web and databases
- `people` Logins and people
- `mail` Email
- `catalogs` Catalogs and scores
- `malware` Malware

## `attacker` Attacker

`category` basics · `see` victim, trust-boundary · `lessons` B1, I1

Someone who tries to make a system break its own rules: steal data, log in under someone else's
name, take a service down. Harmful messages on the lesson diagrams are red.

## `victim` Victim

`category` basics · `see` attacker, phishing · `lessons` I1

Forms: victim, victims

The person or system an attack is aimed at. In the phishing lesson it is the employee who is
tricked into giving away a password.

## `trust-boundary` Trust boundary

`category` basics · `see` injection, attacker · `lessons` B1

Forms: trust boundary, trust boundaries

The place where data passes from someone the system cannot trust (for example, the internet) to
something that trusts it (the server, the database). Everything that crosses it from outside must
be checked and handled as data, not as commands. On a lesson diagram it is shown by the frame of a
zone.

## `web-server` Web server

`category` web · `see` query, database · `lessons` B1

Forms: web server, web servers

A program on the site's computer that receives requests from browsers and answers them: it sends
pages, checks logins and passwords, talks to the database.

## `database` Database

`category` web · `see` sql, query, hash · `lessons` B1

Forms: database, databases

Where a site keeps its information: users, orders, password hashes. The site reads and changes
the data with queries, most often in SQL.

## `sql` SQL

`category` web · `see` query, database, sql-injection · `lessons` B1

Forms: SQL

Structured Query Language, the language of queries to relational databases. For example,
`SELECT * FROM users WHERE login = 'anna'` means “find the rows in the users table whose login is
anna”.

## `query` Query (request)

`category` web · `see` sql, web-server, parameterized-query · `lessons` B1

Forms: query, queries, request, requests

A message from one program asking another to do or return something. A browser sends requests to
a web server over HTTP; a server sends queries to a database in SQL.

## `injection` Injection

`category` web · `see` sql-injection, trust-boundary, owasp · `lessons` B1

Forms: injection, injections

A class of attacks in which a program treats data from a user as part of a command and runs it.
There are injections into database queries, into operating system commands, into web pages.

## `sql-injection` SQL injection

`category` web · `see` injection, parameterized-query, sql-comment, cwe · `lessons` B1

Forms: SQL injection, SQL injections

Injection into a database query: the server pastes the text it received into an SQL query, and
that text changes what the query means. The weakness class is CWE-89; in the OWASP Top 10:2021 it
falls under A03 Injection (the lessons refer to the 2021 edition; a new one came out in 2025).

## `parameterized-query` Parameterized query

`category` web · `see` sql-injection, query · `lessons` B1

Forms: parameterized query, parameterized queries, parameterised query, parameterised queries, prepared statement, prepared statements

A query in which the command and the user's data are sent to the database separately: in the
query text, placeholders stand where the data goes. The database always treats what fills them as
a value, never as part of the command, so quotes and `--` in the input break nothing. The main
defence against SQL injection in the OWASP recommendations.

## `sql-comment` SQL comment

`category` web · `see` sql-injection, sql · `lessons` B1

Forms: SQL comment, SQL comments

A part of an SQL query that the database skips. Two hyphens `--` start a comment to the end of the
line (in MySQL they must be followed by a space or another whitespace character). In SQL injection
this is used to cut off the rest of the query, for example the password check.

## `hash` Hash

`category` web · `see` database · `lessons` B1

Forms: hash, hashes

A fixed-length value that a hash function computes from data. For cryptographic hash functions the
only way back is guessing. Well-built sites store not passwords but their hashes, computed with
slow functions and a “salt”, for example Argon2 or bcrypt.

## `phishing` Phishing

`category` people · `see` fake-page, proxy-phishing, social-engineering, mitre-attack · `lessons` I1

Forms: phishing

A trick in which someone writes to a person in the name of a bank, a boss or a support team and
lures them to a fake page or asks them to share a secret. In MITRE ATT&CK it is technique T1566.

## `social-engineering` Social engineering

`category` people · `see` phishing · `lessons` I1

Forms: social engineering

An attack on a person rather than a program: urgency, fear, authority and trust push someone into
doing what the attacker needs, such as opening a link, reading out a code or sending money.

## `fake-page` Fake page

`category` people · `see` domain, phishing, password-manager · `lessons` I1

Forms: fake page, fake pages

A copy of a real login page at someone else's address. Whatever is typed into it goes to the
attacker. You can tell it apart by the domain in the address bar, not by its look: pictures and a
logo are easy to copy.

## `domain` Domain

`category` people · `see` fake-page, password-manager, passkey · `lessons` I1

Forms: domain, domains

The name of a site in its address, for example `bank.example`. Whose site it is depends on the end
of the name, not on familiar words inside it: `login.bank.example` belongs to `bank.example`, while
`bank.example.evil.example` belongs to `evil.example`; `bank-login.example` is a different domain
too, however similar it looks. The lessons take domains from the training zone `.example`; there
are no real companies here.

## `password-manager` Password manager

`category` people · `see` domain, fake-page, second-factor · `lessons` I1

Forms: password manager, password managers

A program that stores passwords and fills them in only on the site the password was saved for. On
a fake page it will not offer the password, and that is a reason to check the address.

## `second-factor` Second factor

`category` people · `see` passkey, proxy-phishing, password-manager · `lessons` I1

Forms: second factor, second factors, two-factor authentication

One more confirmation of a login besides the password: a code from an app or an SMS, a
notification on a phone, a hardware key. A single stolen password is then not enough. Codes from
SMS and apps can be phished on a fake page; FIDO2 keys and passkeys cannot.

## `passkey` Passkey

`category` people · `see` second-factor, domain · `lessons` I1

Forms: passkey, passkeys

A login without a password, with a key stored on a device or in a password manager. The key is
bound to the site's domain, so the browser will not let it be used on a fake page. It is built on the
WebAuthn and FIDO2 standards, like FIDO2 hardware keys, which often serve as a second factor next
to a password.

## `proxy-phishing` Proxy phishing

`category` people · `see` phishing, second-factor, passkey · `lessons` I1

Forms: proxy phishing

Phishing in which the fake page instantly forwards everything typed into it to the real site and
shows the real site's answers. This way the attacker gets the password, the one-time code and an
open session. Login methods bound to the domain, such as passkeys, resist it.

## `spf` SPF

`category` mail · `see` dkim, dmarc · `lessons` I1

Forms: SPF

Sender Policy Framework (RFC 7208): a DNS record of a domain listing the servers allowed to send
mail in its name. The recipient's server checks the server that delivered the email against it.
What is checked is the address on the email's “envelope”, not the one a person sees in the
“From” field.

## `dkim` DKIM

`category` mail · `see` spf, dmarc · `lessons` I1

Forms: DKIM

DomainKeys Identified Mail (RFC 6376): the sender's server signs the email with the domain's key,
and the recipient checks the signature with the public key from that domain's DNS. A valid
signature means the signing domain takes responsibility for the email and the signed parts were
not changed on the way. The signing domain may differ from the one in the “From” field: DMARC
compares them.

## `dmarc` DMARC

`category` mail · `see` spf, dkim, domain · `lessons` I1

Forms: DMARC

A domain's policy (RFC 9989, formerly RFC 7489) that ties the SPF and DKIM checks to the address
in the “From” field and tells the recipient how the domain owner wants an email that fails to be
treated: no preference (`none`), as suspicious, for example sent to spam (`quarantine`), or
rejected (`reject`). It does not protect against email from look-alike domains:
they have their own records.

## `cwe` CWE

`category` catalogs · `see` cve, owasp · `lessons` B1

Forms: CWE

Common Weakness Enumeration, a catalog of weakness types in software and hardware, maintained by
MITRE. A CWE names a class of mistake, not a specific vulnerability: for example, CWE-89 is SQL
injection.

## `cve` CVE

`category` catalogs · `see` cwe, cvss

Forms: CVE

Common Vulnerabilities and Exposures, a shared list of known vulnerabilities in specific products.
Each one gets a number like CVE-2021-44228, so that everyone talks about the same flaw.

## `cvss` CVSS

`category` catalogs · `see` cve

Forms: CVSS

Common Vulnerability Scoring System, a scale of vulnerability severity from 0 to 10. The score is
built from properties: whether it can be attacked over the network, how hard that is, whether
privileges or user action are needed, and what suffers: confidentiality, integrity or
availability.

## `owasp` OWASP

`category` catalogs · `see` cwe, injection · `lessons` B1

Forms: OWASP, OWASP Top 10

Open Worldwide Application Security Project, an open community for web application security. Its
best-known document is the OWASP Top 10, a list of the ten main risk categories; in the 2021
edition, which the lessons refer to, injection is A03. A new edition came out in 2025.

## `mitre-attack` MITRE ATT&CK

`category` catalogs · `see` phishing, cwe · `lessons` I1

Forms: MITRE ATT&CK, ATT&CK

MITRE's open knowledge base of attacker tactics and techniques, built from real-world attacks.
Each technique has its own number: T1566 is phishing, T1566.002 is spearphishing with a link.

## `ransomware` Ransomware

`category` malware · `see` backup, network-segmentation, macro · `lessons` H2

Forms: ransomware

Malicious software that encrypts the victim's files and demands a ransom for the key. Before that
it often deletes backups and copies the data out, to threaten publication as well. In MITRE
ATT&CK encrypting data to cause harm is technique T1486.

## `macro` Macro

`category` malware · `see` ransomware, phishing · `lessons` H2

Forms: macro, macros

A small program inside an office document that automates work with it. A harmful macro can
download and start another program, so macros in files from email are best kept turned off.

## `backup` Backup

`category` malware · `see` ransomware · `lessons` H2

Forms: backup, backups

A copy of data that it can be restored from after a failure or an attack. Only a copy the
ransomware cannot reach saves you from it: one disconnected from the network or immutable. The
3-2-1 rule: three copies, two types of media, one copy outside the office.

## `network-segmentation` Network segmentation

`category` malware · `see` ransomware, trust-boundary · `lessons` H2

Forms: network segmentation, segmentation

Splitting a network into parts with rules on who may talk to whom. Work computers do not see every
server, so an infection of one machine does not spread through the whole company.
