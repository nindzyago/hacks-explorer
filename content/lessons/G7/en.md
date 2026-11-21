# BGP hijacking

`lesson` G7 · `section` G · `wave` 3 · `format` 1

## Passport

- `severity` high
- `impact` Traffic meant for someone else's addresses goes to the attacker's network, where it can be read, changed or dropped
- `defence` RPKI route origin validation and filters
- `class` Route hijacking on the internet

## Sources

- [RFC 4271: A Border Gateway Protocol 4 (BGP-4)](https://www.rfc-editor.org/rfc/rfc4271.html)
- [RFC 4272: BGP Security Vulnerabilities Analysis](https://www.rfc-editor.org/rfc/rfc4272.html)
- [RFC 6480: An Infrastructure to Support Secure Internet Routing](https://www.rfc-editor.org/rfc/rfc6480.html)
- [RFC 6811: BGP Prefix Origin Validation](https://www.rfc-editor.org/rfc/rfc6811.html)
- [RFC 9319: The Use of maxLength in the Resource Public Key Infrastructure (RPKI)](https://www.rfc-editor.org/rfc/rfc9319.html)
- [RFC 1812: Requirements for IP Version 4 Routers](https://www.rfc-editor.org/rfc/rfc1812.html)
- [RFC 5398: Autonomous System (AS) Number Reservation for Documentation Use](https://www.rfc-editor.org/rfc/rfc5398.html)
- [RFC 5737: IPv4 Address Blocks Reserved for Documentation](https://www.rfc-editor.org/rfc/rfc5737.html)

## Participants

- `user` **Customer** — 192.0.2.24
- `isp` **Provider** — AS64500 · `icon:router` · `term:autonomous-system`
- `attacker` **Rogue network** — AS64511 · `term:attacker`
- `bank` **Bank** — AS64496, 198.51.100.0/24 · `icon:server`

## Zones

- `home` Provider network: `user`, `isp`
- `evil` Attacker's network: `attacker` · `danger`
- `owner` Bank network: `bank`

## Steps

### `announce` "These addresses are mine"

`bank → isp` · `legit`
Message: 198.51.100.0/24 at AS64496 · Result: route stored

```text
BGP UPDATE
  addresses:  198.51.100.0/24
  path:       AS64496
```

#### Simple

The internet is thousands of separate networks. The bank's network tells its neighbours:
**"addresses 198.51.100.0/24 are here, bring packets for them to me"**. The provider notes down:
to reach the bank, take this road.

#### Step by step

The bank sends an announcement over BGP. It holds the address range and the number of the
network where those addresses live, AS64496. The announcement passes from network to network,
and each one adds its own number to the path.

#### Deeper

BGP-4 is defined in RFC 4271. Every large network is an autonomous system with its own number.
The network numbers in this lesson come from the range reserved for documentation (RFC 5398),
the addresses from RFC 5737. BGP does not check that a network really holds the addresses it
announces: RFC 4272 names this as one of the protocol's fundamental weaknesses.

### `hijack` "No, they're mine, and more precisely"

`attacker → isp` · `attack` · `without-defence`
Message: 198.51.100.0/25 at AS64511 · Result: accepted, it is more specific

```text
BGP UPDATE
  addresses:  ⟦198.51.100.0/25⟧
  path:       ⟦AS64511⟧
```

#### Simple

A rogue network announces: **"half of those addresses are here"**. It is a lie, but the provider
has no way to check and accepts the announcement.

#### Step by step

The attacker announces a narrower range, 198.51.100.0/25: the bank's first 128 addresses. Now the
provider has two entries: a wide one to the bank and a narrow one to the rogue network.

#### Deeper

A narrower announcement is dangerous because it beats the wider one everywhere it is accepted: a
router always picks the most specific matching route. Hijacks also happen by accident, when a
network announces someone else's addresses because of a misconfiguration rather than malice.

### `rov` RPKI check

`attacker → isp` · `attack` · `with-defence` · `stopped`
Message: 198.51.100.0/25 at AS64511 · Result: RPKI: Invalid, announcement dropped

```text
bank's ROA:    198.51.100.0/24, max length 24, AS64496 only
announcement:  ⟦198.51.100.0/25 from AS64511⟧ → Invalid
```

#### Simple

This time the bank has put a signed record in a shared registry in advance: **"only AS64496
announces my addresses"**. The provider checks every announcement against it. The rogue network
does not match, so the provider **drops** the announcement. The attack stops here.

#### Step by step

The record in the registry is called a ROA. It holds the bank's range, its network number and the
narrowest length that may be announced. The /25 announcement from AS64511 falls inside the bank's
range but matches neither the number nor the length. The result of the check is Invalid.

#### Deeper

RPKI is described in RFC 6480: the holder of the addresses signs the ROA with a key tied to a
certificate for those addresses. Origin validation is defined in RFC 6811 and has three outcomes:
Valid, Invalid and NotFound. The RFC leaves what to do with Invalid to each network's policy; it
protects when such announcements are dropped. RFC 9319 advises against allowing extra length in a
ROA: otherwise an attacker can announce a narrow range with a forged path that ends in the bank's
number, and the check will let it through.

### `request` The customer's packet

`user → isp` · `legit`
Message: packet to 198.51.100.10 · Result: looking up a route

```text
to:  198.51.100.10  (bank.example)
```

#### Simple

The customer opens the bank's website. Their computer hands the packet to **the provider**, which
decides where to carry it next.

#### Step by step

The bank's website is at 198.51.100.10. The provider looks in its routing table for the entries
this address falls into.

#### Deeper

Under the longest-match rule (RFC 1812, the section on CIDR), a router uses the matching entry
with the longest prefix, that is, the narrowest range.

### `misroute` The wrong way

`isp → attacker` · `attack` · `without-defence`
Message: the customer's packet · Result: delivered to the rogue network

#### Simple

The address 198.51.100.10 falls into the narrow range the rogue network announced. The provider
sends the packet to **the attacker**, not the bank.

#### Step by step

Both entries match: /24 to the bank and /25 to the rogue network. The narrow one is more specific,
so it wins. Every network that accepted the false announcement does the same.

#### Deeper

The hijack is not limited to one provider: the false announcement spreads across the internet,
and traffic to those addresses from all over the world can go the wrong way. The customer
configured nothing and did nothing wrong.

### `blackhole` Read or dropped

`attacker → attacker` · `attack` · `without-defence`
Message: the bank's traffic at the rogue network · Result: intercepted

#### Simple

The rogue network now receives traffic meant for the bank. It can **read** it, fake the replies
or just drop it, and then the bank's site disappears for its customers.

#### Step by step

The attacker sees anything that is not encrypted. It can run a server at 198.51.100.10 and answer
instead of the bank.

#### Deeper

TLS protects against a fake site: the attacker does not have the private key for bank.example's
certificate, and the browser will show an error. But TLS does not save availability: the traffic
still never reaches the bank. That is why routes are protected in the network itself.

### `deliver` The packet arrives

`isp → bank` · `safe` · `with-defence`
Message: the customer's packet · Result: delivered to the bank

#### Simple

The false route is not in the provider's table. The customer's packet goes **to the bank**, as it
should.

#### Step by step

The provider has only one matching entry: 198.51.100.0/24 to AS64496. The packet leaves along
that route.

#### Deeper

RPKI origin validation only checks who stands at the start of the path, that is, whose addresses
these are. It does not catch a forged path as a whole. Other mechanisms exist for that, and until
they are everywhere, providers add filters on top of RPKI: they accept from each neighbour only
the addresses that neighbour should announce.

## How to defend

- **ROAs for your addresses.** The address holder publishes an RPKI record: which ranges, and
  which network number may announce them. No extra length: only the ranges the network really
  announces.
- **Origin validation at providers.** Networks check every announcement against RPKI and drop
  Invalid ones.
- **Per-neighbour filters.** A provider accepts from a customer only that customer's own addresses
  and does not pass on anyone else's.
- **Watch your own addresses.** The holder monitors who announces its ranges and from where, and
  learns about a hijack quickly.
- **Encryption on top of the network.** HTTPS with certificate checks stops intercepted traffic
  from being read or changed, though it does not save availability.
