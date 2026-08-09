# Odds Primary Cutover Readiness V1

Status: `CUTOVER_READY_AFTER_BOUNDED_REPAIR`

Scope: ODDS-03R readiness review only. No provider cutover. No SportsDataIO cancellation.

## Authority Model

Current production odds authority remains `SportsDataIO`.

The Odds API remains `SHADOW_ONLY`.

Future cutover must preserve this sequence:

1. The Odds API full-market ingestion enabled behind a production-disabled flag.
2. Dual-read comparison against SportsDataIO.
3. The Odds API promoted to primary price authority only after exact event, market, selection, line and freshness gates pass.
4. SportsDataIO odds path retained as rollback/context during the rollback window.
5. SportsDataIO odds path disabled only after sustained production proof.

## Evidence Summary

ODDS-02G proved one protected league-wide The Odds API request returned:

- 15 provider events.
- 13 Current Board mapped events.
- 2 unmapped provider events.
- 0 ambiguous mappings.
- 966 full-market evidence rows.
- 852 mapped rows.
- 11 observed sportsbooks.

The Odds API evidence was materially fresher than SportsDataIO in that window:

- SportsDataIO source age: 243 minutes.
- The Odds API median mapped source age: 0 minutes.

## Required Repairs Before Cutover

### Lifecycle-Scoped Event Mapping

ODDS-02G mapping used Current Board candidates as the canonical mapping universe. That is sufficient for shadow comparison, but not sufficient for primary odds ingestion.

Primary odds ingestion must map provider events against canonical lifecycle/sport event rows, then separately decide whether an event is prediction-eligible or Current Board-visible.

The ODDS-02G unmapped events prove the gap:

| Provider Event | Canonical Lifecycle Evidence | Classification |
| --- | --- | --- |
| CIN @ WSH | `baseball_mlb:mlb:sportsdataio:event:79053`, started observational state, six existing predictions | `CURRENT_BOARD_SCOPE_MAPPING_DEFECT` |
| TB @ SEA | `baseball_mlb:mlb:sportsdataio:event:79066`, active refresh, no Current Board prediction rows | `CURRENT_BOARD_SCOPE_MAPPING_DEFECT` |

Both events have deterministic team aliases. The failure is not a team alias defect.

### Executable Pregame Re-Prediction

ODDS-02E defines the safe line-versioning contract, but the current implementation remains `DRY_RUN_ONLY`.

ODDS-03 cannot be fully ready until the new-line prediction flow can execute in production with:

- event still pregame;
- current time before cutoff;
- fresh current market line;
- exact new event/market/selection/line identity;
- no existing prediction for that identity;
- required features available;
- original prediction preserved;
- supersession lineage recorded;
- no post-start generation.

### Total Line Identity Normalization

ODDS-03R repairs a bounded line-identity defect: total lines must compare by absolute point value, while spread/run-line lines remain signed.

This prevents `Over -8.5` from being misclassified as different from current sportsbook `8.5`.

## Price Identity Safety

Production price binding must require:

`eventId + market + selection + normalized line`

Total lines normalize to absolute points. Spread/run-line lines preserve sign.

The system must never bind:

- Total 8.0 probability to Total 8.5 price.
- Run Line -1.5 probability to Run Line +1.5 price.
- Complement-derived probability to a non-matching line.

## Best Price Design

Recommended future production selector:

`BEST_FRESH_WITH_USER_BOOK_PREFERENCE`

Selection order:

1. User preferred certified books where available.
2. Best fresh exact-line price among certified books.
3. Certified-book context with all current prices.
4. Consensus context only as context, not as proof of a sportsbook price.

Candidate output must include:

- prediction line;
- current market line;
- best fresh exact-line price;
- best book;
- all certified book prices;
- source timestamp;
- market age;
- market freshness state.

## Certified Book Set V1

Initial certified production book set:

- FanDuel;
- DraftKings;
- BetMGM;
- Caesars.

ODDS-02G observed all four with broad MLB h2h/spread/total coverage and fresh source timestamps.

Other books may remain context-only until product and jurisdictional preferences are explicitly configured.

## Freshness Authority

Future actionability freshness must derive from The Odds API source evidence timestamp.

Capture time may be displayed as `Snapshot captured`, but it must not substitute for `Market evidence time`.

Rules:

- no fresh exact-line price -> `WAIT_FOR_REFRESH`;
- market moved and no current-line prediction -> `WAITING_FOR_CURRENT_LINE_PREDICTION`;
- stale price -> not actionable, not Official Pick, not Rent Play actionable, not Smart Parlay safe leg.

## Provider Failure Policy

If The Odds API is unavailable, rate-limited, erroring, stale or quota-exhausted:

- do not silently fall back to stale SportsDataIO odds as actionable price authority;
- expose `NO_FRESH_PRICE`;
- keep SportsDataIO as `FALLBACK_CONTEXT_ONLY` unless a separately certified freshness gate proves it is current enough.

## Polling Economics

Observed league-wide The Odds API request cost: 3 credits.

Recommended budget-conscious cadence:

| Window Before Cutoff | Cadence |
| --- | --- |
| More than 6 hours | 60 minutes |
| 2-6 hours | 15 minutes |
| 30 minutes-2 hours | 10 minutes |
| Under 30 minutes | 5 minutes |

This estimates 37 requests per full MLB operating day:

- 111 credits/day.
- 3,330 credits/30 days.

Because the request is league-wide, the same request count applies to ordinary 10-game and 15-game MLB slates.

## Line Movement Re-Prediction

Do not create a new prediction for every refresh.

Create at most one prediction per unique new exact market identity:

`event + market + selection + line`

If 8.0 moves to 8.5, at most one 8.5 prediction is created after eligibility gates pass. If it remains 8.5 on later refreshes, no duplicate prediction is created.

If the market returns to 8.0, reuse the existing 8.0 prediction only if the feature snapshot and cutoff-safe context remain valid. Otherwise create a new version with lineage.

## Settlement, Performance And Learning

Multiple pregame line versions may exist as prediction evidence.

Settlement is line-specific. Performance and learning must distinguish prediction evidence from recommendation exposure.

Only rows actually exposed as product recommendations should count as recommendation performance. Shadow, superseded, or unexposed line versions remain analytical evidence unless promoted by policy.

## Official Pick Path

Future cutover path:

fresh The Odds API exact-line market -> current-line prediction -> current certified production probability -> implied probability -> edge -> EV -> existing Official Pick gates.

No threshold changes are authorized.

HR-03 calibration remains shadow and must not enter this path silently.

## SportsDataIO Odds Exit

Decision: `SPORTSDATAIO_ODDS_EXIT_READY_AFTER_REPAIR`.

SportsDataIO can stop being production odds authority after lifecycle mapping and executable re-prediction repairs are implemented, deployed and certified.

Full SportsDataIO cancellation is not in scope. Non-odds SportsDataIO dependencies remain.

## Non-Odds SportsDataIO Dependency Preview

Preliminary dependency areas for SDIO-EXIT-01:

- schedules and event identity;
- event status and lifecycle;
- results and final scores;
- team statistics;
- player statistics;
- probable/starting pitchers;
- injuries;
- lineups where present;
- historical/current-season sync;
- settlement result source.

SDIO-EXIT-01 must audit these separately before any subscription decision.
