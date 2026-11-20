# Clickjacking

`lesson` C5 · `section` C · `wave` 2 · `format` 1

## Passport

- `cwe` 1021
- `owasp` A04:2021
- `severity` medium
- `impact` The victim herself presses a button on the real site without seeing it: shares her data, changes settings
- `defence` Forbid showing the page in someone else's frame (frame-ancestors)
- `class` User interface deception

## Sources

- [OWASP: Clickjacking Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html)
- [OWASP Top 10:2021, A04 Insecure Design](https://owasp.org/Top10/2021/A04_2021-Insecure_Design/)
- [MITRE CWE-1021: Improper Restriction of Rendered UI Layers or Frames](https://cwe.mitre.org/data/definitions/1021.html)
- [MITRE CAPEC-103: Clickjacking](https://capec.mitre.org/data/definitions/103.html)
- [MDN: Clickjacking](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Clickjacking)
- [MDN: CSP, frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
- [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)
- [RFC 7034: HTTP Header Field X-Frame-Options](https://www.rfc-editor.org/rfc/rfc7034.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `evil` **Prize site** — prize.example · `icon:document` · `term:clickjacking`
- `browser` **Victim's browser** — 192.0.2.24 · `term:victim`
- `server` **Photo service** — photos.example · `term:web-server`

## Zones

- `internet` Internet: `attacker`
- `bait` Someone else's site: `evil` · `danger` · `term:clickjacking`
- `home` Home: `browser`
- `site` Photo service: `server` · `term:trust-boundary`

## Steps

### `bait` A prize page with an invisible frame

`attacker → evil` · `attack`
Message: bait page · Result: published

```html
<iframe src="https://photos.example/settings/share" style="⟦opacity:0⟧"></iframe>
<button>Claim your prize</button>
```

#### Simple

The attacker makes a page with a big “Claim your prize” button. On top of the button he lays a
**transparent frame** that shows the real photo service, its sharing settings page.

#### Step by step

A frame (`iframe`) shows one page inside another. The attacker makes it fully transparent and
moves it so that the “Share all photos” button inside the frame sits exactly over the prize
button.

#### Deeper

*Clickjacking* means “hijacking a click”. MITRE describes the weakness like this: the application
does not restrict, or poorly restricts, frames and interface layers that belong to another site
(CWE-1021). The frame is invisible to the eye, but the browser treats it as the top layer, and it
gets the clicks.

### `visit` The victim opens the bait

`evil → browser` · `attack`
Message: prize page · Result: shown

#### Simple

The victim follows an ad or a link from a chat and sees a page: “You won! Click to claim your
prize.” Nothing suspicious: just a button.

#### Step by step

The browser loads the prize.example page. The markup contains a frame pointing to
photos.example, and the browser starts loading it.

#### Deeper

The bait can come from anywhere: the MITRE attack catalog (CAPEC-103) gives an example with a
payment service, where the victim is already logged in to the service and the link to the bait
arrives by email.

### `frame` The frame loads the real site

`browser → server` · `legit`
Message: settings request · Result: request accepted

```http
GET /settings/share
Host: photos.example
Cookie: session=7f3a9c
```

#### Simple

The browser opens the photo service page in the frame. The victim has logged in there before, so
the browser attaches her **pass**, the session cookie. The service sees its usual account owner.

#### Step by step

For the photo service this is an ordinary request for the settings page. It does not know that
the page will be shown inside someone else's site and that nobody can see it.

#### Deeper

The cookie reaches the frame only if the browser attaches it to requests from other sites.
According to OWASP, a cookie with `SameSite=Strict` or `SameSite=Lax` is not sent to a frame on
someone else's site, and this attack would fail. Browsers that block third-party cookies will
not send it either. Here the photo service uses `SameSite=None`, and the victim's browser allows
such cookies.

### `render` Settings in a transparent frame

`server → browser` · `attack` · `without-defence`
Message: settings page · Result: shown in someone else's frame

#### Simple

The photo service sends the page and **does not say** that it must not be shown inside other
sites. The browser draws it in the frame, transparent, over the prize button.

#### Step by step

The response has neither `X-Frame-Options` nor a `frame-ancestors` rule. Without them, the
browser lets any site embed the page.

#### Deeper

If the site sent none of these restrictions, the browser lets any site embed the document. MDN
warns that even a strict `default-src 'none'` does not change this: framing is controlled only by
`frame-ancestors`. So every page where one click changes something needs protection: settings,
payments, deletion, subscriptions.

### `click` The click goes into the frame

`browser → server` · `attack` · `without-defence`
Message: click on “Share” · Result: all photos are now public

```http
POST /settings/share
Host: photos.example
Cookie: session=7f3a9c

albums=⟦all&visibility=public⟧
```

#### Simple

The victim clicks “Claim your prize”. In fact she pressed **the photo service's invisible
button**. All her photos are now visible to anyone.

#### Step by step

The click goes to the top layer, which is the frame. The button in the frame submits the
settings form, the browser attaches the cookie, and the photo service does what its owner asked.

#### Deeper

Request forgery protection does not help here: the CSRF token sits in the real form inside the
frame, and the request honestly comes from the service's own page. The server cannot check that
the victim saw what she was clicking. That is why the defence is to forbid framing.

### `deny` A response that forbids frames

`server → browser` · `attack` · `with-defence` · `stopped`
Message: frame ban · Result: the browser did not show the frame, the attack failed

```http
Content-Security-Policy: ⟦frame-ancestors 'none'⟧
X-Frame-Options: DENY
```

#### Simple

Now the photo service answers with a note: “**do not show me inside other sites**”. The browser
sees that prize.example is embedding the page and does not show the frame. This is where the
attack stops.

#### Step by step

The `frame-ancestors` rule in the Content Security Policy header lists who may embed the page.
`'none'` means nobody, `'self'` means only the site itself. The older `X-Frame-Options` header
with `DENY` or `SAMEORIGIN` does the same for older browsers.

#### Deeper

`X-Frame-Options` is described in RFC 7034 (2013, informational). Its `ALLOW-FROM` value is
obsolete: according to MDN, modern browsers ignore the whole header when they see it, and
`frame-ancestors` is used instead. Both work only as response headers: `X-Frame-Options` in a
`<meta>` tag has no effect.

### `empty` Nothing under the button any more

`browser → browser` · `safe` · `with-defence`
Message: click on “Claim your prize” · Result: nothing changed

#### Simple

The victim clicks the prize button. Under it there is an empty frame, and **the photo service
settings are untouched**.

#### Step by step

The browser did not draw the settings page, so the click goes only to the bait's own button.
The photos stay private.

#### Deeper

The old way to defend was a script on the page that checks whether it is open inside a frame (a
*frame-buster*). OWASP keeps it only for legacy browsers: the reliable defence is a response
header, which a script on someone else's page cannot get around.

## How to defend

- **Forbid other sites' frames.** Send `Content-Security-Policy: frame-ancestors 'none'`, or
  `frame-ancestors 'self'` if the site embeds itself. For older browsers, add
  `X-Frame-Options: DENY` or `SAMEORIGIN`.
- **On every page where a click changes something.** Settings, payments, deletion,
  subscriptions, permissions: each such page needs the protection in its response, not just the
  home page.
- **Only as a header.** `X-Frame-Options` in a `<meta>` tag does not work, and `ALLOW-FROM` is
  obsolete. A list of allowed sites goes into `frame-ancestors`.
- **SameSite for the session cookie.** With `SameSite=Lax` or `Strict`, the browser will not
  attach the cookie to a frame on someone else's site, and the victim will appear logged out in
  it. This is a second layer: it does not forbid frames.
