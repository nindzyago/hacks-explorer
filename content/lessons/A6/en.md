# Classes of flaws: CWE and the OWASP Top 10

`lesson` A6 · `section` A · `wave` 2 · `format` 1

## Passport

- `cwe` 89
- `owasp` A03:2021
- `attack` T1190
- `severity` high
- `impact` The same flaw in two programs means two leaks
- `defence` Close the class of flaw across all the code at once
- `class` SQL injection as the class CWE-89

## Sources

- [MITRE CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)
- [MITRE CWE-74: Injection](https://cwe.mitre.org/data/definitions/74.html)
- [MITRE CWE-707: Improper Neutralization](https://cwe.mitre.org/data/definitions/707.html)
- [MITRE CWE-564: Use of Hibernate with HQL/SQL Query String Containing External Input](https://cwe.mitre.org/data/definitions/564.html)
- [MITRE CWE-943: Improper Neutralization of Special Elements in Data Query Logic](https://cwe.mitre.org/data/definitions/943.html)
- [MITRE: 2025 CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP Cheat Sheet Series: SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [NVD: Vulnerability Search](https://nvd.nist.gov/vuln/search)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `shop` **Shop** — version 1.2 · `icon:server`
- `forum` **Forum** — version 3.0 · `icon:server`
- `team` **Team** — writes both · `icon:workstation`

## Zones

- `internet` Internet: `attacker`

## Steps

### `fix-shop` Queries with parameters

`team → shop` · `safe` · `with-defence`
Message: class CWE-89 · Result: closed

```sql
SELECT * FROM goods WHERE name LIKE ?
```

#### Simple

The team ships two programs: a shop and a forum. It knows that SQL injection is not one bug but
a **class** of bugs, and closes the whole class: everywhere in the code, database queries are
written only with parameters.

#### Step by step

The team does not hunt each hole separately. It takes the description of the class CWE-89, reads
how to prevent it and changes the rule for all the code.

#### Deeper

A CWE page lists ways to detect and prevent the class. For CWE-89 one of them is
parameterization: data goes to the database separately from the query text. The OWASP SQL
injection cheat sheet puts parameterized queries first among the primary defenses.

### `fix-forum` The same rule in the forum

`team → forum` · `safe` · `with-defence`
Message: class CWE-89 · Result: closed

```sql
SELECT * FROM posts WHERE text LIKE ?
```

#### Simple

The same rule goes into the **forum**. The code is different and was written by other people,
but a flaw of the same class is fixed the same way.

#### Step by step

The team adds a check to code review and the build: a query glued together from strings does
not pass.

#### Deeper

The CWE catalog is a shared language for such rules. The OWASP Top 10 helps decide which classes
to start with: it lists the most important risk categories for web applications.

### `scan` A quote in the search

`attacker → attacker` · `attack`
Message: one trick for all · Result: probing

```text
q=⟦'⟧
```

#### Simple

The attacker does not study each site from scratch. They know the **class** of flaw and try the
same trick on every search field they find.

#### Step by step

A quote in a search box is a simple probe: if the site answers with a database error, it most
likely glues the query together from strings.

#### Deeper

Attackers think in classes too: a trick against a class works in any program that has the flaw.
In ATT&CK, breaking into an application exposed to the internet is T1190.

### `shop-hit` Injection in the shop

`attacker → shop` · `attack` · `without-defence`
Message: ' OR '1'='1 · Result: all goods

```text
q=⟦' OR '1'='1⟧
```

#### Simple

The shop **glues** the search into the query text. The quote closes the string, and the rest of
the input becomes part of the command to the database.

#### Step by step

This is one specific vulnerability in one program. Once found and disclosed, it gets its own CVE
number: "shop version 1.2, search, SQL injection".

#### Deeper

A CVE is a specific flaw in a specific product and versions. A CWE is the type of flaw, its
cause. A CVE record usually names its CWE: that shows which class it grew from.

### `shop-blocked` Parameter in the shop

`attacker → shop` · `attack` · `with-defence` · `stopped`
Message: ' OR '1'='1 · Result: just text

```text
q=⟦' OR '1'='1⟧
```

#### Simple

The shop passes the input as a **parameter**. The database looks for a product with that odd
name and finds none.

#### Step by step

The quote no longer closes the string: a parameter never becomes part of the command.

#### Deeper

The defence worked not because someone found this exact hole in advance, but because the class
is closed across all the code.

### `forum-hit` The same flaw in the forum

`attacker → forum` · `attack` · `without-defence`
Message: ' OR '1'='1 · Result: all posts

```text
q=⟦' OR '1'='1⟧
```

#### Simple

A different program, different authors, but **the same flaw**. The trick works here too.

#### Step by step

This vulnerability gets its own CVE number, but the same CWE-89. Thousands of records gather
under one class: in NVD, as of November 2026, there are more than 11,000.

#### Deeper

CWE is a tree. At the top is the pillar CWE-707, improper neutralization; below it the class
CWE-74, injection; then CWE-943, injection into data query logic; further down the base weakness
CWE-89, SQL injection; under it the variant CWE-564 for Hibernate. The lower, the more specific.
For CVE records MITRE allows CWE-89 and CWE-564, but discourages the pillar CWE-707 and the class
CWE-74: they are too general.

### `forum-blocked` Parameter in the forum

`attacker → forum` · `attack` · `with-defence` · `stopped`
Message: ' OR '1'='1 · Result: just text

```text
q=⟦' OR '1'='1⟧
```

#### Simple

The forum has the same rule, and the trick **fails**. One measure closed both programs.

#### Step by step

If someone writes a third program later, the rule works there too: the check in the build will
not let a glued query through.

#### Deeper

MITRE builds its list of the most dangerous weaknesses, the CWE Top 25 for 2025, from real CVE
records: CWE-79 (XSS) is first, CWE-89 second.

### `leak` Leak from the forum

`forum → attacker` · `attack` · `without-defence`
Message: users table · Result: leaked

#### Simple

The **users table** leaves the forum. The team would fix the shop and the forum one after the
other, and each fix would close only one hole.

#### Step by step

Two leaks mean two CVE numbers, two advisories, two urgent fixes. Yet they share one cause.

#### Deeper

In the OWASP Top 10:2021 injection is A03; 33 CWEs are mapped to this category, among them
CWE-79 and CWE-89. The OWASP Top 10 is not a catalog of flaws but a list of risk categories. In
the 2025 edition injection is fifth, A05:2025; the lessons refer to the 2021 edition.

## How to defend

- **Fix the class, not the case.** When you find a flaw, ask which CWE it belongs to and where
  else in the code the same one may hide.
- **Rules for all the code.** Queries only with parameters, output only with encoding: rules like
  these close whole classes.
- **Checks in the build.** Automated code checks catch known classes of flaws before release.
- **Start with what matters most.** The OWASP Top 10 and the CWE Top 25 show which classes are
  common and hurt the most.
- **Record the CWE.** Mark the class of every flaw you find: that shows which classes keep
  coming back and what to teach the team.
