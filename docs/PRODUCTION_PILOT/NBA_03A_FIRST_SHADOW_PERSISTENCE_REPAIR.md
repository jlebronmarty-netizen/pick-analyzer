# NBA-03A First Shadow Persistence Repair

Status: `NBA_03A_FIRST_SHADOW_PERSISTENCE_REPAIR_CERTIFIED_CODE_ONLY`

The first authorized NBA `CURRENT_ERA_SHADOW` Safe Canary write reached `savePredictionHistory` and failed before inserting a row because the shared writer used `ON CONFLICT (sport_key, game_id, team, market, sportsbook)`. Production does not have a matching unique or exclusion constraint for that target.

The broader finding is more important: that five-column target is not a safe prediction identity. A read-only production audit found 114 duplicate groups under it, including legitimate different lines and model versions. Creating a unique key around that target would collapse valid prediction history.

## Identity

Model prediction identity:

`sport_key + game_id + market + selection/team + line + model_version`

Price evidence identity:

`provider + sportsbook + odds + odds_snapshot_id + timestamps`

Persisted Current Era Shadow identity:

`sport_key + game_id + market + selection/team + line + sportsbook + prediction_origin + model_version`

Database concurrency boundary:

`prediction_history.id`, as a deterministic UUID derived from the persisted logical identity.

## Repair

`CURRENT_ERA_SHADOW` rows now carry:

- deterministic UUID `id`
- deterministic `idempotency_key`
- deterministic `prediction_group_key`
- `model_role = shadow`
- `is_current = false`
- `prediction_origin = CURRENT_ERA_SHADOW`

`savePredictionHistory` routes only deterministic Current Era Shadow rows through `ON CONFLICT (id)`. The legacy shared writer path is otherwise unchanged.

No migration is required for this code-only repair because the existing primary key enforces the deterministic UUID boundary.

## Production Safety

No first-shadow retry was performed in this repair task. Historical replay remains 14,840 rows and expects 0 mutations. NBA Official Picks, NBA production visibility, learning, calibration, bankroll, notifications, scheduler automation and MLB behavior remain inactive/unchanged.
