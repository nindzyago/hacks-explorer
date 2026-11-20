# SSRF: the server goes where it should not

`lesson` D8 · `section` D · `wave` 2 · `format` 1

## Passport

- `cwe` 918
- `owasp` A10:2021
- `attack` T1552.005
- `severity` high
- `impact` Cloud access keys reach the attacker through the site's server
- `defence` An allowlist of addresses, no internal networks, a protected metadata service
- `class` Forged request from the server side

## Sources

- [OWASP: Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Top 10:2021 A10: Server-Side Request Forgery (SSRF)](https://owasp.org/Top10/2021/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/)
- [MITRE CWE-918: Server-Side Request Forgery (SSRF)](https://cwe.mitre.org/data/definitions/918.html)
- [MITRE ATT&CK T1552.005: Cloud Instance Metadata API](https://attack.mitre.org/techniques/T1552/005/)

## Participants

- `pics` **Photos** — pics.example · `icon:server`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — shop.example · `term:web-server`
- `meta` **VM data** — 192.0.2.254 · `icon:db` · `term:cloud-metadata`

## Zones

- `internet` Internet: `pics`, `attacker`
- `cloud` The shop's cloud: `server`, `meta` · `term:trust-boundary`

## Steps

### `avatar` An avatar from a link

`attacker → server` · `legit`
Message: a link to a picture · Result: accepted

```http
POST /avatar
Host: shop.example

url=https://pics.example/cat.png
```

#### Simple

The shop lets you set an avatar **from a link**: paste a picture's address and the site downloads
it itself. The attacker first tries an ordinary picture.

#### Step by step

The shop's server takes the link. **It** will download the picture, not the visitor's browser.

#### Deeper

Such features are common: link previews in a chat, importing a file from an address, checking a
webhook, turning pages into PDF. In all of them the server makes a request to an address the
visitor chose.

### `fetch` The server downloads the picture

`server → pics` · `legit`
Message: GET /cat.png · Result: picture received

```http
GET /cat.png
Host: pics.example
```

#### Simple

The server goes to the photo site, downloads the picture and shows it to the attacker as his new
avatar. All as intended.

#### Step by step

The attacker has made sure: the server **goes to the link by itself** and returns what it got.

#### Deeper

Where the request comes from matters. It is sent by a machine inside the shop's cloud, and that
machine can reach addresses the internet cannot: internal services, databases, control panels.

### `evil-url` A link to the inside

`attacker → server` · `attack` · `without-defence`
Message: a link to metadata · Result: accepted

```http
POST /avatar

url=⟦http://192.0.2.254/secrets/role-key⟧
```

#### Simple

Now the attacker sends a link not to a picture but to an **internal cloud service**. It cannot be
opened from the internet, but the shop's server sees it right next to itself.

#### Step by step

The server does not check the address: a link is a link. It gets ready to download the "picture"
from that address.

#### Deeper

Virtual machines in a cloud have a **metadata service**: it tells the machine itself what machine
it is and hands it temporary keys for the cloud. In real clouds it has a special service address
from the link-local range, the same at many providers; in this lesson the teaching address
192.0.2.254 stands in for it, and the path is made up.

### `inside` A request to the metadata

`server → meta` · `attack` · `without-defence`
Message: key request · Result: keys handed out

```http
GET /secrets/role-key
Host: 192.0.2.254
```

#### Simple

The metadata service gets a request **from its own machine** and answers calmly. It does not know
the attacker suggested the address.

#### Step by step

The answer holds the temporary keys the shop's server uses to work with the cloud: file storage,
queues, databases.

#### Deeper

MITRE ATT&CK describes this as sub-technique T1552.005 "Cloud Instance Metadata API" and names
SSRF in a web proxy reachable from the internet as one way to it; our avatar-from-a-link server
acts as such a proxy. OWASP notes that in the cloud SSRF is often used to steal keys and tokens
from the metadata service.

### `keys` The keys reach the attacker

`server → attacker` · `attack` · `without-defence`
Message: an "avatar" with keys · Result: keys with the attacker

```json
{"key": "⟦AKEXAMPLE…⟧", "secret": "⟦…⟧", "expires": "…"}
```

#### Simple

The server hands the attacker what it "downloaded": **the cloud keys** instead of a picture. With
them the attacker talks to the shop's cloud directly.

#### Step by step

The server did not check that a picture came back and returned the answer as is. Even without
that, the attacker can sometimes infer the answer from side signs: an error, the timing, the size.

#### Deeper

In the MITRE catalogue this weakness is CWE-918: the server receives an address and fetches its
contents without making sure the request goes where intended. OWASP made it a separate item,
A10:2021, after a community survey: cases are few, but the impact is heavy, especially in the
cloud.

### `allowlist` Checking the address before the request

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: a link to metadata · Result: the attack failed

```text
address:  ⟦192.0.2.254⟧
list:     pics.example, img.example
result:   not on the list → refused
```

#### Simple

The server downloads pictures **only from allowed sites**, by an allowlist. The internal address
is not on it, and no request is sent.

#### Step by step

The server parses the link itself: the scheme only `https`, the host from the list, the standard
port. Then it looks up the host's IP address, checks that it is not internal, and connects
**exactly to the checked** address.

#### Deeper

OWASP advises an allowlist, not a blocklist: a ban on internal addresses is bypassed with another
way of writing the same address (decimal, hexadecimal, through IPv6) or with a domain that points
inside. Checking the name without checking the address does not stop DNS rebinding: on the second
DNS lookup the same domain already points to an internal address. Following redirects must be
switched off too, or an allowed site will answer "go to the internal address".

### `refuse` A refusal instead of a download

`server → attacker` · `safe` · `with-defence`
Message: 400 · Result: keys stay put

```http
HTTP/1.1 400 Bad Request

link not allowed
```

#### Simple

The attacker gets a **refusal**. The metadata service never saw the request.

#### Step by step

The attempt goes into the log: a link to an internal address in the avatar form is a clear sign of
an attack.

#### Deeper

Protection is also set at the network level: the machine that downloads other people's links is
cut off from the internal network by a "deny by default" rule. For the AWS cloud, OWASP advises
moving to IMDSv2 and switching off the old IMDSv1: an extra layer that protects the metadata
service from some SSRF attacks.

## How to defend

- **An allowlist.** The server goes only to hosts, schemes and ports allowed in advance, and builds
  the request address itself.
- **Checking the IP address.** After DNS the server checks the resulting address and connects to
  exactly that one; internal, local and link-local addresses are forbidden.
- **No redirects.** The server's client does not follow an answer saying "go to another address".
- **Do not pass the answer on as is.** The user gets a picture after checking, not a raw answer
  from someone else's server.
- **The network.** The download feature lives in a separate network segment, with outgoing
  connections under a "deny by default" rule.
- **The metadata service.** Turn on its protected mode (IMDSv2 in AWS) and give the machine keys
  with minimal rights.
