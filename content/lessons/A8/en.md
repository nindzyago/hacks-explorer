# Stages of an attack: from reconnaissance to the goal

`lesson` A8 · `section` A · `wave` 2 · `format` 1

## Passport

- `attack` T1589.002, T1566.001, T1204.002, T1071, T1486
- `severity` critical
- `impact` The company's files encrypted, some of them carried off
- `defence` Break the chain at several links at once
- `class` An attack chain by MITRE ATT&CK tactics

## Sources

- [MITRE ATT&CK: Enterprise Tactics](https://attack.mitre.org/tactics/enterprise/)
- [MITRE ATT&CK T1589.002: Email Addresses](https://attack.mitre.org/techniques/T1589/002/)
- [MITRE ATT&CK T1566.001: Spearphishing Attachment](https://attack.mitre.org/techniques/T1566/001/)
- [MITRE ATT&CK T1204.002: Malicious File](https://attack.mitre.org/techniques/T1204/002/)
- [MITRE ATT&CK T1071: Application Layer Protocol](https://attack.mitre.org/techniques/T1071/)
- [MITRE ATT&CK T1486: Data Encrypted for Impact](https://attack.mitre.org/techniques/T1486/)
- [MITRE ATT&CK: Version History](https://attack.mitre.org/resources/versions/)
- [CISA: #StopRansomware Guide](https://www.cisa.gov/stopransomware/ransomware-guide)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `mail` **Mail** — corp.example · `icon:mail`
- `pc` **PC** — accountant · `icon:workstation`
- `files` **Files** — shared folder · `icon:server`

## Zones

- `internet` Internet: `attacker`
- `office` Office corp.example: `mail`, `pc`, `files`

## Steps

### `recon` Reconnaissance

`attacker → attacker` · `attack`
Message: addresses from the site · Result: a list

#### Simple

The attacker has not broken into anything yet. They read the company's site and job ads and
**collect the addresses** of employees: whom to write to and in whose name.

#### Step by step

This is the first link of the chain. Each next one rests on the one before: no addresses, no
email; no email, no launch; no launch, nothing else.

#### Deeper

In MITRE ATT&CK the stages are called tactics: a tactic is the why, the goal of a step, and a
technique is how it is reached. Here the tactic is Reconnaissance (TA0043) and the technique is
gathering email addresses, T1589.002. ATT&CK v20 has 15 tactics for enterprise systems; a
company barely sees reconnaissance, so the chain has to be broken further on.

### `phish` An email with an invoice

`attacker → mail` · `attack`
Message: invoice · Result: delivered

```text
Subject: Invoice for payment
Attachment: ⟦invoice.docm⟧
```

#### Simple

The accountant gets an email "from a supplier" with an **invoice attached**. Inside the document
is a macro, a small program.

#### Step by step

This is initial access: the attacker is trying to get into the network. The mail filter catches
a lot, but not everything; this email got past it.

#### Deeper

The tactic is Initial Access (TA0001), the technique is phishing with an attachment, T1566.001.
Where to break it: an attachment filter, sender checks, a trained employee.

### `open` Macro runs

`mail → pc` · `attack` · `without-defence`
Message: enable content · Result: running

#### Simple

The accountant opens the document and clicks **"Enable content"**. The macro runs and downloads
the attacker's program.

#### Step by step

This is execution: the attacker's code is running on a computer inside the network. Next the
program adds itself to startup to survive a reboot: that is persistence.

#### Deeper

Execution is TA0002, and the technique is a user running a malicious file, T1204.002.
Persistence is TA0003. Where to break it: block macros in files from the internet, allow only
approved programs to run.

### `open-blocked` Macros from the internet blocked

`mail → pc` · `attack` · `with-defence` · `stopped`
Message: invoice · Result: macro blocked

#### Simple

On the PC a setting blocks macros in files **from the internet**. The document opens, but the
macro does not run and the program is not downloaded.

#### Step by step

The email arrived, the person even opened the attachment, and yet the chain broke at the third
link. Nothing after it happens.

#### Deeper

Defence in depth: every link has its own line of defence. If the mail filter lets an email
through, the macro block stops it; if that fails too, the command channel is noticed by its
unusual outgoing connections.

### `report` The employee reports it

`pc → mail` · `safe` · `with-defence`
Message: this is phishing · Result: deleted for all

#### Simple

The accountant clicks **"Report phishing"**. The security team finds the same email in other
employees' mailboxes and deletes it.

#### Step by step

One report protects everyone: twenty people got the email, and one of them might have opened it
on a computer without the macro block.

#### Deeper

Knowing the tactics helps defence: for each link you can ask how we see it and how we break it.
ATT&CK technique pages have sections on mitigations and detection.

### `beacon` Calling home

`pc → attacker` · `attack` · `without-defence`
Message: HTTPS, I'm here · Result: channel open

#### Simple

The program on the PC **contacts the attacker's server by itself** and waits for commands. From
outside it looks like an ordinary visit to a website.

#### Step by step

This is command and control: the attacker steers the captured computer from afar. Outgoing
connections from the office are often not checked.

#### Deeper

The tactic is Command and Control (TA0011), the technique is an ordinary application layer
protocol, T1071: commands hide in web traffic. Where to break it: block unneeded outgoing
connections, check where office computers connect to.

### `collect` Collect and carry off

`pc → files` · `attack` · `without-defence`
Message: folder copy · Result: carried off

#### Simple

The attacker **looks around** the network, finds a shared folder with contracts and copies it to
themselves.

#### Step by step

Three tactics at once: discovery (what is on the network), collection (what is valuable) and
exfiltration, carrying the data out. The stolen data is later used for blackmail.

#### Deeper

Discovery (TA0007), Collection (TA0009), Exfiltration (TA0010). Where to break it: the accountant
has access only to their own folders, not to all of them; an alert on an unusually large
download.

### `impact` Encryption

`pc → files` · `attack` · `without-defence`
Message: encryption · Result: files encrypted

#### Simple

The last link is the **goal**. The program encrypts every file in the shared folder and leaves a
ransom note.

#### Step by step

Several days passed between the email and the encryption. All that time, every link was a
chance to break the chain.

#### Deeper

The tactic is Impact (TA0040), the technique is encrypting data to cause harm, T1486. The last
line of defence is backups kept separately, which the program cannot encrypt.

## How to defend

- **Think in links.** For each tactic, ask: will we see this step and how will we break it. The
  earlier the break, the smaller the damage.
- **A line of defence at every link.** A mail filter, blocking macros from the internet, allowing
  only approved programs, blocking unneeded outgoing connections.
- **Minimum rights.** An employee sees only the folders they need: then exfiltration and
  encryption reach less.
- **An easy way to report.** A "Report phishing" button turns every employee into a sensor.
- **Separate backups.** Copies that cannot be reached from the office network, and checks that
  they can be restored.
