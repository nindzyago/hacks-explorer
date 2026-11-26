# Certificate warnings: what they mean

`lesson` L4 · `section` L · `wave` 2 · `format` 1

## Passport

- `cwe` 295
- `owasp` A07:2021
- `attack` T1557
- `severity` high
- `impact` The password goes to the attacker if the person clicks past the warning
- `defence` Don't click past the warning; HSTS removes the "proceed anyway" button
- `class` A person overriding a certificate check

## Sources

- [RFC 5280: Internet X.509 Public Key Infrastructure Certificate and CRL Profile](https://www.rfc-editor.org/rfc/rfc5280.html)
- [RFC 6960: X.509 Internet Public Key Infrastructure Online Certificate Status Protocol - OCSP](https://www.rfc-editor.org/rfc/rfc6960.html)
- [RFC 9525: Service Identity in TLS](https://www.rfc-editor.org/rfc/rfc9525.html)
- [RFC 6797: HTTP Strict Transport Security (HSTS)](https://www.rfc-editor.org/rfc/rfc6797.html)
- [OWASP: Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [OWASP: HTTP Strict Transport Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html)
- [MITRE CWE-295: Improper Certificate Validation](https://cwe.mitre.org/data/definitions/295.html)
- [MITRE ATT&CK T1557: Adversary-in-the-Middle](https://attack.mitre.org/techniques/T1557/)
- [OWASP Top 10:2021, A07 Identification and Authentication Failures](https://top10.owasp.org/2021/A07_2021-Identification_and_Authentication_Failures/)

## Participants

- `user` **Browser** — 192.0.2.24 · `icon:browser` · `term:certificate`
- `attacker` **Attacker** — 192.0.2.66 · `term:mitm`
- `bank` **Bank** — bank.example · `icon:bank` · `term:domain`

## Zones

- `hotel` Hotel Wi-Fi: `user`, `attacker`
- `internet` Internet: `bank`

## Steps

### `usual` As usual

`user → bank` · `safe`
Message: open the bank · Result: certificate fine

```text
certificate: bank.example
issuer:      an authority on the browser's list
valid:       until 2027-02-14
```

#### Simple

At home Anna opens her bank. The browser checks the bank's certificate: the name matches, it hasn't
expired, a known authority signed it. No warnings, the page opens. This is what **normal** looks
like.

#### Step by step

How exactly the browser checks a certificate is covered in the lesson "HTTPS: how the browser
checks a site". One thing matters here: if all checks pass, the browser stays silent.

#### Deeper

Besides the name, dates and chain, the browser can check whether the certificate has been revoked.
An authority revokes a certificate if, for example, the site's private key was stolen. This can be
learned from a revocation list (CRL, RFC 5280) or by asking over OCSP (RFC 6960), which answers
"good", "revoked" or "unknown".

### `open` Logging in from a hotel

`user → attacker` · `legit`
Message: open the bank · Result: reached the attacker

#### Simple

On a business trip Anna joins the hotel Wi-Fi and opens the same bank. On this network an attacker
has already stepped into the middle, and the browser's request goes to him.

#### Step by step

How an attacker gets into the middle is covered in the lesson "Man in the middle". To Anna
everything looks as usual: the same bookmark, the same address.

#### Deeper

The attacker doesn't have the bank's real certificate with its private key. To read the traffic, he
needs the browser to accept some other certificate, or the person to allow it themselves.

### `selfsigned` A home-made certificate

`attacker → user` · `attack` · `without-defence`
Message: fake cert · Result: full-screen warning

```text
certificate: bank.example
issuer:      ⟦bank.example (itself)⟧
```

#### Simple

The attacker sends a certificate for bank.example that he **signed himself**. The browser can't find
such an authority on its list and shows a warning instead of the page: the connection is not
secure.

#### Step by step

Anyone can draw up a certificate; only a trusted authority's signature has value. There is none
here, so the browser can't make sure the bank is on the other end.

#### Deeper

A self-signed certificate, per RFC 5280, is one whose signature is checked with the key inside it.
That is normal for root authorities and for tests, but not for a site on the internet. Warnings come
in several kinds: **unknown issuer** (self-signed or from an authority not on the list), **wrong
name** (a certificate for another site), **expired** or not yet valid, **revoked**. Any of them on
someone else's network is a serious reason to be wary.

### `proceed` "Proceed anyway"

`user → attacker` · `attack` · `without-defence`
Message: password · Result: password with the attacker

```http
POST /login
login=anna&password=⟦Kot2024⟧
```

#### Simple

Anna is in a hurry. She opens the details and clicks the button that lets her go on to the site
anyway. The browser obeys, the bank's page opens, and Anna types her password. There is encryption,
but **with the attacker**.

#### Step by step

The attacker decrypts the request with his key, keeps the password and forwards the request to the
bank so the page works as usual.

#### Deeper

The browser did its job: the check failed, and it warned. The last word belonged to the person.
That is what the attack counts on: someone in a hurry clicks past. When a program does the same
thing silently, accepting a self-signed, expired or revoked certificate and carrying on, that is
CWE-295, whose examples include exactly these cases.

### `steal` Into someone else's bank

`attacker → bank` · `attack` · `without-defence`
Message: Anna's password · Result: the attacker is in

#### Simple

With Anna's password the attacker **logs into her bank** from his own computer. If the bank has no
second factor, that is enough.

#### Step by step

To the bank this is an ordinary login: the right username and password. The attacker may not even
need to wait: he already sees everything Anna does in that tab.

#### Deeper

The most dangerous mistake in this chain is the click past the warning. To rule it out entirely,
sites turn on HSTS: then the browser simply doesn't show that button.

### `warn` A warning, and that's it

`attacker → user` · `attack` · `with-defence` · `stopped`
Message: fake cert · Result: tab closed, password stayed

```text
certificate: bank.example
issuer:      ⟦bank.example (itself)⟧
HSTS for bank.example: no way through
```

#### Simple

The same home-made certificate. But the bank has turned on **HSTS**, and the browser remembers it
from the last visit: there is no "proceed anyway" button. Anna closes the tab. The password went
nowhere.

#### Step by step

HSTS is a header with which the bank earlier told the browser: HTTPS only with me, and on any
certificate error, don't let anyone through. Even without HSTS the right move is the same: close
the page.

#### Deeper

For HSTS sites, RFC 6797 requires ending the connection on any TLS error (section 8.4) and advises
giving the person no way to continue (section 12.1). HSTS takes effect after the first secure visit, and the HSTS preload list built into
browsers protects the very first one. More on HSTS in the lesson "SSL stripping and downgrade".

### `retry` Over mobile data

`user → bank` · `safe` · `with-defence`
Message: open the bank · Result: certificate fine

#### Simple

Anna leaves the hotel Wi-Fi and opens the bank over mobile data. No warning, the certificate is the
real one. She can log in.

#### Step by step

The attacker stayed on the hotel network, and the packets now go around him. The browser checks the
certificate as at home, and everything matches.

#### Deeper

If a warning shows up on a site that used to open without one, and the network isn't yours, change
the network rather than clicking "continue". Site owners should watch their certificates' expiry
dates: an expired certificate teaches visitors to click past warnings.

## How to defend

- **Don't click "proceed anyway".** Especially on someone else's network and on sites where you
  type a password or pay. Close the page and come back over another network.
- **For site owners: HSTS.** The `Strict-Transport-Security` header takes away visitors' option to
  click past a certificate error; add the site to the preload list.
- **Don't cause certificate errors yourself.** Renew certificates automatically, list all the
  site's names, get the certificate from a well-known authority. Otherwise users learn to click
  past.
- **If the key is stolen, revoke the certificate.** Browsers that check revocation will then stop
  trusting it.
- **A second factor.** If the password does leak, a second factor won't let anyone in with the
  password alone.
