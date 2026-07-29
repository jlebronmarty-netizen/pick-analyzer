# Daily Continuity V1

Date: 2026-07-29

Status: COMPLETE

Daily continuity is stateless between ticks and stateful in storage. The next scheduler tick resumes from stored operating-day evidence instead of relying on local process memory.

## Recovery Cases

| Case | Recovery behavior |
| --- | --- |
| Computer restart | GitHub Actions continues independently; next tick reads stored lifecycle state. |
| Missed cron | Due-domain detection catches stale schedule, odds, results or settlement on the next tick. |
| Provider outage | Failure is reported as retryable; stale provider-backed data remains visible as stale. |
| Late final | Post-start flow keeps polling results and settles once canonical finals exist. |
| Network interruption | Provider action lock expires; deterministic upserts prevent duplicate work. |

## Lifecycle

Pregame: fresh odds, feature refresh, prediction refresh, Current Board read-through and AI Briefing read-through.

Postgame: result sync, settlement, derived learning evidence, Performance and AI Operations visibility.

Automatic model training remains disabled.
