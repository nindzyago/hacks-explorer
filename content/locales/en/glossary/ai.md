# AI

`glossary` en · `category` ai

## `llm` Language model

`category` ai · `see` prompt-injection, system-prompt · `lessons` J1

Forms: language model, language models, large language model, large language models, LLM, LLMs

A program trained on a huge amount of text that continues the text it is given in the most
likely way. Chatbots and AI assistants run on it. It does not execute rules like code; it reads
them as one more piece of the text.

## `prompt-injection` Prompt injection

`category` ai · `see` llm, system-prompt, injection, owasp · `lessons` J1

Forms: prompt injection, prompt injections

An attack on a language model: text from a visitor or from someone else's document reads like an
instruction, and the model follows it instead of the developer's rules. Direct: the visitor
writes the command; indirect: it is hidden in a page or file the model reads. In the OWASP Top 10
for LLM Applications it is LLM01:2025.

## `system-prompt` System prompt

`category` ai · `see` llm, prompt-injection · `lessons` J1

Forms: system prompt, system prompts, system rules

The text a developer gives a language model before the conversation: who it is, what it may and
may not do. Visitors do not see it but can coax it out. So it holds no secrets and is not relied
on as a defence.
