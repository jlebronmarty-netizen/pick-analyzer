# ODDS-02D Event Alias And Total Line Reconciliation

Status: `ODDS_02D_ALIAS_REPAIRED_TOTAL_CONTRACT_GAP_DOCUMENTED`

Starting commit: `6dca6e85d45b1023a0004d2f025d8455ff1eb4f1`.

Provider calls: `0`.

Database mutations: `0`.

## Verdict

ODDS-02D repaired the deterministic `ATH/OAK` event-alias defect in the The Odds API shadow mapper and reprocessed the captured ODDS-02C response offline.

Mapping improves from 13/14 expected current events to 14/14 expected current events with 0 ambiguous mappings.

ODDS-02D does not recommend ODDS-03 yet. Total-market cutover evidence remains incomplete because the ODDS-02C response exposes aggregate mapped total rows but does not retain raw per-event/per-book total snapshot rows for non-exact prediction-line candidates.

## ATH/OAK Root Cause

The ODDS-02 shadow comparison service normalized these The Odds API team identities to `OAK`:

- `Oakland Athletics`
- `Athletics`
- `OAK`

Current SportsDataIO and prediction surfaces use canonical abbreviation `ATH`. The repository's existing The Odds API event crosswalk already maps `athletics`, `oaklandathletics`, `oaklandas`, `ath`, and `oak` to `ATH`.

Root cause:

`ODDS_02_SHADOW_ALIAS_DIVERGED_FROM_CANONICAL_CROSSWALK`

Repair:

- `src/services/odds02-shadow-comparison.service.ts`
- map `oaklandathletics`, `athletics`, and `oak` to `ATH`

This is deterministic because repository historical and current MLB artifacts consistently use `ATH` for Athletics event and prediction identity, while `OAK` is an external/provider naming variant.

## Mapping Recompute

Offline source:

- `.tmp/odds-shadow-certification/2026-08-09T15-35-30-388Z-live-fa3d85f1.body.json`

| Metric | Before | After |
| --- | ---: | ---: |
| Expected current events | 14 | 14 |
| Mapped expected events | 13 | 14 |
| Unmapped expected events | 1 | 0 |
| Ambiguous events | 0 | 0 |
| Expected mapping rate | 92.86% | 100.00% |

The provider event `OAK @ BOS` now maps to canonical `ATH @ BOS`, event `baseball_mlb:mlb:sportsdataio:event:79052`.

## Total Coverage Root Cause

ODDS-02C reported:

- `coverage.totalRows = 286`
- 13 mapped events
- 11 books
- 2 total outcomes per book/event

That aggregate is consistent with total-market availability for all 13 originally mapped events.

However, `comparisons[].books` contains only exact event/market/selection/line matches. For 12 total predictions with no exact-line match, the captured response does not include the available current total lines by book. Therefore ODDS-02D cannot honestly classify those rows as half-point moved, full-point moved, or missing from provider.

Classification:

`RESPONSE_CONTRACT_LIMITATION_FOR_NON_EXACT_TOTAL_LINES`

## Total Candidate Classification

| Classification | Count |
| --- | ---: |
| `EXACT_LINE_AVAILABLE` | 2 |
| `PROVIDER_TOTAL_PRESENT_EXACT_LINE_UNKNOWN` | 12 |
| `PROVIDER_TOTAL_MISSING` | 0 proven |
| `EXACT_LINE_MOVED` | 0 proven |
| `HALF_POINT_MOVED` | 0 proven |
| `FULL_POINT_MOVED` | 0 proven |

ODDS-02D does not classify changed sportsbook lines as provider missing.

## Coverage Metrics

Two coverage contracts must remain separate.

| Market | Bettable market coverage | Exact-line price coverage |
| --- | ---: | ---: |
| Moneyline | 14/14 = 100.00% | 14/14 = 100.00% |
| Run line | 14/14 = 100.00% | 14/14 = 100.00% |
| Total | at least 13/14 = 92.86% proven by aggregate mapped coverage | 2/14 = 14.29% |

After the `ATH/OAK` alias repair, moneyline and run-line coverage reach 14/14 because the OAK/ATH event was the only expected mapping miss and The Odds API returned normal h2h/spread markets in the same broad sample.

For totals, aggregate mapped-event evidence proves broad provider total availability, but exact prediction-line coverage remains low.

Core book total exact-line coverage from captured comparison rows:

| Book | Exact total events |
| --- | ---: |
| FanDuel | 2 |
| DraftKings | 1 |
| BetMGM | 1 |
| Caesars | 1 |

## Line Movement Semantics

Pick Analyzer must treat these as separate concepts:

- `PREDICTION_LINE`
- `CURRENT_BETTABLE_LINE`

A probability generated for `Over 8.0` must not automatically become the probability for `Over 8.5`.

Recommended policy:

`PRICE_FOR_PREDICTED_LINE_UNAVAILABLE_UNLESS_EXACT_LINE_MATCH`

When the current market moves away from the prediction line:

1. show the original prediction lineage and original line;
2. mark the current price as unavailable for that prediction line;
3. do not reuse probability across materially different lines;
4. if still cutoff-safe, create a new versioned pregame prediction for the current bettable line in a future implementation;
5. preserve original prediction history for settlement and audit.

No line-adjustment model or interpolation was implemented in ODDS-02D.

## Pregame Re-Prediction Design

Future design should support versioned/superseded pregame predictions when market identity changes before start:

1. detect line movement from provider/source evidence;
2. keep the old prediction immutable;
3. mark old prediction `PRICE_FOR_PREDICTED_LINE_UNAVAILABLE` when exact-line price disappears;
4. generate a new cutoff-safe prediction for the current line only when current pregame features are valid;
5. link the new prediction to the prior prediction lineage;
6. keep settlement tied to the exact event, market, selection and line.

This is a design recommendation only.

## SportsDataIO Odds Authority Recommendation

The Odds API odds replacement readiness:

`MORE_ODDS_REPAIR_REQUIRED`

SportsDataIO odds authority recommendation:

`KEEP_SPORTSDATAIO_AS_PRODUCTION_ODDS_AUTHORITY_UNTIL_TOTAL_LINE_CONTRACT_AND_LINE_MOVEMENT_REFRESH_ARE_REPAIRED`

ODDS-02C plus ODDS-02D strengthens the case that The Odds API is fresher and has better sportsbook coverage for moneyline and run line, but totals and line-movement semantics are not cutover-ready.

## Production Isolation

- Provider calls: 0
- Database mutations: 0
- Prediction probabilities unchanged
- Official Pick policy unchanged
- Rent Play policy unchanged
- Settlement unchanged
- Learning unchanged
- HR-03 unchanged
- Current Era unchanged
- Replay unchanged
- ODDS-03 not started
