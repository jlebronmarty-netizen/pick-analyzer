# The Odds API Event Crosswalk And Live Player Prop Ingestion Enablement V1

Status: Locally implemented and bounded live-certified.

Date: 2026-07-26

## Scope

This module resolves the prior `ODDS_API_EVENT_CROSSWALK_NOT_PROVEN` blocker for current MLB events by adding a deterministic The Odds API event crosswalk into existing `sport_events`, then using only certified event mappings for a tightly bounded manual `pitcher_outs` player-prop sync path.

It does not call historical odds endpoints, enable scheduled ingestion, calculate EV, Kelly, stake or bankroll, create Official Picks, alter Probability Picks, change pitcher projection formulas or start Portfolio Intelligence.

## Crosswalk Contract

- Route: `POST /api/providers/the-odds-api/event-crosswalk`
- Dry-run and validation modes make `providerCallsMade: 0`.
- Live mode requires `confirm=ODDS_API_EVENT_CROSSWALK`.
- Persist mode requires `confirm=ODDS_API_EVENT_CROSSWALK_PERSIST`.
- Live crosswalk reads only `GET /v4/sports/baseball_mlb/events`.
- Persist writes only deterministic, non-ambiguous event mappings into `provider_entity_mappings`.
- Normal GET requests do not consume provider credits.

Matching rules:

- Normalize MLB team identities from The Odds API full names and existing internal abbreviations.
- Match candidate games by exact canonical home team, away team and bounded UTC start-time tolerance.
- Reject ambiguous matches, duplicate provider IDs, duplicate internal IDs, stale internal events and invalid team identity.
- Keep doubleheaders deterministic by requiring the time component to disambiguate games.

Root cause of the prior blocker:

- Existing internal `sport_events` rows used SportsDataIO-backed event IDs and team abbreviations.
- The Odds API returned independent provider event IDs plus full MLB team names.
- No `provider_entity_mappings` rows existed for `provider='the-odds-api'`, `sport_key='baseball_mlb'`, `entity_type='event'`.

## Bounded Live Evidence

Live event crosswalk used 1 provider events call and performed no mutation in review mode.

Observed review result:

- Provider events evaluated: 13
- Internal events evaluated: 26
- Deterministic matches: 13
- Exact provider-ID matches: 0
- Ambiguous matches: 0
- Unmatched provider events: 0
- Duplicate provider mappings: false
- Duplicate internal mappings: false

Persist mode was then executed with the persist confirmation:

- Provider calls: 1
- Rows persisted: 13
- Remote mutations: 13
- Ambiguities persisted: 0
- Provider quota remained unchanged for the events endpoint in the observed response headers.

No API key, authorization header or provider secret is documented or returned.

## Manual Pitcher Outs Sync Contract

- Route: `POST /api/mlb/player-props/sync`
- Dry-run remains default and makes `providerCallsMade: 0`, `remoteMutationsMade: 0`.
- Live sync requires `live=true` and `confirm=MLB_PLAYER_PROP_SYNC`.
- Maximum events are capped at 3.
- Only certified The Odds API event mappings are eligible.
- Only pregame/current future mapped events are eligible.
- Only market `pitcher_outs` is read.
- Only supported recorded-outs lines `14.5`, `15.5`, `16.5`, `17.5` and `18.5` are normalized.
- Rows are persisted into existing `sports_odds_snapshots` with deterministic IDs.

The sync stores real provider sportsbook rows only. It does not fabricate lines, prices, player names, sportsbook names or market availability.

Pitcher identity rules:

- The Odds API player description is matched against the current MLB pitcher projection slate for the certified internal event.
- Rows with unresolved pitcher identity are rejected from persistence.
- If provider rows exist but all pitcher identities are unresolved, the sync reports `VALIDATION_FAILED` with `ALL_PITCHER_IDENTITIES_UNRESOLVED`.
- A truthful zero-row response is allowed when the provider returns no current `pitcher_outs` rows for the bounded certified event set.

## Storage

No migration is introduced.

The module reuses:

- `provider_entity_mappings` for certified event mappings.
- `sports_odds_snapshots` for sportsbook prop snapshots.

Stored prop metadata includes provider event ID, provider market key, player identity when certified, decimal odds, implied probability and explicit non-recommendation flags:

- `noRecommendation: true`
- `evCalculated: false`
- `officialPickEligible: false`
- `portfolioEligible: false`

## Guardrails

- No historical odds endpoints are called.
- No scheduled ingestion is enabled.
- No provider payload secrets are logged or documented.
- No EV, Kelly, bankroll, stake, Official Pick or Portfolio Intelligence logic is introduced.
- Probability Picks and certified platform release marker remain unchanged.
- Player Prop EV V2 remains not started.
- Portfolio Intelligence remains not started.

## Remaining Blockers

- Continued live use depends on The Odds API entitlement remaining valid for event-level player props.
- Pitcher identity must resolve through current pitcher projection/starter evidence before rows can be stored.
- Player prop settlement, replay, calibration and recommendation policy remain separate future approval gates.
- Historical prop backtesting remains unproven because historical odds endpoints were intentionally not called.
