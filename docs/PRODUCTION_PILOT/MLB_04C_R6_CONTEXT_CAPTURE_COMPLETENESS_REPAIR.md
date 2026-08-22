# MLB-04C-R6 Context Capture Completeness Repair

Classification: `MLB_04C_R6_CONTEXT_CAPTURE_COMPLETENESS_REPAIR_CERTIFIED`

MLB-04C-R6 repairs the forward capture path exposed by the first real V2 observation. R4 had certified future score semantics for starter, offense, bullpen and market value, but the MLB-04B persisted snapshot row still froze only the older generic context fields. Observation #2 therefore remained at 1/7 V2 completeness even though stored evidence could support more components.

## Root Cause

- Starter: MLB-04B did not read active `mlb_starter_assignments` rows before falling back to disabled provider schedule evidence.
- Offense: prior-game team offense/recent-form evidence was not extracted into the frozen snapshot.
- Bullpen: raw bullpen coverage reached the row, but normalized directional inputs needed by V2 were not persisted.
- Scorecard: MLB-04C had V2 scoring logic, but no frozen-snapshot consumer that read the exact persisted R6 fields.

## Repair

Future MLB-04B `MORNING` and `FINAL_PREGAME` snapshots now include a future-only research context version:

`mlb_04c_r6_research_context_v1`

The existing table and deterministic snapshot identity remain unchanged. No old snapshot row is mutated. R6 adds fields inside `components`:

- `starterContext`
- `offenseRecentFormContext`
- `bullpenDirectionalInputs`

MLB-04C exports `evaluateMlb04cR6FrozenSnapshotScorecard(...)`, which consumes only the frozen snapshot payload plus exact same-opportunity market evidence.

## Temporal Safety

All R6 context fields remain pregame-only. Team offense uses `sport_game_stats` rows whose source event start is strictly before the target event start. Bullpen inputs use stored team/player evidence and source timestamps that must remain before first pitch. Starter identity uses active stored starter assignments or already-frozen stored lineup/official lineage; no provider call or inferred starter is allowed.

## Missing Data

Missing evidence remains `null` with explicit blockers. R6 does not use league averages, neutral zeros, inferred starters, fabricated lineups, weather substitutes or injury substitutes.

## Scorecard Completeness

The R6 fixture proves that when all supported frozen fields are present:

- `STARTER_EDGE`
- `OFFENSE_EDGE`
- `BULLPEN_EDGE`
- `MARKET_VALUE`

can be available from the persisted snapshot, producing `4/7 = 0.5714` V2 completeness. Real live completeness must still be measured from future frozen evidence and may be lower when source evidence is genuinely absent.

## Isolation

R6 does not change raw models, calibrated models, Official Pick policy, product recommendations, settlement, learning, scheduler automation, SportsDataIO authority, NFL or NBA behavior. It creates no production snapshots during certification and makes zero provider calls.
