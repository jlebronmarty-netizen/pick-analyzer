# BSN Data Acquisition Strategy

Last audited: 2026-07-18

Status: discovery complete enough to choose a safe long-term strategy. No production import was implemented.

## Executive Decision

The best long-term BSN data acquisition strategy is:

1. Primary: official BSN permissioned data access or a written partner feed.
2. Secondary: operator-owned CSV import using the BSN source framework as a controlled fallback.
3. Emergency: manual entry for narrow operational corrections only.
4. Future: commercial/provider API if BSN coverage, licensing and market/odds lineage are verified.

Public BSN web/app surfaces are strong evidence that official data exists, but current robots and terms make automated scraping unsuitable for production without written authorization.

## Audit Scope

Discovery used bounded requests against official public surfaces:

- `https://www.bsnpr.com/`
- `https://www.bsnpr.com/robots.txt`
- `https://bsnpr.com/sitemap.xml`
- `https://www.bsnpr.com/calendario`
- `https://www.bsnpr.com/playoffs`
- `https://www.bsnpr.com/jugadores`
- `https://www.bsnpr.com/estadisticas`
- `https://www.bsnpr.com/equipos/CAG`
- One public player page
- One public game page
- Official iOS and Google Play app listings
- Official terms and privacy links

Discovery did not fetch disallowed `/api/` or `/_next/` resources, did not bypass authentication, did not probe rate limits and did not bulk crawl.

## Official Sources Discovered

| Source | Public | Data Observed | Acquisition Suitability | Grade |
| --- | --- | --- | --- | --- |
| Official BSN website | Yes | Teams, schedule shell, playoff shell, team pages, player pages, stats shell, news, tickets, game pages | Discovery/reference only until written approval | C |
| Official BSN mobile app | Public app listing; app traffic not inspected | Live games, official calendar, real-time results/stats, standings, leaders, rosters, team customization, alerts, video/highlights, playoff support | Best candidate for official partner/API discussion; do not reverse engineer protected traffic | B |
| Official team pages on BSN site | Yes | Team identity, record, group placement, next game, recent results, leaders, official links, ticket links | Good for manual QA and source mapping; fragile for automation | C |
| Official ticket links | Yes, external Ticketera links | Game/ticket relationship and venue hints | Auxiliary metadata only | C |
| Team-owned external sites/social links | Yes, varied | Team identity/context | Not reliable as primary data | D |

## Technical Findings

### Rendering

- The site serves HTML behind Cloudflare.
- Pages include Next.js flight/script markers and client chunks.
- Several pages include `ApolloSSRDataTransport` markers, indicating Apollo-backed rendering or hydration.
- The sampled game page initially rendered a loading state and relied heavily on client-side payload/chunks.
- The sampled player page rendered useful public player fields and season averages in HTML.

### Robots And Access

`robots.txt` allows general page access but disallows `/mobile/`, `/api/` and `/_next/`. It also includes Cloudflare content signals allowing search/reference use while disallowing AI training for listed agents.

Because `/api/` and `/_next/` are disallowed, the strategy must not depend on scraping internal API or JavaScript bundle endpoints unless BSN grants written permission.

### Terms

The official terms reserve content/software rights, prohibit commercial reproduction/distribution/modification/publication without authorization, prohibit mass extraction/scraping, and restrict use to lawful purposes aligned with the league. Production automated acquisition needs written authorization or a licensed feed.

## Endpoints And Formats

| Category | Finding |
| --- | --- |
| Public JSON | No approved public JSON endpoint discovered. |
| GraphQL | Apollo markers observed in public HTML; no GraphQL endpoint was fetched because likely internal paths are not approved for probing. |
| REST | No approved public REST endpoint discovered. |
| XHR/AJAX | Likely used by client-rendered pages, but not inspected beyond HTML markers due robots constraints. |
| Embedded JSON | Next flight/Apollo hydration markers exist; sampled player page includes visible data in rendered HTML. |
| Static HTML | Team/player pages expose useful rendered data. |
| Dynamic JS | Present, but `/_next/` disallowed by robots. |
| Server rendering | Partial. Team/player pages are useful; game/stat pages appear more client-dependent. |
| Client rendering | Significant, especially game pages and deeper stats. |

Internal endpoints discovered: none that are approved for use. Any hidden endpoint discovery beyond HTML-visible markers should require BSN authorization.

## Data Inventory

| Domain | Official Availability | Best Safe Acquisition Path | TTL Recommendation |
| --- | --- | --- | --- |
| League | Available | Static official metadata/manual seed | 180d |
| Season | Available/inferred | Official permissioned feed or curated CSV | 30d during season |
| Phase | Available in playoffs/season UI | Official permissioned feed or CSV | 12h during playoffs |
| Series | Available in playoffs UI/app | Official permissioned feed or CSV | 30m during playoffs |
| Games/Schedule | Available | Permissioned feed primary, CSV fallback | 12h; 1h on game day |
| Results | Available | Permissioned feed primary, CSV/manual fallback | 5m after finals |
| Quarter Scores | App/version history indicates support; page text references quarters | Permissioned feed or official boxscore export | 5m live/final |
| Half Scores | Derivable from verified quarter scores only | Normalize from quarters; do not infer without data | Derived |
| Box Scores | App/version history indicates starters/bench boxscore support | Permissioned feed/API required | 5m live/final |
| Play-by-play | Not verified | Future provider/API only | Not scheduled |
| Teams | Available | Website/team pages plus permissioned source | 90d |
| Players | Available | Permissioned feed or controlled CSV | 7d |
| Player Profiles | Available | Permissioned feed or controlled CSV | 7d |
| Standings | Available | Permissioned feed primary, CSV fallback | 30m |
| Statistics | Available | Permissioned feed primary | 30m |
| Venues | Partially available from team/game/ticket surfaces | Manual seed plus verified schedule | 90d |
| Attendance | Not verified | Manual/official boxscore if available | Final-only |
| Officials | Not verified | Future provider/API only | Final-only |
| Availability/Injuries | Not verified | Manual only until official source exists | Manual timestamped |
| Odds | Not official BSN data | Licensed odds provider or manual odds with source attestation | 5m |
| Historical seasons | Sitemap/news/app history imply prior coverage, but structured depth unknown | Permissioned historical export or CSV archive | One-time versioned import |

## Source Quality Scores

| Source | Reliability | Completeness | Freshness | Maintenance | Legal Risk | Automation | Longevity | Grade |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Permissioned official BSN feed/API | A | A/B expected | A | B | A | A | A | A |
| Official app backend with written authorization | A | A | A | B | A if authorized | A | B | A- |
| Official website rendered HTML | A for displayed facts | C | B | D | D without permission | D | C | C |
| Operator-owned CSV | B | B | C | C | A if sourced legally | B | B | B |
| Manual entry | C | D | C | D | B | C | B | C |
| Generic future sports provider | Unknown | Unknown | Unknown | B | B if licensed | A | B | B/C pending coverage |

## HTML Parsing Assessment

HTML should be avoided as the primary production strategy.

Stable-enough public paths exist:

- `/calendario`
- `/playoffs`
- `/jugadores`
- `/estadisticas`
- `/equipos/{TEAM}`
- `/jugadores/{uuid}`
- `/partidos/{uuid}`

Risks:

- Client rendering and Next flight payloads can change without notice.
- Deep data is likely behind internal APIs/chunks that robots disallow.
- HTML selectors are presentation-oriented.
- Terms/robots make automation risky without permission.

Recommended use: manual QA, source mapping, provider conversation evidence and occasional human verification.

## Mobile App Assessment

The official app is strategically important because its store listings confirm the official ecosystem already supports:

- Live games
- Official calendar
- Real-time results
- Real-time statistics
- Standings
- Individual leaders
- Team-specific roster, schedule, results, leaders, videos and alerts
- Start/final/close-game/overtime notifications
- Playoff support
- Player profiles
- Team statistics
- Boxscore starters and bench display

Do not reverse engineer protected app traffic. The correct path is to contact BSN/Genius/Lamonte and request a partner API, export, or approved technical integration.

## Connector Architecture Recommendation

Official Source Connector stages:

1. Discovery: registered source manifest, robots/terms snapshot, source owner, contact path.
2. Download: only permissioned URLs/APIs or user-supplied CSV/manual payloads.
3. Validation: schema, required fields, source timestamp, ID format, completeness, duplicate checks.
4. Normalization: map to shared basketball objects.
5. Dry Run: no writes, count rows, show diffs and blockers.
6. Preview: Current Board/data-quality preview with no EV unless odds verified.
7. Quality: coverage, freshness, completeness, source grade, warnings.
8. Commit: idempotent, audited, approval-gated writes only.
9. Rollback: source batch ID and row-level lineage required.

No connector should feed predictions until source lineage, normalized IDs, odds lineage, feature snapshots and settlement paths are validated.

## Normalization Strategy

Canonical objects:

- League
- Season
- Phase
- Series
- Game
- Team
- Player
- Venue
- Standing
- Statistic
- Result
- Quarter
- Half

Canonical IDs should preserve official UUIDs when present. Internal IDs should follow `basketball_bsn:bsn_pr:{domain}:{official_or_slug_id}`. Every row needs source ID, provider/source object ID, fetched timestamp, source URL/document, normalized timestamp and quality state.

Target shared tables:

- `sports_teams`
- `sport_events`
- `sport_standings`
- `sport_players`
- `sport_game_stats`
- `sports_odds_snapshots`
- `provider_entity_mappings`
- `sports_sync_jobs`
- `prediction_history` only after prediction stage is approved

## Import Strategy

Initial import:

1. Teams
2. Venues
3. Current season schedule
4. Results
5. Standings
6. Players
7. Team/player statistics
8. Quarter/half scores

Incremental import:

- Schedule daily off-hours and game-day refresh.
- Results every 5 minutes after expected finals.
- Standings/statistics every 30 minutes during active windows.
- Players weekly or when roster changes are published.

Historical import:

- Only from an approved export/feed or legally sourced CSV archive.
- Batch by season and phase.
- Never use historical rows as pregame inputs unless timestamps prove pregame availability.

Replay import:

- Requires final scores, odds snapshots, feature snapshots and market settlement definitions.

Live refresh:

- Only after permissioned data path exists.
- Use provider budget/ledger and rate-limit controls.

Operating Day:

- BSN can reuse the existing lifecycle only after normalized schedule/results and provider budget policy are configured for BSN-specific source IDs.

## CSV Fallback Strategy

CSV is viable as a backup and early operational bridge if source ownership is documented.

Required CSVs:

- `bsn_teams.csv`: `source_id,team_id,name,short_name,city,venue,conference,season`
- `bsn_schedule.csv`: `source_id,game_id,season,phase,series_id,start_time,home_team_id,away_team_id,venue,status`
- `bsn_results.csv`: `source_id,game_id,status,home_score,away_score,quarter_scores,overtime,final_at`
- `bsn_standings.csv`: `source_id,season,phase,team_id,wins,losses,position,group`
- `bsn_players.csv`: `source_id,player_id,team_id,name,position,height,weight,status`
- `bsn_team_stats.csv`: `source_id,game_id,team_id,pace,possessions,off_rating,def_rating,net_rating,fg_pct,rebounds,assists,turnovers`
- `bsn_odds.csv`: `source_id,game_id,sportsbook,market,selection,line,odds,snapshot_at`

Validation:

- Required fields per row type
- Canonical ID uniqueness
- Team/player mapping resolution
- Score/period arithmetic checks
- Timestamp timezone normalization
- Source document URL and operator reason

Rollback:

- Every import batch needs a batch ID and row lineage before writes can be enabled.

## Manual Entry Strategy

Manual entry should support:

- Results corrections
- Schedule changes/postponements
- Venue corrections
- Manual odds snapshots with source attestation
- Availability notes
- Lineup notes only as notes, not confirmed lineups, unless official source exists
- Injury notes only as notes, not diagnosis/severity, unless official source exists

Manual entry must remain audit-first: idempotency key, reason, operator, source URL/document, before/after diff and no silent overwrite.

## Provider Strategy

Primary: official BSN permissioned source or partner feed.

Secondary: CSV import from operator-owned or permissioned official exports.

Emergency: manual entry for corrections and limited result/odds data.

Future: licensed sports data or odds provider if BSN coverage is contractually verified.

Avoid: autonomous scraping of official website/app internals.

## Implementation Roadmap

1. Obtain written permission or export/API contact from BSN/Genius/Lamonte.
2. Build source manifest and legal/terms snapshot record.
3. Implement dry-run official schedule connector.
4. Implement dry-run results connector.
5. Implement teams and venues normalization.
6. Implement standings normalization.
7. Implement player/profile normalization.
8. Implement statistics, quarter score and first-half validation.
9. Enable CSV import dry-run previews in admin.
10. Add audited write path and rollback.
11. Validate Current Board empty/data states.
12. Add licensed odds path.
13. Run historical import with pregame timestamp controls.
14. Enable BSN replay/calibration only after settled samples exist.
15. Enable prediction generation and official recommendation review only after data, market and settlement gates pass.

## Final Position

BSN should not connect through unapproved hidden endpoints or HTML scraping. The durable strategy is a permissioned official feed/API first, controlled CSV fallback second, and manual entry only for audited corrections. This keeps BSN premium-grade without taking on brittle or legally risky automation.
