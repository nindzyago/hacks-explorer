# Shellshock (CVE-2014-6271)

`lesson` K4 · `section` K · `wave` 3 · `format` 1

## Passport

- `cwe` 78
- `owasp` A03:2021, A06:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
- `cves` CVE-2014-6271
- `severity` critical
- `impact` Running commands on the server through a request header, with no password
- `defence` Update Bash and do not run it from the web server
- `class` Command injection through an environment variable

## Sources

- [NVD: CVE-2014-6271](https://nvd.nist.gov/vuln/detail/CVE-2014-6271)
- [NVD: CVE-2014-7169](https://nvd.nist.gov/vuln/detail/CVE-2014-7169)
- [CISA TA14-268A: GNU Bourne-Again Shell (Bash) Shellshock Vulnerability](https://www.cisa.gov/news-events/alerts/2014/09/25/gnu-bourne-again-shell-bash-shellshock-vulnerability-cve-2014-6271-cve-2014-7169-cve-2014-7186-cve)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [RFC 3875: The Common Gateway Interface (CGI) Version 1.1](https://www.rfc-editor.org/rfc/rfc3875)
- [MITRE CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [OWASP Top 10:2021, A06 Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — 198.51.100.10 · `term:web-server`
- `bash` **Bash** — status.cgi · `icon:document` · `term:cgi`

## Zones

- `internet` Internet: `attacker`
- `site` Site status.example: `server`, `bash` · `term:trust-boundary`

## Steps

### `header` A header with a tail

`attacker → server` · `attack`
Message: GET /status · Result: accepted as a normal request

```http
GET /cgi-bin/status.cgi
User-Agent: () { :;}; ⟦echo hacked⟧
```

#### Simple

The site has an old status page made by a small script. The attacker opens it, but in the field
where the browser names itself they write an **odd string**: brackets, curly braces, a semicolon
and a command at the end.

#### Step by step

The request is ordinary: open `/cgi-bin/status.cgi`. The trick is in the `User-Agent` header. The
start of the string looks like the definition of an empty function, and a command follows it. The
server has no interest in this header and does not check it.

#### Deeper

The string can go into any header that the server passes to the script: `User-Agent`, `Cookie`,
`Referer`. No sign-in and no human action are needed, hence `PR:N` and `UI:N` in the CVSS vector.
It is a common probe: the response shows whether the command in the tail ran.

### `env` The header becomes a variable

`server → bash` · `attack` · `without-defence`
Message: run script · Result: header in a variable

```text
HTTP_USER_AGENT=() { :;}; ⟦echo hacked⟧
```

#### Simple

To answer, the server **starts the script** and hands it the request data. It puts each header
into its own **environment variable**: that is how the old CGI way of running scripts works.

#### Step by step

The `User-Agent` header turns into the variable `HTTP_USER_AGENT` with the same value, character
for character. The script is written for Bash, so the server starts Bash and gives it all the
variables.

#### Deeper

The rule is set by RFC 3875 (CGI 1.1), section 4.1.18: the header name is converted to upper
case, hyphens are replaced with underscores and `HTTP_` is put in front. So whoever sent the
request chooses the whole content of the variable. That alone is not a bug: a variable is just
text. The trouble is what Bash did with that text.

### `parse` Bash runs the tail

`bash → bash` · `attack` · `without-defence`
Message: reading variables · Result: the command in the tail ran

```text
() { :;};      ← looks like a function: Bash "imports" it
⟦echo hacked⟧    ← the tail: Bash runs it too
```

#### Simple

At start Bash looks through its variables. A value that looks like a **function** it takes as a
function and parses. But a bug made Bash parse and run **everything after** the function as well.
The attacker's command fires before the script even begins.

#### Step by step

Bash can pass functions to child processes through environment variables. When it saw a value
starting with `() {`, it read it as a function definition. The function ended at `}`, but parsing
carried on, and the commands after it ran at once.

#### Deeper

NVD: GNU Bash through 4.3 processes trailing strings after function definitions in the values of
environment variables, which lets an attacker run their own code. The weakness class is CWE-78,
OS command injection. CISA alert TA14-268A names versions 1.14 through 4.3 as affected: the bug
lived in Bash across many versions. The fix was incomplete: what remained got its own number,
CVE-2014-7169, and others followed. CISA advised installing all the fixes for the six numbers of
this group.

### `run` The attacker's commands on the server

`bash → attacker` · `attack` · `without-defence`
Message: reverse connection · Result: server under control

#### Simple

Instead of a harmless `echo`, the attacker could write any command. It runs **with the web
server's rights**: for example, it opens a line to the attacker, and the server itself waits for
their commands.

#### Step by step

The attacker gets a command line on the server. They read the site's files, install their own
programs, look for passwords and a way into the internal network.

#### Deeper

The NVD base score is 9.8 out of 10 under CVSS 3.1: a network attack, simple, with no privileges
and no human involved, and confidentiality, integrity and availability all suffer. CISA named
other paths to the same bug: bypassing `ForceCommand` in OpenSSH, and DHCP clients. In ATT&CK this
is technique T1190, exploiting an internet-facing application. CISA added CVE-2014-6271 to the
KEV catalog on 28 January 2022, more than seven years after the fix came out.

### `patched` An updated Bash

`server → bash` · `attack` · `with-defence` · `stopped`
Message: run script · Result: the tail did not run, the attack failed

```text
HTTP_USER_AGENT=() { :;}; ⟦echo hacked⟧
```

#### Simple

Same variable, but Bash is **updated**. It no longer runs what comes after a function, and it does
not treat someone else's string in an ordinary variable as a function.

#### Step by step

The script starts and gets the variable `HTTP_USER_AGENT` as plain text. The command in the tail
does not run. The script does its job: it gathers the server's status.

#### Deeper

The first fix did not close everything: the rest of the bug got the number CVE-2014-7169, so
people had to update more than once. But the main lesson is wider: Bash is not needed where a
server starts programs for requests from the internet. A site without Bash CGI scripts is not
exposed to this attack at all.

### `output` The script's normal output

`bash → server` · `safe` · `with-defence`
Message: status: OK · Result: page built

#### Simple

The script gives the server what it was started for: a short summary of the site's status.

#### Step by step

The server takes the script's output and turns it into a page. The string from the header had no
effect.

#### Deeper

The server log keeps the request with `() {` in a header. Such lines show who tried the attack and
when, even if it failed.

### `answer` The attacker sees a normal page

`server → attacker` · `safe` · `with-defence`
Message: 200 OK · Result: the attack failed

#### Simple

The attacker gets the ordinary status page, like any visitor. Their command did not work.

#### Step by step

The response is the same as for a request without the odd header. The server stays under its
owner's control.

#### Deeper

Shellshock shows why old code is dangerous: the bug had been in Bash since version 1.14, and old
CGI scripts and rarely updated devices keep running for years. An update closes the hole only
where it is installed: this bug reached KEV as late as 2022.

## How to defend

- **Update Bash.** The main defence: install the fixed version from your system's updates. The
  first fix alone is not enough: you need all the fixes for this group of bugs.
- **Know where it is.** Bash ships with Linux, macOS and many other UNIX-like systems, including
  inside devices. Make a list of systems and ask vendors about updates.
- **Do not start a shell for internet requests.** Do not write CGI scripts in Bash and do not call
  a shell from a web application. The fewer programs see request data, the smaller the attack
  surface.
- **Do not trust headers.** Everything a visitor sent, headers included, is data, not commands.
- **Look for traces.** Lines with `() {` in server logs show attack attempts; signs of a successful
  break-in must be checked separately.
