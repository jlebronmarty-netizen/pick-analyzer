# Odds Full Market Evidence Contract V1

Status: `ODDS_02F_CONTRACT_READY_FOR_NEXT_AUTHORIZED_SAMPLE`

Provider calls: `0`.

Database mutations: `0`.

## Purpose

ODDS-02F repairs the shadow capture contract before another provider-consuming sample is authorized.

ODDS-02E proved that the ODDS-02C response dropped row-level non-exact market evidence. ODDS-02F keeps the contract protected and shadow-only while preserving enough sanitized market evidence to certify all current moneyline, run line and total rows returned by The Odds API.

## Evidence Loss Point

| Stage | Row Detail |
| --- | --- |
| Raw provider response | Present |
| Normalization | Present as `ShadowSnapshot[]` |
| Comparison service | Present in memory |
| Route response before ODDS-02F | Lost: `shadowSnapshots` was a count and `comparisons[].books` kept exact matches only |
| Capture harness before ODDS-02F | Captured only what the route returned |
| Certification parser before ODDS-02F | Could not derive non-exact total-line universe |

Exact classification:

`ROUTE_RESPONSE_DROPPED_ALTERNATE_LINES`

## Full Market Evidence Row

The protected live shadow response now includes `fullMarketEvidence` rows.

| Field | Meaning |
| --- | --- |
| `eventId` | canonical event when mapped, otherwise provider event |
| `canonicalEventId` | mapped Pick Analyzer event ID |
| `providerEventId` | The Odds API event ID |
| `homeTeam` | provider home team label |
| `awayTeam` | provider away team label |
| `commenceTime` | provider start time |
| `bookmakerKey` | provider bookmaker key |
| `bookmaker` | bookmaker display name |
| `market` | normalized `moneyline`, `spread`, or `total` |
| `providerMarket` | provider market key |
| `selection` | normalized side |
| `line` | exact line, null only for moneyline |
| `price` | American odds |
| `providerSourceTimestamp` | sportsbook market timestamp |
| `capturedAt` | shadow capture timestamp |
| `mappingStatus` | `MAPPED`, `AMBIGUOUS`, or `UNMAPPED` |
| `mappingReason` | deterministic mapping explanation |
| `freshnessStatus` | row freshness from source timestamp |
| `sourceAgeMinutes` | age at capture time |

No credential values, Authorization headers, raw request URLs with API keys, or unnecessary raw payload metadata are returned.

## Alternate-Line Preservation

Spread and total rows are not collapsed.

Examples:

- Total 7.5 Over
- Total 8.0 Over
- Total 8.5 Over
- Run Line -1.5
- Run Line +1.5

Each provider/book/event/market/selection/line combination has its own row identity.

## Response Size Safety

Expected one-request MLB upper bound:

| Scenario | Approximate Rows |
| --- | ---: |
| 15 games, 12 books, ML/RL/Total two sides | 1080 |
| 15 games, 12 books, one extra total alternate | 1440 |
| 15 games, 12 books, three total lines | 1800 |

A sanitized row is intentionally compact. The expected protected response is bounded enough for a protected certification endpoint. Raw provider payloads remain uncommitted and `.tmp/odds-shadow-certification/` remains ignored.

## Parser Contract

`scripts/odds-shadow-certification-capture.mjs` now exports parser helpers:

- `marketEvidenceMetrics`
- `classifyLineMovement`
- `bestFreshExactLinePrice`

The next authorized capture can answer from row evidence:

- mapped events;
- books;
- moneyline bettable coverage;
- run line bettable and exact-line coverage;
- total bettable and exact-line coverage;
- current lines by book;
- freshness by market/book;
- best fresh exact-line price;
- line movement classification.

## Isolation

The contract is protected/internal and shadow-only.

SportsDataIO remains production odds authority. The Odds API remains shadow-only. No recommendation, probability, settlement, learning, Performance, Current Board production authority, HR-03, or scheduler behavior changes are included.
