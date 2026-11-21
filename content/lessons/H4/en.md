# Worms

`lesson` H4 · `section` H · `wave` 3 · `format` 1

## Passport

- `attack` T1046, T1210
- `severity` critical
- `impact` One infection spreads through the whole office network by itself in minutes, with no one clicking anything
- `defence` Updates and network segmentation
- `class` Self-propagating malware

## Sources

- [RFC 4949: Internet Security Glossary, Version 2](https://www.rfc-editor.org/rfc/rfc4949)
- [NIST CSRC Glossary: worm](https://csrc.nist.gov/glossary/term/worm)
- [MITRE ATT&CK T1210: Exploitation of Remote Services](https://attack.mitre.org/techniques/T1210/)
- [MITRE ATT&CK T1046: Network Service Discovery](https://attack.mitre.org/techniques/T1046/)
- [CISA Alert TA17-132A: Indicators Associated With WannaCry Ransomware](https://www.cisa.gov/news-events/alerts/2017/05/12/indicators-associated-wannacry-ransomware)
- [NVD: CVE-2017-0144](https://nvd.nist.gov/vuln/detail/CVE-2017-0144)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `pc1` **PC 1** — 192.0.2.21 · `icon:workstation` · `term:victim`
- `pc2` **PC 2** — 192.0.2.22 · `icon:workstation`
- `server` **Server** — 192.0.2.10

## Zones

- `internet` Internet: `attacker`
- `office` Workstations: `pc1`, `pc2`
- `servers` Servers: `server` · `term:network-segmentation`

## Steps

### `infect` The first infection

`attacker → pc1` · `attack`
Message: worm · Result: PC 1 infected

```text
PC 1: file sharing service, ⟦update not installed⟧
```

#### Simple

The attacker only needs to infect **one** computer. From there the program works on its own: it
waits for no further commands and asks no one to click anything.

#### Step by step

The first computer can be infected in many ways: an email attachment, or a vulnerable service
reachable from the internet. What matters is that a **worm** is now running on PC 1.

#### Deeper

The Internet Security Glossary, RFC 4949, defines a worm as a program that runs independently
and copies a complete working version of itself onto other hosts on a network. A virus, by the
same glossary, cannot run by itself: it inserts itself into another program and waits for that
program to be run. That is why worms spread faster: they need neither a host program nor a
person.

### `scan` Looking for neighbours

`pc1 → pc2` · `attack`
Message: port 445? · Result: neighbour found

```text
sweep 192.0.2.0/24, port 445
192.0.2.22  ⟦open⟧
192.0.2.10  ⟦open⟧
```

#### Simple

The worm looks around: it walks through the addresses of its network and asks each computer
whether the service it needs is running. That is how it finds neighbours.

#### Step by step

Inside the office, computers can reach each other. The worm knocks on the file sharing port at
each address in turn and notes who answers. PC 2 and the server answer.

#### Deeper

Looking for services on other machines is MITRE ATT&CK technique T1046, Network Service
Discovery. According to CISA, the WannaCry worm in 2017 scanned ranges of the local network,
tried UDP ports 137 and 138 and TCP ports 139 and 445, and, when port 445 answered, tried to
infect the machine through the SMB service.

### `exploit` Infecting the neighbour

`pc1 → pc2` · `attack` · `without-defence`
Message: SMB packet · Result: PC 2 infected

```text
→ 192.0.2.22:445  ⟦request that breaks the service⟧
← the service ran foreign code
```

#### Simple

PC 2 is missing an update, and its service has a **vulnerability**. The worm sends a specially
broken request, the service fails and starts a copy of the worm.

#### Step by step

The person at PC 2 did nothing: no email opened, no link clicked. It is enough that the service
listens on the network and has a bug that has already been fixed, but the update was never
installed.

#### Deeper

Exploiting a network service to move between machines is technique T1210, Exploitation of
Remote Services. WannaCry used the SMBv1 vulnerability from Microsoft bulletin MS17-010
(CVE-2017-0144: remote code execution through crafted packets). The update came out on 14 March
2017 and the worm appeared in May: machines that had installed it could not be infected this
way.

### `chain` Chain reaction

`pc2 → server` · `attack` · `without-defence`
Message: the same packet · Result: server infected

#### Simple

Now the worm runs on two machines, and each looks for new neighbours by itself. PC 2 infects the
server. The number of infected machines snowballs.

#### Step by step

Every new copy repeats the same steps: look around, find the service, infect. If a machine can
reach other networks, the worm goes there too.

#### Deeper

Speed is the main danger of a worm. A flat network, where any workstation can reach any server,
and one missing patch on many machines turn one infection into an infection of the whole
organisation. RFC 4949 mentions the Morris Worm, which flooded the ARPANET in November 1988 and
caused problems for thousands of hosts.

### `payload` The blow

`server → server` · `attack` · `without-defence`
Message: payload · Result: server down

```text
files → ⟦encrypted⟧
```

#### Simple

A worm is a delivery method. What it does on each machine is up to its author: encrypt the
files, wipe them, or simply open a door for the attacker.

#### Step by step

WannaCry, for example, encrypted files on every infected machine and demanded a ransom.
Spreading and damage went on at the same time, which made it hard to stop by hand.

#### Deeper

What a program does once it arrives is called its payload. A worm can carry ransomware, a data
stealer or a remote control tool. Defence against worms targets the spreading: the fewer
machines it reaches, the less harm any payload can do.

### `patched` The update closed the hole

`pc1 → pc2` · `attack` · `with-defence` · `stopped`
Message: SMB packet · Result: stopped

#### Simple

PC 2 got its update in time. The worm sends the same request, but the bug in the service is
gone: the request is simply rejected.

#### Step by step

The fix closes exactly the vulnerability the worm relies on. It has nothing to infect the
machine with, and the chain breaks at the very first neighbour.

#### Deeper

CISA advised installing the MS17-010 update and, where that was impossible, disabling SMBv1 and
blocking SMB ports at network boundaries. The bug was fixed before WannaCry appeared, so fast
updates, first of all for services that listen on the network, are the main defence against
worms.

### `segment` The server sits in another segment

`pc1 → server` · `attack` · `with-defence` · `stopped`
Message: SMB packet · Result: stopped

#### Simple

The network is split into parts. Workstations cannot connect to server services they do not
need, so the worm never even reaches the server.

#### Step by step

A firewall between the workstations and the servers lets through only the connections that are
needed. Port 445 from the workstation segment to the server is closed, and the worm's request is
dropped.

#### Deeper

Segmentation does not prevent one machine from being infected, but it keeps the infection inside
that machine's segment. MITRE ATT&CK lists network segmentation, software updates and disabling
unneeded features among the mitigations for T1210. Updates close a known hole; segmentation helps
when the hole is not yet known.

## How to defend

- **Install updates quickly.** Especially for services that accept connections from the network:
  worms use known vulnerabilities that have already been fixed.
- **Split the network into segments.** Workstations should not see every server service or each
  other; a firewall lets through only the connections that are needed.
- **Turn off what you do not need.** Old protocols such as SMBv1 and unused services are extra
  attack surface.
- **Keep backups separate.** If the worm carries ransomware, a copy it could not reach brings the
  data back.
- **Watch the network.** A machine that suddenly knocks on hundreds of addresses is a clear sign
  of a worm; disconnect it from the network at once.
