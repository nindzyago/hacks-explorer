# Email

`glossary` en · `category` mail

## `spf` SPF

`category` mail · `see` dkim, dmarc · `lessons` I1, I3

Forms: SPF

Sender Policy Framework (RFC 7208): a DNS record of a domain listing the servers allowed to send
mail in its name. The recipient's server checks the server that delivered the email against it.
What is checked is the address on the email's “envelope”, not the one a person sees in the
“From” field.

## `dkim` DKIM

`category` mail · `see` spf, dmarc · `lessons` I1, I3

Forms: DKIM

DomainKeys Identified Mail (RFC 6376): the sender's server signs the email with the domain's key,
and the recipient checks the signature with the public key from that domain's DNS. A valid
signature means the signing domain takes responsibility for the email and the signed parts were
not changed on the way. The signing domain may differ from the one in the “From” field: DMARC
compares them.

## `dmarc` DMARC

`category` mail · `see` spf, dkim, domain · `lessons` I1, I3

Forms: DMARC

A domain's policy (RFC 9989, formerly RFC 7489) that ties the SPF and DKIM checks to the address
in the “From” field and tells the recipient how the domain owner wants an email that fails to be
treated: no preference (`none`), as suspicious, for example sent to spam (`quarantine`), or
rejected (`reject`). It does not protect against email from look-alike domains:
they have their own records.

## `domain-alignment` Domain alignment

`category` mail · `see` dmarc, spf, dkim · `lessons` I3

Forms: domain alignment, identifier alignment, alignment

The DMARC requirement that the domain in the "From" field match a domain confirmed by SPF (the
envelope address) or by DKIM (the `d=` tag). Strict alignment is an exact match; relaxed alignment
is the same organizational domain. Without it a passed SPF or DKIM check says nothing about the
"From" field: anyone can publish records for their own domain.
