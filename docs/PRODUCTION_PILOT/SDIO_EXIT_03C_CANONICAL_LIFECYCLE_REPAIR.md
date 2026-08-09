# SDIO-EXIT-03C Canonical Mapping And Lifecycle Repair

Status: `SDIO_EXIT_03C_REPAIR_READY_FOR_NATURAL_PROOF`

Starting commit: `db0947b066e215a0aec313554717a40d5d9400f2`

## Scope

SDIO-EXIT-03C repairs the production divergence found after SDIO-EXIT-03B. It does not promote `MLB_OFFICIAL_PRIMARY`, disable SportsDataIO, promote odds authority, change prediction policy, change settlement, or change learning.

## Production Evidence Before Repair

Two consecutive natural MLB official shadow runs after `db0947b` returned:

| Run | Source | Action | Returned | Mapped | Unmapped | Ambiguous | Duplicates | Starters |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `2026-08-09T23:27:51Z` | Vercel primary | `midday_refresh` | 15 | 13 | 2 | 0 | 0 | 26/26 |
| `2026-08-09T23:37:52Z` | Vercel primary | `midday_refresh` | 15 | 13 | 2 | 0 | 0 | 26/26 |

The unmapped games were:

- `824078`, Chicago Cubs @ Kansas City Royals, `2026-08-09T18:10:00Z`
- `823104`, Tampa Bay Rays @ Seattle Mariners, `2026-08-09T20:10:00Z`

Both canonical SportsDataIO-backed `sport_events` rows existed in the production operating-day event universe:

| Official Game | Canonical Event | Canonical Teams | Canonical Start | Embedded MLB gamePk |
| --- | --- | --- | --- | --- |
| CHC @ KC | `baseball_mlb:mlb:sportsdataio:event:79060` | `CHC @ KC` | `2026-08-09T18:10:00+00:00` | `824078` |
| TB @ SEA | `baseball_mlb:mlb:sportsdataio:event:79066` | `TB @ SEA` | `2026-08-09T20:10:00+00:00` | `823104` |

## Offline vs Production Difference

The SDIO-EXIT-03B offline fixture proved exact team/date/start mapping. Natural production still failed because the production canonical rows already had `provider_ids.mlb_stats_api` / `provider_ids.mlb_stats_game_pk`, while the shadow mapper only read durable `provider_entity_mappings` before falling back to team/date/start rules.

For these two games the separate `provider_entity_mappings` crosswalk was missing, but the canonical `sport_events.provider_ids` identity was already exact. Ignoring that embedded provider identity caused the mapper to continue into the fallback path and ultimately return `no_start_time_candidate` for both games.

The production event universe is the canonical America/Puerto_Rico operating-day `sport_events` range. The two repaired games are not date-boundary cases: official MLB date, UTC start, and canonical UTC start all fall inside the same Puerto Rico operating-day scope.

Root cause: `PROVIDER_IDS_GAMEPK_NOT_USED_AS_MATCH_SOURCE`.

## Repair

`src/services/mlb-official-replacement.service.ts` now applies this deterministic hierarchy:

1. existing `provider_entity_mappings` MLB gamePk crosswalk;
2. exact `sport_events.provider_ids.mlb_stats_api` or `sport_events.provider_ids.mlb_stats_game_pk`;
3. exact home and away canonical team aliases;
4. exact operating date;
5. game number when canonical doubleheader metadata exists;
6. bounded start-time tolerance;
7. fail-closed ambiguity when multiple candidates remain.

The new provider-id path is exact identity, not fuzzy matching. If multiple canonical rows claim the same MLB gamePk, the mapper fails closed as ambiguous.

## Lifecycle Classification

The latest natural runs still showed 12 status differences where official MLB had `completed` and canonical SportsDataIO-backed rows were still `scheduled`.

These are now classified in shadow metadata:

| Classification | Meaning | Action |
| --- | --- | --- |
| `CANONICAL_STATUS_LAG_FINAL_NON_ACTIONABLE` | Official final/completed, canonical still pregame. | Shadow evidence only; not authority promotion. |
| `CANONICAL_STATUS_LAG_LIVE_NON_ACTIONABLE` | Official live/in-progress, canonical still pregame. | Shadow evidence only; not authority promotion. |
| `CANONICAL_STATUS_LAG_TERMINAL_NON_ACTIONABLE` | Official postponed/cancelled/suspended, canonical still pregame. | Shadow evidence only; not authority promotion. |
| `REQUIRES_REVIEW` | Any other status mismatch. | Blocks parity review until classified. |

This repair does not write official statuses into canonical `sport_events`. SportsDataIO remains product data authority during `DUAL_READ`.

## Safety Veto

No additional production prediction veto was required in this bounded repair because the existing pregame safety model already gates normal recommendation/write paths by canonical `start_time` and cutoff windows. The official status comparison remains a shadow safety signal until primary promotion.

Post-start prediction writes from certification: `0`.

## Result Identity

For mapped completed games, official `gamePk` resolves to the same canonical `sport_event` used by schedule/status and downstream result identity. The two unmapped completed games were the high-priority repair target and should resolve after deployment through the embedded provider-id path.

## Promotion Gate

Current verdict: `MLB_OFFICIAL_SHADOW_PASS_MORE_OBSERVATION_REQUIRED`.

Promotion to parity review still requires at least two post-deploy natural MLB official shadow executions showing:

- expected-mappable mapping at 100%;
- CHC @ KC mapped;
- TB @ SEA mapped;
- ambiguous events = 0;
- duplicate events = 0;
- all status discrepancies classified;
- unsafe lifecycle mismatches = 0;
- starter mapping healthy;
- scheduler healthy;
- settlement healthy;
- SportsDataIO rollback retained.
