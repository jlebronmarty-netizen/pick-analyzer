# SportsDataIO MLB Data Maximization Budget Fix And Controlled Extraction

Date: 2026-07-21

Status: `MLB_DATA_MAXIMIZATION_BLOCKED`

## Result

The provider budget precheck defect was repaired and validated. Controlled MLB extraction did not pass because the pilot `PlayerGameStatsByDate/2026-JUL-17` calls timed out before provider rows were fetched. The run stopped after the timeout evidence and no additional extraction domains or BSN acquisition work were started.

## Budget Fix

Root cause:

- `operating_day_lifecycle_events` accounting reads threw an unhandled error when Supabase transport was unavailable, causing read-only budget status to return HTTP 500.
- `sports_sync_jobs` already degraded to a warning, but lifecycle accounting did not.
- Live MLB historical import execution did not call the shared provider budget guard before provider transport.

Fix:

- Read-only budget status now degrades to a typed warning instead of throwing.
- Missing usage rows resolve to zero usage.
- Malformed numeric environment values produce typed `MALFORMED_DEFAULTED` configuration state with safe defaults or valid aliases.
- Read-only budget status makes zero provider calls.
- Paid/live extraction fails closed when accounting is uncertain.
- MLB Discovery historical import now checks the shared provider budget guard before the one provider call it is allowed to execute.
- Recent failed/partial/running checkpoints enter a retry cool-down blocked state so immediate reruns do not burn another provider call after timeout/failure evidence.

Validation:

- `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb&includeValidation=true`
- `accountingStatus`: `AVAILABLE`
- `configurationStatus`: `VALID`
- `callsMadeToday`: 5 before pilot
- `callsMadeLastHour`: 0 before pilot
- `estimatedCallsRemaining`: 1345
- `hourlyRemaining`: 12
- validation: 14/14 PASS
- provider calls by read-only status: 0

## Verified MLB Domains

Verified entitlement from the previous safe discovery pass:

- Current season metadata
- Teams
- GamesByDate schedule/results/starters/weather
- Standings
- Players
- Player game stats by date
- Team season stats
- GameOddsByDate current odds

No unverified MLB products were used.

## Controlled Pilot

Pilot scope:

- Date: `2026-07-17`
- Domain: `player_game_stats_by_date`
- Endpoint: `/api/mlb/fantasy/json/PlayerGameStatsByDate/2026-JUL-17`
- Maximum requests per execution: 1
- Current season only
- Existing protected historical import route
- Existing provider budget guard
- Existing `sports_sync_jobs` checkpoint ledger

Outcome:

- First pilot call consumed 1 external SportsDataIO call.
- Endpoint timed out after 20 seconds.
- Checkpoint persisted as `failed`.
- Rows fetched: 0
- Rows inserted: 0
- Rows updated: 0
- Rows skipped: 0
- Last error: `This operation was aborted`

The intended idempotency rerun was attempted after the failed pilot and consumed one additional call because failed checkpoints were previously immediately resumable. This revealed and justified the retry-cooldown hardening. After the code fix, a subsequent retry verification kept provider usage unchanged at 7 calls today and 2 last hour.

## Existing Storage Evidence

The current repository already has successful MLB Discovery historical import evidence in `sports_sync_jobs`, including:

- Completed `game_odds_by_date` import for `2026-07-03`: 13 provider records, 78 normalized rows, 78 inserted.
- Completed `team_game_stats_by_date` import for `2026-07-04`: 30 provider records, 30 normalized rows, 30 inserted.
- Completed current-day prospective odds capture for `2026-07-20`: 15 provider records, 90 inserted odds snapshots.

The failed pilot did not add player-game-stat data.

## Backfill Plan

Full-season execution remains blocked until timeout behavior is resolved and a small pilot completes.

Recommended current-season plan after timeout resolution:

- Schedule/results/starters/weather: use existing verified GamesByDate path only when live persistence is implemented for the historical domain.
- Player game stats: most recent missing completed date first, one date per request, one call per date.
- Team game stats: one completed date per request, one call per date.
- Odds snapshots: one completed or current date per request only where historical date access returns valid data.
- Standings: season endpoint, one call, refresh periodically rather than daily.
- Teams/players/static metadata: refresh periodically only, not per date.

Batching:

- Keep production reserve first.
- Use one-call pilot batches until the timeout root cause is fixed.
- Stop on 401, 403, 429, billing warning, timeout, schema mismatch, duplicate explosion or budget warning.

## Certification

Budget validation: PASS

Pilot import: FAIL

Idempotency: PARTIAL. The failure rerun exposed an immediate retry issue; the retry-cooldown fix now prevents another call while the failed checkpoint is recent.

Operations validation: PASS

Build: PASS

Final certification: `MLB_DATA_MAXIMIZATION_BLOCKED`

