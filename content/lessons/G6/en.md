# Evil twin Wi-Fi

`lesson` G6 · `section` G · `wave` 3 · `format` 1

## Passport

- `attack` T1557.004
- `severity` high
- `impact` The guest's traffic goes through the attacker's access point, and passwords typed into the fake login page end up with the attacker
- `defence` Protected management frames (PMF) and WPA3
- `class` Rogue Wi-Fi access point

## Sources

- [MITRE ATT&CK T1557.004: Adversary-in-the-Middle: Evil Twin](https://attack.mitre.org/techniques/T1557/004/)
- [MITRE ATT&CK T1557: Adversary-in-the-Middle](https://attack.mitre.org/techniques/T1557/)
- [CISA: Securing Wireless Networks](https://www.cisa.gov/news-events/news/securing-wireless-networks)
- [Wi-Fi Alliance: Security (WPA3)](https://www.wi-fi.org/discover-wi-fi/security)
- [Wi-Fi Alliance: Protected Management Frames enhance Wi-Fi network security](https://www.wi-fi.org/beacon/philipp-ebbecke/protected-management-frames-enhance-wi-fi-network-security)
- [RFC 5216: The EAP-TLS Authentication Protocol](https://www.rfc-editor.org/rfc/rfc5216.html)
- [RFC 9542: IANA Considerations and IETF Protocol and Documentation Usage for IEEE 802 Parameters](https://www.rfc-editor.org/rfc/rfc9542.html)

## Participants

- `ap` **Café AP** — CafeNet · `icon:router`
- `user` **Guest** — laptop · `term:victim`
- `attacker` **Twin** — also CafeNet · `term:evil-twin`

## Zones

- `cafe` Café Wi-Fi: `ap`, `user`
- `twin` Fake access point: `attacker` · `danger`

## Steps

### `beacon` The real network

`ap → user` · `legit`
Message: "I am CafeNet" · Result: laptop connected

```text
beacon: network CafeNet, access point 00-00-5E-00-53-01
```

#### Simple

A guest walks into a café and joins the Wi-Fi called **CafeNet**. The laptop remembers the
network and will join it on its own next time.

#### Step by step

The access point keeps broadcasting a beacon: "network CafeNet is here". The laptop finds the
network by name and connects to the access point with that hardware address.

#### Deeper

Anyone can give a network any name (the SSID): it is just a string. Devices tell access points
apart only by their hardware address (the BSSID), which people never see. The addresses in this
lesson come from the range reserved for documentation (RFC 9542).

### `twin` A second CafeNet

`attacker → user` · `attack`
Message: "I am CafeNet too" · Result: two access points, one name

```text
beacon: network CafeNet, access point ⟦00-00-5E-00-53-66⟧, stronger signal
```

#### Simple

At the next table, the attacker switches on an access point and gives it **the same name**:
CafeNet. It is closer, so its signal is stronger.

#### Step by step

The laptop sees two networks with one name. To a person they are the same café network and show
up once in the Wi-Fi list. Only the access point's hardware address and the signal strength
differ.

#### Deeper

This is an evil twin, MITRE ATT&CK sub-technique T1557.004 "Evil Twin". The attacker does not
even have to wait in the café: devices broadcast requests naming the networks they know, and a
fake access point can simply answer "yes, that's me". If the café's Wi-Fi password is on the
wall, the twin knows it too.

### `kick` "Disconnect"

`attacker → user` · `attack` · `without-defence`
Message: "disconnect", posing as the AP · Result: laptop disconnected

```text
from:   00-00-5E-00-53-01 (forged)
to:     the guest's laptop
frame:  ⟦deauthentication⟧
```

#### Simple

While the laptop is on the real access point, the attacker sends it a control message,
**"disconnect"**, as if it came from the café's access point. The laptop believes it and drops
off.

#### Step by step

The attacker puts the real access point's address in the frame. The laptop receives a
deauthentication frame, drops the connection and immediately looks for CafeNet again.

#### Deeper

On networks without PMF (most WPA2 networks), management frames such as "disconnect" are not
protected at all. Anyone
who knows the access point's address can forge them, and that address is in every beacon. One
guest or everyone at once can be kicked off this way.

### `join` Joining the twin

`user → attacker` · `attack` · `without-defence`
Message: connect to CafeNet · Result: laptop is on the twin

#### Simple

The laptop looks for a known network, sees CafeNet with the strongest signal and joins it. That
is **the attacker's access point**. The guest notices nothing: the Wi-Fi icon is back on.

#### Step by step

Of two access points with one name, the laptop picks the one it hears best. Now everything it
sends to the internet goes through the attacker's laptop first.

#### Deeper

The attacker is now in the middle: forwarding traffic and able to read anything that is not
encrypted, or change the replies. Sites on HTTPS stay unreadable as long as the browser checks
the certificate and the guest does not click past the error.

### `portal` A login page

`attacker → user` · `attack` · `without-defence`
Message: "sign in with your email" · Result: fake page shown

```text
http://login.cafe.example
To get online, sign in with your email: address and ⟦password⟧
```

#### Simple

A page pops up: "To get online, sign in with your email". It looks like an ordinary café Wi-Fi
login page. **The twin** is showing it.

#### Step by step

The twin intercepts the first page the laptop opens and puts its own page in its place. The page
is plain HTTP, and its address looks like the café's.

#### Deeper

Many public networks really do ask you to sign in on a page like this, so it raises no
suspicion. MITRE ATT&CK describes exactly this move: after the victim connects, they are sent to
a fake login page that collects passwords.

### `creds` The password goes to the twin

`user → attacker` · `attack` · `without-defence`
Message: email and password · Result: stolen

#### Simple

The guest types in an email address and password. They go to **the attacker**. To avoid
suspicion, the twin then lets the guest online.

#### Step by step

The form sends the password to the attacker's access point in plain text. The attacker keeps it
and later signs in to the guest's mailbox.

#### Deeper

Email is often how other accounts are recovered, so one stolen password can open a lot. A second
sign-in factor helps, and so does the habit of never typing the password for your own accounts
into a Wi-Fi login page.

### `kick-pmf` The forgery fails

`attacker → user` · `attack` · `with-defence` · `stopped`
Message: "disconnect", posing as the AP · Result: check failed, frame dropped

```text
frame:  deauthentication from 00-00-5E-00-53-01
check:  ⟦key does not match⟧ → frame dropped
```

#### Simple

Now the café network runs **WPA3**. The attacker again sends "disconnect" in the access point's
name. The laptop checks the frame, sees a forgery and **stays connected**. The attack stops
here.

#### Step by step

Management frames are protected with a key known only to the laptop and the real access point.
The forged frame does not pass the check, and the laptop simply throws it away.

#### Deeper

These are protected management frames, PMF (the IEEE 802.11w amendment). According to the Wi-Fi
Alliance, PMF is mandatory on WPA3 networks, and an access point can report forgery attempts to
a monitoring system. PMF does not stop a twin from waiting for new guests who have not connected
yet. That is why offices need the sign-in server's certificate checked, and other people's
networks call for HTTPS and a VPN.

### `stay` The connection holds

`user → ap` · `safe` · `with-defence`
Message: traffic via the café AP · Result: the twin gets nothing

#### Simple

The laptop stays on the **real** café access point. The twin keeps broadcasting beacons, but
nobody moves over to it.

#### Step by step

The laptop is already connected and is not looking for the network again, so the twin's
stronger signal does not matter. Traffic flows through the café's access point.

#### Deeper

On a corporate network (WPA3-Enterprise or WPA2-Enterprise), the laptop checks the sign-in
server's certificate when it connects: that is how EAP-TLS works (RFC 5216). A twin cannot
present that certificate. The check has to be switched on in the settings, though: without it
the laptop will join any access point with the right name.

## How to defend

- **WPA3 and PMF.** Access points and devices with WPA3 and management frame protection set to
  required. A forged "disconnect" then does nothing.
- **Corporate Wi-Fi with certificate checks.** Staff devices check the sign-in server's
  certificate and the name it was issued for. Without that check, on networks where staff sign in
  with a password, an evil twin collects their passwords.
- **HTTPS and a VPN on other people's networks.** Even if a guest ends up on the twin, it cannot
  read encrypted traffic. Do not click past certificate errors.
- **Never type passwords into a Wi-Fi login page.** A real café network does not need your email
  password. Ask the staff for the network name and password.
- **Forget public networks.** Laptops and phones should not rejoin networks you used once on
  their own.
- **Look for rogue access points.** In the office, a wireless intrusion detection system looks
  for access points with your network's name but a foreign address or an unusually strong
  signal.
