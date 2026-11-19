# Glossary

`glossary` en · `format` 1

## Sections

- `basics` Basics
- `web` Web and databases
- `people` Logins and people
- `mail` Email
- `network` Network
- `catalogs` Catalogs and scores

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

## `data-breach` Data breach

`category` basics · `see` database, hash · `lessons` F1

Forms: data breach, data breaches, database leak, database leaks

A case where a site's data, for example a copy of its database, ends up with outsiders. After a
breach the attacker works on the copy on their own machines, and the site can do nothing about it.
That is why passwords are stored so that a leaked copy gives away little.

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

## `xss` XSS

`category` web · `see` injection, output-encoding, csp, session-cookie · `lessons` C1

Forms: XSS, cross-site scripting

A site puts text sent to it into its own page in such a way that the browser runs it as the
site's script. Reflected XSS returns input from the request straight in the response, stored XSS
saves it first, and DOM XSS is built by the page itself in the browser. The weakness class is
CWE-79; in the OWASP Top 10:2021 it is part of A03 Injection.

## `output-encoding` Output encoding

`category` web · `see` xss, csp · `lessons` C1

Forms: output encoding

Replacing special characters with safe forms at the moment data is put into a page: `<` becomes
`&lt;`, `"` becomes `&quot;`. The browser shows such characters as text, but they can no longer
start a tag or an attribute. Each place has its own rule: page text, attribute, JavaScript, CSS,
URL. The primary defence against XSS according to OWASP.

## `csp` Content Security Policy

`category` web · `see` xss, output-encoding · `lessons` C1

Forms: Content Security Policy, CSP

A response header with which a site tells the browser where scripts and other resources may be
loaded from. Without `'unsafe-inline'` in the `script-src` rule the browser does not run scripts
written right into the page. Defined in a W3C specification; it protects as a second layer if
encoding was forgotten somewhere.

## `session-cookie` Session cookie

`category` web · `see` xss, web-server, csrf, samesite · `lessons` C1, C4

Forms: session cookie, session cookies

A small record a site leaves in the browser after login. The browser attaches it to every request
to that site, and by it the site recognizes the user without a password. Whoever steals such a
cookie can log in as its owner. The `HttpOnly` attribute (RFC 6265) forbids page scripts from
reading it.

## `csrf` CSRF

`category` web · `see` csrf-token, session-cookie, samesite · `lessons` C4

Forms: CSRF, cross-site request forgery

Cross-Site Request Forgery: someone else's page makes the victim's browser send a request to a
site where the victim is already logged in. The browser attaches the victim's cookie on its own,
and the site carries out the action in the victim's name: a transfer, a password change. In the
MITRE catalogue it is CWE-352.

## `csrf-token` CSRF token

`category` web · `see` csrf, session-cookie · `lessons` C4

Forms: CSRF token, CSRF tokens

A random secret string that a site puts into its own forms and checks on every request that
changes something. Another site's page does not know it and cannot read it from the site's page,
so a forged request arrives without the token and is rejected.

## `samesite` SameSite

`category` web · `see` session-cookie, csrf · `lessons` C4

Forms: SameSite

A cookie attribute that tells the browser whether to attach the cookie to requests coming from
other sites. `Strict` means never, `Lax` only on an ordinary link navigation, `None` always. It
protects against CSRF as an extra layer but does not replace a CSRF token.

## `idor` IDOR

`category` web · `see` authorization, owasp, cwe · `lessons` D1

Forms: IDOR

Insecure Direct Object Reference. The server hands out a record by a number from the request (for
example, order `/orders/1002`) and does not check that it belongs to whoever is asking. Changing
the number shows or changes someone else's data. The weakness class is CWE-639; in the OWASP Top
10:2021 it falls under A01 Broken Access Control. In APIs the same bug is called BOLA.

## `authorization` Authorization

`category` web · `see` idor, web-server · `lessons` D1

Forms: authorization, authorisation, permission check, permission checks

Checking what a user is allowed to do: open this record, change it, delete it. Not to be confused
with logging in (authentication), which answers “who are you”. The server does it itself on every
request and refuses by default.


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

## `salt` Salt

`category` people · `see` hash, password-hashing · `lessons` F1

Forms: salt, salts, salted

A random string the site adds to a password before hashing, different for every password. The
salt is not secret and is stored next to the hash. Because of it, equal passwords give different
hashes, and tables of hashes computed in advance are useless.

## `password-hashing` Password hashing function

`category` people · `see` hash, salt · `lessons` F1

Forms: password hashing function, password hashing functions, slow hash function, slow hash, slow hashes

A hash function that deliberately spends noticeable time, and sometimes memory, on every hash:
Argon2id, scrypt, bcrypt, PBKDF2. For one login this goes unnoticed, while guessing millions of
passwords against a leaked database becomes very expensive.

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

## `mitm` Man in the middle

`category` network · `see` arp, tls, attacker · `lessons` G1

Forms: man in the middle, man-in-the-middle, MITM, adversary in the middle, adversary-in-the-middle

An attack in which the attacker gets between the two sides of a conversation: each thinks it is
talking to the other, but everything passes through the attacker, who can read and change the
messages. In MITRE ATT&CK it is technique T1557 "Adversary-in-the-Middle". Encryption that also
checks who is on the other end, such as TLS, protects against it.

## `router` Router

`category` network · `see` arp, mitm · `lessons` G1

Forms: router, routers

A device through which the computers of a local network reach other networks, such as the
internet. To send something outside, a computer hands the packet to its network's router.

## `arp` ARP

`category` network · `see` router, mitm · `lessons` G1

Forms: ARP, ARP table, ARP tables, ARP request, ARP requests, ARP reply, ARP replies

Address Resolution Protocol (RFC 826): finds the physical MAC address of a neighbour on the same
network from its IP address. A computer asks everyone and keeps the answer in its ARP table. ARP
does not check who answers, so a fake reply can pass the attacker off as the router.

## `tls` TLS

`category` network · `see` certificate, hsts, mitm · `lessons` G1

Forms: TLS, HTTPS

Transport Layer Security, the protocol for secure connections; HTTPS is HTTP over TLS. It encrypts
the data and checks the server by its certificate, so someone in the middle can neither read the
conversation nor quietly change it. The current version, TLS 1.3, is described in RFC 8446.

## `certificate` Certificate

`category` network · `see` tls, domain · `lessons` G1

Forms: certificate, certificates

An electronic document that ties a site's name to its public key and is signed by a certificate
authority. The browser checks that the certificate was issued for the domain it opened and signed
by someone it trusts. A certificate says whose site it is, not that the site is honest.

## `hsts` HSTS

`category` network · `see` tls, certificate · `lessons` G1

Forms: HSTS, Strict-Transport-Security

HTTP Strict Transport Security (RFC 6797): a header with which a site tells the browser to reach it
over HTTPS only. The browser itself turns `http` into `https` and does not let anyone click past a
certificate error. The HSTS preload list built into browsers protects the first visit.

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
