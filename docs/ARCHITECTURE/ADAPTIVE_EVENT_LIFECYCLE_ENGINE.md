# Adaptive Event Lifecycle Engine

Status: OE-003C read-only lifecycle contract implemented; OE-003D shadow refresh planner production-certified; OE-003E canonical SportsDataIO MLB active acquisition boundary implemented pending production certification.

OE-003 defines the architecture for event-level operations. OE-003C implements the read-only state contract at `/api/operations/event-lifecycle`. It does not activate event-level provider refresh, new scheduler cadence or prediction math changes.

OE-003D implements the read-only event refresh planner at `/api/operations/event-refresh-plan` in `SHADOW` mode. It decides per event, estimates provider-efficient batching and keeps the existing operating-day execution fallback.

OE-003E adds the bounded active acquisition boundary for SportsDataIO MLB current operating-day pregame odds. Planning remains per event, while execution uses the provider-efficient `GameOddsByDate/{operatingDate}` date-level request and writes one canonical `sports_odds_snapshots` evidence set. Active execution is owned by the protected adaptive scheduler path, not by product surfaces.

## Components

### Adaptive Event Lifecycle Engine

Owns event state transitions and exposes a deterministic state contract for schedulers, product surfaces, and operations health.

Implemented in `src/services/event-lifecycle-state.service.ts` as dynamic derivation over `sport_events`, `prediction_history`, `game_results` and provider-budget status. The implementation is read-only and returns provider calls, provider credits and database mutations as 0.

### Event Intelligence Scheduler

Ranks event work using explicit priority bands instead of hidden weights. It chooses the next safe action from stored state, freshness, provider budget, and settlement readiness.

OE-003D implements this as a shadow planner only. Active execution remains disabled until a separate activation gate proves provider budget, deduplication, freshness improvement and no unrelated writes.

OE-003E implements that activation gate for SportsDataIO MLB only. The Odds API and BSN remain shadow or observational until separately certified.

### Provider Budget Intelligence Manager

Owns provider-specific budget pools, reserves, quota-header evidence, reset semantics, and fallback behavior.

## Lifecycle States

| State | Entry | Exit | Allowed provider actions | Blocked actions | Target freshness | Mutation behavior |
| --- | --- | --- | --- | --- | --- | --- |
| DISCOVERED | Event exists in provider or stored schedule. | Schedule row is canonicalized. | schedule/status discovery | predictions without market inputs | 24h | upsert canonical event only |
| PREVIEW | Future event is known but not decision-relevant. | Market opens or event enters same-day window. | low-cadence schedule/status | recommendation promotion | 6-24h | stored preview metadata only |
| MARKET_OPEN | Odds can be acquired pregame. | Event becomes same-day active. | odds snapshot, feature inputs | post-start odds refresh | 60m | canonical odds snapshot upsert |
| ACTIVE_REFRESH | Same-day pregame event needs current data. | Inside lock window or game starts. | odds/status refresh if budget allows | duplicate surface-specific acquisition | 15m | stored snapshots and derived read models |
| HIGH_PRIORITY | Actionable candidate or near-start event. | Lock window or no longer actionable. | targeted odds/status refresh | provider calls beyond priority reserve | 5-10m | same canonical writes |
| LOCK_WINDOW | Event is close to start. | STARTED or status changes. | final pregame refresh if cutoff-safe | post-start pregame odds | 5m | immutable final pregame inputs |
| STARTED | Event start time reached or live status confirmed. | LIVE/FINAL. | status/results only | pregame market refresh | status 5m | event status updates only |
| LIVE | Game is in progress. | FINAL. | status/results polling | new betting recommendations | score/status 5m | event/result updates only |
| FINAL | Provider reports final or stored status terminal. | RESULT_IMPORT. | result import | pregame odds | 15m | canonical result upsert |
| RESULT_IMPORT | Final result needs persistence. | SETTLEMENT. | result confirmation if missing | market refresh before settlement | immediate | game_results upsert |
| SETTLEMENT | Settled labels can be applied. | LEARNING. | none unless result missing | odds refresh outranking ready settlement | immediate | prediction settlement writes |
| LEARNING | Settled labels are available. | PERFORMANCE. | none | model weight mutation unless approved elsewhere | daily | learning label bookkeeping only |
| PERFORMANCE | Metrics can refresh. | ARCHIVED. | none | provider calls | daily | performance snapshots |
| ARCHIVED | Event no longer affects current decisions. | none | none | all active refresh | none | read-only history |

OE-003C also supports terminal exceptions `POSTPONED`, `CANCELLED`, `SUSPENDED`, `ABANDONED` and `UNKNOWN`. MLB terminal/live handling reuses `resolveMlbGameLifecycle`, so `FINAL` is never inferred from elapsed time alone.

Post-start pregame odds refresh remains blocked unless a separately certified live-betting capability exists.

## Priority Bands

| Band | Meaning | Rule order |
| --- | --- | --- |
| P0 | Result, settlement, learning, performance closure, or production recovery. | Missing final results, settlement-ready rows, silent pending rows, failed protected run recovery. |
| P1 | Event inside lock window with actionable recommendation dependency. | Official Pick, Rent Play, Moneyline Bet, Smart Parlay dependency, strong qualified value. |
| P2 | Event inside two hours. | Freshen market/status when budget allows. |
| P3 | Same-day active event. | Standard same-day refresh. |
| P4 | Future or informational event. | Low-cadence preview only. |
| P5 | Archived, terminal exception or no current operational work. | No action unless audit evidence reopens the event. |
| UNKNOWN | Insufficient or contradictory evidence. | Human review when it blocks current operation. |

P0 always outranks pregame odds refresh.

OE-003C exposes these bands as observation only. OE-003D may later use them for a planner, but no planner is active in OE-003C.

## Freshness SLA Proposal

| Surface | Desired age | Max tolerated | Stale behavior |
| --- | --- | --- | --- |
| Rent Play | 5-10 min in lock window, 15 min pregame | 15 min | hide or show No Rent Play Today with stale reason |
| Moneyline Bet | 10-15 min | 20 min | downgrade to informational |
| Smart Parlay | 10-15 min for enabled legs | 20 min | disable stale leg |
| Official Picks | 5-15 min by state | policy-controlled | block new official display when stale |
| Current Board | 15-30 min | 60 min for browsing | warning and stale chip |
| Most Likely | 30-60 min | 24h if probability-only | warning, no bet copy |
| Best Value | 10-15 min | 30 min | block value claim |
| Daily Brief | 15-30 min | 60 min | limited opportunities or stale notice |
| Game Intelligence | 15-60 min | state-dependent | section-level stale warning |
| Performance | not odds-sensitive | not applicable | no market freshness gate |

Final SLA values should be confirmed by OE-003F cost simulation before activation.

## Deterministic Scheduler Contract

The scheduler must answer:

- which event is next;
- why it outranks other events;
- which provider budget pool it uses;
- expected request and quota-unit cost;
- reserve after execution;
- next eligible refresh;
- stale/downgrade behavior if skipped.

No arbitrary model weights are required for V1. Priority bands plus deterministic tie-breakers are sufficient.

## Stop Conditions

An implementation package must stop if:

- provider account reset semantics are still unknown but needed for a live budget rule;
- a proposed action would require provider calls beyond reserve;
- a post-start pregame odds refresh would be introduced;
- product surfaces require unsupported markets to be promoted;
- a migration becomes destructive;
- prediction, settlement, learning, or Official Pick policy changes are needed.
