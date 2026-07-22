# MLB Starter Refresh Scheduler

The starter refresh sequence is designed for existing protected scheduler execution.

## Cadence

- Morning slate discovery: one `GamesByDate` call when games exist
- Midday probable-starter refresh: one date-wide `GamesByDate` call
- Pregame confirmed refresh: one date-wide `GamesByDate` call near first pitch
- Started/final games: stop starter refresh

## Guardrails

- Read-only status calls make zero provider calls
- Provider refresh requires `CRON_SECRET`
- Provider refresh uses existing budget guard
- Provider refresh is capped to one bulk date call
- No automatic retry
- 401, 403, 429, timeout, schema mismatch or accounting uncertainty stops execution

## Handoff

Persisted `sport_lineups` starter evidence feeds `/api/mlb/learning-brain`. The Learning Brain only generates pitcher-outs shadows when the evidence is exact, fresh, pregame and tied to a pitcher with enough stored recorded-outs history.
