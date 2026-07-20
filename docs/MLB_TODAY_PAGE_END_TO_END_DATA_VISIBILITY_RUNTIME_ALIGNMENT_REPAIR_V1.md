# MLB Today Page End-to-End Data Visibility & Runtime Alignment Repair V1

Date: 2026-07-20
Status: Certified locally against real protected runtime evidence. Do not deploy from this document.

## Mission

Repair the Today page alignment between stored canonical MLB runtime data, adaptive operating-date selection and the user-visible `/dashboard` Today experience. This mission does not redesign the dashboard and does not modify EV, Kelly, confidence thresholds, Official Pick policy, model probabilities, calibration, champion state, settlement logic or provider budgets.

## Repairs

- Added canonical no-store route `/api/dashboard/today` and kept `/api/dashboard?mode=today` backward compatible.
- Marked `/dashboard` and `/api/dashboard` dynamic with `revalidate = 0` so the Today surface is not statically cached.
- Updated `UserTodayPanel` and `ProductTodayPanel` to fetch `/api/dashboard/today`.
- Added visible-page refresh on focus/visibility and a 60-second foreground interval so stored runtime changes can appear without a full manual reload.
- Made MLB operating-date resolution action-aware:
  - `status_refresh` and `sync_results` may select a bounded recovery slate.
  - `morning_sync`, `midday_refresh`, `final_refresh`, `odds_refresh`, prediction, recommendation and Current Board refresh actions prefer the current or next actionable slate and cannot be stolen by a stale recovery date.
- Updated Adaptive Refresh status to report the current actionable slate date while separately exposing status-recovery date evidence.
- Updated Adaptive Refresh execution to recompute the selected date from the actual action before locking or delegating to the existing operating-day pipeline.
- Changed the Today fallback slate loader to use the same widened canonical Puerto Rico date filtering as the primary slate query.
- Prevented stale fallback reads from extending a timeout path after the primary current-events read already exceeded its budget.
- Treated Current Board, next slate and optional intelligence failures as partial/optional for Today visibility; `current_events` remains the critical game-visibility dependency.
- Repaired legacy SportsDataIO MLB read-time start normalization so already-correct MLB Stats-backed UTC instants are not shifted into the next Puerto Rico operating date. `rawFieldNames: ["DateTime"]` is schema evidence only; read-time legacy repair now requires explicit raw provider time or temporal metadata that proves Eastern-local interpretation is required.
- Kept operating-day automation and adaptive refresh execution on the current actionable slate for status and odds work while exposing stale recovery selection as diagnostic evidence only.
- Made Today compose Most Likely, Best Value, AI Bet Finder and Top Opportunity directly from the stored Current Board read model. Standalone scanner routes remain available, but User Mode no longer waits on them during page load.

## Validation

- `npm.cmd run build`: PASS.
- `git diff --check`: PASS.
- Targeted ESLint on touched services: PASS.
- Full `npm.cmd run lint`: FAIL on pre-existing repository-wide lint backlog outside this repair, including `react/no-unescaped-entities`, `@typescript-eslint/no-explicit-any`, `react-hooks/set-state-in-effect`, unused variables and `prefer-const`.
- `/api/dashboard/today?includeValidation=true`: deterministic fixture validation PASS, provider calls 0, remote mutations 0.
- `/api/operations/adaptive-refresh`: dry run selected date `2026-07-20`, provider calls 0, remote mutations 0.
- `/api/operating-day/validation`: PASS, provider calls 0.
- `/api/operations/validation`: PASS, provider calls 0, remote mutations 0.

## Local Runtime Evidence

Protected runtime and stored-read validation on 2026-07-20 produced:

- `operatingDate`: `2026-07-20`
- `currentGames`: 15
- `upcomingGames`: 15
- `finalGames`: 0
- `statusUnconfirmed`: 0
- `gamesWaitingForOdds`: 0
- `gamesReadyForAnalysis`: 15
- `predictionCandidates`: 24
- `officialPicks`: 0
- `watchlist`: 14
- `avoid`: 10
- `latestOddsTimestamp`: `2026-07-20T12:35:09+00:00`
- `freshness`: `fresh`
- `currentGameCards`: 15
- `dashboardQueryStatus`: `AVAILABLE`
- `dashboardFallbackUsed`: false
- `mostLikely`: `AVAILABLE`, 10 rows
- `bestValue`: `EMPTY`, 0 rows, preserving positive-edge/positive-EV policy
- `aiBetFinder`: `AVAILABLE`, 5 rows from stored Current Board data
- `topOpportunity`: `AVAILABLE`
- `status`: `AVAILABLE`
- `timing.totalMs`: 1996
- `errors`: none
- `providerCallsMade`: 0
- `remoteMutationsMade`: 0
- Validation checks: 27 passed, 0 failed
- Operating-date policy checks: 11 passed, 0 failed

Provider-backed protected execution evidence:

- `status_refresh`: `SUCCESS_NO_CHANGE`, provider calls 1, remote mutations 28, rows received 15, rows updated 13, rows skipped 2, provider check attempted/completed true.
- `midday_refresh`: `SUCCESS_CHANGED`, provider calls 3, remote mutations 195, SportsDataIO endpoint `/api/mlb/odds/json/GameOddsByDate/2026-07-20`, rows received 15, changes detected 90, rows inserted 90, rows updated 0, rows skipped 0.
- `/api/slate/next/status`: `ready_for_analysis`, selected slate date `2026-07-20`, total games 15, ready for analysis 15, waiting for odds 0, active candidates 45, official picks 0.
- `/api/mlb/temporal-health?date=2026-07-20&includeValidation=true`: total games 15, legacy repair count 0, lifecycle distribution PREGAME 15, provider calls 0, remote mutations 0.

## Guardrails

- Provider calls added: 0.
- Remote mutations added: 0.
- Prediction formulas changed: no.
- Official Pick thresholds changed: no.
- Champion rows changed: no.
- V7 promotion changed: no.
- Settlement or learning formulas changed: no.
- Unsupported markets added: no.

## Certification

| Area | Result | Notes |
| --- | --- | --- |
| Canonical Today endpoint | PASS | `/api/dashboard/today` exists and is no-store/dynamic. |
| Dashboard source alignment | PASS | User and product Today panels fetch the canonical endpoint. |
| Page cache safety | PASS | `/dashboard` and dashboard API routes are dynamic/no-store. |
| Operating-date alignment | PASS | Adaptive dry run selected `2026-07-20`; market actions no longer select bounded stale recovery slates. |
| Status recovery preservation | PASS | Status/results actions may still use bounded recovery dates. |
| Optional-section isolation | PASS | Optional intelligence failures do not erase the Today route contract. |
| Runtime visible slate | PASS_LOCAL | Today read returns 15 current-day cards from canonical stored data. |
| Protected status refresh | PASS_LOCAL | Provider-backed MLB Stats API status check executed for `2026-07-20`. |
| Protected odds refresh | PASS_LOCAL | Provider-backed SportsDataIO odds check executed for `2026-07-20` and persisted 90 current snapshots. |
| Page-load safety | PASS_LOCAL | Today read made 0 provider calls and 0 remote mutations. |

Final result: **PASS_LOCAL_RUNTIME_VISIBLE_AND_AVAILABLE**. Production deployment remains pending explicit deployment action outside this no-deploy document.
