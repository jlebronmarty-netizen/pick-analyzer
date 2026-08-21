# MLB-04B Morning / Final-Pregame Snapshot Runtime

Classification: `MLB_04B_MORNING_FINAL_PREGAME_SNAPSHOT_RUNTIME_CERTIFIED`

MLB-04B turns the MLB-04A research design into a guarded snapshot runtime for immutable `MORNING` and `FINAL_PREGAME` context evidence. It does not create MLB predictions, Official Picks, settlement rows, learning labels, scheduler automation or product-visible recommendations.

## Existing Infrastructure Reused

The runtime reuses the existing `mlb_context_snapshots` persistence contract from MLB-01. That table already supports `MORNING`, `FINAL_PREGAME` and `CURRENT_PROBE`, but MLB-04B only accepts `MORNING` and `FINAL_PREGAME`.

`CURRENT_PROBE` is not a substitute for either research snapshot because it has a different temporal meaning.

## Snapshot Identity

Each research snapshot identity includes:

- `sport_key`
- `event_id`
- `snapshot_type`
- `capture_window`
- `methodology_version`

`MORNING` and `FINAL_PREGAME` snapshots for the same event are intentionally distinct. Repeated execution must reuse the deterministic identity rather than overwrite prior evidence or create duplicates.

## Temporal Contract

Every accepted snapshot must satisfy:

- capture timestamp before event start
- source timestamps before event start
- explicit blocker for missing weather
- explicit blocker for missing injury evidence
- no post-start lineup, odds, result, settlement or same-game-stat evidence

Retrospective morning fabrication is blocked.

## Runtime Guard

Dry-run is the default. Persistence requires an explicit execute path and:

`MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED=true`

This phase did not perform the future persistence proof.

## Dry-Run Result

The local certification uses forward-safe current-event fixtures to prove both contracts without backfilling a retrospective morning window:

- `MORNING`: eligible 1, skipped 0
- `FINAL_PREGAME`: eligible 1, skipped 0

Provider calls: 0

Production database mutations: 0

Prediction writes: 0

## Research Ledger Foundation

The runtime prepares the evidence foundation needed by a later research scorecard ledger. That future ledger may rank or score components, but it must not emit copied ChatGPT probabilities or calibrated probabilities until frozen pregame evidence supports calibration.

## Blocked Market Families

Pitcher props remain foundation-only and not product-ready.

NRFI/YRFI remains blocked.

Player props were not started.
