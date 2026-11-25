# Hacks Explorer

- Site: https://hacks.antipic.com
- Repository: https://github.com/nindzyago/hacks-explorer (pull requests with lessons and
  languages are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md))
- Idea of the genre: [Protocol Explorer](https://protocol-explorer-alpha.vercel.app/)

How attacks work and how to stop them: an interactive reference on computer security for
beginners. Every lesson is one attack on a made-up system, shown step by step on a diagram. Turn
the defence on and watch the same attack fail. Each step is explained at three depths: Simple,
Step by step, Deeper.

[Русская версия](README.ru.md)

## Where the idea comes from

The genre is borrowed from [Protocol Explorer](https://protocol-explorer-alpha.vercel.app/): one
screen with a diagram, a list of steps, an explanation panel, and play and step buttons. Hacks
Explorer applies that idea to attacks and defences. Its design, code, lessons and pictures are
its own; nothing is copied from Protocol Explorer or from any other closed resource (see "What
we do not accept" in [CONTRIBUTING.md](CONTRIBUTING.md)).

## What is inside

- Lessons in Russian and English. Every lesson exists in every language of the site; the build
  fails otherwise.
- For every attack: a mode with the defence off and on, a "How to defend" section and a list of
  open sources (OWASP, MITRE, NVD, RFC and the like).
- A glossary: terms in lesson text open a short definition.
- No tracking: no analytics, no cookies, no external fonts or scripts, no requests to other
  servers.
- Works with the keyboard and on a phone.

Teaching, not hacking: lessons show the mechanism on a fictional system, with teaching addresses
only (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32, `*.example`). There are no
ready-to-run exploits and no instructions against real products.

## Run it locally

You need Node.js 22 or later.

```sh
npm ci          # install dependencies
npm run dev     # the site at http://localhost:5173
npm run gate    # the one check: format, lint, types, tests, structure, build, browser tests
```

`npm run content` checks only the lessons, the glossaries and the interface strings. It is the
fastest way to check a lesson you are writing.

## How it is built

A static site (Svelte and TypeScript, built with Vite). A lesson is data, not code: one Markdown
file per language, `content/lessons/<id>/<language>.md`. The build checks every lesson and turns
it into JSON for the site; a broken lesson stops the build with `file:line:column: message`.

| Path | What |
|---|---|
| `content/lessons/` | lessons, one folder per lesson, one file per language |
| `content/locales/` | interface strings, glossary and catalog of topics per language; the list of site languages |
| `content/icons/` | participant icons |
| `src/core/` | lesson format, checker, player; no user interface |
| `src/ui/`, `src/scene/` | the page and the diagram |
| `docs/` | how we work, decisions, the lesson template, the language guide |

## Contributing

Corrections, new lessons and translations are welcome. Start with
[CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Found a security problem in the site itself? See [SECURITY.md](SECURITY.md).

## Licences

- Code: MIT.
- Lesson texts and diagrams: CC BY-SA 4.0.
- Fonts: SIL Open Font License 1.1.
- Participant icons (`content/icons/`) and social cards (`public/cards/`), made with Magnific:
  **not** under CC BY-SA, all rights reserved; they may be used only as part of this site. The
  licences of the code and texts above do not change.
- Every other asset and its source and licence: [ATTRIBUTION.md](ATTRIBUTION.md).
