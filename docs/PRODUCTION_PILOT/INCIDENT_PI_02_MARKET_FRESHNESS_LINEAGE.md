# Production Pilot Incident PI-02: Market Freshness Lineage And Prior-Day Closure

Status: `PI_02_PASS_WITH_MONITORING`

Observation time: `2026-08-08 14:08 AST` (`America/Puerto_Rico`)

Starting commit: `ff741bb9ee8748e3bd18c67f38070854656190fd`

Production commit: `ff741bb9ee8748e3bd18c67f38070854656190fd`

## Executive Finding

PI-02 found two separate conditions.

1. Current betting surfaces expose two freshness concepts: legacy snapshot freshness and Product Freshness SLA. Snapshot freshness can be current while the underlying provider market timestamp is stale for betting actionability.
2. The prior-day 18 unsettled canonical predictions are not silent settlement failures. They belong to six events that production still classifies as `STARTED`/`scheduled` without imported authoritative results.

No prediction formula, ranking, Official Pick policy, Kelly logic, settlement rule, learning weight, provider budget, scheduler cadence or freshness threshold changed.

## Freshness Contract Matrix

| Contract | Source | Timestamp | Age Basis | Threshold | Surface | Actionability Effect |
|---|---|---:|---|---|---|---|
| `dataFreshness` | `current-board.service.ts` over `sports_odds_snapshots` | `latestVisibleMarketSnapshotTimestamp` / `oddsFetchedAt` | Snapshot ingest/capture age | Current Board display policy, 30 min default | Current Board, Dashboard, summary copy | Display-only; does not certify betting actionability |
| `marketAlignment.freshnessStatus` | `current-board.service.ts` | `marketInputTimestamp` | Snapshot ingest/capture age | Legacy market-alignment freshness | Current Board, Most Likely internals | Presentation/ranking context only; candidate blockers still include stale odds |
| `productFreshness` | `product-freshness-sla.service.ts` | `marketTimestamp` from provider/source market timestamp | Provider market evidence age | Surface-specific SLA: 10/15 min desired, 30 min max tolerated for current decision surfaces | Homepage selectors, Current Board, Most Likely, Best Value, Workbench, Operations | Canonical actionability contract |
| `productFreshnessSla` summary | `summarizeProductFreshnessSlas` | Aggregated `productFreshness.marketTimestamp` | Provider market evidence age | Same as product surface SLA | Operations, Current Board summaries | Blocks stale evidence with `WAIT_FOR_REFRESH` |
| `latestOddsTimestamp` | Current Board/Dashboard response | Snapshot capture timestamp | Snapshot age | Display freshness only | Homepage latest odds, Dashboard | Must be read as captured snapshot, not source market proof |
| `latestOddsSourceTimestamp` | Current Board/Dashboard response | Provider timestamp | Provider evidence age | Product freshness SLA | Operations/Product Readiness | Used to explain why snapshot can be fresh while actionability waits |

## Exact Market Trace

The exact current provider-backed market used for cross-surface trace was:

- Event: `baseball_mlb:mlb:sportsdataio:event:79050`
- Matchup: `HOU @ SD`
- Market: `Total`
- Selection: `Under`
- Line: `8`
- Odds: `-115`
- Prediction ID: `7478f70f-c09b-533f-a301-bca586ebe9b6`
- Odds snapshot ID: `baseball_mlb:mlb:sportsdataio:game_odds:79050:22:36145622:total:under:8:2026-08-08t14_07_23.000z`

| Surface | Timestamp Shown / Used | Classification |
|---|---:|---|
| Current Board `oddsTimestamp` | `2026-08-08T18:07:39.265Z` | `SNAPSHOT_CAPTURE_TIMESTAMP` |
| Current Board `marketAlignment.freshnessStatus` | `2026-08-08T18:07:39.265Z`, age 1 min | `FRESH` by legacy snapshot contract |
| Current Board `productFreshness.marketTimestamp` | `2026-08-08T14:07:23.000Z`, age 241 min | `STALE`, `WAIT_FOR_REFRESH` |
| Most Likely `marketFreshnessState` | `2026-08-08T18:07:39.265Z`, age 1 min | `FRESH` by legacy snapshot contract |
| Most Likely `productFreshness.marketTimestamp` | `2026-08-08T14:07:23.000Z`, age 241 min | `STALE`, `WAIT_FOR_REFRESH` |
| Dashboard grounded row | exact Under row is informational and carries `STALE_ODDS` blocker | not actionable |
| Dashboard model-only Over row | `HOU @ SD Over 8`, odds `-107`, superseded preview | `P2_1A_SELECTION_LEVEL_PREVIEW_SUPERSEDED` |
| Operations/Product Freshness SLA | provider/source timestamp | stale source evidence |

The observed `Aug 8, 1:47 PM AST` style timestamp is the latest snapshot/capture time. The observed `Aug 8, 9:47 AM AST` style timestamp is provider/source market evidence. They are different contracts.

## 90 Snapshot Reconciliation

Latest active acquisition:

- Source: `VERCEL_OPERATING_DAY_CRON_PRIMARY`
- Endpoint: SportsDataIO `/api/mlb/odds/json/GameOddsByDate/2026-08-08`
- Started: `2026-08-08T18:07:38.856Z`
- Completed: `2026-08-08T18:07:39.474Z`
- Actual HTTP requests: `1`
- Actual quota units: `1`
- Provider records fetched: `15`
- Normalized rows produced: `90`
- Rows inserted: `90`
- Rows updated: `0`
- Rows skipped: `0`
- Freshness before: `2026-08-08T01:47:31Z`
- Freshness after: `2026-08-08T14:07:23Z`
- Missing provider timestamps: `0`

The acquisition did receive newer provider market evidence than the previous stored slate evidence. However, the newest source market timestamp was still stale against betting actionability SLA by the 14:08 AST observation.

## Cross-Surface Freshness Reconciliation

Current Board candidates: `45`

Classification counts:

- `CAPTURE_TIME_VS_SOURCE_TIME`: `44`
- `MATCH`: `1`
- `stale evidence actionable`: `0`
- `stale official picks`: `0`

Product Freshness SLA summary:

- `FRESH`: `0`
- `AGING`: `0`
- `STALE`: `45`
- `WAIT_FOR_REFRESH`: `45`

This is not a provider-budget defect and not a scheduler-execution defect. It is a dual freshness lineage issue: snapshot capture can be fresh while market source evidence remains stale.

## Safety Verdict

Safety status: `PASS_WITH_MONITORING`

Stale or unknown source evidence did not become:

- actionable;
- Official Pick;
- Rent Play actionable;
- Smart Parlay safe leg.

Every current candidate was blocked by Product Freshness SLA actionability (`WAIT_FOR_REFRESH`) and current candidate blockers include stale-odds evidence. The pilot can continue, but product monitoring should keep legacy snapshot freshness labels from being interpreted as betting freshness.

## Prior-Day 18-Row Reconciliation

Prior operating day: `2026-08-07`

Performance equation:

`42 canonical predictions = 24 settled + 18 valid pending + 0 blocked`

Settled record:

- Wins: `13`
- Losses: `11`
- Pushes: `0`

The 18 pending rows map to six late events, three markets per event. Production event lifecycle reports these events as `STARTED` with `status: scheduled`, `resultImported: false`, and no settlement-ready rows. The first missing step is `RESULT_IMPORT`.

| Event | Pending Markets | Event Lifecycle | Result Imported | Classification |
|---|---:|---|---|---|
| `TOR @ PHI` | 3 | `STARTED` / `scheduled` | false | `VALID_PENDING_EVENT_NOT_FINAL` |
| `ATL @ NYY` | 3 | `STARTED` / `scheduled` | false | `VALID_PENDING_EVENT_NOT_FINAL` |
| `HOU @ SD` | 3 | `STARTED` / `scheduled` | false | `VALID_PENDING_EVENT_NOT_FINAL` |
| `LAD @ ARI` | 3 | `STARTED` / `scheduled` | false | `VALID_PENDING_EVENT_NOT_FINAL` |
| `TB @ SEA` | 3 | `STARTED` / `scheduled` | false | `VALID_PENDING_EVENT_NOT_FINAL` |
| `DET @ SF` | 3 | `STARTED` / `scheduled` | false | `VALID_PENDING_EVENT_NOT_FINAL` |

Pending prediction IDs:

- `d4e35b5c-a99e-573b-b836-3b4f45c45195` HOU @ SD spread
- `37c61522-2819-5566-8be3-2dcda94ee865` HOU @ SD total
- `7659ea85-3692-5fed-8899-43a780bc5351` HOU @ SD moneyline
- `9878c41f-d0aa-542b-af53-574785a31d2f` LAD @ ARI total
- `1a416a5f-b0ee-5b3f-b572-b386fc075370` LAD @ ARI moneyline
- `5ac199e5-7c78-5d3a-bdf5-f1bd8e606a3c` LAD @ ARI spread
- `931c0fc9-c6f7-5011-9b3c-f2e46ff13ca9` DET @ SF moneyline
- `678e561b-83b3-5332-a09f-3c38b0502630` DET @ SF spread
- `f22c5c11-674f-5dc8-99cb-cdc73777889f` DET @ SF total
- `3a96ff65-8395-5805-8396-890497e24426` TB @ SEA spread
- `091d0a4c-8191-5c72-bfe4-5ec8f1fdde8b` TB @ SEA moneyline
- `de91bea1-ec71-55b1-9e66-51c7985d463d` TB @ SEA total
- `8be2191f-c957-53e4-983e-ca978175f11f` ATL @ NYY total
- `d2a49045-ed21-56f1-a077-f47705b9e73` ATL @ NYY moneyline
- `321b97fd-c0a6-529b-b7db-beac5da6e729` ATL @ NYY spread
- `80894638-79da-5a0d-940a-8fc635536840` TOR @ PHI total
- `8bfb98e4-c82e-5814-9aa8-4835b098e38f` TOR @ PHI spread
- `221b84c1-44af-58b9-adeb-7b04d1102f7f` TOR @ PHI moneyline

Settlement guarantee reports:

- checked predictions: `238`
- completed prediction rows: `117`
- settled rows: `117`
- ready for settlement: `0`
- blocked rows: `0`
- silent pending rows: `0`
- guarantee: `PASS`

## Final Classification

`PI_02_PASS_WITH_MONITORING`

Production Pilot Week remains `ACTIVE`. MC-03 was not started.

