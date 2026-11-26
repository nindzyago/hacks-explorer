# A call "from the security team"

`lesson` I4 · `section` I · `wave` 1 · `format` 1

## Passport

- `attack` T1598.004, T1684.001
- `severity` high
- `impact` The attacker gets into the client's online banking and takes the money
- `defence` Tell the code to no one, call the bank back yourself
- `class` Social engineering by phone (vishing)

## Sources

- [MITRE ATT&CK T1598: Phishing for Information](https://attack.mitre.org/techniques/T1598/)
- [MITRE ATT&CK T1598.004: Phishing for Information: Spearphishing Voice](https://attack.mitre.org/techniques/T1598/004/)
- [MITRE ATT&CK T1684.001: Social Engineering: Impersonation](https://attack.mitre.org/techniques/T1684/001/)
- [CISA: Avoiding Social Engineering and Phishing Attacks](https://www.cisa.gov/news-events/news/avoiding-social-engineering-and-phishing-attacks)
- [CISA: Recognize and Report Phishing](https://www.cisa.gov/secure-our-world/recognize-and-report-phishing)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `client` **Client** — phone · `icon:phone` · `term:victim`
- `bank` **Bank** — bank.example · `term:otp`

## Zones

- `internet` Internet: `attacker`
- `home` At home: `client`
- `bank-zone` Bank bank.example: `bank`

## Steps

### `login` Signing in with someone else's password

`attacker → bank` · `attack`
Message: login and password · Result: the bank asks for a code

```text
Sign in to bank.example
Login: ivan   Password: ⟦from an old leak⟧   correct
A code is needed from the text message sent to the client
```

#### Simple

The attacker already has the client's login and password, say from a leak at another site. They
sign in to online banking, but the bank also asks for a **one-time code** sent by text message.

#### Step by step

The password alone did not help: without the code the sign-in will not finish. The code goes to
the client's phone. So the attacker needs the client to read it out.

#### Deeper

A second factor protects against a stolen password, but an ordinary one-time code is not tied to
the site and does not know who is typing it. Whoever learns the code gets in instead of the owner.
That is why fake pages and phone scammers alike hunt for it.

### `sms` The code reaches the client

`bank → client` · `legit` · `icon:phone`
Message: text with a code · Result: code on the phone

```text
bank.example: your sign-in code is 4821.
Do not share it with anyone, including bank staff.
```

#### Simple

The bank texts the client a code. The message itself says: do not tell it to anyone.

#### Step by step

The client did nothing, yet a code arrived. That is already odd, and the attacker knows that in a
minute the client will start to wonder. So they call right now.

#### Deeper

The bank sends the code in good faith: for the bank this is an ordinary sign-in with a correct
password. The breach will happen not in the system but in the conversation, and that is where it
has to be stopped.

### `call` A call "from the security team"

`attacker → client` · `attack` · `without-defence` · `icon:phone`
Message: "tell me the code" · Result: the client is scared

```text
Caller: "Bank, security team"
"Mr Petrov, a transfer is leaving your account right now.
To cancel it, ⟦read me the code from the text⟧. Quickly, one minute left."
```

#### Simple

A polite person calls, says they work at the bank and knows the client's name. They say money is
leaving right now and ask for the code "to cancel the transfer".

#### Step by step

This is **pretexting**: a story made up in advance that explains an odd request. Urgency and fear
leave no room to stop and think. The phone screen may even show the bank's name.

#### Deeper

In MITRE ATT&CK, calls that coax out information are sub-technique T1598.004 "Spearphishing
Voice", or vishing. The page notes that such callers may spoof their number and pose as a trusted
party, and take details for the story from open sources. CISA notes that internet telephony makes
it easy to spoof the caller's number.

### `say` The client reads out the code

`client → attacker` · `attack` · `without-defence`
Message: code 4821 · Result: code with the attacker

#### Simple

The client believes the call and reads out the code. Now the attacker has everything needed to
sign in.

#### Step by step

The client thinks they are protecting the account. In fact they open the door themselves: the
code confirms the attacker's sign-in, not the cancellation of a transfer.

#### Deeper

The real bank does not need the code from the client: the bank created it and checks it itself.
A request to read out a code over the phone is a sign of a scammer, whoever they claim to be.

### `enter` Into the bank

`attacker → bank` · `attack` · `without-defence`
Message: code 4821 · Result: signed in

```text
Code correct. Welcome, ⟦Mr Petrov⟧.
```

#### Simple

The attacker types the code, and the bank lets them into the client's online banking. Then they
transfer the money out.

#### Step by step

For the bank everything looks right: correct password, correct code. That is why getting the
money back later is very hard: the transfer was made "by the client".

#### Deeper

The call often comes with other tricks: an email or message asking the victim to call the
attacker's number (ATT&CK calls this callback phishing), or a fake sign-in page. The defence is
the same everywhere: check who is really on the other end.

### `hangup` The code goes to no one

`attacker → client` · `attack` · `with-defence` · `stopped` · `icon:phone`
Message: "tell me the code" · Result: stopped

```text
"Read me the code from the text."
"I don't tell that code to anyone. I'll call the bank myself."
```

#### Simple

The client remembers a simple rule: **a code from a text message is told to no one**, not even "the
bank". They hang up.

#### Step by step

It does not matter how convincing the caller is or what the screen shows. A call can be faked;
the rule cannot. The client does not argue or explain: they just end the call.

#### Deeper

As a mitigation for vishing, ATT&CK names training: people should recognise social engineering,
report it and verify who is calling them. CISA advises against calling a number from a suspicious
message and suggests finding the company's contacts yourself.

### `callback` Calling the bank yourself

`client → bank` · `safe` · `with-defence` · `icon:phone`
Message: call to the bank · Result: sign-in blocked

```text
Call to the number on the back of the card
"I got a code I didn't request, and someone called 'from the bank'."
"That wasn't us. We are blocking the sign-in; please change your password."
```

#### Simple

The client calls the bank on the number from the card. The bank confirms it was scammers. The
sign-in is blocked, and the client changes the password.

#### Step by step

A call to a known number is a **second channel**: the attacker does not control it. A code that
arrives when you did not sign in is a reason to change your password: someone else already knows
it.

#### Deeper

The password leaked somewhere earlier, so what matters next: a different password for every site
(a password manager helps) and, where the bank allows it, a way to sign in that does not need to
be read out, such as confirmation in the bank's app.

## How to defend

- **Never tell anyone a code from a text message**, even someone who says they are from the bank
  or the police.
- **Hang up and call back yourself** on the number from the card or the official website, not the
  number in the message or on the incoming call screen.
- **Urgency, fear and "one minute left" are signs of a scammer**, not a reason to hurry.
- **Got a code you did not request?** Change your password: someone else most likely knows it.
- **A different password for every site**, so someone else's leak does not open your bank.
- **Tell your family**, especially older relatives: being asked for a code over the phone is a sure
  sign of a scammer.
