# Basics

`glossary` en · `category` basics

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

`category` basics · `see` injection, attacker · `lessons` B1, A7

Forms: trust boundary, trust boundaries

The place where data passes from someone the system cannot trust (for example, the internet) to
something that trusts it (the server, the database). Everything that crosses it from outside must
be checked and handled as data, not as commands. On a lesson diagram it is shown by the frame of a
zone.

## `data-breach` Data breach

`category` basics · `see` database, hash · `lessons` F1, F2, F3

Forms: data breach, data breaches, database leak, database leaks

A case where a site's data, for example a copy of its database, ends up with outsiders. After a
breach the attacker works on the copy on their own machines, and the site can do nothing about it.
That is why passwords are stored so that a leaked copy gives away little.

## `logging` Log

`category` basics · `see` jndi, rce · `lessons` K1, G5

Forms: log, logs, logging, logging library

A program's record of what happened to it: who sent requests and when, which errors occurred. It
is usually written by a ready-made library, such as Log4j for Java. Visitor data ends up in the
log too, so to the library it must stay plain text.

## `rce` Remote code execution

`category` basics · `see` attacker, logging · `lessons` K1, A4

Forms: remote code execution, RCE

An attacker makes someone else's server run their program over the network. Usually the worst
outcome: from there the attacker acts with the rights of the hijacked program, reading data,
installing programs, moving into the internal network.

## `vulnerability` Vulnerability

`category` basics · `see` exploit, patch, cve · `lessons` A1

Forms: vulnerability, vulnerabilities

A flaw in a program or its settings that can be used to cause harm: read someone else's data,
change it or stop a service. It exists before anyone finds it; once found and disclosed, it often gets a CVE
number.

## `exploit` Exploit

`category` basics · `see` vulnerability, zero-day · `lessons` A1

Forms: exploit, exploits

Code or a technique that turns a vulnerability into a result for the attacker: for example, a
request after which the server hands over someone else's file. The lessons show the mechanism,
not ready-made exploits.

## `patch` Patch

`category` basics · `see` vulnerability, zero-day · `lessons` A1

Forms: patch, patches, security update, security updates

A fix for a program that the vendor gives to users, usually as a new version. It protects only
once installed: until the patch is in place, the server is as vulnerable as before.

## `zero-day` Zero-day vulnerability

`category` basics · `see` vulnerability, patch · `lessons` A1

Forms: zero-day vulnerability, zero-day vulnerabilities, zero-day, 0-day

A vulnerability the vendor does not know about yet, so there is no fix. If the fix is out but not
installed, people say n-day: the flaw is public, so attackers know about it too.

## `reverse-shell` Reverse shell

`category` basics · `see` rce, attacker · `lessons` A4

Forms: reverse shell, reverse connection

A post-break-in trick: the captured server itself connects out to the attacker's machine and
waits for commands. Outbound connections are often checked less strictly than inbound ones, so it
helps to stop a server from making connections it does not need.

## `cia-triad` Confidentiality, integrity, availability

`category` basics · `see` data-breach, attacker · `lessons` A5

Forms: CIA triad, the CIA triad

The three properties security protects. Confidentiality: only those allowed can see the
data. Integrity: data is not changed or destroyed without the right to. Availability: data
and services work when needed. Almost every attack hits at least one of them.

## `attack-surface` Attack surface

`category` basics · `see` trust-boundary, least-privilege · `lessons` A7, G5

Forms: attack surface, attack surfaces

All the points through which an attacker can try to enter a system, affect it or extract
data from it: servers, pages, ports, accounts. The smaller it is, the fewer places for a
flaw, so whatever is not needed is removed.

## `least-privilege` Least privilege

`category` basics · `see` attack-surface, authorization · `lessons` A7

Forms: least privilege, principle of least privilege, minimum of rights

The rule that every person and every program gets only the rights it cannot do its job
without. Then breaking into one account or program gives the attacker little.

## `threat-model` Threat model

`category` basics · `see` trust-boundary, attack-surface · `lessons` A7

Forms: threat model, threat models, threat modeling, threat modelling

An analysis of a system before any attack: a diagram of data flows and trust boundaries,
then the question "what can go wrong" for each part. It finds weak spots while they are
cheaper to fix.

## `buffer-overflow` Buffer overflow

`category` basics · `see` stack-canary, aslr, dep, rce · `lessons` H1

Forms: buffer overflow, buffer overflows, overflow, overflows

A bug where a program writes data past the end of the memory slot set aside for it and damages
the data next to it. On the stack this overwrites the return address and makes the program run
foreign code (CWE-121). Languages that check bounds by themselves largely rule it out.

## `stack-canary` Stack canary

`category` basics · `see` buffer-overflow · `lessons` H1

Forms: stack canary, stack canaries, canary, canaries

A random value the compiler places on the stack before the return address. Before returning,
the function checks it: if the value is damaged, there was an overflow, and the program stops.
It does not catch every overflow.

## `aslr` ASLR

`category` basics · `see` buffer-overflow, dep · `lessons` H1

Forms: ASLR

Address Space Layout Randomization: on every run the system places the program and its
libraries at random addresses, so the attacker struggles to guess where to send the processor.
It can be bypassed if the program leaks its addresses.

## `dep` DEP

`category` basics · `see` buffer-overflow, aslr · `lessons` H1

Forms: DEP

Data Execution Prevention: memory for data is marked non-executable, and the processor refuses
to run code from it, so code sent along with the data will not run by itself.

## `dependency` Dependency

`category` basics · `see` package-registry, lock-file, typosquatting · `lessons` H6

Forms: dependency, dependencies

Someone else's library that a program relies on. Dependencies have dependencies of their own, so
an ordinary project has hundreds of them; each one runs with the program's own rights.

## `package-registry` Package registry

`category` basics · `see` dependency, typosquatting · `lessons` H6, J4

Forms: package registry, package registries, public registry, internal registry, own registry

A server developers download libraries from with a command like `npm install`. Any registered
user can publish to a public registry, so a package name alone does not tell you who wrote it.
Companies also run an internal registry with vetted packages.

## `lock-file` Lock file

`category` basics · `see` dependency · `lessons` H6

Forms: lock file, lock files

A project file with the exact versions of all dependencies, nested ones included, for example
`package-lock.json`. Installing from it (`npm ci`) gives everyone the same set and aborts on any
mismatch.

## `build-server` Build server

`category` basics · `see` reproducible-build, code-signing, supply-chain-attack · `lessons` H5

Forms: build server, build servers

The machine that turns source code into the finished program and often signs it too. Whoever
takes over the build server can change what every user receives without touching the code in the
repository.

## `code-signing` Code signing

`category` basics · `see` build-server, reproducible-build · `lessons` H5

Forms: code signing, update signatures

A digital signature on a program made with the vendor's key. It proves who signed the file and
that it has not changed since, but not that nothing extra was in it before signing.

## `reproducible-build` Reproducible build

`category` basics · `see` build-server, code-signing · `lessons` H5

Forms: reproducible build, reproducible builds, reproducible

A build where the same code and the same inputs always give a bit-for-bit identical result. Two
independent builds can be compared: a mismatch reveals tampering on one of the machines.

## `sbom` SBOM

`category` basics · `see` dependency, supply-chain-attack · `lessons` H5

Forms: SBOM

Software Bill of Materials: an inventory of a program's components, which libraries and which
versions it contains. It helps to see quickly whether a program is affected when a vulnerability
is found in a component.

## `out-of-bounds-read` Out-of-bounds read

`category` basics · `see` buffer-overflow, heartbeat · `lessons` K2

Forms: out-of-bounds read, reading past the end

A bug where a program reads data past the end of the memory set aside for it and hands out the
neighbouring data that belongs to others. Nothing gets damaged, but secrets leak. In the CWE
catalogue it is CWE-125.
