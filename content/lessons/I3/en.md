# Sender spoofing: SPF, DKIM, DMARC

`lesson` I3 · `section` I · `wave` 1 · `format` 1

## Passport

- `cwe` 345
- `attack` T1684.002, T1566
- `severity` high
- `impact` An email with someone else's address in the From field lands in the inbox as genuine
- `defence` SPF, DKIM and DMARC with a reject policy
- `class` Sender address spoofing

## Sources

- [RFC 7208: Sender Policy Framework (SPF) for Authorizing Use of Domains in Email, Version 1](https://www.rfc-editor.org/rfc/rfc7208)
- [RFC 6376: DomainKeys Identified Mail (DKIM) Signatures](https://www.rfc-editor.org/rfc/rfc6376)
- [RFC 9989: Domain-Based Message Authentication, Reporting, and Conformance (DMARC)](https://www.rfc-editor.org/rfc/rfc9989)
- [RFC 7489: DMARC (previous version, obsoleted by RFC 9989, 9990 and 9991)](https://www.rfc-editor.org/rfc/rfc7489)
- [MITRE ATT&CK T1684.002: Social Engineering: Email Spoofing](https://attack.mitre.org/techniques/T1684/002/)
- [MITRE ATT&CK T1566: Phishing](https://attack.mitre.org/techniques/T1566/)
- [MITRE CWE-345: Insufficient Verification of Data Authenticity](https://cwe.mitre.org/data/definitions/345.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `dns` **Bank DNS** — bank.example · `icon:server` · `term:dns`
- `mx` **Mail** — mx.mail.example · `icon:mail` · `term:dmarc`
- `client` **Client** — 192.0.2.24 · `icon:user` · `term:victim`

## Zones

- `internet` Internet: `attacker`
- `bank-zone` Bank bank.example: `dns`
- `mail-zone` Mail service mail.example: `mx`, `client`

## Steps

### `records` The bank publishes its rules

`dns → dns` · `legit` · `icon:server`
Message: TXT records · Result: rules visible to all

```text
bank.example              TXT "v=spf1 ip4:198.51.100.0/24 -all"
s1._domainkey.bank.example TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0B"
_dmarc.bank.example       TXT "v=DMARC1; p=reject; rua=mailto:dmarc@bank.example"
```

#### Simple

The bank puts three rules for its mail into DNS ahead of time: **which servers** send it, **which
key** signs it and **what to do** with a message that fails the check.

#### Step by step

- **SPF**: the list of servers allowed to send mail on behalf of `bank.example`.
- **DKIM**: a public key anyone can use to check the signature on the bank's mail.
- **DMARC**: a request to receivers: if a message "from the bank" is not confirmed, reject it.

#### Deeper

SPF is defined in RFC 7208, DKIM in RFC 6376, DMARC in RFC 9989 (which replaced RFC 7489 in May
2026). The DKIM key lives at a name like `s1._domainkey.bank.example`, where `s1` is the selector;
the DMARC rule lives at `_dmarc.bank.example`. The records block nothing on their own: they are
hints, and the receiving server makes the decision.

### `forge` An email "from the bank"

`attacker → mx` · `attack` · `icon:mail`
Message: email · Result: email accepted

```text
MAIL FROM:<bounce@attacker.example>
From: Bank <security@⟦bank.example⟧>
DKIM-Signature: d=attacker.example; s=x1
Subject: Confirm your online banking sign-in
```

#### Simple

The attacker writes an email and puts the bank's address in the From field. The mail protocol
does not forbid it: From is just a line of text, and anyone can write it.

#### Step by step

An email has two sender addresses. The first is on the "envelope" (`MAIL FROM`), which the mail
server sees. The second is in the `From` header, which the person sees. The attacker puts their
own domain `attacker.example` on the envelope and even signs the email with their own DKIM key,
but writes the bank in `From`.

#### Deeper

In MITRE ATT&CK this is sub-technique T1684.002 "Social Engineering: Email Spoofing": changing
headers so that an email appears to come from someone else. The trick is that SPF and DKIM pass
for the attacker's domain: they set up the records themselves. Both checks confirm a domain, just
not the one the person sees.

### `inbox` The email in the inbox

`mx → client` · `attack` · `without-defence` · `icon:mail`
Message: email "from the bank" · Result: the client believes it

```text
From: Bank <security@bank.example>
We noticed a sign-in from a new device.
Confirm it was you: ⟦https://bank-login.example/⟧
```

#### Simple

The receiving mail server does not compare the domains and puts the email in the inbox. The client sees the
bank's address and has no doubts.

#### Step by step

The server may have checked SPF and DKIM, and both passed, for `attacker.example`. But nobody asked
the key question: **does the verified domain match the domain in the From field?** Without that
comparison the forged address looks genuine.

#### Deeper

ATT&CK specifically points to the weak rule `p=none`: the domain owner asks for nothing, and a
message that fails the check is delivered anyway. Having no DMARC record at all gives the same
result. This is weakness CWE-345: the authenticity of the data (who the sender is) is not
verified.

### `click` Off to a fake page

`client → attacker` · `attack` · `without-defence`
Message: login and password · Result: password with the attacker

#### Simple

The client clicks the link, lands on a page that looks like the bank's sign-in and enters their
login and password. They go to the attacker.

#### Step by step

The forged sender is only the start. After that it is ordinary phishing: a link, a copied page, a
request for a password or code.

#### Deeper

Spoofing the sender makes phishing (T1566) more convincing: people are used to trusting the
address in the From field. That is why the domains of banks, shops and government services
especially need a DMARC rule.

### `align` Matching the domains

`mx → dns` · `safe` · `with-defence`
Message: TXT? · Result: domains do not match

```text
SPF:   attacker.example        pass
DKIM:  d=attacker.example      pass
From:  bank.example            ⟦matches neither⟧
DMARC: _dmarc.bank.example     p=reject
```

#### Simple

The receiving server checks the email against the bank's rules and sees that the confirmed domain
is someone else's, not the one in the From field.

#### Step by step

1. SPF: the sending server is allowed for `attacker.example`, so the check passes.
2. DKIM: the signature is valid, but `attacker.example` made it.
3. DMARC: the From domain is `bank.example`. Neither SPF nor DKIM confirmed that domain, so DMARC
   fails, and the bank asks for `reject`.

#### Deeper

The heart of DMARC is **alignment**: the From domain must match the domain confirmed by SPF (via
the `MAIL FROM` address) or by DKIM (the `d=` tag). Strict alignment needs an exact match; relaxed
alignment (the default) needs the same organizational domain, so `news.bank.example` aligns with
`bank.example`. Without alignment a passed SPF or DKIM check means nothing: anyone can publish a
record for their own domain.

### `reject` Email rejected

`attacker → mx` · `attack` · `with-defence` · `stopped`
Message: email "from the bank" · Result: rejected

```text
550 5.7.1 Rejected: DMARC failed, bank.example policy is reject
```

#### Simple

The server rejects the email. The client never sees it, and the bank learns about the attempt
from its DMARC reports.

#### Step by step

`p=quarantine` would ask for the email to go to spam; `p=reject` asks not to accept it at all. To
avoid losing their own mail, owners usually start a domain at `p=none` with reports, find all
their legitimate mail sources and only then switch to a stricter policy.

#### Deeper

DMARC protects only the exact domain in From. An email from a lookalike domain
(`bank-login.example`) passes every check if the attacker set up records for it. So besides DMARC
you need attention to the address and labels on external email. And the receiver still decides:
a server that does not check DMARC will ignore the bank's rule.

## How to defend

- **Domain owners: publish SPF and sign all mail with DKIM**, including mail sent through mailing
  and cloud services.
- **Turn on DMARC** with reports (`rua`), use them to find all your mail sources, and move from
  `p=none` to `quarantine` and `reject`.
- **Lock down domains you do not send mail from** too: SPF `v=spf1 -all` (RFC 7208 calls this a
  well-established practice) and DMARC `p=reject`.
- **Receiving mail servers: check SPF, DKIM and DMARC** and follow the domain's policy.
- **People: the From address is not proof.** Do not open links in emails "from the bank"; go to
  the bank yourself, from a bookmark or the app.
