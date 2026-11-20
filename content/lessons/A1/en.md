# Vulnerability, exploit, patch

`lesson` A1 · `section` A · `wave` 1 · `format` 1

## Passport

- `cwe` 22
- `owasp` A06:2021
- `attack` T1190
- `severity` high
- `impact` Reading other files on a server that was not updated
- `defence` Install updates on time
- `class` Attack on a known but unfixed vulnerability

## Sources

- [CVE Program: Glossary](https://www.cve.org/ResourcesSupport/Glossary)
- [CVE Program: Process](https://www.cve.org/About/Process)
- [NIST CSRC Glossary: zero-day attack](https://csrc.nist.gov/glossary/term/zero_day_attack)
- [NIST CSRC Glossary: patch](https://csrc.nist.gov/glossary/term/patch)
- [CISA: Coordinated Vulnerability Disclosure Program](https://www.cisa.gov/coordinated-vulnerability-disclosure-process)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [OWASP Top 10:2021, A06 Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)
- [MITRE CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `finder` **Researcher** — looks for bugs · `icon:user`
- `vendor` **Developer** — Docs 2.3 · `icon:workstation`
- `server` **Server** — 198.51.100.10 · `term:web-server`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`

## Zones

- `site` Site docs.example: `server`

## Steps

### `report` The finding

`finder → vendor` · `safe`
Message: bug report · Result: accepted

```http
GET /download?file=⟦../../config⟧
```

#### Simple

A web app called «Docs» serves files by name. A researcher noticed that it also serves **other**
files if the name contains `../`. This is a bug in the code that can be used to cause harm: a
**vulnerability**. They write to the developer, not to the internet.

#### Step by step

The string `../` means «one folder up». The app was supposed to serve files only from the
documents folder, but it did not check the name. The researcher tells the developer what is
broken, in which version, and how to see it. Until there is a fix, both stay quiet.

#### Deeper

The CVE Program defines a vulnerability as an instance of one or more weaknesses in a product that
can be exploited to harm confidentiality, integrity or availability. This bug's class is CWE-22,
escaping the allowed folder. «Vendor first, everyone else later» is called **coordinated
disclosure**. CISA runs such a program and says that if a vendor does not respond or will not
set a reasonable timeframe, it may publish even without a fix, as early as 45 days after the
first attempt to contact the vendor.

### `release` Fix and number

`vendor → server` · `legit`
Message: version 2.4 · Result: released

#### Simple

The developer fixes the bug and ships a new version: a **patch**. An advisory comes with it: what
was wrong and which version fixes it. The bug gets a CVE number.

#### Step by step

The advisory names the affected versions (up to and including 2.3) and the fixed one (2.4). Server
owners read it, and so do attackers: now everyone knows where to look.

#### Deeper

A CVE number is assigned by a CVE Program partner, often the vendor itself if it is a CNA. A CVE
record holds at least the number, a description, affected products and versions, and references.
NIST describes a patch as a «repair job» for a program, the immediate fix handed to users. But
until the patch is installed, the server is open to attack just as it was yesterday.

### `ignored` Update postponed

`server → server` · `legit` · `without-defence`
Message: later · Result: still 2.3

#### Simple

The site owner does not install the update: «if it works, don't touch it». The server keeps a
**known** hole.

#### Step by step

Version 2.3 still serves other files. The difference from before is that this is now written up
in public.

#### Deeper

Such a vulnerability is called n-day: it is known and a fix exists, but it is not installed. A
zero-day (0-day) is different: the vendor does not know about it yet, so there is no patch. In the
OWASP Top 10:2021 outdated components are item A06.

### `updated` Update installed

`server → server` · `safe` · `with-defence`
Message: version 2.4 · Result: installed

#### Simple

The site owner read the advisory and **updated** the app the same day.

#### Step by step

The new version first turns the file name into a full path and serves it only if that path lies
inside the documents folder.

#### Deeper

Not to miss an advisory, you need a list of everything that runs on the server, with versions.
CISA keeps the KEV catalog of vulnerabilities already used in attacks: if a bug is there, fix it
first.

### `exploit` The exploit

`attacker → server` · `attack`
Message: ../.. · Result: accepted

```http
GET /download?file=⟦../../config⟧
```

#### Simple

The attacker read the advisory and made an **exploit**: a request that uses the vulnerability.
They send it to every site running «Docs».

#### Step by step

The request is the same one the researcher found. The attacker needs no login: the server is open
to the internet. They try hundreds of addresses and wait for answers.

#### Deeper

An exploit is code or a technique that turns a vulnerability into a result for the attacker. A
public advisory often shortens the way to one: the fix shows where the bug was. In ATT&CK this is
T1190, exploiting an internet-facing application.

### `leak` Someone else's file

`server → attacker` · `attack` · `without-defence`
Message: config file · Result: leaked

#### Simple

The old server hands the attacker a settings file with passwords. The hole is a week old; the fix
has been out the whole time.

#### Step by step

The settings file holds the database password. With it, the attacker goes further.

#### Deeper

Many break-ins come not through unknown bugs but through long-fixed ones. So what matters is not
only how strong the defence is, but how fast updates go in.

### `blocked` Path outside the folder

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: ../.. · Result: refused

```http
GET /download?file=⟦../../config⟧
```

#### Simple

The same request reaches the **updated** server. Version 2.4 sees that the file lies outside the
documents folder and refuses.

#### Step by step

The server answers «404 not found» and writes the attempt to its log. The exploit no longer works.

#### Deeper

A patch closes one bug. A second line is permissions: if the site's app cannot read the settings
file, even a new similar bug will not give it away.

## How to defend

- **Update on time.** The main defence against known vulnerabilities is to install the patch.
  Internet-facing servers and bugs from the KEV catalog first.
- **Know what you run.** A list of programs and libraries with versions tells you in minutes
  whether a new advisory concerns you.
- **Follow advisories.** Subscribe to vendor notices and look up your products in CVE records.
- **Remove what you don't need.** The fewer programs and internet-facing pages, the fewer places
  for a new bug.
- **Give programs few rights.** Then a bug in one of them gives the attacker less.
- **Accept reports.** Give researchers a clear way to report a bug privately.
