# MLB Next Slate Rollover V1

## Purpose

Next Slate Rollover V1 prevents a started or completed MLB slate from remaining on active betting surfaces. Historical rows remain available for replay, settlement, daily reports and operating-day audit, but active surfaces roll forward to the next valid future MLB slate.

## Active Event Rule

Shared service: `src/services/active-event.service.ts`.

An event is active only when:

- `sport_key` matches the requested sport.
- `league_key` matches when available.
- `start_time` is in the future.
- status is not final, live/in-progress, canceled, postponed, suspended or delayed.
- metadata is not historical-only.
- recommendations are not locked.

Final, live, started, canceled, postponed and suspended events are not active betting opportunities.

## Timezone

The resolver uses `America/Puerto_Rico`. Puerto Rico is UTC-4, so a local slate date maps to:

- local `2026-07-17`
- UTC start `2026-07-17T04:00:00.000Z`
- UTC end exclusive `2026-07-18T04:00:00.000Z`

Late-night UTC starts still belong to the intended Puerto Rico local date.

## Next Slate Resolver

Service: `src/services/next-slate.service.ts`.

Route: `GET /api/slate/next/status?sportKey=baseball_mlb`.

Behavior:

- Uses stored `sport_events` first.
- Looks from today through the next 7 days by default.
- Selects the earliest future local date with active MLB events.
- Does not call providers.
- Deduplicates by `sport_events.id`.
- Reports schedule, odds and prediction readiness per event.

Statuses:

- `ready_for_analysis`: stored active events have pregame odds and predictions.
- `waiting_for_odds`: schedule exists but odds are missing.
- `waiting_for_predictions`: odds exist but prediction rows are missing.
- `no_upcoming_games`: no active future MLB events were found in the search horizon.

## Current Board Rollover

Default Current Board no longer uses started or final rows as active opportunities. The MLB prospective preview endpoint also filters out old prospective rows whose game has already started. If the next slate exists but lacks odds/predictions, the UI says:

`Upcoming games found. Preparing odds and model analysis.`

or:

`Schedule ready. Refresh odds before recommendations.`

## Provider Budget

Read-only next-slate status and preview make zero provider calls. Authenticated, confirmed `prepare_next_slate` can execute real provider preparation when budget permits. Planned SportsDataIO endpoints for the selected next slate are returned explicitly.

The Odds API is not required for next-slate preparation. Existing SportsDataIO MLB endpoints are the planned source:

- `/api/mlb/odds/json/GamesByDate/{YYYY-MMM-DD}`
- `/api/mlb/odds/json/GameOddsByDate/{YYYY-MM-DD}`
- `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/{YYYY-MMM-DD}`

For example, `2026-07-17` plans `GamesByDate/2026-JUL-17`, `GameOddsByDate/2026-07-17` and `PlayerGameProjectionStatsByDate/2026-JUL-17`.

## Manual PowerShell Workflow

Set shared variables:

```powershell
$baseUrl = "http://localhost:3000"
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
```

Next slate status:

```powershell
Invoke-RestMethod "$baseUrl/api/slate/next/status?sportKey=baseball_mlb&includeValidation=true"
```

Next slate preview:

```powershell
$body = @{
  action = "next_slate_preview"
  sportKey = "baseball_mlb"
  leagueKey = "mlb"
  confirmed = $true
  dryRun = $true
  searchDays = 7
} | ConvertTo-Json
Invoke-RestMethod "$baseUrl/api/operating-day/execute" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Prepare next slate dry run:

```powershell
$body = @{
  action = "prepare_next_slate"
  sportKey = "baseball_mlb"
  leagueKey = "mlb"
  confirmed = $true
  dryRun = $true
  searchDays = 7
  maximumRequests = 3
} | ConvertTo-Json
Invoke-RestMethod "$baseUrl/api/operating-day/execute" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Prepare next slate real execution is intentionally not enabled by this rollover patch. Review the dry-run endpoint plan first, then approve a future provider execution patch or run the existing bounded SportsDataIO prospective preview executor.

Morning refresh:

```powershell
$body = @{
  action = "morning_sync"
  sportKey = "baseball_mlb"
  leagueKey = "mlb"
  selectedDate = "YYYY-MM-DD"
  confirmed = $true
  dryRun = $false
  maximumRequests = 3
  timeoutMs = 15000
} | ConvertTo-Json
Invoke-RestMethod "$baseUrl/api/operating-day/execute" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Midday refresh:

```powershell
$body = @{
  action = "midday_refresh"
  sportKey = "baseball_mlb"
  leagueKey = "mlb"
  selectedDate = "YYYY-MM-DD"
  confirmed = $true
  dryRun = $false
  maximumRequests = 3
  timeoutMs = 15000
} | ConvertTo-Json
Invoke-RestMethod "$baseUrl/api/operating-day/execute" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Final refresh:

```powershell
$body = @{
  action = "final_refresh"
  sportKey = "baseball_mlb"
  leagueKey = "mlb"
  selectedDate = "YYYY-MM-DD"
  confirmed = $true
  dryRun = $false
  maximumRequests = 1
  timeoutMs = 15000
} | ConvertTo-Json
Invoke-RestMethod "$baseUrl/api/operating-day/execute" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Recommendation lock:

```powershell
$body = @{
  action = "lock"
  sportKey = "baseball_mlb"
  leagueKey = "mlb"
  selectedDate = "YYYY-MM-DD"
  confirmed = $true
  dryRun = $false
} | ConvertTo-Json
Invoke-RestMethod "$baseUrl/api/operating-day/execute" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

## Failure Recovery

- If schedule exists but odds are missing, display `waiting_for_odds`.
- If odds exist but predictions are missing, display `waiting_for_predictions`.
- If no active games are found in seven days, display `no_upcoming_games`.
- Do not display the last completed board as a fallback.
- Do not fabricate odds or final scores.
- Do not weaken recommendation policy to force picks.
