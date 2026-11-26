# End-to-end encryption in messengers

`lesson` L5 · `section` L · `wave` 3 · `format` 1

## Passport

- `cwe` 311, 322
- `owasp` A02:2021
- `attack` T1557
- `severity` high
- `impact` All the chats go to whoever breaks into the server; the other person's key gets swapped
- `defence` End-to-end encryption and comparing key fingerprints
- `class` Reading chats on the server

## Sources

- [Signal: The X3DH Key Agreement Protocol](https://signal.org/docs/specifications/x3dh/)
- [Signal: The Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [Signal: Specifications](https://signal.org/docs/)
- [MITRE CWE-311: Missing Encryption of Sensitive Data](https://cwe.mitre.org/data/definitions/311.html)
- [MITRE CWE-322: Key Exchange without Entity Authentication](https://cwe.mitre.org/data/definitions/322.html)
- [MITRE ATT&CK T1557: Adversary-in-the-Middle](https://attack.mitre.org/techniques/T1557/)
- [OWASP Top 10:2021, A02 Cryptographic Failures](https://top10.owasp.org/2021/A02_2021-Cryptographic_Failures/)
- [RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446.html)

## Participants

- `alice` **Alice** — 192.0.2.24 · `icon:phone`
- `server` **Server** — chat.example · `icon:server` · `term:e2e-encryption`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `bob` **Bob** — 198.51.100.42 · `icon:phone`

## Zones

- `service` Chat: `server`

## Steps

### `keys` Bob publishes his keys

`bob → server` · `safe` · `with-defence`
Message: Bob's public keys · Result: stored on the server

```text
Bob's identity key:     5b0e 77c1
signed prekey:          a913 02fd + signature
one-time prekeys:       d4e2, 61af, 0c9b
```

#### Simple

A messenger with end-to-end encryption. When Bob installs the app, his phone makes a **key pair**
and sends only the public keys to the server. The private keys never leave Bob's phone.

#### Step by step

The server keeps Bob's public keys like business cards: anyone who wants to write to Bob takes them
and can encrypt a message so that only Bob's phone can read it.

#### Deeper

In the X3DH protocol (a Signal specification) Bob publishes an identity key, a signed prekey with a
signature made by the identity key, and a set of one-time prekeys. From these and Alice's keys the
phones derive a shared secret, and the server, which has no private keys, can't compute that
secret.

### `send` Text to the server

`alice → server` · `legit` · `without-defence`
Message: plain text · Result: the server stores the text

```text
TLS to the server → "Meet at the entrance, door code ⟦4815⟧"
```

#### Simple

First, an ordinary messenger without end-to-end encryption. Alice writes to Bob. On the way to the
server the message is encrypted, but **on the server** it is decrypted and kept as is until it is
delivered.

#### Step by step

Encryption covers only the "phone to server" and "server to phone" legs. The server itself sees
every message in full.

#### Deeper

TLS (RFC 8446) protects the channel to the server, not the data on it. Storing and handling chats
without encryption that the server can't open is a case of CWE-311, Missing Encryption of
Sensitive Data: everything depends on how well the server itself is guarded and who has access to
it.

### `seal` Ciphertext for Bob

`alice → server` · `safe` · `with-defence`
Message: sealed for Bob · Result: the server sees only ciphertext

```text
to: Bob   ciphertext: 2f8d 91c0 7a44 e1b3
```

#### Simple

Now end-to-end encryption. Alice's phone fetches Bob's public keys from the server and encrypts the
message **right on the phone**. The server receives ciphertext and knows whom to hand it to, but
can't read it.

#### Step by step

Only Bob's phone has the key to decrypt it. The server works like a postman with a sealed envelope.

#### Deeper

After the first message the phones carry on with the Double Ratchet algorithm: a new key for every
message. One leaked key opens neither past messages nor, after a few more messages, future ones;
the specification calls these forward security and break-in recovery. End-to-end encryption can't
hide who writes to whom and when: otherwise the server couldn't deliver the message.

### `deliver` Delivery to Bob

`server → bob` · `legit`
Message: Alice's message · Result: Bob read it

#### Simple

The server hands the message to Bob. Without end-to-end encryption it is text; with it, it is
ciphertext that Bob's phone decrypts with its private key.

#### Step by step

To Alice and Bob both versions look the same: the message arrived and shows in the chat. The only
difference is who else can read it.

#### Deeper

End-to-end means only the end devices of the people in the conversation can decrypt. If the server
holds the keys, it is no longer end-to-end, even if the data is stored on it in encrypted form.

### `break` Breaking into the server

`attacker → server` · `attack`
Message: admin login · Result: access to the database

#### Simple

The attacker stole an administrator's password and **got onto the messenger's server**. Now he
sees everything stored there.

#### Step by step

It happens: servers get broken into, data leaks, staff make mistakes. The question is what is on
the server at that moment.

#### Deeper

The break-in could be anything: a stolen password, a vulnerability, a dishonest employee or a
demand to hand over data. End-to-end encryption is designed precisely for the case when the server
can't be considered trustworthy.

### `dump` All the chats

`server → attacker` · `attack` · `without-defence`
Message: chat archive · Result: everything read

```text
Alice → Bob: "Meet at the entrance, door code ⟦4815⟧"
```

#### Simple

Without end-to-end encryption, all the chats sit on the server in cleartext. The attacker
**downloads them all** and reads other people's messages.

#### Step by step

Neither Alice nor Bob will notice anything: their phones work as before.

#### Deeper

Encryption only up to the server protects against a neighbour on the Wi-Fi, not against someone
who has access to the server itself. That is why it matters where the keys live: with the service,
or only with the people.

### `noise` Ciphertext only

`server → attacker` · `attack` · `with-defence`
Message: only noise · Result: nothing to read

```text
Alice → Bob: 2f8d 91c0 7a44 e1b3
```

#### Simple

With end-to-end encryption, the attacker downloads the same archive, but it holds **only
ciphertext**. Alice's and Bob's private keys are not on the server, so there is nothing to decrypt
it with.

#### Step by step

The attacker sees who wrote to whom and when. But not what.

#### Deeper

So the attacker tries another route: he controls the server, and the server hands out public keys,
so he could slip Alice his own key instead of Bob's. That is the next step.

### `swap` Bob's key, swapped

`server → alice` · `attack` · `with-defence` · `stopped`
Message: "Bob's new key" · Result: fingerprint mismatch

```text
fingerprint checked with Bob:  12345 67890 24680
fingerprint of the new key:    ⟦55555 66666 77777⟧
```

#### Simple

The attacker hands Alice **his own** key, posing as Bob's. If Alice trusted it, she would be
encrypting messages for the attacker. But when they met, Alice and Bob compared key fingerprints
by scanning a QR code. The new key doesn't match the verified one, and Alice doesn't write until
she checks with Bob in person.

#### Step by step

A fingerprint is a short form of a public key. The attacker can't make a key with the same
fingerprint. A key can also change honestly, say Bob got a new phone, so a changed key is a reason
to ask again, not to panic.

#### Deeper

The X3DH specification (section 4.1) says it plainly: if the parties don't compare identity keys
over an authenticated channel, for example by hand or with a QR code, they get no cryptographic
guarantee of who they are talking to. A key exchange without checking the other party is CWE-322.

## How to defend

- **Choose a messenger with end-to-end encryption on by default.** Not only in "secret chats" but
  in every conversation, group chats included.
- **Compare key fingerprints with the people who matter.** When you meet, scan the QR code or
  compare the digits.
- **The other person's key changed? Ask again.** Over another channel: a call or in person.
- **Look after the phone itself.** End-to-end encryption protects the road and the server, but not
  an unlocked phone: screen lock, updates, no unknown apps.
- **Remember what the server sees.** Who writes to whom and when is known to the server even with
  end-to-end encryption.
