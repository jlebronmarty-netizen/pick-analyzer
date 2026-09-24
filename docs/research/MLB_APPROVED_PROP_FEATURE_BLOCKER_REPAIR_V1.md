# MLB Approved Prop Feature Blocker Repair V1

Status: RESEARCH/SHADOW-ONLY operational repair.

## Problems repaired

1. The canonical slate reconciler was imported by the Run Line forward route but never executed.
2. Pitcher ER O1.5 requires canonical target-day pitcher k_rate rows, but target-day pitcher features were not materialized consistently.
3. Batter Walks U0.5 was blocked by a target-day batter feature row that is not an input to its projection. Its real inputs are strict-prior batter game logs.

## Repair

- Reconcile MLB Official current slate before Run Line freezes and before the Statcast daily research flow.
- Materialize only missing probable-pitcher daily features for future games from canonical 2026 Statcast rows with game_date < target_date.
- Preserve the 01D definitions for PA, K, BB, strikes, swings, whiffs, called strikes, release speed and first-inning context.
- Create canonical feature snapshots and pitcher daily rows only; no bullpen/batter/matchup/first-inning DML.
- For Batter Walks only, remove the redundant target-day batter feature requirement. Projection and threshold remain unchanged and still read only strict-prior game logs.

## Boundaries

- no model/threshold changes
- no Official Picks
- APOSTAR disabled
- no historical Odds API
- no fuzzy identity
- strict-pregame only
- feature writes limited to missing pitcher snapshots + pitcher daily rows
- no batter feature writes
- no production promotion
