# MLB Player Props Data Readiness Audit V1

Status: Implemented as an audit-only readiness layer.

## Scope

This phase audits whether MLB player props can be supported by stored player data, identity mappings, settlement evidence, sportsbook odds and provider coverage. It does not activate player props.

Audited pitcher props:

- Pitcher Strikeouts
- Outs Recorded
- Hits Allowed
- Earned Runs
- Walks
- Pitcher Win
- Pitching Outs

Audited batter props:

- Hits
- Singles
- Doubles
- Triples
- Home Runs
- RBIs
- Runs
- Walks
- Stolen Bases
- Total Bases
- Hits + Runs + RBIs

## APIs

- `/api/mlb/player-props/readiness`
- `/api/mlb/player-props/mapping-diagnostics`
- `/api/mlb/player-props/provider-audit`

All routes are read-only and report `providerCallsMade=0` and `remoteMutationsMade=0`.

## Dashboard And AI Operations

- Dashboard Advanced Details > Markets includes the MLB Player Props Data Readiness Audit panel.
- AI Operations includes an `mlb_player_props_readiness` panel.

Both surfaces keep player props separate from Current Board, Most Likely, Best Value and Official Picks.

## Findings Contract

The audit separates:

- historical outcome availability
- current player-stat availability
- historical player logs
- historical lineup data
- current lineup data
- player/provider mapping coverage
- current sportsbook player-prop odds
- historical sportsbook player-prop odds
- opening lines
- closing lines
- line movement
- deterministic historical settlement feasibility
- prediction, learning and calibration blockers

Settlement data may exist while production prop readiness remains blocked. That state is expected and must not be displayed as a bettable market.

## Public Data Source Recommendations

- Retrosheet: historical play-by-play, event files, lineups and outcome reconstruction. Source: https://www.retrosheet.org/
- Retrosheet CSV downloads: structured historical exports. Source: https://www.retrosheet.org/downloads/csvdownloads.html
- Lahman/SABR Baseball Database: season-level batting, pitching, fielding and identity history. Source: https://sabr.org/lahman-database/
- Baseball Savant Statcast CSV documentation: MLBAM IDs, pitch-level and batted-ball fields. Source: https://baseballsavant.mlb.com/csv-docs
- Chadwick Bureau register: crosswalk identity data for MLBAM, Retrosheet, Baseball-Reference and FanGraphs-style keys. Source: https://www.chadwick-bureau.com/
- Community-documented MLB Stats API: possible no-auth schedule, roster and stat discovery after usage-policy review. Source: https://github.com/pseudo-r/Public-MLB-API

Paid provider coverage is still required for production-grade current player-prop lines, over/under prices, sportsbook identity, snapshots, opening lines, closing lines and line movement.

## Guardrails

- No player-prop predictions created.
- No Official Picks created.
- No Best Value or Most Likely prop activation.
- No Learning Brain modification.
- No production model weight modification.
- No Historical Replay modification.
- No Historical Feature Store modification.
- No provider calls.
- No Supabase mutations.

## Certifications

- `PLAYER_PROP_DATA_AUDIT_PASS`
- `PLAYER_MAPPING_AUDIT_PASS`
- `PLAYER_SETTLEMENT_AUDIT_PASS`
- `PLAYER_PROVIDER_AUDIT_PASS`
- `PLAYER_PROP_READINESS_PASS`

`PLAYER_PROP_READINESS_PASS` means the readiness audit is implemented and reports blockers. It does not mean player props are production-ready.
