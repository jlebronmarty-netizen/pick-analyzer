# Pick Analyzer V1 Post-Release Operations

## Daily Operation

Monitor MLB core operation through Dashboard, Current Board, Operations, Data Coverage and Performance. Verify credentials, provider budget and scheduler health before relying on provider-backed refresh.

## Refresh Cadence

- More than 24 hours before start: 60 minutes.
- 2-24 hours before start: 15 minutes.
- Less than 2 hours before start: 5-10 minutes when budget allows.
- After start: stop pregame odds refresh.
- After final: result sync, settlement and Performance lifecycle.

## Health Checks

Use read-only routes first:

- `/api/system/version`
- `/api/operations/health`
- `/api/operations/mlb-autonomous-operations`
- `/api/operating-day/automation/status`
- `/api/data-coverage/health`
- `/api/performance`

Protected write routes require explicit operator authorization, correct secrets, provider budget checks and idempotency evidence.

## Recovery

Use the existing rollback and operations runbooks. Do not force settlement, fabricate results, activate unsupported markets, mutate model weights or promote epochs outside change control.

## Post-V1 Change Control

All sport expansion, market expansion, provider-credit consumption, SQL migrations, automatic model training, production mutations and manual deployment actions require separate approval.
