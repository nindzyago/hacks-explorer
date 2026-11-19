# Man in the middle

`lesson` G1 · `section` G · `wave` 1 · `format` 1

## Passport

- `owasp` A02:2021
- `attack` T1557
- `severity` high
- `impact` The victim's traffic can be read and changed: passwords, codes, session cookies
- `defence` HTTPS with certificate checks and HSTS
- `class` Traffic interception on a shared network

## Sources

- [MITRE ATT&CK T1557: Adversary-in-the-Middle](https://attack.mitre.org/techniques/T1557/)
- [MITRE ATT&CK T1557.002: ARP Cache Poisoning](https://attack.mitre.org/techniques/T1557/002/)
- [OWASP Top 10:2021, A02 Cryptographic Failures](https://top10.owasp.org/2021/A02_2021-Cryptographic_Failures/)
- [OWASP: Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [OWASP: HTTP Strict Transport Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html)
- [RFC 826: An Ethernet Address Resolution Protocol](https://www.rfc-editor.org/rfc/rfc826.html)
- [RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446.html)
- [RFC 6797: HTTP Strict Transport Security (HSTS)](https://www.rfc-editor.org/rfc/rfc6797.html)
- [RFC 9542: IANA Considerations and IETF Protocol and Documentation Usage for IEEE 802 Parameters](https://www.rfc-editor.org/rfc/rfc9542.html)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)

## Participants

- `user` **Visitor** — laptop, 192.0.2.24 · `term:victim`
- `attacker` **Attacker** — 192.0.2.66 · `term:attacker`
- `router` **Café router** — 192.0.2.1 · `term:router`
- `bank` **Bank** — bank.example · `term:domain`

## Zones

- `cafe` Café Wi-Fi: `user`, `attacker`, `router` · `term:mitm`
- `internet` Internet: `bank`

## Steps

### `ask` Where is the router?

`user → router` · `legit`
Message: ARP: who is 192.0.2.1? · Result: asked everyone on the network

```text
ARP request to all: who has 192.0.2.1? tell 192.0.2.24
```

#### Simple

A visitor joins the café's shared Wi-Fi. To reach the internet, the laptop has to hand its data to
the **router**. But it only knows the router's number on the network, not where to physically send
the packets. So it asks out loud, to the whole network: "Who here is 192.0.2.1?"

#### Step by step

The laptop sends an ARP request to every device on the network. Only the router should answer, with
its physical address (its MAC address).

#### Deeper

Inside one network, packets are delivered by MAC address, while programs know IP addresses. The
ARP protocol (RFC 826, 1982) links the two: the request goes to everyone, the answer is stored in
the laptop's ARP table. ARP has no check at all on who answers: it was written for a network where
everyone is trusted. Everyone on the café network sees the request, the attacker included.

### `poison` "I am the router"

`attacker → user` · `attack`
Message: 192.0.2.1 is me · Result: stored in the ARP table

```text
ARP reply: 192.0.2.1 is at ⟦00-00-5E-00-53-66⟧
```

#### Simple

The attacker sits in the same café, on the same network. He answers before the router and
**pretends to be it**: "192.0.2.1 is me, send it to me." The laptop believes him: it has no way to
check.

#### Step by step

The laptop writes into its ARP table: the router 192.0.2.1 is at the attacker's MAC address. From
now on, everything the visitor sends to the internet goes to the attacker first.

#### Deeper

This is ARP cache poisoning; in MITRE ATT&CK it is sub-technique T1557.002 of technique T1557
"Adversary-in-the-Middle". Under RFC 826, a device updates an entry it already knows from any ARP
packet, even one it never asked for. So the attacker simply keeps repeating the fake reply so the
real router cannot overwrite it. Usually he fools the router the same way, so the replies also flow
through him. The MAC addresses in this lesson come from the range set aside for documentation
(RFC 9542).

### `login` Password in plain text

`user → attacker` · `attack` · `without-defence`
Message: login and password over HTTP · Result: reached the attacker

```http
POST http://bank.example/login
login=anna&password=⟦Cat2024⟧
```

#### Simple

The visitor logs in to the bank. The bank's site uses plain HTTP, with no encryption. The laptop
hands the login and password to the "router", which is really the attacker. To the visitor
everything looks normal.

#### Step by step

The request from the login page goes to the attacker's MAC address. The password sits in it as is,
in plain text.

#### Deeper

HTTP neither encrypts nor checks who is on the other end. Anyone the packets pass through can read
them and change them. OWASP Top 10:2021 counts sending data in clear text under item A02
"Cryptographic Failures".

### `read` A copy of the password

`attacker → attacker` · `attack` · `without-defence`
Message: password copied · Result: stolen

#### Simple

The attacker **reads** the request and keeps the login and password. The visitor will never know.

#### Step by step

The attacker's program takes apart the passing packets and picks out passwords and session cookies.

#### Deeper

From the middle, the attacker can not only read but also change things: put his own link or script
into a reply, serve a fake page, take the session cookie and log in without a password. That is why
the technique is called "in the middle": both ends of the conversation talk through him.

### `forward` Passing it on

`attacker → bank` · `attack` · `without-defence`
Message: the same request · Result: logged in, nobody noticed

#### Simple

So as not to be noticed, the attacker **passes** the request on, through the real router, to the
bank. The bank lets the visitor in, the page opens. Everything works; only the password is already
stolen.

#### Step by step

The attacker sends the packet to the real router, and it goes on to the internet. The bank's reply
comes back the same way, through the attacker.

#### Deeper

The connection never breaks, so the victim notices nothing. Only small things can give the attack
away: a little extra delay, or two IP addresses with the same MAC address in the ARP table. Those
are the signs intrusion detection systems look for.

### `hello` A secure connection

`user → attacker` · `legit` · `with-defence`
Message: TLS: I want bank.example · Result: reached the attacker

```text
https://bank.example/login
TLS: start a connection to bank.example
```

#### Simple

Now the bank works only over HTTPS. The laptop still sends its data to the attacker: the network is
still poisoned. But first of all the browser asks the bank to **prove it is the bank**.

#### Step by step

The browser starts a TLS handshake and names the site it wants to talk to: bank.example. It will
send the password only once the secure connection is ready.

#### Deeper

TLS (version 1.3 is described in RFC 8446) encrypts the data and checks the server: the server
always has to prove who it is (on the first connection, with a certificate). The bank also sends an HSTS header, and the
browser remembers: for bank.example, HTTPS only. So the attacker cannot slip the visitor a plain
HTTP version of the site.

### `swap` Someone else's certificate

`attacker → user` · `attack` · `with-defence` · `stopped`
Message: the attacker's certificate · Result: rejected by the browser, connection closed

```text
certificate needed for:  bank.example
presented:               ⟦signed by someone the browser does not trust⟧
```

#### Simple

To read the password, the attacker has to pretend to be the bank. He answers with his own
certificate. The browser checks it and sees: **this is not the bank's certificate**. The connection
is closed, the password is never sent. This is where the attack stops.

#### Step by step

The browser checks that the certificate was issued for bank.example and signed by an authority it
trusts. The check fails, so the browser closes the connection and shows an error.

#### Deeper

The attacker does not have the bank's real certificate with its private key. If he just passes the
packets on, he sees only ciphertext. Browsers usually let a person click past a certificate warning,
and that is what the attacker counts on. For a site with HSTS the browser offers no such button (RFC
6797). HSTS works from the first secure visit; the very first visit over HTTP is covered by the HSTS
preload list built into browsers.

## How to defend

- **HTTPS on the whole site.** Every page, not just the login, is served over TLS. Then whoever
  sits in the middle sees only ciphertext.
- **HSTS.** The site sends a `Strict-Transport-Security` header, and the browser itself turns
  `http` into `https` and does not let anyone click past a certificate error. Add the site to the
  HSTS preload list to protect the first visit too.
- **Do not click past a certificate error.** A warning on a shared network is a reason to close the
  page, not to press "continue anyway".
- **Protection on the switch.** In a company network the switch can check ARP replies against the
  addresses handed out by DHCP and drop fake ones (DHCP snooping and Dynamic ARP Inspection). For
  the most important devices, static ARP table entries help.
- **Client isolation on Wi-Fi.** A guest network that stops visitors' devices from talking to each
  other directly keeps a fake ARP reply from reaching the neighbour.
- **A VPN on other people's networks.** All traffic goes through an encrypted tunnel to your own
  server, and nobody on the café network can read it.
