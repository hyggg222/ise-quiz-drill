# ADR-009: Built-in Exam Presets in the Test Creator

## Status: Accepted (Date: 2026-10-15)

## Context

Every exam of the same kind (for example a weekly DevOps quiz) needs the same
prompt options and the same test settings. Filling them by hand each time is
slow and error-prone. Presets made by the user are out of scope for now.

Pickers considered: segmented buttons, cards, and a select with an Apply
button.

## Decision

- Presets live in one JSON file, src/utils/presets.json. Adding or changing a
  preset is a data edit, not a code change. A unit test checks that every
  preset passes the same validation as the forms.
- A preset only pre-fills. A null field keeps the app default. After applying,
  every field is still a normal input.
- Two pure functions, one for the prompt options (step 1) and one for the test
  settings (step 2), plus a reset for each that returns the app defaults.
- Two independent pickers, one per step, with no shared selection. Someone who
  already has JSON can apply a preset in step 2 without visiting step 1.
- The picker is a select with an Apply button (option C). Nothing changes until
  Apply, which also stops an accidental overwrite when there are many presets.
- If the fields were edited by hand, Apply and Reset ask first (Replace /
  Cancel). "Edited" means the value is neither the app defaults nor exactly
  what some preset gives, so it can be rebuilt without losing anything.
- The options and settings stay in MockTestCreator (ADR-008).

## Consequences

- The confirm check does not need to remember the last applied preset, so it
  still works after the step is left and opened again.
- A hand edit that happens to equal a preset or the defaults is not asked
  about. Nothing is lost in that case.
- The picker is generic in the value it fills, so a later preset kind can reuse
  it.

## Easy-to-hard instruction

- A preset asks for easy to hard order by holding the chip text in its notes,
  like any other instruction. It has no separate tags field.
- The text is a constant in code (promptBuilder.ts). presets.json repeats it,
  and a unit test checks that the ITG notes hold the constant.
- Notes are part of the prompt options, so the "edited" check and the reset
  needed no change.
