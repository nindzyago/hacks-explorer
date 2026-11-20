# Path traversal

`lesson` B3 · `section` B · `wave` 1 · `format` 1

## Passport

- `cwe` 22
- `owasp` A01:2021
- `severity` high
- `impact` Reading server files outside the allowed folder: configuration, passwords, source code
- `defence` File by ID or a check of the full path
- `class` Leaving a folder through a file path

## Sources

- [OWASP: Path Traversal Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Path_Traversal_Prevention_Cheat_Sheet.html)
- [OWASP: Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [OWASP Top 10:2021, A01 Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/)
- [MITRE CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `files` **Server disk** — /var/www/images · `icon:document`

## Zones

- `internet` Internet: `attacker`
- `site` Gallery photo.example: `server`, `files` · `term:trust-boundary`

## Steps

### `pic` A picture by name

`attacker → server` · `legit`
Message: cat.png · Result: picture

```http
GET /image?file=cat.png
```

#### Simple

The attacker opens a photo gallery. Every picture on the page loads from a link that contains the
file's name. So far it is the same as for everyone.

#### Step by step

The browser asks the server for a picture and names it in the `file` field: `cat.png`. The server
has to find that file in its pictures folder.

#### Deeper

The file name came from the visitor, so it can't be trusted, like any input. Such an address is
not a mistake in itself: everything depends on how the server turns the name into a path on disk.

### `read` Reading from the folder

`server → files` · `legit`
Message: read cat.png · Result: file found

```text
/var/www/images/ + cat.png
```

#### Simple

The server glues the name onto its pictures folder and reads the file from disk.

#### Step by step

The result is the path `/var/www/images/cat.png`. The file is there, the server reads it and sends
it to the browser.

#### Deeper

A file path is like a street address: a folder, a folder inside it, a file inside that. The
developer meant the visitor to name only a file inside `/var/www/images`. But gluing strings does
nothing to ensure that.

### `trick` A name with stairs going up

`attacker → server` · `attack`
Message: three ../ + passwd · Result: accepted as a name

```http
GET /image?file=⟦../../../etc/passwd⟧
```

#### Simple

Instead of a picture name the attacker writes “two dots and a slash” several times, then the path
to a system file. To a computer **two dots mean “the folder above”**.

#### Step by step

The `file` field carries `../../../etc/passwd`. The server accepts it as a file name without any
check.

#### Deeper

`..` stands for the parent folder in almost every system. Three steps up from `/var/www/images`
lead to the root of the disk, `/`, and from there to `/etc/passwd`, the list of Linux user
accounts. The same path is often hidden in URL encoding: `%2e%2e%2f` also means `../` once
decoded.

### `climb` The path leaves the folder

`server → files` · `attack` · `without-defence`
Message: /etc/passwd · Result: attack

```text
/var/www/images/⟦../../../etc/passwd⟧
= /etc/passwd
```

#### Simple

As before, the server glues what it received onto its folder. But every two dots lift the path one
folder up, and it **walks out of the pictures folder** straight to the system file.

#### Step by step

The server opens the path `/var/www/images/../../../etc/passwd`. The system resolves it to
`/etc/passwd` and hands over the file: the server is allowed to read it.

#### Deeper

This is the weakness CWE-22: the path is built from input, the special elements `..` and `/` in it
are not neutralized, and it points outside the allowed folder. An absolute path like `/etc/passwd`
with no dots at all is traversal too: many path-joining functions drop the base when the second
part starts with `/`.

### `leak` Someone else's file in the answer

`server → attacker` · `attack` · `without-defence`
Message: contents of /etc/passwd · Result: file read

```text
⟦root:x:0:0:root:/root:/bin/bash⟧
```

#### Simple

Instead of a picture the attacker gets a system file. The same way he can get the site's
configuration with the database password, or the site's own code.

#### Step by step

The server sends what it read as an ordinary answer. It does not know it has sent something other
than a picture.

#### Deeper

Configuration files are the most dangerous: they often hold passwords and keys. If the server
doesn't only read but also writes along such a path (for example, when it saves uploads), path
traversal lets the attacker overwrite other files. In the OWASP Top 10:2021 this weakness belongs to
A01 Broken Access Control.

### `check` Checking the full path

`server → server` · `attack` · `with-defence` · `stopped`
Message: /etc/passwd outside · Result: refused, attack failed

```text
full path: ⟦/etc/passwd⟧
starts with /var/www/images/ ? no
```

#### Simple

Now the server first **resolves the path to the end** and looks where it really leads. It leads
outside the pictures folder, and the server refuses to open the file. The attack stops here.

#### Step by step

The server decodes the name, glues it to the folder, works out the real full path and compares the
start of the path with the pictures folder. `/etc/passwd` is not inside it: no request goes to the
disk.

#### Deeper

Order matters, says OWASP: first decode the input completely, then join and resolve the path to its
full form, then check that it is inside the folder, and open exactly the path that was checked.
Compare whole path components, or a folder `/var/www/images-old` will pass a check for
`/var/www/images`. OWASP advises against stripping `../` from the input instead: such a filter is
easy to get around.

### `refuse` No such picture

`server → attacker` · `safe` · `with-defence`
Message: 404 Not Found · Result: file not sent

#### Simple

The server answers that there is no such picture. The system file stays where it was and goes
nowhere.

#### Step by step

The attacker gets an ordinary “not found” error with no details about the server's folders.

#### Deeper

The most reliable way is not to take the path from input at all: ask for a picture by its number,
and the server finds the file's path in its own table. Then there is nothing in the request to
swap.

## How to defend

- **Don't build the path from input.** The visitor names a file by an ID or picks from a list, and
  the server takes the real path from its own table.
- **Check the full path.** If a name is needed after all, the server decodes it, joins it to the
  folder, resolves it to a full path and checks that it is inside the allowed folder, comparing
  whole path components.
- **Allowlist the characters in the name.** Letters, digits, `-` and `_`, no slashes. This is an
  extra layer, not a replacement for the path check.
- **Don't strip `../`.** Such a filter misses `\`, encoded dots and absolute paths.
- **Minimal file rights.** The site can read only what it needs, so even a traversal gets little.
