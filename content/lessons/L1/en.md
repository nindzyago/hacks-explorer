# Encryption: one key and a key pair

`lesson` L1 · `section` L · `wave` 1 · `format` 1

## Passport

- `cwe` 319
- `owasp` A02:2021
- `attack` T1040
- `severity` high
- `impact` Reading and changing messages when the shared key travelled in cleartext
- `defence` Hybrid scheme: the shared key sealed with the recipient's public key
- `class` Interception of an encryption key on the network

## Sources

- [NIST FIPS 197: Advanced Encryption Standard (AES)](https://csrc.nist.gov/pubs/fips/197/final)
- [NIST SP 800-38D: Galois/Counter Mode (GCM) and GMAC](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [NIST CSRC Glossary: symmetric key](https://csrc.nist.gov/glossary/term/symmetric_key)
- [RFC 8017: PKCS #1: RSA Cryptography Specifications Version 2.2](https://www.rfc-editor.org/rfc/rfc8017.html)
- [RFC 7748: Elliptic Curves for Security](https://www.rfc-editor.org/rfc/rfc7748.html)
- [MITRE CWE-319: Cleartext Transmission of Sensitive Information](https://cwe.mitre.org/data/definitions/319.html)
- [MITRE ATT&CK T1040: Network Sniffing](https://attack.mitre.org/techniques/T1040/)
- [OWASP Top 10:2021, A02 Cryptographic Failures](https://top10.owasp.org/2021/A02_2021-Cryptographic_Failures/)

## Participants

- `alice` **Alice** — 192.0.2.24 · `icon:user`
- `attacker` **Attacker** — 192.0.2.66 · `term:attacker`
- `bob` **Bob** — 198.51.100.20 · `icon:workstation`

## Zones

- `wifi` Shared Wi-Fi: `alice`, `attacker`
- `internet` Internet: `bob`

## Steps

### `key` The key in cleartext

`alice → bob` · `legit` · `without-defence`
Message: the shared key as is · Result: the attacker keeps a copy

```text
AES-128 key: ⟦3f9a 0b7d 52e1 c21e⟧
```

#### Simple

Alice wants to send Bob an account number that nobody else can read. They agreed to encrypt with
**one key**: the same key Alice locks the message with, Bob unlocks it with. But they can't meet
and hand the key over in person, so Alice sends the key over the network.

#### Step by step

Alice is in a café, on the shared Wi-Fi. Her laptop sends Bob the key in cleartext. The attacker
on the same network sees the packets going past and saves a copy of the key.

#### Deeper

Encryption where one key both encrypts and decrypts is called symmetric. The most widely used
cipher of this kind is AES, NIST standard FIPS 197 (2001): it encrypts data in 128-bit blocks with
a key of 128, 192 or 256 bits. The cipher itself is strong, but everything rests on keeping the key
secret. Sending the key in cleartext is CWE-319: whoever listens to the network (ATT&CK T1040)
gets it for free.

### `msg` The ciphertext goes to Bob

`alice → bob` · `legit` · `without-defence`
Message: AES ciphertext · Result: Bob decrypted it

```text
AES(key, "Pay to account: 4000 1234") → 8c1f 77a0 e3d5 91b4
```

#### Simple

Now Alice encrypts the message with that key and sends it. What travels over the network is a
string of meaningless bytes. Bob receives it, decrypts it with the same key and reads the account
number.

#### Step by step

Without the key, ciphertext looks like random noise: you can't even tell where the digits are. For
Alice and Bob everything works as it should.

#### Deeper

Symmetric encryption is fast, so it is what encrypts the data itself, even large amounts. The weak
spot is not the maths but how the key reached the other person. If the key crossed the network in
cleartext even once, all later messages under that key are open to whoever recorded it.

### `read` The attacker reads

`attacker → attacker` · `attack` · `without-defence`
Message: decrypting with the copied key · Result: account number read

#### Simple

The attacker has a copy of the key. He takes the captured ciphertext, decrypts it and **reads** the
account number as easily as Bob.

#### Step by step

The encryption was done properly, but the attacker holds the very same key. The maths can't tell
who holds the key: Bob or a stranger.

#### Deeper

This is the main problem that key-pair encryption solves: how to agree on a secret key with someone
you have never met, over a network that others are listening to.

### `change` A swapped account

`attacker → bob` · `attack` · `without-defence`
Message: new ciphertext from "Alice" · Result: Bob believed it

```text
AES(key, "Pay to account: ⟦4000 6666⟧")
```

#### Simple

The attacker can do more than read. He writes **his own** message with his own account number,
encrypts it with the same key and sends it to Bob. Bob decrypts it: it all checks out, so it must
be from Alice. The money goes to the attacker.

#### Step by step

To Bob, a message that decrypts correctly looks like proof that Alice wrote it. But anyone with the
key can make such a ciphertext.

#### Deeper

A shared key protects both secrecy and integrity only while just two people know it. Once a third
person knows it, they can both read and forge: the protection is gone entirely.

### `pub` Bob's public key

`bob → alice` · `safe` · `with-defence`
Message: Bob's public key · Result: anyone may know it

```text
Bob's public key (RSA-3072): 30 82 01 a2 30 0d
the private key stays with Bob only
```

#### Simple

Now Bob makes a **key pair**. He sends the public key to Alice, and he could show it to the whole
world: it can only lock. Only the second key, the private one, can unlock, and it never leaves
Bob's computer.

#### Step by step

The attacker sees Bob's public key, but it doesn't help him: the private key can't be worked out
from the public one. It is like an open padlock: anyone can snap it shut, but only Bob has the key
to it.

#### Deeper

This is asymmetric, or public-key, encryption. Well-known schemes are RSA (RFC 8017) and schemes on
elliptic curves, for example X25519 key exchange (RFC 7748). One question remains: how does Alice
know the key really is Bob's and not the attacker's? Digital signatures and certificates answer
it; that is the next lesson.

### `wrap` The key in an envelope

`alice → bob` · `safe` · `with-defence`
Message: envelope and ciphertext · Result: only Bob can open it

```text
envelope   = RSA-OAEP(Bob's public key, new AES key)
ciphertext = AES-GCM(new AES key, "Pay to account: 4000 1234")
```

#### Simple

Alice makes up a new random shared key. She encrypts the message with it, and puts the key itself
in an **envelope** locked with Bob's public key. Bob unlocks the envelope with his private key,
takes out the shared key and reads the message.

#### Step by step

Key-pair encryption is slow, so it only locks the short shared key. The long message is encrypted
by fast AES. This is called a hybrid scheme.

#### Deeper

TLS, for example, works this way: asymmetric keys help agree on a shared one, and a symmetric
cipher encrypts the data. For an RSA envelope, RFC 8017 requires new applications to support the
RSAES-OAEP scheme. AES-GCM mode (NIST SP 800-38D) doesn't only encrypt: it adds an authentication
tag to the ciphertext, and if a single bit of the ciphertext changes, the tag no longer matches.

### `peek` The attacker sees only noise

`attacker → attacker` · `attack` · `with-defence`
Message: trying to read · Result: no private key

#### Simple

The attacker recorded both the envelope and the ciphertext. But opening the envelope needs Bob's
private key, and the attacker doesn't have it. Without the shared key, the ciphertext stays noise.

#### Step by step

The attacker knows Bob's public key, but anyone can lock envelopes with it; only Bob can open
them.

#### Deeper

A new shared key is made for each conversation and never travels in cleartext. Even if the
attacker someday learns one such key, it won't open the other messages.

### `tamper` A changed ciphertext

`attacker → bob` · `attack` · `with-defence` · `stopped`
Message: altered ciphertext · Result: tag mismatch, discarded

```text
ciphertext: 8c1f 77a0 ⟦e4⟧d5 91b4   tag: 19b2 6ac0
```

#### Simple

The attacker tries changing bytes of the ciphertext at random to spoil the account number. Bob
decrypts, and the **tag** check fails: the program sees that the ciphertext was touched and throws
the message away.

#### Step by step

The sender computes the GCM tag using the shared key. The attacker doesn't know the key, so he
can't compute a valid tag for his altered ciphertext.

#### Deeper

An honest limit: encryption doesn't say **who** sent the message. The attacker could make his own
shared key, lock it with Bob's public key and write in Alice's name, and this check would not stop
him. Alice's digital signature is what proves the author; it is the subject of the next lesson.

## How to defend

- **Never send a shared key over the network in cleartext.** Agree on it through key-pair
  encryption, or use a ready-made protocol such as TLS.
- **Encrypt with proven, ready-made tools.** AES-GCM and other modes with an integrity check,
  RSA-OAEP or key exchange on elliptic curves. Don't invent your own cipher.
- **A new key for every conversation.** Then one leaked key doesn't open the other messages.
- **The private key never leaves the device.** It is not sent around, put in shared folders or in
  code.
- **Check whose public key it is.** A swapped public key breaks the whole scheme, so keys are
  confirmed with a signature and a certificate.
