# Network

`glossary` en · `category` network

## `mitm` Man in the middle

`category` network · `see` arp, tls, attacker · `lessons` G1

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

`category` network · `see` certificate, hsts, mitm · `lessons` G1

Forms: TLS, HTTPS

Transport Layer Security, the protocol for secure connections; HTTPS is HTTP over TLS. It encrypts
the data and checks the server by its certificate, so someone in the middle can neither read the
conversation nor quietly change it. The current version, TLS 1.3, is described in RFC 8446.

## `certificate` Certificate

`category` network · `see` tls, domain · `lessons` G1

Forms: certificate, certificates

An electronic document that ties a site's name to its public key and is signed by a certificate
authority. The browser checks that the certificate was issued for the domain it opened and signed
by someone it trusts. A certificate says whose site it is, not that the site is honest.

## `hsts` HSTS

`category` network · `see` tls, certificate · `lessons` G1

Forms: HSTS, Strict-Transport-Security

HTTP Strict Transport Security (RFC 6797): a header with which a site tells the browser to reach it
over HTTPS only. The browser itself turns `http` into `https` and does not let anyone click past a
certificate error. The HSTS preload list built into browsers protects the first visit.

## `network-segmentation` Network segmentation

`category` network · `see` ransomware, trust-boundary · `lessons` H2

Forms: network segmentation, segmentation

Splitting a network into parts with rules on who may talk to whom. Work computers do not see every
server, so an infection of one machine does not spread through the whole company.

## `dos` Denial of service

`category` network · `see` cia-triad · `lessons` A5

Forms: denial of service, denial-of-service, DoS, DDoS

An attack on availability: a service is overloaded or broken so that legitimate users
cannot use it. When the requests come from thousands of addresses at once, it is a
distributed attack, DDoS.
