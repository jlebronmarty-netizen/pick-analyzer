# SportsDataIO NBA Pilot Import V2

Last updated: 2026-07-13 11:11:42 -04:00

## Status

Completed capped live trial verification.

The V2 pilot validated the next SportsDataIO NBA trial domains for `2025-DEC-26` under a fresh 4-call cap after the integer-safe game-stat normalization fix. The rerun completed successfully, persisted `sport_game_stats`, preserved existing event/standing/team-stat/mapping rows through stable upserts and kept all trial/scrambled data isolated from production prediction paths.

## Scope

Approved pilot date: `2025-12-26`

Provider date format: `2025-DEC-26`

Allowed domains:

- Games/events
- Final scores
- Standings
- Team season stats
- Team game stats

Explicitly excluded:

- Odds
- Injuries
- Lineups
- Props
- Play-by-play
- Player stats
- Prediction generation
- Backtesting
- Model training

## Endpoints

The original dry-run plan estimated 5 provider calls and made 0 external calls.

The completed verification rerun used 4 external calls:

- `/v3/nba/scores/json/GamesByDate/2025-DEC-26`
- `/v3/nba/scores/json/Standings/2026`
- `/v3/nba/stats/json/TeamSeasonStats/2026`
- `/v3/nba/stats/json/TeamGameStatsByDate/2025-DEC-26`

`ScoresByDate/2025-DEC-26` was not called because the GamesByDate payload provided enough score context for the importer path.

## Persistence Outcome

Rows visibly isolated as SportsDataIO trial/scrambled data after the completed rerun:

- `sport_events`: 14 trial SportsDataIO events total across V1 and V2.
- `sport_standings`: 30 trial standings rows.
- `team_stats`: 30 trial team-season rows.
- `provider_entity_mappings`: 44 SportsDataIO NBA mappings.
- `sport_game_stats`: 18 V2 trial rows, two team-stat rows for each of the 9 completed V2 events.
- `sports_sync_jobs`: latest SportsDataIO NBA Pilot V2 job recorded as `completed`.

Every V2 row that persisted uses metadata equivalent to:

- `source=sportsdataio`
- `trial=true`
- `scrambled=true`
- `production_eligible=false`

Trial/scrambled rows must not feed real ROI, accuracy, calibration, model training, production predictions or betting recommendations.

## Fixed Failure

The V2 job failed with:

`sport_game_stats persistence failed: invalid input syntax for type integer: "183.6"`

Root cause: the importer accepted a decimal provider stat value as a candidate for integer score columns in `sport_game_stats`.

Fix applied: `safeIntegerNumber` now only passes integer values into integer score columns. Decimal provider metrics remain out of integer score fields and are preserved only where the destination supports numeric/stat metadata.

Verification result: the rerun persisted 18 `sport_game_stats` rows with zero non-integer values in `points_for`, `points_against`, `first_half_points` or `quarter_scores`.

## Validation

Executed validations after the completed rerun:

- `POST /api/historical-import/execute` dry run: success, 0 provider calls, estimated 5 calls, estimated 380 records.
- `POST /api/historical-import/execute` live run: failed after 4 provider calls during `sport_game_stats` persistence.
- `GET /api/historical-import/jobs`: V2 failed job observable with `externalCallsUsed=4`.
- Direct Supabase counts with service role: trial events, standings, team stats, mappings and job rows verified without printing secrets.
- `POST /api/historical-import/execute` verification rerun: success, `completed`, 4 provider calls, 87 records fetched, 87 normalized, 18 inserted, 78 updated, 0 skipped, 0 errors.
- Latest `GET /api/historical-import/jobs`: V2 job `completed`, `externalCallsUsed=4`, endpoint statuses 200 for GamesByDate, Standings, TeamSeasonStats and TeamGameStatsByDate.
- Direct Supabase integrity checks: no duplicate events, standings, team stats or game stats; no orphan game stats; no provider mapping conflicts; no trial leakage into production predictions; no non-integer score fields.
- `GET /api/nba/data-quality`: success, status `warning`, 5 issues.
- `GET /api/nba/data-quality/coverage`: success, teams 100%, events 100%, completed games 100%, standings 100%, game stats 69.23%, odds 0%, predictions 0%, provider mappings 100%.
- `GET /api/nba/features/preview`: success, 0 provider calls, feature quality 80, sufficiency 90, 2 warnings, no persisted recommendations.
- `GET /api/nba/features/validation`: success, 0 provider calls.
- `GET /api/nba/predictions?limit=20`: success, 0 predictions, 0 trial leaks and no persistence.
- `npm.cmd run build`: exit code 0, compiled successfully, TypeScript passed, generated 175/175 static pages.

## Data Quality Snapshot

After the completed V2 rerun:

- Teams coverage: 100%.
- Events coverage: 100%.
- Completed games coverage: 100%.
- Standings coverage: 100%.
- Game stats coverage: 69.23%, because 9 of 13 completed games now have two team game-stat rows.
- Odds snapshots coverage: 0%, intentionally not imported.
- Prediction coverage: 0%, because trial/non-production data remains excluded from production prediction paths.
- Provider mappings coverage: 100%.

Historical gaps remain high and should not be filled without explicit Phase B quota/date-window approval.

## Idempotency

The verification rerun preserved existing rows through stable upsert keys:

- Events inserted 0, updated 9.
- Standings inserted 0, updated 30.
- Team stats inserted 0, updated 30.
- Game stats inserted 18, updated 0.
- Mappings inserted 0, updated 9.

Local idempotency validation found stable event, standing, team-stat, game-stat and provider-mapping keys with no duplicate rows.

## Recommended Pilot V3

Run only after explicit approval:

- Provider: `sportsdataio`
- Sport: `basketball_nba`
- Date: choose one additional completed provider-supported NBA date.
- Maximum requests: 4 or fewer.
- Maximum records: 500.
- Domains: `games`, `standings`, `team_stats`, `game_stats`.
- Concurrency: 1.
- Batch size: 1.
- Dry run first.
- Confirm `sport_game_stats` idempotency by reusing stable provider event/team IDs.
- Keep `trial=true`, `scrambled=true`, `production_eligible=false`.

Do not add odds, injuries, lineups, props, play-by-play, player stats, prediction generation, backtesting or training in Pilot V3.
