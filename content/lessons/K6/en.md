# SolarWinds (2020)

`lesson` K6 · `section` K · `wave` 3 · `format` 1

## Passport

- `cwe` 506
- `owasp` A08:2021
- `attack` T1195, T1195.002
- `severity` critical
- `impact` A backdoor reached about 18,000 customers in a signed update, and at some of them the attackers went further
- `defence` Cut the management server off from the internet and compare builds
- `class` Compromise of a software vendor's build

## Sources

- [CISA ED 21-01: Mitigate SolarWinds Orion Code Compromise](https://www.cisa.gov/news-events/directives/ed-21-01-mitigate-solarwinds-orion-code-compromise)
- [CISA AA20-352A: Advanced Persistent Threat Compromise of Government Agencies, Critical Infrastructure, and Private Sector Organizations](https://www.cisa.gov/news-events/cybersecurity-advisories/aa20-352a)
- [FBI, CISA, ODNI, NSA: Joint Statement, 5 January 2021](https://www.cisa.gov/news-events/news/joint-statement-federal-bureau-investigation-fbi-cybersecurity-and-infrastructure-security-agency-0)
- [MITRE ATT&CK C0024: SolarWinds Compromise](https://attack.mitre.org/campaigns/C0024/)
- [MITRE ATT&CK S0562: SUNSPOT](https://attack.mitre.org/software/S0562/)
- [MITRE ATT&CK S0559: SUNBURST](https://attack.mitre.org/software/S0559/)
- [MITRE ATT&CK T1195.002: Compromise Software Supply Chain](https://attack.mitre.org/techniques/T1195/002/)
- [MITRE CWE-506: Embedded Malicious Code](https://cwe.mitre.org/data/definitions/506.html)
- [OWASP Top 10:2021 A08: Software and Data Integrity Failures](https://owasp.org/Top10/2021/A08_2021-Software_and_Data_Integrity_Failures/)

## Participants

- `build` **Build** — 198.51.100.5 · `icon:server` · `term:build-server`
- `orion` **Orion** — 192.0.2.40 · `icon:server` · `term:backdoor`
- `fw` **Gateway** — 192.0.2.1 · `icon:router` · `term:firewall`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`

## Zones

- `vendor` Vendor: `build` · `term:supply-chain-attack`
- `customer` Customer: `orion`, `fw` · `term:trust-boundary`
- `internet` Internet: `attacker`

## Steps

### `implant` An implant on the build server

`attacker → build` · `attack`
Message: SUNSPOT · Result: quietly waits for a build

#### Simple

The vendor makes **Orion**, a program thousands of organisations use to watch over their
networks. The attackers sneak onto its **build server** and leave a small spy program there.

#### Step by step

The spy program breaks nothing. It sits quietly and watches for one thing: the moment the server
starts building a new version of Orion.

#### Deeper

MITRE calls this implant SUNSPOT and attributes the campaign to the group APT29. According to
ATT&CK, SUNSPOT was in use since at least February 2020, and the first traces of the campaign go
back to August 2019. CISA later wrote that the attackers had long-standing covert access to the
Orion build process, including the source code.

### `swap` A file swapped for the build

`build → build` · `attack`
Message: file swap · Result: SUNBURST inside the build

```text
build starts → ⟦swap a source file⟧ → build → put the original back
```

#### Simple

As soon as a build starts, the spy **swaps one source file** for its own, with the backdoor in it.
The build runs as usual, and then the spy puts the honest file back.

#### Step by step

The code repository has no backdoor: programmers see their code unchanged. The backdoor exists
only in the finished program that came out of the build. It was named SUNBURST.

#### Deeper

According to ATT&CK, SUNSPOT watched for `MsBuild.exe` processes, found the Orion project folder,
saved a copy of the source file, put SUNBURST in its place under the same name, and restored the
original after the build. It swapped the file only if the checksums of both matched the expected
values, so as not to break the build and give itself away. Malicious code embedded in a program
is CWE-506.

### `ship` A signed update

`build → orion` · `attack`
Message: update · Result: signed and installed

#### Simple

The new Orion version ships with the vendor's **real signature**. Customers install it like any
update: the signature checks out, so the program must be honest.

#### Step by step

A signature confirms that the vendor released the file and nobody changed it on the way. But the
backdoor got into the file before signing, so the signature vouches for it too.

#### Deeper

CISA: a malicious version of the library `SolarWinds.Orion.Core.BusinessLayer.dll` entered the
release and was signed with the vendor's real certificate. The affected versions are Orion
Platform 2019.4 HF5, 2020.2 RC1, 2020.2 RC2, 2020.2 and 2020.2 HF1. According to the joint
statement by the FBI, CISA, ODNI and NSA, there were about 18,000 such customers. In ATT&CK this
is T1195.002, compromise of the software supply chain.

### `beacon` The backdoor checks in

`orion → attacker` · `attack` · `without-defence`
Message: DNS query · Result: victim checked in

```text
DNS: ⟦a1b2c3⟧.c2.example ?
```

#### Simple

The backdoor bides its time and then **calls home**: it sends a query for a name in the
attackers' domain. The name hides whose network this is. The attackers see thousands of victims
and pick the ones they care about.

#### Step by step

To the customer's network this looks like normal Orion work: a query for a name on the internet,
an answer from a name server. With the DNS answer, the attackers can give the victim a new address
to talk to.

#### Deeper

CISA: once installed, the library contacts a subdomain unique to each victim, and its traffic
imitates Orion's own protocol. The backdoor waited unpredictable times between contact attempts
and checked whether it was running in an analysts' lab. On 15 December 2020 the backdoor's domain
was pointed to an address on Microsoft's blocklist: new victims stopped calling in, but that did
not help those already moved to other addresses.

### `follow` The second stage for the chosen few

`attacker → orion` · `attack` · `without-defence`
Message: second stage · Result: attackers inside the network

#### Simple

To a few chosen victims the attackers come **in person**: they give the backdoor commands,
install other programs and move on through the network.

#### Step by step

The Orion server has broad access to the network, since it watches everything. From it the
attackers reach accounts and sign-in services.

#### Deeper

According to the statement of 5 January 2021, of the roughly 18,000 customers a much smaller
number were hit by the second stage, among them fewer than ten US government agencies. The
campaign was discovered in mid-December 2020; on 13 December CISA issued directive ED 21-01: cut
off the affected Orion versions at once. In April 2021 the US and the UK named Russia's Foreign
Intelligence Service (SVR) as responsible.

### `blocked` The gateway does not let Orion out

`orion → fw` · `attack` · `with-defence` · `stopped`
Message: DNS out · Result: no way out, the attack failed

```text
DNS: ⟦a1b2c3⟧.c2.example ?   → denied: Orion may not go out
```

#### Simple

The same backdoor tries to call home, but **the gateway does not let it out**: the Orion server
may only talk to devices in its own network.

#### Step by step

The backdoor is there, but it is blind and deaf: the attackers never learn about the victim and
cannot give it commands. There will be no second stage.

#### Deeper

This is exactly what ED 21-01 required of agencies that kept running Orion: block all traffic
between hosts with Orion and the outside world. A network management program usually does not
need the internet, while for the backdoor it is the only line to its masters.

### `alert` An alarm from the log

`fw → fw` · `safe` · `with-defence`
Message: alarm · Result: the defenders check Orion

#### Simple

The gateway writes the refusal to its **log**, and the defenders see that a server with no
business on the internet keeps knocking on its door.

#### Step by step

Such a signal is a reason to check the server: which version it runs, which libraries it has,
where it tried to go.

#### Deeper

CISA advised analysing stored network traffic for new external domains that only a few hosts had
contacted, such as Orion servers. The vendor itself would have been helped by comparing releases
with an independent build from the same code: the swapped file would have shown up as a mismatch.
The supply chain attack lesson covers that defence in detail.

## How to defend

- **Close needless internet access.** Management and monitoring servers have no reason to go out
  to the internet. Allow only the addresses you need and deny everything else by default.
- **Watch the logs.** Gateway refusals and unusual DNS queries from internal servers are a reason
  to investigate.
- **Protect the vendor's build.** A separate, locked-down build server, checks of its integrity,
  and comparison of releases with an independent reproducible build.
- **Do not treat a signature as a guarantee.** A signature proves who released a file, not that it
  has no backdoor.
- **Know what runs in your network.** A list of programs and versions helps find every affected
  installation within hours when a warning arrives.
- **Have a plan for a breach.** ED 21-01 required disconnecting affected servers, taking memory
  and disk images for the investigation, and installing the fixed version only on a clean system.
