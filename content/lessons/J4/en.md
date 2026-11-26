# Slopsquatting

`lesson` J4 · `section` J · `wave` 1 · `format` 1

## Passport

- `cwe` 829
- `owasp` LLM09:2025, LLM03:2025
- `attack` T1195.001
- `severity` high
- `impact` The attacker's code runs on a developer's machine and travels on into the project
- `defence` Install packages only from a vetted list and check every new dependency
- `class` Registering a package under a name an AI made up

## Sources

- [OWASP Top 10 for LLM Applications 2025: LLM09 Misinformation](https://genai.owasp.org/llmrisk/llm092025-misinformation/)
- [OWASP Top 10 for LLM Applications 2025: LLM03 Supply Chain](https://genai.owasp.org/llmrisk/llm032025-supply-chain/)
- [MITRE ATT&CK T1195.001: Compromise Software Dependencies and Development Tools](https://attack.mitre.org/techniques/T1195/001/)
- [MITRE CWE-829: Inclusion of Functionality from Untrusted Control Sphere](https://cwe.mitre.org/data/definitions/829.html)

## Participants

- `assistant` **Assistant** — AI for code · `icon:assistant` · `term:llm`
- `dev` **Developer** — 192.0.2.40 · `icon:workstation` · `term:victim`
- `registry` **Registry** — pypi.example · `icon:server` · `term:package-registry`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`

## Zones

- `company` Company: `dev`
- `internet` Internet: `registry`, `attacker`

## Steps

### `probe` Scouting

`attacker → assistant` · `attack`
Message: questions · Result: a made-up name found

```text
"How do I merge two PDFs in Python?" → pip install ⟦pdfmerge-easykit⟧
```

#### Simple

The attacker asks AI coding assistants **hundreds of ordinary questions** and watches which
libraries they recommend. Sometimes an assistant confidently names a package that **does not
exist**.

#### Step by step

The attacker looks up every name in the package registry. There is no `pdfmerge-easykit` there,
yet the assistant suggests it again and again. That is the name the attacker remembers.

#### Deeper

A model continues text in the most likely way. A name like "PDF merge + easy + kit" sounds
plausible even though no such package exists. OWASP calls such inventions hallucinations, and
LLM09:2025 "Misinformation" describes this very scenario: attackers look for names that assistants
often make up and publish malicious packages under them.

### `register` A trap package

`attacker → registry` · `attack`
Message: package · Result: published

```text
pdfmerge-easykit 1.0.0
  merges PDFs ✓
  on install: ⟦download and run code from evil.example⟧
```

#### Simple

The attacker **registers that name** in a public registry and uploads a package. The package even
does what it promises and merges PDFs. But on install it also runs the attacker's code.

#### Step by step

In a public registry any registered user can publish a package. The name is free, so it can be
taken.

#### Deeper

The trick resembles typosquatting, except that no human mistypes anything: the model makes the
mistake, and the human trusts it. The name slopsquatting is built on the pattern of typosquatting.
MITRE ATT&CK describes tampering with dependencies as T1195.001, and notes there that installing
Python and npm packages can run scripts such as `setup.py` or `postinstall` right away.

### `ask` A question for the assistant

`dev → assistant` · `legit`
Message: question · Result: accepted

```text
How do I merge two PDFs in Python?
```

#### Simple

A developer at a company is writing a program and asks the assistant how to merge two PDF files.
An ordinary work request.

#### Step by step

The developer knows nothing about the attacker or the trap package. They just want to save time.

#### Deeper

The model does not know which packages exist right now: it remembers what it saw in training and
fills the gaps with plausible text. So the same question can lead to the same made-up name again.

### `advice` Confident advice

`assistant → dev` · `attack`
Message: advice · Result: name made up

```text
Install the package: pip install ⟦pdfmerge-easykit⟧
```

#### Simple

The assistant answers confidently, with sample code. The answer contains that very **made-up
name**.

#### Step by step

The answer looks like any other useful tip: an install command and a couple of lines of code.
Nothing says that the package appeared in the registry only yesterday and that its author is the
attacker.

#### Deeper

Advice alone does no harm yet: the harm starts when someone follows it without checking. In
LLM09:2025 OWASP advises cross-checking model answers against trusted sources and training people
not to rely on them blindly.

### `install` Installing

`dev → registry` · `attack` · `without-defence`
Message: install · Result: package found

```text
$ pip install ⟦pdfmerge-easykit⟧
```

#### Simple

The developer copies the command from the answer and installs the package. It is in the registry:
the attacker put it there in advance.

#### Step by step

The package manager downloads the latest version and installs it with its dependencies. Nobody
asks who the author is or how long the package has existed.

#### Deeper

Had the package not existed, the install would simply have failed and the developer would have
looked for another library. The attacker caught exactly the moment when a person trusts the model
more than the registry.

### `run` The attacker's code

`registry → dev` · `attack` · `without-defence`
Message: package · Result: code running

```text
installing pdfmerge-easykit: ⟦connecting to evil.example⟧
```

#### Simple

The package is installed, and its install script **ran the attacker's code** on the developer's
machine. PDF merging works, so the catch goes unnoticed.

#### Step by step

The code runs with the developer's rights: it can read keys and passwords on their machine, and
the package, once listed in the project's dependencies, travels on to the build server and to
colleagues.

#### Deeper

CWE-829 describes exactly this weakness: a program brings in working code from a source outside
its sphere of trust. Developers are an attractive target: they have access to source code, keys
and the build system.

### `allowlist` Vetted packages only

`dev → registry` · `attack` · `with-defence` · `stopped`
Message: install · Result: not on the list, stopped

```text
$ pip install pdfmerge-easykit
⟦not in the internal registry: needs review⟧
```

#### Simple

The company installs packages **only from its own registry** of vetted libraries. The new package
is not there, so the install stops. To add a package, someone has to check it first.

#### Step by step

The check is quick: the package was created yesterday, its author has no other packages, and it
goes online during install. A package like that does not make the list.

#### Deeper

Among the mitigations for T1195.001, MITRE ATT&CK lists installing packages from internal
repositories of verified packages and locking dependencies to exact versions. A lock file adds
one more line of defence: a new dependency shows up in the project's changes, and a second person
reviews it.

### `known` A well-known library

`dev → dev` · `safe` · `with-defence`
Message: another library · Result: job done

#### Simple

The developer picks a well-known library from the company's list. The PDFs are merged and no
stranger's code ran.

#### Step by step

Before installing, the developer opens the package's page: how long it has existed, who the author
is, whether the project has a site and a history of changes.

#### Deeper

AI suggestions are useful, but a package name from a model's answer is unchecked data, like a link
in an email from a stranger. OWASP advises cross-checking model answers and keeping secure coding
practices so that wrong advice does not end up in the code.

## How to defend

- **Install packages from your own registry.** An internal registry or a list of allowed packages
  will not let through a name the model made up.
- **Check every new dependency.** How many days old the package is, who the author is, how many
  downloads it has, whether the project has a history. A new package with the exact name from an
  AI answer is a reason to be careful.
- **Pin versions.** A lock file records exact versions, and a new dependency shows up in the
  changes and gets reviewed.
- **Don't run commands from answers blindly.** AI advice is a draft, not a checked fact.
- **Limit install scripts.** Install new packages in a separate environment with no access to the
  developer's keys and passwords.
- **Teach the team.** Developers should know that models make up package names and that attackers
  use this.
