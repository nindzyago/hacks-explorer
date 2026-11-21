# Web and databases

`glossary` en · `category` web

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

`category` web · `see` injection, output-encoding, csp, session-cookie · `lessons` C1, C2, C3

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

## `sanitizer` HTML sanitizer

`category` web · `see` xss, output-encoding · `lessons` C2

Forms: sanitizer, sanitizers, HTML sanitizer

A filter that parses submitted HTML and keeps only allowed tags and attributes, removing scripts
and event handlers. It is needed where users may format text and plain encoding would break the
markup. OWASP recommends the ready-made DOMPurify library rather than a home-made filter.

## `csp` Content Security Policy

`category` web · `see` xss, output-encoding · `lessons` C1

Forms: Content Security Policy, CSP

A response header with which a site tells the browser where scripts and other resources may be
loaded from. Without `'unsafe-inline'` in the `script-src` rule the browser does not run scripts
written right into the page. Defined in a W3C specification; it protects as a second layer if
encoding was forgotten somewhere.

## `trusted-types` Trusted Types

`category` web · `see` xss, csp, sanitizer · `lessons` C3

Forms: Trusted Types

A browser defence against DOM XSS. The `require-trusted-types-for 'script'` rule in a Content
Security Policy forbids writing plain strings into dangerous sinks such as `innerHTML`: the data
first passes through the site's policy, for example a sanitizer. Described in a W3C
specification.

## `session-cookie` Session cookie

`category` web · `see` xss, web-server, csrf, samesite, session-fixation · `lessons` C1, C4, D3

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
MITRE catalogue it is weakness CWE-352 and attack pattern CAPEC-62.

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
other sites. `Strict` means never, `Lax` only on a top-level navigation with a safe method, such as following a
link, `None` always. It
protects against CSRF as an extra layer but does not replace a CSRF token.

## `same-origin-policy` Same-origin policy

`category` web · `see` cors, clickjacking · `lessons` C6

Forms: same-origin policy

The browser's main security rule: a script from one origin cannot read responses from another
origin. An origin is the scheme, host and port: `https://shop.example` and
`https://api.shop.example` are different origins, even though they are the same site.

## `cors` CORS

`category` web · `see` same-origin-policy, session-cookie · `lessons` C6

Forms: CORS, Cross-Origin Resource Sharing

The way a server lets scripts from other sites read its responses, relaxing the same-origin
policy. The permission is the `Access-Control-Allow-Origin` header. A permission that is too broad
is weakness CWE-942.

## `clickjacking` Clickjacking

`category` web · `see` same-origin-policy, session-cookie · `lessons` C5

Forms: clickjacking

“Click hijacking”: another site shows the real page in a transparent frame over its own button,
and the user, without knowing it, presses the real site's button. The weakness class is CWE-1021.
The defence is a header with a `frame-ancestors` rule or `X-Frame-Options`.

## `idor` IDOR

`category` web · `see` authorization, owasp, cwe · `lessons` D1

Forms: IDOR

Insecure Direct Object Reference. The server hands out a record by a number from the request (for
example, order `/orders/1002`) and does not check that it belongs to whoever is asking. Changing
the number shows or changes someone else's data. The closest MITRE class is CWE-639; in the OWASP Top
10:2021 it falls under A01 Broken Access Control. In APIs the same bug is called BOLA.

## `authorization` Authorization

`category` web · `see` idor, web-server, privilege-escalation · `lessons` D1, D2

Forms: authorization, authorisation, permission check, permission checks

Checking what a user is allowed to do: open this record, change it, delete it. Not to be confused
with logging in (authentication), which answers “who are you”. The server does it itself on every
request and refuses by default.

## `privilege-escalation` Privilege escalation

`category` web · `see` authorization, idor · `lessons` D2

Forms: privilege escalation, escalation of privilege, elevation of privilege

Gaining rights a user was never given. Vertical: an ordinary user acts as an administrator;
horizontal: a user reaches the data of another user with the same role. A common cause is an
internal address with no server-side permission check. In MITRE these are CWE-269 and CWE-862;
in the OWASP Top 10:2021 it is item A01 Broken Access Control.

## `session-fixation` Session fixation

`category` web · `see` session-cookie, authorization · `lessons` D3

Forms: session fixation

An attack where the attacker imposes a session ID they already know on the victim in advance, for
example with a link carrying that ID. If the site does not issue a new ID after login, the
victim's session ends up in the attacker's hands. In the MITRE catalogue it is CWE-384. The
defence is a new random session ID after login and refusing IDs from the page address.

## `jwt` JWT

`category` web · `see` session-cookie, authorization · `lessons` D4

Forms: JWT, JWTs

JSON Web Token (RFC 7519) — a pass in three parts: header, data and signature, base64url-encoded
and separated by dots. Anyone can read the data; only the signature protects it from changes, so
the server must verify it itself, with an algorithm fixed in advance. A failure to verify the
signature is CWE-347.

## `oauth` OAuth

`category` web · `see` pkce, jwt · `lessons` D5

Forms: OAuth, OAuth 2.0

A protocol (RFC 6749) that lets a site access a user's account on another service without the
user's password. The login service sends the browser back to a registered return address
(`redirect_uri`) with a one-time code, and the site exchanges the code for an access token.
Current security rules are collected in RFC 9700.

## `pkce` PKCE

`category` web · `see` oauth · `lessons` D5

Forms: PKCE

Proof Key for Code Exchange (RFC 7636). At the start of an OAuth login the app makes up a random
secret and sends only its hash; when exchanging the code for a token it shows the secret itself. A
code stolen on the way cannot be exchanged without the secret. RFC 9700 requires PKCE from public
apps and recommends it for the rest.

## `salt` Salt

`category` web · `see` hash, password-hashing · `lessons` F1

Forms: salt, salts, salted

A random string the site adds to a password before hashing, different for every password. The
salt is not secret and is stored next to the hash. Because of it, equal passwords give different
hashes, and tables of hashes computed in advance are useless.

## `password-hashing` Password hashing function

`category` web · `see` hash, salt · `lessons` F1

Forms: password hashing function, password hashing functions, slow hash function, slow hash, slow hashes

A hash function that deliberately spends noticeable time, and sometimes memory, on every hash:
Argon2id, scrypt, bcrypt, PBKDF2. For one login this goes unnoticed, while guessing millions of
passwords against a leaked database becomes very expensive.

## `jndi` JNDI

`category` web · `see` ldap, logging · `lessons` K1

Forms: JNDI

Java Naming and Directory Interface, Java's built-in way to find an object by name in a naming
or directory service: LDAP, DNS, RMI. In vulnerable Log4j versions the `${jndi:…}` lookup in a
log message started such a search at an address sent by the attacker.

## `ldap` LDAP

`category` web · `see` jndi · `lessons` K1

Forms: LDAP

Lightweight Directory Access Protocol, the protocol of directory services where organizations
keep accounts, groups and other records (RFC 4511). Through JNDI a Java program can fetch an
object from a directory, and code along with it.

## `command-injection` OS command injection

`category` web · `see` injection, shell, rce, cwe · `lessons` B2

Forms: OS command injection, command injection

Injection into an operating system command: a program glues a command line together from its own
text and data it received, and hands it to the shell. Characters such as `;`, `&` or `|` in the
input start a second command, and the server runs it with its own rights. The weakness class is
CWE-78; in the OWASP Top 10:2021 it belongs to A03 Injection.

## `shell` Shell

`category` web · `see` command-injection · `lessons` B2

Forms: shell, shells, command shell

A program that reads a command line, splits it into parts and starts programs: `sh` or `bash` on
Linux, `cmd.exe` on Windows. It has a language of its own: `;` separates commands, `|` passes one
program's output to another, `$( )` puts a command's output into the line. So a line built from
someone else's input can mean more to the shell than the program's author intended.

## `path-traversal` Path traversal

`category` web · `see` web-server, cwe · `lessons` B3

Forms: path traversal, directory traversal

An attack on a program that builds a file path from a name it received. `../` in a path means
“the folder above”, and a few such steps lead the path out of the allowed folder to any file the
program may read. The weakness class is CWE-22; in the OWASP Top 10:2021 it belongs to A01 Broken
Access Control.

## `web-root` Web root

`category` web · `see` web-server, web-shell · `lessons` B4

Forms: web root, webroot, document root

The folder on the server from which the web server serves files at the site's addresses: the file
`uploads/a.png` in it opens at `/uploads/a.png`. A server set up for PHP does not send `.php` files
from this folder as they are, it runs them. That is why visitors' files are kept outside the web
root.

## `web-shell` Web shell

`category` web · `see` web-root, rce, mitre-attack · `lessons` B4

Forms: web shell, web shells, webshell

A script an attacker has placed on a web server to control the server with ordinary requests: open
the script's address and the server runs a command and returns the answer. In MITRE ATT&CK it is
sub-technique T1505.003. It often gets onto a server through an unsafe file upload.

## `deserialization` Deserialization

`category` web · `see` gadget-chain, rce, cwe · `lessons` B5

Forms: deserialization, deserializing, deserialize, deserializes, deserialized

Rebuilding a program object from bytes or text; the opposite is serialization. Languages' built-in
formats, such as Java Serializable or Python's pickle, also store the class name, so they can
create an object of any class the program knows. If a visitor sent the data, the visitor chooses
what gets created. The weakness class is CWE-502.

## `gadget-chain` Gadget chain

`category` web · `see` deserialization, rce · `lessons` B5

Forms: gadget chain, gadget chains, gadget, gadgets

A sequence of objects and calls to their methods that runs by itself during deserialization.
Gadgets are classes the program and its libraries already have: the attacker brings no code of
their own, but sends data that lines up those classes in the right order, and the last step may,
for example, start a command. New chains keep being found, so blocking known classes alone is not
enough.

## `template-engine` Template engine

`category` web · `see` ssti, web-server · `lessons` B6

Forms: template engine, template engines

A program that builds text from a blank and data: a site page, an email, a document. In the blank
(the template) special brackets mark the places for data and expressions that the engine
evaluates while building. Well-known template engines are Jinja2, Twig, FreeMarker and Velocity.

## `ssti` SSTI

`category` web · `see` template-engine, injection, rce, cwe · `lessons` B6

Forms: SSTI, template injection, server-side template injection

Server-side template injection. A visitor's input ends up in the template itself rather than in
its data, and the template engine evaluates it as an expression. It often leads to running
commands on the server. The weakness class is CWE-1336.

## `xml-entity` XML entity

`category` web · `see` xxe · `lessons` B7

Forms: XML entity, XML entities, external entity, external entities

A named substitution in an XML document: it is declared at the start of the document, in the DTD,
and the text writes `&name;`, which the parser replaces with the entity's content. An external
entity takes its content from the address written after the word `SYSTEM`: a file or the network.

## `xxe` XXE

`category` web · `see` xml-entity, cwe · `lessons` B7

Forms: XXE

XML External Entity, an attack through external XML entities. The document sent declares an
entity that points to a file on the server or an internal address, and the parser, if allowed,
reads it and puts it into the document. The weakness class is CWE-611; in OWASP Top 10:2021 it
belongs to A05 Security Misconfiguration.

## `nosql-injection` NoSQL injection

`category` web · `see` query-operator, injection, database, cwe · `lessons` B8

Forms: NoSQL injection, NoSQL injections

Injection into a query to a database that does not use SQL, for example a document database such
as MongoDB. Queries there are often built as an object from fields, and if a visitor sends an
object with an operator instead of a string, the condition of the query changes. The weakness
class is CWE-943.

## `query-operator` Query operator

`category` web · `see` nosql-injection, query · `lessons` B8

Forms: query operator, query operators

A keyword in a database query that sets a condition instead of an exact value. In MongoDB
operators start with `$`: `{"$ne": ""}` means “not equal to the empty string”, `$where` is a
check written in JavaScript.

## `open-redirect` Open redirect

`category` web · `see` phishing, oauth, cwe · `lessons` C7

Forms: open redirect, open redirects, open redirector, open redirectors

An address on a site that sends the browser wherever a link parameter says, without checking
where. The link looks like a link to a trusted site but leads to someone else's. The weakness
class is CWE-601.
