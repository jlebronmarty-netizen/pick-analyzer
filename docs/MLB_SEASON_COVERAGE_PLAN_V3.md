# MLB Season Coverage Plan V3

Status: local plan-only artifact for Historical Sports Data Completion Program V1.

This phase defines target MLB windows and bounded import manifests from stored evidence only. It does not call providers, execute imports, generate predictions, rebuild features, apply SQL, seed epochs or mutate production data.

## Target Windows

Current date context: 2026-07-27.

| Window | Scope | Dates | Execution posture |
| --- | --- | --- | --- |
| Previous completed MLB season | 2025 MLB season | 2025-03-18 through 2025-11-02, pending stored evidence by date | stored-data reconciliation and manifest planning only |
| Current MLB season safe completed | 2026 MLB season through latest safe completed date | 2026-03-26 through 2026-07-26 | stored-data reconciliation and future import planning only |
| Current MLB future schedule | scheduled future events | 2026-07-27 through 2026-09-27 from stored schedule | schedule/identity readiness only; no predictions generated |

The latest safe completed date is derived from stored MLB completed events observed through `2026-07-26T20:05:00+00:00`.

## Stored Evidence Snapshot

From `docs/HISTORICAL_DATA_COMPLETION_BASELINE_V3.md`:

- Teams: 30
- Players: 7389
- Events/schedule: 4922
- Completed events: 4012
- Future events: 847
- Results: 471
- Standings: 60
- Team/game stats: 2926
- Player stats: 47232
- Boxscores: 2926
- Starters/lineups: 27
- Injuries: 0
- Odds snapshots: 48569
- Player props: 11
- Feature snapshots: 72223
- Predictions: 1110
- Settlements: 837
- Provider identities: 59239

## Dataset Plan

| Dataset | Stored state | Plan | Provider calls now |
| --- | --- | --- | ---: |
| schedule/events | strong stored coverage | reconcile 2025 and 2026 date windows against deterministic event keys | 0 |
| results | partial stored coverage | plan bounded result completion by missing final events; do not execute | 0 |
| teams | complete core coverage | maintain existing canonical teams | 0 |
| players | strong stored coverage | reconcile unresolved IDs before persistence | 0 |
| starters/probable pitchers | partial current evidence | use existing starter intelligence and starter sync dry-run contracts | 0 |
| boxscores/team stats | partial stored coverage | plan gap import by event batch | 0 |
| player stats | strong current stored coverage | reconcile identity and duplicate indicators before feature use | 0 |
| standings | stored current evidence | maintain and refresh only under approved provider budget | 0 |
| injuries | empty stored coverage | keep optional blocker; do not fabricate injury status | 0 |
| lineups | partial starter/lineup evidence | keep timestamp and confirmation-level guards | 0 |
| odds | stored current snapshots | keep current-only market foundation; no historical odds calls | 0 |
| player props | 11 genuine stored pitcher-outs rows | preserve same-event projection gate | 0 |
| feature snapshots | strong Retrosheet-backed foundation | certify as-of safety before production rebuild | 0 |

## Bounded Import Manifests

These manifests are plans only. They are not execution approval.

### Manifest MLB-2025-EVENT-RESULTS

- Purpose: reconcile 2025 schedule and final results.
- Source priority: Retrosheet for historical event/game-log foundation, SportsDataIO only if an approved bounded gap remains.
- Batch key: date.
- Batch size: at most 7 dates per dry-run review.
- Required guards: doubleheader natural key, home/away IDs, status finality, no duplicate canonical events.
- Mutation posture: not approved.

### Manifest MLB-2026-EVENT-RESULTS

- Purpose: reconcile current-season completed events through `2026-07-26`.
- Source priority: existing stored events/results first, SportsDataIO result sync only after explicit approval.
- Batch key: date.
- Batch size: at most 3 dates per dry-run review.
- Required guards: cutoff status, final score, postponed/rescheduled state, provider mapping.
- Mutation posture: not approved.

### Manifest MLB-2026-STATS-BOXSCORES

- Purpose: complete team/player stats and boxscores for stored completed events.
- Source priority: SportsDataIO current-season stats where entitlement is already proven; Retrosheet where supported for historical feature foundation.
- Batch key: event date.
- Batch size: at most 3 dates per dry-run review.
- Required guards: player identity, duplicate stat row ID, natural-key collision report, event result reconciliation.
- Mutation posture: not approved.

### Manifest MLB-2026-STARTERS-LINEUPS

- Purpose: improve starting pitcher and lineup context.
- Source priority: existing SportsDataIO GamesByDate starter-evidence route and stored lineups.
- Batch key: date.
- Batch size: one date per protected refresh when explicitly approved.
- Required guards: pregame timestamp, source freshness, exact identity, team assignment, no post-start evidence.
- Mutation posture: not approved.

### Manifest MLB-MARKETS-CURRENT

- Purpose: maintain current moneyline, run line, totals and certified pitcher-outs prop snapshots.
- Source priority: existing SportsDataIO odds path and certified The Odds API event/player mappings.
- Batch key: operating day.
- Batch size: existing operating-day budget and manual prop-sync caps only.
- Required guards: provider budget, event crosswalk, bookmaker/market support, no fabricated lines.
- Mutation posture: not approved by this phase.

## Certification

- `MLB_SEASON_PLAN_V3_PASS`
- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- Historical imports executed: 0
- Retrospective predictions generated: 0
