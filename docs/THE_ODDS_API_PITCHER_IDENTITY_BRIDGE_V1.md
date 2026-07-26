# The Odds API Pitcher Identity Bridge V1

Status: Locally implemented and bounded live-certified.

Date: 2026-07-26

## Scope

This phase resolves the first part of `PITCHER_IDENTITY_NOT_AVAILABLE_FOR_CERTIFIED_FUTURE_EVENT_MAPPINGS` by connecting The Odds API pitcher names to existing canonical MLB pitcher rows through `provider_entity_mappings`.

It does not redesign player props, projections, provider architecture, event crosswalk, Probability Picks or storage. It does not call historical odds, enable scheduled ingestion, calculate EV/Kelly/stake/bankroll, create Official Picks or start Portfolio Intelligence.

## Root Cause

The Odds API `pitcher_outs` payloads expose pitcher identity as `outcome.description` and, in the observed payload, do not include stable provider player ID fields.

The previous sync resolver required same-event projection identity. The certified future event mappings had:

- no active `mlb_starter_assignments` rows for the mapped events
- no stored `mlb_pitcher_projections` rows for the mapped events
- no The Odds API player mappings in `provider_entity_mappings`

Therefore all normalized provider rows were rejected as unresolved even though real sportsbook prop rows were available.

## Matching Contract

Provider player keys are deterministic name keys only when The Odds API does not provide native IDs:

- `provider='the-odds-api'`
- `entity_type='player'`
- `provider_id='name:<normalized-provider-name>'`

Normalization handles uppercase, spacing, punctuation, apostrophes, hyphens, suffixes, middle initials and accent removal.

Persistable classifications:

- `EXACT_MATCH`: existing certified provider mapping.
- `DETERMINISTIC_MATCH`: unique exact full-name canonical pitcher on one mapped event team.

Non-persisted classifications:

- `NORMALIZED_MATCH`
- `AMBIGUOUS`
- `UNKNOWN_PLAYER`
- `TEAM_CONFLICT`
- `EVENT_CONFLICT`
- `STARTER_CONFLICT`

The bridge never persists a normalized-only, ambiguous, unknown or team-conflicted player.

## Live Result

Bounded identity validation used one current The Odds API `pitcher_outs` event call.

Observed provider pitchers:

- Will Warren: `DETERMINISTIC_MATCH`, canonical player `baseball_mlb:mlb:sportsdataio:player:10013936`, team `NYY`, persisted.
- Cristopher Sanchez: `NORMALIZED_MATCH` to canonical `Cristopher Sanchez` with accent in storage, team `PHI`, not persisted because normalized-only matches are review-required in V1.

Persisted player mappings: 1.

## Player Prop Sync Result

After the certified Will Warren mapping existed, the existing player-prop sync was rerun without redesign.

Result:

- Provider calls: 1 per sync run.
- Rows read: 26.
- Rows normalized: 23.
- Rows eligible for storage: 11.
- Rows persisted: 11.
- Stored bookmakers: BetMGM, BetRivers, Bovada, Caesars, DraftKings and FanDuel.
- Unresolved rows: 12, all corresponding to non-persisted normalized-only or unsupported identity rows.

Idempotency rerun with stable row IDs created 0 duplicate rows.

## Comparison Result

Stored prop inventory now reports 11 current recorded-outs prop rows.

Player Prop Market Comparison remains `NO_PROP_AVAILABLE` for displayed projection cards because the stored prop event does not yet have a same-event pitcher projection row. This is correct: genuine sportsbook lines are stored, but comparison must not attach a market line to a different event or a missing projection.

`MARKET_LINE_AVAILABLE` should appear automatically only after a same-event pitcher projection exists for the mapped event and canonical pitcher.

## Remaining Blocker

`SAME_EVENT_PITCHER_PROJECTION_NOT_AVAILABLE_FOR_STORED_PROP_ROWS`

The identity bridge is certified for deterministic player mapping and prop storage activation. Comparison activation remains gated by existing projection/starter availability for the same event.
