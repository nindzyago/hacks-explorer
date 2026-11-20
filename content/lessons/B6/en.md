# Server-side template injection (SSTI)

`lesson` B6 · `section` B · `wave` 3 · `format` 1

## Passport

- `cwe` 1336
- `owasp` A03:2021
- `attack` T1190
- `severity` critical
- `impact` Running commands on the server, reading its data and settings
- `defence` A fixed template; the visitor's input goes into it as data
- `class` Injection into a server-side template

## Sources

- [MITRE CWE-1336: Improper Neutralization of Special Elements Used in a Template Engine](https://cwe.mitre.org/data/definitions/1336.html)
- [OWASP WSTG: Testing for Server-side Template Injection](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/07-Injection/18-Server-side_Template_Injection/)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `tpl` **Template engine** — emails · `icon:document` · `term:template-engine`
- `os` **Server OS** — Linux · `icon:workstation` · `term:rce`

## Zones

- `internet` Internet: `attacker`
- `site` Shop shop.example: `server`, `tpl`, `os` · `term:trust-boundary`

## Steps

### `form` Signing up

`attacker → server` · `legit`
Message: name Anna · Result: email “Hello, Anna!”

```http
POST /signup
name=Anna&email=anna@mail.example
```

#### Simple

After signing up, the shop sends an email: “Hello, Anna!”. The name in the email is **whatever the
person typed** into the form. The attacker signs up and looks at what such an email looks like.

#### Step by step

The server takes the `name` field from the form and puts it into the greeting. The email is not
written by a person but by a template engine: it gets a blank of the email and the data, and puts
the final text together.

#### Deeper

Almost every site has a template engine: Jinja2, Twig, FreeMarker, Velocity and others. Each has its
own small language: in the blank you can write an expression in special brackets, and the engine
**evaluates** it while building the text. Handy for the site's author, dangerous for a visitor's
text.

### `probe` A name that is an expression

`attacker → server` · `attack`
Message: name {{7*7}} · Result: accepted as a name

```http
POST /signup
name=⟦{{7*7}}⟧&email=x@mail.example
```

#### Simple

Instead of a name the attacker writes `{{7*7}}`. To a person it means nothing, but to many template
engines it is **an expression**: “work out seven times seven”.

#### Step by step

The server accepts the field as an ordinary name: there are no quotes, no tags, nothing a simple
filter would flag. It saves the user and prepares the email.

#### Deeper

This probe is the classic way to check whether a server evaluates templates from input; MITRE uses
it as an example in CWE-1336 too. If `49` shows up in the answer, the expression worked. Template
engines write expressions differently (`{{ }}`, `${ }`, `<% %>`), so answers to different probes
tell the attacker which engine the server runs.

### `glue` The name glued into the template

`server → tpl` · `attack` · `without-defence`
Message: template with the name inside · Result: attack

```text
template = "Hello, " + name + "!"
         = "Hello, ⟦{{7*7}}⟧!"
```

#### Simple

The server **glues** the email blank and the name together and hands the template engine the
finished string. Now the visitor's name is part of the template itself, not data for it.

#### Step by step

The template engine does not know which part of the string came from the programmer and which
from the visitor. It sees `{{7*7}}` and evaluates it like any other expression in the template.

#### Deeper

This is weakness CWE-1336: the program gives the template engine a visitor's input without
neutralizing the characters the engine treats as expressions. At heart it is the same injection as
SQL injection: data ends up in text that is then **executed**. OWASP WSTG walks through the same
kind of code with Flask and Jinja2: the template string is built by adding the name from the
request.

### `answer` The email “Hello, 49!”

`server → attacker` · `attack` · `without-defence` · `icon:mail`
Message: Hello, 49! · Result: expression evaluated

```text
Hello, ⟦49⟧!
```

#### Simple

The email says **49** instead of a name. The attacker has learned the key thing: the server runs
what they type into the “Name” field.

#### Step by step

The template engine worked out `7*7` and put in the result. The email went to the attacker's
address, so they see the server's answer to their probe.

#### Deeper

The answer does not have to come by email: it can be a page, a PDF invoice or an error message.
Sometimes the result is not visible at all. OWASP WSTG warns that an unchanged response does not
prove the expression was not executed.

### `escalate` A more serious expression

`attacker → server` · `attack` · `without-defence`
Message: name with a long expression · Result: accepted as a name

```text
name = {{ ⟦a path from template objects
          to a function that starts programs⟧ }}
```

#### Simple

Arithmetic was only a test. Now the attacker puts into the name an expression that **reaches the
server's functions through the template engine's objects**, including those that start programs.

#### Step by step

Inside an expression the engine offers the variables and objects it holds while building the
email. From one object you can move to its class, from the class to other parts of the program. The
attacker lines up such a path to a function that runs a command.

#### Deeper

The path depends on the engine and the language, and it is found in the engine's documentation:
which objects, methods and filters a template can use. OWASP WSTG describes SSTI exactly like
that: input embedded in a template in an unsafe way leads to code running on the server.

### `exec` A command runs

`tpl → os` · `attack` · `without-defence`
Message: the attacker's command · Result: code runs on the server

```text
⟦command from the expression in the name⟧
```

#### Simple

The template engine evaluates the expression and in doing so **starts a command** on the server,
with the shop's rights. From the “Name” field the attacker has got into the server.

#### Step by step

The command can read the site's settings with the database passwords, download and start a
program, open a connection to the attacker. The email itself may arrive looking perfectly normal.

#### Deeper

This is remote code execution. But even without running commands the damage can be large: among
MITRE's examples for CWE-1336 is a product where template injection was used to read the database
user name and password from template variables.

### `data` The name as data

`server → tpl` · `attack` · `with-defence` · `stopped`
Message: template + name separately · Result: expression not evaluated

```text
template = "Hello, {{ name }}!"   ← fixed
name     = "⟦{{7*7}}⟧"            ← just text
```

#### Simple

With the defence on, the email blank is **the same for everyone**, and the name goes separately, as
the value of a variable. The template engine puts it in as text and evaluates nothing in it. The
attack stops here.

#### Step by step

The expression `{{ name }}` was written by the programmer. The engine evaluates only that: “put in
the value of `name`”. Brackets inside the value itself are just characters to it.

#### Deeper

A parameterized database query works the same way: code and data travel separately. CWE-1336 adds
a second layer: choose a template engine with a sandbox or restricted mode and turn it on, so that
template expressions cannot reach dangerous functions. If visitors must write their own templates
(say, in a newsletter builder), the sandbox is a must.

### `plain` The email with the name as typed

`server → attacker` · `safe` · `with-defence` · `icon:mail`
Message: Hello, {{7*7}}! · Result: the attack failed

```text
Hello, {{7*7}}!
```

#### Simple

The email arrives with the “name” exactly as it was typed. No `49`, no command: **text stayed
text**.

#### Step by step

The attacker sees that the server does not evaluate their input. Putting something of their own
into the template does not work.

#### Deeper

If the email is HTML, the value is also escaped for HTML, otherwise SSTI would just turn into XSS.
CWE-1336 notes that template injection sometimes looks like XSS, which makes the real cause easy
to miss.

## How to defend

- **A fixed template.** Do not build the template string from a visitor's input. Pass input into a
  ready template as variable values.
- **A sandbox.** Choose a template engine with a sandbox or restricted mode and turn it on,
  especially if visitors can write their own templates.
- **Less power in the template.** Do not give the template objects and functions it does not need:
  the less expressions can reach, the longer the path to anything dangerous.
- **Input checks.** A name is letters, spaces and hyphens. Input that does not look like a name is
  worth rejecting, but this is an extra layer, not a replacement for the first two.
- **Fewer rights.** The site runs with minimal rights on the system, so a command from a template,
  if one ever runs, can do less.
