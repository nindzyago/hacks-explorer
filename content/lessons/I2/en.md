# Spear phishing and payment fraud

`lesson` I2 · `section` I · `wave` 3 · `format` 1

## Passport

- `attack` T1566, T1684.001, T1657
- `severity` high
- `impact` The company itself transfers money to the attacker's account
- `defence` Confirmation through a second channel
- `class` Social engineering, payment fraud

## Sources

- [MITRE ATT&CK T1566: Phishing](https://attack.mitre.org/techniques/T1566/)
- [MITRE ATT&CK T1684.001: Social Engineering: Impersonation](https://attack.mitre.org/techniques/T1684/001/)
- [MITRE ATT&CK T1657: Financial Theft](https://attack.mitre.org/techniques/T1657/)
- [MITRE ATT&CK T1593: Search Open Websites/Domains](https://attack.mitre.org/techniques/T1593/)
- [MITRE ATT&CK T1583.001: Acquire Infrastructure: Domains](https://attack.mitre.org/techniques/T1583/001/)
- [CISA: Business Email Compromise Continues to Swindle and Defraud U.S. Businesses](https://www.cisa.gov/news-events/alerts/2015/06/24/business-email-compromise-continues-swindle-and-defraud-us-businesses)
- [CISA: Avoiding Social Engineering and Phishing Attacks](https://www.cisa.gov/news-events/news/avoiding-social-engineering-and-phishing-attacks)
- [CISA: Teach Employees to Avoid Phishing](https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/teach-employees-avoid-phishing)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `accountant` **Accountant** — 192.0.2.24 · `icon:user` · `term:victim`
- `director` **Director** — 192.0.2.25 · `icon:user`
- `bank` **Bank** — bank.example

## Zones

- `internet` Internet: `attacker`
- `company` Company acme.example: `accountant`, `director`
- `bank-site` Bank: `bank`

## Steps

### `normal` The usual routine

`director → accountant` · `legit` · `icon:mail`
Message: pay invoice · Result: accepted

```text
From: Director <ceo@acme.example>
Invoice no. 318 from "Supplier" is approved, please pay on time.
```

#### Simple

This is how the company works: the director approves an invoice, the accountant pays it. Emails
from the director about payments are routine.

#### Step by step

The accountant knows the company's suppliers and their payment details: the account number and
the bank. Payment goes to the account that has long been in the contract.

#### Deeper

The familiar routine is exactly what becomes the target. The attacker does not need to break any
software: it is enough to slip into the ordinary conversation about money so that their email
does not stand out among the real ones.

### `recon` Research in open sources

`attacker → attacker` · `attack`
Message: website, social media, news · Result: names and routine known

```text
website:  director: I. Petrov, accountant: A. Smith
social:   "At the trade fair all week, bad signal"
news:     "acme.example signs a contract with Supplier"
```

#### Simple

The attacker studies the company through open sources: who the director is, who pays the
invoices, which companies it works with, and when the director is away.

#### Step by step

All of this is in plain sight: the "Team" page on the website, employee profiles, press releases.
The attacker also registers a domain that looks like the company's: `acme-example.example` instead
of `acme.example`.

#### Deeper

In MITRE ATT&CK searching open websites is technique T1593, Search Open Websites/Domains, and
registering lookalike domains is sub-technique T1583.001, Acquire Infrastructure: Domains. An
email written for one particular person with such details is called **spear phishing**: it does
not look like a mass mailing and is therefore more convincing.

### `letter` An email "from the director"

`attacker → accountant` · `attack` · `without-defence` · `icon:mail`
Message: urgent, new bank details · Result: the accountant believed it

```text
From: I. Petrov <ceo@⟦acme-example.example⟧>
Subject: Urgent: payment to Supplier
Supplier has changed banks. Pay invoice no. 318 today
to the ⟦new account 40702…9917⟧. I'm at the fair, don't call, write.
```

#### Simple

The accountant gets an email that seems to come from the director: the supplier has changed
banks, the invoice must be paid **today** to the new account, no need to call. Everything matches
what the accountant knows.

#### Step by step

The name, the job title, the supplier and the invoice number are real; the sender's address
differs by a few letters. The urgency and the "don't call" cut the accountant off from checking.

#### Deeper

Posing as an executive, a colleague or a supplier is MITRE ATT&CK sub-technique T1684.001, Social
Engineering: Impersonation; the page notes that such emails push with words like "payment" and
"urgent". A lookalike domain passes SPF, DKIM and DMARC: it is the attacker's real domain, and
those checks only confirm the email came from it. Sometimes the attacker writes from a real
compromised mailbox, and then the address does not differ at all.

### `pay` Payment to someone else's account

`accountant → bank` · `attack` · `without-defence`
Message: payment with the new details · Result: processed

```text
Payee:   Supplier
Account: ⟦40702…9917⟧  (not from the contract)
```

#### Simple

The accountant creates a payment with the new details, and the bank processes it. For the bank
it is an ordinary transfer made by the customer.

#### Step by step

No computer was hacked, no password was stolen. The payment was made by a real employee from the
company's real bank, so security systems notice nothing.

#### Deeper

CISA describes this scheme as a type of payment fraud known as Business Email Compromise (BEC):
through a compromised or spoofed mailbox the attacker sends wire transfer instructions. Two
common versions are "from an executive" and "from a supplier who changed accounts".

### `gone` The money is gone

`bank → attacker` · `attack` · `without-defence`
Message: transfer · Result: money with the attacker

#### Simple

The money arrives in the attacker's account. The real supplier did not get paid and will soon ask
where the payment is.

#### Step by step

The fraud usually comes to light only when the real supplier asks about the unpaid invoice. The
later that happens, the harder it is to get the money back.

#### Deeper

In MITRE ATT&CK stealing money is technique T1657, Financial Theft, and BEC is named among the
campaign types whose goal is money. If you think your money or accounts are at risk, CISA advises
contacting your financial institution immediately.

### `flagged` New bank details only after a call

`attacker → accountant` · `attack` · `with-defence` · `stopped`
Message: urgent, new bank details · Result: stopped

```text
Notice: external sender: ⟦acme-example.example⟧
Company rule: bank detail changes only after a call
to the number in the contract or the directory.
```

#### Simple

The email is the same, but the company has a rule: **new bank details** are never accepted by
email. The accountant does not pay until it is confirmed by phone.

#### Step by step

The mail system marks emails from outside addresses, and the accountant notices the domain is not
the company's. But the rule works even without that mark: a change of account is a reason to
check, not to pay.

#### Deeper

CISA advises confirming a change in payment instructions by phone, with the number taken not from
the email but from a known contact list for that supplier. For large amounts, new payees and new
account numbers of existing partners, a second approval; and only a few employees should be able
to make transfers.

### `callback` A call to the director

`accountant → director` · `safe` · `with-defence`
Message: did you ask? · Result: no, it is a fake

```text
Call to the number in the company directory
"Did you ask me to pay Supplier to a new account?"
"No. Forward the email to security."
```

#### Simple

The accountant calls the director on a known number. The director asked for nothing. The fake is
exposed, and the money stays in the company.

#### Step by step

A second channel is a different way to reach someone that the attacker does not control: a phone
number from the directory, meeting in person. Replying in the same thread checks nothing: the
reply goes to the attacker.

#### Deeper

MITRE ATT&CK lists, among the mitigations for T1684.001, training staff to confirm unexpected
requests through an independent channel, such as a phone call or in person. For requests "from an
executive" CISA also suggests a pre-agreed PIN or a one-time code. Forward the email to security:
the attacker may be writing to other employees too.

## How to defend

- **New bank details only after a call** to the number in the contract or the directory, never to
  a number from the email.
- **A second approval** for large payments, new payees and new accounts of existing partners.
  Only a few people can make transfers.
- **Urgency and "don't call" are alarm signals**, not a reason to hurry.
- **Mark external emails** and watch for domains that look like yours.
- **Less on public display**: not everyone needs to know who pays the invoices and when the
  director is away.
- **A second factor on email**: a compromised real mailbox is more dangerous than a fake one.
- **If the money has gone, call your bank at once** and report the fraud.
