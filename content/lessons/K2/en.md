# Heartbleed (CVE-2014-0160)

`lesson` K2 · `section` K · `wave` 1 · `format` 1

## Passport

- `cwe` 125
- `owasp` A06:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N
- `cves` CVE-2014-0160
- `severity` high
- `impact` Reading the server's memory 64 KB at a time: passwords, session cookies, the private key
- `defence` Update OpenSSL, then replace keys and certificates
- `class` Out-of-bounds read in a TLS library

## Sources

- [NVD: CVE-2014-0160](https://nvd.nist.gov/vuln/detail/CVE-2014-0160)
- [OpenSSL Security Advisory, 07 Apr 2014: TLS heartbeat read overrun](https://www.openssl.org/news/secadv/20140407.txt)
- [CISA Alert TA14-098A: OpenSSL 'Heartbleed' vulnerability (CVE-2014-0160)](https://www.cisa.gov/news-events/alerts/2014/04/08/openssl-heartbleed-vulnerability-cve-2014-0160)
- [CISA: Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [RFC 6520: TLS and DTLS Heartbeat Extension](https://www.rfc-editor.org/rfc/rfc6520)
- [MITRE CWE-125: Out-of-bounds Read](https://cwe.mitre.org/data/definitions/125.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)
- [OWASP Top 10:2021, A06 Vulnerable and Outdated Components](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)

## Participants

- `user` **Customer** — 192.0.2.30 · `icon:user`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — OpenSSL 1.0.1f · `term:web-server`
- `mem` **Memory** — server process · `icon:db`

## Zones

- `internet` Internet: `user`, `attacker`
- `site` Site shop.example: `server`, `mem` · `term:trust-boundary`

## Steps

### `beat` Are you there?

`user → server` · `legit`
Message: beat: "cat", 3 · Result: accepted

```text
HeartbeatRequest  length = 3  data = "cat"
```

#### Simple

The customer's browser and the shop's server keep a secure **TLS** connection. To check that the
other side is still there, the browser sends a short "heartbeat": a word and its length. The
server must send the same word back.

#### Step by step

The message has two fields: the data itself (`cat`) and a number saying how many bytes it has
(3). The server puts the message into its memory and prepares the reply.

#### Deeper

This is the Heartbeat extension from RFC 6520 (February 2012). It lets a side check that its peer
is alive without a new handshake, and in DTLS it also helps find the right packet size. The length
field takes two bytes, so it can hold a number up to 65,535. The RFC says: if the length is too
large, the message is discarded silently.

### `echo` Echo

`server → user` · `legit`
Message: "cat" · Result: still connected

#### Simple

The server answers "cat". The browser sees that the connection is alive. That is how it is meant
to work.

#### Step by step

The server takes from its memory as many bytes as **the length field says**, starting where the
data lies, and sends them back.

#### Deeper

All is well here because the number 3 and the real length of the word match. But the server did
not compare them: it trusted the number the other side sent. Next to that word in memory lies
other data of the process: other customers' requests, their passwords and cookies, the server's
keys.

### `lie` A false length

`attacker → server` · `attack`
Message: "cat", 65535 · Result: accepted

```text
HeartbeatRequest  length = ⟦65535⟧  data = "cat"
```

#### Simple

The attacker sends the same kind of heartbeat but **lies about the length**: the word still has
three letters, while the length field says 65,535.

#### Step by step

No password or login is needed: a heartbeat can be sent right after the connection is set up. The
server accepts the message like any other.

#### Deeper

Hence the CVSS 3.1 base metrics in NVD: over the network (`AV:N`), simple (`AC:L`), with no
privileges and no user action (`PR:N`, `UI:N`). The TLS and DTLS code in OpenSSL 1.0.1 before
1.0.1g is affected; the OpenSSL advisory adds the 1.0.2-beta releases. The bug was found by Neel
Mehta of Google Security.

### `overread` Reading past the end

`server → mem` · `attack` · `without-defence`
Message: copy 64 KB · Result: too much read

```text
need 65535 bytes, have 3: ⟦65532 bytes of other data⟧
```

#### Simple

The server faithfully copies 65,535 bytes starting at the word "cat". Three bytes are the word;
the rest is **whatever lay in memory after it**.

#### Step by step

A C program does not check bounds by itself: tell it "copy 64 KB from here" and it will. The
server never compared the number from the length field with the real size of the message it got.

#### Deeper

This is an out-of-bounds read, CWE-125: a relative of the buffer overflow, except that data is
not damaged but leaks out. The OpenSSL advisory of 7 April 2014 put it this way: a missing bounds
check in the heartbeat handling can reveal up to 64 KB of memory to the connected peer.

### `leak` The leak

`server → attacker` · `attack` · `without-defence`
Message: 64 KB of memory · Result: secrets with the attacker

```text
cat ⟦…password=…; session=…; -----BEGIN RSA PRIVATE KEY-----…⟧
```

#### Simple

Instead of "cat", the attacker gets **64 KB of the server's memory**. It can hold customers'
passwords, their session cookies and even the private key of the site's certificate.

#### Step by step

The attacker repeats the request again and again. Each time a new chunk arrives, and from the
chunks they piece together what they need.

#### Deeper

CISA listed what could be taken: encryption keys, user names and passwords, protected data, and
memory addresses that help get around exploit defences. With the private key an attacker can
pretend to be the server, and without forward secrecy (PFS) decrypt traffic recorded earlier. So
the CVSS vector has `C:H` (confidentiality) but `I:N` and `A:N`: the bug itself changes and
breaks nothing. The NVD base score is 7.5 out of 10, high.

### `check` Checking the length

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: "cat", 65535 · Result: discarded, the attack failed

```text
if length + 19 > message size: ⟦discard silently⟧
```

#### Simple

The server runs an **updated OpenSSL**. It compares the length field with the real size of the
message: 65,535 bytes do not fit into three letters. The message is dropped and no reply goes out.

#### Step by step

The 19 is the service bytes from RFC 6520: the type (1), the length field (2) and the required
padding (at least 16). If the claimed data plus these is longer than the message that arrived, the
server discards it, as the RFC requires.

#### Deeper

The fix shipped in OpenSSL 1.0.1g; those who could not update at once could rebuild the library
without heartbeats (`-DOPENSSL_NO_HEARTBEATS`). But an update does not bring back what has already
leaked. CISA advised treating keys made with a vulnerable version as compromised and issuing new
ones after the update. The vulnerability was added to the KEV catalog on 4 May 2022.

## How to defend

- **Update the library.** OpenSSL 1.0.1g and later fix the bug. Check more than the web server:
  OpenSSL runs in mail servers, VPNs, routers and other devices.
- **Replace keys and certificates.** After the update, make a new private key, get a new
  certificate and revoke the old one: the old key may have leaked.
- **Reset sessions and passwords.** Cookies and passwords that were in memory may have leaked too:
  end all sessions and ask users to change their passwords.
- **Turn on forward secrecy (PFS).** Then even a stolen server key cannot decrypt traffic recorded
  earlier.
- **Know your components.** A list of which library runs where, and in which version, helps you
  find vulnerable systems quickly when a new advisory comes out.
- **Don't trust lengths from the other side.** In your own code, always compare the claimed size
  with the real one.
