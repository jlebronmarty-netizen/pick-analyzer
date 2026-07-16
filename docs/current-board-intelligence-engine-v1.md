# Current Board Intelligence Engine V1

Status: implemented as a read-only canonical service.

## Canonical Service

- Service: `src/services/current-board.service.ts`
- API: `/api/current-board`
- Provider calls: 0
- Remote mutations: 0

The Current Board answers: "What valid betting candidates exist right now?"

It is not a prediction engine, recommendation policy or production gate. It reuses stored prediction, event and odds rows and produces a typed current betting-candidate contract for optional tools and operational summaries.

## Default Scope

Default mode is `CURRENT`. It includes only future, unstarted, current-slate candidates with supported markets, valid event mapping, valid feature snapshot linkage, latest non-superseded prediction lineage, latest safe pregame odds before cutoff/start, no fixture rows, no historical or settled rows, no stale odds, no live/alternate contamination and no duplicate logical candidate.

Historical rows are available only through `HISTORICAL_EXPLORER` and `ALL_STORED_ADVANCED`.

## Modes

- `CURRENT`
- `UPCOMING`
- `HISTORICAL_EXPLORER`
- `ALL_STORED_ADVANCED`

Production-facing consumers may use only `CURRENT`, and still must apply Production Data Gate V1 plus Recommendation Eligibility Policy V1 before exposing official picks.

## Candidate Contract

Each candidate includes identity, event, market, odds, freshness, model, feature quality, value, recommendation-policy status, official eligibility, quarantine state, leakage status, explanation factors, missing information and a stable logical key:

`sport + event + market + period + selection + active model version + feature-set version`

## Freshness And Anomaly Policy

MLB current-board odds must be before cutoff/start and within the configured maximum age. Latest safe snapshot wins. Stale candidates are excluded by default.

American odds validation rejects nonfinite/zero values, convention-invalid prices between -100 and +100, extreme impossible prices beyond the max valid threshold, moneyline lines that are non-null, invalid run-line ranges and invalid totals. Extreme but valid prices are flagged for review.

## Exclusion Accounting

The service returns both:

- `uniqueRowsExcluded`
- `exclusionReasonCounts`

A row can have multiple reasons, so reason totals intentionally may exceed unique exclusions.

Reason codes include `HISTORICAL`, `SETTLED`, `EVENT_STARTED`, `EVENT_COMPLETED`, `LEGACY_UNLINKED`, `FIXTURE`, `SUPERSEDED`, `STALE_ODDS`, `POST_CUTOFF_ODDS`, `LIVE_ODDS`, `ALTERNATE_MARKET`, `UNSUPPORTED_MARKET`, `INVALID_PRICE`, `INVALID_LINE`, `DUPLICATE`, `MISSING_EVENT`, `MISSING_SNAPSHOT` and `LEAKAGE_RISK`.

## Consumers

Most Likely consumes Current Board for filtering and uses only presentation ranking. Daily Report uses Current Board for Today counts, including slate games, future games, games with current odds, analyzed candidates, modeled-value candidates, watch candidates, qualified previews, official picks, latest odds capture and next refresh action.

Top Picks, Play of the Day, Bet Slip Optimizer, parlays, Kelly, portfolio and AI Coach were audited as official-facing consumers. They continue to use Production Data Gate V1 and Recommendation Eligibility Policy V1 and do not consume Current Board as official eligibility.

## AI Bet Finder Readiness

The service exposes a read-only orchestration contract for a future AI Bet Finder. The future tool should query Current Board, Most Likely ranking, Best Value ranking, official Top Picks, Bet Slip eligibility and Arbitrage availability. No LLM and no AI chat system are implemented in V1.

## Validation

The deterministic fixture suite covers 20 checks: future valid inclusion, historical/settled/superseded/stale/post-cutoff/fixture/legacy exclusions, latest safe odds selection, duplicate removal, modeled-value labeling, quarantine separation from official eligibility, unique exclusion accounting, mode behavior, arbitrage separation, deterministic output and zero provider calls.

Current stored validation returns the `NYM @ PHI` 2026-07-16 slate with three analyzed preview candidates across moneyline, run line and total. Official picks remain 0.
