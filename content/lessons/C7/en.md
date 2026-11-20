# Open redirects

`lesson` C7 · `section` C · `wave` 3 · `format` 1

## Passport

- `cwe` 601
- `owasp` A01:2021
- `attack` T1566.002
- `severity` medium
- `impact` A phishing link with the real site's address, stolen passwords and sign-in codes
- `defence` Redirect only to addresses on an allowlist
- `class` Sending a visitor to a foreign site through a trusted site's link

## Sources

- [OWASP: Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [OWASP Top 10:2021, A01 Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/)
- [MITRE CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [MITRE ATT&CK T1566.002: Spearphishing Link](https://attack.mitre.org/techniques/T1566/002/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `fake` **Fake** — bank-login.example · `icon:browser` · `term:fake-page`
- `user` **Victim's browser** — 192.0.2.24 · `icon:browser` · `term:victim`
- `bank` **Bank** — bank.example · `term:domain`

## Zones

- `evil` Attacker's network: `attacker`, `fake` · `danger` · `term:phishing`
- `home` Home: `user`
- `bank-site` Bank site: `bank`

## Steps

### `mail` A link to the bank

`attacker → user` · `attack` · `icon:mail`
Message: email with a link to bank.example · Result: delivered

```text
https://bank.example/go?to=⟦https://bank-login.example/⟧
```

#### Simple

The victim gets an email with a link. The link **goes to the bank's real site**: the address starts
with `bank.example`, no typos. The person checks the address, as they were taught, and clicks
calmly.

#### Step by step

The bank has a utility address `/go`: it sends the visitor wherever the `to` parameter says. It is
used, for example, to bring a person back to the right page after logging in. The attacker has
written their own site into `to`.

#### Deeper

The tail of the link is often hidden: characters are encoded (`%3A%2F%2F` instead of `://`) or the
address is made very long so nobody reads it to the end. But even in plain form few people read an
address to the end: the eye catches the bank's name at the start.

### `click` Going to the bank

`user → bank` · `attack`
Message: GET /go?to=... · Result: request to the real bank

```http
GET /go?to=⟦https://bank-login.example/⟧
Host: bank.example
```

#### Simple

The browser opens the **real** bank site. The certificate is fine, the address is right: so far
everything looks honest.

#### Step by step

The request goes to the bank. The `to` parameter is ordinary text in the address; anyone can write
it, not only the bank.

#### Deeper

At this step both the address and the certificate in the browser are genuine. That is why phishers
value open redirects: CWE-601 says outright that the server name in the link is the same as the
real one, so the fake looks more trustworthy.

### `bounce` The bank sends the browser on

`bank → user` · `attack` · `without-defence`
Message: 302 to a foreign site · Result: attack

```http
HTTP/1.1 302 Found
Location: ⟦https://bank-login.example/⟧
```

#### Simple

Without looking, the bank **sends the browser wherever the link says**. To someone else's site.

#### Step by step

A `302` answer with a `Location` header tells the browser: “go to this address”. The browser goes
at once; the person barely notices the address flash by.

#### Deeper

This is weakness CWE-601: a web application takes an address from the visitor's input and
redirects to it without checking. Such an address on a site is called an open redirect. In OWASP
Top 10:2021, CWE-601 belongs to A01 Broken Access Control.

### `page` A copy of the login page

`user → fake` · `attack` · `without-defence`
Message: fake page opened · Result: copy of the bank login

```text
bank-login.example — “Log in to continue”
```

#### Simple

A login page opens that **looks exactly like** the bank's. The person has just seen the bank's
address and expects no trick.

#### Step by step

The fake is run by the attacker. Its address differs from the bank's, but the person already
checked the address earlier, on the link, and did not look a second time.

#### Deeper

Open redirects are dangerous for OAuth sign-in too. RFC 9700 requires that neither the client site
nor the authorization server expose open redirectors: they can be used to exfiltrate authorization
codes and access tokens. It also says to compare the return address with the pre-registered one by
exact string matching (the only exception is the port number for apps on the device itself).

### `steal` The password goes to the attacker

`user → fake` · `attack` · `without-defence`
Message: login and password · Result: password with the attacker

```text
login=anna  password=⟦••••••⟧
```

#### Simple

The person types their login and password. They go **to the attacker**, and the fake, to avoid
suspicion, sends the person back to the real bank.

#### Step by step

The attacker logs into the bank with the stolen password. If the bank has a second factor, the fake
page may ask for the SMS code as well; the “Phishing” lesson covers that.

#### Deeper

CWE-601 mentions other consequences too: a redirect to a page that immediately downloads a malicious
file. And OWASP notes that an unchecked redirect inside a site can lead past an access check to
functions the visitor is not allowed to use.

### `allow` Checking the address

`bank → bank` · `attack` · `with-defence` · `stopped`
Message: address not on the list · Result: redirect cancelled, the attack failed

```text
to = ⟦https://bank-login.example/⟧
allowed: /account, /cards, /help → no
```

#### Simple

With the defence on, the bank first **checks the address against its list**. The foreign site is
not on it, and the bank will not send anyone there. The attack stops here.

#### Step by step

The bank parses the address into parts and compares the scheme, host name and port with the list.
Only what is on the list passes. Everything else is refused.

#### Deeper

OWASP suggests something safer still: accept no address at all, but a short name or page number,
and turn it into an address on the server. If addresses are needed, parse them with a real URL
parser instead of comparing the start of the string: a check for “starts with
`https://bank.example`” is bypassed by an address like `https://bank.example.attacker.example`.

### `home` Its own page

`bank → user` · `safe` · `with-defence`
Message: 302 Location: /account · Result: the attack failed

```http
HTTP/1.1 302 Found
Location: /account
```

#### Simple

Instead of the foreign site the bank sends the person **to its own page**: their account. The
phishing page never opened.

#### Step by step

Links the bank itself puts into its emails and pages work as before: all their addresses are on
the list.

#### Deeper

If a site does need to let people go to external addresses, OWASP suggests an intermediate page:
“You are leaving the bank's site for this address”, with a button to confirm.

## How to defend

- **Do not take the address from the link.** If you can, do not redirect to an address from a
  parameter at all.
- **A number instead of an address.** Accept a short name or number and look up the real address
  on the server.
- **An allowlist.** If an address does come in, parse it with a URL parser and compare the scheme,
  host and port with the allowed list. Do not compare the start or end of the string.
- **Own pages only.** For returning after login, allow only your own site's addresses; frameworks
  have ready helpers for this.
- **A warning.** For external addresses, an intermediate page with the address and a button.
- **OAuth.** Compare the return address with the registered one exactly; neither the client site
  nor the authorization server may have open redirects.
