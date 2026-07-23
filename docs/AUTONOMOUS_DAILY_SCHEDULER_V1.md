# Autonomous Daily Scheduler V1

Status: audited through stored metadata.

## Jobs

Daily operations must report:

- odds refresh
- prediction generation
- Current Board build
- result synchronization
- settlement
- replay/label creation
- learning queue validation
- shadow learning
- production weight evaluation
- performance snapshot

Each job should expose enabled state, schedule, last attempt, last success, last failure, next expected run, processed count, mutation count and blocked reason where available.

## Today Odds Blocker

When Today has games but no odds snapshots, the system must report the blocker instead of generating predictions or calling providers. If a sportsbook refresh would require provider access, it remains a separate approved operation.
