# HTTP request smuggling

`lesson` E1 · `section` E · `wave` 3 · `format` 1

## Passport

- `cwe` 444
- `owasp` A04:2021
- `severity` high
- `impact` A hidden request runs on behalf of another visitor, with their cookies
- `defence` Rejecting a request with two length headers, HTTP/2 all the way to the server
- `class` Proxy and server out of sync

## Sources

- [RFC 9112: HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-11.2)
- [RFC 9113: HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.2.2)
- [MITRE CWE-444: Inconsistent Interpretation of HTTP Requests](https://cwe.mitre.org/data/definitions/444.html)
- [OWASP Top 10:2021 A04: Insecure Design](https://owasp.org/Top10/2021/A04_2021-Insecure_Design/)

## Participants

- `user` **Anna** — browser · `term:victim`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `proxy` **Proxy** — shop.example · `icon:router` · `term:reverse-proxy`
- `server` **Server** — inside · `term:web-server`

## Zones

- `internet` Internet: `user`, `attacker`
- `site` Shop shop.example: `proxy`, `server`

## Steps

### `smuggle` A request with two lengths

`attacker → proxy` · `attack` · `without-defence`
Message: POST with two lengths · Result: accepted

```http
POST / HTTP/1.1
Host: shop.example
⟦Content-Length: 62⟧
⟦Transfer-Encoding: chunked⟧

0

⟦GET /settings/email?new=x@evil.example HTTP/1.1⟧
⟦X-Skip: ⟧
```

#### Simple

In HTTP/1.1 the length of a request body can be given **in two ways**: as a byte count in
`Content-Length`, or in chunks (`chunked`), where an empty chunk `0` means "the end". The attacker
gives **both**, and they say different things.

#### Step by step

By `Content-Length` the body is everything up to the last line. By chunks the body ends right at
`0`, and what follows is a **second request** hidden inside the first. It is unfinished: the last
line breaks off at the header `X-Skip:`.

#### Deeper

This variant is called CL.TE: the proxy trusts `Content-Length`, the server trusts
`Transfer-Encoding`. It also happens the other way round (TE.CL), and with a cleverly written
`Transfer-Encoding` that one party recognises and the other does not. The technique was described
in 2005 by Linhart, Klein, Heled and Orrin; RFC 9112 (section 11.2) cites their work.

### `cl` The proxy sees one request

`proxy → server` · `attack` · `without-defence`
Message: one request · Result: forwarded

```text
proxy: Content-Length: 62 → one whole request
```

#### Simple

The **proxy** stands in front of the server: it takes requests from the internet and forwards
them to the server. It trusts `Content-Length` and sees **one** ordinary request to `/`. Nothing
suspicious.

#### Step by step

To avoid opening a connection for every request, the proxy keeps a few persistent connections to
the server and sends requests from **different visitors** down them one after another.

#### Deeper

The only boundary between requests on such a connection is the body length. If the proxy and the
server count it differently, they stop agreeing on where one request ends and the next begins.
MITRE calls this CWE-444 "Inconsistent Interpretation of HTTP Requests".

### `te` The server sees a request and a half

`server → server` · `attack` · `without-defence`
Message: ends at 0 · Result: a tail waits

```text
server: Transfer-Encoding: chunked → the body ended at 0
leftover: ⟦GET /settings/email?new=x@evil.example …⟧
```

#### Simple

The **server** trusts the chunks. For it the body ended at `0`, and it answers the request to `/`.
The tail with `GET /settings/email` stays in the connection as **the start of the next request**.

#### Step by step

The start waits for the rest. The next bytes to arrive on this connection will be glued to it by
the server.

#### Deeper

RFC 9112 (section 6.3) settles the dispute this way: if both headers are present,
`Transfer-Encoding` overrides `Content-Length`. But it warns straight away that such a message may
be an attempt at request smuggling and ought to be handled as an error. An intermediary that
forwards it anyway must first remove `Content-Length`. The proxy in this lesson did not.

### `anna` Anna opens her cart

`user → proxy` · `legit`
Message: GET /cart with cookies · Result: accepted

```http
GET /cart HTTP/1.1
Host: shop.example
Cookie: session=anna…
```

#### Simple

Anna suspects nothing: she opens **her cart**. The browser attaches her session cookies.

#### Step by step

The proxy takes the ordinary request and sends it to the server, over the same persistent
connection where the attacker's tail is lying.

#### Deeper

The attacker does not need to know who comes next. He repeats his request until the tail lands on
someone who is logged in.

### `glued` Anna's request glued to someone else's

`proxy → server` · `attack` · `without-defence`
Message: glued · Result: Anna's email changed

```http
GET /settings/email?new=x@evil.example HTTP/1.1
X-Skip: ⟦GET /cart HTTP/1.1⟧
Host: shop.example
Cookie: ⟦session=anna…⟧
```

#### Simple

The server glues the tail and Anna's request into **one**. Anna's line "GET /cart" ended up as the
value of the `X-Skip` header, and her cookies went to the hidden request. The server changes
**Anna's email** to the attacker's address.

#### Step by step

Now the attacker can ask for a password reset to his own address and take over the account. Anna
gets an odd answer instead of her cart and will most likely just reload the page.

#### Deeper

Changing the email with a plain GET is an extra weakness of this made-up shop, here for brevity.
Smuggling works with any action the server performs based on a cookie. There are other uses too:
the proxy lets through a hidden request to a page it blocks from outside, because it never saw
that request.

### `reject` The proxy rejects two lengths

`attacker → proxy` · `attack` · `with-defence` · `stopped`
Message: POST with two lengths · Result: the attack failed

```http
POST / HTTP/1.1
⟦Content-Length: 62⟧
⟦Transfer-Encoding: chunked⟧
```

#### Simple

The proxy sees **both length headers** at once and does not guess which one to trust. The request
never reaches the server.

#### Step by step

The proxy does not forward such a request and closes the connection with the attacker. There is
nowhere for a tail to stay.

#### Deeper

RFC 9112 allows a server to reject a request that has both `Content-Length` and
`Transfer-Encoding` (section 6.1), and in any case requires closing the connection after
answering it. Most reliable is when the proxy and the server are the same strict implementation,
or HTTP/2 runs between them: there the length comes from protocol frames, and
`Transfer-Encoding` is forbidden (RFC 9113, section 8.2.2).

### `refuse` A 400 answer

`proxy → attacker` · `safe` · `with-defence`
Message: 400, connection closed · Result: no tail

```http
HTTP/1.1 400 Bad Request
Connection: close
```

#### Simple

The attacker gets **error 400**, and the connection is closed. Nothing is left queued for the
server.

#### Step by step

The attempt shows up in the proxy's log: ordinary browsers do not send two length headers.

#### Deeper

If the proxy accepts HTTP/2 from outside but talks HTTP/1.1 to the server, smuggling is possible
during the translation. RFC 9113 (section 8.1.1) says a request is malformed if `content-length`
does not equal the sum of the DATA frame lengths, and intermediaries must not forward such
requests.

### `clean` Anna's request arrives alone

`proxy → server` · `safe` · `with-defence`
Message: GET /cart · Result: Anna sees her cart

```http
GET /cart HTTP/1.1
Host: shop.example
Cookie: session=anna…
```

#### Simple

Anna's request reaches the server **on its own**, with no foreign start. Anna sees her cart, and
her email is untouched.

#### Step by step

The proxy and the server see request boundaries the same way, so nothing extra slips through the
shared connection.

#### Deeper

Check the whole chain: a CDN, a load balancer, a proxy and a server may all be different programs.
One link that reads the request boundary differently from its neighbour is enough.

## How to defend

- **Reject ambiguous requests.** A request with both `Content-Length` and `Transfer-Encoding`,
  with two different `Content-Length` values, or with an unclear `Transfer-Encoding` gets a 400,
  and the connection is closed.
- **HTTP/2 all the way to the server.** The length comes from protocol frames, not headers;
  `Transfer-Encoding` is forbidden in HTTP/2.
- **Strict HTTP/2 → HTTP/1.1 translation.** The proxy checks `content-length` against the frames
  and lets no line breaks into header fields.
- **The same reading along the whole chain.** The proxy and the server are up to date and set up
  according to RFC 9112; the same parsing implementation is better still.
- **No shared connections if in doubt.** A separate connection per request costs more, but a tail
  has nothing to stick to.
