# MLB-FINAL-00 Current Era Readiness

Status: REPAIR_READY_FOR_DEPLOYMENT

Date: 2026-08-11

Starting commit: `d264d7883834fadf255c2549aed233c0a04c18bf`

## Production Evidence

Read-only production evidence at `2026-08-11T23:40:02Z` showed:

- `/api/system/version`: HTTP 200, provider calls 0.
- Odds authority: `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT`, product authority `THE_ODDS_API`.
- MLB non-odds mode: MLB Official primary contract exposed.
- Current Board: 17 candidates, 7 Moneyline, 7 Run Line, 3 Total, all with valid probability, odds, edge, EV, freshness and feature snapshot evidence.
- Dashboard Today: 15 current games, 17 current candidates, 54 grounded model opportunities, 0 Official Picks.
- Lifecycle: 15 events, 8 `STARTED`, 1 `LOCK_WINDOW`, 4 `HIGH_PRIORITY`, 2 `ACTIVE_REFRESH`.
- SportsDataIO budget ledger: 0 calls today.
- Operations Health: `HEALTHY`.
- Settlement read: HTTP 200, no certification mutations.

Counts can change naturally as the slate progresses; the certified invariant is that the response contracts reconcile actionability and stored evidence without fabricating missing data.

## Root Cause

The evidence was not lost. Current Board intentionally excludes started, historical and stale rows from current actionability, while Dashboard Today retains grounded stored prediction evidence for review. The remaining product gap was that Rent Play and Moneyline fallback presentation could choose a weaker review row or label the fallback without the explicit `BEST_AVAILABLE_REVIEW_OPTION` contract.

## Repair

`HomeBettingPlan` now builds a shared `best_available_review_option_v1` candidate from existing plan candidates. It ranks by existing source priority and evidence completeness, requires useful stored evidence, and labels the result:

`BEST AVAILABLE REVIEW OPTION - NOT A RECOMMENDATION`

No threshold, probability, EV, Official Pick, provider, scheduler, settlement or learning logic changed.

## Refresh Decision

No bounded provider refresh was executed.

Reason:

- Current Board had fresh The Odds API product evidence.
- Current and grounded prediction evidence existed.
- SportsDataIO remained rollback-only with 0 routine MLB calls.
- The audit questions were answerable from stored/natural production evidence.

## Gate Audit Summary

Hard blockers for recommendations remain real:

- `PRODUCTION_GATE_BLOCKED`
- `QUARANTINED_ROW`
- `CALIBRATION_INSUFFICIENT`
- low confidence or low model probability where applicable
- non-positive edge/EV
- exact-line price unavailable for model-only grounded rows
- pregame/live lock for started events

Review-only evidence is still useful when probability, odds, edge, EV or feature lineage exists. The UI must not call that evidence a bet.

## Current Era Readiness

Current Era MLB is ready for final historical replay after the bounded presentation repair is deployed and certified because:

- The Odds API remains product odds authority.
- MLB Official remains primary non-odds source.
- SportsDataIO routine MLB calls remain 0.
- Current Board remains exact-line and fail-closed.
- Recommendation surfaces are semantically coherent.
- Settlement, learning and Performance remain isolated and stable.

