# MLB Recommendation Surface Semantics Finalization

Status: MLB_RECOMMENDATION_SURFACE_REPAIR_READY_FOR_DEPLOYMENT

Date: 2026-08-11

Starting commit: `b50a6395733f32b544f412cc06370c7e4854e72a`

## Summary

The homepage recommendation surfaces have been repaired so blocked or incomplete candidates are not visually promoted as approved primary bets.

Runtime scope is limited to `src/components/home/HomeBettingPlan.tsx`.

No prediction, probability, EV, Official Pick, provider authority, scheduler, settlement, learning or database behavior changed.

## Before

- Rent Play could display a policy-blocked candidate as the primary Rent Play card.
- Freshness unavailable could be excluded from recommendation gate blocking.
- Moneyline could show a blocked negative-EV review row under the primary `Moneyline Bet` framing.
- Smart Parlay could show builder usability and recommendation actionability as the same concept.
- Watchlist relationships could imply blocked candidates overlapped with primary recommendation surfaces.
- `Snapshot Captured` appeared across unrelated timestamp concepts.

## After

- Rent Play headline says `No Qualified Rent Play` unless all hard gates pass.
- Moneyline headline says `No Qualified Moneyline Bet` unless all hard gates pass.
- Review-only candidates remain visible in amber review panels.
- `NOT_AVAILABLE` required gates block recommendation actionability.
- Missing market timestamp makes freshness non-actionable.
- Smart Parlay displays `BUILDER_AVAILABLE` separately from recommendation status.
- Watchlist remains a research layer and only claims primary-surface overlap when that surface is actionable.
- Timestamp labels distinguish `Analysis Snapshot`, `Market Evidence Time`, `Observed At` and `Next Planned Refresh`.
- Blocker/risk copy is deduplicated and state-aware.

## Current Product Contract

| Surface | Qualified state | Review state |
| --- | --- | --- |
| Rent Play | `ACTIONABLE` | `NO_QUALIFIED_RENT_PLAY` plus review candidate |
| Moneyline | `ACTIONABLE` | `NO_QUALIFIED_MONEYLINE` plus review candidate |
| Smart Parlay | `PARLAY_ACTIONABLE` | `BUILDER_AVAILABLE` / `NO_SAFE_COMBINATION` |
| Watchlist | research layer only | research layer only |
| Value Signals | positive-EV evidence count | not a recommendation count |

## Production-Safe Post-Deploy Plan

After publish and deployment, verify read-only:

- `/`
- `/api/dashboard/today`
- `/api/current-board?mode=current&limit=200`
- `/api/market-opportunities/most-likely`
- `/api/market-opportunities/best-value`
- `/api/performance`
- `/api/operations/health`
- `/api/operations/settlement-guarantee?includeValidation=true`
- `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb`

Confirm rendered Home:

- blocked Rent Play does not render as qualified
- blocked Moneyline does not render as qualified
- Smart Parlay builder and recommendation status are distinct
- Watchlist items remain research-only where appropriate
- Value Signals are not Official Picks
- timestamp labels are distinct
