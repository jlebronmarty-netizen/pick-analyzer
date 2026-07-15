# MLB Live Validation Readiness V1

Status: ready but disabled. Provider calls for this readiness pass: 0.

Labels for every output:

- QUARANTINED REAL-DATA VALIDATION
- NOT A WAGERING RECOMMENDATION
- NOT PRODUCTION PERFORMANCE

## Existing Daily Loop Audit

- `/api/cron/daily-sync`: protected by `CRON_SECRET` when configured. Version 2 defaults to `dryRun=true`, enforces a provider-call budget, exposes checkpoint/resume/cancel metadata, carries the disabled MLB Day 1 readiness packet and makes 0 provider calls in acceptance mode.
- `/api/cron/master-sync`: protected by `CRON_SECRET` through bearer header or `secret` query parameter. It runs broader legacy sync, prediction capture, settlement, analytics and self-learning paths, so it is not the Day 1 MLB prospective activation surface.
- `daily-pipeline.service.ts`: contains the disabled MLB personal-plan capture schedule and the Day 1 prospective validation contract. It is the canonical zero-call readiness surface.
- Feature Store route actions: existing `/api/features/store` actions can dry-run or write bounded historical/prospective snapshots from persisted normalized records. They must remain capped and quarantined.
- MLB feature and prediction previews: existing `/api/mlb/features/*` and `/api/mlb/predictions/*` routes are zero-provider-call previews/validations and do not persist public picks.
- Settlement: existing settlement surfaces can grade linked predictions from persisted final results, but Day 1 settlement remains quarantined and technical.
- Daily report: existing `/api/daily-report` now includes an `mlbValidation` section for readiness/report fields while production pick sections continue to require `production_eligible=true`.
- Production Data Gate: production-facing outputs exclude quarantined rows and require explicit production eligibility.

## Day 1 Workflow

Pregame:

1. Resolve the Puerto Rico MLB date and season.
2. Fetch `GamesByDate`.
3. Refresh Teams/Players only if stale.
4. Derive availability from `Player.Status`.
5. Capture initial `GameOddsByDate`.
6. Capture midday `GameOddsByDate`.
7. Capture pregame `GameOddsByDate`.
8. Optionally capture a final date-wide snapshot before the earliest remaining first pitch.
9. Validate event/team/odds mappings.
10. Generate leakage-safe feature snapshots.
11. Generate quarantined predictions.
12. Write the pregame validation report.

Postgame:

13. Refresh `GamesByDate` results.
14. Fetch `TeamGameStatsByDate`.
15. Fetch `PlayerGameStatsByDate`.
16. Settle predictions.
17. Run data quality and production gate checks.
18. Update technical validation metrics.
19. Produce the next-day report.

## Cutoff Policy

For each event and market, select the latest persisted odds snapshot whose source timestamp is no later than the configured cutoff and strictly before first pitch. The default cutoff is 10 minutes before first pitch. Records exactly at first pitch or after first pitch are excluded. Missing timestamps block the candidate and lower sufficiency. Earlier snapshots are preserved and never overwritten.

## Capture Windows

Timezone: `America/Puerto_Rico`.

- Morning schedule sync: 08:30.
- Initial odds capture: 10:00.
- Midday odds capture: 13:00.
- Pregame odds capture: 15:30.
- Optional event-aware final capture: 10-15 minutes before the earliest not-yet-started game.
- Postgame settlement sync: next morning 07:30.

Do not rely on one universal final-capture time for every game. Capture date-wide odds at scheduled windows, then select the latest safe snapshot per game at feature time.

## Call Budget

- Minimum calls/day: 6.
- Typical calls/day: 8.
- Maximum planned calls/day: 12.
- Daily allowance: 1,000 calls.
- Typical usage: 0.8% of allowance.
- Maximum planned usage: 1.2% of allowance.

Budget components:

- `CurrentSeason`: 0 normally, 1 only when stale.
- `GamesByDate`: 1 pregame, 1 postgame.
- Teams/Players: 0 normally, 1-2 only when stale.
- `GameOddsByDate`: 3 normal windows, 4 with optional final capture.
- `PlayerGameProjectionStatsByDate`: 0 by default, 1 only if explicitly approved.
- `TeamGameStatsByDate`: 1 postgame.
- `PlayerGameStatsByDate`: 1 postgame.

When a budget threshold would be exceeded, stop before the next provider step and continue local validation/reporting where possible. `GameOddsLineMovement/{gameid}` is reserved for explicitly approved reconstruction, not normal prospective capture.

## Acceptance

The zero-provider-call acceptance surface is:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Headers $headers "http://localhost:3000/api/cron/daily-sync?version=2&dryRun=true&providerCallBudget=0&timeoutMs=15000"
```

Pass criteria:

- `mlbProspectiveValidationAcceptance.success=true`
- `externalProviderCallsMade=0`
- capture windows and call budget are present
- production quarantine gate is closed
- checkpoint/resume metadata is present
- public outputs exclude quarantined rows

## Live Day 1 Preflight

Do not execute until explicitly authorized.

- Date: resolved in Puerto Rico local time on execution day.
- Maximum planned calls: 12.
- Concurrency: 1.
- Retries: 0 unless separately approved.
- Endpoints: `CurrentSeason` only if stale, `GamesByDate/{date}`, `GameOddsByDate/{date}`, optional `PlayerGameProjectionStatsByDate/{date}`, postgame `GamesByDate/{date}`, `TeamGameStatsByDate/{date}`, `PlayerGameStatsByDate/{date}`.
- Persistence targets: normalized teams/players/events/stats/odds, durable feature snapshots, linked quarantined predictions, sync-job metadata and daily report metadata.
- Stop conditions: non-200 provider response, transport failure, exhausted budget, mapping ambiguity, duplicate persistence collision, or any production-gate violation.

