# NBA-03A Current Era Shadow Settlement Preparation

Status: `NBA_03A_CURRENT_ERA_SHADOW_SETTLEMENT_PREPARATION_CERTIFIED_READY_FOR_ACTIVATION_REVIEW`

This phase prepares settlement for NBA `CURRENT_ERA_SHADOW` rows without activating production settlement. It keeps shadow generation, Official Picks, product visibility, learning, calibration, bankroll, notifications, Historical Replay and MLB unchanged.

## Contract

Settlement scope is restricted to:

- `sport_key = basketball_nba`
- `prediction_origin = CURRENT_ERA_SHADOW`
- pending and unsettled rows only
- supported full-game markets: `moneyline`, `spread`, `total`
- authoritative final result evidence only

Authoritative result evidence requires:

- canonical `sport_events.id` matches `prediction_history.game_id`
- final `sport_events.status`
- canonical `game_results.game_id` matches the same event
- final home and away scores are present
- no live, provisional, odds-derived or inferred score

## Market Rules

Moneyline settles selected team final score versus opponent final score.

Spread settles the exact stored prediction line. The line is immutable: later market movement cannot alter settlement.

Total settles the exact stored total line using the stored Over/Under selection. Whole-number totals can push.

## Isolation

The preparation service writes nothing in dry-run mode. Future mutating execution requires explicit activation and must keep:

- production learning disabled
- production calibration disabled
- Official Pick mutation disabled
- product visibility disabled
- Historical Replay untouched
- MLB untouched

## Scheduler Recommendation

Do not reuse the 30-minute generation cron for settlement. A future `NBA_CURRENT_ERA_SHADOW_SETTLEMENT` loop should be separate, protected, lock-scoped and event-aware. It should wake only after events could plausibly be final, scan a bounded batch of pending shadow predictions, and no-op before any provider/result work when no started event is eligible.

## Current Production Dry-Run

Read-only production audit on the certified state found:

- `CURRENT_ERA_SHADOW`: 43
- unique games: 10
- pending: 43
- settled: 0
- moneyline: 14
- spread: 14
- total: 15
- earliest game start: `2026-10-20T19:00:00+00:00`
- latest game start: `2026-10-22T00:40:00+00:00`
- settlement eligible: 0
- skip reason: future/not started
- provider calls: 0
- database mutations: 0

## Activation Gate

Settlement activation requires explicit authorization after:

- settlement validator PASS
- authoritative result source PASS
- event/result identity PASS
- Moneyline, Spread and Total fixtures PASS
- push handling PASS
- idempotency PASS
- lock/concurrency plan PASS
- learning and calibration isolation PASS
- Historical Replay isolation PASS
- MLB isolation PASS
- production deployment alignment PASS
