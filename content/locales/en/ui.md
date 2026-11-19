# Interface

`ui` en · `format` 1

Interface strings of the site (M2.3, K105). A string is `` - `key` Text ``; the keys are the
same in every language and come from content/locales/ru/ui.md; `{name}` is a value the code puts
in. Keep the same keys and the same `{names}`.

## Site

- `app.tagline` How attacks work and how to stop them
- `app.description` How attacks work and how to stop them: step-by-step lessons.
- `app.language` Site language
- `format.decimal` .

## Page not found

- `page.notFound.title` There is no such page
- `page.notFound.text` Check the address or open a lesson from the home page.
- `page.home` Home page

## Loading a lesson

- `lesson.loading` Loading the lesson…
- `lesson.error.title` The lesson could not be opened.
- `lesson.error.notFound` There is no such lesson, or it is not translated into this language yet.
- `lesson.error.network` The site cannot be reached. Check your internet connection and try again.
- `lesson.error.badData` The lesson file is damaged or out of date. Try again; if that does not help, reload the page.
- `lesson.error.timeout` The lesson is taking too long to load. Check your connection and try again.
- `lesson.retry` Try again
- `lesson.noSteps` This lesson has no steps in this mode.

## Player

- `player.label` Lesson controls
- `player.status` Step {step} of {count}
- `player.statusUnknown` Step {step}
- `player.back` Step back
- `player.play` Play
- `player.pause` Pause
- `player.next` Step forward
- `player.nextShort` Step
- `player.restart` From the start
- `player.speed` Speed {speed}, press for {next}

## Defence

- `defence.mode` Lesson mode
- `defence.off` No defence
- `defence.on` With defence
- `defence.name` Defence: {name}
- `defence.isOff` Defence is off

## Explanation

- `explain.title` Explanation
- `explain.depths` Depth of the explanation
- `explain.depth.simple` Simple
- `explain.depth.steps` Step by step
- `explain.depth.deep` Deeper
- `explain.step` Step {number} of {count}. {title}
- `explain.passport` Passport
- `explain.defence` How to defend
- `explain.sources` Sources
- `explain.more` More below ↓
- `code.step` Code of the step
- `code.label` Code: {label}
- `code.compare` {label} — for comparison

## Passport

- `passport.class` Class
- `passport.severity` Severity
- `passport.impact` What the attacker gets
- `passport.defence` Defence
- `severity.none` none
- `severity.low` low
- `severity.medium` medium
- `severity.high` high
- `severity.critical` critical
- `cwe.22` Path traversal
- `cwe.78` OS command injection
- `cwe.79` Cross-site scripting (XSS)
- `cwe.89` SQL injection
- `cwe.352` Cross-site request forgery (CSRF)
- `cwe.918` Server-side request forgery (SSRF)

## Attack flow

- `log.title` Attack flow
- `steps.number` #
- `steps.step` Step
- `steps.from` From
- `steps.to` To
- `steps.sent` What was sent
- `steps.result` Result
- `steps.mark` Status
- `steps.goto` Step {number}: {title}
- `steps.notYet` not yet

## Message marks

- `mark.legit` normal
- `mark.attack` harmful
- `mark.safe` safe
- `mark.stopped` stopped
- `mark.moving` on its way

## Diagram

- `scene.title` Diagram of the lesson “{title}”
- `scene.empty` The diagram has no participants.
- `scene.participants` Participants from left to right: {list}.
- `scene.zones` Trust zones: {list}.
- `scene.dangerZone` {label} (dangerous)
- `scene.step` Step {number} of {count}. {title}: {route}, {kind} message “{message}”.
- `scene.stepStopped` Step {number} of {count}. {title}: {route}, {kind} message “{message}”, stopped.
- `scene.stepStoppedAt` Step {number} of {count}. {title}: {route}, {kind} message “{message}”, stopped at “{name}”.
- `scene.stays` at “{name}”
- `scene.term` {name}: what is it

## Glossary

- `glossary.title` Glossary
- `glossary.close` Close
- `glossary.loading` Loading the glossary…
- `glossary.error` The glossary could not be loaded.
- `glossary.unknown` This word is not in the glossary.
- `glossary.see` See also
- `glossary.lessons` Lessons

## Lessons and glossary panel

- `drawer.lessons` Lessons
- `drawer.glossary` Glossary
- `drawer.label` Lessons and glossary
- `drawer.tabs` What the panel shows
- `drawer.close` Close the panel
- `catalog.search` Find a lesson
- `catalog.searchHint` For example, SQL or B1
- `catalog.section` Section
- `catalog.allSections` All sections
- `catalog.total` Lessons ready: {ready} of {count}
- `catalog.ready` {ready} of {count} ready
- `catalog.soon` soon
- `catalog.soonTitle` This lesson is still being written
- `catalog.current` open now
- `catalog.found` Topics found: {count}
- `catalog.empty` Nothing found. Check the spelling or choose another section.
- `catalog.reset` Clear the search
- `catalog.loading` Loading the list of lessons…
- `catalog.error` The list of lessons could not be loaded.
- `glossaryList.search` Find a word
- `glossaryList.searchHint` For example, phishing or SQL
- `glossaryList.found` Words found: {count}
- `glossaryList.empty` This word is not in the glossary. Check the spelling.
- `glossaryList.back` All words

## Command names

- `command.theme.set` Colour theme
- `command.depth.set` Depth of the explanation
- `command.locale.set` Site language
- `command.glossary.open` Open a definition
- `command.glossary.close` Close the definition
- `command.drawer.open` Open the lessons and glossary panel
- `command.drawer.close` Close the lessons and glossary panel
- `command.clock.set` Set the player clock
- `command.clock.tick` Move the player clock
- `command.player.play` Play
- `command.player.pause` Pause
- `command.player.step` Step forward
- `command.player.back` Step back
- `command.player.goto` Go to a step
- `command.player.speed` Speed
- `command.defence.toggle` Toggle the defence
- `command.defence.set` Turn the defence on or off
- `command.lesson.open` Open a lesson
