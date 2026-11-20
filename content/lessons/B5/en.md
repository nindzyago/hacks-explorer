# Insecure deserialization

`lesson` B5 · `section` B · `wave` 3 · `format` 1

## Passport

- `cwe` 502
- `owasp` A08:2021
- `attack` T1190
- `severity` critical
- `impact` Running commands on the server, tampering with data, denial of service
- `defence` Accept only plain data from visitors, such as JSON
- `class` Building objects from someone else's data

## Sources

- [OWASP: Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)
- [OWASP Top 10:2021, A08 Software and Data Integrity Failures](https://owasp.org/Top10/2021/A08_2021-Software_and_Data_Integrity_Failures/)
- [MITRE CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)
- [MITRE ATT&CK T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/)

## Participants

- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Web server** — 198.51.100.10 · `term:web-server`
- `os` **Server OS** — starts programs · `icon:workstation` · `term:rce`

## Zones

- `internet` Internet: `attacker`
- `site` Shop shop.example: `server`, `os` · `term:trust-boundary`

## Steps

### `cart` A cart in a cookie

`server → attacker` · `legit` · `without-defence`
Message: cart: rO0AB... · Result: cart object with the visitor

```http
Set-Cookie: cart=rO0ABXNyAARDYXJ0...
```

#### Simple

The shop does not keep the cart itself. It **packs the “Cart” object** from its program into a
string and gives it to the browser. With the next request the browser returns the string, and the
server unpacks the cart again.

#### Step by step

The server turns the object into bytes with the language's built-in mechanism (Java here) and
encodes them in Base64. The result is the `cart` cookie. The browser dutifully attaches it to every
request.

#### Deeper

Packing an object into bytes is called serialization, unpacking is deserialization. OWASP notes
that Java serialization data in Base64 starts with `rO0`, which makes it easy to spot. Built-in
formats can do more than JSON: they also record *which class* the object is.

### `cart-json` The cart as data

`server → attacker` · `legit` · `with-defence`
Message: cart: JSON · Result: product numbers only

```text
cart = {"items": [17, 42]}
```

#### Simple

With the defence on, the server sends the cart **simply as a list of products**, not as an object
of the program. It holds only numbers and strings, no classes.

#### Step by step

The server writes the cart as JSON: product numbers in a list. Such text can only give numbers,
strings and lists.

#### Deeper

For data that goes out to the visitor and comes back, OWASP advises a simple standard format like
JSON instead of a built-in object format. The server then builds the `Cart` object itself, by its
own rules, and checks every value.

### `forge` The forgery

`attacker → attacker` · `attack`
Message: an object of another class · Result: forged string ready

```text
instead of Cart:
⟦an object of a class from the server's library,
 a command in its field⟧
```

#### Simple

The attacker builds a string of his own. Inside is not a cart but **an object of a different
class** that exists in the server's libraries. He writes no code of his own: he only picks classes
and fills in their fields.

#### Step by step

The attacker knows which popular libraries Java sites use. Some have classes whose methods call one
another while being unpacked. He lines them up into a chain and puts a command in the last one's
field.

#### Deeper

Such classes are called gadgets, and their chain a gadget chain. According to MITRE, gadgets are
often found in libraries and run by themselves during deserialization. New chains keep being found.

### `send` The forged cart

`attacker → server` · `attack`
Message: cart cookie with the forgery · Result: accepted

```http
Cookie: cart=⟦rO0ABXNy...forgery⟧
```

#### Simple

The attacker sends an ordinary request, but puts his own string into the `cart` cookie. To the
server it looks like the cart it handed out itself.

#### Step by step

The cookie lives in the browser, so the visitor can replace it with anything. The server receives
the string without knowing who built it.

#### Deeper

Everything that comes from the client is visitor input: form fields, headers, cookies, hidden
fields. The server can't know the cookie was not changed unless it checks that itself.

### `revive` The server brings the object to life

`server → server` · `attack` · `without-defence`
Message: readObject() · Result: attack

```text
readObject(cart)
→ created ⟦a class from the library⟧
→ its method called → the next ...
```

#### Simple

The server unpacks the string and **creates objects of whatever classes it names**. While being
built, the objects call their own methods. The chain fires before the server gets to check whether
this is a cart.

#### Step by step

The site's code calls `readObject` and only then casts the result to `Cart`. But by that moment the
forged objects are already built and their methods have already run.

#### Deeper

This is the weakness CWE-502: the server deserializes data without making sure it can be trusted.
The built-in format lets the data it receives choose which classes get created. The consequences,
says OWASP, range from denial of service and access control bypass to running someone else's code.

### `exec` A command is started

`server → os` · `attack` · `without-defence`
Message: a command · Result: attacker's code executed

```text
⟦command from the forged object⟧
```

#### Simple

The last link of the chain asks the system to start a command. The system starts it **as the
shop**. The attacker has run his command on the server.

#### Step by step

The command runs with the site's rights: it reads files, opens connections, installs programs. The
attacker needs no answer: the command has already run.

#### Deeper

This is remote code execution, although the attacker did not send a single line of code, only data.
That is why this weakness is hard to notice: the request contains no script and no shell command in
the familiar form.

### `parse` Reading JSON

`server → server` · `attack` · `with-defence` · `stopped`
Message: this is not cart JSON · Result: rejected, attack failed

```text
JSON.parse(⟦rO0ABXNy...⟧) → error
```

#### Simple

Now the server reads the cart as JSON. JSON has no classes, and there is no way to create an object
by a name taken from the data. The forgery is not JSON, and the server discards it. The attack
stops here.

#### Step by step

Parsing JSON gives only numbers, strings and lists. The attacker's string does not parse, and the
server creates no objects at all.

#### Deeper

If the built-in format can't be dropped, OWASP and MITRE advise signing the data (for example with
an HMAC) and not unpacking anything whose signature does not match, and also limiting classes with
an allowlist (in Java, serialization filters). But a class allowlist alone does not save you: new
gadgets keep being found.

### `refuse` An empty cart

`server → attacker` · `safe` · `with-defence`
Message: cart reset · Result: attack failed

#### Simple

The server treats the cart as damaged and hands out an empty one. The attacker got an empty cart,
and nothing more.

#### Step by step

The server answers with an ordinary page and a new cookie with an empty product list.

#### Deeper

The server did not even try to understand what was inside the forgery: to it this is just invalid
text. Not a single foreign class was created, not a single method called.

## How to defend

- **Don't accept objects from visitors.** For data that goes to the client and comes back, use a
  simple format like JSON and build the objects yourself, checking the values.
- **Sign it if you can't avoid the format.** The server signs the data (for example with an HMAC)
  and does not unpack anything whose signature does not match.
- **Allowlist classes.** In Java, serialization filters with a list of allowed classes and size
  limits. This is a layer of defence, not a replacement for the first two.
- **Fewer unneeded classes.** Don't keep libraries and classes it doesn't need in an application
  that parses someone else's data.
- **Keep track of known gadgets.** OWASP advises knowing the dangerous classes of your platform and
  watching especially where deserialization could create them.
