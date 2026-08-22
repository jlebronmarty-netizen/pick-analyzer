# MLB-04C-R4 Starter Offense Bullpen Context Recovery

Classification: `MLB_04C_R4_STARTER_OFFENSE_BULLPEN_CONTEXT_RECOVERY_CERTIFIED`

MLB-04C-R4 adds a future-only Chat-Method research scorecard contract for deterministic starter, offense/recent-form and bullpen directional context. It does not modify Observation #1, does not create a Chat-Method probability and does not change raw or calibrated production models.

## Observation #1

Observation #1 remains permanently frozen:

- event: `LAA @ TEX`
- snapshot: `5331e683-46ae-409b-9fe4-5ce0a1ef9721`
- scorecard version: `MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1`
- score: `-0.0296`
- completeness: `0.1429`
- usable component: `MARKET_VALUE`

R4 logic applies only to snapshots created after R4 deployment. The old observation is not retrospectively enriched.

## Versioning

Adding deterministic scoring semantics for `STARTER_EDGE`, `OFFENSE_EDGE` and `BULLPEN_EDGE` is a material behavior change, so future rows use:

`MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2`

V1 remains the immutable contract for Observation #1 and any existing V1 evidence.

## Starter Contract

Starter evidence is accepted only from approved stored or already-captured sources, in priority order:

1. `mlb_starter_assignments`
2. `sport_lineups`
3. MLB Official probable-pitcher evidence already captured in snapshot lineage

Required fields are starter player ID, starter name, handedness when certified, starter status, source, source timestamp, mapping confidence and exact event/gamePk linkage. If certified starter identity is missing, `STARTER_EDGE` is null with an explicit blocker.

Starter source timestamps must be before target event start. No post-start starter substitution or same-game performance may enter a pregame snapshot.

## Offense Contract

Offense evidence uses prior-game data only. The fixed research windows are:

- last 5 games
- last 10 games
- season-to-date baseline
- home/away context

The R4 score is the bounded average of repository-supported deltas, clamped to `[-1,+1]`. Missing or insufficient evidence remains null.

## Bullpen Contract

Bullpen evidence uses prior-game relief workload and performance signals from stored `sport_game_stats` and `sport_player_stats`. The transparent formula uses:

- workload last 1 day
- workload last 3 days
- recent relief performance
- availability penalty proxy

The R4 score is a bounded average clamped to `[-1,+1]`. Missing role or workload evidence remains explicit partial or blocked state.

## Market Direction

Component direction is market-aware:

- Moneyline: team advantage favors the selected team.
- Run Line: team advantage favors the selected team while exact line identity stays external.
- Total: offensive pressure favors Over; starter and bullpen run suppression favor Under.

Unsupported or ambiguous selections fail closed as partial with an explicit directionality blocker.

## Snapshot Semantics

Future snapshots may preserve starter context, offense/recent-form context and bullpen directional inputs with source timestamps, source lineage, feature lineage, missing blockers and temporal cutoff. `MORNING` and `FINAL_PREGAME` remain separate. Later evidence never mutates an earlier snapshot.

## Completeness

Current full-method completeness for Observation #1 remains `1 / 7 = 0.1429`.

R4 projected completeness for future rows with supported evidence is:

`4 / 7 = 0.5714`

The target components are `STARTER_EDGE`, `OFFENSE_EDGE`, `BULLPEN_EDGE` and `MARKET_VALUE`.

## Derivative Reuse

R4 improves the research foundation for pitcher props and NRFI/YRFI but does not activate either domain.

Pitcher props still require prop odds, line-specific prop models and prop settlement. NRFI/YRFI still requires top-order lineup context, park/weather where applicable, market odds, inning-specific features and settlement runtime.

## Safety

Provider calls: 0

Production database mutations: 0

Prediction writes: 0

Current Era Shadow writes: 0

Chat research prediction writes: 0

Official Pick writes: 0

Settlement writes: 0

Learning/calibration writes: 0

Product writes: 0

SportsDataIO calls: 0

NFL and NBA runtime changes: 0
