# SDIO-EXIT-02 Full MLB SportsDataIO Replacement

Status: `SDIO_EXIT_02_PARTIAL_CRITICAL_DEPENDENCIES_REMAIN`

Mode: bounded implementation and certification, zero SportsDataIO calls, zero manual The Odds API calls.

## Starting Evidence

| Item | Value |
| --- | --- |
| Starting commit | `c604758d38077770cc9d7954db826778ad037c42` |
| origin/main | `c604758d38077770cc9d7954db826778ad037c42` |
| Production commit | `c604758d38077770cc9d7954db826778ad037c42` |
| Production Pilot Week | `ACTIVE` |
| Odds authority | `STAGE_1_DUAL_READ` |
| SportsDataIO odds authority | `true` |
| The Odds API status | `SHADOW_NON_AUTHORITATIVE` |
| ODDS-03C | `WAIT_FOR_MULTI_EVENT_WINDOW` |
| HR-03 | `SHADOW_ONLY` |
| SDIO-EXIT-01 | `CANCELLATION_BLOCKED_CRITICAL_DEPENDENCIES_REMAIN` |

Production `/api/system/version` returned HTTP 200 and `providerCallsMade: 0`.

## Dependency Graph Reconfirmed

| Consumer | Domain | Production Reachable | SDIO-EXIT-02 Result |
| --- | --- | --- | --- |
| `src/services/canonical-acquisition.service.ts` | MLB odds | Yes, protected scheduler | Remains SportsDataIO until ODDS-03 promotion. |
| `src/services/sportsdataio-mlb-normalization.service.ts` | Odds normalization | Yes through acquisition | Retain for rollback and historical lineage. |
| `src/services/sportsdataio-mlb-prospective-preview.service.ts` | Schedule/odds/projection-backed prediction generation | Yes through operating-day refresh actions | Critical blocker for full exit. |
| `src/services/operating-day.service.ts` | Operating-day orchestration | Yes | Status/results are MLB Stats API; market refresh still imports SportsDataIO preview. |
| `src/services/results-sync.service.ts` | MLB final results | Yes | MLB Stats API replacement present. |
| `src/services/mlb-starter-sync.service.ts` | Starting pitchers | Yes for health/sync | Reads `sportsdataio_mlb_games_by_date_verification_v1` ledger and stored lineups. |
| `src/services/mlb-current-lineup-context.service.ts` | Lineup/starter context | Yes, read-only | Stored data path; full live source replacement not certified. |
| `src/services/mlb-team-stats-sync.service.ts` | Team stats | Protected/manual | Uses API Sports key, not SportsDataIO, but not certified as model-parity replacement. |
| `src/services/sportsdataio-mlb-historical-import-executor.service.ts` | Historical/admin imports | Admin/manual | Retain; not current scheduler-critical. |
| `src/services/sportsdataio-runtime-adapter.service.ts` | Provider capability | Read-only | Disabled typed adapter retained. |
| `src/app/api/providers/sportsdataio/**` | Provider diagnostics/readiness | Read-only/protected | Retain for diagnostics; do not call provider during certification. |
| `src/app/api/nba/sync/**` | NBA SportsDataIO paths | Manual/protected | Out of MLB scope; blocks account-level cancellation. |

## Replacement Checklist

| Domain | Replacement | Status | Notes |
| --- | --- | --- | --- |
| Schedule | MLB Stats API schedule feed | `BLOCKED` | Existing status/results fetches prove endpoint family, but no idempotent slate discovery writer has replaced SportsDataIO `morning_sync`. |
| Event identity | Additive MLB Stats API and The Odds API crosswalk | `PARTIAL` | MLB Stats API IDs are written opportunistically; complete team/event/player crosswalk still required. |
| Start time | MLB Stats API `gameDate` | `PARTIAL` | Used in status/results matching, not promoted as schedule authority. |
| Event status | MLB Stats API status mapper | `PASS` | DB-safe mapper already protects `sport_events.status`. |
| Results/final score | MLB Stats API result sync | `PASS` | Supports moneyline/run-line/total settlement through canonical `game_results`. |
| Settlement | Existing settlement engine | `PASS` | No SportsDataIO direct dependency when results are present. |
| Starting pitchers | MLB Stats API probable pitchers | `BLOCKED` | Hydrated status endpoint has probable pitcher fields, but persistence/identity mapping into starter feature contract is not implemented. |
| Team stats | API Sports/internal derived stats | `PARTIAL` | Existing sync is not SportsDataIO, but feature parity and freshness are not certified. |
| Team game stats | Internal final-result derivation or MLB box score | `BLOCKED` | No active replacement writer. |
| Player roster | MLB Stats API roster/player identity | `BLOCKED` | No current additive mapping writer. |
| Player stats | MLB Stats API/statcast/Retrosheet depending on use | `BLOCKED` | Historical replay is stored; current/future player models still need source replacement. |
| Player game stats | MLB box score or Retrosheet historical | `BLOCKED` | No current production refresh replacement. |
| Bullpen | Derived team/player pitching workload | `PARTIAL` | Stored/historical features can be read; current live refresh not certified. |
| Injuries | Not required today or alternate provider later | `NOT_REQUIRED_CURRENT_PRODUCTION` | Do not create a false cancellation blocker for current official picks. |
| Lineups | MLB official lineup feed or stored fallback | `PARTIAL` | Full lineup-aware future modeling still blocked; starters are critical. |
| Standings | MLB Stats API standings or internally derived results | `PARTIAL` | UI/diagnostic, not current official-pick blocker. |
| Odds | The Odds API | `PARTIAL` | ODDS-03A deployed; ODDS-03C multi-event proof pending. |

## Schedule And Operating-Day Finding

Full schedule replacement cannot be claimed while `operating-day.service.ts` imports `runSportsDataIoMlbProspectivePreview` and uses it for `morning_sync`, `midday_refresh` and `final_refresh`. Protected status and results already use MLB Stats API, but slate discovery and prediction-generation refresh still rely on stored SportsDataIO-era event/odds inputs and SportsDataIO product odds authority.

## Results And Settlement Finding

MLB current result import is the strongest replacement domain. `results-sync.service.ts` uses MLB Stats API, matches provider games to canonical `sport_events`, writes `game_results`, updates final event scores and leaves settlement to the existing canonical pipeline. This supports moneyline, run-line and total settlement without changing settlement rules.

## Starter Finding

Starting pitchers remain a critical blocker. `mlb-starter-sync.service.ts` reads:

- stored `sport_lineups`;
- latest SportsDataIO `sports_sync_jobs` ledger with job type `sportsdataio_mlb_games_by_date_verification_v1`;
- SportsDataIO player IDs when resolving current players.

The MLB Stats API status endpoint is hydrated with `probablePitcher`, but no certified replacement persists probable/confirmed starter identity into the existing starter assignment and feature contract.

## Team And Player Stats Finding

Team stats have an existing non-SportsDataIO path through `API_SPORTS_KEY`, but SDIO-EXIT-02 did not certify semantic parity with existing feature definitions or model expectations. Player stats and player game stats remain blocked for current/future player models and props. Retrosheet and historical snapshots cover historical replay only.

## Failure Policy

| Failure | Required Behavior |
| --- | --- |
| Schedule unavailable | Use valid stored slate only when current; otherwise block new predictions and report stale/unknown slate. |
| Status unavailable | Do not infer final/live from elapsed time. Keep lifecycle unknown/stale. |
| Results unavailable | Delay settlement or mark explicitly blocked; do not fabricate winners. |
| Starter unavailable | Use existing safe fallback or mark starter feature unavailable. |
| Team/player stats unavailable | Use immutable stored features only where already allowed; otherwise block feature-dependent prediction generation. |
| Odds unavailable | Stale/unknown evidence remains non-actionable. |

## Multi-Sport Isolation

This phase is MLB-only. `SPORTSDATAIO_MLB_API_KEY` is isolated from NBA-specific env usage, but the repository still contains NBA SportsDataIO readiness and sync paths. Cancelling a commercial SportsDataIO account is therefore not certified even if MLB eventually becomes independent.

## Final Decision

| Decision | Value |
| --- | --- |
| MLB SportsDataIO exit decision | `MLB_SPORTSDATAIO_EXIT_PARTIAL` |
| Account cancellation ready | `NO` |
| Minimum next gate | ODDS-03C multi-event proof, then schedule/status/starter crosswalk replacement |
| SportsDataIO cancellation | Not authorized and not performed |
| ODDS promotion | Not authorized and not performed |
| MC-03 | Not started |

