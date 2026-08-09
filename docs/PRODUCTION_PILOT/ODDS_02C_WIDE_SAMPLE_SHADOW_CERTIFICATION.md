# ODDS-02C Wide Sample Shadow Certification

Status: `ODDS_02C_WIDE_SAMPLE_CAPTURED_DO_NOT_CUTOVER`

Starting commit: `4da24afd4299d3e0d1362eab9b03f68ac2a0c1c0`.

Production commit: `4da24afd4299d3e0d1362eab9b03f68ac2a0c1c0`.

Capture time: `2026-08-09T15:35:30Z`.

Provider calls during ODDS-02C: `1`.

Database mutations during ODDS-02C: `0`.

## Verdict

ODDS-02C successfully used the repaired ODDS-02B capture-first harness for one separately authorized wide-sample MLB shadow request.

The request returned HTTP 200, captured the raw response locally before parsing, validated the top-level `apiOk` contract and produced sanitized aggregate evidence. The raw response remains local only under `.tmp/odds-shadow-certification/`, which is gitignored.

Cutover is not recommended yet.

## Useful Slate Gate

| Item | Result |
| --- | ---: |
| Operating date | `2026-08-09` |
| Current Board events | 14 |
| Current Board candidates | 42 |
| Candidate markets | moneyline, spread, total |
| Lifecycle events | 15 |
| Expected mappable current events | 14 |
| Minimum useful threshold | 3 |
| Preferred useful threshold | 5 |
| Gate decision | `CONSUME_ONE_ODDS_02C_REQUEST` |

## Request Accounting

| Item | Result |
| --- | ---: |
| ODDS-02C authorized requests | 1 |
| ODDS-02C requests consumed | 1 |
| Remaining ODDS-02C requests | 0 |
| HTTP status | 200 |
| Provider calls reported by route | 1 |
| Credits used | 3 |
| Credits remaining | 19988 |
| Remote mutations | 0 |
| Production mutations | 0 |

No retry was attempted.

## Event Mapping

| Metric | Result |
| --- | ---: |
| Provider events returned | 15 |
| Expected-mappable current events | 14 |
| Mapped expected events | 13 |
| Unmapped expected events | 1 |
| Outside current scope | 1 |
| Ambiguous events | 0 |
| Expected-mappable mapping rate | 92.86% |

Unmapped expected event:

| Provider matchup | Canonical matchup | Classification |
| --- | --- | --- |
| `OAK @ BOS` | `ATH @ BOS` | `TEAM_ALIAS_MISMATCH` |

Outside current scope:

| Provider matchup | Classification |
| --- | --- |
| `TB @ SEA` | `CURRENT_PROVIDER_EVENT_NOT_IN_CURRENT_BOARD` |

The mapping miss is an identity defect to repair before ODDS-03. It does not affect production odds because The Odds API remains shadow-only.

## Market Coverage

Coverage is exact event, market, selection and line only.

| Market | Expected selections | Exact shadow selections | Coverage |
| --- | ---: | ---: | ---: |
| Moneyline | 14 | 13 | 92.86% |
| Run line | 14 | 13 | 92.86% |
| Total | 14 | 2 | 14.29% |

Moneyline and run-line coverage are useful. Total coverage is not yet cutover-grade because most provider totals did not exact-match the current production total line.

## Bookmaker Coverage

Observed books:

- BetMGM
- BetOnline.ag
- BetRivers
- BetUS
- Bovada
- Caesars
- DraftKings
- FanDuel
- Fanatics
- LowVig.ag
- MyBookie.ag

Core book coverage:

| Book | Events | Moneyline | Run line | Total | Fresh | Aging | Stale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FanDuel | 13 | 13 | 12 | 2 | 27 | 0 | 0 |
| DraftKings | 13 | 13 | 13 | 1 | 27 | 0 | 0 |
| BetMGM | 13 | 13 | 11 | 1 | 25 | 0 | 0 |
| Caesars | 13 | 13 | 13 | 1 | 27 | 0 | 0 |

Other notable books:

| Book | Events | Moneyline | Run line | Total | Fresh |
| --- | ---: | ---: | ---: | ---: | ---: |
| BetRivers | 13 | 13 | 13 | 2 | 28 |
| Fanatics | 13 | 13 | 13 | 1 | 27 |
| Bovada | 13 | 13 | 12 | 1 | 26 |
| BetUS | 13 | 13 | 13 | 1 | 27 |
| MyBookie.ag | 13 | 13 | 12 | 2 | 27 |

## Freshness

| Metric | SportsDataIO | The Odds API |
| --- | ---: | ---: |
| Latest source timestamp | `2026-08-09T11:27:42Z` | `2026-08-09T15:35:45Z` |
| Median/source-age proxy | 248 minutes | 0 minutes |
| Fresh | 0 | 295 |
| Aging | 0 | 0 |
| Stale | 42 | 0 |
| Median freshness improvement | 248 minutes |

The sample strongly supports The Odds API as materially fresher for exact overlapping moneyline and run-line evidence.

## Representative Market Comparisons

| Matchup | Market | Selection / line | SportsDataIO | Shadow best fresh | Book | Production EV | Shadow EV |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| LAD @ ARI | Run line | ARI +1.5 | -137 | -129 | LowVig.ag | 26.92 | 30.25 |
| CLE @ CHW | Run line | CHW +1.5 | -151 | -147 | LowVig.ag | 16.99 | 18.26 |
| LAD @ ARI | Moneyline | ARI | +123 | +132 | FanDuel | 54.45 | 60.68 |
| LAA @ MIA | Moneyline | MIA | -149 | -138 | FanDuel | 15.11 | 18.79 |
| MIN @ MIL | Moneyline | MIL | -256 | -245 | FanDuel | -6.11 | -4.92 |

Price delta across exact matched selections:

- Count: 28
- Minimum: 1 American-odds point
- Maximum: 12 American-odds points
- Average: 6.75 American-odds points

## Shadow Value Impact

| Metric | Result |
| --- | ---: |
| Same value sign | 25 |
| Positive to negative | 0 |
| Negative to positive | 1 |
| Material edge change | 1 |
| Material EV change | 21 |
| SportsDataIO missing to shadow available | 0 |
| SportsDataIO stale to shadow fresh | 295 book-level exact matches |

Shadow EV is diagnostic only and was not persisted as production recommendation evidence.

## Official Picks

Current Board reported `0` Official Picks at gate time. Dashboard returned no `officialPicks` rows during the post-capture read. Official Pick shadow comparison is therefore `CANNOT_COMPARE`.

No Official Picks were changed.

## Production Isolation

- SportsDataIO remains production odds authority.
- The Odds API remains shadow-only.
- Current Board production pricing was not changed.
- Probability, confidence, rankings, Official Picks, Rent Play, Moneyline, Smart Parlay and Watchlist were not changed.
- Settlement, learning, Performance, Current Era and HR-03 calibration shadow were not changed.
- Scheduler cadence was not changed.
- No ODDS-03 cutover was performed.

## Cutover Decision

`DO_NOT_CUTOVER`

Reasons:

- one expected-current event failed mapping due `ATH/OAK` identity mismatch;
- exact total-line coverage is only 14.29%;
- cutover requires no identity defect and stronger total-market line matching.

## ODDS Provider Replacement Signal

`MODERATE`

The sample is strong for freshness and book coverage, especially moneyline and run line. It is not strong enough for cutover because event identity and totals exact-line coverage remain incomplete.

## Next Step

Repair The Odds API event/team alias mapping for `ATH/OAK` and improve total-line equivalence diagnostics before a new cutover-readiness phase. Do not begin ODDS-03 from ODDS-02C alone.
