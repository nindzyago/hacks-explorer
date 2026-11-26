# WannaCry and EternalBlue (CVE-2017-0144)

`lesson` K3 · `section` K · `wave` 1 · `format` 1

## Passport

- `owasp` A06:2021
- `attack` T1210, T1486
- `cvss` CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H
- `cves` CVE-2017-0144
- `severity` high
- `impact` Ransomware spreads through the network over SMBv1 by itself and encrypts files on every machine
- `defence` The MS17-010 update, SMBv1 turned off, separate backups
- `class` Ransomware worm through an SMBv1 vulnerability

## Sources

- [NVD: CVE-2017-0144](https://nvd.nist.gov/vuln/detail/CVE-2017-0144)
- [Microsoft Security Bulletin MS17-010 - Critical](https://learn.microsoft.com/en-us/security-updates/securitybulletins/2017/ms17-010)
- [CISA Alert TA17-132A: Indicators Associated With WannaCry Ransomware](https://www.cisa.gov/news-events/alerts/2017/05/12/indicators-associated-wannacry-ransomware)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [MITRE ATT&CK T1210: Exploitation of Remote Services](https://attack.mitre.org/techniques/T1210/)
- [MITRE ATT&CK T1486: Data Encrypted for Impact](https://attack.mitre.org/techniques/T1486/)
- [OWASP Top 10:2021, A06 Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `domain` **Domain** — kill.example · `icon:server`
- `pc1` **PC 1** — 192.0.2.21 · `icon:workstation` · `term:worm`
- `pc2` **PC 2** — 192.0.2.22 · `icon:workstation` · `term:victim`

## Zones

- `internet` Internet: `attacker`, `domain`
- `office` Office: `pc1`, `pc2` · `term:network-segmentation`

## Steps

### `arrive` 12 May 2017

`attacker → pc1` · `attack`
Message: WannaCry · Result: PC 1 infected

```text
PC 1: Windows, SMBv1 on, ⟦MS17-010 not installed⟧
```

#### Simple

On the morning of 12 May 2017, computers in organizations around the world started getting
encrypted. The program was called **WannaCry**. It was not just ransomware but a worm: every
infected machine went on to infect the next ones by itself.

#### Step by step

How exactly the first machines got infected is not known for sure: CISA named phishing only as
one possible way in. For this lesson what matters is that WannaCry is now running on PC 1.

#### Deeper

According to CISA, the first reports came in around 4:00 AM US Eastern time, the program spread
within hours, and open sources counted tens of thousands of infections in more than 150
countries. How a worm works in general (finding neighbours, the chain reaction, segmentation) is
covered in the "Worms" lesson (H4). This one is the story of one real worm.

### `lookup` A strange domain

`pc1 → domain` · `attack`
Message: GET · Result: no answer

```text
GET http://⟦kill.example⟧/
→ no answer: carry on
```

#### Simple

Before doing anything, the program tries to open a page at a **strange long address**. Nobody
owns the domain, so there is no answer. Then WannaCry carries on.

#### Step by step

This is the "kill switch" check. Had the domain answered, the program would have quit by itself
and touched nothing. The real domain was a long string of nonsense; the lesson uses
`kill.example` instead.

#### Deeper

Why the author put in this check is not known for sure. CISA describes only the behaviour: if the
connection works, the program exits; if it fails, it infects the system. This small detail plays
the main part at the end of the story.

### `spread` EternalBlue

`pc1 → pc2` · `attack` · `without-defence`
Message: SMB, 445 · Result: PC 2 infected

```text
→ 192.0.2.22:445  ⟦an SMBv1 request that breaks the service⟧
← the service ran someone else's code
```

#### Simple

WannaCry looks for neighbours on the network with an open **SMB** file-sharing service and sends
them a specially broken request. The service on PC 2 breaks and starts a copy of the program. The
person at PC 2 clicked nothing.

#### Step by step

The worm walks through the addresses of the local network. If port 445 answers, it uses a bug in
the Windows SMBv1 server, the one fixed by Microsoft bulletin MS17-010. CISA calls this method
the EternalBlue exploit.

#### Deeper

Microsoft released MS17-010 on 14 March 2017, almost two months before the outbreak, and rated it
Critical for all supported versions of Windows. NVD published CVE-2017-0144 on 17 March 2017: its
CVSS 3.1 score is 8.8 out of 10, high. The vector says `PR:L`: NVD counts low privileges as
needed, while the worm, as CISA describes it, tried to infect any machine where port 445
answered. NVD gives no weakness class (`NVD-CWE-noinfo`), so the passport has no CWE. In ATT&CK,
moving between machines like this is T1210.

### `encrypt` The ransom

`pc2 → pc2` · `attack` · `without-defence`
Message: encryption · Result: files encrypted

```text
report.docx → ⟦encrypted⟧
"Pay about $300 in bitcoin"
```

#### Simple

On every infected machine WannaCry **encrypts the files** and shows a ransom demand. The computer
keeps infecting its neighbours until someone takes it off the network.

#### Step by step

CISA quoted the amount from open sources: 0.1781 bitcoin, roughly 300 US dollars. Paying does not
guarantee the files come back: it only guarantees that the attacker gets the money.

#### Deeper

Encrypting data to cause damage is ATT&CK technique T1486. Microsoft released updates even for
systems it no longer supported: according to CISA, on 13 May 2017 for Windows XP, Windows 8 and
Windows Server 2003. Later the US government publicly attributed WannaCry to the government of
North Korea; CISA added this to its alert in June 2018.

### `switch` The kill switch

`pc2 → domain` · `safe` · `without-defence`
Message: GET · Result: answered, the worm quits

```text
GET http://kill.example/
→ 200 OK: ⟦exit⟧
```

#### Simple

Researchers noticed the domain check and **registered the domain**. Now it answers, and new
copies of WannaCry get the answer and simply quit. The outbreak slowed down sharply.

#### Step by step

Files already encrypted stayed encrypted. But this version of the program no longer encrypted new
machines, as long as they could reach the domain.

#### Deeper

According to CISA, registering the domain greatly reduced the spread, and CISA asked
administrators **not to block** the domain: blocking it would switch the worm back on. The kill
switch was luck, not a defence: it worked against one program, not against the vulnerability. The
vulnerability was added to the KEV catalog on 10 February 2022.

### `patched` The update was there

`pc1 → pc2` · `attack` · `with-defence` · `stopped`
Message: SMB, 445 · Result: stopped

#### Simple

PC 2 had the MS17-010 update installed back in March. The worm sends the same request, but the
bug in the service is gone. PC 2 is not infected.

#### Step by step

MS17-010 changes how SMBv1 handles specially crafted requests. Where the update could not be
installed, Microsoft and CISA advised turning SMBv1 off, and CISA also advised blocking port 445
and the related ports at the network boundary.

#### Deeper

The main lesson of WannaCry: the fix was ready in advance. The machines hit were the ones where it
had not been installed, and machines on old systems that no longer got updates. Installing updates
quickly on services exposed to the network is the cheapest defence against worms.

### `restore` The backup is safe

`pc1 → pc1` · `safe` · `with-defence`
Message: backup · Result: files restored

#### Simple

PC 1 did get encrypted. But the company has a **backup** that the worm could not reach. The
computer is cleaned and the files come back without paying a ransom.

#### Step by step

PC 1 is taken off the network, the system is reinstalled, the updates are installed, and only
then is the data restored from the backup.

#### Deeper

CISA advised keeping copies of important data separately, so they are not easy to reach from the
local network, and testing that you can really restore from them. A backup on a network drive that
the infected machine can see may get encrypted along with everything else.

## How to defend

- **Install updates quickly.** MS17-010 came out almost two months before WannaCry. Update services that
  accept connections from the network first.
- **Drop SMBv1.** Turn off the old protocol version and block port 445 and its related ports at
  the network boundary.
- **Keep old systems out of the shared network.** Machines that no longer get updates belong in
  their own segment with as few connections as possible.
- **Split the network into segments.** Workstations should not see every service of each other
  and of the servers.
- **Keep backups separate.** And check regularly that you can restore from them.
- **Don't count on a kill switch.** WannaCry's switch domain was luck, not a defence; the next
  worm may not have one.
