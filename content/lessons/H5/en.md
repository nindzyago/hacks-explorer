# Supply chain attacks

`lesson` H5 · `section` H · `wave` 1 · `format` 1

## Passport

- `cwe` 506
- `owasp` A08:2021
- `attack` T1195, T1195.002
- `severity` critical
- `impact` A backdoor reaches every customer of the vendor inside a signed update
- `defence` Hardened, reproducible builds
- `class` Compromise of a software vendor

## Sources

- [MITRE ATT&CK T1195: Supply Chain Compromise](https://attack.mitre.org/techniques/T1195/)
- [MITRE ATT&CK T1195.002: Compromise Software Supply Chain](https://attack.mitre.org/techniques/T1195/002/)
- [OWASP Top 10:2021 A08: Software and Data Integrity Failures](https://owasp.org/Top10/2021/A08_2021-Software_and_Data_Integrity_Failures/)
- [MITRE CWE-506: Embedded Malicious Code](https://cwe.mitre.org/data/definitions/506.html)
- [NIST SP 800-218: Secure Software Development Framework (SSDF) Version 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
- [NSA, ODNI, CISA: Securing the Software Supply Chain: Recommended Practices for Developers](https://www.cisa.gov/sites/default/files/publications/ESF_SECURING_THE_SOFTWARE_SUPPLY_CHAIN_DEVELOPERS.PDF)
- [CISA: Software Bill of Materials (SBOM)](https://www.cisa.gov/sbom)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `build` **Build** — 198.51.100.5 · `icon:server` · `term:build-server`
- `update` **Updates** — 198.51.100.6 · `icon:server`
- `client` **Customer** — 192.0.2.40 · `icon:workstation` · `term:victim`

## Zones

- `internet` Internet: `attacker`
- `vendor` Vendor: `build`, `update` · `term:supply-chain-attack`
- `customer` Customer: `client`

## Steps

### `commit` Honest source code

`build → build` · `legit` · `icon:document`
Message: code 2.4.1 · Result: build started

```text
commit 4f2a9c  "Version 2.4.1: fixes"
```

#### Simple

A vendor makes a program used by thousands of companies. Developers write **code**, and a build
server turns it into the finished program for customers.

#### Step by step

The code lives in a repository. When a version is ready, the build server takes the code, builds
the program from it and hands it on to the update server.

#### Deeper

A program's supply chain is everything it passes through before it reaches the customer: the
code, third-party libraries, the build server, the signature, the update server. A weak link
anywhere in the chain endangers everyone after it.

### `breach` Breaking into the build server

`attacker → build` · `attack`
Message: login to the build server · Result: access gained

```text
login: ⟦build service account⟧
```

#### Simple

The attacker is not aiming at the customers but at the **vendor**. They get into the build
server, the place where the program for everyone is made.

#### Step by step

The way in is ordinary: a stolen password, a vulnerability or a phished employee. What matters is
where they landed: the build server can change what every customer receives.

#### Deeper

In MITRE ATT&CK this is technique T1195, Supply Chain Compromise, and for software,
sub-technique T1195.002, Compromise Software Supply Chain: tampering with source code, the update
mechanism or compiled releases before the user receives them. By breaking into one vendor the
attacker gets a path into many organisations at once.

### `inject` A backdoor added during the build

`build → build` · `attack`
Message: backdoor added · Result: program altered

```text
source code         unchanged
built program       + ⟦hidden module that talks to 203.0.113.66⟧
```

#### Simple

The attacker does not touch the code in the repository: it stays clean. They change the build
process instead, and a **backdoor**, a hidden part the vendor knows nothing about, ends up in the
finished program.

#### Step by step

Developers review the code, but nobody checks that the built program was made from exactly that
code. The backdoor exists only in the build output, so code review cannot see it.

#### Deeper

Harmful code hidden inside a program is CWE-506, Embedded Malicious Code, in the CWE catalogue.
OWASP files such attacks under A08:2021, Software and Data Integrity Failures: an insecure build
and delivery pipeline lets malicious code into the software.

### `sign` A signed release

`build → update` · `attack` · `without-defence`
Message: signed · Result: release published

```text
file:      app-2.4.1.pkg
signature: vendor.example  ⟦valid⟧
```

#### Simple

The build server signs the program with the vendor's key. The **signature** is genuine: the
vendor really did sign it, only the program already contains the backdoor.

#### Step by step

A signature proves who signed a file and that it has not changed since. It says nothing about
what was in the file before signing. The backdoor went in earlier, and the signature made it look
legitimate.

#### Deeper

OWASP Top 10 2021 describes a well-known case: the vendor had secure build and update integrity
processes, yet they were subverted, and for several months it shipped an update with a backdoor
to more than 18,000 organisations, of which around a hundred were affected. A signature protects
the path from vendor to customer, not the build itself.

### `install` The update at the customer

`update → client` · `attack` · `without-defence`
Message: 2.4.1 · Result: installed

#### Simple

The customer's computer checks the signature, sees it is valid and installs the update. The
customer did everything right and still got the backdoor.

#### Step by step

Auto-update is convenient and usually helpful: it closes vulnerabilities quickly. Here the same
mechanism delivers the backdoor to thousands of customers in a single day.

#### Deeper

The customer trusts the vendor, and that trust is exactly what the attack targets. Checking the
signature on the customer side is necessary (without it anyone on the way could swap the update),
but it does not help against a backdoor added at the vendor itself.

### `callback` The backdoor phones home

`client → attacker` · `attack` · `without-defence`
Message: beacon · Result: access to the company

```text
HTTPS → 203.0.113.66  ⟦"licence check"⟧
```

#### Simple

The backdoor quietly connects to the attacker's server. The attacker now has a way into the
customer's network, although nobody ever broke into the customer.

#### Step by step

The connection is disguised as the program's normal traffic. Out of thousands of customers the
attacker can pick only the interesting ones and continue there.

#### Deeper

MITRE ATT&CK notes that an attacker may distribute altered software widely and pursue further
actions only against selected victims. That makes detection harder: at most customers the
backdoor simply stays silent.

### `rebuild` Checking against an independent build

`build → update` · `attack` · `with-defence` · `stopped`
Message: 2.4.1 · Result: stopped

```text
build A (build server)       sha256: 9c1e…
build B (separate machine)   sha256: 47d0…
⟦mismatch⟧ → release blocked
```

#### Simple

Now the program is built twice, on different machines, from the same code. The update server
compares the results. They do not match, and the release does not go out to customers.

#### Step by step

The build is **reproducible**: the same code always gives a file that is identical down to the
bit. The attacker altered only one build, so its fingerprint differs from the other one.

#### Deeper

The 2022 developer guide from NSA, ODNI and CISA calls reproducible builds additional protection
against attempts to compromise build systems: re-running the build with identical inputs gives
bit-for-bit identical output. NIST SSDF (practice PO.5) asks for secure software development
environments, and task PS.3.2 for collecting and sharing provenance data for every component of
a release.

### `clean` The customer gets a verified release

`update → client` · `safe` · `with-defence`
Message: 2.4.2 · Result: installed

```text
builds A and B match · signature valid · SBOM attached
```

#### Simple

The vendor cleans the build server and builds the version again, and both builds match. Only such
a release is signed and sent to customers.

#### Step by step

The signing key is kept away from the build server, and signing happens only after the check. The
release comes with an **SBOM**, a list of every component in the program.

#### Deeper

CISA defines an SBOM as a nested inventory, a list of the ingredients that make up software. It
does not catch a backdoor by itself, but it helps a customer see quickly whether they are
affected when a problem is found in some component.

## How to defend

For the vendor:

- **Protect the build server** as your most valuable system: separate network, minimal access, a
  second factor, logs.
- **Compare builds.** A reproducible build on a second, independent machine catches tampering on
  the build server.
- **Sign only what has been checked.** Keep the signing key away from the build server.
- **Review code and pipeline settings.** Every change to the build is checked by a second person.
- **Publish an SBOM and provenance data for each release.**

For the customer:

- **Verify update signatures**: this stops tampering on the way.
- **Give programs only the rights and network access they need.** A backdoor in a program with no
  route to the internet cannot reach the attacker.
- **Watch for unexpected connections**, even from trusted programs.
