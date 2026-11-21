# DNS poisoning

`lesson` G2 · `section` G · `wave` 1 · `format` 1

## Passport

- `cwe` 345, 331
- `attack` T1557
- `cvss` CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:C/C:N/I:H/A:N
- `cves` CVE-2008-1447
- `severity` high
- `impact` Every client of the resolver lands on the attacker's server instead of the real site
- `defence` Random query ID and port, DNSSEC signature checks
- `class` Forged DNS answers in a resolver's cache

## Sources

- [RFC 5452: Measures for Making DNS More Resilient against Forged Answers](https://www.rfc-editor.org/rfc/rfc5452.html)
- [RFC 4033: DNS Security Introduction and Requirements](https://www.rfc-editor.org/rfc/rfc4033.html)
- [RFC 8484: DNS Queries over HTTPS (DoH)](https://www.rfc-editor.org/rfc/rfc8484.html)
- [MITRE CAPEC-142: DNS Cache Poisoning](https://capec.mitre.org/data/definitions/142.html)
- [MITRE CWE-345: Insufficient Verification of Data Authenticity](https://cwe.mitre.org/data/definitions/345.html)
- [MITRE ATT&CK T1557: Adversary-in-the-Middle](https://attack.mitre.org/techniques/T1557/)
- [NVD: CVE-2008-1447](https://nvd.nist.gov/vuln/detail/CVE-2008-1447)

## Participants

- `user` **Visitor** — laptop, 192.0.2.24 · `term:victim`
- `resolver` **Resolver** — 192.0.2.53 · `icon:server` · `term:dns-resolver`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `ns` **Bank's DNS** — 198.51.100.7 · `icon:server` · `term:dns`

## Zones

- `isp` ISP network: `user`, `resolver`
- `internet` Internet: `attacker`, `ns`

## Steps

### `ask` What is the bank's address?

`user → resolver` · `legit`
Message: bank.example? · Result: no answer in the cache

```text
question: bank.example, type A (IPv4 address)
```

#### Simple

The visitor types bank.example into the browser. But computers find each other by numeric
addresses, not names. So the laptop asks the ISP's **resolver**: "What is the address of
bank.example?"

#### Step by step

The resolver first looks in its memory, the cache. The answer is not there, so it has to ask
whoever is in charge of the bank's names.

#### Deeper

DNS is the phone book of the internet: given a site's name, it returns the site's address. The
ISP's resolver serves thousands of clients and remembers each answer for as long as the answer
itself says. That is faster, but it has a price: one wrong answer in the cache reaches everyone who
asks after it.

### `recurse` The resolver asks the bank's DNS

`resolver → ns` · `legit`
Message: query with an ID · Result: waiting for the answer

```text
from 192.0.2.53, source port: ?
query ID: ?
question: bank.example, type A
```

#### Simple

The resolver sends the question to the bank's DNS server. It puts a **query ID** on the letter
and a return address with a port number. It will accept an answer only if the answer comes back to
that port with the same ID.

#### Step by step

The question and the answer each travel in a single UDP packet, without setting up a connection.
While the answer is on its way, the resolver waits and takes the first packet that fits.

#### Deeper

RFC 5452 lists how a resolver recognises "its" answer: the same question, the same query ID, the
answer comes from the address the question went to, and arrives at the port it was sent from. The
first packet that matches on every point is accepted. Such an answer carries no signature: whoever
guesses first wins.

### `flood` Hundreds of forged answers

`attacker → resolver` · `attack` · `without-defence`
Message: hundreds of fakes · Result: one ID matched

```text
from 198.51.100.7 (forged), ID 0x0001: bank.example = ⟦203.0.113.66⟧
from 198.51.100.7 (forged), ID 0x0002: bank.example = ⟦203.0.113.66⟧
and hundreds more
```

#### Simple

The attacker cannot read the resolver's question, but he can **guess**. He showers the resolver
with hundreds of answers in the name of the bank's DNS, each with a different query ID. If one ID
matches before the real answer arrives, the resolver believes the fake.

#### Step by step

The sender's address in UDP is easy to forge. This resolver always uses the same port, so only the
ID has to be guessed.

#### Deeper

The query ID is 16 bits, which is 65,536 values; according to RFC 5452, a truly random ID takes
32,768 attempts on average. With a fixed port, that is quite doable. In 2008 a way to do this
quickly was found: in NVD it is CVE-2008-1447, "the Kaminsky bug", an attack on resolvers made
possible by query IDs and ports that were not random enough. NVD maps it to CWE-331 "Insufficient
Entropy". MITRE CAPEC calls this attack CAPEC-142 "DNS Cache Poisoning".

### `cache` The fake in the cache

`resolver → user` · `attack` · `without-defence`
Message: 203.0.113.66 · Result: cached for everyone

```text
bank.example = ⟦203.0.113.66⟧   keep for: 86400 s (one day)
```

#### Simple

The resolver **remembers** the forged answer and hands it to the visitor. From now on every
client of the ISP who asks for the bank's address gets the attacker's address.

#### Step by step

The real answer from the bank's DNS arrives later, but the resolver has already answered this
question and drops the extra packet. The fake stays in the cache for as long as the attacker
chose.

#### Deeper

That is the power of poisoning: the attacker touches neither the laptop nor the bank's server. He
spoils one shared record, and it spreads to the clients by itself. CWE-345 "Insufficient
Verification of Data Authenticity" names the root of the problem: the resolver accepts data
without checking who really sent it.

### `visit` The wrong server

`user → attacker` · `attack` · `without-defence`
Message: opens bank.example · Result: the attacker's page, password stolen

#### Simple

The browser follows the address it got and lands **on the attacker's server**. The address bar
still honestly says bank.example. A fake login page waits there.

#### Step by step

The visitor enters a login and password, and they go to the attacker. The site name is right, so
the address bar gives nothing away.

#### Deeper

If the bank uses HTTPS, the attacker has no certificate for bank.example and the browser shows an
error. That is why DNS poisoning is often paired with sites without HTTPS, or with the hope that
the person clicks "continue anyway". MITRE ATT&CK lists DNS manipulation among the ways to get in
the middle, technique T1557 "Adversary-in-the-Middle".

### `guess` Guessing no longer works

`attacker → resolver` · `attack` · `with-defence` · `stopped`
Message: hundreds of fakes · Result: wrong port, no signature, all dropped

```text
from 198.51.100.7 (forged), ID 0x0001: bank.example = ⟦203.0.113.66⟧
DNSSEC signature: none
```

#### Simple

Now the resolver picks a **random ID and a random port** for every question. Guessing both at
once is close to impossible. Above all, it checks the answer's signature, and the fake has none.
The resolver drops every forged packet.

#### Step by step

The attacker's packets arrive at the wrong port or with the wrong ID. Even if something matched,
the resolver would not accept an answer without a valid DNSSEC signature.

#### Deeper

RFC 5452 requires a random source port and a random query ID: together that adds up to 16 more
bits to the ID, and the number of combinations grows tens of thousands of times. DNSSEC
(RFC 4033) adds the zone owner's digital signature to answers: the resolver checks that the data
came from the owner and was not changed. DNSSEC gives no encryption; it protects authenticity, not
secrecy.

### `signed` A signed answer

`ns → resolver` · `safe` · `with-defence`
Message: address + signature · Result: signature valid, cached

```text
bank.example = 198.51.100.10
DNSSEC signature: valid (bank.example zone key)
```

#### Simple

The real answer from the bank's DNS arrives, with the right ID and port and with a **signature**.
The resolver checks the signature and only then puts the answer in its cache.

#### Step by step

The resolver checks the bank's zone key along a chain: from the DNS root to the example zone and
on to the bank's zone. Without the bank's private key, the signature cannot be forged.

#### Deeper

Signatures only work if the owner has signed the zone and the resolver has turned checking on. If
either is missing, the random ID and port remain: they make guessing much harder, but do not rule
it out.

### `answer` The right address

`resolver → user` · `safe` · `with-defence`
Message: 198.51.100.10 · Result: the real bank opens

#### Simple

The visitor gets the bank's **real address** and opens its site. The attack failed, and the
visitor never even knew about it.

#### Step by step

The stretch from the laptop to the resolver can be protected too: DNS queries can be encrypted so
they cannot be swapped on the café or home network.

#### Deeper

That is what DNS over HTTPS is for (DoH, RFC 8484): questions to the resolver travel inside
ordinary HTTPS. DoH protects the road to the resolver; the random ID and port and DNSSEC protect
the cache itself. HTTPS on the bank's site stays the last line: even with a wrong address, the
browser will not trust a server without a certificate for bank.example.

## How to defend

- **Random query ID and port.** The resolver picks a random query ID and a random port for every
  question (RFC 5452). Keep the resolver software up to date.
- **DNSSEC.** The domain owner signs the zone; the ISP turns on signature checking on the
  resolver. Then a forged answer fails the check.
- **Do not open the resolver to the whole internet.** An ISP's or company's resolver answers only
  its own clients: then an outsider cannot choose the moment the resolver goes to ask.
- **Encrypted DNS on devices.** DNS over HTTPS or over TLS protects questions on their way from
  the laptop to the resolver.
- **HTTPS and HSTS on the site.** Even if the address is swapped, a fake site has no certificate
  for the real name, so the browser will not open it without a warning.
