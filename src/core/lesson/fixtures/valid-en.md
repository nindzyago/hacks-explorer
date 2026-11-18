# A training attack

`lesson` X1 · `section` X · `wave` 2 · `format` 1

## Passport

- `cwe` 89, 564
- `owasp` A03:2021
- `attack` T1190
- `cvss` CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
- `cves` CVE-2021-44228
- `severity` high
- `impact` Someone else's data
- `defence` Server-side check

## Sources

- [OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/index.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66
- `user` **Visitor** — 2001:db8::24 · `icon:laptop`
- `site` **Site** — shop.example

## Zones

- `outside` Outside: `attacker`
- `inside` Inside: `user`, `site` · `danger`

## Steps

### `send` Sending

`attacker → site` · `attack` · `icon:mail`
Message: a letter · Result: delivered

```http
GET /?q=⟦evil⟧ HTTP/1.1
Host: shop.example
```

#### Simple

The attacker sends a **request** to `shop.example`.

#### Step by step

1. First item.
2. Second *item*.

#### Deeper

Details: address 192.0.2.10, network 198.51.100.0/24, mail anna@mail.test.

### `pass` Let through

`site → user` · `attack` · `without-defence`
Message: response · Result: the attack worked

#### Simple

The site lets it through.

#### Step by step

The site lets the request through.

#### Deeper

The site lets the request through unchecked.

### `block` Refusal

`site → attacker` · `safe` · `with-defence` · `stopped`
Message: refusal · Result: stopped

#### Simple

The site refuses.

#### Step by step

The site checks the request and refuses.

#### Deeper

The site compares the request with the allowlist.

## How to defend

Check the request on the server.
