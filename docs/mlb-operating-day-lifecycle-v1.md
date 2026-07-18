# MLB Operating Day Lifecycle V1

## Purpose

MLB Operating Day Lifecycle V1 makes the daily workflow deterministic, scoped and auditable:

Morning Sync -> Midday Refresh -> Final Pregame Refresh -> Recommendation Lock -> Game -> Result Sync -> Settlement -> Replay -> Calibration -> Adaptive Learning -> Daily Report.

The lifecycle preserves the strict distinction between observed candidates, prospective predictions, qualified recommendations, official picks and hypothetical outcomes. A rejected candidate can be replayed after the game, but it never becomes an official pick retroactively.

## Persistence

Migration: `supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql`.

Tables:

- `operating_days`: one row per sport/league/local date with stage timestamps, status, provider-call totals and error state.
- `operating_day_events`: event membership for the operating day.
- `operating_day_lifecycle_events`: audit log for each action, provider calls, writes, warnings and blocking reason.
- `operating_day_recommendation_locks`: frozen candidate/recommendation state at lock.
- `operating_day_reports`: stored replay/daily report summaries.

Existing tables extended additively:

- `sports_odds_snapshots`: optional `operating_day_id`, `provider_timestamp`, `odds_classification`.
- `prediction_history`: optional `operating_day_id`, lock status fields and `odds_snapshot_id`.

## Routes

- `POST /api/operating-day/execute`: protected write orchestrator.
- `GET /api/operating-day/status?date=YYYY-MM-DD&sportKey=baseball_mlb`: read-only lifecycle status.
- `POST /api/operating-day/[operatingDayId]/settle`: scoped settlement by operating day.
- `GET /api/operating-day/validation`: deterministic local validation fixture.

`POST /api/operating-day/execute` also supports `action="reconcile_preview"` for the first historical operating-day preview. It is read-only, makes zero provider calls, does not settle, does not fabricate final scores and identifies the persisted prospective event/candidates that can be linked safely in a later confirmed reconciliation.

Legacy-compatible improvements:

- `/api/historical-import/execute` passes `operatingDayId` into `sportsdataio_mlb_prospective_preview_v1`.
- `/api/results/sync` now reports structured `synced`, `already_synced`, `quota_blocked`, `provider_error`, `no_results` and `partial` statuses.

## Final Pregame Refresh

When `operatingDayFinalRefresh=true`, the MLB prospective preview service now:

- resolves persisted prospective events for the selected date first;
- skips `GamesByDate` rediscovery;
- uses `GameOddsByDate/{date}` only when eligible pregame events have not started;
- returns `locked_or_started` with zero planned odds calls if the game is already locked or started;
- stores pregame odds classification and operating-day lineage;
- regenerates prospective preview rows only from valid pregame snapshots.

Dry-run makes zero provider calls.

## Recommendation Lock

The lock action freezes all evaluated candidates with:

- model probability, book probability, edge, EV, confidence, line and odds;
- readiness state and eligibility status;
- official-pick boolean;
- rejection reasons;
- source odds snapshot;
- model and policy version metadata.

NO BET is an explicit valid locked decision when official picks are zero.

## Result Sync

The Odds API quota rejection is no longer represented as successful sync. Known quota/provider conditions return structured status, provider call count, retryability and retry-after when available. No result is fabricated, and settlement must remain pending without an authoritative final result.

SportsDataIO MLB final-score fallback remains a capability investigation item. The catalog includes MLB `GamesByDateFinal` in the enterprise family, but this implementation does not assume current entitlement or call it.

## Scoped Settlement

Operating-day settlement loads predictions by `operating_day_id` and falls back to sport/date for pre-migration rows. It grades:

- moneyline;
- run line/spread;
- total;
- pushes.

It only settles predictions with authoritative stored `game_results`, is idempotent for already-settled rows, and separates `officialSettled` from `hypotheticalSettled` in `settlement_details`.

## Replay And Reports

Replay reports show locked candidate inputs, final result when available, hypothetical outcome/profit, official-pick boolean, rejection reason and whether avoiding the bet aligned with policy. Decision quality remains separate from outcome quality.

For 2026-07-16, official picks must remain 0 and official performance must remain 0-0.

## Provider Budget

Every operating-day action reports planned and actual provider calls. Retrying completed or dry-run actions should use zero calls unless a future force-refresh path is explicitly approved.

`prepare_next_slate` now uses `/api/providers/budget/status` and a local action lock before real SportsDataIO transport. The approved 2026-07-17 run and follow-up odds-coverage reconciliation linked 15 events, mapped 15/15 odds records, generated 45 prospective predictions, surfaced 21 Current Board actionable candidates after filtering and left official picks at 0.

## Status Game Counts

Operating-day status counts read `sport_events.start_time`, not `created_at`, `updated_at`, provider mappings or Current Board rows. For `selectedDate=2026-07-16` and `timezone=America/Puerto_Rico`, the status query uses UTC interval `2026-07-16T04:00:00.000Z` through `2026-07-17T04:00:00.000Z` exclusive.

Returned game fields:

- `total`: unique scoped `sport_events.id` rows.
- `scheduled`: `scheduled`, `pending`, `planned` or empty provider status.
- `inProgress`: `live`, `in_progress`, `inprogress` or `started`.
- `pendingOrInProgress`: `scheduled + inProgress`.
- `final`: `final`, `completed`, `closed` or `complete`.
- `postponed`: `postponed`, `suspended` or `delayed`.
- `canceled`: `cancelled` or `canceled`.
- `unresolved`: any other stored provider status.

When `operatingDayId` exists, counts are further constrained to linked `operating_day_events`. When no operating-day row exists, status remains read-only, returns `operatingDayExists=false`, reports date-scoped event counts only, and does not silently mix global game counts.

## Commands

Dry-run reconciliation for 2026-07-16:

```bash
curl -X POST http://localhost:3000/api/operating-day/execute -H "Content-Type: application/json" -d "{\"action\":\"status\",\"sportKey\":\"baseball_mlb\",\"leagueKey\":\"mlb\",\"selectedDate\":\"2026-07-16\",\"dryRun\":true}"
```

Future final pregame refresh:

```bash
curl -X POST http://localhost:3000/api/operating-day/execute -H "Content-Type: application/json" -H "Authorization: Bearer $CRON_SECRET" -d "{\"action\":\"final_refresh\",\"sportKey\":\"baseball_mlb\",\"leagueKey\":\"mlb\",\"selectedDate\":\"2026-07-16\",\"confirmed\":true,\"dryRun\":false,\"maximumRequests\":1,\"timeoutMs\":15000}"
```

Scoped postgame settlement:

```bash
curl -X POST http://localhost:3000/api/operating-day/OPERATING_DAY_ID/settle -H "Content-Type: application/json" -H "Authorization: Bearer $CRON_SECRET" -d "{\"selectedDate\":\"2026-07-16\",\"sportKey\":\"baseball_mlb\",\"dryRun\":false,\"prospectiveOnly\":true}"
```

## 2026-07-16 Incident Findings

- Official platform decision was correct: 0 official picks, 0 Top Picks, NO TICKET, NO OFFICIAL BET.
- Final refresh previously depended on `GamesByDate` rediscovery. It now uses persisted prospective events first.
- Result sync previously surfaced quota payloads as API success. It now returns `quota_blocked`.
- Generic `/api/predictions/settle` remains broad/historical. Operating-day settlement is scoped through the new route.
- Hypothetical candidate wins must never become official wins.
