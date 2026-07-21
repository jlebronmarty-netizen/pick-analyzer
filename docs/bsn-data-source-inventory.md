# BSN Data Source Inventory And Contract

Certification: `BSN_SOURCE_INVENTORY_PASS`

Date: 2026-07-21

## Scope

This inventory certifies the BSN source contract and source-legitimacy posture. It does not import data, does not scrape prohibited resources, does not use hidden APIs, does not bypass access controls and does not activate production betting recommendations.

## Production Smoke

Production read-only smoke reported:

- `/api/bsn/sources`: success true, validation 10/10, providerCallsMade 0, source quality status `source_approval_required`.
- `/api/bsn/capabilities`: success true, providerCallsMade 0.
- `/api/bsn/operations/readiness`: success true, providerCallsMade 0, status `prepared_provider_blocked`.
- `/api/bsn/sources/validate`: success true, providerCallsMade 0, empty validation payload returned typed errors/warnings rather than accepting unsupported data.

## Source Inventory

| Source | Legitimacy | Access Method | Authentication | Terms/Robots | Refresh | Historical | Fields | Pagination | Stable IDs | Risk | Reliability | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Official BSN website/homepage | Official | Bounded public HTML snapshot only | None | Terms/robots require caution; no `/api` or `/_next` scraping | 6h cached discovery/foundation only | Limited/unknown | Teams, standings, recent result hints, player/team page evidence | Page-based; not approved for bulk crawl | Team slugs/visible IDs where present | Medium/high without written permission | Official but presentation-fragile | Permissioned feed or CSV |
| Official BSN digital properties/app | Official | Evidence/reference only; do not reverse engineer app traffic | App-managed | Written permission required for integration | Not scheduled | Unknown | Schedule, live results/stats, standings, leaders, rosters advertised | Unknown | Unknown | High without authorization | Strong if authorized | Partner API/export |
| Operator-owned or permissioned CSV | Legitimate when attested | File upload/import contract | Operator supplied | Requires source attestation | Manual/versioned | As supplied | Teams, schedule, results, standings, players, stats, quarter scores, odds if attested | File rows | Required by import schema | Low when attested | Depends on file lineage | Manual QA |
| Manual entry | Legitimate for emergency correction | Audited operator input | Operator auth | Requires reason/audit trail | Manual | Narrow only | Corrections only | N/A | Manual canonical IDs | Medium | Human-dependent | CSV or feed |
| Future permissioned BSN API/feed | Preferred | Partner API/export | Provider auth | Contracted | Provider-defined | Provider-defined | Full canonical domains if contracted | Provider-defined | Provider IDs | Low after contract | Highest | CSV/manual |
| Future licensed sports/odds provider | Legitimate if coverage/licensing verified | Provider API | Provider auth | Subscription terms | Provider-defined | Provider-defined | Odds, results, stats if BSN covered | Provider-defined | Provider IDs | Unknown until verified | Unknown until verified | Official feed |
| Third-party public score sites | Not primary | Do not scrape as production source | None/commercial | Terms review required | Not scheduled | Unknown | Scores/standings hints | Site-specific | Site-specific | High | Third-party | Licensed feed |

## Dataset Contract

| Dataset | Classification | Contract |
| --- | --- | --- |
| Teams | PARTIALLY_SUPPORTED | `sports_teams` through approved official feed, bounded homepage evidence or attested CSV. |
| Seasons | DERIVABLE | Derived from approved schedule/results source; must preserve source season ID. |
| Schedule | PARTIALLY_SUPPORTED | `sport_events`; requires approved feed or attested CSV before production ingestion. |
| Events | PARTIALLY_SUPPORTED | `sport_events`; Puerto Rico timezone, stable source IDs and provider mappings required. |
| Results | PARTIALLY_SUPPORTED | `sport_events`/`game_results`; final scores only from approved source. |
| Standings | PARTIALLY_SUPPORTED | `sport_standings`; official homepage evidence exists but production ingestion requires approved source. |
| Players | PARTIALLY_SUPPORTED | `sport_players`; public evidence exists, trusted roster feed or attested CSV required. |
| Team stats | DERIVABLE | `team_stats`/`sport_game_stats` only from verified results/boxscore data. |
| Quarter scores | BLOCKED | Require official boxscore/feed or attested CSV; do not infer. |
| Box scores | BLOCKED | Require permissioned source/export. |
| Odds | UNAVAILABLE | Unsupported until licensed BSN odds source is verified. |
| Injuries/availability | UNAVAILABLE | No legitimate trusted source integrated. |

## Safe Contract Rules

- No hidden API probing without written authorization.
- No disallowed `/api` or `/_next` scraping.
- No anti-bot bypass.
- No random blogs or unverified social media as canonical data.
- CSV/manual paths require lineage, source timestamp, stable IDs, validation and audit trail before writes.
- Odds remain unsupported unless a licensed source provides market, sportsbook and timestamp lineage.

## Result

BSN Source Inventory and Contract is certified as `BSN_SOURCE_INVENTORY_PASS`.

Production readiness remains blocked by source approval, verified odds and verified boxscore/player-stat coverage. That blocker belongs to later BSN Foundation/Core phases, not this source inventory phase.
