# DDoS: SYN flood and amplification

`lesson` G4 · `section` G · `wave` 1 · `format` 1

## Passport

- `cwe` 770, 406
- `attack` T1499.001, T1498.002
- `severity` high
- `impact` The site is out of reach for customers while the attack lasts
- `defence` SYN cookies, DNS servers closed to outsiders
- `class` Denial of service: connection exhaustion and a reflected flood

## Sources

- [RFC 4987: TCP SYN Flooding Attacks and Common Mitigations](https://www.rfc-editor.org/rfc/rfc4987.html)
- [RFC 2827 (BCP 38): Network Ingress Filtering](https://www.rfc-editor.org/rfc/rfc2827.html)
- [RFC 9293: Transmission Control Protocol (TCP)](https://www.rfc-editor.org/rfc/rfc9293.html)
- [MITRE ATT&CK T1499.001: OS Exhaustion Flood](https://attack.mitre.org/techniques/T1499/001/)
- [MITRE ATT&CK T1498.002: Reflection Amplification](https://attack.mitre.org/techniques/T1498/002/)
- [MITRE CWE-406: Insufficient Control of Network Message Volume (Network Amplification)](https://cwe.mitre.org/data/definitions/406.html)
- [CISA: UDP-Based Amplification Attacks](https://www.cisa.gov/news-events/alerts/2014/01/17/udp-based-amplification-attacks)
- [CISA: Understanding Denial-of-Service Attacks](https://www.cisa.gov/news-events/news/understanding-denial-service-attacks)

## Participants

- `bots` **Botnet** — thousands of machines · `icon:attacker` · `term:botnet`
- `dns` **DNS server** — 198.51.100.53 · `icon:server` · `term:amplification`
- `server` **Shop** — shop.example · `term:dos`
- `user` **Customer** — 192.0.2.24 · `term:victim`

## Zones

- `internet` Internet: `bots`, `dns`

## Steps

### `normal` An ordinary connection

`user → server` · `legit`
Message: SYN → SYN-ACK → ACK · Result: connection open

```text
customer → shop:  SYN       (I want to connect)
shop → customer:  SYN-ACK   (agreed, waiting for confirmation)
customer → shop:  ACK       (confirmed)
```

#### Simple

Before opening a page, the customer's browser **agrees** on a connection with the shop. It takes
three short messages: "I want to", "agreed", "confirmed". After that they can talk.

#### Step by step

On receiving the SYN, the shop remembers the future connection and replies with a SYN-ACK. Until
the ACK arrives, the connection is "half-open" and takes a place in a queue.

#### Deeper

This is how, under RFC 9293, every TCP connection opens: the three-way handshake. The system keeps
a queue of limited size for half-open connections. According to RFC 4987, typical default sizes of
this queue range from half a dozen to several dozen places, unless the administrator raises them.

### `flood` An avalanche of SYNs

`bots → server` · `attack` · `without-defence`
Message: 100,000 × SYN · Result: the queue of half-open connections is full

```text
SYN from ⟦198.51.100.201⟧ (address forged)
SYN from ⟦198.51.100.202⟧ (address forged)
and so on, a hundred thousand times
```

#### Simple

Thousands of infected machines, a **botnet**, all send the shop "I want to connect" at once. Each
"I want to" takes a place in the queue. The senders' addresses are forged, so the confirmation
will never come.

#### Step by step

The shop sends SYN-ACKs to the forged addresses and waits. The places stay taken until the timeout
runs out, and new SYNs arrive faster than that.

#### Deeper

This is a SYN flood. The attack became public in 1996, and according to RFC 4987 it targets not
the network link but the server's own resources, so it needs fewer packets. In MITRE ATT&CK it is
sub-technique T1499.001 "OS Exhaustion Flood". CWE-770 names the root cause: a resource is
allocated for every request without limits.

### `drop` The customer cannot get in

`user → server` · `legit` · `without-defence`
Message: SYN from the customer · Result: queue full, dropped

#### Simple

The real customer also sends "I want to connect". But **there is no room in the queue**, and the
request is lost among the forged ones. For the customer the site simply does not open.

#### Step by step

The browser waits, tries again and in the end shows an error. The server itself may be barely
loaded: only the queue is full.

#### Deeper

That is what denial of service means: no data is stolen, but legitimate users cannot use the
service. When the flood comes from thousands of machines at once, the attack is called
distributed, DDoS.

### `spoof` A small question in someone else's name

`bots → dns` · `attack` · `without-defence`
Message: "from the shop" · Result: the DNS server trusts the return address

```text
from: ⟦203.0.113.10⟧ (the shop's address, forged)
question: 60 bytes, asks for the longest answer
```

#### Simple

The second trick is **amplification**. The bots ask an open resolver, a DNS server that answers
anyone, a short question, but instead of their own return address they write the shop's. The answer
will go to the shop.

#### Step by step

DNS runs over UDP: there is no connection, and the server cannot check who really asked. It
answers wherever the question seems to have come from.

#### Deeper

Forging the sender's address works only if the bots' ISP lets packets with other people's
addresses out. RFC 2827 (BCP 38) described back in 2000 how an ISP can drop such packets where
they enter its network.

### `amplify` An answer dozens of times bigger

`dns → server` · `attack` · `without-defence`
Message: answers ×50 · Result: the shop's link is jammed

```text
question: 60 bytes  →  answer: ⟦3,000 bytes⟧
thousands of bots × thousands of questions = a flood the link cannot carry
```

#### Simple

The DNS server answers honestly, and **each answer is dozens of times bigger than the
question**. Thousands of such answers pour onto the shop at once. The link is jammed, and real
customers cannot get through.

#### Step by step

Small questions cost the bots almost nothing, while the big flood of answers reaches the shop from
honest servers. Blocking "the attacker" by address is hard: the senders are other people's
servers.

#### Deeper

According to CISA, DNS amplifies traffic 28–54 times, NTP about 557 times, and memcached
10,000–51,000 times. In MITRE ATT&CK this is sub-technique T1498.002 "Reflection Amplification";
in MITRE CWE it is CWE-406 "Insufficient Control of Network Message Volume (Network
Amplification)".

### `cookies` SYN cookies

`bots → server` · `attack` · `with-defence` · `stopped`
Message: 100,000 × SYN · Result: the queue is not used, the avalanche takes nothing

```text
SYN from ⟦198.51.100.201⟧  →  SYN-ACK with a cookie, nothing in memory
SYN from ⟦198.51.100.202⟧  →  SYN-ACK with a cookie, nothing in memory
```

#### Simple

The shop has turned on **SYN cookies**. It still answers "I want to connect", but remembers
nothing: everything it needs is hidden in the reply itself. Forged SYNs take no room, and the
avalanche goes to waste.

#### Step by step

Into the SYN-ACK the shop puts a "cookie": a number computed from the addresses, the ports and a
secret. It sets aside memory only when an ACK with the right number comes back.

#### Deeper

According to RFC 4987, SYN cookies keep no state for half-open connections at all: the needed data
is encoded in the SYN-ACK's sequence number and rebuilt from the ACK. MITRE ATT&CK explicitly
recommends turning them on against SYN floods. The price is that some TCP options are lost, so,
according to RFC 4987, systems usually enable cookies only under load that looks like an attack,
or when the administrator decides to.

### `welcome` The customer gets in

`user → server` · `safe` · `with-defence`
Message: ACK with a valid cookie · Result: connection open, the purchase goes on

#### Simple

The real customer answers the SYN-ACK as expected and returns the **right number**. The shop
checks it and opens the connection. The site works even during the attack.

#### Step by step

No ACK comes from the forged addresses, so they cost the shop nothing but a single reply.

#### Deeper

SYN cookies save the queue, but not the network link. If the flood is so big that it jams the link
itself, help is needed upstream: the ISP or a DDoS protection service filters out the junk before
it reaches the site.

### `closed` The DNS server ignores outsiders

`bots → dns` · `attack` · `with-defence` · `stopped`
Message: "from the shop" · Result: not a client, no answer

```text
question from ⟦203.0.113.10⟧: not our client → do not answer
```

#### Simple

The owner of the DNS server has closed it to outsiders: now the server answers **only its own
clients**. The shop's address is not one of them, so there is no answer and nothing to reflect.

#### Step by step

Every closed server is one weapon fewer for the botnet. On top of that, the server limits its
response rate, so even a client's address cannot get a flood of thousands of answers from it.

#### Deeper

Against reflection attacks, CISA advises limiting the DNS response rate and dropping packets with
a forged sender address where they enter the network, under RFC 2827 (BCP 38): then the bots' ISP
will not let out a question that names the shop as its sender. Without a forged address,
amplification does not work: the answers would go back to the bots themselves. RFC 4987 warns
that not every ISP has such filters, so a site cannot rely on them alone.

## How to defend

- **SYN cookies.** Turn them on for servers and load balancers: the queue of half-open
  connections stops being a target.
- **Filtering forged addresses (BCP 38).** ISPs and any network should not let out packets with
  other people's sender addresses. That takes the point out of amplification and many SYN floods.
- **No open servers.** DNS, NTP and other UDP services answer only their own clients; turn on
  response rate limiting on DNS.
- **Upstream protection.** Against a flood that jams the link itself you need the ISP or a DDoS
  protection service to filter the junk before it reaches the site.
- **A plan for attack day.** Know in advance whom to call at the ISP, and watch the load so you
  notice an attack in its first minutes.
