# ODDS-03R Primary Odds Cutover Readiness Review

Status: `CUTOVER_READY_AFTER_BOUNDED_REPAIR`

Mode: read-only review plus bounded offline/runtime repair. Zero provider calls.

Starting commit: `2a238b6946147237734cba7b165b6a3f9dfb76f6`.

Production commit observed: `2a238b6946147237734cba7b165b6a3f9dfb76f6`.

## Verdict

Pick Analyzer is not ready for immediate ODDS-03 cutover, but it is ready after bounded repair.

The Odds API has enough certified evidence to justify preparing a cutover: fresh full-market data, core-book coverage, exact moneyline and run-line coverage, and clean Current Board mapping. The blockers are implementation readiness, not provider suitability.

## ODDS-02G Reconstruction

| Metric | Value |
| --- | ---: |
| Provider events returned | 15 |
| Current Board expected events | 13 |
| Current Board mapped events | 13 |
| Unmapped provider events | 2 |
| Ambiguous events | 0 |
| Full-market rows | 966 |
| Mapped rows | 852 |

ODDS-02G certification counts reconcile.

## CIN @ WSH

Root cause: `CURRENT_BOARD_SCOPE_MAPPING_DEFECT`.

The Odds API returned `Cincinnati Reds @ Washington Nationals` with commence time `2026-08-09T16:16:00.000Z`.

Production lifecycle has canonical event `baseball_mlb:mlb:sportsdataio:event:79053`, label `CIN @ WSH`, start `2026-08-09T16:15:00.000Z`, state `STARTED`, and six existing predictions.

The event failed ODDS-02G mapping because the shadow mapper indexed Current Board candidates, and this started event was not in the Current Board mapping universe.

Repair: no team alias repair required. ODDS-03 requires lifecycle-scoped mapping before cutover.

## TB @ SEA

Root cause: `CURRENT_BOARD_SCOPE_MAPPING_DEFECT`.

The Odds API returned `Tampa Bay Rays @ Seattle Mariners` with commence time `2026-08-09T20:11:00.000Z`.

Production lifecycle has canonical event `baseball_mlb:mlb:sportsdataio:event:79066`, label `TB @ SEA`, start `2026-08-09T20:10:00.000Z`, state `ACTIVE_REFRESH`, no stored market timestamp, and no Current Board prediction rows.

The event failed ODDS-02G mapping because it was not in the Current Board candidate universe. Earlier ODDS evidence mapped a different TB @ SEA event from a prior operating day, so this is not contradictory.

Repair: no team alias repair required. ODDS-03 requires lifecycle-scoped mapping before cutover.

## Offline Mapping Result

Against Current Board expected events:

- expected mappable: 13;
- mapped: 13;
- mapping rate: 100%;
- ambiguous: 0.

Against full lifecycle scope:

- provider returned: 15;
- lifecycle expected mappable: 15;
- mapped after required lifecycle-scoped mapping repair: 15/15 expected;
- ambiguous expected: 0.

The repair is architectural: use canonical lifecycle/sport event rows as the event mapping universe, not only Current Board candidates.

## Total Line Movement Reconciliation

ODDS-02G originally reported `2` exact Total lines and `11` moved Total lines. ODDS-03R found that result was affected by signed Total-line comparison.

Total lines must compare by absolute point value:

| Classification | Count |
| --- | ---: |
| EXACT_LINE_AVAILABLE | 10 |
| HALF_POINT_MOVE | 2 |
| FULL_POINT_MOVE | 1 |
| MULTI_POINT_MOVE | 0 |
| NO_CURRENT_TOTAL | 0 |

Direction:

- unchanged: 10;
- up: 1;
- down: 2.

ODDS-03R repaired total line identity helpers so Total `Over -8.5` and sportsbook Total `8.5` are the same point identity. Spread/run-line signed lines remain sign-sensitive.

## Re-Prediction Contract

Status: `DESIGNED_BUT_NOT_EXECUTABLE`.

ODDS-02E enforces a safe dry-run contract, but the implementation returns `DRY_RUN_ONLY` and `productionPredictionCreated: false`.

ODDS-03 must not be classified fully ready until pregame line-versioned prediction generation is executable under cutoff-safe guards.

## Probability And Price Safety

Cross-line probability safety: `PASS`.

Cross-line price safety: `PASS_AFTER_ODDS_03R_TOTAL_LINE_NORMALIZATION_REPAIR`.

Required identity:

`event + market + selection + normalized line`

Total line normalization uses absolute point value. Spread/run-line line identity preserves sign.

## Certified Book Set V1

Proposed:

| Book | Status |
| --- | --- |
| FanDuel | CERTIFIED_BOOK_SET_V1 |
| DraftKings | CERTIFIED_BOOK_SET_V1 |
| BetMGM | CERTIFIED_BOOK_SET_V1 |
| Caesars | CERTIFIED_BOOK_SET_V1 |

All four books were observed in ODDS-02G with fresh source evidence and broad moneyline/spread/total coverage.

## Freshness Authority

The Odds API source timestamp must drive Product Freshness SLA and actionability.

Capture timestamp may be shown separately as snapshot capture evidence, never as market evidence freshness.

If no fresh exact-line price exists, the state is `WAIT_FOR_REFRESH`. If a line moved and no current-line prediction exists, the state is `WAITING_FOR_CURRENT_LINE_PREDICTION`.

## Provider Failure Policy

SportsDataIO should remain `FALLBACK_CONTEXT_ONLY`, not automatic fallback price authority.

If The Odds API is unavailable, stale, rate-limited or quota-exhausted, the safe product state is `NO_FRESH_PRICE` rather than stale actionable pricing.

## Polling Economics

Observed The Odds API league-wide request cost: `3` credits.

| Slate | Requests / Day | Credits / Day | 30-Day Credits |
| --- | ---: | ---: | ---: |
| 10 games | 37 | 111 | 3330 |
| 15 games | 37 | 111 | 3330 |

Budget-conscious cadence:

- more than 6 hours before cutoff: 60 minutes;
- 2-6 hours: 15 minutes;
- 30 minutes-2 hours: 10 minutes;
- under 30 minutes: 5 minutes;
- stop at cutoff.

## Settlement, Performance And Learning

Multiple line versions must settle line-specifically.

Performance must not count every transient line version as a user-facing recommendation. Separate prediction evidence from recommendation exposure.

Learning may use eligible settled prediction evidence, but recommendation-facing Performance must be exposure-aware.

## Official Pick Cutover Path

Fresh The Odds API exact-line market evidence feeds current-line prediction, implied probability, edge and EV, then passes through existing Official Pick gates.

No threshold changes are authorized.

HR-03 calibration remains shadow.

## Current Production Safety

Current production remains safe because SportsDataIO is still authority and stale evidence is blocked by policy gates.

No path was certified where stale odds become Official Pick, Rent Play actionable or Smart Parlay safe-leg evidence.

## SportsDataIO Exit

Odds exit decision: `SPORTSDATAIO_ODDS_EXIT_READY_AFTER_REPAIR`.

Full subscription exit is not ready. Non-odds dependencies remain and require SDIO-EXIT-01.

## Cutover Decision

Decision: `CUTOVER_READY_AFTER_BOUNDED_REPAIR`.

Required before ODDS-03:

1. lifecycle-scoped provider event mapping;
2. executable pregame line-versioned prediction path;
3. production feature flag and rollback path;
4. certified book-set configuration;
5. exposure-aware Performance policy.

ODDS-03 was not performed.
