# Malicious ads and fake updates

`lesson` I5 · `section` I · `wave` 3 · `format` 1

## Passport

- `attack` T1583.008, T1189, T1204.002
- `severity` high
- `impact` The user runs a trojan themselves, and the attacker gets access to the computer
- `defence` Updates only through the built-in updater, control over which programs may run
- `class` Malvertising, social engineering

## Sources

- [MITRE ATT&CK T1583.008: Acquire Infrastructure: Malvertising](https://attack.mitre.org/techniques/T1583/008/)
- [MITRE ATT&CK T1189: Drive-by Compromise](https://attack.mitre.org/techniques/T1189/)
- [MITRE ATT&CK T1204.002: User Execution: Malicious File](https://attack.mitre.org/techniques/T1204/002/)
- [CISA: Understanding Patches and Software Updates](https://www.cisa.gov/news-events/news/understanding-patches-and-software-updates)
- [CISA: Update Software](https://www.cisa.gov/secure-our-world/update-software)

## Participants

- `browser` **Browser** — 192.0.2.24 · `icon:browser` · `term:victim`
- `site` **Site** — news.example · `icon:server`
- `ads` **Ads** — ads.example · `icon:server` · `term:malvertising`
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`

## Zones

- `home` At home: `browser`
- `web` Ordinary sites: `site`, `ads`
- `internet` Attacker's server: `attacker`

## Steps

### `page` An ordinary article

`browser → site` · `legit` · `icon:browser`
Message: article · Result: page with ads

```text
GET https://news.example/article
<div class="ad-slot"></div>   ad space filled from ads.example
```

#### Simple

Someone is reading the news on an ordinary site. The site is honest and does nothing wrong. The
page has a space for ads.

#### Step by step

The site does not pick the ads itself: the ad network `ads.example` fills the space. Whoever bought
the slot decides what the reader sees.

#### Deeper

One page can hold dozens of third-party pieces: ads, counters, widgets. The site is responsible
for its article but does not see every ad in advance. That is what the attacker relies on.

### `ad` A "browser out of date" banner

`ads → browser` · `attack` · `icon:browser`
Message: banner · Result: shown to the reader

```text
⟦Your browser is out of date and vulnerable!⟧
Install the update right now  [ Update ]
```

#### Simple

The attacker bought ads like any other advertiser. The reader sees an alarming banner: "Your
browser is out of date, update it".

#### Step by step

The ad network reviews ads, but the attacker fools it: automated reviewers are shown a harmless
page, and real people who click get the trap.

#### Deeper

In MITRE ATT&CK, buying ads to spread malware is sub-technique T1583.008 "Malvertising". The page
also describes how attackers hide from the ad network: they route its reviewers to harmless sites
and victims to malicious ones. The ads often pose as well-known brands and lead to a copy of the
official site.

### `click` Clicking the banner

`browser → attacker` · `attack` · `icon:browser`
Message: click · Result: an "update" page

```text
https://⟦browser-update.example⟧/
"Security update. Download and run the file."
```

#### Simple

The reader clicks the banner and lands on a page that looks like the browser maker's site. It asks
them to download an "update".

#### Step by step

The page copies the logo, colours and wording of the real site. The address looks similar, but the
domain is the attacker's. The urgency ("vulnerable!") keeps people from looking closely.

#### Deeper

A real browser updates itself, through its own settings, not through a banner on someone else's
site. CISA advises going to the vendor's site directly rather than through links in ads and
emails.

### `download` The "update file" is downloaded

`attacker → browser` · `attack` · `without-defence`
Message: browser-update.exe · Result: file run

```text
Downloads: ⟦browser-update.exe⟧
User: open, "Yes, allow changes"
```

#### Simple

The reader downloads the file and runs it. It looks like an ordinary install, but inside is a
**trojan**.

#### Step by step

The computer was not broken into through a vulnerability: the person ran the program and gave it
permissions. To the system it is a normal install that the user approved.

#### Deeper

In ATT&CK, a user running a malicious file is sub-technique T1204.002 "User Execution: Malicious
File". The attacker disguises the file as something familiar: a known name, an icon, the word
"update". Had the attacker found a vulnerability in an outdated browser, a single visit to the page
would have been enough, with nothing to run: that is a classic drive-by (T1189).

### `beacon` The trojan calls home

`browser → attacker` · `attack` · `without-defence`
Message: trojan online · Result: computer in the attacker's hands

```text
⟦→ 203.0.113.66⟧  "installed, waiting for commands"
```

#### Simple

The trojan contacts the attacker's server. Now the attacker can steal passwords and files or
install something else.

#### Step by step

The connection goes from inside to outside, like any normal trip to the internet, so the home
router does not stop it. What happens next depends on what the attacker wants.

#### Deeper

This control channel is called C2. Filtering outgoing connections and antivirus help against it,
but best of all is not letting the trojan run in the first place.

### `blocked` Not allowed to run

`attacker → browser` · `attack` · `with-defence` · `stopped`
Message: browser-update.exe · Result: stopped

```text
browser-update.exe: publisher is not on the allowed list
Blocked from running by computer policy
```

#### Simple

The file downloaded, but the computer will not let it run: only programs from known publishers
are allowed. The trojan just sits in Downloads.

#### Step by step

This is **application control**: the system checks the file against a list of allowed programs and
refuses everything else. It does not matter how convincing the banner was.

#### Deeper

Against T1204.002, ATT&CK lists application control (Execution Prevention) and behaviour
prevention on the endpoint; against drive-by, ad blockers, browser sandboxing and timely updates.
Each layer catches what another missed.

### `update` The real update

`browser → browser` · `safe` · `with-defence` · `icon:browser`
Message: check for updates · Result: up to date

```text
Settings → About the browser
Checking for updates: the latest version is installed
```

#### Simple

The reader checks for updates where they really live: in the browser's own settings. The browser
says it is already up to date. The banner lied.

#### Step by step

The browser installs automatic updates by itself. If a site says your browser is out of date,
that is a reason to open the browser's settings, not to click the banner.

#### Deeper

CISA advises turning on automatic updates and taking them only from the vendor. An updated browser
also protects against a real drive-by: a vulnerability that has been fixed will not work on it.

## How to defend

- **Update only through the built-in updater**: the browser and system settings, the app store, or
  the vendor's site opened by hand.
- **Turn on automatic updates** for the browser and the system.
- **Do not download programs from ads**, even ads in search results: find the official site
  yourself.
- **An ad blocker** lowers the chance of seeing a malicious banner.
- **At work, use application control**: only known publishers are allowed, and ordinary users work
  without administrator rights.
- **Ran a suspicious file?** Disconnect the computer from the network and contact whoever handles
  security, or scan the computer with antivirus and change your passwords from another device.
