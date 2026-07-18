# MLB Automatic Operating Day V1

## Status

Scheduler-ready architecture is implemented. Automatic refresh is configured through one Vercel Hobby-compatible cron entry:

`/api/cron/operating-day`

Current `vercel.json` uses one daily cron:

`0 12 * * *`

That is approximately 8:00 AM in America/Puerto_Rico. Vercel Hobby does not provide the midday, afternoon or pregame cron cadence directly.

Additional intraday refresh readiness lives in `.github/workflows/operating-day-refresh.yml`. Configure repository secrets `PICK_ANALYZER_BASE_URL` and `PICK_ANALYZER_CRON_SECRET`, then use the scheduled workflow or `workflow_dispatch`.

## Routes

- `GET /api/operating-day/automation/status`
- `GET/POST /api/cron/operating-day`

The cron route is authenticated by `CRON_SECRET` and defaults to dry-run unless `dryRun=false` is supplied.

## Stage Selection

America/Puerto_Rico local time drives the default stage:

- night-before preparation: `prepare_next_slate`
- morning refresh: `morning_sync`
- midday refresh: `midday_refresh`
- afternoon refresh: `midday_refresh`
- pregame/lock window: `final_refresh`

If the next slate is still waiting for odds or predictions, the scheduler selects `prepare_next_slate`.

## Safety

- Actions are idempotent through existing checkpoints.
- Provider budget is checked before live preparation.
- Pregame odds refresh is blocked after start/lock by the underlying operating-day and prospective-preview services.
- Result sync, settlement, replay and calibration remain separate lifecycle actions.

## Manual Fallback Commands

Dry-run scheduler:

```powershell
Invoke-RestMethod "$baseUrl/api/cron/operating-day" -Headers $headers
```

Execute due action:

```powershell
Invoke-RestMethod "$baseUrl/api/cron/operating-day?dryRun=false" -Method POST -Headers $headers
```
