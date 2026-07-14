# SportsDataIO NBA Priced Game Odds Pilot V1

Last updated: 2026-07-14 15:05:00 -04:00

## Status

Corrected retry, legacy-moneyline supersession cleanup and bounded trial lineage verification are complete for the approved scope.

The confirmed priced endpoint is:

- `GET /v3/nba/odds/json/GameOddsByDate/2025-12-26`

The date was selected because existing durable trial feature snapshots reference SportsDataIO game IDs `22892` through `22896`, whose stored provider day is `2025-12-26`. Stored trial events for that provider day already exist in `sport_events`, and the earlier BettingEvents discovery pilot returned the same game-id family.

## Execution

- External provider calls used by the initial priced run: 1.
- External provider calls used by the approved corrected retry: 1.
- Concurrency: 1.
- Retries: 0.
- HTTP status: 200.
- Top-level records fetched: 9.
- Normalized rows produced by the first run: 1,476.
- Rows inserted according to sync job metadata: 1,476.
- `records_skipped`: 0.
- Initial sync job: `8ee9314a-f8e4-4a13-b861-2574a904bdc8`.
- Initial sync job status: `partial`.
- Last error: `476 normalized odds rows were not persisted.`
- Corrected retry sync job: `ed7ede3c-38c9-4f4f-b56b-446c43b8deb6`.
- Corrected retry status: `completed`.
- Corrected retry normalized rows: 540.
- Corrected retry inserted rows: 180 null-line moneylines.
- Corrected retry updated rows: 360 spread/total rows.

The post-persistence validation error was caused by a broad validation read that only observed the first 1,000 Supabase rows instead of chunking exact normalized IDs. The service now validates persisted odds rows by exact id chunks.

## Sanitized Shape

`GameOddsByDate` returned a top-level array of game objects. Field groups observed:

- game fields: `GameId`, `GlobalGameId`, `Season`, `SeasonType`, `Day`, `DateTime`, `Status`, team IDs/names, scores and rotation numbers
- priced pregame arrays: `PregameOdds`
- excluded arrays: `AlternateMarketPregameOdds`, `LiveOdds`
- pregame odds fields: `GameOddId`, `Sportsbook`, `SportsbookId`, `GameId`, `Created`, `Updated`, `HomeMoneyLine`, `AwayMoneyLine`, `HomePointSpread`, `AwayPointSpread`, spread payouts, `OverUnder`, over/under payouts and `Unlisted`

No raw provider records or secrets were documented.

## Findings

The initial normalizer traversed `AlternateMarketPregameOdds` even though alternate markets are out of scope. Read-only counts found:

- persisted trial odds rows: 1,476
- intended pregame full-game rows: 540
- alternate-like rows: 936
- market counts across persisted rows: 468 moneyline, 522 spread, 486 total
- sportsbook identity: `Scrambled`
- trial isolation: persisted rows carry `trial=true`, `scrambled=true`, `production_eligible=false`

The normalizer has been fixed so future runs skip `AlternateMarketPregameOdds` and `LiveOdds`, keep moneyline `line=null`, and validate canonical `moneyline`, `spread` and `total` markets only.

## Lineage

After the corrected retry and cleanup, 5 odds-enriched trial feature snapshot versions were available. The bounded Prediction -> Snapshot lineage pilot was retried with provider calls `0`, `maximumSnapshots=15`, `maximumPredictions=5`, `dryRun=false`, `confirmed=true` and trial-only flags.

First lineage run:

- snapshots considered: 15
- eligible snapshots: 5
- predictions inserted: 5
- predictions reused: 0
- settlement attempted: 5
- settled: 5
- wins: 3
- losses: 2
- production recommendations: 0
- production-eligible predictions: 0

Immediate idempotency rerun:

- predictions inserted: 0
- predictions reused: 5
- duplicate prediction identities: 0
- duplicate snapshot links: 0

Backtesting/calibration remain blocked for production use because the linked rows are trial/scrambled/non-production and have no genuine distinct closing snapshots.

## Cleanup Verification

Approved cleanup was executed on 2026-07-14 using this selector:

- `sport_key = basketball_nba`
- `league_key = nba`
- `provider = sportsdataio`
- `metadata.importModule = sportsdataio_nba_betting_odds_pilot_v1`
- `metadata.trial = true`
- `metadata.scrambled = true`
- `metadata.production_eligible = false`
- `metadata.sourcePath` attributable to `AlternateMarketPregameOdds`

Pre-cleanup counts:

- total pilot rows: 1,476
- intended `PregameOdds` rows: 540
- unintended alternate-like rows: 936
- live rows: 0
- ambiguous rows: 0
- feature snapshot references to alternate-like rows: 0
- prediction references to alternate-like rows: 0

Cleanup result:

- rows deleted: 936
- retained full-game rows: 540
- remaining alternate-like rows: 0
- remaining live rows: 0
- deleted ID checksum: `678332288c280be288eec8aa59ef220408b26de74b007ac27a5d66dc19d5566b`
- sync job audit metadata stores the exact deleted ID list and selector.

## Corrected Retry And Supersession Cleanup

The approved corrected retry used the same endpoint, provider date and import caps:

- endpoint: `GET /v3/nba/odds/json/GameOddsByDate/2025-12-26`
- provider calls: 1
- HTTP status: 200
- top-level provider records: 9
- normalized full-game rows: 540
- inserted: 180 corrected moneyline rows
- updated: 360 spread/total rows
- skipped: 0

The corrected moneyline rows have `line=null` and deterministic IDs with an empty line component. Before deleting legacy rows, verification found exactly 180 legacy non-null-line moneylines and 180 corrected replacements using the event, sportsbook, outcome, snapshot time, provider sportsbook, provider market and source-path replacement key. No historical feature snapshot or prediction rows referenced the legacy IDs.

Supersession cleanup result:

- legacy moneyline rows deleted: 180
- deleted ID checksum: `c495e86c0b085135a91c44892072c521725dd96f73ff1ba3ad215f66a4e3eaee`
- audit jobs updated: `8ee9314a-f8e4-4a13-b861-2574a904bdc8`, `ed7ede3c-38c9-4f4f-b56b-446c43b8deb6`

## Remaining Row Validation

The final 540 rows are all trial/scrambled/non-production, mapped to 9 stored SportsDataIO NBA events, and split evenly across markets:

- moneyline: 180
- spread: 180
- total: 180
- legacy moneyline rows: 0
- corrected null-line moneyline rows: 180
- duplicate rows: 0
- unresolved events: 0
- invalid prices: 0
- invalid spread/total lines: 0
- missing derived decimal/implied odds: 0

Cutoff-safe read-only comparison against the 15 trial feature snapshots found:

- snapshots considered: 15
- matching event and market: 15
- genuine offered price present: 15
- cutoff-safe prices: 15
- moneyline snapshots with corrected null-line prices: 5

Five new odds-enriched feature snapshot versions were created for the lineage pilot. Original snapshots were not mutated.

## Blocker

No remaining blocker exists for the approved trial-only priced odds and lineage verification scope. Production use remains blocked until production-eligible, non-scrambled data, sufficient settled samples, genuine closing snapshots, real-data validation and explicit production approval exist.
