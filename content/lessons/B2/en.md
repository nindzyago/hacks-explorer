# OS command injection

`lesson` B2 · `section` B · `wave` 1 · `format` 1

## Passport

- `cwe` 78
- `owasp` A03:2021
- `attack` T1190
- `severity` critical
- `impact` Any command on the server with the web application's rights
- `defence` Start the program with a list of arguments, without a shell
- `class` Injection into an operating system command

## Sources

- [OWASP: OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
- [OWASP: Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [OWASP Top 10:2021, A03 Injection](https://owasp.org/Top10/2021/A03_2021-Injection/)
- [MITRE CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `os` **Server OS** — starts programs · `icon:workstation` · `term:shell`

## Zones

- `internet` Internet: `attacker`
- `site` Service net.example: `server`, `os` · `term:trust-boundary`

## Steps

### `form` Connection check

`attacker → server` · `legit`
Message: ping 192.0.2.10 · Result: ping reply

```http
GET /ping?host=192.0.2.10
```

#### Simple

The site has a handy button: type in a computer's address and the site checks whether it answers.
At first the attacker uses it like everyone else.

#### Step by step

The browser sends the address `192.0.2.10` in the `host` field. The server runs the `ping` program
with this address and shows on the page what it printed.

#### Deeper

For a check like this the easiest thing for a site is to call a ready-made system program rather
than write its own. That is not the danger in itself; the danger is in *how* it calls it: what
happens next depends on whether the visitor's input reaches the shell.

### `trick` An address with a tail

`attacker → server` · `attack`
Message: address + ;id · Result: accepted as an address

```http
GET /ping?host=192.0.2.10⟦;id⟧
```

#### Simple

Now the attacker adds a semicolon and the short word `id` after the address. To a person this is
junk. To the server's command line **a semicolon means “and now the next command”**.

#### Step by step

The `host` field carries the string `192.0.2.10;id`. The server does not check whether it looks
like an address and accepts it whole.

#### Deeper

`id` is a harmless Unix command: it prints which user it runs as. The attacker uses it as a test:
if its answer shows up on the page, the server runs the attacker's commands. Besides `;`, the
characters `&`, `&&`, `|` and `||` chain commands, and `$`, `<`, `>`, quotes and brackets also have
a special meaning to the shell.

### `glue` The server glues the command together

`server → os` · `attack` · `without-defence`
Message: sh -c "ping ...;id" · Result: attack

```sh
sh -c "ping -c 1 192.0.2.10⟦;id⟧"
```

#### Simple

The server writes the command as one line: “ping”, a space and whatever the visitor typed. It hands
the finished line to the **shell**, the program that reads a line and decides what to start.

#### Step by step

The site's code calls a function like `system("ping -c 1 " + host)`. Such a function passes the
line to the `sh` shell. The shell splits it by its own rules and sees two commands:
`ping -c 1 192.0.2.10` and `id`.

#### Deeper

The input has become part of the command: this is the weakness CWE-78. MITRE describes exactly
this variant: the program means to start one program of its own and puts the visitor's input in as
its argument. If it does not remove command separators from the input, it lets the attacker run
something after it.

### `run` Two commands instead of one

`os → server` · `attack` · `without-defence`
Message: ping + id output · Result: command executed

```text
64 bytes from 192.0.2.10: icmp_seq=1
⟦uid=33(www-data) gid=33(www-data)⟧
```

#### Simple

The system obediently runs both commands in a row. First `ping`, then `id`. The output of both
goes back to the site in one piece.

#### Step by step

The second command runs with the same rights as the site itself: here that is the user
`www-data`. Whatever that user may do, the attacker now may do too.

#### Deeper

Instead of `id` there could be any command: read configuration files with database passwords,
download and start a program, open a connection to the outside. This is remote code execution. The
more rights the site's account has, the bigger the damage.

### `leak` The answer on the page

`server → attacker` · `attack` · `without-defence`
Message: page with uid=33 · Result: server under control

#### Simple

The site shows everything the programs printed, and the attacker sees the answer to his command on
the page. So now he can give the server orders.

#### Step by step

The server puts the output into the page as usual. The line `uid=33(www-data)` confirms that the
second command ran.

#### Deeper

Output on the page only makes the attack easier. If the site did not show it, the second command
would still run: write a file, delete data, start a program. So “we don't print anything” is not a
defence.

### `args` Starting without a shell

`server → os` · `attack` · `with-defence` · `stopped`
Message: ping + one argument · Result: one program, attack failed

```text
program:    ping
arguments:  -c | 1 | ⟦192.0.2.10;id⟧
```

#### Simple

Now the server does not write the command as one line. It names the program to the system and
**lists its arguments separately**, like items on a list. The shell is not involved, so there is no
one to read the semicolon as “next command”. The attack stops here.

#### Step by step

The server calls `ping` directly and passes the visitor's input as a single argument. The system
starts one program, `ping`, and gives it the string `192.0.2.10;id` whole.

#### Deeper

This is parameterization in OWASP's terms: the shape of the command is fixed in advance and the data
travels separately, like parameters in an SQL query. In Java this is how `ProcessBuilder` works:
the program and each argument are separate list elements. Better still is to avoid the external
program altogether when the language has a ready-made function. OWASP warns that an argument list
does not protect against a harmful *argument*, so the input is still checked.

### `fail` No such address

`os → server` · `safe` · `with-defence`
Message: ping: unknown host · Result: the id command never started

#### Simple

`ping` cannot find a computer with such a strange name and reports an error. The second command
never started.

#### Step by step

To `ping`, the string `192.0.2.10;id` is just a name that does not exist. The program exits with
an error.

#### Deeper

As a second layer the server checks the input against an allowlist before starting anything: only
digits and dots, no longer than needed. Such input would not even reach `ping`. But the check only
adds to starting without a shell, it does not replace it.

### `refuse` An error instead of an answer

`server → attacker` · `safe` · `with-defence`
Message: Address not found · Result: attack failed

#### Simple

The site answers: no such address found. The attacker gets nothing but that phrase.

#### Step by step

The server shows a short error message. There is no output from the second command, because it
never ran.

#### Deeper

Even if a mistake remains somewhere, a site account with minimal rights limits the damage. OWASP
advises running the application with the lowest privileges it needs and with a separate account
for a single task.

## How to defend

- **Don't call external programs without need.** If the language has a ready-made function (create
  a folder, compress a file), use it: it cannot be made to do something else.
- **Program and arguments apart.** If you can't do without a program, start it with a list of
  arguments, without a shell: the visitor's input stays one argument.
- **Allowlist checks on input.** The server picks the command from its own list, and arguments are
  matched against allowed values or a strict pattern: only the characters needed, no spaces,
  quotes, brackets, `&`, `|`, `;`, `$`, `<` or `>`.
- **Escaping is a fallback.** Functions like `escapeshellarg()` in PHP wrap the input in quotes, but
  an attacker can still pass the program an argument of his own.
- **Minimal rights.** The site runs under an account that may do only what it needs. This does not
  stop the injection, but it reduces the damage.
