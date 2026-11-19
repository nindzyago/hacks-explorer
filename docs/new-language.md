# Adding a language

A language is on the site only when **everything** is translated: every lesson, every interface
string, the glossary and the catalog of topics (decision K94). The gate checks it and names what
is missing. Until the language is switched on (step 5) its files are checked but not shipped, so
a translation can grow over several pull requests.

The Russian files are the base: every other language keeps their structure (ids, keys, order)
and translates the text. English is a good second source if you do not read Russian.

Below, `xx` stands for the language code: two or three lowercase letters (ISO 639-1 or 639-3:
`de`, `uk`, `fil`). The site address of the language is `/xx/`.

## Steps

0. **Open an issue "New language"** so that two people do not translate the same language and
   so that a maintainer can do step 1 for you.

1. **Two word tables in the code**, one entry each. The lesson and glossary checkers recognise
   the headings of a file by their text in its language, so they need the words:
   - `src/core/lesson/headings.ts`: the section headings (`Passport`, `Sources`, `Participants`,
     `Zones`, `Steps`, `How to defend`, `Sandbox`), the three levels (`Simple`,
     `Step by step`, `Deeper`) and the two labels of a step line (`Message`, `Result`). Add a
     constant like `EN` and a line `['xx', XX]` in `LANGUAGES`.
   - `src/core/glossary/words.ts`: the glossary title, the heading of its sections and the label
     of the forms line. Add a line to `WORDS`.

   This is the only code change, and it is the same for every language. Without it the gate
   says `xx needs its lesson headings (src/core/lesson/headings.ts) and glossary words
   (src/core/glossary/words.ts)`.

2. **One folder `content/locales/xx/`** with three files. Copy them from `content/locales/en/`
   (or `ru/`), change the language in the second line, translate the text:
   - `ui.md`, the interface strings. Second line `` `ui` xx · `format` 1 ``. Every key of
     `content/locales/ru/ui.md`, no other keys; a `{name}` in a string is filled in by the code
     and stays exactly as it is.
   - `glossary.md`, the glossary. Second line `` `glossary` xx · `format` 1 ``. The same
     sections and term ids in the same order, the same `category`, `see` and `lessons`; the
     `Forms` line lists the forms of the word in your language that the site should link in lesson
     text (see `src/core/glossary/README.md`).
   - `catalog.md`, the list of all topics. Second line `` `catalog` xx · `format` 1 ``. The same
     sections and topics in the same order.

3. **One file per lesson: `content/lessons/<id>/xx.md`** next to `ru.md`, for every lesson
   folder. Headings in your language (from step 1); the service lines stay as they are: the
   lesson line, the passport codes, participant, zone and step ids, `attacker → server`, `attack`,
   `with-defence`, icons, `term:` words. The gate compares them with `ru.md`. Translate the
   texts, names and labels; keep the code blocks unless a comment in them is meant for the
   reader.

4. **Check while you work:** `npm run content`. It checks the new files even before the
   language is on the site.

5. **Switch it on:** add one line to `content/locales/languages.md`, with the language's own
   name for itself:

   ```markdown
   - `xx` Name of the language
   ```

   From now on the gate requires every lesson and string in `xx`. Run `npm run gate`: it must be
   green. The language menu in the page header shows a button `XX` (its tooltip is the name),
   the address `/xx/` opens the site in it, and a new visitor whose browser asks for `xx` gets
   it (decision K107).

6. **Pull request** with steps 1–5 together. From then on every new lesson comes in `xx` too.

## How this is checked

`scripts/new-language.test.ts` (part of the gate) adds a test language `xx` to a copy of the real
content exactly as above: the folder of step 2, the lesson files of step 3 and the line of step
5, with the entries of step 1 standing in through a test mock. It checks that:

- the build passes and ships the lessons, strings, glossary and catalog of `xx`;
- `xx` is in the list of site languages with its name, which is what the language menu draws;
- a missing lesson file, or a missing locale folder, makes the gate red and names the file;
- without the line of step 5 the files are checked but not shipped;
- without the entries of step 1 the gate names both tables.

The rules themselves: `src/core/i18n/locales.ts` (K94, K105, K106),
`src/core/lesson/README.md` ("Переводы и новый язык"), `src/core/glossary/README.md`,
`src/core/topics/`.

## Limits

- **Letters.** The site ships its fonts itself (no outside requests): Onest and JetBrains Mono,
  Latin and Cyrillic only. A language in another script (Greek, Arabic, Hebrew, Chinese, …)
  would fall back to the reader's system fonts until a font under SIL OFL is added and recorded
  in `ATTRIBUTION.md`. The diagram measures labels with the glyph widths of the Latin and
  Cyrillic font (`src/core/scene-layout/layout.ts`), so labels in another script may be laid
  out too wide or too narrow. Not tested.
- **Right-to-left languages** are not supported: the page has no right-to-left layout. Not
  tested.
- **Size.** The interface strings of every site language are in the first page load (about 2 KB
  gzip per language, K105); the gate's budget (150 KB gzip) allows many languages, but each
  one counts.
- **Text length.** Labels on the diagram and in the step table are sized for Russian and
  English. A language with much longer words may need shorter wording; check the lessons in
  the browser (`npm run dev`, then `/xx/`), on a phone width too.
- At most 20 languages in `languages.md`.
