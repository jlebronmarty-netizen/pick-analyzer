# Player Prop Multi-Market Expansion V1

Status: LOCALLY IMPLEMENTED - PROJECTION ONLY - LIVE MULTI-MARKET PROVIDER SYNC NOT EXECUTED

This phase extends the certified MLB player-prop architecture beyond Pitcher Outs without redesigning event crosswalk, pitcher identity, storage, comparison, Probability Picks or prediction engines.

## Supported Markets

Canonical markets:

- `pitcher_outs_recorded`
- `pitcher_strikeouts`
- `pitcher_walks`
- `pitcher_hits_allowed`
- `pitcher_earned_runs`
- `batter_hits`
- `batter_total_bases`
- `batter_home_runs`
- `batter_rbi`
- `batter_runs`
- `batter_walks`
- `batter_stolen_bases`

The Odds API provider keys recognized by the local catalog:

- `pitcher_outs`
- `pitcher_pitching_outs`
- `pitcher_strikeouts`
- `pitcher_walks`
- `pitcher_hits_allowed`
- `pitcher_earned_runs`
- `batter_hits`
- `batter_total_bases`
- `batter_home_runs`
- `batter_rbis`
- `batter_rbi`
- `batter_runs_scored`
- `batter_runs`
- `batter_walks`
- `batter_stolen_bases`

## Architecture

The shared market catalog lives in `src/config/mlb-player-prop-markets.ts`.

The ingestion contract in `src/types/mlb-player-prop-ingestion.ts` now supports generic MLB player-prop snapshots while preserving old `PitcherProp*` aliases for compatibility. Normalization still writes to the existing `sports_odds_snapshots` contract and stores player-specific fields in metadata.

The comparison contract in `src/types/mlb-player-prop-comparison.ts` now exposes market family, supported provider keys, stored row counts, bookmaker coverage, market summaries, identity coverage and storage coverage. Existing Pitcher Outs response fields remain backward compatible.

## Storage

No SQL migration was added or applied.

Storage remains:

- table: `sports_odds_snapshots`
- market format: `player_props:<canonical_market_key>`
- event: `event_id`
- player: `metadata.playerId`, `metadata.providerPlayerId`, `metadata.playerName`
- line: `line`
- price: `price`
- sportsbook: `sportsbook`
- provider timestamp: `provider_timestamp` / `snapshot_time`

Deterministic IDs include provider, event, market, player identity, bookmaker, side and line. The storage extension does not fabricate sportsbook, line, price or player rows.

## Comparison

`GET /api/mlb/player-props` accepts optional `market=<canonical_market_key>` and returns:

- `supportedMarkets`
- `marketSummary`
- `availableBookmakers`
- `identityCoverage`
- `storageCoverage`

The comparison service reads stored player-prop rows only. It makes zero provider calls and zero remote mutations. Pitcher Outs keeps its existing probability comparison against certified outs thresholds. Other markets are inventoried and exposed through truthful stored-line/empty-state coverage until same-event projection probability support is certification-ready.

## UI

`/player-projections` adds a prop-market selector inside the existing Player Projections experience. It shows stored row count, bookmaker count and market status for the selected market. The sportsbook comparison panel keeps the required language:

- Projection Only
- No recommendation

## Validation

Focused validation:

```text
node --loader ./scripts/local-ts-loader.mjs scripts/player-prop-multi-market-v1-validate.mjs
```

Local result:

- checks: 11
- passed: 11
- failed: 0
- providerCallsMade: 0
- remoteMutationsMade: 0

`npm.cmd run build` passes.

## Guardrails

This phase did not:

- add EV
- add Kelly
- add bankroll
- add stakes
- add Official Picks
- add Portfolio Intelligence
- add sportsbook recommendations
- apply SQL
- activate epochs
- run imports
- run feature rebuilds
- change prediction engines
- change probabilities, confidence, quality or thresholds
- change Learning Brain
- change scheduler
- change settlement
