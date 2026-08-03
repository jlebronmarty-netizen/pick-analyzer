# MC-08C Moneyline Bet Experience

Status: `PRODUCTION_CERTIFIED`

MC-08C makes the homepage Moneyline Bet a typed, trustworthy presentation contract over existing stored Today evidence. It does not change prediction, ranking, provider, scheduler, settlement or learning behavior.

## Inventory Finding

Before MC-08C, the homepage Moneyline Bet was a generic `PickCard` populated by local `plan.moneyline` selection from `/api/dashboard/today` evidence. It filtered candidates whose displayed market included Moneyline and ranked them with existing exposed fields. The card did not expose a formal Moneyline contract, candidate universe, readiness gates, price-implied probability, rank inside the Moneyline universe, or clear relationships to Rent Play, Most Likely and Official Picks.

The canonical homepage source remains `/api/dashboard/today`, with `/api/current-board?mode=current&limit=100` used as secondary read-only evidence.

## Contract

Moneyline Bet now uses `moneyline_bet_v1` with:

- status and actionability;
- selected team or participant;
- event and supported Moneyline market evidence;
- current moneyline, implied probability and model probability;
- probability advantage, confidence, edge and EV;
- canonical market timestamp, market age and freshness;
- Official Pick, Rent Play, Most Likely and Best Value relationships;
- eligibility gates with `PASS`, `FAIL`, `PENDING` and `NOT_AVAILABLE`;
- candidate count, eligible count and rank within the Moneyline universe;
- selection reasons, comparison reasons, risks and what would change the decision.

Unknown values remain null, unavailable or `UNKNOWN`. They are not substituted with zero.

## Candidate Universe

The candidate universe is restricted to supported Moneyline evidence from existing Today candidates. It excludes run lines, spreads, totals, props, first-five, first-half and team-total markets.

Three-way Moneyline markets are not collapsed into binary semantics. If a market cannot be represented honestly by the current stored evidence, it remains review-only, unavailable or blocked instead of becoming actionable.

## Selection Policy

MC-08C uses deterministic existing evidence only:

1. Existing actionable Official Pick in the Moneyline market.
2. Existing actionable Moneyline candidate with the strongest current certified evidence.
3. Existing Moneyline candidate waiting only for fresh price.
4. Review-only Moneyline candidate.
5. No eligible Moneyline.

Tie-breaking uses existing surface priority and exposed fields only. MC-08C does not introduce a hidden composite Moneyline score.

## Safety

- Provider calls introduced: `0`.
- Provider credits consumed: `0`.
- Database mutations introduced: `0`.
- Prediction writes: `0`.
- Result writes: `0`.
- Settlement writes: `0`.
- Learning writes: `0`.
- Scheduler cadence changes: `0`.
- Refresh cadence changes: `0`.
- Official Pick changes: `0`.
- Rent Play changes: `0`.
- Most Likely ranking changes: `0`.
- Best Value ranking changes: `0`.

MC-08D was not started.

## Production Certification

Production certification passed on commit `b748b9f812afeaf7d8c96f561a480a49303a8cd4`.

- Homepage HTTP: `200`.
- Desktop render: `PASS`.
- Mobile render: `PASS`.
- Moneyline observed state: no current actionable Moneyline; desktop status `POLICY_BLOCKED`.
- Current selection: `ARI` in `ARI @ CLE` when stored desktop evidence was available.
- Candidate count: `3`.
- Eligible candidate count: `0`.
- Rank within Moneyline universe: `1`.
- Missing odds, implied probability, edge and EV render as unavailable, not zero.
- Moneyline appears after Rent Play and before Smart Parlay.
- Provider calls: `0`.
- Remote mutations: `0`.
- MC-08D was not started.

## Local Validation

- MC-08C validator: `PASS` 43/43.
- MC-08B validator: `PASS` 34/34.
- MC-08A validator: `PASS` 37/37.
- Mission Control validator: `PASS` 57/57.
- MC-02 validator: `PASS` 24/24.
- OE-003F validator: `PASS` 28/28.
- OE-003E validator: `PASS` 32/32.
- C1 product validator: `PASS` 31/31.
- B2/B3/B4/B5/B5.1/B6/B6.1 product validators: `PASS`.
- Route/artifact consistency: `PASS` 14/14.
- Unsupported-market policy lock: `PASS` 19/19.
- Scheduler health alignment: `PASS` 6/6.
- JSON validation: `PASS`.
- Markdown validation: `PASS`.
- Changed-file ESLint: `PASS`.
- Targeted secret scan: `PASS`.
- `git diff --check`: `PASS`.
- Build: `PASS` with 396 generated static pages.
