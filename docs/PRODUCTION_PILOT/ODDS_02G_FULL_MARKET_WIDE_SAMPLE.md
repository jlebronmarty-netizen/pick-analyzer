# ODDS-02G Full-Market Wide Sample

Status: `ODDS_02G_WIDE_SAMPLE_CAPTURED_MORE_SHADOW_EVIDENCE_REQUIRED`

Starting commit: `6104dc3e9b73ec528d1aa0faef6f5f1885f6276a`.

Runtime commit: `6104dc3e9b73ec528d1aa0faef6f5f1885f6276a`.

Observation time: `2026-08-09T16:50:21.005Z`.

Provider-consuming requests in this phase: `1`.

Database mutations: `0`.

## Verdict

ODDS-02G executed one authorized protected production shadow request against the repaired full-market capture contract.

The request returned `966` full-market evidence rows, `13` mapped Current Board events, `2` extra provider events that were unmapped, and `0` ambiguous mappings. The Odds API evidence was materially fresher than the SportsDataIO production source evidence observed in the same response.

SportsDataIO remains the production odds authority. The Odds API remains shadow-only. No ODDS-03 cutover was performed.

## Preflight

- Branch was aligned with `origin/main`.
- Production `/api/system/version` served `6104dc3e9b73ec528d1aa0faef6f5f1885f6276a`.
- Local `THE_ODDS_API_KEY` was present.
- Local `CRON_SECRET` was present.
- ODDS-02F full-market evidence contract was deployed and validated.

## Useful Slate Gate

Production read-only checks before the provider-consuming request showed:

- Current Board candidates: `39`.
- Current Board unique event IDs: `13`.
- Event lifecycle rows: `15`.
- Pregame lifecycle rows: `15`.
- Started lifecycle rows: `0`.
- Final lifecycle rows: `0`.

The useful slate gate passed because expected mappable Current Board events were greater than the minimum threshold of `5`.

## Request Accounting

| Metric | Value |
| --- | ---: |
| Provider calls made by protected live request | 1 |
| Remote mutations made | 0 |
| Production mutations made | 0 |
| Requests used reported by response | 3 |
| Credits used reported by response | 3 |
| Credits remaining reported by response | 19985 |
| Events returned | 15 |
| Events mapped | 13 |
| Events unmapped | 2 |
| Ambiguous events | 0 |
| Shadow snapshots | 966 |
| Full-market evidence rows | 966 |
| Mapped full-market rows | 852 |

Unmapped provider events:

| Matchup | Reason |
| --- | --- |
| CIN @ WSH | NO_TEAM_TIME_MATCH |
| TB @ SEA | NO_TEAM_TIME_MATCH |

## Market Coverage

Coverage below is based on the `13` expected Current Board events represented in the comparisons.

| Market | Bettable Event Coverage | Exact Prediction-Line Coverage | Moved-Line Predictions | No Current Side Market |
| --- | ---: | ---: | ---: | ---: |
| Moneyline | 13/13 (100%) | 13/13 (100%) | 0 | 0 |
| Run Line | 13/13 (100%) | 13/13 (100%) | 0 | 0 |
| Total | 13/13 (100%) | 2/13 (15.38%) | 11 | 0 |

The low Total exact-line coverage is not provider market absence. It is line movement: all 13 games had a current Total market, but 11 current Total markets no longer matched the original prediction line.

## Core Book Coverage

| Book | Rows | Events | Moneyline Events | Run Line Events | Total Events | Median Age |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FanDuel | 78 | 13 | 13 | 13 | 13 | 0 min |
| DraftKings | 78 | 13 | 13 | 13 | 13 | 0 min |
| BetMGM | 74 | 13 | 13 | 11 | 13 | 1 min |
| Caesars | 78 | 13 | 13 | 13 | 13 | 2 min |

All four core books were observed in the full-market shadow sample.

## Freshness

| Source | Latest Source Time | Evidence Age |
| --- | --- | ---: |
| SportsDataIO | `2026-08-09T12:47:04.000Z` | 243 min |
| The Odds API | `2026-08-09T16:50:20.000Z` | 0 min |

Mapped The Odds API rows:

- Fresh: `852`.
- Aging: `0`.
- Stale: `0`.
- Unknown: `0`.
- Median source age: `0` minutes.
- Max source age: `2` minutes.

The sample proves a material freshness advantage for the shadow provider in this window.

## Exact Market Example

Example exact market from the captured comparison set:

- Event: `ATH @ BOS`.
- Event ID: `baseball_mlb:mlb:sportsdataio:event:79052`.
- Market: `moneyline`.
- Selection: `BOS`.
- Prediction line: `null`.
- Production model probability: `74.27`.
- SportsDataIO price: `-237`.
- SportsDataIO timestamp: `2026-08-09T12:47:04.000Z`.
- SportsDataIO freshness: `STALE`.
- Best fresh The Odds API book: `DraftKings`.
- Best fresh The Odds API price: `-223`.
- Best fresh The Odds API timestamp: `2026-08-09T16:49:56.000Z`.
- Shadow implied probability: `69.04`.
- Shadow edge: `5.23`.
- Shadow EV: `7.57`.

## Edge And EV Observations

Among exact fresh shadow matches:

- Exact fresh comparison rows: `28`.
- Same EV direction as production source: `26`.
- Positive production EV becoming negative with shadow price: `2`.
- Negative production EV becoming positive with shadow price: `0`.
- Material EV shifts of at least 2 points: `20`.

This confirms that fresher book-level prices can materially change betting economics without changing model probability or confidence.

## Safety

- Production Current Board changed: `false`.
- Production Official Picks changed: `false`.
- Production Performance changed: `false`.
- Remote mutations made: `0`.
- Production mutations made: `0`.
- Stale production evidence becoming actionable: `0`.
- Prediction writes: `0`.
- Settlement writes: `0`.
- Learning writes: `0`.

## Cutover Decision

Cutover decision: `MORE_SHADOW_EVIDENCE_REQUIRED`.

Reason:

- The Odds API freshness and book coverage are strong in this sample.
- Expected Current Board event mapping is clean at `13/13` with `0` ambiguity.
- Total market availability is strong, but exact Total line survival is low because lines moved.
- Production needs the ODDS-02E pregame re-prediction / exact-line policy path before current non-exact Total markets can be safely treated as production recommendations.

## Recommendation

Continue SportsDataIO as production odds authority until a dedicated ODDS-03 cutover is separately approved.

Use The Odds API shadow evidence to design the next safe step:

`ODDS-03_READINESS_REVIEW_AFTER_LINE_MOVEMENT_AND_CUTOVER_GATES`

Do not begin ODDS-03 automatically.
