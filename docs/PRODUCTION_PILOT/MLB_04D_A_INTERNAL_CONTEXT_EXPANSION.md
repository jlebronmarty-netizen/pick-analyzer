# MLB-04D-A Internal Context Expansion

Classification: `MLB_04D_A_INTERNAL_CONTEXT_EXPANSION_CERTIFIED`

MLB-04D-A audits and prepares forward-only internal context for starting pitchers, projected/confirmed lineups and park or venue identity. It uses only already stored repository evidence. It does not create Observation #4, does not persist a snapshot, does not mutate prior observations, does not call providers and does not activate scheduler automation.

## Frozen Observations

Observation #1 remains frozen on `MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1`. Observations #2 and #3 remain frozen on `MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2`. Package A does not backfill, enrich, rescore or rewrite any of them.

## Starting Pitchers

Starter identity can be captured forward from stored sources in this order:

1. active `mlb_starter_assignments`;
2. stored `sport_lineups` rows with starting-pitcher role evidence;
3. already captured MLB Official probable-pitcher lineage linked by canonical event/gamePk mapping.

The state contract is `CONFIRMED`, `PROBABLE`, `PROJECTED`, `UNKNOWN`. Each frozen team-side payload must preserve player id, name if available, throwing hand if certified, status, source, source timestamp, effective timestamp, event id, gamePk if known, mapping confidence and blockers. Morning rows remain immutable if the starter changes before final pregame.

Starter identity capture is forward-ready. `STARTER_EDGE` remains partial unless frozen, pregame-safe pitcher scoring fields are present.

## Lineups

Lineup evidence can be frozen from:

- `sport_lineups`;
- already captured MLB Official batting-order lineage;
- stored season player stats used only as a `PROJECTED` lineup source.

Projected lineups must never be relabeled as confirmed. Confirmed lineup readiness is partial because it depends on pregame confirmed batting-order evidence actually being stored before first pitch. The future payload supports lineup state, source, timestamp, event/gamePk linkage, batting-order entries 1-9, player identity, player name, batting side if certified, position/role and mapping status.

`LINEUP_EDGE` remains partial. A future scoring rule would be a material scorecard semantic change and must be versioned before activation.

## Park / Venue

Park identity can be frozen forward from `sport_events.venue` and already stored MLB Official venue lineage. The payload may include venue id if certified, venue name, city, indoor/outdoor, roof type/state and surface only when those fields are actually stored with provenance.

No certified park-factor source exists in this package. Venue identity improves context transparency but does not make `CONTEXT_EDGE` available by itself. Weather and injuries remain external dependencies.

## Splits

Splits remain audit-only. Pitcher handedness is partial; batter handedness, team versus LHP/RHP, batter platoon splits and pitcher platoon splits are not consistently as-of certified. `SPLIT_EDGE` remains blocked by temporal provenance.

## Snapshot And Scorecard Versioning

Package A uses additive fields inside the existing frozen snapshot `components` payload. No migration is applied and old rows are immutable. Capture-only availability improvements keep MLB-04C V2 semantics unchanged. A V3 scorecard is required before `LINEUP_EDGE` or `CONTEXT_EDGE` scoring semantics change.

The scorecard must read only frozen snapshot evidence. Missing context remains `null` plus an explicit blocker, never a neutral zero.

## Completeness

Current real completeness remains `3/7 = 0.4286` from `OFFENSE_EDGE`, `BULLPEN_EDGE` and `MARKET_VALUE`.

Projected post-Package-A completeness is `4/7 = 0.5714` only when starter identity and starter scoring fields are present in a future frozen snapshot. `LINEUP_EDGE`, `SPLIT_EDGE` and `CONTEXT_EDGE` are not counted as available in this package.

## Package D Compatibility

Package A remains consumable by the Package D automation-prep lifecycle. No scheduler changes, cron changes, ledger migration, provider calls or write paths are added.

## Props And NRFI

Starter identity and projected top-order lineups help future pitcher-prop and NRFI research, but no prop prediction, NRFI/YRFI prediction, odds ingestion, settlement, calibration or product activation occurs in this phase.
