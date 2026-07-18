# MLB Live Data Refresh V1

## Scope

MLB Live Data Refresh V1 enables authenticated, confirmed `prepare_next_slate` execution for the existing SportsDataIO MLB Fantasy + Odds subscription. It reuses `sportsdataio-mlb-prospective-preview.service.ts`; no duplicate ingestion pipeline was added.

## Real Execution Gate

Real provider execution is allowed only when:

- `/api/operating-day/execute` authentication passes.
- `action=prepare_next_slate`.
- `sportKey=baseball_mlb`.
- `leagueKey=mlb`.
- `confirmed=true`.
- `dryRun=false`.
- provider budget permits the minimum required calls.
- the local same-process action lock can be claimed.

Dry-runs still make zero provider calls.

## Provider Budget

Budget status route:

`GET /api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb`

Configuration:

- `SPORTSDATAIO_DAILY_CALL_BUDGET`
- `SPORTSDATAIO_SOFT_RESERVE`
- `SPORTSDATAIO_MAX_CALLS_PER_ACTION`

Safe defaults are 100 daily calls, 25 reserved calls and 3 calls per action. The service estimates usage from operating-day lifecycle events and SportsDataIO checkpoint metadata.

## 2026-07-17 Preparation Result

Approved endpoints:

- `/api/mlb/odds/json/GamesByDate/2026-JUL-17`
- `/api/mlb/odds/json/GameOddsByDate/2026-07-17`
- `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/2026-JUL-17`

The first real attempt reached provider execution and persisted usable mapped odds, then stopped on unresolved provider event mappings. The root cause was date scoping: event repair loaded a UTC calendar day instead of the America/Puerto_Rico operating-day interval, so late local games after midnight UTC could not resolve. The service now loads `2026-07-17T04:00:00.000Z` through `2026-07-18T04:00:00.000Z` for local `2026-07-17` and does not reuse partial odds checkpoints as complete coverage.

The bounded repair made one additional `GameOddsByDate/2026-07-17` call because the old partial checkpoint did not retain a reusable raw provider payload. Schedule and projection checkpoints were reused.

Final stored-data state:

- 15 scheduled games.
- 15 linked operating-day events.
- 15 games with mapped pregame odds.
- 0 unresolved provider event IDs.
- 45 feature snapshots generated.
- 45 prospective predictions generated.
- 21 Current Board actionable candidates after price/freshness/supersession filtering.
- 2 positive-value previews.
- 0 official picks.

The result remains `NO BET` for official recommendations because production, calibration and recommendation gates are unchanged.

Critical model inputs remain partial: `PlayerGameProjectionStatsByDate/2026-JUL-17` returned HTTP 200 with 0 projection rows, and starting pitcher, lineup, injury and weather readiness are not satisfied by stored data.

## Failure Recovery

- Quota, subscription and provider errors are returned as structured operating-day statuses.
- Partial provider success is preserved through checkpoints.
- Unresolved odds mappings become warnings when mapped safe pregame odds are usable.
- `GET /api/mlb/odds/coverage?date=2026-07-17&includeValidation=true` is the zero-provider-call reconciliation check.
- Post-start odds remain rejected for pregame recommendation use.

## Manual PowerShell

```powershell
$baseUrl = "http://localhost:3000"
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
$body = @{
  action = "prepare_next_slate"
  sportKey = "baseball_mlb"
  leagueKey = "mlb"
  selectedDate = "2026-07-17"
  confirmed = $true
  dryRun = $false
  maximumRequests = 3
  timeoutMs = 15000
} | ConvertTo-Json
Invoke-RestMethod "$baseUrl/api/operating-day/execute" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```
