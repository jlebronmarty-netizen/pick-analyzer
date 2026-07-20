# Operations Runbook

Status: Implemented
Version: V1

## Read Health

```bash
GET https://pick-analyzer.vercel.app/api/operations/health
```

## Dry-Run Adaptive Refresh

```bash
GET https://pick-analyzer.vercel.app/api/operations/adaptive-refresh
```

## Execute Due Refreshes

```bash
POST https://pick-analyzer.vercel.app/api/operations/adaptive-refresh?dryRun=false
Authorization: Bearer <CRON_SECRET>
```

## Execute Consolidated Operating-Day Runtime

```bash
POST https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false
Authorization: Bearer <CRON_SECRET>
```

The consolidated runtime may select `status_refresh`, `prepare_next_slate`, `morning_sync`, `midday_refresh`, `final_refresh`, `sync_results`, `settle`, `replay`, `calibrate` or `complete` from stored operating-day state.

Expected status refresh evidence:

- Changed states: `status=SUCCESS_CHANGED`, `provider=mlb_stats_api`, `providerCheckCompleted=true`, `providerCallsMade=1`, `statusesChanged>0`.
- Checked unchanged states: `status=SUCCESS_NO_CHANGE`, `providerCheckCompleted=true`, `providerCallsMade=1`, `statusesChanged=0`.
- Partial row failure: `status=PARTIAL_MAPPING_FAILURE`, `providerCheckCompleted=true`, `mappingFailures` or `updateFailures` greater than 0, and valid rows still processed.
- Skipped due status work: `MISSED_REFRESH` or failed execution with `providerCheckCompleted=false` and exact `failureReason`.

`sport_events.status` accepts only `scheduled`, `live`, `completed`, `postponed` and `cancelled`. MLB Stats API statuses must pass through the canonical mapper; raw provider states belong in metadata, not the constrained status column.

Expected successful odds refresh evidence:

- Changed markets: `SUCCESS_CHANGED`, `providerBackedDue=true`, `providerChecked=true`, `providerCallsMade>0`, `oddsChangesDetected>0`.
- Checked unchanged markets: `SUCCESS_NO_CHANGE`, `providerBackedDue=true`, `providerChecked=true`, `providerCallsMade>0`, `oddsChangesDetected=0`.
- Missed required provider work: `MISSED_REFRESH`, `providerBackedDue=true`, `providerChecked=false`.

Expected MLB results sync evidence:

- Provider: `mlb_stats_api`.
- Endpoint: `/api/v1/schedule?sportId=1&startDate=...&endDate=...&hydrate=team,venue`.
- Provider check: `providerCheckRequired=true`, `providerCheckAttempted=true`, `providerCheckCompleted=true`.
- Result rows: `rowsReceived`, `gamesMatched`, `finalGamesDetected`, `scoreRowsInserted`, `scoreRowsUpdated`, `nonFinalRowsSkipped`, `staleRowsSkipped`, `unmatchedEvents`.

## Date Selection Evidence

Protected operating-day responses expose:

- `localCalendarDate`
- `operationalPrimaryDate`
- `recoveryCandidateDate`
- `recoveryWindowDays`
- `recoveryClassification`
- `activeOperatingDate`
- `activeSlateDate`
- `providerQueryDate`
- `nextSlateDate`
- `dateSelectionReason`
- `excludedStaleOrphanCount`
- `oldestUnresolvedDate`
- `unresolvedEventsByDate`

For `status_refresh` and `sync_results`, `providerQueryDate` may remain on an unresolved prior slate only inside the bounded recovery window. Older unresolved rows are classified as stale orphans and must not block the Puerto Rico local operating date. `prepare_next_slate` may use `nextSlateDate`.

## Runtime Blockers

- Full automatic runtime certification remains blocked until production deployment/smoke validation is completed. The authorized Vercel deploy was rejected by the execution environment during the activation mission.
- External intraday scheduler secrets and activation must be verified; the once-daily Vercel cron is not enough for MLB status/odds freshness.
- MLB `sync_results` is repaired locally to use MLB Stats API final result ingestion; production evidence is pending deployment.

## Guardrails

- Do not expose secrets.
- Do not execute broad provider discovery for decorative panels.
- Do not promote V7 or mutate champion rows.
- Do not change official thresholds.
- Verify `/api/operations/health` after execution.
- Do not repeat provider calls just to force a changed report; unchanged current markets are a valid successful result.
