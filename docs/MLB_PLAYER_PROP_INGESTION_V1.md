# MLB Player Prop Ingestion V1

Status: LOCALLY IMPLEMENTED AS FAIL-CLOSED INGESTION PIPELINE - LIVE PROVIDER PERSISTENCE BLOCKED

MLB Player Prop Ingestion V1 adds the provider-to-storage pipeline contract for pitcher recorded-outs prop markets. It does not calculate EV, compare probabilities, recommend bets, create Official Picks, build parlays, modify portfolio logic or change the MLB Pitcher Projection Engine.

## Scope

Supported V1 market:

- Pitcher recorded outs
- Over and Under selections
- Half-out lines: 14.5, 15.5, 16.5, 17.5, 18.5

## Provider Audit

SportsDataIO:

- The repository catalogs MLB enterprise `/v3/mlb/odds/json/BettingPlayerPropsByGameID/{gameId}`.
- The active MLB channel is modeled as SportsDataIO Discovery Lab.
- Discovery Lab confirmed endpoints do not include `BettingPlayerPropsByGameID`.
- Enterprise player-prop entitlement is not confirmed for the current subscription.
- Result: blocked for live recorded-outs ingestion until contract and entitlement are verified.

The Odds API:

- Current documentation lists MLB `pitcher_outs` player props.
- Business plan or higher is required for player props.
- The repository/runtime does not prove current Business-tier entitlement.
- Stored events currently use SportsDataIO IDs; a safe crosswalk to The Odds API event IDs is not proven.
- Result: blocked for live recorded-outs ingestion until tier, event identity and sportsbook coverage are verified.

Current stored production coverage remains:

- `sports_odds_snapshots` recorded-outs prop rows: 0
- Sportsbooks: 0
- Current provider calls from this module: 0
- Remote mutations from this module: 0

## Canonical Contract

Added `src/types/mlb-player-prop-ingestion.ts`:

- `PitcherPropSnapshot`
- `PitcherPropLine`
- `PitcherPropBook`
- `PitcherPropMarket`
- `PitcherPropHealth`

Canonical snapshot fields include event, pitcher, provider pitcher ID, market, line, selection, sportsbook, American odds, decimal odds, implied probability, provider timestamp, stored timestamp, snapshot ID, provider and source version.

## Normalization

The ingestion service normalizes:

- Provider market `pitcher_outs` to stored market `player_props:pitcher_outs_recorded`
- Over and Under outcomes
- Bookmaker names and IDs
- Half-out supported lines only
- American odds
- Decimal odds
- Implied probability
- Provider timestamps
- Deterministic snapshot IDs

Unsupported integer lines, unsupported markets and malformed outcomes are skipped.

## Storage

The existing `sports_odds_snapshots` table is compatible and reused.

Player prop specifics are stored in `metadata` because the table does not have first-class player columns. Stored rows are comparison-compatible:

- `market`: `player_props:pitcher_outs_recorded`
- `outcome`: `over` or `under`
- `line`: supported half-out line
- `price`: American odds
- `snapshot_time` and `provider_timestamp`: provider update time
- `metadata`: player/provider/player-prop contract details and safety flags

No new migration is required.

## Sync Service

Added `src/services/mlb-player-prop-sync.service.ts`.

Responsibilities:

- Provider audit
- Normalization
- Storage row shaping
- Health
- Validation
- Dry-run sync reporting
- Protected write gate

Live provider execution fails closed until provider contract, tier, event identity and sportsbook coverage are confirmed. Dry-run returns zero provider calls and zero mutations.

## API

Added:

- `POST /api/mlb/player-props/sync`

Extended existing additive player-prop surfaces:

- `GET /api/mlb/player-props/health` now includes ingestion health.
- `GET /api/mlb/player-props/validation` now includes ingestion deterministic fixtures.
- `GET /api/mlb/player-props/provider-audit` now includes ingestion provider audit.

Non-dry-run sync requires authorization and still blocks when provider entitlement is not proven.

## Scheduler

No scheduler was added.

The ingestion service is designed to be callable only from the existing operating-day/adaptive-refresh ownership path after the provider gate is satisfied. Until then it remains manual/API dry-run only and reports `BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE`.

## Validation

Deterministic validation covers:

- Supported half-line filtering
- Over/Under normalization
- American-to-decimal conversion
- American-to-implied probability conversion
- Storage market compatibility with comparison V1
- Lowercase stored outcomes
- Deterministic duplicate-safe IDs
- No recommendation, EV, Official Pick or portfolio metadata

## Certifications

Current local status:

- `PLAYER_PROP_PROVIDER_PASS`: blocked for live provider use; audit pass for identifying the blocker.
- `PLAYER_PROP_NORMALIZATION_PASS`: implemented by deterministic fixtures.
- `PLAYER_PROP_STORAGE_PASS`: implemented against existing `sports_odds_snapshots` row contract.
- `PLAYER_PROP_SYNC_PASS`: dry-run/protected sync implemented; live sync blocked by provider gate.
- `PLAYER_PROP_HEALTH_PASS`: implemented.
- `PLAYER_PROP_API_PASS`: implemented locally.
- `NO_DUPLICATE_PROP_ROWS_PASS`: deterministic IDs implemented and fixture-validated.
- `NO_CERTIFIED_PLATFORM_REGRESSION_PASS`: expected, pending build.

## Hard Blockers

- SportsDataIO MLB enterprise player-prop entitlement is not confirmed.
- The Odds API Business-tier entitlement is not confirmed.
- The Odds API event ID crosswalk is not proven.
- Current stored recorded-outs prop coverage is zero.

Player Prop EV V2 and Portfolio Intelligence were not started.
