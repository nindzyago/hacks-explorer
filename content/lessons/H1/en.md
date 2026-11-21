# Buffer overflow

`lesson` H1 · `section` H · `wave` 1 · `format` 1

## Passport

- `cwe` 121, 120
- `severity` critical
- `impact` The attacker makes the server run their code, or crashes the program
- `defence` Length checks and a memory-safe language
- `class` Stack-based buffer overflow

## Sources

- [MITRE CWE-121: Stack-based Buffer Overflow](https://cwe.mitre.org/data/definitions/121.html)
- [MITRE CWE-120: Buffer Copy without Checking Size of Input ('Classic Buffer Overflow')](https://cwe.mitre.org/data/definitions/120.html)
- [OWASP: Buffer Overflow](https://community.owasp.org/vulnerabilities/Buffer_Overflow)
- [MITRE ATT&CK M1050: Exploit Protection](https://attack.mitre.org/mitigations/M1050/)
- [CISA: Secure by Design Alert: Eliminating Buffer Overflow Vulnerabilities](https://www.cisa.gov/resources-tools/resources/secure-design-alert-eliminating-buffer-overflow-vulnerabilities)

## Participants

- `user` **Visitor** — 192.0.2.24
- `attacker` **Attacker** — 203.0.113.66 · `term:attacker`
- `server` **Server** — C code · `term:vulnerability`
- `stack` **Stack** — memory · `icon:document` · `term:buffer-overflow`

## Zones

- `internet` Internet: `user`, `attacker`
- `host` Server 198.51.100.10: `server`, `stack`

## Steps

### `normal` An ordinary name

`user → server` · `legit`
Message: name: Anna · Result: accepted

```text
name: Anna
```

#### Simple

A visitor types in their name, and the server stores it. The name is short, and everything works
as intended.

#### Step by step

The server receives the string with the name and hands it to a function that will keep it for
the reply.

#### Deeper

The server program is written in C. The language does not watch memory boundaries on its own:
how many bytes to write, and where, is up to the programmer.

### `frame` A place in memory

`server → stack` · `legit`
Message: into buffer · Result: it fits

```text
[ buffer name: 64 bytes ][ housekeeping ][ return address ]
```

#### Simple

For the name, the function has set aside **a 64-byte slot** in memory. Right after it sits an
important record: where to go back to when the function finishes.

#### Step by step

The name "Anna" takes a few bytes and fits in the slot. The return address is untouched; the
function finishes and returns to where it was called from.

#### Deeper

A slot like this is called a buffer, and the memory area where a function keeps its variables
and its return address is the stack. The buffer and the return address sit side by side, so a
write that does not stop at the end of the buffer lands right on the return address.

### `long` A very long name

`attacker → server` · `attack` · `without-defence`
Message: a 300-byte name · Result: accepted unchecked

```text
name: AAAAAAAA…AAAAAAAA (300 bytes) ⟦+ an address chosen by the attacker⟧
```

#### Simple

The attacker sends a "name" **300 bytes** long, even though the slot holds 64. At the end they
add an address of their own choosing.

#### Step by step

The server does not check the length and passes the whole string on to the same function.

#### Deeper

This lesson has no real addresses or offsets: the mechanism is what matters. The attacker needs
to know how the program's memory is laid out, and usually studies their own copy of the same
program.

### `smash` Writing past the edge

`server → stack` · `attack` · `without-defence`
Message: 300 bytes into 64 · Result: return address overwritten

```c
char name[64];
strcpy(name, input);   /* ⟦length is not checked⟧ */
```

#### Simple

The function copies the name into the slot until the name runs out. The slot fills up, the
writing carries on and **overwrites the return address** with the attacker's address.

#### Step by step

`strcpy` copies bytes up to the end of the string and does not know the size of the slot. The
first 64 bytes go into the buffer, the rest over the neighbouring data, including the return
address.

#### Deeper

This is the classic buffer overflow, CWE-120: copying without checking the size. Writing past the
end of a buffer on the stack is CWE-121. CWE-120's examples point to `strcpy` as a dangerous
function.

### `jump` Returning to the wrong place

`stack → server` · `attack` · `without-defence`
Message: a foreign address · Result: the CPU runs foreign code

#### Simple

The function finishes and returns to the address stored in memory. But that address has been
**replaced**. The processor obediently goes where the attacker pointed.

#### Step by step

The processor does not know the address is foreign: it just takes it from the stack. The
attacker points it at code they sent in the same string.

#### Deeper

There are compiler and system defences against this step. **A canary**: a random value is placed
before the return address, and if it is damaged when the function returns, the program stops.
**ASLR**: the program's addresses in memory differ every run, so the attacker struggles to guess
where to jump. **DEP**: memory meant for data cannot be run as code. CWE states plainly that none
of these is a complete solution: canaries catch only some overflows, ASLR is bypassed through
address leaks, and even a caught overflow crashes the program.

### `control` The attacker owns the server

`server → attacker` · `attack` · `without-defence`
Message: the attacker's code is running · Result: server taken over

#### Simple

**The attacker's code** now runs on the server with the program's rights. It can read data,
install programs and move further into the network.

#### Step by step

Often the attacker's first code is small: it opens a connection to the attacker and waits for
commands.

#### Deeper

This is how a buffer overflow becomes remote code execution. If the program ran with
administrator rights, the attacker gets those too. That is why programs that take input from the
network are run with the least privileges they need.

### `checked` Length checked

`attacker → server` · `attack` · `with-defence` · `stopped`
Message: a 300-byte name · Result: longer than 63, rejected

```c
if (len >= sizeof name) return ERR_TOO_LONG;   /* ⟦300 ≥ 64⟧ */
```

#### Simple

Now the server **checks the length** before copying. 300 bytes do not fit into a 64-byte slot,
so the server rejects the name. It never reaches memory. The attack stops here.

#### Step by step

Before copying, the server compares the string's length with the buffer's size. One byte is
needed for the zero at the end of the string, so a 64-byte slot holds 63 characters.

#### Deeper

Checking bounds on input is one of CWE-121's mitigations. A language that checks bounds by itself
is more reliable still: CWE-120 lists choosing such a language as its first mitigation, and in
2025 CISA urged manufacturers to move to memory-safe languages. Canaries, ASLR and DEP stay as a
second line in case a bug slips through.

### `reply` A polite refusal

`server → attacker` · `legit` · `with-defence`
Message: "name too long" · Result: the server keeps working

#### Simple

The attacker gets the reply **"name too long"**. The server has not crashed and keeps serving
other visitors.

#### Step by step

The error is handled like any other bad input: memory is untouched and the program carries on.

#### Deeper

It is worth logging refusals like this: many very long strings from one address are a sign that
someone is hunting for an overflow.

## How to defend

- **Check the length of everything you copy.** Use functions that know the buffer's size, and
  avoid those that do not, such as `gets` and `strcpy`.
- **A memory-safe language.** Write new code, especially code that takes input from the network,
  in a language that checks bounds by itself.
- **Compiler defences.** Turn on stack canaries and size checks in the build.
- **System defences.** Keep ASLR and DEP switched on.
- **Find bugs early.** Static analysis, fuzzing and memory-checking builds find overflows before
  release.
- **Patch and drop privileges.** Install fixes on time and run network programs with the least
  privileges they need.
