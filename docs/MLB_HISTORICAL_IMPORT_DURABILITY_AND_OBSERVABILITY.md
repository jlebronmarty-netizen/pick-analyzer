# MLB Historical Import Job Durability And Observability

Date: 2026-07-21

## Result

PARTIAL pending deployment/application of the additive `sports_sync_jobs` terminal-status migration in production.

The MLB SportsDataIO historical executor now creates a durable `sports_sync_jobs` row before each live provider transport attempt for season schedule, season-wide and date-domain imports. The row begins as `running` with provider call accounting `NOT_ATTEMPTED`, advances to `ATTEMPTED` before transport, advances to `RESPONSE_RECEIVED` after an HTTP response is received, and is replaced by a terminal checkpoint on completion, partial persistence failure, provider timeout or fatal failure.

No provider retry, historical import, backfill or extraction was performed during this durability pass.

## Root Cause

The prior protected `PlayerGameStatsByDate` pilot could spend a provider request and still leave no new job row when the request outlived the server/client execution window. The durable checkpoint was written only after provider work completed or after the catch handler ran, and the catch checkpoint write was allowed to fail silently. That made some timeout states ambiguous and forced operators to compare budget ledgers manually.

## Lifecycle

Supported logical terminal states:

- `COMPLETED`
- `FAILED`
- `PARTIAL`
- `CANCELED`
- `TIMED_OUT`

Provider call accounting states:

- `NOT_ATTEMPTED`
- `ATTEMPTED`
- `RESPONSE_RECEIVED`
- `COMPLETED`
- `TIMED_OUT`
- `AMBIGUOUS`

`sports_sync_jobs.status` remains the durable storage field. Migration `202607210001_sports_sync_jobs_terminal_statuses.sql` extends the existing check constraint to allow `canceled` and `timed_out`.

## Checkpoint Guarantee

Before external provider work:

- Insert `sports_sync_jobs.status='running'`.
- Store endpoint, checkpoint key, season/date/domain, configured timeout and next unit.
- Store `providerCallAccounting.state='NOT_ATTEMPTED'`.

Before provider transport:

- Update the same row to `providerCallAccounting.state='ATTEMPTED'`.
- Conservatively count one provider call.

After provider response:

- Update the same row to `providerCallAccounting.state='RESPONSE_RECEIVED'`.
- Preserve sanitized endpoint metadata.

After persistence:

- Upsert the same row to `completed`, `partial`, `failed` or `timed_out`.

If terminal checkpoint update fails:

- Write a secondary checkpoint-failure row with the source job id and sanitized failure evidence.

## Reconciliation

`/api/historical-import/jobs` is still read-only. It now adds a reconciliation block per job:

- `stuck`
- `ageMs`
- `configuredTimeoutMs`
- `graceMs`
- `providerCallState`
- `conservativeBudgetCount`
- `recommendedTerminalStatus`
- `retryEligible=false`
- `action`

Stuck running jobs require manual reconciliation before retry. The endpoint does not retry, cancel or mutate jobs.

## Timeouts

The route exports `maxDuration = 300`, leaving platform margin above the executor default provider timeout of 60 seconds. The prior endpoint optimization proved `PlayerGameStatsByDate/2026-JUL-17` can take about 15 seconds for a 646 KB decoded payload, so 60 seconds is the current recommended provider timeout.

## Validation

Local production build:

- `npm.cmd run build`: PASS.

Fixture validation through `/api/operations/validation`:

- `sportsDataIoMlbImportDurability`: 11/11 PASS.
- `providerCallsMade=0`.
- `remoteMutationsMade=0`.

Read-only jobs smoke through `/api/historical-import/jobs`:

- jobs returned: 100
- failed: 3
- running: 0
- completed: 93
- partial: 4
- timedOut: 0
- canceled: 0
- stuck: 0
- reconciliationRequired: 0
- `externalProviderCallsMade=0`

Provider budget smoke:

- `callsMadeToday=7`
- `callsMadeLastHour=0`
- `accountingStatus=AVAILABLE`
- `configurationStatus=VALID`
- validation 14/14 PASS
- `providerCallsMade=0`

## Retry Plan

Do not retry historical import until:

1. The additive migration is applied in the target database.
2. `/api/operations/validation` still reports durability PASS.
3. `/api/historical-import/jobs` reports no stuck running jobs.
4. Provider budget remains available.
5. The retry is explicitly authorized.

