# MLB Daily Operations V1

Status: Day 1 prospective loop is ready but disabled. These commands are local operator commands and must not include secret values in docs.

## Setup

Start the app locally, then use the existing `CRON_SECRET` from the environment:

```powershell
$baseUrl = "http://localhost:3000"
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
```

If `CRON_SECRET` is not configured, protected routes may allow local execution, but production-like validation should use the header.

## Dry Run

```powershell
Invoke-RestMethod -Headers $headers "$baseUrl/api/cron/daily-sync?version=2&dryRun=true&providerCallBudget=0&timeoutMs=15000"
```

Expected: 0 provider calls, MLB Day 1 readiness packet present, workflow disabled pending explicit activation.

## Morning Sync

Do not run live provider calls until Day 1 is explicitly approved. The planned provider action is one date-wide `GamesByDate/{date}` call, followed by local mapping validation.

## Pregame Odds Capture

Planned windows:

- initial odds capture
- midday odds capture
- pregame odds capture
- optional event-aware final capture

Each planned capture uses one date-wide `GameOddsByDate/{date}` call. Do not poll every game separately. Preserve every timestamped snapshot.

## Prediction Generation

Use existing Feature Store route actions only after odds are captured and mapping validation passes. Keep:

- `trial=false`
- `scrambled=false`
- `production_eligible=false`
- public recommendations disabled
- model training disabled

Dry-run shape:

```powershell
Invoke-RestMethod -Method Post -ContentType "application/json" -Body '{"action":"historical_feature_snapshot_write_pilot","dryRun":true,"confirmed":false,"sportKey":"baseball_mlb","leagueKey":"mlb","maximumEvents":15,"maximumMarketsPerEvent":3,"maximumSnapshots":45}' "$baseUrl/api/features/store"
```

## Postgame Results And Stats

After all games are final, the planned provider steps are:

- `GamesByDate/{date}` for final status/results
- `TeamGameStatsByDate/{date}`
- `PlayerGameStatsByDate/{date}`

Do not use postgame stats in pregame feature snapshots.

## Settlement And Report

Settlement uses linked quarantined predictions and persisted final scores only. Daily reporting is available through the existing route:

```powershell
Invoke-RestMethod "$baseUrl/api/daily-report"
```

The `mlbValidation` section is technical validation only. Public top-pick sections remain filtered to `production_eligible=true`.

## Resume After Interruption

Dry-run resume check:

```powershell
Invoke-RestMethod -Headers $headers "$baseUrl/api/cron/daily-sync?version=2&dryRun=true&providerCallBudget=0&resumeFromStep=mlb_personal_initial_odds_capture&timeoutMs=15000"
```

Before repeating a live provider step, inspect completed sync-job scopes and deterministic persisted IDs. Reuse completed checkpoints where possible; do not duplicate completed provider calls or persistence.

## First-Week Monitoring

- Provider call count versus budget.
- HTTP status and transport failures.
- Sync job status, partial jobs and stale locks.
- Event/team/player/odds mapping conflicts.
- Odds timestamp coverage before each event cutoff.
- Snapshot/prediction duplicate counts.
- Settlement unresolved rows.
- Production gate violations.
- Daily report `mlbValidation` completeness.
- Cost per scheduled game and cost per settled technical prediction.

