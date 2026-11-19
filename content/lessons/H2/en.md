# Ransomware

`lesson` H2 · `section` H · `wave` 1 · `format` 1

## Passport

- `attack` T1566.001, T1486
- `severity` critical
- `impact` The company's files are encrypted, work stops, and the attacker demands a ransom for the key
- `defence` Offline backups and no macros
- `class` Extortion malware

## Sources

- [MITRE ATT&CK T1486: Data Encrypted for Impact](https://attack.mitre.org/techniques/T1486/)
- [MITRE ATT&CK T1566.001: Spearphishing Attachment](https://attack.mitre.org/techniques/T1566/001/)
- [MITRE ATT&CK T1204.002: Malicious File](https://attack.mitre.org/techniques/T1204/002/)
- [MITRE ATT&CK T1021.002: SMB/Windows Admin Shares](https://attack.mitre.org/techniques/T1021/002/)
- [MITRE ATT&CK T1490: Inhibit System Recovery](https://attack.mitre.org/techniques/T1490/)
- [MITRE ATT&CK T1657: Financial Theft](https://attack.mitre.org/techniques/T1657/)
- [CISA: #StopRansomware Guide](https://www.cisa.gov/stopransomware/ransomware-guide)
- [CISA: Data Backup Options](https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `pc` **Accountant PC** — 192.0.2.24 · `icon:workstation` · `term:victim`
- `server` **File server** — 192.0.2.10
- `backup` **Backups** — 198.51.100.20 · `term:backup`

## Zones

- `internet` Internet: `attacker`
- `office` Office network: `pc`, `server` · `term:network-segmentation`
- `vault` Backup storage: `backup`

## Steps

### `bait` An email with an invoice

`attacker → pc` · `attack` · `icon:mail`
Message: email with attachment · Result: delivered

```text
From: Supplier <billing@⟦supplier-invoices.example⟧>
Subject: Invoice due by Friday
Attachment: ⟦invoice_1042.docm⟧
```

#### Simple

The accountant gets an email that seems to come from a supplier: an invoice, due by Friday. A
document is attached. For the accountant it is an ordinary working day.

#### Step by step

The attacker found out in advance who the company works with and writes in the supplier's name.
The attachment is a document with a **macro**: a small program inside the file.

#### Deeper

One of the most common ways in is email, not breaking into a server. In MITRE
ATT&CK an email with a harmful attachment is sub-technique T1566.001 "Spearphishing Attachment".
The file name and icon are chosen to look like an ordinary document, and an archive is sometimes
locked with a password given in the email so that the mail filter cannot look inside.

### `run` The document starts a program

`pc → pc` · `attack` · `without-defence`
Message: enable content · Result: program started

```text
This document is protected. To view the invoice,
click ⟦"Enable Content"⟧
```

#### Simple

The document opens blank and asks for a click "to view the invoice". The accountant clicks. The
macro runs and quietly downloads the real harmful program: **ransomware**.

#### Step by step

The click lets the macro run. It fetches a program from the attacker's server and starts it with
the accountant's rights. On the screen nothing happens.

#### Deeper

The attacker needs the person to run the file themselves: in MITRE ATT&CK this is T1204.002
"Malicious File". That is why the text in the document persuades rather than hacks. The program
does not encrypt right away; it looks around first: shared folders, network drives, accounts with
broad rights. The more it takes over before encrypting, the harder the blow.

### `spread` Spreading through the network

`pc → server` · `attack` · `without-defence`
Message: open shared folders · Result: server taken over

```text
\\192.0.2.10\⟦Accounting⟧
\\192.0.2.10\⟦Contracts⟧
```

#### Simple

From the accountant's computer the file server's shared folders are visible. The program goes in
the same way the accountant does and starts itself on the server.

#### Step by step

In the office network every computer can reach every other. The accountant's rights open the
shared folders, and an administrator password found on the computer opens the whole server.

#### Deeper

Moving from one machine to another is called lateral movement. On Windows it often goes through
administrative shares over the SMB protocol: in MITRE ATT&CK this is T1021.002 "SMB/Windows Admin
Shares". A flat network, where a work computer can reach any server, turns one infection into an
infection of the whole company.

### `wipe` Deleting the backups

`server → backup` · `attack` · `without-defence`
Message: delete backups · Result: backups wiped

#### Simple

Before encrypting, the program finds the **backups** and wipes them. The storage is connected to
the network and trusts the server, so it obeys.

#### Step by step

The backups sit on network storage where the server writes an archive every night. If the server
can write there, a captured server can delete there too.

#### Deeper

Without backups the victim has only one way to get the files back: the attacker's key. So
deleting backups and disabling recovery features is a usual part of the attack: in MITRE ATT&CK
this is T1490 "Inhibit System Recovery". A copy that can be reached over the network with the
server's rights does not save you from ransomware.

### `encrypt` Encrypting the files

`server → server` · `attack` · `without-defence`
Message: encryption · Result: files unusable

```text
quarterly_report.xlsx  →  ⟦quarterly_report.xlsx.locked⟧
supply_contract.docx   →  ⟦supply_contract.docx.locked⟧
```

#### Simple

The program encrypts the files on the server and on the accountant's computer. The names are
almost the same, but the files no longer open: inside is just a jumble of bytes.

#### Step by step

Each file is encrypted with a key the company does not have. The key stays with the attacker.
Encryption runs fast and across many folders at once, so that nobody has time to stop it.

#### Deeper

Encryption by itself is a useful thing that protects data. Here it is turned against the owner:
the data is intact, but without the key nobody can use it. In MITRE ATT&CK this is T1486 "Data
Encrypted for Impact". If the key is not kept or not sent to the attacker, the same move simply
destroys the data.

### `ransom` The ransom note

`attacker → pc` · `attack` · `without-defence`
Message: ransom note · Result: ransom demanded

```text
Your files are encrypted.
The key is yours if you pay within ⟦72 hours⟧.
We have copies of your data: no payment, we ⟦publish⟧.
```

#### Simple

A note appears on the screen: the files are encrypted, the key costs money, the deadline is three
days. The company's work stops.

#### Step by step

The attacker demands a ransom and puts pressure on the victim with a deadline. A promise to return the key is only a
promise: there is no way to check it in advance.

#### Deeper

Often, before encrypting, attackers also copy the data out and then threaten to publish it. This
is called double extortion: even with backups the victim still faces a leak. CISA advises
contacting law enforcement in such an attack: decryption tools exist for some ransomware. In MITRE
ATT&CK extorting money is described as T1657 "Financial Theft".

### `blocked` The macro does not run

`pc → pc` · `attack` · `with-defence` · `stopped`
Message: macro from email · Result: stopped

#### Simple

Now macros in documents from email are turned off. The accountant opens the attachment, but there
is no "Enable Content" button, and the program is not downloaded.

#### Step by step

The computer does not run macros in files that came from outside. The document opens read-only,
without running any code.

#### Deeper

CISA directly advises disabling macros in office files received by email. That closes one of
the main ways in, but not all of them: ransomware can also come through a vulnerable server on the
internet or a stolen remote access password. That is why two more layers follow.

### `contain` The server is out of reach

`pc → server` · `attack` · `with-defence` · `stopped`
Message: open shared folders · Result: stopped

#### Simple

Suppose the program did start on the accountant's computer. But the office network is **split**
into parts, and the accountant has no administrator rights. The program cannot get to the server.

#### Step by step

Work computers see only the folders they need on the server, and only with user rights.
Administrative access to the server is open only from separate administrator machines.

#### Deeper

Network segmentation and least privilege do not stop one computer from being infected, but they
keep one infection from becoming an infection of the whole company. CISA advises splitting the
network into parts and separating important systems to limit lateral movement.

### `restore` Restoring from a backup

`backup → pc` · `safe` · `with-defence`
Message: last backup · Result: files restored

```text
backup:  yesterday's, storage disconnected from the network
plan:    collect traces → wipe the infected computer → bring the files back
```

#### Simple

Even if something got encrypted, the company has a copy the program could not reach. Once the traces
are collected, the infected computer is wiped and the files come back from the copy. No need to pay.

#### Step by step

Backups are kept apart: the storage is disconnected from the office network or refuses delete
commands. Recovery has been rehearsed, so it takes hours, not weeks.

#### Deeper

CISA advises keeping encrypted copies of important data **offline** and regularly testing that you
can actually restore from them. The classic 3-2-1 rule: three copies of a file (the primary and
two backups), on two different types of media, one of them outside the office. A backup does not
help against the threat of publishing stolen data: there the first two layers help.

## How to defend

- **Backups that cannot be reached.** The 3-2-1 rule, with at least one copy offline or
  immutable. Regularly test restoring for real, not just that the copies exist.
- **Do not run macros from email.** In an organisation, turn them off for files that arrive by
  email. An unexpected invoice or a "protected document" is a reason to call the sender and ask.
- **Network segmentation and least privilege.** A work computer should not see every server, and
  a user should not work with administrator rights.
- **Updates and secure remote access.** Fix known vulnerabilities, first of all on systems exposed
  to the internet; protect email and remote access with a phishing-resistant second factor.
- **An incident response plan.** Who disconnects infected machines from the network, where to restore
  from, whom to call. In an attack, report it to law enforcement and do not wipe the traces before
  the investigation.
