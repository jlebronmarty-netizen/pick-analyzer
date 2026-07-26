# MLB Player Prop Market Comparison V1

Status: IMPLEMENTED LOCALLY - NOT PUSHED

MLB Player Prop Market Comparison V1 compares the completed MLB Pitcher Projection Engine output against stored sportsbook player prop markets. It does not improve projections, create recommendations, create Official Picks, calculate EV, calculate Kelly or start Portfolio Intelligence.

## Scope

Supported V1 market:

- Pitcher recorded outs
- Over and Under sides
- Half-out lines: 14.5, 15.5, 16.5, 17.5, 18.5

Future phases may add strikeouts, earned runs, hits allowed, walks and pitch count, but they are not active in V1.

## Data Audit

Current production storage was audited through the existing Supabase REST/service-role client without provider calls.

- Source table: `sports_odds_snapshots`
- Stored MLB `player_props:%` rows: 0
- Current MLB player prop rows in the last 48 hours: 0
- Recorded-outs sportsbook rows available for comparison: 0
- Provider calls: 0
- Remote mutations: 0

The comparison service therefore returns `NO_PROP_AVAILABLE` for current live pitcher-outs projections. It never fabricates sportsbook, line, price, implied probability or market freshness values.

## Contract

Added types in `src/types/mlb-player-prop-comparison.ts`:

- `PitcherPropMarket`
- `PitcherPropLine`
- `PitcherPropComparison`
- `PitcherPropEdge`
- `PitcherPropHealth`

All responses are marked `MODEL_MARKET_COMPARISON_ONLY`.

## Normalization

The service normalizes:

- Over / Under outcomes
- Recorded-outs market aliases
- Supported half-out lines only
- American odds
- Decimal odds
- Implied probability
- Fair American odds
- Fair decimal odds
- Edge in percentage points

Line matching is strict. A model probability for 15.5 is never compared against a sportsbook line of 16.5.

## APIs

- `GET /api/mlb/player-props`
- `GET /api/mlb/player-props/health`
- `GET /api/mlb/player-props/validation`
- `GET /api/mlb/player-props/[pitcherId]`
- `POST /api/mlb/player-props/preview`
- `POST /api/mlb/player-props/generate`

`preview` and `generate` are read-only in V1. They return dry-run persistence metadata and do not write comparison rows.

## UI

The existing Player Projections Pitcher Outs tab now includes a Sportsbook Comparison panel. When no recorded-outs market is stored, it displays:

- No current recorded-outs sportsbook line
- Projection Only
- No recommendation

When market rows are available, the panel displays sportsbook, line, price, implied probability, model probability, difference, fair odds and classification status.

## Guardrails

- No betting recommendations
- No Official Picks
- No EV calculation
- No Kelly calculation
- No bankroll or stake output
- No Portfolio Intelligence
- No scheduler changes
- No settlement changes
- No model formula changes
- No Current Board, Most Likely or Best Value changes

## Validation

Fixture validation covers:

- Negative American odds implied probability
- Positive American odds implied probability
- Fair odds conversion
- Half-line support
- Line mismatch blocking
- Over/Under normalization
- Zero odds returning `N/A` semantics
- Zero provider calls and zero remote mutations

Current live validation is expected to report `NO_PROP_AVAILABLE` comparisons until a licensed player-prop odds feed stores recorded-outs lines.
