# System Health Policy V1

Date: 2026-07-29

Status: COMPLETE

System health is monitored by `/api/operations/health` and `/api/operations/mlb-autonomous-operations`.

## Signals

- Heartbeat: last protected scheduler success and scheduled observer checks.
- Refresh latency: due-domain status from adaptive refresh.
- Prediction latency: prediction freshness age.
- Provider latency: latest provider-check age.
- Queue health: due steps, settlement-ready rows and failed lifecycle rows.
- Failure detection: exact blockers from adaptive refresh and operations health.
- Retry: next scheduler tick after provider, budget or lock blockers clear.

## Scheduler Health

The write scheduler runs every 10 minutes. The heartbeat observer runs at minute 3 and 33 each hour without provider calls or mutations.

## Guardrails

Health reads do not call providers, mutate predictions, train models, change weights, change probabilities, alter settlement rules or change Official Pick policy.

No provider call, production mutation, model training, model-weight mutation, probability change, Trust change or settlement-rule change is performed by health status reads.
