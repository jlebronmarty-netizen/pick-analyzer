# Release 13B Live Slate Audit

Status: IMPLEMENTED

## Root Cause

The Betting Decision Workspace loaded `/api/current-board?mode=current&limit=100`. When that route returned zero candidates, the component fell back to `/api/current-board?mode=all_stored_data&limit=100` and rendered those rows as active betting cards.

Production evidence before the fix:

- `mode=current`: 0 candidates.
- `mode=all_stored_data`: 100 candidates.
- `all_stored_data` rows were `boardLabel: HISTORICAL`.
- The workspace classification fallback mapped non-official, non-value, non-blocked rows into `RESEARCH_ONLY`, producing about 100 Research cards.

## Source Path

- UI: `src/components/market-opportunities/BettingDecisionWorkspace.tsx`
- Active source API: `/api/current-board?mode=current&limit=100`
- Historical source API: `/api/current-board?mode=all_stored_data&limit=100`
- Source service: `src/services/current-board.service.ts`
- Source table: `prediction_history`
- Rendering logic: board candidates map through `mapBoardCandidate`, then category grouping renders Board sections.

## Classification

Rows rendered before this release were historical snapshots, not confirmed current active betting opportunities. Some rows had scheduled-looking statuses, but their board label was historical and they came from the all-stored explorer endpoint.

## Repair

- Removed the active-board fallback from current board to all-stored data.
- Added canonical active filtering for current Puerto Rico operating-day pregame opportunities.
- Added one-card-per event/market/selection canonicalization.
- Moved all-stored snapshots into a separate read-only History view.
- Added empty-day messaging when no eligible pregame opportunities remain.

Prediction logic, probabilities, Official Picks, learning, settlement, scheduler and provider contracts were not changed.
