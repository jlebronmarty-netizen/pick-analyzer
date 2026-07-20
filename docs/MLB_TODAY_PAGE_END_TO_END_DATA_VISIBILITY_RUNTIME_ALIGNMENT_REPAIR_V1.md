# MLB Today Page End-to-End Data Visibility & Runtime Alignment Repair V1

Date: 2026-07-20
Status: Implemented locally. Do not deploy from this document.

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

## Validation

- `npm.cmd run build`: PASS.
- `git diff --check`: PASS.
- `/api/dashboard/today?includeValidation=true`: deterministic fixture validation PASS, provider calls 0, remote mutations 0.
- `/api/operations/adaptive-refresh`: dry run selected date `2026-07-20`, provider calls 0, remote mutations 0.
- `/api/operating-day/validation`: PASS, provider calls 0.
- `/api/operations/validation`: PASS, provider calls 0, remote mutations 0.

## Local Runtime Evidence

The local sandbox could not complete remote Supabase-backed Today reads before the bounded current-events timeout. The route returned a truthful degraded state rather than fabricating slate rows:

- `operatingDate`: `2026-07-20`
- `dashboardQueryStatus`: `QUERY_TIMEOUT`
- `providerCallsMade`: 0
- `remoteMutationsMade`: 0
- Validation checks: 27 passed, 0 failed
- Operating-date policy checks: 11 passed, 0 failed

This is not a provider failure and no provider-backed run was attempted. The remaining blocker is stored-data dependency latency/availability in the local execution environment or production validation, not a stale recovery date being selected for market work.

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
| Runtime visible slate | FAIL_LOCAL | Local stored-data reads timed out before returning current game rows. |

Final result: **PASS_LOCAL_WITH_RUNTIME_VISIBILITY_BLOCKER**.
