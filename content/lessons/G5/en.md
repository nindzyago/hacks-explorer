# Port scanning

`lesson` G5 · `section` G · `wave` 3 · `format` 1

## Passport

- `attack` T1595, T1046
- `severity` low
- `impact` A map of open services and their versions for the next attack
- `defence` A firewall that blocks everything except what is needed
- `class` Reconnaissance: finding open services

## Sources

- [MITRE ATT&CK T1595: Active Scanning](https://attack.mitre.org/techniques/T1595/)
- [MITRE ATT&CK T1046: Network Service Discovery](https://attack.mitre.org/techniques/T1046/)
- [MITRE CAPEC-300: Port Scanning](https://capec.mitre.org/data/definitions/300.html)
- [RFC 9293: Transmission Control Protocol (TCP)](https://www.rfc-editor.org/rfc/rfc9293.html)
- [RFC 6335: Service Name and Transport Protocol Port Number Registry Procedures](https://www.rfc-editor.org/rfc/rfc6335.html)
- [NIST SP 800-41 Rev. 1: Guidelines on Firewalls and Firewall Policy](https://csrc.nist.gov/pubs/sp/800/41/r1/final)
- [CISA: Understanding Firewalls for Home and Small Office Use](https://www.cisa.gov/news-events/news/understanding-firewalls-home-and-small-office-use)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `firewall` **Firewall** — at the edge · `icon:router` · `term:firewall`
- `server` **Server** — 198.51.100.10 · `term:port`
- `log` **Log** — defender's · `term:logging`

## Zones

- `internet` Internet: `attacker`
- `company` Company network: `firewall`, `server`, `log`

## Steps

### `knock` Knocking on every door

`attacker → server` · `attack` · `without-defence`
Message: SYN to ports 1–1024 · Result: the server answers each one

```text
SYN → 198.51.100.10, port 21
SYN → 198.51.100.10, port 22
SYN → 198.51.100.10, port 23
and so on up to port 1024
```

#### Simple

A server has thousands of numbered doors, **ports**. Behind some of them sit programs: the
website, the administrators' login, a database. The attacker does not know which doors are open,
so he knocks on all of them in turn.

#### Step by step

A knock is the first message of the TCP handshake, SYN: "I want to connect". The attacker does
not need to really connect; only the answer matters to him.

#### Deeper

A port number is a number from 0 to 65,535. Under RFC 6335, ports 0–1023 are called System Ports:
by tradition, well-known services live there, such as a web server on 443. But a service can run
on any port, so a scan often covers the whole range. MITRE CAPEC calls this CAPEC-300 "Port
Scanning"; in MITRE ATT&CK, reconnaissance from outside is technique T1595 "Active Scanning".

### `reply` The answers give away the open doors

`server → attacker` · `legit` · `without-defence`
Message: open: 22, 443, 7010 · Result: the running services are visible

```text
port 22    SYN-ACK  → open
port 443   SYN-ACK  → open
port 7010  SYN-ACK  → open
port 23    RST      → closed
```

#### Simple

The server honestly answers every knock. Where a door is open, it says "**agreed**". Where it is
closed, "nobody here". From the answers the attacker sees which programs are running.

#### Step by step

An open port answers SYN-ACK, a closed one RST. The attacker never sends the final ACK, so the
connection never opens.

#### Deeper

The protocol itself says so: under RFC 9293 (sections 3.5.2 and 3.10.7, item 2), a segment for a connection that does
not exist gets a reset, RST, while a listening port answers a SYN with agreement. So the server
tells anyone who asks a lot about itself. The open ports are the server's attack surface.

### `banner` A greeting with a version

`server → attacker` · `legit` · `without-defence`
Message: ExampleDB 4.2 · Result: the program and its version are known

```text
port 7010: ⟦ExampleDB 4.2 ready⟧
```

#### Simple

The attacker peeks through an open door. Many programs **introduce themselves**: they give their
name and version. This greeting is called a banner.

#### Step by step

Now the attacker knows not only that there is a database on port 7010, but which one and which
version. (ExampleDB is a made-up program.)

#### Deeper

Knowing the version, the attacker looks up known vulnerabilities for it in public catalogues such
as NVD. An old version without updates is a ready target. That is why reconnaissance usually comes
before an attack.

### `map` A map for the next attack

`attacker → attacker` · `attack` · `without-defence`
Message: service map · Result: target chosen, nobody noticed

#### Simple

The attacker puts the answers together into a **map**: which doors are open and what is behind them.
The most dangerous find seems to be the database, exposed straight to the internet. The company
noticed nothing.

#### Step by step

The scan itself breaks nothing and steals nothing. But afterwards the attacker knows where to
strike, and the next attack will be precise.

#### Deeper

Inside an already compromised network the same thing goes by another name: in MITRE ATT&CK it is
technique T1046 "Network Service Discovery", looking for services on neighbouring machines. The
mechanism is the same: knock and listen to the answers.

### `drop` The extra doors are shut

`attacker → firewall` · `attack` · `with-defence` · `stopped`
Message: SYN to ports 1–1024 · Result: only 443 let through, the rest silently dropped

```text
SYN → port 22    ⟦dropped, no answer⟧
SYN → port 7010  ⟦dropped, no answer⟧
SYN → port 443   passed to the server
```

#### Simple

Now a **firewall** stands at the edge of the network. Its rule is simple: everything not
explicitly allowed is forbidden. Only port 443, the website, is allowed. Every other knock gets no
answer at all.

#### Step by step

Silence instead of RST tells the attacker nothing: whether the port is closed or filtered, or
whether there is a server there at all. The map comes out almost empty.

#### Deeper

The database and the administrators' login still work, but only from inside the network or over a
VPN. NIST SP 800-41 calls this approach deny by default: the firewall blocks all traffic the
policy has not expressly permitted.

### `web` Only the website is open

`attacker → server` · `legit` · `with-defence`
Message: SYN to 443 · Result: only the website is open, no version in the reply

```text
port 443   SYN-ACK  → open
the site's reply: no program name or version
```

#### Simple

The attacker sees one open door: the website, which is meant to be open. The site's greeting says
nothing about the program or its version. **There is nothing to grab onto.**

#### Step by step

The server is set up not to name its version. That does not replace updates, but denying the
attacker hints is useful.

#### Deeper

Scanning cannot be forbidden: anyone can knock on a public address. But you can make sure it finds
almost nothing. That is what shrinking the attack surface means.

### `alert` The defender sees the scan

`firewall → log` · `safe` · `with-defence`
Message: 1024 SYNs in a minute · Result: the defender sees the scan and blocks the address

```text
203.0.113.66: SYN to 1024 different ports in 60 s → looks like a scan
```

#### Simple

The firewall writes the dropped packets to the **log**. A thousand knocks on different doors in a
minute from one address stands out. The defender gets an alert.

#### Step by step

The attacker's address can be blocked for a while. More importantly, the defender has learned
that someone is studying the network and can check that everything unneeded is shut.

#### Deeper

MITRE CAPEC notes that noisy scanning is easy to spot from the volume of packets, unusual packet
traits and system logs. It also helps for the defender to scan their own network regularly: that
way they see what the attacker sees, and see it first.

## How to defend

- **A firewall that denies by default.** Allow only the ports that are needed from outside, such
  as 443 for the website; drop everything else.
- **Turn off unneeded services.** A program that is not needed should be switched off, not just
  hidden.
- **Databases and admin logins stay off the internet.** Only from inside the network or over a
  VPN.
- **Do not announce versions.** Remove version numbers from service greetings and response
  headers.
- **Keep software updated.** Even if someone learns the version, an up-to-date release already has
  the known vulnerabilities fixed.
- **Logs and alerts.** Watch for bursts of dropped packets from one address, and scan your own
  network to see it through the attacker's eyes.
