# Home Client-State & Card Mapping Reconciliation

Date: 2026-08-11

Classification: HOME_CLIENT_STATE_RECONCILIATION_REPAIR_READY_FOR_DEPLOYMENT

## Scope

This repair reconciles the rendered homepage client state after the MLB product evidence repair. It is a bounded UI/runtime mapping fix only.

It does not change prediction formulas, probabilities, Official Pick thresholds, recommendation policy, Kelly, settlement, learning, provider authority, Vercel configuration, SportsDataIO rollback behavior, The Odds API authority, or MLB data-source mode.

## Production Symptom

Production APIs exposed current-day evidence:

- 15 MLB games today.
- 38 to 39 current board candidates depending on normal scheduler timing.
- 15 games with displayable Current Board product market evidence.
- 0 Official Picks by existing policy.
- positive-EV evidence present, but no rows passing Official Pick policy.

The rendered homepage could still show:

- Predictions: 0
- Snapshot captured: Unavailable
- Rent Play: NO_GAMES
- Moneyline: NO_GAMES
- Smart Parlay: NO_GAMES
- Watchlist: NO_GAMES

That contradicted the same page's Decision Summary and Market Quality evidence.

## Root Cause

CLIENT_PLAN_IGNORED_CURRENT_BOARD

`HomeBettingPlan` fetched `/api/current-board`, but `pickPlan` and all card contracts were built only from the `/api/dashboard/today` selectors and sections. If the Today scalar fields or selector rows were stale, sparse, or zero, the header/card plan could ignore the separately loaded Current Board evidence.

The issue was not event discovery, prediction generation, odds provider authority, probability calculation, Official Pick policy, settlement, learning, or Performance aggregation.

## Repair

The homepage plan now accepts Current Board state:

```text
dashboard/today
current-board
        ↓
pickPlan(data, currentBoard)
        ↓
Rent Play / Moneyline / Smart Parlay / Watchlist / Daily Brief
```

Current Board rows are normalized into the same `PlanPick` contract when Today card selectors are sparse.

The Daily Brief now also uses current board evidence for:

- Predictions
- Value Candidates
- Snapshot captured

when older Today scalar fields are zero or missing.

## Recommendation Safety

Current Board rows are product evidence, not automatic recommendations.

Non-official Current Board rows carry a policy-blocked reason unless existing evidence says they are eligible. That keeps:

- Rent Play fail-closed.
- Moneyline fail-closed.
- Smart Parlay legs review-only or policy-blocked.
- Watchlist evidence visible without promoting Official Picks.

No stale evidence is made actionable. No old-line probability is rebound to a new-line price. No synthetic edge or EV is created.

## Expected Product Outcome

When Current Board has current stored candidates, the homepage must not render card-level `NO_GAMES` states solely because `/api/dashboard/today` card selector rows are sparse.

Expected post-repair behavior:

- Games Today matches canonical current-day evidence.
- Predictions reflects current stored board or Today candidate evidence instead of remaining zero.
- Value Candidates reflects positive current board evidence separately from Official Pick eligibility.
- Snapshot captured falls back to Current Board freshness evidence.
- Cards show candidate/review/policy-blocked states rather than false no-games states.

## Protected Invariants

- Prediction formula changed: no
- Probability changed: no
- Official Pick policy changed: no
- Recommendation thresholds changed: no
- Settlement changed: no
- Learning changed: no
- Provider authority changed: no
- MLB data-source mode changed: no
- SportsDataIO rollback behavior changed: no
- Provider calls added: no
- Production database mutations during certification: no

## Validation

Validator: `scripts/home-client-state-card-mapping-validate.mjs`

The validator proves:

- `pickPlan` consumes Current Board client state.
- Current Board rows feed card contracts.
- zero Today scalar fields cannot hide current board candidates.
- non-official Current Board candidates remain policy-blocked/review-only.
- Snapshot captured has Current Board freshness fallback.
- provider credential and authority config are untouched.
