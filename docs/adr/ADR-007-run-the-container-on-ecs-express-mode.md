# ADR-007: Run the Container on ECS Express Mode

## Status: Accepted (Date: 2026-10-14)

## Context

Since ADR-005 every merge pushes a tested image to ECR, but nothing runs it:
the live site is the static build on S3 and CloudFront, where `/api/health`
returns 403. The plan was App Runner, which pulls an image and gives an HTTPS
URL. AWS closed App Runner to new customers on 2026-04-30, and this account
gets `SubscriptionRequiredException`. AWS points new users to ECS Express Mode.

Options considered:

- EC2 with Docker (or Kamal): cheapest, but we would patch the OS, manage SSH,
  HTTPS and zero-downtime restarts ourselves.
- ECS on Fargate, set up by hand: no servers, but we would also build the load
  balancer, listeners, target groups and scaling.
- EKS: Kubernetes for a single container is far more than we need.
- Lightsail containers: simple, but few deployment and monitoring controls.
- ECS Express Mode: give it an image, a port and a health check path; ECS
  creates the Fargate service, a shared HTTPS load balancer, auto scaling and
  CloudWatch logs.

## Decision

- Run the app on ECS Express Mode, defined in CDK as `ServiceStack`
  (`AWS::ECS::ExpressGatewayService`): one 0.25 vCPU / 512 MB task, scaling to
  two, health checked on `/api/health`.
- Keep the two IAM roles (infrastructure role, task execution role) in their
  own `ServiceRolesStack`. On the first try they lived in `ServiceStack`: the
  deploy failed, the rollback deleted the roles, and ECS could no longer clean
  up the half-created service, so it blocked the next deploy. Roles that
  outlive a failed deploy avoid this, and they are not freshly created (and
  not yet usable) when the service starts.
- Add a CloudWatch alarm when no task passes `/api/health` for three minutes.
  Express Mode deploys across two target groups (a canary rollout, see the
  correction below), so the alarm adds
  `HealthyHostCount` from both; watching only one would go blind after every
  other deploy.
- The Container Image workflow gets a `deploy` job. After the image is pushed,
  it runs `cdk deploy ServiceStack -c imageTag=<short SHA>` and smoke tests the
  service URL. Deploys never overlap.
- Deploy the commit tag, not `latest`. Every deploy changes the template, so
  CloudFormation always rolls the service, and the running version is visible
  in the stack.
- Rollback: redeploy an older tag with
  `cdk deploy ServiceStack -c imageTag=<old SHA>`. ECS replaces tasks only
  after the new ones pass the health check, so a broken image never takes the
  old one down.

## Consequences

- Positive: no servers to patch, HTTPS out of the box, and the same image that
  passed CI is what runs. The pipeline goes from merge to a live, health
  checked service without manual steps.
- Positive: it is still ECS, so rolling, blue/green and canary deployments,
  alarms and Container Insights are available when we need them.
- Negative: it costs money while it runs (load balancer plus one Fargate task,
  roughly 25 USD a month). Delete the stack with `cdk destroy ServiceStack`
  when it is no longer needed.
- Negative: ECR keeps only the 20 most recent images (ADR-005), so a rollback
  can only go back 20 merges.
- Negative: the CDK app also builds the static site stack, so the deploy job
  has to build the site before it can synthesize.
- Negative: the alarm reads the two target groups from the service's
  attributes. If Express Mode ever changes how many it creates, the stack
  update fails and the alarm has to change with it.
- The first ECS use in an account creates service-linked roles for ECS, load
  balancing and auto scaling. Our first two deploys failed while those were
  being created; later deploys are not affected.
- The alarm sends to an SNS topic when it fires and when it recovers. The
  topic emails the address in the ALARM_EMAIL repository secret, kept out of
  the public repo; without the secret the alarm only shows in the console.
  AWS asks the address to confirm the subscription once.

## Correction (2026-10-27)

This record said Express Mode deploys blue/green. The live service shows a
canary (`aws ecs describe-services`, 2026-10-26): `strategy: CANARY`,
`canaryPercent: 5`, `canaryBakeTimeInMinutes: 3`, `bakeTimeInMinutes: 3`, a
deployment circuit breaker with rollback, and the alarm
`default/ise-quiz-drill/RollbackAlarm`. A deploy starts the new tasks in the
second target group, sends them 5% of traffic for three minutes, rolls back by
itself if 4xx plus 5xx go over 1%, then moves 100% and keeps the old tasks for
three more minutes. It still uses two target groups, so the alarm decision
above stands.
