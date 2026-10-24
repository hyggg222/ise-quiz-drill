# ADR-012: An Easy-to-Hard Chip and a Requirements-First Prompt

## Status: Accepted (Date: 2026-10-23)

## Context

A student could not ask the prompt for easy-to-hard order, and the AI could
drop a requirement without anyone noticing. The prompt also contradicted
itself in places (recall for Easy questions, answer positions, code snippets).

## Decision

- The easy-to-hard instruction is a Quick Add chip like the others. Pressing
  it adds its text to the special instructions by the same code. The text is a
  constant in code (promptBuilder.ts); there is no separate tag state.
- The prompt starts with one block of numbered requirements. It says the block
  overrides the style rules, except the JSON format. A self-check at the end
  lists each requirement that was given.
- The import check warns and never blocks. It compares the pasted JSON with the
  options of the last built prompt, and does nothing when no prompt was built.
- The easy-to-hard order is a chip, not a rule in the base prompt. The ITG
  preset has its text in its notes, and the text applies only when there is
  more than one difficulty. The import check finds that text in the notes to
  know the order was asked for.

## Alternatives rejected

- A separate tag state with its own checkbox or toggle (the first build): a
  second mechanism next to the chips, with its own state, type, validation and
  preset field, that looked and behaved unlike the other chips. The user asked
  to reuse the chip code, so this was removed.
- The text in presets.json by reference: JSON cannot import the constant. A
  test checks that the ITG notes hold the text.
- A sentence about precedence only: the AI still dropped requirements, and
  nothing checked the answer.
- Blocking an import on a mismatch: JSON that comes from elsewhere would be
  refused for a rule it never saw.
- Comparing with the current form: the student may edit the form after building
  the prompt, which gives false warnings.
- Always sorting easy to hard: not every test wants that order.

## Consequences

- Adding another chip is one entry in the chip list. If its text should also be
  checked on import, the check needs a line for it.
- A student who edits the chip text in the notes stops the order warning,
  because the check looks for the exact text. It only warns, so nothing breaks.
- Pressing a chip twice adds its text twice, as for every chip.
- A warning does not prove the AI broke the rule: the difficulty tags are the
  AI's own guesses. The student decides what to do.
