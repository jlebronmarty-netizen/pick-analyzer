# MLB Real Data Validation Batch V1

Last updated: 2026-07-14

## Status

Status: completed for quarantined events, players, team game stats, player game stats, date-level full-game odds, full-date line-movement odds and bounded technical feature/prediction lineage. Prospective Day 1 readiness is prepared but disabled pending explicit activation.

Reason: the first selected completed date, `2026-07-13`, returned no games, team game stats, player game stats or game odds. A reserved validation call confirmed `2026-07-12` has 15 game records, but the 10-call budget was mostly consumed, so the batch stopped safely before persistence. The first follow-up stopped on a Supabase `sport_player_stats` existing-ID preflight `Bad Request` before any upsert. The corrected retry used conservative 100-ID preflight chunks and completed bounded quarantined persistence for the one-date batch. The approved odds-only retry fixed the `GameId`/`GameID` and nested `PregameOdds` normalizer, persisted 90 quarantined odds rows, then stopped before feature/prediction handoff because 0 date-level odds rows were timestamp-safe relative to stored event starts. Line Movement Probe V1 proved timestamp-safe historical movement exists for GameId `78723`. Line Movement Expansion Batch V1 then expanded to the remaining 14 events, and the existing Feature Store route completed a bounded 45-snapshot, 45-prediction quarantined technical lineage and settlement batch.

## Scope

- Provider: SportsDataIO Discovery Lab MLB Fantasy + Odds
- Provider variant: `sportsdataio_discovery_lab`
- Base origin: `https://api.sportsdata.io`
- Auth header: `Ocp-Apim-Subscription-Key`
- Key env var: `SPORTSDATAIO_MLB_API_KEY`
- Initial call cap: 10
- Initial calls used: 8
- Continuation call cap: 8
- Continuation calls used: 5
- Corrected retry call cap: 5
- Corrected retry calls used: 5
- Odds-only retry call cap: 1
- Odds-only retry calls used: 1
- Line-movement probe call cap: 1
- Line-movement probe calls used: 1
- Line-movement expansion call cap: 14
- Line-movement expansion calls used: 14
- Concurrency: 1
- Retries: 0
- Timeout: 15 seconds
- Raw payload storage: none
- Production promotion: none

## Selected Date

Initial selected date: `2026-07-13`.

Reason: it was yesterday relative to the current date, inside the current MLB season and should have been completed rather than active.

Outcome: unsuitable. `GamesByDate/2026-JUL-13` returned 0 records.

Candidate for next batch: `2026-07-12`.

Reason: one reserved validation call returned HTTP 200 with 15 game records, satisfying the requested 5-15 completed-games target. Use this date for the next bounded batch.

Continuation selected date: `2026-07-12`.

Outcome: the first continuation provider transport succeeded for the bounded one-date sequence, but persistence stopped before the first mutation because the `sport_player_stats` existing-ID preflight returned `Bad Request`. The corrected retry completed persistence for teams, players, events, mappings, team game stats and player game stats. The odds-only retry completed persistence for full-game moneyline, run-line and total outcomes after the normalizer was corrected for `GameId` casing and nested `PregameOdds`.

## Endpoint Results

| # | Endpoint | Status | Records | Shape |
| --- | --- | --- | ---: | --- |
| 1 | `/api/mlb/fantasy/json/Teams` | 200 | 30 | array |
| 2 | `/api/mlb/odds/json/Stadiums` | 200 | 97 | array |
| 3 | `/api/mlb/odds/json/GamesByDate/2026-JUL-13` | 200 | 0 | array |
| 4 | `/api/mlb/fantasy/json/Standings/2026` | 200 | 30 | array |
| 5 | `/api/mlb/odds/json/TeamGameStatsByDate/2026-JUL-13` | 200 | 0 | array |
| 6 | `/api/mlb/fantasy/json/PlayerGameStatsByDate/2026-JUL-13` | 200 | 0 | array |
| 7 | `/api/mlb/odds/json/GameOddsByDate/2026-07-13` | 200 | 0 | array |
| 8 | `/api/mlb/odds/json/GamesByDate/2026-JUL-12` | 200 | 15 | array |

Continuation provider endpoints reached before the persistence stop:

| # | Endpoint | Status | Notes |
| --- | --- | --- | --- |
| 1 | `/api/mlb/odds/json/GamesByDate/2026-JUL-12` | 200 | provider transport passed |
| 2 | `/api/mlb/odds/json/TeamGameStatsByDate/2026-JUL-12` | 200 | provider transport passed |
| 3 | `/api/mlb/fantasy/json/PlayerGameStatsByDate/2026-JUL-12` | 200 | provider transport passed |
| 4 | `/api/mlb/odds/json/GameOddsByDate/2026-07-12` | 200 | provider transport passed |
| 5 | `/api/mlb/fantasy/json/Players` | 200 | called for Player.Status-derived availability context |

The continuation stopped before sanitized count reporting was emitted by the temporary runner, so exact continuation payload counts beyond the previously known 15 `GamesByDate` records are not recorded in documentation. No raw payloads were stored.

Corrected retry endpoint counts:

| # | Endpoint | Status | Records |
| --- | --- | --- | ---: |
| 1 | `/api/mlb/odds/json/GamesByDate/2026-JUL-12` | 200 | 15 |
| 2 | `/api/mlb/odds/json/TeamGameStatsByDate/2026-JUL-12` | 200 | 30 |
| 3 | `/api/mlb/fantasy/json/PlayerGameStatsByDate/2026-JUL-12` | 200 | 463 |
| 4 | `/api/mlb/odds/json/GameOddsByDate/2026-07-12` | 200 | 15 |
| 5 | `/api/mlb/fantasy/json/Players` | 200 | 7,258 |

Odds-only retry endpoint counts:

| # | Endpoint | Status | Records |
| --- | --- | --- | ---: |
| 1 | `/api/mlb/odds/json/GameOddsByDate/2026-07-12` | 200 | 15 |

Line-movement probe endpoint counts:

| # | Endpoint | Status | Records |
| --- | --- | --- | ---: |
| 1 | `/api/mlb/odds/json/GameOddsLineMovement/78723` | 200 | 1 top-level game, 624 nested movement records |

Line-movement expansion endpoint counts:

| Calls | Endpoint family | Status | Records |
| ---: | --- | --- | ---: |
| 14 | `/api/mlb/odds/json/GameOddsLineMovement/{gameid}` | all HTTP 200 | 14 top-level games, 5,490 nested movement records |

## Sanitized Payload Shapes

Teams fields:

- `TeamID`, `GlobalTeamID`, `Key`, `City`, `Name`, `League`, `Division`, `StadiumID`, `Active`
- logo/color fields are present
- `QuaternaryColor` may be null

Stadium fields:

- `StadiumID`, `Name`, `City`, `State`, `Country`, `Capacity`, `Surface`, `Type`
- location and dimension fields are present
- several dimension/location/detail fields may be null

Standings fields:

- `Season`, `SeasonType`, `TeamID`, `GlobalTeamID`, `Key`, `City`, `Name`, `League`, `Division`
- win/loss, home/away, day/night, division, last-ten and run totals are present
- `GamesBehind` and `WildCardGamesBehind` may be null

Games fields from `2026-JUL-12`:

- `GameID`, `Season`, `SeasonType`, `Day`, `DateTime`, `Status`
- `HomeTeamID`, `HomeTeam`, `AwayTeamID`, `AwayTeam`
- `HomeTeamRuns`, `AwayTeamRuns`, `Innings`, `StadiumID`
- probable/starting pitcher IDs and names are present
- moneyline, point spread, over/under and payout fields are present
- forecast fields are present

Empty feeds:

- `TeamGameStatsByDate/2026-JUL-13`: HTTP 200, empty array
- `PlayerGameStatsByDate/2026-JUL-13`: HTTP 200, empty array
- `GameOddsByDate/2026-07-13`: HTTP 200, empty array

GameOddsByDate fields from `2026-07-12`:

- top-level type: array
- top-level count: 15
- top-level fields: `AwayRotationNumber`, `AwayTeamId`, `AwayTeamName`, `AwayTeamScore`, `DateTime`, `Day`, `GameId`, `HomeRotationNumber`, `HomeTeamId`, `HomeTeamName`, `HomeTeamScore`, `PregameOdds`, `Season`, `SeasonType`, `Status`, `TotalScore`
- nesting: each inspected top-level game had `PregameOdds` as an array with 1 priced sportsbook object
- ID field candidates: `GameId`, `GameID`, `GlobalGameId`, `GlobalGameID`
- timestamp fields: `PregameOdds[].Created`, `PregameOdds[].Updated`
- priced fields: `HomeMoneyLine`, `AwayMoneyLine`, `HomePointSpread`, `AwayPointSpread`, `HomePointSpreadPayout`, `AwayPointSpreadPayout`, `OverUnder`, `OverPayout`, `UnderPayout`
- sportsbook fields: `Sportsbook`, `SportsbookId`
- nullability in inspected records: none observed in the sanitized shape sample
- values were not stored or documented beyond redacted type examples

GameOddsLineMovement fields from GameId `78723`:

- top-level type: array
- top-level count: 1
- top-level fields: `AwayRotationNumber`, `AwayTeamId`, `AwayTeamName`, `AwayTeamScore`, `DateTime`, `Day`, `GameId`, `HomeRotationNumber`, `HomeTeamId`, `HomeTeamName`, `HomeTeamScore`, `PregameOdds`, `Season`, `SeasonType`, `Status`, `TotalScore`
- nested path: `PregameOdds` array with 624 movement records
- timestamp fields: `DateTime`, `PregameOdds[].Created`, `PregameOdds[].Updated`
- sportsbook fields: `PregameOdds[].Sportsbook`, `PregameOdds[].SportsbookId`
- price/line fields: moneyline, point spread, point spread payout, over/under, over payout, under payout
- oldest timestamp: `2026-07-11T18:06:11.000Z`
- newest timestamp: `2026-07-12T16:14:44.000Z`

## Persistence

Corrected retry rows inserted:

- `sports_teams`: 30
- `sport_players`: 7,258
- `sport_events`: 15
- `provider_entity_mappings`: 7,796
- `sport_game_stats`: 30
- `sport_player_stats`: 463
- `sports_odds_snapshots`: 0 during the corrected five-call retry; 90 during the later odds-only retry
- `sports_sync_jobs`: 1

Rows updated during corrected retry: 0.

Odds-only retry persistence:

- provider calls used: 1
- records fetched: 15
- `PregameOdds` flattened: 15
- normalized rows: 90
- inserted: 90
- updated: 0
- skipped: 0
- moneyline rows: 30
- run-line rows: 30
- total rows: 30
- sportsbook: `Consensus`
- unresolved events: 0
- duplicate rows: 0
- orphan rows: 0
- invalid prices: 0
- invalid lines: 0
- trial/quarantine violations: 0
- local idempotency: reprocessed 90 rows; would insert 0 after upsert
- sync job: `4214c5a3-38de-41c8-9f53-7eab1714a34f`

Line-movement probe persistence:

- selected provider GameId: `78723`
- selected event: `baseball_mlb:mlb:sportsdataio:event:78723`
- selected game: MIL at PIT, completed, PIT 14 - MIL 5
- event start: `2026-07-12T12:15:00+00:00`
- candidate prediction cutoff: `2026-07-12T12:05:00.000Z`
- provider calls used: 1
- movement snapshots returned: 624
- normalized rows: 3,720
- inserted: 3,720
- updated/reused: 0
- rejected: 24
- duplicate logical rows: 0
- unresolved events: 0
- missing timestamps: 0
- moneyline rows: 1,248
- run-line rows: 1,224
- total rows: 1,248
- cutoff-safe rows: 2,586
- after cutoff but before event start: 48
- at/after event start: 1,086
- local idempotency: would insert 0 on local reprocessing
- sync job: `56db235c-8837-426f-8e84-e6e0ebc70a97`

Line-movement expansion persistence:

- remaining provider GameIds: `78729`, `78724`, `78730`, `78732`, `78731`, `78722`, `78725`, `78727`, `78726`, `78733`, `78734`, `78735`, `78728`, `78736`
- provider calls used: 14
- HTTP statuses: all 200
- nested movement records returned: 5,490
- new normalized rows inserted: 32,722
- reused: 0
- rejected persisted rows: 0
- unresolved events: 0
- duplicate logical rows: 0
- full-date line-movement rows: 36,442
- full-date cutoff-safe rows: 25,498
- events with usable history: 15 of 15
- feature snapshots: 42 inserted, 3 reused; rerun 45 reused
- predictions: 42 inserted, 3 reused; rerun 45 reused
- settlement: 21 wins, 24 losses, 0 pushes, 0 voids, 0 pending
- production leakage: 0

Rows skipped: 0.

Remote mutations were bounded to the quarantined one-date batch and sync-job metadata. No rows were deleted or promoted.

Final read-only audit for MLB rows:

- `sports_teams`: 30
- `sport_players`: 7,258
- `sport_events` for season `2026`: 15
- `sport_game_stats` season `2026`: 30
- `sport_player_stats` season `2026`: 463
- `sports_odds_snapshots` season `2026`: 3,810
- `provider_entity_mappings`: 7,796
- `sports_sync_jobs` for `sportsdataio_mlb_real_data_validation_batch_v1`: 1

## Quarantine Assessment

Assessment: warning.

Issues:

- The `sport_player_stats` preflight `Bad Request` root cause was oversized `.in()` URL/query shape from 500 long text IDs in the temporary MLB runner. Synthetic read-only probes succeeded through 150 IDs and failed at 250/500 IDs. The repository helper now sanitizes, dedupes and chunks at 100 IDs.
- `GameOddsByDate` returned 15 records with nested `PregameOdds`; the corrected odds-only retry persisted 90 quarantined odds rows after supporting `GameId`/`GameID` aliases and nested `PregameOdds`.
- Timestamp-safe line-movement odds now exist for one probed event, but feature/prediction handoff remains blocked because the existing durable lineage pilot is NBA-specific and MLB feature sufficiency/prediction lineage needs an approved bounded extension. Player.Status does not provide a historical source timestamp, and completed-date game/player stats are postgame settlement inputs.
- Literal `validation_status='quarantined'` is not currently compatible with the `prediction_history` constraint, which allows `pending`, `valid`, `skipped` and `failed`. Quarantine should remain in metadata unless an additive schema decision is approved.

No production contamination occurred.

Player availability from `Player.Status`:

- available: 1,371
- injured_list: 337
- unavailable: 7
- temporary_absence: 3
- restricted: 18
- minors_or_non_active: 5,522
- unknown: 0

## Feature, Prediction, Settlement And Backtest

Feature snapshots inserted: 0.

Reason: timestamp-safe line-movement odds exist for GameId `78723`, but no approved MLB-compatible durable feature/prediction lineage path exists yet. Player.Status lacks historical source timestamps for pregame reconstruction, and completed-date stats are postgame inputs.

Predictions inserted: 0.

Reason: no eligible MLB feature snapshots with approved lineage existed.

Settlement: not run.

Backtest: not run.

CLV: blocked because no prediction-time and later closing snapshots were available.

## Production Candidate Assessment

Production candidates: 0.

Quarantined rows: 0.

Promotion performed: no.

Production Data Gate result: production recommendations, ROI, CLV, calibration, model learning and model promotion remain excluded.

## Next Bounded Batch

Recommended next batch:

- Date: `2026-07-12`
- Do not rerun the same GameOddsByDate odds-only retry unless verifying idempotency under a separately approved call cap; local reprocessing already confirmed it would insert 0 rows.
- Either approve a maximum-14-call line-movement expansion for the remaining `2026-07-12` events or first approve an MLB-compatible bounded feature/prediction lineage extension over GameId `78723`.
- No `PlayerSeasonStats`, `TeamSeasonStats`, `Games/{season}`, DFS or free-agent calls.
- Stop on unsupported payload shape, persistence failure, mapping conflict or timestamp leakage.

Expected result: the already-persisted 15 events, 90 date-level odds rows and 3,720 GameId `78723` line-movement rows can support mapping, idempotency and timestamp-safe odds validation, but not production features or predictions until an MLB-compatible lineage path is approved.
