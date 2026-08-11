# MLB Recommendation Surface Contract V1

Status: READY_FOR_DEPLOYMENT

Date: 2026-08-11

Starting commit: `b50a6395733f32b544f412cc06370c7e4854e72a`

## Scope

This contract finalizes homepage recommendation semantics only. It does not change prediction formulas, probabilities, EV math, Official Pick thresholds, Kelly, HR-03 calibration status, provider authority, scheduler cadence, settlement, learning or database schema.

## Selection Versus Presentation

The homepage may select a strongest review-only candidate for explanation. That selection is not itself a recommendation.

Qualified recommendation surfaces:

- Rent Play
- Moneyline Bet
- Smart Parlay recommendation

Review surfaces:

- Best Available Review Option
- Best review-only Rent Play candidate
- Best review-only Moneyline candidate
- Smart Parlay builder
- Watchlist
- Value Signals

## Best Available Review Option

`BEST AVAILABLE REVIEW OPTION` is the strongest sufficiently evidenced review-only candidate selected from existing certified candidates and ranking signals. It is always labeled `NOT A RECOMMENDATION`, must not create a new scoring model, and must not promote a candidate into Rent Play, Moneyline Bet, Smart Parlay or Official Pick status.

The review option should prefer a candidate with probability, odds, implied probability, edge, EV and evidence time over an N/A-heavy candidate when such evidence exists. If no sufficiently evidenced candidate exists, the surface says so instead of filling with meaningless data.

## Gate States

Allowed gate states:

| State | Meaning | Blocks recommendation |
| --- | --- | --- |
| PASS | Required evidence is present and compliant. | no |
| FAIL | Required evidence is present and violates policy. | yes |
| NOT_AVAILABLE | Required evidence is missing. | yes |
| PENDING | Required evidence is unresolved, usually waiting for refresh. | yes |
| OPTIONAL | Evidence is useful but not required for this surface. | no |

Unavailable required evidence must never render as `PASS`.

## Rent Play

Rent Play is the safest currently actionable wager only after all required gates pass. A blocked or incomplete candidate can be shown as review-only, but the primary headline must say `No Qualified Rent Play`.

Required hard gates:

- candidate evidence
- sport certification
- market certification
- pregame eligibility
- model probability
- probability floor
- current odds
- market freshness
- confidence
- positive edge
- EV policy
- data quality
- policy blockers
- Official Pick/promotion status

Current behavior after repair:

- `NOT_AVAILABLE` required gates count as blocking.
- Missing market timestamp makes freshness non-actionable.
- Missing odds, edge or EV prevents Rent Play recommendation status.
- State-aware copy says `What Would Make This Eligible` for blocked/review-only candidates.

## Moneyline Bet

Moneyline Bet is a qualified Moneyline recommendation only when the Moneyline-specific hard gates pass. The strongest modeled or best review-only Moneyline can still be displayed, but not as a qualified bet.

Required hard gates:

- supported Moneyline market
- canonical current event
- pregame eligibility
- model win probability
- current Moneyline price
- canonical market timestamp
- market freshness
- confidence
- positive edge
- EV policy
- data quality
- policy blockers
- Official Pick/promotion status

Negative EV, missing model probability or policy blockers produce `No Qualified Moneyline Bet` with a review-only candidate when available.

## Complement Binding

`COMPLEMENT` means a production price was bound from the certified complementary sportsbook side while preserving exact event, market, selection and line identity. It is presentation evidence only and must not imply opposite-side probability reuse or cross-line price binding.

## Smart Parlay

Smart Parlay distinguishes:

- `BUILDER_AVAILABLE`: the user can browse eligible-looking legs.
- `NO_SAFE_COMBINATION`: no certified safe recommendation exists.
- `PARLAY_ACTIONABLE`: all selected-leg gates and direct-correlation checks pass.

Combined odds are price math only. Joint probability remains unavailable until a certified method exists. A clickable builder is not an actionable parlay recommendation.

## Watchlist

Watchlist is a monitoring and research layer. It can include review-only, missing-price, waiting-refresh, policy-blocked and near-threshold candidates when evidence is useful. Watchlist candidates are not recommendations.

Blocked candidates must not be labeled as overlapping with Rent Play or Moneyline unless those surfaces are actually `ACTIONABLE`.

## Value Signals

Homepage `Value Signals` means positive-EV evidence from stored Current Board/homepage candidates. It is not the same as:

- policy-qualified value
- recommendation-eligible value
- Official Pick

Positive EV alone does not imply a bet.

## Timestamp Taxonomy

| Label | Meaning |
| --- | --- |
| Analysis Snapshot | When stored analysis/candidate evidence was captured or updated. |
| Market Evidence Time | Provider/source market timestamp used for betting freshness. |
| Candidate Generated At | Prediction/candidate generation timestamp where exposed. |
| Observed At | Browser/runtime observation time; never market freshness. |
| Next Planned Refresh | Scheduler/planner's next expected refresh time. |

Do not fill missing market evidence with observed-at or analysis snapshot time.

## Regression Guarantees

This repair preserves:

- Most Likely ranking and math
- Best Value ranking and math
- Current Board query contract
- Performance denominators
- Settlement rules
- Learning policy
- Operations health semantics
- SportsDataIO zero routine MLB calls
- The Odds API product odds authority
- MLB Official primary non-odds source
