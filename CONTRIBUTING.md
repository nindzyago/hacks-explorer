# Contributing to Hacks Explorer

Thank you for helping. This file is for people; the rules every change follows, for people and
for coding agents alike, are in [AGENTS.md](AGENTS.md) (in Russian). Where this file and
AGENTS.md disagree, AGENTS.md wins. How a task is done step by step: [docs/workflow.md](docs/workflow.md).

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

| What | How |
|---|---|
| A mistake in a lesson (a fact, a typo, a confusing sentence) | an issue "Mistake in a lesson", or a pull request with the fix |
| A new lesson | an issue "New lesson" first, so two people do not write the same topic; then a pull request made from the [lesson template](docs/lesson-template/) |
| A translation into a new language | an issue "New language", then [docs/new-language.md](docs/new-language.md) |
| A bug in the site | an issue "Bug in the site" |
| A security problem in the site itself | not an issue: see [SECURITY.md](SECURITY.md) |

## Before you open a pull request

```sh
npm ci
npm run content   # lessons, glossaries, interface strings: fast
npm run gate      # everything; must be green
```

The gate is the only check, and CI runs the same command. It prints problems in lessons as
`file:line:column: message`.

- One topic per pull request. Name the commit `<task id>: <what>` if there is a task in the plan,
  otherwise a short sentence.
- A change in behaviour comes with a test written first (AGENTS.md, Part 2).
- Fill in the checklist of the pull request template.

## Writing a lesson

1. Pick a topic from `content/locales/ru/catalog.md` that has no folder in `content/lessons/`
   yet. The id (`B2`) is the folder name; its first letter is the section.
2. Copy `docs/lesson-template/ru.md` and `docs/lesson-template/en.md` into
   `content/lessons/<id>/`, as `ru.md` and `en.md`.
3. Replace the placeholders: `{{ID}}` (the id), `{{SECTION}}` (its first letter), `{{TITLE}}`,
   `{{CWE}}` (or replace the `cwe` line with `attack`, `owasp` or `cves`, whichever fits). The
   gate stops a file where `{{ID}}`, `{{SECTION}}` or `{{CWE}}` is left; a forgotten `{{TITLE}}`
   or sample sentence passes the gate and is caught only in review, so check them yourself.
4. Rewrite every sample sentence. The template shows each part of the format; the full
   description is [src/core/lesson/README.md](src/core/lesson/README.md) (in Russian), and
   `content/lessons/B1/` is a complete real lesson.
5. Run `npm run content` until it is green, then `npm run gate`.

A lesson that needs a new term adds it to the glossary in the same pull request: one
`## `id` Title` section in `content/locales/ru/glossary/<section>.md` (the file of its section,
e.g. `web.md`; the sections are listed in `glossary/index.md`) and the same term in every other
language's `glossary/<section>.md`, at the same place. The lesson names it with `term:id` on a
participant or zone. The format: [src/core/glossary/README.md](src/core/glossary/README.md).

A lesson is added in every language of the site at once (decision K94): `ru.md` is the base, the
other languages keep the same structure (ids, steps, participants) with translated text. If you
write only one language, say so in the pull request and someone will help with the rest; the
gate stays red until every language is there.

Rules a lesson must follow (the gate checks most of them):

- **Teaching, not hacking** (L4). A made-up system; no ready-to-run exploits, no step-by-step
  attacks on real products and versions. Addresses and domains only from the teaching ranges:
  192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32, `example.com`, `example.org`,
  `example.net`, and names under `.example`, `.test`, `.invalid`, `.localhost`.
- **A defence for every attack**: a step with the defence on, a "How to defend" section, and
  `severity` and `defence` in the passport.
- **Every fact checkable** (L5): open sources only (OWASP, MITRE, NVD, NIST, RFC, CISA, W3C, MDN;
  the full list is `content/sources.md`). CWE, CVE and ATT&CK numbers must match MITRE and NVD.
  Not sure about a fact? Leave it out.
- **Your own words** (L2): see below.

## What we do not accept

- Text, lesson scripts, illustrations or code copied or closely retold from Hacksplaining,
  PortSwigger, Protocol Explorer, Attack Explorer or any other closed resource. We take only the
  list of topics and the idea of the genre from them; facts come from open sources, written in
  your own words.
- Dependencies or assets under licences other than MIT, Apache-2.0, BSD, ISC, Zlib or MPL-2.0
  (fonts: SIL OFL). Every asset gets a line in [ATTRIBUTION.md](ATTRIBUTION.md).
- Analytics, cookies, external fonts or scripts, requests to other servers (L6).
- Working exploits, attack tools, or real addresses and domains in lessons.

## Licences of your contribution

By sending a pull request you agree that your code is published under MIT and your lesson texts
and diagrams under CC BY-SA 4.0, like the rest of the project.

## Questions

Open an issue. For anything about the rules, AGENTS.md is the source of truth; for past choices,
`docs/decisions.md`.
