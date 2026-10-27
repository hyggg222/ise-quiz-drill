# ADR-001: Transition from Static Site to Containerized SSR Runtime

## Status: Accepted (Date: 2026-10-07, revised 2026-10-27)

## Context

The app needs server code for two API routes: `/api/health`, which the load
balancer and the pipeline call to see if the app is up, and `/api/events`,
which logs anonymous usage events. Static hosting on S3 cannot run Node.js, so
on CloudFront these routes return 403.

## Decision

- Configure Astro with `output: 'server'` and the `@astrojs/node` adapter in
  standalone mode, and package the app as a container (ADR-002, ADR-007).
- Prerender what does not need a server. The home page sets
  `prerender = true`, so the same HTML is built once and served by both
  runtimes. The API routes run on the server only.
- Keep the static site on S3 and CloudFront next to the server. They are
  separate stacks with separate workflows, so a broken server deploy never
  touches the static site.

## Trade-offs

|              | Static (S3 + CloudFront)                                                  | Server (ECS Express Mode)                                                      |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Server code  | None; API routes return 403                                               | `/api/health` and `/api/events`                                                |
| Cost         | Pay per request and stored byte, near zero at this traffic                | Load balancer and one task all day, about 25 USD a month (ADR-007)             |
| Latency      | Served from the nearest edge location                                     | One region (eu-west-1); server p95 under 120 ms on the dashboard               |
| Health check | None; CloudFront serves whatever is in the bucket                         | The load balancer sends traffic only to tasks that answer 200 on `/api/health` |
| Deploy       | All at once: upload every file, then invalidate the cache (`/*`)          | Canary: 5% of traffic for three minutes, then 100%, then three minutes bake    |
| Rollback     | Revert the PR; the next deploy uploads the old files and clears the cache | Deploy an older image tag; the circuit breaker also rolls back by itself       |
| Failure mode | A bad build is live for everyone until the revert deploys                 | A task that fails the health check never gets traffic                          |
| Operations   | One stack, nothing running                                                | Image registry, IAM roles, alarms, logs and a dashboard                        |

Static is cheaper, faster and simpler, so it serves everything that can be
built ahead of time. The server costs money and work, so it serves only what
needs code at request time, and it brings the health checks that make safe
deploys possible.

## Service level

SLIs, read from the load balancer across both target groups on the
`ise-quiz-drill` CloudWatch dashboard:

- Availability: the share of requests that do not return 5xx.
- Latency: the 95th percentile of the target response time.
- Health: the number of tasks that pass `/api/health`.

SLOs over a rolling 30 days:

- 99.5% of requests do not return 5xx. The error budget is the other 0.5%,
  about 3.6 hours of full outage a month.
- The p95 response time stays under 500 ms.
- At least one task is healthy in 99.5% of minutes.

99.5% and not 99.9%: the service runs one task in one region to keep the cost
low, and 99.9% leaves only 43 minutes a month, less than a few deploys that go
wrong. When the budget is spent, feature deploys stop until the cause is fixed.

What protects the SLOs:

- During a deploy, Express Mode rolls back by itself when 4xx plus 5xx go over
  1% of canary traffic, and the circuit breaker rolls back after repeated task
  failures.
- `NoHealthyTaskAlarm` emails when no task passes `/api/health` for three
  minutes; `ErrorAlarm` emails at 5 or more 5xx a minute for three minutes.
- The SLOs are read from the dashboard; there is no burn rate alarm yet. The
  static site has no SLO of its own and relies on CloudFront.

## Consequences

- Positive: live API routes and a health check, which make canary deploys and
  automatic rollback possible.
- Positive: pages that can be static stay on CloudFront, so the server only
  carries what needs it.
- Negative: more to run and pay for: a container registry, a service, IAM
  roles and alarms.
- Negative: two runtimes serve the same pages, so a change to a page is live
  on both only when both pipelines are green.
- Negative: a bug that still answers 200 on `/api/health` passes every
  automatic check; it needs a person to notice and a manual rollback to an
  older image tag.

## Correction (2026-10-27)

The first version named `/api/feedback`. That route never existed; the server
routes are `/api/health` and `/api/events`.
