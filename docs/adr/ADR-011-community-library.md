# ADR-011: Community Library as JSON Files in the Repo

## Status: Accepted (Date: 2026-10-24)

## Context

Students had to write or paste questions before they could practise. The two
built-in tests were tied to the presets and shown on the creator page. The
site needs a set of tests every visitor can start, on a page of its own.

## Decision

- The tests are JSON files in `src/data/community/<preset id>/`, one test per
  file, in the
  importer format (what the AI returns).
- The page reads them at build time and runs each one through the existing
  importer with the time, layout and proctoring of the preset its folder names,
  through the existing preset code (ADR-009). The file keeps its own title. A file
  the importer refuses fails the build and the unit tests.
- The file name is the test id. An id inside the file is ignored, so two files
  can never collide.
- The page reuses the Saved library card (Start Quiz and Export, no Delete) and
  empty state. Start saves a copy in
  the Saved library under `community-<id>`, so it works offline.
- Adding a test is a pull request with one JSON file; it ships with the next
  deploy.
- The built-in DevOps and ITG tests and their code are removed. The presets
  stay (ADR-009).

## Alternatives rejected

- A DynamoDB table with an admin API, an admin key in Parameter Store, a
  separate CDK stack and a publish script. It was built first and removed: it
  added about 2,000 lines, a new stack, an IAM role and a secret to maintain,
  for a library that one person fills. Adding a test without a deploy is not
  worth that cost now.
- Keeping the tests on the creator page: the user wanted the library as its own
  view in the top bar, like Test Creator and Saved Library.

## Consequences

- Positive: no backend, no new infrastructure, no secret. The tests are
  reviewed in pull requests like code, and the importer checks every file.
- Negative: a new or fixed test needs a pull request and a deploy.
- Negative: all tests in one folder share their preset's settings; a test with
  its own settings would need a new preset or a new field in the files.
- A file outside a preset folder, or in a folder with no matching preset,
  fails the build and the tests.
- Moving to a database later stays possible: the page takes its tests as a
  list, so only the loader would change.
