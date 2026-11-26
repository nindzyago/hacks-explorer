# The xz backdoor (CVE-2024-3094)

`lesson` K7 · `section` K · `wave` 3 · `format` 1

## Passport

- `cwe` 506
- `owasp` A08:2021
- `attack` T1195, T1195.001
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
- `cves` CVE-2024-3094
- `severity` critical
- `impact` A backdoor in a compression library that, through it, tampers with SSH sign-in on servers
- `defence` Build packages from verified source and compare the release archive with the repository
- `class` A backdoor in an open source library from a contributor the project trusted

## Sources

- [NVD: CVE-2024-3094](https://nvd.nist.gov/vuln/detail/CVE-2024-3094)
- [CISA: Reported Supply Chain Compromise Affecting XZ Utils Data Compression Library, CVE-2024-3094](https://www.cisa.gov/news-events/alerts/2024/03/29/reported-supply-chain-compromise-affecting-xz-utils-data-compression-library-cve-2024-3094)
- [CISA: Lessons from XZ Utils: Achieving a More Sustainable Open Source Ecosystem](https://www.cisa.gov/news-events/news/lessons-xz-utils-achieving-more-sustainable-open-source-ecosystem)
- [oss-security: backdoor in upstream xz/liblzma leading to ssh server compromise](https://www.openwall.com/lists/oss-security/2024/03/29/4)
- [MITRE ATT&CK T1195.001: Compromise Software Dependencies and Development Tools](https://attack.mitre.org/techniques/T1195/001/)
- [MITRE CWE-506: Embedded Malicious Code](https://cwe.mitre.org/data/definitions/506.html)
- [OWASP Top 10:2021 A08: Software and Data Integrity Failures](https://owasp.org/Top10/2021/A08_2021-Software_and_Data_Integrity_Failures/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `maint` **Project** — xz · `icon:user` · `term:maintainer`
- `build` **Build** — 198.51.100.7 · `icon:server` · `term:build-server`
- `server` **Server** — 192.0.2.40 · `icon:server` · `term:ssh`

## Zones

- `internet` Internet: `attacker`
- `oss` Open source project: `maint` · `term:supply-chain-attack`
- `distro` Distribution and its users: `build`, `server`

## Steps

### `trust` Years of helping the project

`attacker → maint` · `attack`
Message: help and patches · Result: access to the code

#### Simple

**xz** is a small compression program and library that ships with many Linux distributions. One
person runs the project. A contributor shows up and helps: sends fixes, joins the discussions.
Over time they **gain trust**.

#### Step by step

The maintainer is tired, and here is someone taking part of the work off their hands. The new
contributor gets the right to make changes directly in the project's code.

#### Deeper

CISA calls it a multi-year effort by a malicious actor to gain the trust of the package's
maintainer. CISA also sees in this story the fragility of the open source ecosystem: the burden of
security fell on a single maintainer suffering from burnout. In ATT&CK this path is T1195.001,
compromise of software dependencies and development tools.

### `tests` "Test" files

`attacker → maint` · `attack`
Message: test files · Result: in the repository

```text
tests/files/⟦bad-3-corrupt_lzma2.xz⟧
tests/files/⟦good-large_compressed.lzma⟧
```

#### Simple

The contributor adds a couple of files supposedly **for tests**: broken archives used to check how
the library copes with errors. Nobody looks for code in such files.

#### Step by step

Inside the files is an obfuscated part of the backdoor. On their own they do nothing: they just
sit among hundreds of other test data files.

#### Deeper

According to the oss-security report, the bulk of the backdoor sat in these two files in
obfuscated form, and in version 5.6.0 no test even used them. NVD: the liblzma build process
extracts a prebuilt object file from a disguised test file and uses it to modify functions in the
library. Malicious code embedded in a program is CWE-506.

### `release` A release archive with an extra line

`attacker → build` · `attack` · `without-defence`
Message: archive · Result: accepted as a normal release

```text
m4/build-to-host.m4:  ⟦a line that is not in git⟧
```

#### Simple

A new xz version comes out. Linux distributions build from the **release archive**. It contains one
extra line that is not in the project's public repository. Nobody compares them.

#### Step by step

A release archive is usually made from the repository plus helper files for the build. The
attacker hid the trigger for the backdoor in just such a helper file: it is not visible in the
code on the project's site.

#### Deeper

According to oss-security, the line in `build-to-host.m4` was only in the 5.6.0 and 5.6.1 archives
and was neither in the original build-to-host nor in the project's git. The "source code"
archives, which according to the finder the code hosting site builds directly from the repository,
did not contain the line. The line runs an obfuscated script at the end of `configure`.

### `checked` The archive is compared with the repository

`attacker → build` · `attack` · `with-defence` · `stopped`
Message: archive · Result: archive did not match git, the attack failed

```text
diff archive ↔ git tag v5.6.0:  ⟦m4/build-to-host.m4⟧ differs
```

#### Simple

The distribution's packagers **compare** the release archive with the same tag in the repository.
The extra line shows up at once: there is no such code in the project. They reject the archive and
build the package from the repository.

#### Step by step

Without the line in the helper file, nobody unpacks the obfuscated "test" files. The backdoor stays
dead weight in the tests folder.

#### Deeper

Comparing the archive with the repository and reproducible builds do not protect against a
backdoor committed to the repository itself, but they force it into the open, where people read
the code. Here the trigger was hidden exactly where nobody looked.

### `compile` A build with the backdoor

`build → build` · `attack` · `without-defence`
Message: configure and make · Result: liblzma with a backdoor

```text
if x86-64 Linux, gcc and GNU ld, a deb or RPM package build:
    ⟦take code from the test file and build it into liblzma⟧
```

#### Simple

The build server builds the package as usual. The script from the extra line **pulls code** out of
the "test" file and mixes it into the library. The result is liblzma with a backdoor.

#### Step by step

The script does not fire everywhere, only when a distribution package is built on the right kind
of machine. On a programmer's computer that builds xz to check it, everything looks clean.

#### Deeper

According to the analysis on oss-security, the script checked that the build was for x86-64 Linux,
with the gcc compiler and the GNU ld linker, and inside a deb or RPM package build. The last check
was probably meant to make investigation harder. Judging by how it worked, the backdoor could only
function on glibc-based systems.

### `install` The package reaches the server

`build → server` · `attack` · `without-defence`
Message: xz package · Result: sshd loads the backdoor

#### Simple

The server installs the update. The **SSH** sign-in service does not use xz itself, but in some
distributions it loads another library, and that one loads liblzma. That is how the backdoor ends
up inside the sign-in service.

#### Step by step

When `sshd` starts, the backdoor replaces the function in it that checks an RSA key at sign-in.
From now on every key-based sign-in attempt passes through the attacker's code.

#### Deeper

According to oss-security: Debian and several other distributions patch OpenSSH to support systemd
notification, and libsystemd depends on lzma. The backdoor redirected `RSA_public_decrypt` into
its own code. Luckily, 5.6.0 and 5.6.1 had barely reached distributions, and where they had, it was
mostly in pre-release versions. CISA advised downgrading to an uncompromised version such as
XZ Utils 5.4.6.

### `backdoor` Sign-in around the check

`attacker → server` · `attack` · `without-defence`
Message: SSH sign-in · Result: key check intercepted

#### Simple

The attacker connects to the server over SSH. The backdoor sees the attempt **before the real
check** and can let them in, on a server that has no idea.

#### Step by step

This happens before sign-in, with no password and no human action. That is why NVD scores it 10.0
out of 10: `S:C` means the damage goes beyond the compression library itself.

#### Deeper

The developer who found the backdoor wrote that the code runs before authentication and likely
allows some form of access or code execution. He noticed it by a side effect: SSH sign-in on a test
system became noticeably slower, about 0.8 s instead of 0.3 s, and starting `sshd -h` took about
0.5 s instead of 0.01 s. On 29 March 2024 he reported it on oss-security, and CISA issued an alert
the same day.

### `gitbuild` A clean package from the repository

`build → server` · `safe` · `with-defence`
Message: xz package · Result: clean library

#### Simple

The package is built from verified code, without the extra line. The server gets an **ordinary**
compression library.

#### Step by step

`sshd` starts and checks keys itself, as intended. There is no foreign code in the process.

#### Deeper

A clean package does not slow sign-in down either: no extra work when `sshd` starts. In the real
story, it was precisely that difference in time that gave the backdoor away.

### `login` An ordinary key check

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: SSH sign-in · Result: key rejected, the attack failed

#### Simple

The attacker tries to sign in, but their key is not on the allowed list. `sshd` **refuses**, as it
would any stranger.

#### Step by step

The attempt stays in the server log. The attacker got neither commands nor access.

#### Deeper

A second line of defence for such servers is not letting just anyone reach SSH: sign-in only from
the networks that need it or through a separate gateway. Then even a backdoor in the sign-in
service would be out of reach from the internet.

## How to defend

- **Compare the release archive with the repository.** Build packages from a verified tag, or check
  that the archive has no code that is missing from the repository.
- **Reproducible builds.** The same result on different machines reveals tampering in the build
  process.
- **Support maintainers.** CISA urges companies that profit from open source to contribute back
  with money or developer time, so that a project does not rest on one exhausted person.
- **Roll back fast.** Know where the library is installed (SBOM) and be able to return to a verified
  version quickly, as CISA advised.
- **Do not expose SSH to the whole internet.** Limit sign-in by network or through a gateway.
- **Notice oddities.** An extra half second at sign-in and odd valgrind errors gave the backdoor
  away: unusual behaviour is worth investigating, not writing off as chance.
