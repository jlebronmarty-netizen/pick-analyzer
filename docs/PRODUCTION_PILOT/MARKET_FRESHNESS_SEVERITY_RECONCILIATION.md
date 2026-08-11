# Market Freshness Severity Reconciliation

Date: 2026-08-11

Classification: MARKET_FRESHNESS_SEVERITY_REPAIR_READY_FOR_DEPLOYMENT

## Scope

This is a bounded operations-health repair. It reconciles Current Board market freshness severity with fail-closed product availability.

It does not change prediction formulas, probabilities, rankings, Official Pick thresholds, Rent Play policy, Moneyline policy, Smart Parlay policy, Kelly, settlement, learning, provider authority, Vercel configuration, MLB data-source mode, or SportsDataIO rollback status.

## Starting State

Production was aligned to commit `da4b97e0bc4cd832597ef8b74ec5af13c07ada52`.

Production configuration:

- `ODDS_PRIMARY_AUTHORITY_STAGE=STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT`
- `MLB_DATA_SOURCE_MODE=MLB_OFFICIAL_PRIMARY`
- The Odds API is MLB product odds authority.
- MLB Official is primary non-odds MLB source.
- SportsDataIO is rollback-only.

Current Board evidence:

- Games today: 15
- Current Board candidates: 38
- Fresh rows: 37
- Aging rows: 0
- Stale rows: 1
- Fail-closed stale rows: 1
- Current Board health: DEGRADED
- Operations health before repair: CRITICAL
- Scheduler health: HEALTHY
- Missed scheduler intervals: 0
- Settlement: PASS
- SportsDataIO MLB routine calls: 0

## Root Cause

`/api/operations/health` builds its market freshness domain in `src/services/operations-health.service.ts`.

Before this repair, `marketDomain()` promoted `odds_not_current` from adaptive-refresh evidence directly to `CRITICAL`, even when the Current Board still had broad fresh product coverage and the stale evidence was already fail-closed.

The aggregation rule itself is correct: overall operations health uses the limiting domain severity. The defect was the market freshness domain classification, not the overall aggregation logic.

The bounded health read also used `limit: 25`, which could miss a stale row on a larger Current Board. The query performance repair already made the board query bounded and fast, so the health summary now reads `limit: 200` with `includeMlbContext: false`.

## Current Board Contract

Current Board remains strict:

- `READY` means visible product evidence has no board warnings.
- `DEGRADED` means one or more visible rows have stale or incomplete product evidence, while candidates are still safely displayed.
- Empty or read-failed states remain explicit and do not synthesize product evidence.

For 37 fresh rows plus 1 stale fail-closed row, Current Board `DEGRADED` is intentional and should remain.

## Freshness Denominator

The market freshness denominator for the board-facing health read is visible Current Board candidates.

Observed denominator:

- 38 visible candidate rows
- 37 fresh rows
- 1 stale row
- Fresh coverage: 97.37%
- Stale coverage: 2.63%

Event coverage:

- Games with at least one fresh market: 15 / 15
- Games partially fresh: 1 / 15
- Games with no fresh market evidence: 0 / 15

Market coverage:

- Moneyline fresh coverage: 15 / 15
- Run Line fresh coverage: 15 / 15
- Total fresh coverage: 7 / 8

## Stale Row Identity

The single stale row was:

- Prediction ID: `ae6b6158-3952-5cac-8b7b-fbeeac9ed0ec`
- Event: TB @ ATH
- Event ID: `baseball_mlb:mlb:sportsdataio:event:79090`
- Market: Total
- Selection: Under
- Line: 10
- Odds: -111
- Price source: Consensus
- Source timestamp: `2026-08-10T22:07:18.000Z`
- Captured timestamp: `2026-08-10T22:07:18.000Z`
- Freshness: STALE
- Actionability: WAIT_FOR_REFRESH
- Reason: MARKET_AGE_EXCEEDS_SURFACE_SLA
- Official eligibility: NOT_OFFICIALLY_ELIGIBLE
- Recommendation policy status: ANALYZED_ONLY

Classification: STALE_EXACT_LINE_NO_ALTERNATIVE

The same event still had fresh Moneyline and Run Line evidence. No alternative fresh exact Total 10 price was available in the Current Board evidence. The stale row remained non-actionable.

## Health Semantics

HEALTHY:

- Product market evidence is current for the visible board scope.
- Scheduler and provider status do not indicate an outage.
- No stale or missing evidence affects visible product rows.

DEGRADED:

- Some product market evidence is stale, missing, or waiting for refresh.
- Fresh product coverage still exists.
- Stale or missing evidence is fail-closed and cannot become actionable.
- Scheduler/provider evidence does not prove a systemic outage.

CRITICAL:

- Core product market evidence is unavailable or all visible current evidence is stale.
- Provider acquisition failed.
- Scheduler missed intervals indicate the primary scheduler is not keeping up.
- A stale or missing market could leak into actionable recommendations.
- Fresh coverage is absent while `odds_not_current` is present.

## Repair

The market freshness domain now distinguishes:

- `odds_not_current` with no fresh Current Board coverage: CRITICAL.
- `odds_not_current` with fresh fail-closed partial coverage: DEGRADED.
- All visible markets stale: CRITICAL.
- Provider failure: CRITICAL.
- Partial stale rows with fresh coverage: DEGRADED.

The repair also exposes coverage evidence:

- `visibleMarketCount`
- `freshVisibleMarketCount`
- `staleVisibleMarketCount`
- `freshCoveragePercent`
- `staleCoveragePercent`
- `failClosedStaleMarkets`

## Scenario Matrix

| Scenario | Current Board | Market Freshness | Operations | Actionability |
|---|---|---|---|---|
| All fresh | READY | HEALTHY | HEALTHY unless another domain limits it | Normal policy gates |
| 37 fresh / 1 stale fail-closed | DEGRADED | DEGRADED | DEGRADED unless another domain limits it | Stale row WAIT_FOR_REFRESH |
| Several stale rows with fresh coverage | DEGRADED | DEGRADED | DEGRADED unless another domain limits it | Stale rows fail closed |
| One event unavailable but other fresh coverage exists | DEGRADED | DEGRADED | DEGRADED unless a required product surface is unavailable | Missing event markets fail closed |
| Several events unavailable with fresh coverage still present | DEGRADED | DEGRADED | DEGRADED unless systemic outage evidence exists | Missing markets fail closed |
| All visible evidence stale | DEGRADED or stale board state | CRITICAL | CRITICAL | No stale row actionable |
| Provider acquisition failed | DEGRADED or UNKNOWN | CRITICAL | CRITICAL | Fail closed |
| Scheduler missed beyond tolerance | Any | scheduler domain CRITICAL | CRITICAL | Fail closed if freshness cannot be trusted |

## Regression Safety

The repair does not make stale evidence fresh and does not change actionability.

Preserved guarantees:

- Stale rows remain non-actionable.
- Missing exact-line prices remain non-actionable.
- No cross-line price binding.
- No old-line probability reuse.
- No Official Pick leakage.
- No Rent Play leakage.
- No Smart Parlay leakage.
- No SportsDataIO reactivation.
- The Odds API remains product odds authority.
- MLB Official remains primary non-odds source.
- SportsDataIO rollback window Day 1 remains 2026-08-11.

## Expected Outcome

For the certified 37 fresh / 1 stale fail-closed state:

- Current Board stays DEGRADED.
- Market Freshness becomes DEGRADED instead of CRITICAL.
- Operations becomes DEGRADED unless another domain is legitimately limiting.
- The stale Total row remains WAIT_FOR_REFRESH.

