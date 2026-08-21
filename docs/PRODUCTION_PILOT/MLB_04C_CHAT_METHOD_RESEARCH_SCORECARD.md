# MLB-04C Chat-Method Research Scorecard

Classification: `MLB_04C_CHAT_METHOD_RESEARCH_SCORECARD_CERTIFIED`

MLB-04C converts the MLB-04A design into a deterministic research-only scorecard contract. It does not create MLB predictions, `CURRENT_ERA_SHADOW` rows, Official Picks, settlement writes, learning labels, calibration rows, scheduler automation or product-visible recommendations.

## Existing Three-Row Ledger

The certified three-row MLB-03 forward ledger remains baseline evidence only:

- clean settled sample: 3
- clean pending sample: 0
- quarantined rows excluded: 1
- W-L-P: 1-2-0
- ROI: -11.33%
- forward sample sufficient for promotion: no

`CHAT_METHOD_COMPARISON_AVAILABLE_FOR_EXISTING_3_ROWS = NO`.

No Chat-Method values are reconstructed for those finished games because no frozen pregame Chat-Method scorecard existed before start.

## Scorecard Components

`MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1` defines seven transparent components:

- `STARTER_EDGE`
- `OFFENSE_EDGE`
- `BULLPEN_EDGE`
- `SPLIT_EDGE`
- `LINEUP_EDGE`
- `CONTEXT_EDGE`
- `MARKET_VALUE`

Each component is bounded from `-1.0` to `+1.0`. Positive values favor the displayed selection; negative values oppose it.

Missing data is not coerced to zero. Missing, blocked or temporally uncertified components remain null with explicit blockers and are excluded from the research composite.

## Input Contracts

Starter evidence may use pregame starter identity, handedness if certified, season and recent prior-game performance, workload and matchup evidence. Every source timestamp must precede event start.

Offense evidence may use prior-game team offense, rolling form, home/away context and certified splits. Same-game stats are blocked.

Bullpen evidence may use prior-game relief workload and aggregate bullpen quality. Missing role or high-leverage availability evidence remains a blocker.

Split evidence is unavailable until handedness and split-source temporal provenance are certified.

Lineup evidence must be tied to the exact snapshot type:

- `MORNING`: projected evidence only when captured before start
- `FINAL_PREGAME`: confirmed or projected evidence only when captured before start and cutoff-safe

Context evidence may use park, weather, injury, rest or travel only when approved timestamped sources exist. Missing weather and injury evidence remain explicit blockers.

Market value requires exact event, market, selection, line, sportsbook, odds, implied probability, raw probability and calibrated probability binding.

## Composite Score

The initial composite score uses equal research weights over available timestamp-safe components only. This is deliberately not optimized against the three-row forward sample.

MLB-04C does not convert the composite score into a probability. `CHAT_METHOD_PROBABILITY_READY = NO`.

## Snapshot Dependency

The scorecard consumes MLB-04B `MORNING` and `FINAL_PREGAME` snapshots by exact snapshot type.

A `MORNING` score cannot use `FINAL_PREGAME` evidence. A `FINAL_PREGAME` score cannot use post-start evidence.

Score deltas between snapshots must identify changes from:

- starter status
- lineup status
- bullpen evidence
- market odds
- market line
- context completeness
- component scores

## Forward Ledger

Future research rows must be frozen before game start and include:

- event
- event start
- snapshot type
- snapshot timestamp
- market
- selection
- line
- sportsbook
- odds
- raw probability
- calibrated probability
- Chat-Method component scores
- Chat-Method composite score if available
- research rank
- research completeness
- methodology version
- result after settlement
- profit after settlement

No retrospective rows are allowed.

## Research Origin

Future persistence, if separately authorized, must use a distinct research origin:

`CHAT_METHOD_RESEARCH_SHADOW`

It must remain:

- `model_role = research_shadow`
- `is_current = false`
- `recommended_pick = false`
- `production_eligible = false`
- `productVisible = false`
- Official Pick = false

## Comparison Policy

Raw, calibrated and Chat-Method research comparison is allowed only for the same betting opportunity:

- event
- market
- selection
- exact line
- sportsbook where possible
- snapshot window

Chat-Method probability metrics remain disabled until a frozen ledger supports calibration. Until then, Chat-Method can be compared by research score, rank, completeness, ROI and later hit-rate or top-N performance.

## Accuracy Claim Guard

No accuracy claim, including an 80% accuracy claim, is valid without frozen pregame ledger rows.

Manual memory, reconstructed history and post-start evidence are not certified performance evidence.

## Historical Replay

Historical replay is not ready for Chat-Method unless every required input has proven as-of provenance. MLB-04C does not fake historical Chat-Method predictions using today-known context.

## Props And NRFI/YRFI

The scorecard components can later support pitcher-prop and NRFI/YRFI research, but only as reusable research ingredients. They do not activate props, NRFI/YRFI, sportsbook prop odds, settlement, or product recommendations.

## Certification Safety

Provider calls: 0

Production database mutations: 0

Prediction writes: 0

Official Pick writes: 0

Settlement writes: 0

Learning/calibration writes: 0

SportsDataIO calls: 0

NFL and NBA runtime changes: 0
