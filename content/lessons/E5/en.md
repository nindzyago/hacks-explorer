# Prototype pollution

`lesson` E5 · `section` E · `wave` 3 · `format` 1

## Passport

- `cwe` 1321
- `severity` high
- `impact` A property slipped into the shared prototype shows up on every object in the program: bypassed permission checks, crashes, XSS
- `defence` Drop keys that lead to the prototype; prototype-less objects and Map
- `class` Pollution of JavaScript object prototypes

## Sources

- [MITRE CWE-1321: Improperly Controlled Modification of Object Prototype Attributes](https://cwe.mitre.org/data/definitions/1321.html)
- [MDN: JavaScript prototype pollution](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Prototype_pollution)
- [OWASP: Prototype Pollution Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — app.example, Node.js · `term:web-server`
- `db` **Database** — users · `term:database`

## Zones

- `internet` Internet: `attacker`
- `site` Site app.example: `server`, `db` · `term:trust-boundary`

## Steps

### `patch` Settings with a special key

`attacker → server` · `attack`
Message: PATCH /api/settings · Result: accepted

```http
PATCH /api/settings
Content-Type: application/json

{"theme": "dark", ⟦"__proto__": {"isAdmin": true}⟧}
```

#### Simple

The site lets you change its colour theme. The attacker sends settings where, next to the theme,
there is a field with the strange name `__proto__`, and inside it `isAdmin: true` — “I am an
administrator”.

#### Step by step

The server is written in JavaScript. `JSON.parse` turns the request text into an object; `__proto__`
in it is, for now, an ordinary field holding a nested object. It becomes dangerous at the next step.

#### Deeper

In JavaScript an object has a **prototype** — another object it “inherits” properties from: if
the object itself lacks a field, the language looks for it in the prototype. Almost all ordinary
objects share one and the same prototype, `Object.prototype`. And `__proto__` is a special name:
assigning to it changes the prototype, reading it returns the prototype.

### `merge` The merge writes into the shared prototype

`server → server` · `attack` · `without-defence`
Message: merge(settings, request) · Result: Object.prototype.isAdmin = true

```js
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object') merge(target[key], source[key]);
    else target[key] = source[key];
  }
}
// ⟦target['__proto__'] → Object.prototype⟧
```

#### Simple

The server **merges** the settings it received with the stored ones: it walks over every field and
copies it. When the function reaches `__proto__`, it goes not into a field but **into the prototype
shared by all objects** — and writes `isAdmin: true` there.

#### Step by step

`target['__proto__']` returns not a nested settings object but `Object.prototype`. The function
calls itself on it and copies `isAdmin` there. Now **every** ordinary object in the program has an
inherited `isAdmin` property set to `true`.

#### Deeper

MDN splits the attack into two phases: pollution (this step) and exploitation (the next ones).
Other paths lead to the prototype too: the key pair `constructor` and `prototype`, or writing along
a dotted path like `a.b.c`. In CWE-1321 MITRE lists examples from real libraries: recursive
merging, setting default values, writing along a path.

### `admin` The permission check finds someone else's property

`attacker → server` · `attack` · `without-defence`
Message: GET /admin · Result: user.isAdmin = true

```js
const user = await db.findUser(session.userId); // { name: 'mallory' }
if (⟦user.isAdmin⟧) showAdminPanel();
```

#### Simple

The attacker opens the administrator page. The server checks: “does this user have `isAdmin`?” The
object itself has no such field, but the language finds it **in the prototype** — and lets him in.

#### Step by step

The user object from the `users` database holds only a name. The lookup of `isAdmin` walks the
prototype chain, reaches `Object.prototype` and finds `true` there. The check passes.

#### Deeper

MDN gives exactly this case: if ordinary users have no `isAdmin` field, after pollution **all** of
them are treated as administrators. The pollution lives in the process memory until a restart, so
it affects the requests of every visitor, not just the attacker's.

### `panel` The admin panel is open

`server → attacker` · `attack` · `without-defence`
Message: page /admin · Result: access granted

```text
200 OK — Admin panel
```

#### Simple

The attacker is in the admin panel, although nobody gave him those rights. He didn't crack a
password or touch the database — he changed the behaviour of **all objects** in the program with
one field.

#### Step by step

The server returns the panel because the permission check said “yes”. The check itself has no bug:
it simply didn't expect an inherited field.

#### Deeper

What exactly the pollution does depends on the code that later reads the property. MITRE names
tampering with application data and crashing the program. MDN shows tampering with the options of
a `fetch` request and a path to XSS in the browser: a dangerous target is the `srcdoc` property of
an `iframe`, which sets the frame's content; swapped in through the prototype, it can bring someone
else's script onto the page.

### `filter` Dangerous keys are dropped

`server → server` · `attack` · `with-defence` · `stopped`
Message: dangerous key · Result: dropped, the attack failed

```js
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
for (const key of Object.keys(source)) {
  if (FORBIDDEN.has(key)) continue; // ⟦__proto__⟧ skipped
  // …
}
```

#### Simple

Now the merge skips three dangerous names: `__proto__`, `constructor` and `prototype`. It can't
reach the prototype. This is where the attack stops.

#### Step by step

The function walks only the received object's own keys and skips the forbidden ones. The `dark`
theme is saved, `__proto__` is dropped, `Object.prototype` stays clean.

#### Deeper

MITRE recommends rejecting names that lead to the prototype. Even more reliable is checking the
request against a schema that lists the allowed fields: then extra fields are rejected outright.
As a second layer MDN and OWASP name `Object.freeze(Object.prototype)`, prototype-less objects from
`Object.create(null)`, and `Map` instead of ordinary objects for data from visitors.

### `admin-try` An attempt to open the panel

`attacker → server` · `attack` · `with-defence`
Message: GET /admin · Result: user.isAdmin not found

```js
if (Object.hasOwn(user, 'isAdmin') && user.isAdmin === true) showAdminPanel();
```

#### Simple

The attacker tries to open the admin panel anyway. But the prototype is clean; it has no `isAdmin`
field.

#### Step by step

The check asks only about the object's **own** field, with `Object.hasOwn`. Even if the prototype
gets polluted somewhere, an inherited value won't pass this check.

#### Deeper

For important checks MDN recommends `Object.hasOwn` and explicit default values: such code doesn't
depend on what lies in the prototype. This doesn't replace the key filter; it is one more layer.

### `denied` Refused

`server → attacker` · `safe` · `with-defence`
Message: 403 · Result: access denied

```text
403 Forbidden
```

#### Simple

The server answers “access denied”. The attacker changed his colour theme — and nothing else.

#### Step by step

No pollution happened, and the permission check looks only at the user's own fields. Every other
visitor works as before.

#### Deeper

Searching the code helps find vulnerable spots: recursive merging, deep copying, writing along a
dotted path, `for…in` loops over visitor data. Keep libraries with such functions up to date.

## How to defend

- **Drop dangerous keys.** When merging, copying and writing along a path, skip `__proto__`,
  `constructor` and `prototype`, and walk only own keys (`Object.keys`).
- **Check the request against a schema.** Allowed fields are listed, extra ones are rejected.
- **Visitor data doesn't go into ordinary objects.** For dictionaries keyed by visitor input use
  `Map` or prototype-less objects: `Object.create(null)`.
- **Freeze the prototype.** `Object.freeze(Object.prototype)` at the start of the program stops it
  from being changed. Check that your libraries still work with it.
- **Check own fields.** For permissions and settings use `Object.hasOwn` and explicit defaults, not
  a lookup along the prototype chain.
- **Keep libraries up to date.** Vulnerable merge functions have been found in many popular
  packages.
