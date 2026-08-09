# SDIO-EXIT-01 Dependency And Cancellation Readiness Audit

Status: `CANCELLATION_BLOCKED_CRITICAL_DEPENDENCIES_REMAIN`

Observation date: 2026-08-09

Starting commit: `ceac2139e0b2b11b3c96c8e84f08e76fd14f20d1`

Production commit observed: `ceac2139e0b2b11b3c96c8e84f08e76fd14f20d1`

## Verdict

SportsDataIO cannot be cancelled today.

SportsDataIO can stop being the production odds authority only after ODDS-03 performs the already-certified bounded repairs from ODDS-03R. Full subscription cancellation is blocked because schedule/game identity, event status, starter evidence, team/player stat refresh, provider mappings, and multi-sport SportsDataIO readiness paths are still unresolved or not yet migrated.

## Direct Answers

| Question | Answer | Classification |
| --- | --- | --- |
| Can SportsDataIO stop being used for odds? | Not today. ODDS-03R says ready after bounded repair, not already cut over. | `READY_AFTER_ODDS03_REPAIR` |
| Can SportsDataIO stop being used for schedule? | No. Current/future schedule replacement is not certified. | `BLOCKED` |
| Can SportsDataIO stop being used for results? | For MLB current result settlement, mostly yes because MLB Stats API is the current result source. Non-MLB and edge cases still need certification. | `PARTIAL_MLB_READY` |
| Can SportsDataIO stop being used for event status? | No. Status replacement needs schedule/status migration proof. | `BLOCKED` |
| Can SportsDataIO stop being used for team stats? | No for future/current feature refresh; historical snapshots remain persisted. | `BLOCKED_FOR_FUTURE` |
| Can SportsDataIO stop being used for player stats? | No for future player/prop models; historical replay remains persisted. | `BLOCKED_FOR_FUTURE` |
| Can SportsDataIO stop being used for starting pitchers? | No. Starter evidence still reads SportsDataIO GamesByDate ledger or `sport_lineups` derived from it. | `CRITICAL_BLOCKER` |
| Can SportsDataIO stop being used for lineups? | Not until classified as unused/stored-only or replaced. | `BLOCKED` |
| Can SportsDataIO stop being used for injuries? | Not for future injury-aware modeling; currently foundation/noncritical. | `BLOCKED_FOR_FUTURE` |
| Any other production input? | Provider mappings and lineage must remain readable; NBA/multi-sport SportsDataIO routes must be separately handled. | `RETAIN_LINEAGE` |

## Runtime Consumers

| Consumer | Domain | Behavior | Production Reachable |
| --- | --- | --- | --- |
| `canonical-acquisition.service.ts` | MLB odds | Protected active writer; one date-level SportsDataIO GameOddsByDate call; persists odds snapshots and sync ledger. | Yes |
| `sportsdataio-mlb-normalization.service.ts` | Odds normalization | Converts SportsDataIO payloads to canonical odds rows. | Yes through acquisition |
| `mlb-games-by-date-verification.service.ts` | Schedule/status/starters/weather/venue verification | Protected verifier; can write a verification ledger when confirmed. | Yes when protected |
| `mlb-starter-sync.service.ts` | Starting pitchers | Reads stored lineups and SportsDataIO GamesByDate ledger; optional provider refresh. | Yes |
| `sportsdataio-mlb-historical-import-executor.service.ts` | Historical/import domains | Historical schedule, stats, odds, teams, players, standings, line movement planning/execution. | Admin/manual |
| `sportsdataio-runtime-adapter.service.ts` | Multi-domain adapter | Disabled adapter returns typed empty pages and zero provider calls. | Readiness only |
| `sportsdataio-historical-import-readiness.service.ts` | NBA/multi-sport import | Readiness/execution planning for NBA and historical imports. | Admin/manual |
| `live-provider-verification.service.ts` | Provider verification | Explicit verification call paths. | Admin/manual |
| `mlb-missing-intelligence.service.ts` | Missing intelligence | Can use SportsDataIO Discovery Lab evidence. | Diagnostic/manual |
| `sportsdataio-subscription-maximization-audit.service.ts` | Subscription audit | Readiness/status only. | Read-only |
| `src/app/api/providers/sportsdataio/**` | Provider API routes | Capability, status, NBA readiness, discovery, execution validation. | Yes |
| `src/app/api/nba/sync/**` | NBA SportsDataIO sync | NBA foundation sync routes. | Yes/manual |

## Persisted Data Already Owned

| Data | Evidence | Future SportsDataIO Required To Preserve? |
| --- | --- | --- |
| Historical MLB games | HR-01: 2,430 historical events | No |
| Historical feature snapshots | HR-01: 70,470 snapshots | No |
| Full replay predictions | HR-01: 7,290 replay predictions | No |
| Replay settlements | HR-01: 7,290 settled replay predictions | No |
| Current odds snapshots | `sports_odds_snapshots` existing rows | No to read; yes to refresh until ODDS-03 |
| Provider mappings | `provider_entity_mappings`, metadata, provider IDs | No to read; must retain |

Historical classification: `HISTORICAL_DEPENDENCY_REMOVED`.

## What Breaks If Removed Today

- Active SportsDataIO MLB odds refresh stops.
- Future/current schedule ingestion from SportsDataIO stops.
- SportsDataIO GamesByDate starter evidence refresh stops.
- Team/player stat refresh through SportsDataIO stops.
- NBA SportsDataIO foundation sync paths stop.
- Any manual/admin SportsDataIO verification/import route fails or degrades.

## What Continues Working

- Existing homepage/current-board/performance reads from stored data continue.
- Stale/actionability gates continue blocking stale evidence.
- MLB results/settlement can continue through the current MLB Stats API result path.
- Historical replay and HR-03 calibration shadow continue from stored data.
- Existing provider mapping lineage remains readable as long as code/tables are retained.

## Odds Exit

Decision: `SPORTSDATAIO_ODDS_EXIT_READY_AFTER_ODDS03_REPAIR`.

ODDS-03R already requires:

- lifecycle-scoped event mapping;
- executable pregame line-versioned prediction;
- feature flag and rollback;
- certified book set configuration;
- recommendation-exposure-aware performance policy.

Until ODDS-03 is deployed and certified, SportsDataIO remains production odds authority and The Odds API remains shadow-only.

## Replacement Recommendations

| Domain | Recommended Replacement |
| --- | --- |
| Odds | The Odds API after ODDS-03 repairs |
| Schedule | MLB Stats API/public MLB schedule feed, certified with stored `sport_events` mapping |
| Event status | MLB Stats API schedule/feed status with explicit postponed/cancelled/suspended handling |
| Results | MLB Stats API, already current path for MLB, with sustained proof |
| Starting pitchers | MLB public probable pitcher/feed evidence or lower-cost stats provider; do not rely on The Odds API |
| Team stats | MLB public stats endpoints or lower-cost stats provider; stored historical snapshots for replay |
| Player stats | MLB public stats endpoints or lower-cost stats provider; required before player models/props |
| Injuries | Alternate injury source or explicitly disable injury-aware features |
| Lineups | MLB public lineup/feed evidence or lower-cost provider; preserve expected vs confirmed |
| Props | The Odds API Business-tier props for odds only; still needs player identity, projection and settlement sources |

## Cost / Risk Options

| Option | Provider Stack | Cost Evidence | Risk |
| --- | --- | --- | --- |
| A | Keep SportsDataIO + The Odds API | SportsDataIO Discovery Lab $99-$149/mo; The Odds API Pro $29/mo or Business $99/mo | Safest but duplicates cost |
| B | The Odds API + public MLB data | The Odds API Pro/Business pricing; public MLB data cost not contract-certified | Best target, needs engineering/certification |
| C | The Odds API + lower-cost stats provider | Unknown until selected | Feasible but requires vendor audit |
| D | SportsDataIO commercial | Quote-based | Not a cancellation path |

## Cancellation Gates

SportsDataIO cancellation is blocked until:

- `ODDS_REPLACED`
- `SCHEDULE_REPLACED`
- `STATUS_REPLACED`
- `RESULTS_REPLACED`
- `STARTERS_REPLACED_OR_NOT_REQUIRED`
- `TEAM_STATS_REPLACED_OR_STORED`
- `PLAYER_STATS_REPLACED_OR_STORED`
- `INJURIES_LINEUPS_CLASSIFIED`
- `MULTI_SPORT_IMPACT_RESOLVED`
- `DAILY_AUTONOMY_PROVEN`
- `ROLLBACK_PLAN_READY`

## Recommended Migration

1. `SDIO-EXIT-02 / ODDS-03`: primary odds cutover.
2. `SDIO-EXIT-03`: schedule/status replacement.
3. `SDIO-EXIT-04`: results/settlement replacement hardening.
4. `SDIO-EXIT-05`: starters/team/player stats/injuries/lineups replacement or stored-only certification.
5. `SDIO-EXIT-06`: disabled SportsDataIO shadow observation.
6. `SDIO-EXIT-07`: cancellation certification.

## Safety Accounting

Provider calls during SDIO-EXIT-01: 0.

Database mutations during SDIO-EXIT-01: 0.

SportsDataIO disabled: false.

SportsDataIO cancelled: false.

ODDS-03 performed: false.

HR-04 started: false.

Player Props started: false.

MC-03 started: false.
