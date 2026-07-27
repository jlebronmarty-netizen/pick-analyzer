# Sports Data Source Registry V2

Status: local source-governance registry for Historical Sports Data Completion Program V1.

This registry records source roles, provenance requirements and entitlement gates. It stores no secrets and authorizes no provider calls, imports, cron changes, SQL application, feature rebuilds or epoch activation.

## Registry Summary

| Provider/source | Sports | Primary datasets | Entitlement state | Licensed-use posture | Historical depth | Latency | Priority | Fallback | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SportsDataIO | MLB, NBA; future NFL/NHL if entitled | schedules, teams, players, standings, boxscores, team stats, player stats, injuries/lineups where entitled, results | runtime credential exists; dataset entitlement varies by sport/domain | licensed API only; call through existing budgeted adapters | endpoint-specific; MLB/NBA stored evidence exists | API/provider latency | primary for structured sport facts | manual CSV or approved official source | high for stored MLB/NBA rows, blocked where entitlement is unproven |
| The Odds API | MLB current markets; future multi-sport if entitled | current events, bookmakers, moneyline, spreads, totals, supported player props, current market snapshots | credential exists; historical/player-prop tier must be proven before use | licensed API only; historical endpoints require explicit credit/cost review | historical odds not approved in this program | API/provider latency | primary for market snapshots where entitlement is proven | SportsDataIO odds where available; no fabricated lines | high for certified current MLB event/prop evidence, blocked for historical odds |
| Retrosheet | MLB | historical MLB events, game logs, pitcher appearances, feature foundation | existing supported local workflows | public historical baseball source as already integrated; preserve provenance | MLB historical seasons supported by existing workflow | file/import batch | primary MLB historical foundation | SportsDataIO current-season stats | high for existing imported feature rows |
| Official public sources | BSN and selected sports when legitimate | schedules, results, standings, boxscores, source confirmation | source-by-source approval required | only where terms permit; no prohibited scraping or anti-bot bypass | source-specific | source-specific | secondary when licensed APIs are unavailable | operator CSV | medium only after provenance review |
| Manual CSV | BSN and blocked competitions | schedules, results, standings, teams, players, stats, quarter scores, boxscores | operator-provided file required | owner-attested source; deterministic validation required | file-provided | operator cadence | fallback for unsupported or custom leagues | permissioned feed | medium after schema validation |
| Existing stored tables | all supported sports | canonical events, mappings, stats, odds snapshots, predictions, feature snapshots, settlements | available read-only | internal canonical storage | bounded by stored rows | immediate | first source for audits/plans | providers only after approval | high for counts, variable for completeness |

## Required Lineage Fields

Every future import plan must preserve:

- source provider or source file
- source dataset
- sport and competition
- provider entity ID or source natural key
- canonical entity ID when resolved
- source timestamp
- ingestion timestamp
- effective/as-of timestamp
- deterministic idempotency key
- source version or file checksum when available
- validation state
- confidence classification
- rejection reason for skipped rows

## Provider Governance

### SportsDataIO

Role:

- structured schedules, teams, players, results, standings, stats and boxscores
- injuries, lineups and depth charts only when entitlement and payload shape are proven

Rules:

- use existing budgeted provider adapters
- no unbounded season-wide calls
- no trial/scrambled data promotion into production
- no direct raw payload dependency in prediction engines
- record provider calls and mutation counts per action

Current confidence:

- MLB stored schedule/player/stat/odds evidence is strong.
- NBA stored data is partial and trial/non-production isolated.
- NFL/NHL readiness is blocked until legitimate stored or provider-backed coverage exists.

### The Odds API

Role:

- current events and market snapshots where entitlement is proven
- MLB `pitcher_outs` evidence only through certified event and pitcher identity gates

Rules:

- no historical odds calls in this program
- no live calls unless explicitly bounded and budgeted
- no fabricated sportsbook lines
- no EV, Kelly, stake, bankroll or recommendation behavior from source acquisition
- event crosswalk and player identity must be deterministic before persistence

Current confidence:

- certified current MLB event mappings exist.
- certified Will Warren pitcher identity bridge exists.
- stored real MLB recorded-outs rows exist.
- historical odds remain entitlement/cost blocked.

### Retrosheet

Role:

- MLB historical event and player performance foundation where existing workflows support it
- point-in-time feature snapshots for historical MLB features

Rules:

- preserve source provenance
- keep historical feature generation as-of safe
- do not use historical imports to create retrospective production predictions
- do not rewrite existing prediction evidence

### Official Public Sources

Role:

- source discovery and approved official evidence where legitimate
- BSN source confirmation and manual import provenance

Rules:

- no prohibited scraping
- no bypassing access controls
- no hidden endpoint probing
- no unlicensed reproduction
- operator approval required before automated ingestion

### Manual CSV

Role:

- deterministic fallback for BSN and custom/blocked competitions

Rules:

- schema validation
- encoding validation
- date/time normalization
- duplicate detection
- referential integrity
- dry-run first
- checkpoint and resume
- rejection report
- rollback plan

## Dataset Registry

| Dataset | Preferred source | Fallback source | Update frequency | Provenance requirement | Completion risk |
| --- | --- | --- | --- | --- | --- |
| schedules/events | SportsDataIO for MLB/NBA; approved source per other sport | manual CSV for BSN/custom | daily or provider cadence | provider event ID plus canonical event ID | event identity conflicts |
| results | SportsDataIO or approved official result source | manual CSV | postgame/final | final score, final timestamp, source observed time | post-start/final timing leakage |
| standings | SportsDataIO or approved league source | manual CSV | daily/periodic | season, team, source timestamp | source freshness |
| team stats | SportsDataIO or approved stats source | manual CSV | postgame/import batch | event ID, team ID, source timestamp | stat/result mismatch |
| player stats | SportsDataIO, Retrosheet for MLB historical | manual CSV | postgame/import batch | event ID, player ID, provider ID, source timestamp | unresolved player identity |
| boxscores | SportsDataIO or approved boxscore source | manual CSV | postgame/import batch | event ID, team/player stat lineage | incomplete nested payloads |
| lineups/starters | SportsDataIO where entitled/proven | manual or approved source | pregame/current | source timestamp, confirmation level, as-of time | stale or post-start evidence |
| injuries | SportsDataIO where entitled/proven | approved source only | current/provider cadence | player ID, injury status, source timestamp | entitlement and stale status |
| odds snapshots | The Odds API or SportsDataIO where entitled | none | current snapshot cadence | bookmaker, market, outcome, price, source timestamp | entitlement and market support |
| historical odds/open/close | The Odds API only if entitlement/cost approved | none | historical batch | event, bookmaker, market, opening/closing timestamp | credit cost and entitlement |
| player props | The Odds API where market, event and player identity are certified | none | current snapshot cadence | event mapping, player mapping, bookmaker, market, line, price | identity mismatch and entitlement |
| feature snapshots | internal feature store | none | rebuild batch | as-of timestamp and source row lineage | temporal leakage |
| predictions | internal prediction engine | none | operating-day flow | model version, feature version, epoch after activation | retrospective generation risk |
| settlements/learning labels | internal settlement services | none | post-final | originating prediction ID and final evidence | settlement rewrite risk |

## Certification

- `SOURCE_PROVENANCE_REGISTRY_V2_PASS`
- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- Secrets stored: no
