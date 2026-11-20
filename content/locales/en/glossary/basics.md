# Basics

`glossary` en · `category` basics

## `attacker` Attacker

`category` basics · `see` victim, trust-boundary · `lessons` B1, I1

Someone who tries to make a system break its own rules: steal data, log in under someone else's
name, take a service down. Harmful messages on the lesson diagrams are red.

## `victim` Victim

`category` basics · `see` attacker, phishing · `lessons` I1

Forms: victim, victims

The person or system an attack is aimed at. In the phishing lesson it is the employee who is
tricked into giving away a password.

## `trust-boundary` Trust boundary

`category` basics · `see` injection, attacker · `lessons` B1

Forms: trust boundary, trust boundaries

The place where data passes from someone the system cannot trust (for example, the internet) to
something that trusts it (the server, the database). Everything that crosses it from outside must
be checked and handled as data, not as commands. On a lesson diagram it is shown by the frame of a
zone.

## `data-breach` Data breach

`category` basics · `see` database, hash · `lessons` F1

Forms: data breach, data breaches, database leak, database leaks

A case where a site's data, for example a copy of its database, ends up with outsiders. After a
breach the attacker works on the copy on their own machines, and the site can do nothing about it.
That is why passwords are stored so that a leaked copy gives away little.

## `logging` Log

`category` basics · `see` jndi, rce · `lessons` K1

Forms: log, logs, logging, logging library

A program's record of what happened to it: who sent requests and when, which errors occurred. It
is usually written by a ready-made library, such as Log4j for Java. Visitor data ends up in the
log too, so to the library it must stay plain text.

## `rce` Remote code execution

`category` basics · `see` attacker, logging · `lessons` K1

Forms: remote code execution, RCE

An attacker makes someone else's server run their program over the network. Usually the worst
outcome: from there the attacker acts with the rights of the hijacked program, reading data,
installing programs, moving into the internal network.
