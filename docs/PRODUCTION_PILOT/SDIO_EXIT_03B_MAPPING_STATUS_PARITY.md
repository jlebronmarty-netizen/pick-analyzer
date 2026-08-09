# SDIO-EXIT-03B Mapping And Status Parity

Status: `SDIO_EXIT_03B_REPAIR_READY_FOR_NATURAL_PROOF`

Starting commit: `5c56bbf206c1fd035bfed2413efbf8a4dd6ed4e8`

## Scope

SDIO-EXIT-03B audits and repairs the remaining MLB official shadow mapping and status parity gaps found by the natural SDIO-EXIT-03A proof. It does not promote `MLB_OFFICIAL_PRIMARY`, does not disable SportsDataIO, does not promote The Odds API, and does not change prediction, settlement, learning, Official Pick or odds authority behavior.

## Certified Baseline

Two natural Vercel primary scheduler runs on `2026-08-09` executed the MLB official shadow path:

| Run | Source | Action | MLB Stats API Calls | Returned | Mapped | Ambiguous | Duplicates | Starters |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `2026-08-09T22:57:27Z` | Vercel primary | `midday_refresh` | 1 | 15 | 13 | 2 | 0 | 26 |
| `2026-08-09T23:07:27Z` | Vercel primary | `midday_refresh` | 1 | 15 | 13 | 2 | 0 | 26 |

Certification reads made 0 provider calls and 0 database mutations.

## Ambiguous Events Before Repair

| Official Game | gamePk | Start | Root Cause |
| --- | ---: | --- | --- |
| Chicago Cubs @ Kansas City Royals | `824078` | `2026-08-09T18:10:00Z` | `START_TIME_TOLERANCE_TOO_WIDE` plus missing full-name aliases. Canonical events at the same start used abbreviations (`CHC @ KC`, `MIN @ MIL`, `CLE @ CHW`), so the broad fallback saw multiple equal-distance candidates. |
| Tampa Bay Rays @ Seattle Mariners | `823104` | `2026-08-09T20:10:00Z` | `START_TIME_TOLERANCE_TOO_WIDE` plus missing full-name aliases. Canonical events at the same start used abbreviations (`TB @ SEA`, `LAD @ ARI`), so the broad fallback saw multiple equal-distance candidates. |

The corresponding canonical events already existed:

| Official Game | Canonical Event | SportsDataIO ID | The Odds API ID |
| --- | --- | --- | --- |
| CHC @ KC | `baseball_mlb:mlb:sportsdataio:event:79060` | `79060` | `d9bb4855e4ed5d8ae038db62356ed74f` |
| TB @ SEA | `baseball_mlb:mlb:sportsdataio:event:79066` | `79066` | `aaff9f9ccf0ff2965b6e7fa5604c211d` |

## Repair

`src/services/mlb-official-replacement.service.ts` now resolves official MLB events by:

1. existing `mlb_stats_api` gamePk crosswalk;
2. exact home and away canonical team aliases;
3. exact operating date;
4. game number when canonical doubleheader metadata exists;
5. bounded start-time tolerance;
6. fail-closed ambiguity when multiple candidates remain.

Team+date alone is not sufficient evidence. Same-team doubleheaders must remain distinct, same-start games must not collide, and same-matchup adjacent dates must not cross-map.

Offline fixture remap after repair:

| Metric | Value |
| --- | ---: |
| Expected mappable | 15 |
| Mapped | 15 |
| Mapping rate | 100% |
| Ambiguous | 0 |
| Duplicate canonical events | 0 |

## Status Discrepancies

The latest natural run reported 12 official-vs-canonical status differences:

| Classification | Count | Safety |
| --- | ---: | --- |
| `CANONICAL_STATUS_LAG_FINAL_NON_ACTIONABLE` | 11 | Safe during shadow. Production pregame behavior already uses start/cutoff windows and current lifecycle logic; official status is not yet authoritative. |
| `CANONICAL_STATUS_LAG_LIVE_NON_ACTIONABLE` | 1 | Safe during shadow. The event is post-start by time window and not eligible for normal pregame prediction generation. |

Unsafe post-start prediction risk: `0`.

## Status Contract

MLB official status normalization remains:

| Official State | Canonical Status | Lifecycle |
| --- | --- | --- |
| Scheduled / Preview / Pregame / Warmup | `scheduled` | `SCHEDULED` or `STATUS_UNCONFIRMED` |
| In Progress | `live` | `LIVE` |
| Delayed | `postponed` | `DELAYED` |
| Suspended | `postponed` | `SUSPENDED` |
| Postponed | `postponed` | `POSTPONED` |
| Cancelled | `cancelled` | `CANCELLED` |
| Final / Completed Early | `completed` | `FINAL` |

Unknown official statuses fail closed as unconfirmed and are not treated as promotion-ready evidence.

## Starter Parity

The natural proof returned 26 probable starters per run. The shadow path persisted 26 player mappings, all marked `shadowOnly`. No cross-team starter error was observed in the available ledger. Detailed starter parity against SportsDataIO-era starter evidence remains a natural-proof follow-up before primary promotion.

## Provider Crosswalk

Event crosswalk status after repair:

- SportsDataIO event ID remains production authority.
- The Odds API event ID remains shadow odds evidence.
- MLB official `gamePk` can be attached as shadow provider mapping after the next natural run.
- Existing SportsDataIO lineage is preserved.

Player crosswalk status:

- MLB official person IDs are persisted only as shadow `provider_entity_mappings` rows.
- SportsDataIO player IDs remain historical/legacy evidence where present.
- No name-only permanent player mapping is created when official person ID exists.

## Promotion Decision

Current classification: `MLB_OFFICIAL_SHADOW_PASS_MORE_OBSERVATION_REQUIRED`.

Reason: the deterministic repair is local and offline-certified, but it must still be observed through at least two post-deploy natural MLB official shadow executions. Promotion remains blocked until natural evidence confirms expected mappable games map with 0 ambiguous, 0 duplicates, safe status classifications, healthy starter mapping, healthy scheduler, healthy settlement and rollback retained.
