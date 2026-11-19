# Phishing

`lesson` I1 · `section` I · `wave` 1 · `format` 1

## Passport

- `attack` T1566, T1566.002
- `severity` high
- `impact` The victim's login and password, and with them access to the victim's account
- `defence` Password manager and a second factor
- `class` Social engineering

## Sources

- [MITRE ATT&CK T1566: Phishing](https://attack.mitre.org/techniques/T1566/)
- [MITRE ATT&CK T1566.002: Spearphishing Link](https://attack.mitre.org/techniques/T1566/002/)
- [MITRE ATT&CK T1110.004: Credential Stuffing](https://attack.mitre.org/techniques/T1110/004/)
- [MITRE ATT&CK T1621: Multi-Factor Authentication Request Generation](https://attack.mitre.org/techniques/T1621/)
- [NIST SP 800-63B-4: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [CISA: Implementing Phishing-Resistant MFA](https://www.cisa.gov/sites/default/files/publications/fact-sheet-implementing-phishing-resistant-mfa-508c.pdf)
- [CISA: Recognize and Report Phishing](https://www.cisa.gov/secure-our-world/recognize-and-report-phishing)
- [CISA BOD 18-01: Enhance Email and Web Security](https://www.cisa.gov/news-events/directives/bod-18-01-enhance-email-and-web-security)
- [W3C: Web Authentication Level 2](https://www.w3.org/TR/webauthn-2/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `user` **Employee** — 192.0.2.24 · `term:victim`
- `fake` **Fake page** — bank-login.example · `icon:browser` · `term:fake-page`
- `bank` **Bank** — bank.example · `term:domain`

## Zones

- `internet` Internet: `attacker`
- `office` Office: `user`
- `forgery` Forgery: `fake` · `danger` · `term:phishing`
- `bank-site` Bank: `bank`

## Steps

### `bait` The bait email

`attacker → user` · `attack` · `icon:mail`
Message: email · Result: delivered

```text
From: Bank <support@⟦bank-login.example⟧>
Subject: Your account has been blocked
```

#### Simple

The employee gets an email that seems to come from the bank: the account is blocked, confirm your
details right away. The **urgency** is there so the person has no time to think.

#### Step by step

The attacker writes to employees of one company that banks with this bank: an email with the
bank's logo and a link. The sender's name looks like the bank's; the address does not.

#### Deeper

The sender's display name can be set to anything. Faking the address itself on the bank's domain
is blocked by SPF, DKIM and DMARC, if the bank has set them up and the recipient's mail server
checks them. They do not help against a look-alike domain: it is a different domain with its own
records. That is why attackers usually pick a look-alike domain. In MITRE ATT&CK phishing is
technique T1566, and an email with a link aimed at people of one organization is its
sub-technique T1566.002 “Spearphishing Link”.

### `click` Following the link

`user → fake` · `legit`
Message: open the link · Result: page opened

```text
real:  https://⟦bank.example⟧/login
fake:  https://⟦bank-login.example⟧/
```

#### Simple

The employee clicks the link. A page opens that looks exactly like the bank's login page.

#### Step by step

The browser opens the attacker's site. The address starts with `https`, and the browser shows that
the connection is secure. But that only says the connection is encrypted, not whose site it is.

#### Deeper

Anyone can get a certificate for their own domain, the attacker included. The only difference is
the address. In this lesson both addresses come from the training zone `.example`, and the fake
one gives itself away with an extra word in the name. Real look-alike names can be sneakier:
swapped letters, a different top-level domain, letters from another alphabet that look the same.

### `type` Typing the password

`user → fake` · `attack` · `without-defence`
Message: login and password · Result: password entered

#### Simple

He types his login and password as usual. Only the page is not the bank's.

#### Step by step

The form sends the login and password to the attacker's server.

#### Deeper

The page can instantly forward what was typed to the real bank and show the real bank's response.
The victim does not notice such proxy phishing at all, and it captures not only the password but
also the one-time code.

### `steal` The attacker has the password

`fake → attacker` · `attack` · `without-defence`
Message: password · Result: stolen

#### Simple

The fake page passes the password to its owner and shows the employee “Error, please try again
later”.

#### Step by step

The attacker's server saves the login and password pair.

#### Deeper

Stolen pairs are tried on other sites too, because people often reuse passwords. This trick is
called *credential stuffing*; in MITRE ATT&CK it is sub-technique T1110.004.

### `login` Logging in to the real bank

`attacker → bank` · `attack` · `without-defence`
Message: login · Result: logged in

#### Simple

The attacker logs in to the real bank with the real password. To the bank he looks just like the
customer.

#### Step by step

The bank checks the login and password, they are correct, and a session opens.

#### Deeper

In MITRE ATT&CK phishing is technique T1566. A password is a secret that can be retold, so it is
enough to trick someone out of it once.

### `autofill` The password manager stays silent

`user → user` · `safe` · `with-defence` · `stopped`
Message: password not offered · Result: stopped

```text
saved for:  ⟦bank.example⟧
this page:  ⟦bank-login.example⟧
```

#### Simple

The password manager remembers that the bank password belongs to the address bank.example. On a
different address it **simply does not offer it**, and that is a reason to be suspicious.

#### Step by step

The manager compares the page's domain with the saved one. They do not match, so autofill does
not happen.

#### Deeper

The domain is compared as text, not by eye: `bank-login.example` is a different domain from
`bank.example`, however similar it looks. This defence works only as long as the manager fills in
the password: if you copy the password by hand and paste it into the page, it goes to the
attacker. Passkeys (WebAuthn) go further: the key is bound to the site's domain and cannot be
carried over by hand.

### `leak` The password leaked somewhere else

`attacker → bank` · `attack` · `with-defence` · `stopped`
Message: leaked password · Result: password correct, but no way in

#### Simple

Suppose the password leaked anyway, say from an old database. The attacker tries to log in to the
bank. The password is correct, but the login has a second factor turned on: the bank waits for a
confirmation from the victim's second device, which the attacker does not have. This is where the
attack stops.

#### Step by step

The attacker sends a correct login and password. The bank accepts them but does not open a
session until the second check is passed.

#### Deeper

That is why one measure is not enough: layers of defence close different paths to the same goal.

### `second` Second factor

`bank → attacker` · `safe` · `with-defence`
Message: code required · Result: not logged in

#### Simple

The bank asks for a confirmation from the second device. The attacker does not have it.

#### Step by step

Without the second factor, no session opens.

#### Deeper

An SMS code or a push approval can also be phished: with the same phishing, or with a flood of
notifications until the person taps “yes” (in MITRE ATT&CK this is technique T1621). Under NIST SP
800-63B, methods where the person types in a code are not considered phishing-resistant. FIDO2
security keys and passkeys are: they check which site they are answering.

## How to defend

- **Signs of a fake.** Urgency and threats, being asked to enter a password or code through a link,
  a sender or page address that does not match the real one. Open the bank yourself, from a
  bookmark or the app, not through a link in an email.
- **A password manager.** It offers a password only on the site the password was saved for, and it
  compares the address as text. If it stays silent, check the address and do not copy the password
  by hand.
- **A second factor, ideally phishing-resistant.** FIDO2 security keys and passkeys are bound to
  the site's domain; codes from SMS and apps are better than nothing, but they can be phished.
- **Different passwords for different sites.** One leaked password does not open other accounts.
- **Report suspicious emails** to your security team or with the “Report spam” button in your mail
  app, instead of replying to them or opening their links. This protects not only you but others
  too.
- **For organizations:** SPF, DKIM and DMARC with a `reject` policy on your own domain. Then mail
  servers that check DMARC reject email with a forged address on that domain. It does not protect
  against email from look-alike domains.
