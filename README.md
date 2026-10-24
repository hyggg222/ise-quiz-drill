# ISE QUIZ DRILL

A practice tool that recreates the Brightspace quiz interface, so students can
take mock tests built from their own notes. Quizzes and attempts are stored in
the browser's localStorage.

Open the site to create a mock test: pick the options, copy the generated
prompt into an AI chat together with your notes, and paste the JSON it returns.
Quizzes run with a real-time timer, are saved in the browser and keep a history
of attempts.
See [ADR-003](docs/adr/ADR-003-pivot-to-quiz-simulator.md) for why it replaced
the original blog.

## Community library

The Community Library page lists the tests in `src/data/community/` for every
visitor. To add one, put its quiz JSON (the importer format) in the folder of
its preset, such as `itg/`, and open a pull request. The test gets that
preset's time, layout and proctoring.

## Stack

- [Astro](https://astro.build) with the Node adapter (SSR server plus
  prerendered pages)
- React islands for the quiz UI, styled with Tailwind CSS on quiz pages only
  ([ADR-004](docs/adr/ADR-004-scope-tailwind-to-quiz-pages.md))
- Vitest and Testing Library for tests, ESLint and Prettier for code style
- AWS CDK for infrastructure: S3 and CloudFront for the static site, ECR for
  the container image, ECS Express Mode to run it
  ([ADR-007](docs/adr/ADR-007-run-the-container-on-ecs-express-mode.md))

## Getting started

Requires Node 22.12 or later.

```sh
npm ci
npm run dev
```

| Command                    | What it does                             |
| -------------------------- | ---------------------------------------- |
| `npm run dev`              | Start the dev server on `localhost:4321` |
| `npm run build`            | Build the site into `dist/`              |
| `npm run preview`          | Serve the production build               |
| `npm run lint`             | Run ESLint                               |
| `npm run check`            | Type check with `astro check`            |
| `npm run test:unit:run`    | Run the unit and component tests once    |
| `npm run test:integration` | Run the integration tests                |
| `npm run test:e2e`         | Run the Playwright tests (build first)   |
| `npm run format:check`     | Check formatting with Prettier           |

## Testing

| Layer       | Where                | Tool                    | What it covers                                                                          |
| ----------- | -------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| Unit        | `src/**/*.test.*`    | Vitest, Testing Library | One function or component at a time                                                     |
| Integration | `tests/integration/` | Vitest, Testing Library | The whole app in jsdom with a real localStorage: create, take, submit, history, library |
| End to end  | `e2e/`               | Playwright, Chromium    | The same journeys in a real browser against the production build                        |

Run the end-to-end tests locally inside the official Playwright image, so no
browser has to be installed on the machine:

```sh
npm run build
npm run test:e2e:podman
```

On a system that Playwright supports, `npx playwright install chromium` and
`npm run test:e2e` work too. When upgrading `@playwright/test`, change the image
tag in `test:e2e:podman` to the same version (a test checks this). After a
failure, `playwright-report/` and `test-results/` hold the report and a trace.

## CI and deployment

- **CI** (`.github/workflows/ci.yml`) has three jobs that run in parallel on
  every pull request: `validate` (format check, lint, type check, unit tests),
  `integration` and `e2e` (builds the app and runs Playwright; the report is
  kept as an artifact when it fails).
- **Deploy** (`.github/workflows/deploy-static.yml`) builds the site and runs
  `cdk synth` on pull requests. On `main` it first calls CI, and only when
  every job has passed does it deploy the prerendered pages to S3 and
  CloudFront and smoke test the live URL.
- **Container Image** (`.github/workflows/container.yml`) builds the SSR
  server image with Podman and smoke tests `/api/health` on pull requests. On
  `main` it also waits for CI, then pushes the image to ECR, tagged with the
  short commit SHA and `latest`
  ([ADR-005](docs/adr/ADR-005-build-images-with-podman.md)). A `deploy` job
  then rolls the ECS Express service onto that SHA and smoke tests the service
  URL ([ADR-007](docs/adr/ADR-007-run-the-container-on-ecs-express-mode.md)).
- How the tests and the gate fit together is in
  [ADR-006](docs/adr/ADR-006-test-layers-and-ci-gate.md).

## Container image

The `Dockerfile` builds the SSR server image, which exposes `/api/health`.
Build in Docker format so the `HEALTHCHECK` is kept:

```sh
podman build --format docker -t ise-quiz-drill .
podman run --rm -p 4321:4321 ise-quiz-drill
```

To push by hand (CI does this on every merge to `main`):

```sh
REGISTRY=468204079455.dkr.ecr.eu-west-1.amazonaws.com
aws ecr get-login-password --region eu-west-1 |
  podman login --username AWS --password-stdin "$REGISTRY"
podman push ise-quiz-drill "$REGISTRY/ise-quiz-drill:v2.0.0"
```

## Running service

The image runs on ECS Express Mode. The live URL is linked under
**Deployments → production** on the repository page and in the summary of each
deploy run (it is also the `ServiceUrl` output of `ServiceStack`). A CloudWatch
alarm fires when no task passes `/api/health` for three minutes and emails the
address in the `ALARM_EMAIL` repository secret, once when the site goes down and
once when it is back. AWS sends a confirmation email after the first deploy with
a new address; no alarm email arrives until the link in it is clicked. Roll back
by deploying an older commit tag:

```sh
cd cdk
npx cdk deploy ServiceStack -c imageTag=<short SHA>
```

Delete the service when it is no longer needed, since it is billed while it
runs: `npx cdk destroy ServiceStack ServiceRolesStack`.

## Documentation

- [Architecture decisions](docs/adr/)
- [Product requirements and quiz spec](docs/product/)
- [Workflow, board and label rules](docs/process/workflow.md)
