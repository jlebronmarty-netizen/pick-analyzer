# SDIO-EXIT-04 Stats Parity And SportsDataIO-Off Window

Status: `SDIO_EXIT_04_STATS_PARITY_PASS_OFF_WINDOW_BLOCKED_BY_ODDS_AUTHORITY`

Observation time: 2026-08-10T19:52Z

Starting commit: `72e82e21db15a60032d0f06e479ee2b2eceec662`

Production commit observed: `72e82e21db15a60032d0f06e479ee2b2eceec662`

## Verdict

SDIO-EXIT-04 certifies that MLB non-odds provider independence is ready for parity review and that current production-critical stats/player/bullpen/lineup/injury domains do not block cancellation. It does not certify the final SportsDataIO-off operating window, because current product odds authority is still SportsDataIO.

Final classification: `SDIO_EXIT_04_STATS_PARITY_PASS_OFF_WINDOW_BLOCKED_BY_ODDS_AUTHORITY`.

## Production Evidence

| Endpoint / Evidence | Result |
| --- | --- |
| `/api/system/version` | HTTP 200, commit `72e82e21db15a60032d0f06e479ee2b2eceec662`, provider calls 0. |
| `/api/operations/mlb-official-replacement` | `activeMode=DUAL_READ`, schedule/status/results ready, SportsDataIO not disabled/cancelled. |
| `/api/operations/odds-primary-authority` | `stage=STAGE_1_DUAL_READ`, product authority `SPORTSDATAIO`, The Odds API shadow-only. |
| `/api/operations/health` | Scheduler `HEALTHY`, settlement `HEALTHY`, provider budget `HEALTHY`, market freshness/product readiness `DEGRADED`. |
| `/api/operations/settlement-guarantee?includeValidation=true` | `PASS`, ready rows 0, blocked rows 0, silent pending 0. |
| `/api/performance` | Current V2: 309 canonical predictions, 279 settled, 30 pending, 90.29% coverage. |
| `/api/dashboard/today` | Current operating day 2026-08-10, 10 games, 58 prediction rows, 30 current-board candidates. |
| `/api/mission-control` | Production Pilot Week `ACTIVE`, provider calls 0 from read. |

## Ledger Evidence

Read-only Supabase aggregate evidence:

| Item | Count |
| --- | ---: |
| MLB sport events | 4,924 |
| MLB Official mappings | 72 |
| SportsDataIO MLB mappings retained | 59,251 |
| MLB game results | 662 |
| Current-era MLB prediction rows queried | 529 |
| MLB team_stats rows | 92 |
| MLB sport_player_stats rows | 47,255 |

Current local-day scheduler ledger since 2026-08-10T04:00Z:

| Provider | Jobs | Provider Calls | Rows Fetched | Rows Inserted | Rows Updated |
| --- | ---: | ---: | ---: | ---: | ---: |
| MLB Stats API | 50 | 50 | 500 | 0 | 1,350 |
| The Odds API | 50 | 50 | 32,900 | 32,900 | 0 |
| SportsDataIO | 100 | 50 | 2,000 | 3,006 | 1,494 |

SportsDataIO job split:

- `canonical_acquisition_active_execution_v1`: 50 jobs, 50 provider calls, current MLB odds authority.
- `sportsdataio_mlb_prospective_preview_v1`: 50 jobs, 0 provider calls, stored-odds prediction generation.

## Stats And Feature Parity

| Area | Classification | Notes |
| --- | --- | --- |
| Team game stats parity | `PASS_FOR_CURRENT_PRODUCTION` | Current recommendations do not require routine SportsDataIO team-game stat calls; canonical results and stored team stats cover current production. |
| Team aggregate stats parity | `PASS_FROM_STORED_OR_INTERNAL` | Current production reads persisted/internal evidence; no active SportsDataIO aggregate call was observed. |
| Player stats parity | `NOT_REQUIRED_FOR_CURRENT_PRODUCTION` | Player props/player models remain future work; current production core markets do not require routine SportsDataIO player stat calls. |
| Player game stats parity | `NOT_REQUIRED_FOR_CURRENT_PRODUCTION` | Future props/bullpen enhancements require separate certification. |
| Bullpen parity | `GRACEFUL_DEGRADE_FOUNDATION_ONLY` | Existing missing-input policy blocks fabrication; not a current official-pick dependency. |
| Starter feature parity | `PASS_FOR_PARITY_REVIEW` | Starter identity mapping is certified from MLB Official natural runs; richer pitcher stats remain optional/future. |
| Roster identity | `PASS_FOR_STARTER_SCOPE` | Official person IDs are preserved for starter crosswalk; no duplicate player creation observed in certified starter evidence. |
| Lineups | `NOT_REQUIRED_FOR_CURRENT_PRODUCTION_EXCEPT_STARTERS` | Full batting lineups are future enhancement. |
| Injuries | `NOT_REQUIRED_FOR_CURRENT_PRODUCTION` | No current MLB production recommendation dependency. |
| Standings | `UI_ONLY_OR_DERIVABLE` | Not an active blocker. |

## SportsDataIO-Off Window

Production off-window executed: `NO`.

Reason: the pre-production gate found that SportsDataIO remains the active product odds authority. Disabling SportsDataIO now would block current product price refresh and would not be a valid final operating-day proof.

Configuration change requiring future explicit authorization:

1. Complete odds promotion gate and set `ODDS_PRIMARY_AUTHORITY_STAGE` to a certified The Odds API product-primary stage.
2. Set `MLB_DATA_SOURCE_MODE=MLB_OFFICIAL_PRIMARY` for non-odds MLB domains.
3. Observe natural scheduler cycles with SportsDataIO MLB calls equal to 0.

## Cancellation Gates

| Gate | Status |
| --- | --- |
| Historical independence | `PASS` |
| Odds independence | `PARTIAL_ODDS_AUTHORITY_STAGE_1` |
| Schedule independence | `PASS_FOR_PARITY_REVIEW` |
| Status independence | `PASS` |
| Results independence | `PASS` |
| Starter independence | `PASS_FOR_PARITY_REVIEW` |
| Team stats independence | `PASS_FOR_CURRENT_PRODUCTION` |
| Player stats independence | `NOT_REQUIRED_FOR_CURRENT_PRODUCTION` |
| Bullpen independence | `NOT_REQUIRED_FOR_CURRENT_PRODUCTION` |
| Daily autonomy | `PARTIAL_ODDS_BLOCKED` |
| SportsDataIO calls zero | `BLOCKED_NOT_EXECUTED` |
| Rollback readiness | `PASS` |

## Safety

- Manual SportsDataIO calls: 0.
- Manual The Odds API calls: 0.
- Manual MLB Stats API calls: 0.
- Certification read provider calls: 0.
- Certification read database mutations: 0.
- Prediction formula changes: 0.
- Official Pick policy changes: 0.
- Settlement changes: 0.
- Learning changes: 0.
- SportsDataIO cancelled: false.
- SportsDataIO disabled: false.
- MLB Official primary promoted: false.
- Odds authority promoted: false.
- Missing odds fail closed as `NO_FRESH_PRICE`, `NO_FRESH_EXACT_LINE_PRICE`, `WAITING_FOR_CURRENT_LINE_PREDICTION` or `WAIT_FOR_REFRESH`; no stale or missing price can become actionable.

## Next Phase

Next MLB master block: `ODDS_PROMOTION_OR_OFF_WINDOW_AUTHORIZATION`.

Do not begin HR-04, Player Props, MC-03, or SportsDataIO cancellation until explicit authorization exists.
