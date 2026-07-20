# MLB Slate Recovery & Lifecycle Truth Repair V1

Date: 2026-07-19

## Root Cause

The Today aggregator treated slate existence and raw stored `start_time` filtering as the same thing. MLB rows can require canonical read-time timestamp normalization, and stale provider status can make games ineligible for betting without making them invalid slate members. When the strict raw-date query or optional dependency path returned no cards, User Mode displayed a safe-looking empty slate.

## Repair

- `dashboard-today.service` now reads a widened raw `sport_events` window and filters by canonical America/Puerto_Rico operating date after MLB time normalization.
- Current-day events remain visible when lifecycle certainty is stale or unconfirmed.
- Lifecycle counts are returned separately: total scheduled today, upcoming, live, final, postponed, canceled, suspended, status unconfirmed, betting eligible, betting locked and missing market.
- Game cards expose `statusFresh`, `statusReason`, lifecycle and separate `bettingEligibility`.
- User Mode no longer says “No games to show” as a safe empty success when the slate query is degraded or filtered.
- Passed-start stale games display `Status update overdue`, `Awaiting provider confirmation` and `Betting locked`.
- Future stale games remain visible as `Scheduled` with `Data Aging`.
- Optional Most Likely, Best Value and AI explanation failures remain partial-section failures and do not remove the slate.
- Operations health reports MLB status refresh evidence. If status refresh is due but no protected MLB Stats API status check ran, it reports `MISSED_REFRESH` with zero provider calls from the read-only health request.

## Guardrails

- Page load provider calls: 0
- Page load remote mutations: 0
- Prediction formulas changed: false
- Projection formulas changed: false
- Official thresholds changed: false
- Champion rows mutated: false
- V7 promoted: false
- Settlement or learning changed: false
- Unsupported markets activated: false

## Validation

Deterministic validation now covers:

- Sixteen stored current-day games with stale status remain visible.
- Passed-start stale games become `STATUS_UNCONFIRMED`.
- `STATUS_UNCONFIRMED` games are betting locked.
- Future stale games remain scheduled but data-aging.
- Live, final and postponed games show their authoritative lifecycle.
- Current-day counts remain accurate.
- Optional intelligence failures do not remove games.
- Provider status failure returns a partial/degraded contract.
- Page load remains read-only and zero-provider-call.

`npm.cmd run build` completed with exit code 0 after the repair.

## Production Requirement

Deployment and production smoke validation are still required. Validate `/dashboard`, `/api/dashboard?mode=today`, `/api/current-board`, `/api/operations/health`, `/api/operations/status`, `/api/mlb/temporal-health` and `/api/operations/adaptive-refresh` after deployment.
