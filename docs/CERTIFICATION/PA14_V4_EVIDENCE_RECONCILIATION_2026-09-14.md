# PA14 V4 — Stored-Evidence Reconciliation Addendum

Date: 2026-09-14

Branch: `pa14-v4-evidence-reconciliation-20260914`

Contract: `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`

## Status

This addendum corrects stale inventory statements in `PA14_V4_STORED_EVIDENCE_BUILDER_AUDIT.md` and records newly recovered stored evidence. It does **not** weaken the frozen contract and does **not** certify a production row.

Current verdict remains:

`PA14_V2_STORED_EVIDENCE_BUILDER_CERTIFIED = NO`

`PICK_EDGE_PA_14_V2_DATA_CONTRACT_READY = NO`

No Consumer endpoint, model training, Official Picks change, APOSTAR change, production DDL, production DML or Pick Edge modification is authorized by this addendum.

## 1. Correction: historical BF table is not empty

The earlier audit stated that `historical_baseball_pitcher_appearances` was empty. Current read-only production SQL disproves that statement.

Current inventory:

- `20,870` pitcher-appearance rows;
- all `20,870` rows have `batters_faced`;
- `4,860` rows have `starter=true`;
- `2,430` distinct canonical games;
- `1,228` distinct pitchers.

However, this table is a 2025 Retrosheet reconstruction only. Its lineage marks it as historical postgame supporting evidence and not pregame-starter authority. Player identity is not presently certified from Retrosheet pitcher IDs to MLBAM for the V2 target path. Therefore this correction does not by itself create a V2-eligible row.

## 2. Recovered September 14 MLB Official cache

The temporary stored export table `_temp_mlb_excel_export_20260914` contains the previously documented September 14 MLB Official cache.

The `schedule` payload was persisted at:

`2026-09-14T15:45:38.945422Z`

For target `gamePk=824465`, that payload contains:

- official game date: `2026-09-14`;
- scheduled target start: `2026-09-14T22:40:00Z`;
- away: Los Angeles Dodgers (`MLB team id 119`);
- home: Cincinnati Reds (`MLB team id 113`);
- away probable pitcher: Tarik Skubal (`MLBAM 669373`);
- home probable pitcher: Nick Lodolo (`MLBAM 666157`);
- MLB state at stored observation: `Scheduled / Preview`.

This proves that the target schedule and probable-starter state were observed and retained almost seven hours before target start.

The same temporary evidence store contains the associated `boxes` payload persisted at `2026-09-14T15:46:44.716088Z`.

### Temporal limitation

The frozen contract does not allow collector `created_at` / acquisition time alone to serve as source-state authority. Inspection of the retained target payloads found no independent source-state field such as `sourceTimestamp`, `lastUpdated`, `updatedAt` or `fetchedAt` tied to the immutable probable-starter version.

`mlb_starter_assignments`, `sport_lineups` and `sports_sync_jobs` also yielded no qualifying target evidence for `824465` / `79539` / Skubal / Lodolo.

Therefore:

`TARGET_CACHE_RECOVERED = YES`

`TARGET_AVAILABLE_BEFORE_START = YES`

`TARGET_SOURCE_STATE_TIMESTAMP_CERTIFIED = NO`

`PREGAME_STARTER_PROVENANCE = BLOCKED_AUTHORITATIVE_SOURCE_STATE_TIMESTAMP`

The September 14 target must remain fail-closed. A later provider response cannot retroactively manufacture the missing source-state timestamp.

## 3. New authoritative 2026 BF path for Tarik Skubal source starts

The stored `_temp_mlb_excel_export_20260914.analytics_pitcher_gamelogs` payload is an MLB Stats API pitching `gameLog` response. For Tarik Skubal (`MLBAM 669373`) it contains 23 same-season starts before the September 14 target. Each split carries:

- MLBAM player identity;
- MLB `gamePk`;
- official game date;
- opponent identity;
- `gamesStarted=1`;
- `numberOfPitches`;
- `battersFaced`;
- `strikeOuts`.

The 23 source starts run from `2026-03-26` through `2026-09-08`.

A read-only reconciliation against `pick2_raw_mlb_statcast_pitches` found, for all 23 starts:

- MLB Official `numberOfPitches` == reconstructed delivered Statcast pitch count;
- MLB Official `battersFaced` == reconstructed completed PA count;
- MLB Official `strikeOuts` == reconstructed terminal strikeout count;
- zero missing release velocity in those delivered pitch rows;
- zero frozen description/type conflicts in those starts.

Result:

`SKUBAL_2026_STARTS_RECONCILED = 23/23`

`SKUBAL_BF_RECONCILIATION = PASS_FOR_IDENTIFIED_SOURCE_STARTS`

This materially supersedes the earlier blanket classification `BLOCKED_AUTHORITATIVE_BF_NOT_PERSISTED` for this target pitcher. It does not certify all pitchers globally.

## 4. Source-game completion chronology

For Skubal's source starts through September 3, `pick2_mlb_games` retains MLB Official rows marked `Final`, with canonical `gamePk`, scheduled start and source payload digest.

For the September 8 start (`gamePk=823901`), the canonical game row remained a pregame observation, but a separate persisted `sport_events` record contains an MLB Stats API schedule read performed at:

`2026-09-09T07:17:49.458Z`

That stored MLB result says:

- `gamePk=823901`;
- `detailedState=Final`;
- `abstractGameState=Final`.

This read occurred well before the September 14 target cutoff and can serve as a historical completion upper bound under the frozen contract's historical-event chronology rule.

Therefore all 23 identified Skubal starts now have a plausible stored route to completed-game chronology without using target outcome information.

## 5. Cincinnati opponent census through September 13

The target opponent is Cincinnati.

The retained September 14 `season` MLB Official payload contains completed game `823734`, Cincinnati at Milwaukee on `2026-09-13`, with Cincinnati winning 4-3. This establishes that the game existed and was completed before the target cutoff.

The stored MLB batter gamelog payloads also contain Cincinnati's September 13 batting box-score lines for `gamePk=823734`. Aggregating all Cincinnati batting rows for that game yields:

- 9 players represented;
- 34 plate appearances;
- 30 at-bats;
- 8 hits;
- 3 walks;
- 1 sacrifice fly;
- 8 strikeouts.

Those aggregate box-score counts are coherent and demonstrate that the game is represented in retained MLB Official evidence.

### Remaining frozen-builder limitation

`pick2_raw_mlb_statcast_pitches` currently contains zero pitch rows for `gamePk=823734`; its stored horizon ends on `2026-09-12`.

The frozen builder requires terminal PA evidence keyed by ordered at-bat identity, plus complete pitch/terminal census. Aggregate batter box-score totals must not be transformed into invented at-bat-number terminal records.

Therefore:

`CIN_2026_OPPONENT_GAME_823734_BOX_SCORE = RECOVERED`

`CIN_2026_OPPONENT_GAME_823734_ORDERED_TERMINAL_CENSUS = MISSING`

`OPPONENT_CENSUS_BUILDER_READY = NO`

## 6. Current blocker set after reconciliation

The earlier audit's blocker description is narrowed as follows.

Resolved or materially improved:

1. Exact V3 frozen artifacts recovered and manifest preserved on branch.
2. September 14 MLB Official target cache recovered.
3. Tarik Skubal 2026 authoritative per-start BF recovered from stored MLB game logs.
4. All 23 identified Skubal prior starts reconcile MLB pitches, BF and K to stored Statcast.
5. Completion chronology is recoverable for the 23 source starts, including separate Final evidence for September 8.
6. Cincinnati's missing September 13 game identity/result and aggregate batting box score are recovered.

Still blocking certification:

1. The September 14 probable-starter snapshot lacks an independently retained authoritative source-state timestamp as required by V2. Acquisition time alone cannot be promoted.
2. Cincinnati `gamePk=823734` lacks ordered terminal/pitch evidence in the stored raw pitch corpus; aggregate batter gamelogs are insufficient to synthesize V2 terminal PAs.
3. A complete Cincinnati qualifying-game census must be replayed after the September 13 terminal evidence gap is resolved.
4. No real stored input has yet been fed through the deterministic builder to produce an eligible production row with complete dependencies and digests.
5. Production-row deterministic replay and leakage certification therefore remain pending.

## 7. Fail-closed conclusion

The evidence situation is substantially better than the original audit described, but the September 14 target still cannot be certified under the frozen contract.

Current exact state:

`PA14_V2_STORED_EVIDENCE_BUILDER_CERTIFIED = NO`

`PICK_EDGE_PA_14_V2_DATA_CONTRACT_READY = NO`

`REAL_PREGAME_ROW = NONE_CERTIFIED`

`CONSUMER_IMPLEMENTATION = PROHIBITED_PENDING_REAL_ELIGIBLE_ROW`

The next valid route is not to weaken V2 or backfill invented target timestamps. It is to preserve a future target snapshot with explicit source-state temporal authority and to ensure raw/terminal opponent evidence is retained through the cutoff, then replay the frozen builder end-to-end.