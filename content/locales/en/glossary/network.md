# Network

`glossary` en · `category` network

## `mitm` Man in the middle

`category` network · `see` arp, tls, attacker · `lessons` G1, G2, G3, L4

Forms: man in the middle, man-in-the-middle, MITM, adversary in the middle, adversary-in-the-middle

An attack in which the attacker gets between the two sides of a conversation: each thinks it is
talking to the other, but everything passes through the attacker, who can read and change the
messages. In MITRE ATT&CK it is technique T1557 "Adversary-in-the-Middle". Encryption that also
checks who is on the other end, such as TLS, protects against it.

## `router` Router

`category` network · `see` arp, mitm · `lessons` G1

Forms: router, routers

A device through which the computers of a local network reach other networks, such as the
internet. To send something outside, a computer hands the packet to its network's router.

## `arp` ARP

`category` network · `see` router, mitm · `lessons` G1

Forms: ARP, ARP table, ARP tables, ARP request, ARP requests, ARP reply, ARP replies

Address Resolution Protocol (RFC 826): finds the physical MAC address of a neighbour on the same
network from its IP address. A computer asks everyone and keeps the answer in its ARP table. ARP
does not check who answers, so a fake reply can pass the attacker off as the router.

## `tls` TLS

`category` network · `see` certificate, hsts, mitm · `lessons` G1, G3, K2, L3

Forms: TLS, HTTPS

Transport Layer Security, the protocol for secure connections; HTTPS is HTTP over TLS. It encrypts
the data and checks the server by its certificate, so someone in the middle can neither read the
conversation nor quietly change it. The current version, TLS 1.3, is described in RFC 8446.

## `certificate` Certificate

`category` network · `see` tls, domain · `lessons` G1, L2, L3, L4

Forms: certificate, certificates

An electronic document that ties a site's name to its public key and is signed by a certificate
authority. The browser checks that the certificate was issued for the domain it opened and signed
by someone it trusts. A certificate says whose site it is, not that the site is honest.

## `hsts` HSTS

`category` network · `see` tls, certificate · `lessons` G1, G3, L4

Forms: HSTS, Strict-Transport-Security

HTTP Strict Transport Security (RFC 6797): a header with which a site tells the browser to reach it
over HTTPS only. The browser itself turns `http` into `https` and does not let anyone click past a
certificate error. The HSTS preload list built into browsers protects the first visit.

## `certificate-authority` Certificate authority

`category` network · `see` certificate, digital-signature · `lessons` L2, L3

Forms: certificate authority, certificate authorities, root authority, root authorities

An organisation that checks that an applicant controls a domain and signs its certificate. The
browser trusts a few root authorities from its own list, and through them everyone they have
issued certificates to along the chain.

## `forward-secrecy` Forward secrecy

`category` network · `see` tls, key-pair · `lessons` L3, L5

Forms: forward secrecy

A property of a secure connection: each session key is single-use and erased afterwards. Even if
the server's long-term key is stolen later, conversations recorded earlier can't be decrypted with
it. TLS 1.3 always has it (RFC 8446).

## `e2e-encryption` End-to-end encryption

`category` network · `see` encryption, key-fingerprint · `lessons` L5

Forms: end-to-end encryption, end-to-end encrypted, end-to-end

Encryption from the sender's device to the recipient's device. The server passes the message on
but holds no keys, so it can't read it. Who got a message and when is still known to the server.

## `key-fingerprint` Key fingerprint

`category` network · `see` e2e-encryption, key-pair · `lessons` L5

Forms: key fingerprint, key fingerprints

A short form of a public key: digits or a QR code. Two people compare fingerprints in person and
so make sure the server has not swapped the other person's key.

## `network-segmentation` Network segmentation

`category` network · `see` ransomware, trust-boundary · `lessons` H2

Forms: network segmentation, segmentation

Splitting a network into parts with rules on who may talk to whom. Work computers do not see every
server, so an infection of one machine does not spread through the whole company.

## `dos` Denial of service

`category` network · `see` cia-triad · `lessons` A5, G4

Forms: denial of service, denial-of-service, DoS, DDoS

An attack on availability: a service is overloaded or broken so that legitimate users
cannot use it. When the requests come from thousands of addresses at once, it is a
distributed attack, DDoS.

## `reverse-proxy` Reverse proxy

`category` network · `see` web-server, request-smuggling · `lessons` E1

Forms: reverse proxy, reverse proxies, proxy, proxies

A program in front of a site's servers: it takes requests from the internet and forwards them to
the servers, often over shared persistent connections. Load balancers and CDNs work this way. The
proxy and the server must agree on request boundaries, or request smuggling becomes possible.

## `cloud-metadata` Cloud metadata service

`category` network · `see` ssrf, trust-boundary · `lessons` D8

Forms: metadata service, cloud metadata service, cloud metadata

A service inside a cloud that tells a virtual machine what machine it is and hands it temporary
keys for the cloud. It is reachable only from the machine itself, at a special address. Through
SSRF the attacker makes the server ask it and takes the keys; in MITRE ATT&CK this is
sub-technique T1552.005.

## `evil-twin` Evil twin

`category` network · `see` mitm, pmf · `lessons` G6

Forms: evil twin, evil twins

A fake Wi-Fi access point with the same name as a real network, often with a stronger signal.
Devices connect to it, and the attacker ends up in the middle. In MITRE ATT&CK it is
sub-technique T1557.004 "Evil Twin".

## `pmf` PMF

`category` network · `see` evil-twin · `lessons` G6

Forms: PMF, protected management frames, management frame protection

Protected Management Frames, the IEEE 802.11w amendment to Wi-Fi. Control messages such as
"disconnect" are protected with the key of the connection between the device and its access
point, and a device throws forged ones away. Mandatory
on WPA3 networks.

## `bgp` BGP

`category` network · `see` autonomous-system, rpki, router · `lessons` G7

Forms: BGP, BGP-4

Border Gateway Protocol (RFC 4271): the protocol internet networks use to tell each other which
addresses are where and which way to reach them. BGP itself does not check that a network holds
the addresses it announces.

## `autonomous-system` Autonomous system

`category` network · `see` bgp · `lessons` G7

Forms: autonomous system, autonomous systems

A network under one administration, such as a provider or a large company, with its own number
(ASN). Such networks exchange routes over BGP.

## `rpki` RPKI

`category` network · `see` bgp, certificate · `lessons` G7

Forms: RPKI, ROA, ROAs

Resource Public Key Infrastructure (RFC 6480): a registry of signed records about who holds
which addresses. A ROA record says which network number may announce a range. Providers check BGP
announcements against it and drop the ones that do not match (RFC 6811).

## `egress-filtering` Egress filtering

`category` network · `see` c2, network-segmentation · `lessons` H3, K6

Forms: egress filtering, outbound traffic, outbound connections

Rules at the way out of a network: computers and servers may connect only to the destinations
their work needs. A captured machine then cannot reach the attacker's server.

## `dns` DNS

`category` network · `see` dns-resolver, dns-poisoning, domain · `lessons` G2

Forms: DNS, DNS server, DNS servers, DNS query, DNS queries, DNS question, DNS answer, DNS answers

The Domain Name System, the internet's naming system: given a site's name, such as bank.example,
it returns the site's numeric address. Questions and answers usually travel in a single UDP packet
each. DNS on its own does not sign answers; DNSSEC adds signatures.

## `dns-resolver` Resolver

`category` network · `see` dns, dns-poisoning · `lessons` G2

Forms: resolver, resolvers

A DNS server that looks up addresses on behalf of clients: it asks other servers and keeps the
answers in its cache for as long as each answer says. A resolver is usually run by an ISP or a
company, and thousands of devices use it at once.

## `dns-poisoning` DNS poisoning

`category` network · `see` dns-resolver, dnssec, mitm · `lessons` G2

Forms: DNS poisoning, DNS cache poisoning, cache poisoning, poisoned cache

An attack in which a resolver accepts a forged answer and remembers a wrong address for a site.
All its clients land on the attacker's server. MITRE CAPEC calls it CAPEC-142 "DNS Cache
Poisoning". Random query IDs and ports (RFC 5452) and DNSSEC protect against it.

## `dnssec` DNSSEC

`category` network · `see` dns, dns-poisoning · `lessons` G2

Forms: DNSSEC

DNS Security Extensions (RFC 4033): digital signatures on DNS answers. The resolver checks that
the data came from the zone's owner and was not changed. DNSSEC gives no encryption: it protects
the authenticity of the answer, not the secrecy of the question.

## `ssl-stripping` SSL stripping

`category` network · `see` hsts, downgrade-attack, mitm · `lessons` G3

Forms: SSL stripping, stripping

An attack by a man in the middle who talks HTTPS to the site but plain HTTP to the victim, and
changes `https` to `http` in the pages. The encryption is not broken but removed from the stretch
to the victim. HSTS with the preload list protects against it.

## `downgrade-attack` Downgrade attack

`category` network · `see` ssl-stripping, tls · `lessons` G3

Forms: downgrade attack, downgrade attacks, downgrade, lower the version

An attack in which a man in the middle makes the two sides agree on an older, weaker version of a
protocol. In MITRE ATT&CK it is technique T1689 "Downgrade Attack". Banning old versions protects
against it: RFC 7568 bans SSL 3.0, and RFC 8996 bans TLS 1.0 and 1.1.

## `tcp-handshake` TCP handshake

`category` network · `see` syn-flood, port · `lessons` G4, G5

Forms: TCP handshake, three-way handshake, SYN-ACK, SYN-ACKs

The three messages that open a TCP connection (RFC 9293): SYN "I want to connect", SYN-ACK
"agreed", ACK "confirmed". Until the last one arrives, the connection is half-open and takes a
place in the server's queue.

## `syn-flood` SYN flood

`category` network · `see` tcp-handshake, syn-cookies, dos · `lessons` G4

Forms: SYN flood, SYN floods

A denial-of-service attack: a stream of SYNs from forged addresses fills the queue of half-open
connections, and the server stops accepting real clients (RFC 4987). MITRE ATT&CK describes it in
sub-technique T1499.001 "OS Exhaustion Flood".

## `syn-cookies` SYN cookies

`category` network · `see` syn-flood, tcp-handshake · `lessons` G4

Forms: SYN cookies, SYN cookie

A defence against SYN floods: the server remembers nothing when a SYN arrives and hides what it
needs in the sequence number of its SYN-ACK reply. It sets aside memory only when the client
returns the right number in its ACK (RFC 4987).

## `amplification` Amplification

`category` network · `see` ip-spoofing, dos · `lessons` G4

Forms: amplification, reflection, reflection attack, reflection attacks, reflected flood

A reflected denial-of-service attack: the attacker sends servers short questions carrying the
victim's address instead of his own, and the big answers fly to the victim. According to CISA, DNS
amplifies traffic 28–54 times and NTP about 557 times. In MITRE ATT&CK it is sub-technique
T1498.002.

## `ip-spoofing` Source address spoofing

`category` network · `see` amplification, syn-flood · `lessons` G4

Forms: forged address, forged addresses, spoofed address, spoofed addresses, address spoofing, IP spoofing

A packet that carries someone else's address instead of the real sender's. SYN floods and
reflection attacks rely on it. An ISP can drop such packets where they enter its network: this is
filtering under RFC 2827 (BCP 38).

## `port` Port

`category` network · `see` port-scan, firewall · `lessons` G5

Forms: port, ports

A number from 0 to 65,535 that a computer uses to tell its network services apart: the address
points to the machine, the port to a program on it. Under RFC 6335, ports 0–1023 are called System
Ports; by tradition, well-known services live there.

## `port-scan` Port scanning

`category` network · `see` port, firewall, banner · `lessons` G5

Forms: port scanning, port scan, port scans, scanning, scan

Reconnaissance: the attacker knocks on a server's ports in turn and builds a map of open services
from the answers. MITRE CAPEC calls it CAPEC-300 "Port Scanning"; in MITRE ATT&CK it falls under
techniques T1595 "Active Scanning" and T1046 "Network Service Discovery".

## `firewall` Firewall

`category` network · `see` port, port-scan, network-segmentation · `lessons` G5

Forms: firewall, firewalls

A device or program that decides which network traffic to let through and which to drop. The
reliable rule is deny by default: let through only what is expressly permitted (NIST SP 800-41).

## `banner` Banner

`category` network · `see` port-scan, vulnerability · `lessons` G5

Forms: banner, banners

The greeting a network service sends when someone connects. It often contains the program's name
and version, and from the version an attacker looks up known vulnerabilities. That is why it is
better to remove the version from the banner.

## `smb` SMB

`category` network · `see` port, worm · `lessons` K3

Forms: SMB, SMBv1

Server Message Block: the Windows protocol for shared folders and printers on a network, usually
on TCP port 445. Its old version, SMBv1, had the vulnerability through which WannaCry spread in
2017 (Microsoft bulletin MS17-010); turning it off is recommended.

## `heartbeat` Heartbeat

`category` network · `see` tls, out-of-bounds-read · `lessons` K2

Forms: heartbeat, heartbeats

An extension of TLS and DTLS from RFC 6520: one side sends a short piece of data and its length,
the other returns the same data, and so both know the connection is alive. A bug in how OpenSSL
handled it got the name Heartbleed in 2014.

## `ssh` SSH

`category` network · `see` key-pair, backdoor · `lessons` K7

Forms: SSH, sshd

A protocol for signing in to a remote computer securely and managing it. On a server the `sshd`
service accepts it: it checks a password or key and only then gives a command line. That is why
code that tampers with this check opens a door around the passwords.
