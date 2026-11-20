# XXE: XML external entities

`lesson` B7 · `section` B · `wave` 3 · `format` 1

## Passport

- `cwe` 611
- `owasp` A05:2021
- `attack` T1190
- `severity` high
- `impact` Reading server files, requests from the server into the internal network, denial of service
- `defence` The XML parser accepts no DTD and loads no external entities
- `class` Putting someone else's file into an XML document

## Sources

- [OWASP: XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
- [OWASP: XML External Entity (XXE) Processing](https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing)
- [OWASP Top 10:2021, A05 Security Misconfiguration](https://owasp.org/Top10/2021/A05_2021-Security_Misconfiguration/)
- [MITRE CWE-611: Improper Restriction of XML External Entity Reference](https://cwe.mitre.org/data/definitions/611.html)
- [W3C: Extensible Markup Language (XML) 1.0, Fifth Edition](https://www.w3.org/TR/xml/)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Order server** — 198.51.100.10 · `icon:server` · `term:web-server`
- `files` **Server disk** — /etc · `icon:document`

## Zones

- `internet` Internet: `attacker`
- `site` Warehouse store.example: `server`, `files` · `term:trust-boundary`

## Steps

### `order` An order in XML

`attacker → server` · `legit`
Message: XML order · Result: “Item 17 added”

```xml
<order>
  <item>17</item>
</order>
```

#### Simple

A wholesale warehouse takes orders from partner shops as **XML documents**. The attacker has signed
up as a partner and sends an ordinary order: item number 17.

#### Step by step

The server reads the document with a parser program, finds the item number and answers: “Item 17
added”. In its answer it repeats what it read from the document.

#### Deeper

XML is an old and very common format: SOAP services, Office files, SVG and many integrations
between companies run on it. XML parsers can do far more than an order needs, and some of those
abilities are on by default.

### `doctype` A document with an entity

`attacker → server` · `attack`
Message: XML with DOCTYPE and an entity · Result: accepted for parsing

```xml
<!DOCTYPE order [
  ⟦<!ENTITY x SYSTEM "file:///etc/passwd">⟧
]>
<order><item>&x;</item></order>
```

#### Simple

The attacker adds **a declaration** at the top of the document: “let the word `x` stand for the
contents of the file `/etc/passwd`”. And in the item number they write `&x;`, “put `x` here”.

#### Step by step

The `DOCTYPE` line opens the document type definition (DTD). It declares the entity `x`, a named
substitution. The word `SYSTEM` means its content lives outside, at the address after it. Here the
address is a file on the server's disk.

#### Deeper

External entities are part of the XML 1.0 standard itself (section 4.2.2): the content is taken
from a system identifier, a URI. OWASP notes that instead of a file there can be an `http` address
in the internal network: then the server itself goes where the attacker cannot reach.

### `resolve` The parser reads the file

`server → files` · `attack` · `without-defence`
Message: read /etc/passwd · Result: attack

```text
&x;  →  ⟦file:///etc/passwd⟧
```

#### Simple

The parser obediently **opens the file** on the server's disk and puts its contents where `&x;` was.
It does this before the order program even sees the document.

#### Step by step

The parser reads the file with the warehouse program's rights. Anything the program may read can be
substituted: settings, keys, source code.

#### Deeper

This is weakness CWE-611: the program parses an XML document whose entities lead to resources
outside what it is meant to touch. In OWASP Top 10:2021 this class belongs to A05 Security
Misconfiguration: what is dangerous is the parser's configuration, not the order code.

### `echo` The file in the answer

`server → attacker` · `attack` · `without-defence`
Message: “Item root:x:0:0... not found” · Result: the file is with the attacker

```text
Item “⟦root:x:0:0:root:/root:/bin/sh ...⟧” not found
```

#### Simple

The item number is now **the whole file**. The server finds no such item and honestly repeats in
the error what it read. The attacker has a file from the server.

#### Step by step

On Linux `/etc/passwd` is the list of system accounts. It is not secret, but it shows the attack
works. Next the attacker will ask for files with database passwords or keys.

#### Deeper

The attack works even without such a convenient answer. OWASP notes that the application does not
have to return the file: data can be sent out with a request to the attacker's server, for example
through names in DNS. This variant is called blind XXE. And an entity that points to a resource
that never ends can keep the parser busy for a long time, which is a denial of service.

### `reject` No DOCTYPE allowed

`server → server` · `attack` · `with-defence` · `stopped`
Message: document with DOCTYPE · Result: rejected, the attack failed

```text
parser: DOCTYPE not accepted → ⟦<!DOCTYPE order [...]>⟧ rejected
```

#### Simple

With the defence on, the parser is set up to **accept no document type definition** at all. An
order does not need a DTD. A document with `DOCTYPE` is rejected as a whole, and nobody reads the
file. The attack stops here.

#### Step by step

The parser sees the `DOCTYPE` line at the top and stops parsing with an error at once. It never
gets to the entity `x` or to the disk.

#### Deeper

This is OWASP's first advice: disable DTDs where possible and reject `DOCTYPE`. If DTDs are needed,
disable external entities and loading of external DTDs, and limit entity expansion. Each parser
has its own settings. For example, in Java the parser factory gets the `disallow-doctype-decl`
feature turned on, and the libxml2 library does not substitute entities by default since version
2.9.

### `refuse` Parse error

`server → attacker` · `safe` · `with-defence`
Message: 400 DOCTYPE not allowed · Result: the attack failed

```http
HTTP/1.1 400 Bad Request
```

#### Simple

The attacker gets a short refusal. There is not a single line from the server's files in it.

#### Step by step

Ordinary orders without `DOCTYPE` go through as before: partners do not need to change anything.

#### Deeper

OWASP advises treating an unsupported protective setting as a failure: if the parser cannot apply
the restriction, do not parse untrusted XML half-protected. And do not forget XInclude, schemas
and XSLT style sheets: they can load external resources too.

## How to defend

- **No DTD.** Set the parser to reject `DOCTYPE` if your data format does not need a document type
  definition. Usually it does not.
- **No external entities.** If DTDs are needed, disable external entities and loading of external
  DTDs, and limit entity expansion.
- **Every parser separately.** Settings and defaults differ between libraries; check every place
  that parses XML, including schemas, XInclude and XSLT.
- **Updates.** Keep XML libraries current: newer versions often switch the dangerous parts off by
  default.
- **A simpler format where possible.** Where XML is not required, plain data is easier to pass as
  JSON.
