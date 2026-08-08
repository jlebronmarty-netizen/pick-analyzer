# Production Pilot Incident PI-03: E2E Linkage Audit

Status: PASS WITH HIGH LINKAGE REPAIR PLAN

PI-03R repair status: complement-side price rebinding is implemented locally and awaiting production proof.

Date: 2026-08-08

Starting commit: `bf6db22c26d0b2ee5e251921aeb8ef90b153f1ac`

Production commit: `bf6db22c26d0b2ee5e251921aeb8ef90b153f1ac`

## Incident Scope

PI-03 investigated end-to-end linkage across:

`Vercel Cron -> Planner -> Provider -> Raw Data -> Normalization -> DB -> Features -> Prediction -> Price Binding -> Current Board -> Recommendation Layers -> UI -> Result -> Settlement -> Learning -> Performance`.

No provider calls, database mutations, prediction writes, result writes, settlement writes, or learning writes were performed by certification reads.

## Classification

`PI_03_PASS_WITH_HIGH_LINKAGE_REPAIR_PLAN`

## Key Finding

The system can show `Odds N/A` for complement-derived canonical outcomes even when the source-side market has a stored provider price. This is caused by Current Board complement display behavior:

- Source prediction side has odds.
- Product display flips to the binary complement when the complement has higher probability.
- Complement price is not rebound from `sports_odds_snapshots`.
- `canonicalPrice.status` becomes `NO_OPPOSITE_PRICE`.

Examples:

| Candidate | Event | Displayed side | Source side | Source price | Classification |
|---|---|---|---|---:|---|
| Run Line | `LAD @ ARI` | `ARI +1.5` | `LAD -1.5` | `+111` | `PRICE_EXISTS_DIFFERENT_SIDE` |
| Moneyline | `LAD @ ARI` | `ARI` | `LAD` | `-199` | `PRICE_EXISTS_DIFFERENT_SIDE` |
| Total | `TOR @ PHI` | `Under 10` | `Under 10` | `-117` | `IDENTITY_MATCH` |

## Safety Result

No CRITICAL safety defect was proven.

Product Freshness SLA reported all 36 current candidates as `STALE` and `WAIT_FOR_REFRESH` for actionability. Official Pick count was `0`; recommendation eligible count was `0`; actionable count was `0`.

## Production Counts

| Metric | Value |
---|---:|
| Current games | 15 |
| Current Board candidates | 36 |
| Official picks | 0 |
| Recommendation eligible | 0 |
| Actionable | 0 |
| Current Era canonical predictions | 234 |
| Current Era settled | 171 |
| Today canonical predictions | 45 |
| Today settled | 0 |
| Yesterday canonical predictions | 42 |
| Yesterday settled | 24 |
| Yesterday pending | 18 |
| Yesterday wins | 13 |
| Yesterday losses | 11 |
| Silent pending proven | 0 |

## Provider And Freshness Evidence

- Current Board latest snapshot timestamp: `2026-08-08T20:37:19.390Z`.
- Current Board latest provider source timestamp: `2026-08-08T16:37:01.000Z`.
- Event refresh plan showed stale source market evidence and due-now refresh plans.
- Certification reads made `0` provider calls.

## Immediate Repairs

None. This audit did not perform runtime repairs because the proven defect is HIGH linkage/UX-data completeness, not an immediate unsafe actionability defect.

## Required Next Repair

Implement a bounded complement-price rebinding repair for Current Board:

1. When `canonicalOutcome.complementDerived === true`, look up the opposite-side stored odds row.
2. Require exact event, market, side, line, sportsbook/consensus scope, pre-start safety, source timestamp, and freshness checks.
3. Preserve Product Freshness SLA and Official Pick gates.
4. Do not synthesize prices or weaken thresholds.
