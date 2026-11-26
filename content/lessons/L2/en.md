# Signatures and certificates

`lesson` L2 · `section` L · `wave` 1 · `format` 1

## Passport

- `cwe` 347, 295
- `owasp` A02:2021
- `attack` T1557
- `severity` high
- `impact` The password goes to the attacker if a program doesn't check the certificate's signature
- `defence` Checking the signature and the certificate chain up to a root authority
- `class` Certificate forgery

## Sources

- [RFC 5280: Internet X.509 Public Key Infrastructure Certificate and CRL Profile](https://www.rfc-editor.org/rfc/rfc5280.html)
- [RFC 8555: Automatic Certificate Management Environment (ACME)](https://www.rfc-editor.org/rfc/rfc8555.html)
- [RFC 9162: Certificate Transparency Version 2.0](https://www.rfc-editor.org/rfc/rfc9162.html)
- [RFC 8017: PKCS #1: RSA Cryptography Specifications Version 2.2](https://www.rfc-editor.org/rfc/rfc8017.html)
- [MITRE CWE-347: Improper Verification of Cryptographic Signature](https://cwe.mitre.org/data/definitions/347.html)
- [MITRE CWE-295: Improper Certificate Validation](https://cwe.mitre.org/data/definitions/295.html)
- [MITRE ATT&CK T1557: Adversary-in-the-Middle](https://attack.mitre.org/techniques/T1557/)
- [OWASP Top 10:2021, A02 Cryptographic Failures](https://top10.owasp.org/2021/A02_2021-Cryptographic_Failures/)
- [OWASP: Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)

## Participants

- `ca` **CA** — ca.example · `icon:server` · `term:certificate-authority`
- `site` **Shop** — shop.example · `icon:server` · `term:domain`
- `attacker` **Attacker** — 192.0.2.66 · `term:attacker`
- `user` **Browser** — 192.0.2.24 · `icon:browser` · `term:victim`

## Zones

- `internet` Internet: `ca`, `site`
- `cafe` Café Wi-Fi: `attacker`, `user`

## Steps

### `request` Applying for a certificate

`site → ca` · `legit`
Message: shop.example + key · Result: the CA checks the domain

```text
request: name shop.example
         shop's public key 30 82 01 0a 02 82
```

#### Simple

The shop wants browsers to be able to make sure it really is shop.example. It makes a key pair and
sends the **public key** together with the site's name to a certificate authority, an organisation
browsers trust.

#### Step by step

The authority doesn't take the shop's word for it. It checks that the applicant controls the
domain: for example, it asks for a special string to be put on the site or in DNS, and checks it
itself. The shop's private key is not part of the request and stays on the server.

#### Deeper

The ACME protocol (RFC 8555), for example, works this way: the authority sets `http-01` or `dns-01`
challenges and issues the certificate only once it has confirmed they are done. What is checked is
control of the domain, not the owner's honesty: a certificate says whose site it is, not that the
site is good.

### `issue` A signed certificate

`ca → site` · `safe`
Message: signed certificate · Result: signed with the CA's key

```text
subject:    shop.example
key:        30 82 01 0a 02 82
valid:      2026-11-01 to 2027-01-30
issuer:     Example Issuing CA
signature:  ⟦the authority's digital signature⟧
```

#### Simple

The authority puts together a **certificate**: the site's name, its public key, the validity
period and who issued it. At the bottom it adds a digital signature made with its private key.
Without that key the signature can't be forged.

#### Step by step

The signature is made like this: a hash, a short fingerprint of the data, is computed over all the
certificate's fields, and the authority signs it with its private key. Anyone with the authority's
public key can check the signature.

#### Deeper

The X.509 certificate format is described in RFC 5280: the site's name sits in the subjectAltName
extension (the dNSName field), the validity in the notBefore and notAfter fields. Usually the site
is signed not by a root authority but by an intermediate one, whose own certificate is signed by
the root. That makes a **chain**: shop, intermediate authority, root authority. Root certificates
come built into the browser or the system in advance, and the chain ends at them. Issued
certificates are also written to public transparency logs (Certificate Transparency, RFC 9162), so
that a domain owner can notice someone else's certificate in their name.

### `genuine` The real certificate

`site → user` · `safe` · `with-defence`
Message: shop.example certificate · Result: the signature checks out

#### Simple

A visitor opens shop.example. The shop sends its certificate. The browser checks the signature
with the public key of an authority it trusts, and the signature **checks out**. So the key in the
certificate really does belong to shop.example.

#### Step by step

The browser computes the hash of the certificate's fields again and checks the authority's
signature. Then it walks the chain up to a root authority from its own list and checks the dates
and the name. The attacker on the same network is just passing packets along for now.

#### Deeper

Per RFC 5280 (section 6.1.3), for each certificate in the chain the checks are: the signature is
valid, the current time is within the validity period, the certificate is not revoked, and the
issuer matches the subject of the previous certificate in the chain. The browser doesn't check the
root by a signature: it is trusted because it arrived earlier by a trustworthy route.

### `forge` A swapped key

`attacker → user` · `attack` · `without-defence`
Message: certificate with the attacker's key · Result: signature not checked, accepted

```text
subject:    shop.example
key:        ⟦attacker's key 30 82 01 0a 66 66⟧
signature:  the same as the real one
```

#### Simple

The attacker takes the shop's real certificate and **swaps the key** in it for his own. He leaves
the authority's old signature in place. Imagine a program that doesn't check signatures: it sees a
familiar name and a familiar authority and believes it.

#### Step by step

For such a program everything is in place: the name shop.example, the authority, the dates. It
sets up a secure connection with the attacker's key, thinking it is talking to the shop.

#### Deeper

A certificate whose signature is not checked is just text anyone can write. A missing or wrong
signature check is CWE-347; improper certificate validation in general is CWE-295. Browsers always
do this check; the mistakes happen in home-made clients and libraries where checking was switched
off "for a while".

### `send` The password under the attacker's key

`user → attacker` · `attack` · `without-defence`
Message: password under attacker's key · Result: the attacker decrypted it

```text
TLS with the key from the certificate → POST /login password=⟦Kot2024⟧
```

#### Simple

The program encrypts the password, but with the **attacker's** key. The attacker decrypts it with
his private key, reads the password and, so that nobody notices, forwards the request to the real
shop.

#### Step by step

There is encryption, but the conversation is with the wrong party. This is a man-in-the-middle
attack; a separate lesson takes it apart in detail.

#### Deeper

Encryption without checking whose key it is protects only against those who merely listen, not
against someone who has stepped into the middle (MITRE ATT&CK T1557). That is why TLS always checks
the server by its certificate.

### `verify` The signature doesn't match

`attacker → user` · `attack` · `with-defence` · `stopped`
Message: certificate with the attacker's key · Result: signature mismatch, connection closed

```text
hash of the certificate fields:   ⟦7e21 04aa⟧
hash inside the CA's signature:   c9d3 58f0
```

#### Simple

Now the browser checks the signature. The key in the certificate is different, so the hash is
different too. The authority's signature was made for the old hash and **doesn't match** the new
one. The browser closes the connection, and the password doesn't leave.

#### Step by step

The attacker can't make a new valid signature: that needs the authority's private key. Nor can he
make up an authority of his own: the browser trusts only the root authorities on its list.

#### Deeper

A digital signature protects every bit of the signed data: the name, the dates or the key can't be
changed without a new signature. Another route remains: getting a real certificate in his own name,
say shop-pay.example, or for someone else's domain through an authority's mistake. Name matching
catches the first (the lesson "HTTPS: how the browser checks a site"); transparency logs help
notice the second.

## How to defend

- **Don't switch off certificate checks.** In your own programs and libraries, checking the
  signature, chain, dates and name must always be on, "for tests" included.
- **Get your certificate from a public authority.** For internet sites, from a well-known
  authority; for internal systems, from your own, whose root is installed on staff devices.
- **Guard the site's private key like a password.** Only the server that uses the key file should
  have access to it.
- **Watch the transparency logs.** A new certificate for your domain that you didn't order is a
  reason to investigate.
- **Limit who may issue certificates for your domain.** A CAA record in DNS names the allowed
  authorities.
