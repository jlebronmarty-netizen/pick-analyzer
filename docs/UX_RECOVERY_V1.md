# UX Recovery V1

Date: 2026-07-23

## Objective

Restore production user clarity after backend lifecycle expansion without changing prediction, settlement, market or learning behavior.

## Copy Rules

Primary user surfaces should explain dependencies in plain language:

- `No Market` -> `Waiting for sportsbook odds`
- `Pending` -> `Awaiting update`
- `Waiting` -> `Waiting for update` or `Odds pending`
- `Not Available` -> `Not available yet`

Technical lifecycle, settlement and diagnostic labels remain appropriate inside advanced details, developer panels and documentation.

## Recovered Surfaces

### Today Dashboard

- Today story now explains whether the blocker is sportsbook odds, Official Pick policy or value alignment.
- Market mood uses `ODDS PENDING` rather than a generic waiting label.
- Game cards display `Waiting for odds` where a market price is missing.
- Pipeline steps use explicit states such as `Waiting for odds`, `Awaiting board` and `Awaiting games`.

### Most Likely

- If safe Current Board rows are unavailable, stored model-only probabilities can still render as informational rows.
- Model-only rows are never Official Picks and never receive actionable EV or stake.
- The user sees probability intelligence instead of an empty waiting list when stored model output exists.

### Best Value

- Best Value remains gated by current market odds and positive EV.
- Empty states explain that value requires odds, while probability-only rows live under Most Likely/model-only intelligence.

### Performance

- Production trust is now calculated separately from V2 `Legacy`, `Ignored`, `Historical`, `Replay` and `Shadow` rows.
- Legacy/ignored rows remain visible in Prediction History and lifecycle timeline for auditability.
- Public copy states that production trust excludes non-production lifecycle families.

## Guardrails Preserved

- Official Pick policy unchanged.
- Prediction Engine probabilities unchanged.
- Learning Brain unchanged.
- Current Board eligibility unchanged.
- Provider calls unchanged.
- Historical and Feature Store assets preserved.

## Validation

Required validation is the production build plus stored-data route checks. Build status is recorded in `PROJECT_STATUS.md`.
