# Master Roadmap

This roadmap is dependency-aware and based on repository inspection. A module is marked completed only when the repository contains service/API/dashboard/persistence evidence and recent verification supports it.

Pick Analyzer MLB is certified as `PICK_ANALYZER_MLB_ROADMAP_REALIGNMENT_FROM_PARLAY_AUTOMATION_TO_PICK_ANALYSIS_CERTIFIED`. Pick Analyzer MLB is an individual-pick/value-analysis system. 100-daily-parlay generation is not a core product requirement. The active MLB roadmap now prioritizes individual pick probability, implied/no-vig market comparison, edge and expected-value scoring, matchup intelligence, selective Official Picks, Value Board, pick detail explanations and market-specific model datasets. 100-daily-parlay generation, Portfolio 101 as a mandatory daily layer and full-slate combinatorial parlay generation are retired as current core objectives and preserved only as legacy/experimental references.

MLB-DATA-01D-R1I is certified as `MLB_DATA_01D_R1I_PARTIAL_FEATURE_DML_RESUME_CERTIFIED`. The user-supplied R1H manual catalog readback proves the exact legacy bullpen uniqueness object is gone, contradictory legacy bullpen uniqueness is 0, and native `target_game_pk + team_id + feature_version` bullpen uniqueness is active while the wider native index remains preserved. After publication and production alignment to `ac3fc83c4effd9d97d24b8eda32e6354b14b431e`, live manifest authority passed and authorized R1I DML inserted only the remaining certified daily feature domains: bullpen 4,498, batter 44,943, matchup 2,249 and first inning 2,249. Team 4,498, starter 4,498 and snapshots 67,433 were reuse-only; raw/native identities, models, champion, predictions, market layer, 2026 isolation, automation and cron boundaries stayed preserved. `MLB_DATA_01D_2025_FEATURE_FOUNDATION_READY = YES`; next: `MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION`, dataset-prep only.

MLB-DATA-02A is certified as `MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION_CERTIFIED`. It prepared dataset specifications and read-only sample inventories only: moneyline 2,249 ready game rows; NRFI/YRFI 2,249 ready game rows; pitcher strikeouts and hits allowed 4,498 ready starter-game rows; batter hit, total bases and home run 44,943 ready batter-game rows; run line/game total/team total partial due to missing historical sportsbook lines; pitcher outs partial; pitcher earned runs blocked pending exact official pitching-line/result adapter evidence. Historical market prices are missing across audited 2025 MLB markets, so outcome probability modeling can proceed while edge/EV/CLV validation remains separately blocked. Recommended first model family: `moneyline`. No model training, validation, predictions, Official Picks, Value Board publication, provider calls, production DML/DDL, 2026 import, automation or cron changes occurred.

MLB-DATA-02B is certified as `MLB_DATA_02B_MONEYLINE_MODEL_TRAINING_PREP_CERTIFIED`. It published and production-aligned 02A commit `b229387c0fa5dc2eee3d27e89993dff07cfa0967`, then prepared a moneyline training contract only: 2,249 one-row-per-`game_pk` labels, no ties, no unresolved finals, paired home/away feature representation, 76 candidate pregame inputs, identifier/outcome/odds exclusion, chronological train/validation/test split of 1,574/337/338 rows and deterministic dataset digest `4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209`. Model training remains unperformed; the runner fails closed on `--execute-training` during 02B prep. No model rows, champion, predictions, provider calls, production DML/DDL, 2026 import, automation or cron changes occurred.

MLB-DATA-02C is certified as `MLB_DATA_02C_MONEYLINE_MODEL_TRAINING_EXECUTION_CERTIFIED`. It published and production-aligned 02B commit `c15cb8929d5fe26930513119bf3868b0fe5971f8`, rebuilt the certified moneyline dataset digest, fit train-only preprocessing and trained bounded local baseline models only. The selected final-holdout candidate is `regularized_logistic_C_1`; test metrics are log loss 0.683101, Brier 0.245035, AUC 0.551172, accuracy 0.568047 and ECE 0.023464, with positive deltas versus the trivial baseline on log loss, Brier, AUC and accuracy. Local model artifact digest is `9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616`. `MLB_02C_CHAMPION_ELIGIBILITY = ELIGIBLE`, but no champion was promoted, no model rows or predictions were written and no betting-value claims are certified while historical market prices remain missing.

MLB-DATA-02D is certified as `MLB_DATA_02D_MONEYLINE_MODEL_PROMOTION_PREP_CERTIFIED`. It published and production-aligned 02C commit `5c9bfde15e49321118fa95c23fbc66a0d7912593`, revalidated model artifact digest `9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616`, dataset digest `4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209`, 02C metrics, calibration and walk-forward readiness, and prepared deterministic future persistence records for registry, feature set, model version, training run, validation run and champion pointer/status. Production model/prediction zero baseline passed and future promotion DML caps are bounded to 6 model/promotion rows with 0 prediction/feature/market-value rows. `MLB_02D_PROMOTION_ELIGIBILITY = ELIGIBLE`.

MLB-DATA-02E is certified as `MLB_DATA_02E_MONEYLINE_CHAMPION_PROMOTION_CERTIFIED`. It published and production-aligned 02D commit `87830c2ef2bc2d2a3c961e0016c9595ec6558665`, then executed only bounded production model persistence and Champion promotion for the certified MLB moneyline probability model. Production now has exactly 1 registry row, 1 feature-set row, 1 model-version row, 1 training-run row, 1 validation-run row and 1 active MLB moneyline Champion: `MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1`. The Champion is backed by artifact digest `9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616`, dataset digest `4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209` and feature set `MLB_ML_FEATURE_SET_V1`. Predictions, Official Picks, market-value rows, feature/raw writes, provider calls, production DDL, 2026 import, automation and cron changes remained 0/off.

MLB-DATA-02F is certified as `MLB_DATA_02F_MONEYLINE_PREDICTION_GENERATION_PREP_CERTIFIED`. It published and production-aligned 02E commit `9102cabeb6ff1a255c3012ccfacc78c4ddb6efbd`, read back the single MLB moneyline Champion, verified artifact digest `9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616`, 76-feature ordering and train-fitted preprocessing, and prepared the dry-run inference path without writing predictions. Historical replay rebuilt features from persisted 2025 feature tables, produced 2,249 probabilities, passed probability sanity and deterministic reproducibility, and matched 02C test metrics exactly within tolerance. Future live contracts are ready for input prerequisites, starter status, freshness, output shape, immutable prediction identity, idempotency and stale-prediction guards. Prediction/result/market-value writes, Official Picks, model mutations, Champion changes, provider calls, DDL, 2026 import, automation and cron changes remained 0/off.

MLB-DATA-02G is certified as `MLB_DATA_02G_MONEYLINE_PREDICTION_DML_PREP_CERTIFIED`. It published and production-aligned 02F commit `fd0ec977c0a7505a9758295df179f55fe25925ac`, read back the single Champion, and prepared the production prediction persistence contract in read-only/dry-run mode only. Native prediction identity is rooted in `game_pk`; the market is `moneyline`; away probability is the complement of home probability; `as_of` is the complete frozen inference-payload timestamp; and deterministic identity is `game_pk + market + model_version + feature_input_digest`. The dry-run built 24 sample rows and audited all 2,249 historical 2025 eligible identities with 0 duplicates, 0 invalid rows and 0 conflicts. The runner fails closed on `--execute-predictions` during 02G, historical backfill is not authorized, predictions/results/market-value rows remain 0, 2026 live prediction state is `NOT_READY`, and provider calls, production DML/DDL, model/champion/feature/raw mutations, automation and cron changes remain 0/off.

MLB-DATA-02H-R2 is certified as `MLB_DATA_02H_R2_2026_RAW_INSERT_TIMEOUT_RESUME_AND_FEATURE_DML_COMPLETION_CERTIFIED`. Production remained aligned to `cc85c0d777511fcad9f9ecc8c2dec32a175ca268`. The timeout recovery rebuilt the certified 2026 source plan from cached evidence with digest `6ebfea5753706781db16f486bd8ad386d67f4e5ab214f3bde77ab7ac18c0f767`, then used date-partitioned source-identity reconciliation and 100-row raw insert batches to finish the missing 2026 raw identities without conflicts. Final readback: 622,364 2026 raw rows, 622,364 certified raw identities, 0 missing, 0 unexpected, 0 duplicate identities, 0 conflicts, 2,154 native 2026 games, 1,794 total native players and 712,528 preserved 2025 raw rows. 2026 pregame features are now persisted with snapshots 59,031; team 3,902; starter 3,902; bullpen 3,902; batter 39,521; matchup 1,951; first inning 1,951; offense 3,902 logical rows. Row parity, native-key uniqueness, as-of, leakage, null-policy, feature sanity, raw idempotency and feature idempotency passed. Current dry-inference readiness is available for 37 games, with 8 games blocked by unknown starter state. Predictions, prediction results, market-value rows, Official Picks, model writes, Champion changes, production DDL, odds/value work, automation and cron changes remained 0/off.

MLB-DATA-02I is locally certified as `MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED`. It first published and production-aligned the prior 02H-R2 foundation commit `8f3c419ddc55ee218aea5dfacda4b0bec274381b`, then rebuilt current moneyline 76-feature vectors from stored 2026 raw/native evidence without provider calls or writes. Current inventory found 45 games: 24 dry-inference-ready via probable starters, 8 blocked by unknown starters and 13 blocked by game-status/as-of guard. Dry fair home probabilities ranged from 0.469129 to 0.611680 with mean 0.550271, all in range, 0 leakage violations, 0 reproducibility failures, 0 duplicate input digests and 0 duplicate deterministic identities. Future prediction persistence is prepared but not executed: 24 `INSERT_ELIGIBLE`, 0 `REUSE_NO_OP`, 0 `BLOCK_CONFLICT`. Prediction/result/market-value writes, Official Picks, odds/value work, provider calls, feature/raw/model/champion mutations, production DDL, automation and cron changes remained 0/off.

Current MLB roadmap sequence: separately authorize `MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_EXECUTION` before any live prediction writes; add no-vig/value scoring only after market-price history is certified; build Value Board and pick-detail explanations; certify selective Official Picks; then add optional user-selected parlay analysis only after individual-leg value and correlation contracts are certified. `SPORTSDATAIO_MLB_REQUIRED_BY_PICK2 = NO`, and MLB SportsDataIO credential repair remains out of scope for Pick 2 MLB.

MLB-DATA-01D-R1H schema readback authority prep is locally certified as `MLB_DATA_01D_R1H_SCHEMA_READBACK_AUTHORITY_PREP_CERTIFIED`. Because Supabase REST does not expose `pg_constraint`/`pg_index` catalog metadata in the current channel, R1H adds a SELECT-only manual SQL packet at `docs/CERTIFICATION/mlb-data-01d-r1h-schema-readback-authority-prep.sql` for the Supabase Production SQL Editor. The packet verifies `public.pick2_mlb_bullpen_daily_features`, the absence of `pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key`, the presence of `pick2_mlb_bullpen_daily_features_target_game_team_version_key` on `target_game_pk + team_id + feature_version`, and the absence of contradictory legacy uniqueness. No feature DML, schema mutation by Codex, production DML, provider call, model/prediction work, 2026 import, automation or cron change occurred. Next: run the manual SELECT-only packet and paste the output for final R1H migration certification.

MLB-DATA-01D-R1G is locally certified as `MLB_DATA_01D_R1G_BULLPEN_NATIVE_UNIQUENESS_REPAIR_PLAN_CERTIFIED`. The fresh production read-only audit preserved the R1F partial state with 67,433 snapshots, 4,498 team rows, 4,498 starter rows, 0 bullpen/batter/matchup/first-inning rows, 2,430 native games, 1,469 native players, 0 models, champion `NONE`, 0 predictions and 0 2026 raw rows. R1G adds only the non-applied migration `supabase/migrations/202608310001_pick2_mlb_bullpen_native_uniqueness_r1g.sql`, targeting the exact missed legacy bullpen constraint `pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key` and replacing it with `target_game_pk + team_id + feature_version` uniqueness. No production DDL/DML, provider calls, feature DML resume, runtime writer changes, raw/native identity writes, model/prediction work, automation or cron changes occurred. Next: publish/align R1G, then separately authorize applying the prepared migration and read-only schema/state certification before any DML resume.

MLB-DATA-01D-R1F daily feature recovery DML is partial as `MLB_DATA_01D_R1F_DAILY_FEATURE_RECOVERY_DML_PARTIAL`. After publishing/alignment of `f1eaa35ea88c1b7520c45a939f49fb6156290745`, the live manifest authority and fresh prewrite gates passed, then bounded execution inserted 4,498 team rows and 4,498 starter rows before stopping on the legacy bullpen uniqueness constraint `pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key`. Snapshots remain 67,433 with no writes, bullpen/batter/matchup/first-inning rows remain 0, native identity and raw evidence remain preserved, and model/prediction/2026/automation work remains 0. Feature foundation readiness remains `NO`; next: `MLB_DATA_01D_R1G_BULLPEN_NATIVE_UNIQUENESS_REPAIR_AND_PARTIAL_RESUME_PLAN`.

MLB-DATA-01D-R1F production manifest authority is certified as `MLB_DATA_01D_R1F_PRODUCTION_MANIFEST_AUTHORITY_CERTIFIED`. Production is aligned at `e39bb7631ab642c992576cc8a3b2e6ef99654f8c`, and the live `/api/system/pick2/r1f-manifest-authority` readback proves the deployed runtime sees the configured expected digest, matches the certified R1F manifest, verifies critical-code integrity and reports `productionAuthorityReady = true` without exposing the raw env value. Full R1F read-only preflight passed with 67,433 snapshot reuses, 0 conflicts and the certified daily insert plan; execute-dry stopped at `EXPLICIT_DML_AUTHORIZATION_REQUIRED`. Next: separately authorize bounded `MLB_DATA_01D_R1F_DAILY_FEATURE_RECOVERY_DML_EXECUTION`; do not begin model training or 02A in the same task.

MLB-DATA-01D-R1F production env authority readback route is locally certified as `MLB_DATA_01D_R1F_PRODUCTION_ENV_AUTHORITY_READBACK_ROUTE_CERTIFIED`. The new `GET /api/system/pick2/r1f-manifest-authority` endpoint is read-only and secret-safe: it reports only bounded R1F manifest authority booleans/status, the certified manifest digest, critical-code integrity status, feature version, failure code and the already-public production git commit. It never exposes the raw expected-digest env value and never authorizes feature DML. Next: publish/deploy this route, verify production alignment, then call the endpoint to prove the deployed runtime observes `PICK2_MLB_R1F_EXPECTED_MANIFEST_SHA256` before separately authorizing any R1F daily-feature recovery DML.

MLB-DATA-01D-R1F signed deployment certification manifest design is locally certified as `MLB_DATA_01D_R1F_SIGNED_DEPLOYMENT_CERTIFICATION_MANIFEST_CERTIFIED`. Active R1F write authority now uses `DIGEST_BOUND_DEPLOYMENT_CERTIFICATION_MANIFEST`, not deployed commit-SHA equality and not a token-only gate. The runtime-critical persistence script and certified input artifacts are bound by SHA-256 inside `config/pick2/mlb/r1f-deployment-certification-manifest.json`, whose canonical payload digest is `1c7532aa5aaf09d2c05ffb4df752bb5eee2e4f9c719489b70a97f9d14d587352`. Future production execution must have `PICK2_MLB_R1F_EXPECTED_MANIFEST_SHA256` configured to that exact digest, pass all production invariants and receive separate per-run DML authorization. Production config was not changed and feature DML remains blocked. Next: publish/align this manifest certification, then separately configure the expected digest before any separately authorized R1F daily-feature recovery DML.

MLB-DATA-01D-R1F guard repair target advance is certified as `MLB_DATA_01D_R1F_GUARD_REPAIR_TARGET_ADVANCE_CERTIFIED`. The active 01D feature persistence guard now accepts exactly the deployed certified guard-repair baseline `2560a3c9c6c147f3aaf7b83c8811648663c9cc1b` for both read-only preflight and execute-guard validation, while rejecting the prior `7d5cc1798e799b5048d5cccfd35db1822ea6ebc6` target as stale for active R1F execution. Read-only preflight and no-write execute-guard validation passed with 67,433 snapshot reuses, 0 conflicts and unchanged daily insert caps. No feature DML or production mutation occurred. Next: publish this target advance, wait for production alignment, then separately reissue bounded `MLB_DATA_01D_R1F_DAILY_FEATURE_RECOVERY_DML_EXECUTION` authorization against the new certified commit.

MLB-DATA-01D-R1E is certified as `MLB_DATA_01D_R1E_DAILY_FEATURE_RECOVERY_READINESS_CERTIFIED`. The verification commits through `fcde1844e5de8fc38da18862ca675f76edee3551` are published and production-aligned. Read-only recovery readiness proves 67,433 snapshot reuses, 0 conflicts, and daily insert-eligible caps of team 4,498, starter 4,498, bullpen 4,498, batter 44,943, matchup 2,249 and first-inning 2,249, with offense represented as 4,498 logical rows in existing offense-family snapshots. Feature DML remains unauthorized. Next: separately authorize `MLB_DATA_01D_R1F_DAILY_FEATURE_RECOVERY_DML_EXECUTION`.

MLB-DATA-01D-R1D is certified as `MLB_DATA_01D_R1D_SNAPSHOT_REUSE_DIGEST_RECONCILIATION_CERTIFIED`. The prior R1C snapshot reuse blocker was a validator readback defect caused by unordered PostgREST range pagination, not a real digest mismatch. Ordered snapshot readback now proves 67,433 exact digest matches, 0 mismatches, 0 missing snapshots, 0 unexpected snapshots and 0 reuse conflicts after a full 712,528-row production raw reconstruction. No feature DML, provider calls, production DDL/DML, model work, predictions, 2026 import, automation or cron changes occurred. Next: `MLB_DATA_01D_R1E_DAILY_FEATURE_RECOVERY_READINESS`; do not resume feature persistence without separate authorization.

MLB-DATA-01D-R1C is blocked as `MLB_DATA_01D_R1C_POST_MIGRATION_RECOVERY_VALIDATOR_BLOCKED`. The plan-only recovery gate now recognizes the R1B deployed baseline while keeping feature-DML `--execute` pinned to the old authorized baseline, but the repaired dry-run stopped after a full 712,528-row raw scan with `BLOCK_CONFLICT:SNAPSHOT_REUSE_MISMATCH:23200`. No feature DML, provider calls, production DDL/DML, model work, predictions, 2026 import, automation or cron changes occurred. Next: `MLB_DATA_01D_R1D_SNAPSHOT_REUSE_DIGEST_RECONCILIATION`; do not resume feature persistence.

MLB-DATA-01D-R1B is recorded as `MLB_DATA_01D_R1B_FEATURE_NATIVE_UNIQUENESS_MIGRATION_READBACK_PARTIAL`. The user manually applied the prepared native uniqueness migration and production is aligned at `61aeb84a58d0ae71ec02bbf044f70f3c60854d33`; Codex did not reapply it and made 0 production DDL/DML mutations. Read-only state remains intact with 67,433 snapshots, 0 daily feature rows, 712,528 raw rows, 2,430 native games, 1,469 native players, 0 models and 0 predictions. Full certification is still blocked until a catalog-visible constraint readback and direct post-R1B recovery dry-run path are available. Next: `MLB_DATA_01D_R1C_POST_MIGRATION_RECOVERY_VALIDATOR`; do not resume feature DML until separately authorized.

MLB-DATA-01D-R1A is certified as `MLB_DATA_01D_R1A_FEATURE_NATIVE_UNIQUENESS_MIGRATION_CERTIFIED`. It prepares one non-applied migration to drop/replace only the incompatible legacy team and bullpen daily-feature UNIQUE constraints with native `target_game_pk`-rooted uniqueness. The snapshot-only partial state is preserved, no production schema/DML occurred and feature persistence was not resumed. Next: separately authorize migration application/readback; after that separately authorize guarded daily feature persistence resume.

MLB-DATA-01D-R1 is blocked as `MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR_BLOCKED`. The audit certifies the snapshot-only partial state is stable and proves the legacy daily uniqueness defect: same-team same-date native feature rows collide under `team_id + feature_date + feature_version`, while `target_game_pk` safely disambiguates them. The persistence script now supports snapshot `REUSE_NO_OP` recovery and daily row resume after deterministic snapshot parity. Next: directly authorize creation of a forward migration that drops/replaces only the incompatible legacy UNIQUE constraints; do not apply it or resume DML without a separate gate.

MLB-DATA-01D feature persistence is blocked as `MLB_DATA_01D_2025_FEATURE_PERSISTENCE_BLOCKED`. The bounded production run inserted 67,433 certified generic feature snapshots, then stopped before any daily feature rows because the legacy `team_id + feature_date + feature_version` uniqueness constraint on `pick2_mlb_team_daily_features` cannot represent native target-game feature rows for same-team same-date cases. Daily feature tables, models, predictions, results and market layers remain at 0. Next: `MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR`; reconcile legacy uniqueness with native target-game keys, then separately authorize a guarded resume. Do not train models from the snapshot-only partial state.

MLB-DATA-01D is dry-run certified as `MLB_DATA_01D_2025_FEATURE_BUILD_DRY_RUN_CERTIFIED`. The dry-run uses native Pick 2 MLB identity from R5B and certifies pregame-safe feature foundations for team, starter, bullpen, batter, offense, matchup, first-inning, F5, run distribution, NRFI/YRFI and future Monte Carlo inputs with `source_game_date < target_game_date` as the conservative as-of rule. Projected persistence is 2,249 eligible games and 67,433 feature snapshot rows with 0 leakage violations and 0 identity conflicts. Next: separately authorize `MLB_DATA_01D_2025_FEATURE_PERSISTENCE`; do not train models, generate predictions or promote a champion from dry-run certification alone.

MLB-DATA-01C-R5B is certified as `MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL_CERTIFIED`. Pick 2 MLB identity is now operationally rooted in native `game_pk` and MLBAM `person_id`: production readback confirms 2,430 native games, 1,469 native players, 712,528 raw pitcher MLBAM ids and 712,528 raw batter MLBAM ids with 0 conflicts, 100% parity, raw immutability preserved and no result/market/feature/model/prediction rows. `MLB_DATA_01D_2025_FEATURE_BUILD_READY = YES`; next: `MLB_DATA_01D_2025_FEATURE_BUILD`, but do not start it without a separate instruction.

MLB-DATA-01C-R5A is certified as `MLB_DATA_01C_R5A_NATIVE_IDENTITY_MIGRATION_PRODUCTION_CERTIFIED`. The user manually applied the R5 native identity foundation migration through Supabase Production SQL Editor; Codex did not reapply it and made 0 production DDL/DML mutations. Production readback confirms native game/player/result/market-crosswalk tables and native raw/feature/prediction/result identity columns are visible, with native tables and raw MLBAM backfill columns still at zero rows. Next: `MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL`; populate only native games, native players and raw MLBAM pitcher/batter ids from certified existing 2025 raw Statcast identity evidence, with no feature build, model work, predictions, 2026 import, provider calls or automation.

MLB-DATA-01C-R5 is locally certified as `MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION_CERTIFIED`. It prepares one additive migration, `supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql`, with native `pick2_mlb_games`, `pick2_mlb_players`, `pick2_mlb_game_results` and `pick2_mlb_market_event_mappings` tables, nullable native identity columns for raw/features/predictions/results and bounded non-destructive relaxation of legacy event/player hard requirements. The migration is not applied and the 2025 native backfill is not performed. Next: `MLB_DATA_01C_R5A_NATIVE_IDENTITY_MIGRATION_APPLY_READBACK`, then `MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL`; do not build features, train models, generate predictions, import 2026 or restore SportsDataIO MLB.

MLB-DATA-01C-R4D is certified as `MLB_DATA_01C_R4D_PICK2_MLBAM_NATIVE_IDENTITY_PLAN_CERTIFIED`. SportsDataIO MLB is intentionally cancelled and no longer required for Pick 2 MLB identity. R4D audits the current Pick 2 foundation and finds legacy `sport_events.id` / `sport_players.id` hard dependencies still present in prepared feature and prediction tables, then replaces the old legacy R5 persistence direction with an additive native identity migration plan rooted in MLB `game_pk` and MLBAM `person_id`. Next: `MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION`; add native game/player registries and native identity columns only, then perform migration readback and 2025 native backfill before 01D. Do not restore SportsDataIO credentials, build features, train models, generate predictions or import 2026 in R5.

MLB-DATA-01C-R2A is certified as `MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED`. The bounded read-only probe verified `GET /api/v1/people/{personId}` for pitcher-only, batter-only and both-role source MLBAM ids, and verified the 3-ID bulk people endpoint as `SUPPORTED` with ID-set matching and no response-order dependency. Player identity acquisition is now request-contract ready for a future read-only R3 acquisition phase with a conservative 490-call bulk plan before cache reuse; crosswalk persistence and raw canonical mapping remain separately unauthorized. Next: `MLB-DATA-01C-R3_READ_ONLY_IDENTITY_ACQUISITION`; do not write `provider_entity_mappings`, raw canonical IDs or 01D features until a later persistence gate.

MLB-DATA-01C-R2 is classified as `MLB_DATA_01C_R2_IDENTITY_ACQUISITION_PLAN_BLOCKED` with `NEEDS_ENDPOINT_CONTRACT_VERIFICATION`. The full future acquisition inputs are artifacted for all 2,430 Statcast game_pk identities and all 1,469 MLBAM source person ids, and `provider_entity_mappings` remains the reusable crosswalk infrastructure with no migration required. MLB Official / MLB Stats API is selected as authoritative; game identity acquisition is plan-ready through schedule contracts, but player identity execution is blocked until an exact person endpoint or bulk person identity contract is verified. Next: `MLB-DATA-01C-R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CONTRACT_VERIFICATION`; do not persist crosswalks or build 01D features.

MLB-DATA-01C-R1 is classified as `MLB_DATA_01C_R1_IDENTITY_REPAIR_EXTERNAL_ID_GAP`. The audit confirms existing `provider_entity_mappings` is the reusable season-aware crosswalk contract for exact Statcast `game_pk` and MLBAM player identities, so no migration is required or applied. The blocker is missing authoritative external ID coverage: event mapping still has 305 unmapped and 309 ambiguous source games, and player mapping still has 1,469 unmapped source MLBAM players. Next: populate or certify exact no-guess `game_pk -> sport_events.id` and MLBAM `person_id -> sport_players.id` rows before `MLB-DATA-01D_2025_FEATURE_BUILD`; do not build features, train models or import 2026 data.

MLB-DATA-01C is classified as `MLB_DATA_01C_2025_CANONICAL_MAPPING_BLOCKED`. The phase certified and executed deterministic team mapping only: all 712,528 imported 2025 Statcast rows now carry canonical home/away team IDs, with source abbreviations preserved and aliases limited to `AZ -> ARI` and `CWS -> CHW`. Game mapping remains unwritten because canonical 2025 event evidence has no exact stored MLB gamePk rows, only partial provider crosswalks, 305 unmapped source games, 309 ambiguous source games and non-unique date/home/away matches. Player mapping remains unwritten because 1,469 unique source MLBAM persons lack a certified existing MLBAM-to-`sport_players.id` path. Next: repair canonical event gamePk identity and certify a no-provider MLBAM player identity path before `MLB-DATA-01D_2025_FEATURE_BUILD`.

MLB-DATA-01B is certified as `MLB_DATA_01B_2025_RAW_STATCAST_IMPORT_CERTIFIED`. The certified 2025 Baseball Savant Statcast package is now present in production raw storage with 712,528 rows in `pick2_raw_mlb_statcast_pitches`, 712,528 unique pitch identities, 0 duplicate identities, 0 rejected rows and 0 conflicts. All 119 source fields remain preserved by the typed raw table plus `raw_payload`; canonical game/player mapping is intentionally deferred. Next: `MLB-DATA-01C_2025_CANONICAL_GAME_PLAYER_TEAM_MAPPING`; do not build derived features or models before canonical mapping is certified.

MLB-DATA-01A is certified as `MLB_DATA_01A_2025_RAW_STATCAST_VALIDATION_CERTIFIED`. The complete original 2025 Baseball Savant Statcast package in `data/statcast/2025/raw` validates as 30 CSV files, 712,528 pitches, 2,430 games, 119 columns, 30 MLB teams and 0 duplicate/null pitch identities. Full dry-run transformation is ready with deterministic raw identity, `raw_payload` fidelity, leakage denylist classification, label reconstruction and checkpoint/idempotency/error-quarantine contracts. Next: separately authorize `MLB-DATA-01B_2025_RAW_STATCAST_IMPORT`; do not import raw rows until that authorization is explicit.

PICK-2.0 RESET-05 is certified as `PICK_2_RESET_05_CLEAN_BASELINE_CERTIFIED`. The user manually applied the final Pick 2 data-foundation migration, and production readback confirmed all 17 Pick 2 foundation tables exist, are readable and remain empty. Raw Statcast, feature, model, prediction, evaluation, market-value and data-health storage are now ready to receive validated data, while legacy rows remain isolated and no Statcast import or model work has occurred. MLB-DATA-01A source validation is now certified; next: separately authorize `MLB-DATA-01B_2025_RAW_STATCAST_IMPORT`.

PICK-2.0 RESET-04R1B is locally implemented as `PICK_2_RESET_04R1B_FULL_STATCAST_SCHEMA_CERTIFIED`. It supersedes only the reduced-source assumptions from RESET-04R1 after the complete original Baseball Savant 2025 and 2026 YTD files became the source authority. The source pitch identity remains `game_pk + at_bat_number + pitch_number`; all 119 audited source columns are accounted for; the raw table preserves complete rows in `raw_payload`; high-value pitch shape, movement, location, batted-ball, bat-tracking and score-label fields are explicitly typed; source MLBAM player/team evidence remains separated from canonical Pick IDs; and same-target-game score, win expectancy, run expectancy and future-state fields are denied as pregame features. Next: publish RESET-04R1B, then resume RESET-05 migration apply/readback; do not import Statcast during RESET-05.

PICK-2.0 RESET-04 is locally implemented as `PICK_2_RESET_04_DATA_FOUNDATION_CERTIFIED`. It prepares the additive Pick 2 database foundation while keeping production application, Statcast import, model training and automation blocked. Canonical sports identity tables are reused, raw Statcast and leakage-safe feature storage are new Pick 2 tables, sports predictions are separated from sportsbook value evaluation, and all legacy prediction/research/performance rows remain archived outside Pick 2 metrics. Next: publish RESET-04, then separately authorize production migration application or proceed to `MLB-DATA-01A_2025_RAW_STATCAST_VALIDATION`; do not import Statcast until migration application and source validation are explicitly approved.

PICK-2.0 RESET-03 is locally implemented as `PICK_2_RESET_03_UI_SIMPLIFICATION_CERTIFIED`. The normal user-facing product surface is reset around four canonical areas: `/today`, `/performance`, `/model-lab` and `/data-health`, with `/` mapped to Today. Performance is a Pick 2 clean-start view with zero predictions/evaluations and N/A metrics, Model Lab has no promoted champion, and Data Health marks Statcast as setup pending. Legacy product/research/admin pages remain available outside primary navigation until later bounded deletion or archive phases prove each dependency safe.

PICK-2.0 RESET-02A is locally implemented as `PICK_2_RESET_02A_BOUNDED_RUNTIME_SIMPLIFICATION_CERTIFIED`. The first cleanup pass removes only leaf-safe archival runtime code selected from the RESET-01 manifests: `/admin/historical-diagnostics` and the unused BSN prediction wrapper. Shared safety primitives, canonical data/result/odds infrastructure, protected auth, provider-budget accounting, active cron paths and all production data remain preserved. Next: publish RESET-02A, then continue with a separate RESET-02B route/service consolidation pass or RESET-03 data reset planning; do not import new data until the reset gates explicitly allow it.

PICK-2.0 RESET-02B is locally implemented as `PICK_2_RESET_02B_ROUTE_SERVICE_CONSOLIDATION_CERTIFIED`. It removes five uncalled legacy API wrappers while preserving their underlying services when still used elsewhere: `/api/ai/game-analysis`, `/api/ai-operations/lifecycle`, `/api/ai-performance-center/daily-update`, `/api/autonomous-daily-operations/demo` and `/api/autonomous-daily-operations/simulation`. Active cron routes, current dashboard callers, `/api/mlb/projections`, MLB-04 research routes, SportsDataIO rollback diagnostics and broad NBA/NFL/BSN runtime are deferred. Next: publish RESET-02B, then continue with a stricter RESET-02C/RESET-03 boundary only after replacement target APIs or data reset gates are explicit.

MLB-04D-D3S-R3D-L3-R1 Ledger Result Evaluation Guard Repair is locally implemented as `MLB_04D_D3S_R3D_L3_R1_RESULT_EVALUATION_GUARD_CERTIFIED`. It adds a dedicated `MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZED` guard and exactly-one result/evaluation update service for `mlb_forward_research_ledger`, independent from the ledger insert canary and all snapshot/evidence/product/settlement/learning/calibration authorization. The service requires exact row ID plus deterministic identity, blocks missing, duplicate and conflicting evaluated states, updates only permitted result lifecycle fields and preserves all frozen pregame fields. Next: publish L3-R1, verify auth-status visibility, then separately authorize one real result-evaluation update for ledger row `4a355368-f1af-4ea1-8303-60eb28afd4d7`.

MLB-04D-D3S-R3D-L1 Ledger Canary Guard Repair is locally implemented as `MLB_04D_D3S_R3D_L1_LEDGER_CANARY_GUARD_CERTIFIED`. It adds a dedicated `MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZED` guard and exactly-one ledger canary service for `mlb_forward_research_ledger`, separate from the broad `MLB_FORWARD_LEDGER_ENABLED` planner switch and from snapshot/evidence canary authorization. The service recomputes deterministic identity, pre-reads `0/1/>1`, inserts at most one row, reuses existing rows, fails closed on duplicates, identity mismatch and invalid FKs, and preserves frozen pregame fields separate from future result metrics. Next: publish L1, verify deployment auth-status visibility, then separately authorize exactly one real ledger canary insert/reuse.

MLB-04D-D3S-R3D-R1 JSONB Semantic Readback Parity Repair is locally implemented as `MLB_04D_D3S_R3D_R1_JSONB_SEMANTIC_READBACK_PARITY_REPAIR_CERTIFIED`. It repairs the one-row immutable evidence canary false parity failure by comparing JSON/JSONB parity fields semantically rather than by object key order, while preserving strict comparison for non-JSON identity, price, probability, timestamp and version fields. It does not change persistence semantics, canary/continuous authorization, snapshot separation, ledger separation, model output, calibration, product exposure, settlement, learning or automation. Next: publish R3D-R1, verify deployment alignment, then perform a zero-write reuse/readback proof against the existing evidence row `de7e36a1-058e-5b9e-a711-9ad87ee15c69` before any ledger canary.

MLB-04D-D3S-R3E Research Authorization Status Endpoint is locally implemented as `MLB_04D_D3S_R3E_PRODUCTION_AUTH_STATUS_ENDPOINT_CERTIFIED`. It adds a protected read-only `/api/mlb/research-auth-status` route that reads deployed server-runtime `process.env` values at request time and returns only normalized status for the snapshot, one-row evidence canary and continuous evidence guards. The endpoint has no provider clients, no Supabase dependency, no persistence invocation, no scheduler activation and no secret-value exposure. Next: publish R3E, verify Production runtime auth status through the protected endpoint, then separately decide whether to authorize the R3D one-row immutable evidence canary.

MLB-04D-D3S-R3C One-Row Evidence Canary Readback Contract is locally implemented as `MLB_04D_D3S_R3C_ONE_ROW_EVIDENCE_CANARY_READBACK_CONTRACT_CERTIFIED`. It completes the canary-only immutable evidence contract by adding explicit pre-read by deterministic identity, `INSERTED`/`REUSE_NO_OP`/`BLOCK_DUPLICATE_DEFECT` semantics, immediate readback, immutable field parity and repeated execution idempotency. It calls no providers, writes no production rows, does not enable continuous persistence and keeps snapshot and ledger authorization separate. Next: publish R3C, verify deployment alignment, then separately authorize a fresh one-row evidence canary only in a valid pregame window.

MLB-04D-D3S-R3B Immutable Evidence Guard Scope Repair is locally implemented as `MLB_04D_D3S_R3B_IMMUTABLE_EVIDENCE_GUARD_SCOPE_REPAIR_CERTIFIED`. It separates one-row canary authorization from broad natural D3W immutable evidence persistence after the D3S-R3 incident created 18 rows from one canary authorization. Continuous writes now require `MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED=true`; canary writes require `MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED=true`, exactly one row and a matching selected deterministic identity; the legacy global flag cannot authorize broad writes. No incident rows are deleted or rewritten, no providers are called, no production rows are mutated and automation remains off. Next: publish R3B, verify deployment alignment, then separately re-authorize one fresh one-row evidence canary if needed.

MLB-04D-D3S-R1 Immutable Opportunity Evidence Repair is locally implemented as `MLB_04D_D3S_R1_IMMUTABLE_OPPORTUNITY_EVIDENCE_REPAIR_CERTIFIED`. It separates mutable prospective current-board rows from frozen research evidence by preparing an additive `mlb_forward_opportunity_evidence` table and a default-off D3W append/reuse hook now scoped to continuous authorization only. No old rows are backfilled, no production evidence rows are written during certification, no cron is activated and no ledger row or Observation #4 is created. Next: keep immutable evidence writes explicit and scoped; one-row canaries must use the dedicated canary guard and selected identity.

MLB-04D-D3W Forward Opportunity Writer Lineage Integration is locally implemented as `MLB_04D_D3W_FORWARD_OPPORTUNITY_WRITER_LINEAGE_CERTIFIED`. It wires the existing raw SDK probability and existing MLB calibrated-shadow transform into the active forward prospective writer so future generated rows carry an explicit same-opportunity raw/calibrated pair for D3 ledger consumers. The product probability, EV math, recommendation policy, settlement, learning, calibration artifact and automation state remain unchanged. Next: publish D3W, then wait for a fresh natural forward opportunity pair before any ledger write or Observation #4.

MLB-04D-D3R Raw / Calibrated Probability Lineage Repair is locally implemented as `MLB_04D_D3R_RAW_CALIBRATED_PROBABILITY_LINEAGE_REPAIR_CERTIFIED`. It resolves the D3 ledger payload blocker by adding a forward-only extractor that accepts ledger probability fields only when raw and calibrated values are explicit, same-opportunity-bound and pregame-safe. The current D3 `ATH @ HOU` example remains blocked because its stored evidence has no raw probability; the repair prevents fabrication instead of backfilling. Next: publish D3R, then rerun D3 preview on a fresh forward slate before any ledger writes or automation.

MLB-04D-D1 Bounded Forward Automation Implementation is locally implemented as `MLB_04D_D1_BOUNDED_FORWARD_AUTOMATION_IMPLEMENTATION_CERTIFIED`. It adds a dry-run/default-off forward orchestration shell for `MORNING` and `FINAL_PREGAME` snapshot planning, frozen MLB-04C V2 scorecard planning, research-ledger planning, stored canonical result detection, postgame evaluation planning and cohort metric contracts. `EXECUTE` is intentionally unavailable in this phase, all kill switches remain false/unset, no cron is added, no scheduler is activated, no Observation #4 is created and the prepared additive ledger migration is not applied. Next: publish D1, then separately authorize the ledger-storage migration/readback gate or one-event automation canary only after storage and dry-run evidence are certified.

MLB-04D-A Internal Context Expansion is locally implemented as `MLB_04D_A_INTERNAL_CONTEXT_EXPANSION_CERTIFIED`. It prepares forward-only starter, lineup and park identity context from stored sources without backfilling old observations, calling providers, writing snapshots or changing scorecard/product/model behavior. Starter identity and projected lineup capture are forward-ready, confirmed lineup and starter edge scoring remain partial, park identity is forward-ready, park factors/weather/injuries remain blocked and splits stay audit-only. Projected future completeness is conservatively `4/7 = 0.5714` only when starter scoring fields are frozen; `LINEUP_EDGE`, `SPLIT_EDGE` and `CONTEXT_EDGE` still require future versioned semantics or stronger provenance. Next: publish Package A or design the additive research ledger; do not activate automation or create Observation #4 yet.

MLB-04D-D Forward Automation Preparation is locally implemented as `MLB_04D_D_FORWARD_AUTOMATION_PREP_CERTIFIED`. It adds an inactive planner/contract layer for future MORNING and FINAL_PREGAME research capture, frozen MLB-04C V2 scorecard ledgering, stored-result detection and research-only evaluation. It registers no cron, applies no migration, writes no rows, calls no providers and leaves product, prediction, settlement, learning, calibration, bankroll, notifications, MLB-03, NFL and NBA unchanged. Next: publish the prep commit, then separately choose either an additive research ledger migration or Package A internal context implementation; do not enable automation until explicit kill-switch and ledger-storage authorization exists.

MLB-04D Parallel Context Expansion Master Plan is locally certified as `MLB_04D_PARALLEL_CONTEXT_EXPANSION_MASTER_PLAN_CERTIFIED`. It preserves the frozen forward observations and decomposes the remaining Chat-Method gaps into independent packages: internal context, external weather/injury contracts, props/NRFI foundation and forward automation prep. It makes no provider calls, no production database mutations, no product/model/policy changes and no retrospective enrichment. Next: implement Package D and Package A as separate bounded phases; keep weather, injuries, pitcher props and NRFI/YRFI contract-first until sources, odds and settlement gates are explicitly approved.

MLB-04C-R6 Context Capture Completeness Repair is locally implemented as `MLB_04C_R6_CONTEXT_CAPTURE_COMPLETENESS_REPAIR_CERTIFIED`. It keeps the first two forward observations frozen exactly as captured, then fixes future MLB-04B snapshot payloads to carry active starter assignments, timestamp-safe prior-game offense/recent-form context and normalized bullpen directional inputs that MLB-04C V2 can consume directly from frozen evidence. Provider calls, production database mutations, prediction writes, recommendation exposure, settlement, learning, calibration, SportsDataIO, NFL and NBA behavior remain unchanged. Next: publish R6, then wait for a fresh legitimate forward MLB-04B snapshot before evaluating any next MLB-04C observation; do not retrofit older snapshots.

MLB-04C-R4 Starter Offense Bullpen Context Recovery is locally implemented as `MLB_04C_R4_STARTER_OFFENSE_BULLPEN_CONTEXT_RECOVERY_CERTIFIED`. It preserves Observation #1 forever on `MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1` while introducing future-only `MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2` semantics for timestamp-safe starter, offense/recent-form and bullpen directional research scoring. It uses stored/captured evidence only, keeps missing data null with explicit blockers, does not emit Chat-Method probabilities and makes no production model, recommendation, settlement, learning, calibration, provider, NFL or NBA changes. Next: publish R4, then separately authorize future-forward snapshot capture/evaluation under V2; do not retrofit older observations.

MLB-04B-R2A One-Snapshot Persistence Guard is locally implemented as `MLB_04B_R2A_ONE_SNAPSHOT_PERSISTENCE_GUARD_REPAIR_CERTIFIED`. It closes the deployment blocker where the public context-lineage route always forced dry-run and the older helper lacked the MLB-04B explicit authorization contract. The repaired path is scoped to exactly one `MORNING` or `FINAL_PREGAME` snapshot, defaults to dry-run, requires `execute=true` plus `MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED=true` for real persistence, blocks `CURRENT_PROBE`, rechecks temporal safety, performs deterministic pre-read, inserts only, reads back immediately and reuses existing rows idempotently. Provider calls and production database mutations during certification are 0. Next: publish MLB-04B-R2A, then separately authorize a real forward one-snapshot persistence proof only in a valid pregame window; do not persist reconstructed snapshots or broaden into product recommendations.

MLB-04C Chat-Method Research Scorecard is locally implemented as `MLB_04C_CHAT_METHOD_RESEARCH_SCORECARD_CERTIFIED`. It adds a pure research scorecard contract and deterministic dry-run service for the seven MLB Chat-Method components without emitting probabilities, recommendations or persistence writes. The existing three-row MLB-03 forward ledger stays baseline-only because no pregame Chat-Method evidence was frozen for those games. Next: publish MLB-04C, then separately authorize a forward-only research ledger persistence proof after a legitimate MLB-04B `MORNING` or `FINAL_PREGAME` snapshot window; do not use reconstructed history or claim accuracy before frozen ledger rows settle.

MLB-04B Morning / Final-Pregame Snapshot Runtime is locally implemented as `MLB_04B_MORNING_FINAL_PREGAME_SNAPSHOT_RUNTIME_CERTIFIED`. It reuses `mlb_context_snapshots` for immutable research snapshots, separates `MORNING` from `FINAL_PREGAME`, keeps `CURRENT_PROBE` from substituting for either, defaults to dry-run and requires `MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED=true` for any future persistence. Local certification made 0 provider calls, 0 production database mutations and 0 prediction/recommendation/settlement/learning writes. Next: publish MLB-04B, then separately authorize bounded persistence proof or proceed to `MLB-04C_CHAT_METHOD_RESEARCH_SHADOW_SCORECARD_LEDGER`; pitcher props and NRFI/YRFI remain blocked by data-source and settlement foundations.

MLB-04A Chat Methodology Research Shadow Foundation is locally implemented as `MLB_04A_CHAT_METHODOLOGY_RESEARCH_FOUNDATION_CERTIFIED_DESIGN_ONLY`. It does not continue MLB-03 accumulation or settlement; instead it records the observable manual research workflow as a transparent scorecard/ledger contract. The current MLB-03 calibrated path remains `CALIBRATED_BASELINE_ONLY`, while `MLB_CHAT_METHOD_RESEARCH_SHADOW_V1` is design-ready for score/rank/evidence capture only. It must not emit copied or calibrated probabilities until frozen pregame ledger evidence supports calibration.

MLB-03R5 Shadow Settlement Runtime Preparation is locally implemented as `MLB_03_SHADOW_SETTLEMENT_RUNTIME_CERTIFIED_READY_FOR_PUBLICATION`. The MLB `CURRENT_ERA_SHADOW` sample is soft-paused at three clean pending canaries plus one preserved quarantined malformed row; no fourth prediction is authorized. The new MLB-specific shadow settlement runtime scopes strictly to `baseball_mlb`, `CURRENT_ERA_SHADOW`, `model_role = shadow`, non-quarantined rows and full-game Moneyline/Run Line/Total markets, using only stored `sport_events` and `game_results` evidence. Dry-run and fixtures pass for market grading, quarantine exclusion, idempotency, cancellation/missing-result fail-closed behavior, product/learning/performance isolation and immutable fingerprint stability after settlement lifecycle fields change. Next: publish the runtime, then perform read-only three-row observation until canonical final results are available; settlement execution remains separately authorization-gated.

MLB-03 Calibrated Shadow Foundation is locally implemented as `MLB_03_CALIBRATED_SHADOW_CERTIFIED_CONTEXT_FORWARD_ONLY`. Market-specific calibration artifacts are runtime-loadable and fail-closed, with Moneyline/Run Line/Total holdout improvements versus raw baseline. A learned context-enhanced model is not selected because historical-safe context remains partial; MLB-01 context is forward-only for shadow observation. MLB-03R1E-R1 completes the pending `CURRENT_ERA_SHADOW` canary persistence contract, price-evidence binding repair and physical identity repair: `settlement_details = {}`, `manual_adjustment = false`, `certification_status = SHADOW_PENDING`, phase provenance in `certification_metadata`, sportsbook/odds/timestamp/implied probability/identity all derive from one selected market snapshot, and new shadow rows use a fresh physical UUID while preserving source provenance only in lineage metadata. The existing malformed canary remains quarantined and is not rewritten. The current clean canary sample has reached soft-review pause, so further accumulation is blocked until isolated settlement observation/review.

MLB-02 Calibration Forensics is locally certified as `MLB_02_CALIBRATION_FORENSICS_CERTIFIED`. Stored production evidence shows 2,506 MLB rows, 2,276 settled rows, 148 recommended rows, 0 production-eligible rows and 0 learning labels. The baseline is miscalibrated and the recommended subset is overconfident; market-specific calibration improves holdout Brier/log-loss in research without touching production probabilities. Next: `MLB-03_CONTEXT_ENHANCED_SHADOW_V1_IMPLEMENTATION`, limited to shadow scoring, calibration bootstrap artifacts and forward evidence.

MLB-01R2C Context Snapshot Service Role Grant is locally implemented on top of R2/R2A. The corrected migration now reproduces the production service-role CRUD grant for `public.mlb_context_snapshots` while preserving text `event_id` compatibility, RLS, service-role policy, shadow-only defaults and no anon/authenticated CRUD access. Next: verify production PostgREST readability, publish the two R2 commits plus R2C, then run persistence/readback/idempotency proof.

NFL-01 P0 Resume Initialization Repair is locally implemented as `NFL_01_BALLDONTLIE_P0_RESUME_INITIALIZATION_REPAIR_CERTIFIED`. The P0 launch blocker was a checkpoint namespace mismatch: completed probe entries were preserved under probe request IDs, while P0 introduced new queue IDs and the executor attempted to read `state.cursor` for a missing checkpoint entry. The repair merges missing P0/P1 queue entries without resetting existing probe progress or request accounting. P0 preflight now initializes 21 P0 entries, preserves 10 cumulative trial calls and selects `bdl_nfl_teams_all` as the first resumable P0 work item. Next: publish the repair, then resume the certified P0 command; do not start P1 automatically.

NFL-01 Windows Executor Shutdown Repair is locally implemented as `NFL_01_BALLDONTLIE_WINDOWS_EXECUTOR_SHUTDOWN_REPAIR_CERTIFIED`. The active-trial team_stats probe page is durably preserved, but `next_cursor=112` means the probe is still incomplete. The Windows shutdown assertion is repaired by removing forced `process.exit(...)` from the async executor and using natural `process.exitCode` handling. P0 remains blocked until this repair is published and the remaining team_stats cursor chain is completed under the bounded probe contract.

NFL-01 Raw Payload Collision Repair is locally implemented as `NFL_01_BALLDONTLIE_RAW_PAYLOAD_COLLISION_REPAIR_CERTIFIED_READY_FOR_PROBE`. The first live probe left a legitimate NFL teams payload but checkpointed it as incomplete because missing `meta.next_cursor` became cursor `0`; retry then collided with the same raw file. The repair preserves raw immutability, fixes terminal cursor semantics, reconciles existing raw payloads into checkpoint state, reuses valid payloads without another call, keeps different-content collision blocking and isolates cursor pages. Next: publish the repair, then retry only the bounded probe.

NFL-01-START BallDontLie Live Executor Readiness is locally implemented as `NFL_01_BALLDONTLIE_TRIAL_EXECUTION_READY`. The live-capable executor remains hard-gated by `--execute`, `BALLDONTLIE_API_KEY`, `NFL_BALLDONTLIE_TRIAL_ACTIVE=true`, `NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED=true`, explicit request/runtime caps and a safe request rate. It prepares a 3-call probe, a 21-entry P0 historical queue and a 26-entry P1 queue with raw payload durability, checkpoint/resume and request accounting. No trial activation, provider call, production mutation, NFL production activation, SportsDataIO expansion, MLB change or NBA runtime change occurred. Next: separately authorize the BallDontLie NFL trial activation and bounded probe.

NFL-01 BallDontLie Historical Import Readiness is locally implemented as `NFL_01_BALLDONTLIE_HISTORICAL_IMPORT_READINESS_CERTIFIED_WAITING_FOR_TRIAL`. NFL will use BallDontLie for historical and ongoing sports/stat data, The Odds API for `americanfootball_nfl` Moneyline/Spread/Total price evidence, and no new SportsDataIO NFL dependency. The prepared 2021-2025 trial manifest is disabled by default, preserves raw payloads under `data/imports/balldontlie/nfl`, and keeps NFL production, scheduler, Official Picks, learning and calibration inactive. Next: activate the BallDontLie NFL GOAT trial only when ready to run the bounded connectivity/schema probe followed by the P0 historical download queue.

NBA-03A Current Era Shadow Settlement Preparation is locally implemented as `NBA_03A_CURRENT_ERA_SHADOW_SETTLEMENT_PREPARATION_CERTIFIED_READY_FOR_ACTIVATION_REVIEW`. It prepares an isolated NBA `CURRENT_ERA_SHADOW` settlement contract without activation: final canonical event status plus matching `game_results` scores are required, stored lines remain immutable, Moneyline/Spread/Total fixtures pass including pushes, and learning/calibration/product/Official Pick/MLB/Historical Replay isolation remains off. Current 43 shadow rows are all future and not settlement eligible. Next NBA-03A step is activation-review authorization only after real final result evidence exists.

MLB Provider Independence + Calibration is locally implemented as `MLB_FINAL_PROVIDER_INDEPENDENCE_CALIBRATION_REPAIR_READY_FOR_DEPLOYMENT`. Six real pre-repair SportsDataIO MLB calls were traced to the legacy prospective-preview operating-day path; the service boundary now suppresses SportsDataIO whenever The Odds API is product authority while preserving explicit rollback stages. Calibration remains honest and accumulating: Current Era settled evidence exists, but production Official calibration has 0 eligible recommended settled rows while rows remain quarantined and HR-03 replay remains shadow-only. Final freeze waits for post-deploy natural zero-call observation.

MLB Final Market Freshness Freeze is locally implemented as `MLB_FINAL_MARKET_FRESHNESS_RUNTIME_REPAIR_READY_FOR_DEPLOYMENT`. The final freeze remains pending deployment proof because production natural scheduler executions were selecting false settlement debt from post-start blocked rows instead of the due pregame market refresh. The repair aligns adaptive settlement backlog readiness with cutoff eligibility so market refresh can proceed while blocked settlement evidence remains visible.

MLB Official Pick + MC-08B Integrity is locally implemented as `MLB_OFFICIAL_PICK_MC08B_INTEGRITY_REPAIR_READY_FOR_DEPLOYMENT`. The audit found no Official Pick promotion defect: the observed fresh positive-EV `MIL @ LAD` review candidate remained below existing Official Pick confidence/edge/EV/calibration/production gates. The bounded repair improves homepage gate explanations and deterministic rejection semantics only; Official Pick thresholds and promotion logic remain unchanged.

MLB Product Candidate Selection Integrity is locally implemented as `MLB_PRODUCT_CANDIDATE_SELECTION_INTEGRITY_REPAIR_READY_FOR_DEPLOYMENT`. It documents Moneyline, Run Line and Total complement semantics, clarifies Rent Play and Moneyline review fallback ranking as evidence-completeness rather than highest probability, maps Analysis Snapshot timestamps into homepage cards, preserves exact-line identity and prevents null EV from rendering as zero. No model, ranking formula, recommendation threshold, provider authority, settlement, learning, NBA historical foundation or MLB data-source behavior changed.

MLB Settlement Closure Debt Finalization is locally implemented as `MLB_SETTLEMENT_CLOSURE_DEBT_RUNTIME_REPAIR_READY_FOR_DEPLOYMENT`. The bounded repair fixes an operating-day settlement linkage short-circuit so the writer can settle same-local-date predictions with canonical final results while preserving cutoff/start safety. Production remains on the pre-repair commit until this is published and protected settlement is rerun.

MLB Current Board Model Probability Binding is locally implemented as `MLB_MODEL_PROBABILITY_EVIDENCE_BINDING_REPAIR_READY_FOR_DEPLOYMENT`. It restores product-level `modelProbability` / `winProbability` / same-selection edge and EV aliases from existing Current Board prediction and market-alignment evidence so homepage review cards do not display `N/A` while valid stored model evidence exists. No model, provider, recommendation, settlement, learning, HR-03, NBA historical foundation or MLB data-source behavior changed.

NBA-01C-RECOVER is locally completed as `BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_RECOVERY_PASS`. BallDontLie GOAT historical bootstrap recovered from durable ignored raw payloads after PC/network restart and completed 5,116 manifest tasks with 0 failed tasks. The NBA historical sports-data foundation is `NBA_HISTORICAL_FOUNDATION_CERTIFIED_READY_FOR_REPLAY`: 3,710 canonical games/results, 5,612 players, 128,353 normal player-game stat rows and 358,195 advanced-stat rows across 2022-23, 2023-24 and 2024-25. NBA production remains inactive. Next phase: `NBA-02_COMPLETE_HISTORICAL_FEATURE_RECONSTRUCTION_AND_REPLAY`.

NBA-01C-PREP is locally implemented as `BALLDONTLIE_GOAT_TRIAL_EXTRACTION_READY` from commit `72864b24c3bc094f9d2f941b78c3ac89b71e5378`. It prepares the BallDontLie GOAT 48-hour extraction adapter, endpoint matrix, rate limiter, raw payload manifest, checkpoint/resume contract and START boundary without starting the trial, requiring a key, making provider calls, activating NBA production or changing MLB. Next phase after commit/publish authorization: `NBA-01C-START_BALLDONTLIE_GOAT_48H_EXTRACTION`.

MLB Moneyline Blocker Text Consistency is locally implemented as `MLB_MONEYLINE_BLOCKER_REPAIR_READY_FOR_DEPLOYMENT`. It keeps MLB-FINAL-00 review-only behavior but ensures the Moneyline card's displayed edge/EV and short blocker summary are derived from the same candidate evidence bundle. No recommendation eligibility, Official Pick threshold, model, provider, settlement or learning behavior changed.

MLB-FINAL-00 Current Era Readiness is locally implemented as `MLB_CURRENT_ERA_REPAIR_READY_FOR_DEPLOYMENT`. Current Era evidence remains present across Current Board and Dashboard Today, and the bounded repair adds a `BEST_AVAILABLE_REVIEW_OPTION` homepage fallback that is explicitly not a recommendation. No model, threshold, provider authority, SportsDataIO, scheduler, settlement, learning or replay behavior changed. After deployment certification, the next phase is `MLB-FINAL-01_COMPLETE_HISTORICAL_MARKET_EXPANSION_AND_FORWARD_DATA_FOUNDATION`.

MLB Recommendation Surface Semantics Finalization is locally implemented as `MLB_RECOMMENDATION_SURFACE_REPAIR_READY_FOR_DEPLOYMENT`. It fixes homepage recommendation presentation semantics so blocked Rent Play/Moneyline evidence is review-only, unavailable required gates block recommendations, Smart Parlay builder availability is distinct from parlay actionability, Watchlist remains research-only, and Value Signals are not confused with Official Picks. No model, probability, EV, threshold, Official Pick, provider authority, scheduler, settlement or learning behavior changed.

Multi-Sport Handoff Preparation is locally certified as `MULTI_SPORT_HANDOFF_PASS` on baseline commit `28c188cd1db7e131cedd4b38bc6642b5911d4d7b`. The audited priority order is NBA, BSN, NFL, NHL, Soccer, UFC and Tennis. NBA is selected as the next sport, with `NBA-01_DATA_FOUNDATION_PROVIDER_INDEPENDENCE_AND_HISTORICAL_READINESS` as the first executable block. No NBA production activation, provider call, database mutation, SportsDataIO reactivation or historical replay was performed.

MLB Final Closeout is locally certified as `MLB_FINAL_CLOSEOUT_PASS_WITH_FUTURE_MARKETS` at commit `4fb06cb795a9fad00cd60b4e3f5b134c69701444`. The Odds API is product odds authority, MLB Official is primary for non-odds MLB data, SportsDataIO is rollback-only and not cancelled, and core full-game markets remain the only production-supported MLB betting markets. Historical replay and HR-03 calibration remain isolated; player props and derivative markets are future gated work. Next master phase: multi-sport handoff preparation using `SPORT_ONBOARDING_TEMPLATE_V1`; MC-03 was not started.

MLB Product Evidence Reconciliation is locally implemented as a bounded repair after production showed Current Board product price evidence while the Today service still emitted legacy sportsbook-refresh blockers. The repair reconciles Today per-game odds coverage with Current Board canonical product price evidence and clarifies homepage evidence counts without changing prediction formulas, Official Pick policy, provider authority, settlement, learning or HR-03.

Home Client-State Card Mapping Reconciliation is locally implemented as `HOME_CLIENT_STATE_RECONCILIATION_REPAIR_READY_FOR_DEPLOYMENT`. It fixes the rendered homepage card plan so Current Board evidence fetched by the client can populate Rent Play, Moneyline, Smart Parlay and Watchlist review states when Today card selectors are sparse, while preserving policy-blocked/review-only safety and all prediction/provider/settlement invariants.

Market Freshness Severity Reconciliation is locally implemented as `MARKET_FRESHNESS_SEVERITY_REPAIR_READY_FOR_DEPLOYMENT`. It keeps Current Board strict and fail-closed while preventing one stale non-actionable row with broad fresh product coverage from incorrectly making Operations Health `CRITICAL`. Full odds outages, provider failures and scheduler failures remain `CRITICAL`; SportsDataIO remains rollback-only and the rollback window is unchanged.

SDIO-EXIT-04 is locally certified as `SDIO_EXIT_04_STATS_PARITY_PASS_OFF_WINDOW_BLOCKED_BY_ODDS_AUTHORITY`. MLB Official schedule/status/results/starter identity are ready for parity review, and current production-critical stats/player/bullpen/lineup/injury domains do not block MLB SportsDataIO exit. The final SportsDataIO-off operating window was not executed because odds product authority remains SportsDataIO under `STAGE_1_DUAL_READ`; cancellation readiness is `YES_AFTER_ODDS_PROMOTION_AND_OFF_WINDOW`. SportsDataIO remains enabled and not cancelled; The Odds API remains shadow-only; MC-03 was not started.

SDIO-EXIT-03E is locally repaired and pending natural production proof. The previous state proved MLB Official exact mapping/status parity but left final rows out of canonical `game_results`. SDIO-EXIT-03E reuses the existing result sync persistence path so natural `DUAL_READ` MLB Official shadow payloads can close exact final games by `gamePk` without broad `MLB_OFFICIAL_PRIMARY` promotion, SportsDataIO disablement, odds authority promotion, prediction changes, settlement formula changes or retrospective prediction creation.

SDIO-EXIT-03C is locally repaired and pending natural production proof. SDIO-EXIT-03B eliminated ambiguity for CHC @ KC and TB @ SEA, but production still mapped only 13/15 because the natural mapper ignored exact embedded `sport_events.provider_ids.mlb_stats_api` / `mlb_stats_game_pk` values when the separate `provider_entity_mappings` crosswalk was missing. SDIO-EXIT-03C now treats embedded gamePk as deterministic identity evidence, keeps SportsDataIO as production authority and rollback, keeps MLB Official non-authoritative, and leaves The Odds API shadow-only. MLB official primary promotion remains blocked until post-deploy natural runs prove 100% expected-mappable mapping, 0 ambiguous mappings, 0 duplicate canonical events and safe status classifications.

P1.3 adds the prospective Production Evaluation Policy Separation required before Prediction Epoch V2 activation. The model can now record whether a future pregame prediction is production-evaluable independently from whether it is recommended, actionable or Official Pick eligible. P1.3 is production-certified on commit `a64c876b803c93f259424389d765282a9a0a3d1a`; P1.4 is production-certified on commit `6f92b102416fa0e5b8baeefbaa8b944a63f51ca3` with 24 post-P1.3 production-evaluable MLB rows, so P2.0 is ready.

P2.0 is production-certified. It introduces `CURRENT_V2_PRODUCTION` as the future-only active era and `LEGACY_PRE_V2` as preserved historical scope, with active-epoch stamping for future prediction writes and Current Era defaults for Current Board and Performance. The Current V2 Production epoch started at `2026-08-03T19:57:02.418+00:00`.

P2.1 is production-certified on commit `a0e6329293686fe2557949f3f30e445c7e6880b8`. It expands supported MLB market prediction coverage from one preferred side per event/market to every canonical latest-line supported selection while preserving the active epoch and all prediction/recommendation policies. Production coverage is 48/48 with 0 missed opportunities and 0 duplicates.

P2.1A is production-certified on commit `8821aa7830874653cc05744ff8eaad03cf42b6b3`. It corrects the Current V2 supported-market contract to one canonical event-market prediction per supported market while preserving provider-side selection evidence as contextual only. For the 8-game MLB slate, production coverage reports 48 provider selections, 24 canonical markets, 24 canonical predictions, 24 production-evaluable rows, 0 missed canonical opportunities, 0 duplicates and 100% canonical coverage. Existing selection-level rows are preserved as `P2_1_SELECTION_LEVEL_PREVIEW` and excluded from Performance, settlement and learning eligibility unless superseded by canonical event-market rows.

P2.2 is `WAITING_FOR_EXTERNAL_EVIDENCE` using the P2.1A canonical rows. Current V2 predictions must become final and pass through authoritative result import, settlement, learning evidence and Performance Current Era before closure can be certified. P2.3 is blocked by P2.2.

P2.2A is production certified at `6aac64e4a82e27c1e7a2fdb207ed9aca2805ef1d`. It clarifies Performance presentation without changing counts or math: Current V2 defaults now separate 51 Total Analyzed rows, 24 Canonical Predictions, 27 Non-production Analysis rows, 0 Recommendation Eligible rows and 0 Settled canonical predictions. Pipeline Readiness is qualified as workflow readiness, not model accuracy.

## Platform Baseline

Status: PLATFORM BASELINE CERTIFIED.

Certified commit: `94159038571ba16cf31107403efce3af7f13ba50`

Stable release tag: `v1.0-platform-certified`

Production URL: `https://pick-analyzer.vercel.app`

The certified platform baseline freezes the current production architecture, operating-day context, GitHub-owned scheduler, adaptive odds operations, provider evidence contract, Grounded Opportunities, Current Board, Most Likely, Best Value, Official Pick policy, settlement dry-run safety, Learning Brain policy, Performance Scope V2, Dashboard canonical ViewModel, cache invalidation chain and operations diagnostics.

## Dependency Reasoning

Product direction is now certification-first. MLB is no longer treated as mere maintenance until the betting engine is certified end to end. New dashboards, utilities, administration modules, market surfaces and cosmetic expansion are deferred unless they are required to certify the core betting engine.

Primary mission: become a trustworthy sports betting intelligence platform that continuously ingests real sports data, generates statistically grounded pregame predictions, learns from completed events and identifies betting opportunities with positive expected value.

Current certification answer: Pick Analyzer has many required components, but it is not yet certified to recommend real-money bets. The read-only MLB certification audit reviewed 1,194 prediction rows and found 0 certified live pregame rows, 0 production-eligible rows and 0 epoch-linked rows. Valid pregame rows remain shadow/pre-certification evidence only.

Final Completion Plan V1 is now complete. Pick Analyzer V1 is `PICK_ANALYZER_V1_READY` at 100% completion after Phase 6 final certification. V1 is limited to MLB core market operation, truthful product readiness labels, adaptive refresh under provider-budget policy, canonical result -> settlement -> learning -> Performance visibility, disabled automatic model training and explicit exclusion of unsupported markets from available recommendations.

Evidence: `docs/PICK_ANALYZER_FINAL_COMPLETION_PLAN_V1.md`, `docs/PICK_ANALYZER_V1_SCOPE.json`, `docs/PICK_ANALYZER_V1_PHASES.json`, `docs/PICK_ANALYZER_V1_DEFINITION_OF_DONE.md`, `docs/PICK_ANALYZER_POST_V1_BACKLOG.md` and `docs/PICK_ANALYZER_CHANGE_CONTROL_POLICY.md`.

V1 phase-order update on 2026-07-30: Phase 2 is complete after the July 29 MLB autonomous operating-day terminal recovery and protected settlement. Phase 3 is PASS after production served commit `51cdee5b3845b313653836002066b84938f52b92`: `/api/system/version` reported the exact commit with provider calls 0, the compact `/api/data-coverage/final-certification` route returned HTTP 200 in 22,840 ms, `?diagnostics=full` remained available and semantically complete, and `/api/data-coverage/health` returned HTTP 200. The next approved incomplete phase is Phase 4, Unsupported-market and recommendation-policy lock.

Evidence: `docs/RELEASE_CANDIDATE_ROUTE_ARTIFACT_CONSISTENCY_V1.md`, `docs/RELEASE_CANDIDATE_ROUTE_ARTIFACT_CONSISTENCY_V1.json` and `scripts/release-candidate-route-artifact-consistency-v1-validate.mjs`.

V1 Phase 4 update on 2026-07-30: Phase 4 is PASS. The central recommendation policy remains limited to MLB core full-game markets, unsupported markets still emit `UNSUPPORTED_MARKET` or readiness blockers, Top Picks filters through production eligibility and official recommendation status, and product copy preserves projection-only and Official Pick boundaries. The next approved incomplete phase is Phase 5, Final validation bundle.

Evidence: `docs/UNSUPPORTED_MARKET_RECOMMENDATION_POLICY_LOCK_V1.md`, `docs/UNSUPPORTED_MARKET_RECOMMENDATION_POLICY_LOCK_V1.json` and `scripts/unsupported-market-recommendation-policy-lock-v1-validate.mjs`.

V1 Phase 5 update on 2026-07-30: Phase 5 is PASS. The final validation bundle, validation matrix, Definition of Done matrix, production certification and provider/mutation accounting are complete. Production serves commit `901811db17cbbc6a693b1021c070ec1f52ea0911`; all required read-only production endpoints returned HTTP 200. The compact Data Coverage route has variable latency, recorded as a non-blocking operational risk rather than a V1 blocker. The next approved incomplete phase is Phase 6, V1 complete declaration.

Evidence: `docs/PICK_ANALYZER_V1_FINAL_VALIDATION_BUNDLE.md`, `docs/PICK_ANALYZER_V1_FINAL_VALIDATION_MATRIX.json`, `docs/PICK_ANALYZER_V1_DEFINITION_OF_DONE_MATRIX.json`, `docs/PICK_ANALYZER_V1_PRODUCTION_CERTIFICATION.json`, `docs/PICK_ANALYZER_V1_PROVIDER_MUTATION_ACCOUNTING.json` and `scripts/pick-analyzer-v1-final-validation-bundle-validate.mjs`.

V1 Phase 6 update on 2026-07-30: Phase 6 is PASS and the final verdict is `PICK_ANALYZER_V1_READY`. Production runtime behavior is certified at commit `901811db17cbbc6a693b1021c070ec1f52ea0911`; Phase 5 and Phase 6 are documentation/certification-only and do not require runtime redeployment. Post-V1 remains separate under change control, no tag was created, and `v1.0-platform-certified` was not moved.

Evidence: `docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.md`, `docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.json`, `docs/PICK_ANALYZER_V1_EVIDENCE_INDEX.md`, `docs/PICK_ANALYZER_V1_RELEASE_NOTES.md`, `docs/PICK_ANALYZER_V1_LIMITATIONS.md`, `docs/PICK_ANALYZER_V1_POST_RELEASE_OPERATIONS.md` and `scripts/pick-analyzer-v1-final-certification-validate.mjs`.

## Certification-First Priorities

1. Core Production Stability.
2. Prediction Certification.
3. Shadow Observation.
4. Certified Epoch.
5. Historical Walk Forward Replay.
6. Official Pick Certification.
7. Multi-Sport Production Certification.

Deferred until those are complete: new product modules, additional dashboard experiences, cosmetic expansion, Portfolio Intelligence expansion, Player Prop EV expansion and unsupported-market recommendation UX.

Certification evidence: `docs/CORE_PREDICTION_CERTIFICATION_ROADMAP_V1.md` and `docs/certified-prediction-epoch-mlb-readiness-audit-v1.json`.

## Product Stabilization Gate

Product Stabilization And Intelligence Consolidation V1 is the active cleanup posture before any new product capability. It refreshes current product inventory evidence, checks page/API/status/sport consistency and blocks capability expansion unless a defect is proven.

Mission Control V1 update on 2026-08-02: Mission Control is implemented and production-certified as the current V2 execution-state source of truth. It adds `/api/mission-control`, `/mission-control`, `docs/MISSION_CONTROL/`, deterministic queueing, sport readiness, provider readiness and stop conditions while preserving zero provider calls, zero mutations and unchanged prediction, settlement, learning, scheduler, refresh cadence and Official Pick policy behavior. Production certification passed on runtime commit `868eb0c4bc712b7c193b7a2001b37494517641e0`. The next eligible mission is MC-01 Operational Readiness Closure.

MC-01 Operational Readiness Closure update on 2026-08-02: MC-01 is `PRODUCTION_CERTIFIED` after repairing Mission Control runtime-state drift and Settlement Guarantee scheduler-warning coupling, then observing successful protected scheduler and market-freshness recovery. Provider budget, settlement closure, Current Board, Daily Brief, Performance and workspace surfaces remain operational or correctly protected. MC-STOP-005 is cleared. MC-02 is READY but was not started.

MC-08A Homepage Experience update on 2026-08-02: MC-08A is production-certified on commit `7af572ca66206780ed0c0da354d0309c72e73ef4`. The homepage now prioritizes Decision Core Morning Brief, Rent Play, Moneyline Bet, Smart Parlay, Today's Watchlist, Decision Summary and collapsed Technical Evidence while preserving existing data sources and all prediction, settlement, learning, scheduler and provider guardrails. MC-08B was not started.

MC-08B Rent Play Experience update on 2026-08-02: MC-08B is production-certified on commit `310b72ab0b304a1901ce598527043043087c9c83`. Rent Play now uses the typed `rent_play_v1` presentation contract with explicit probability, odds, freshness, actionability, Official Pick distinction, Most Likely distinction, readiness gates, risks and what-would-change evidence while preserving all prediction, settlement, learning, scheduler, provider and policy guardrails. MC-08C Moneyline Bet Experience is READY and was not started.

MC-08C Moneyline Bet Experience update on 2026-08-02: MC-08C is production-certified on commit `b748b9f812afeaf7d8c96f561a480a49303a8cd4`. Moneyline Bet now uses the typed `moneyline_bet_v1` presentation contract with a Moneyline-only universe, price-implied probability, freshness, actionability, Official Pick, Rent Play and Most Likely distinctions, readiness gates, candidate rank, risks and what-would-change evidence while preserving all prediction, settlement, learning, scheduler, provider and policy guardrails. MC-08D Smart Parlay Experience is READY and was not started.

MC-08D Smart Parlay Experience update on 2026-08-02: MC-08D is production-certified on commit `f9faf649d89cd343034e935225d7215dafcc754b`. Smart Parlay now uses the typed `smart_parlay_v1` homepage contract with bounded available legs, local user selection, per-leg freshness and actionability, selected-price combined odds, explicit correlation status and unavailable joint probability unless a certified method exists. MC-08E is READY and was not started.

MC-08G Product Polish And Coherence Review update on 2026-08-04: MC-08G is production-certified on runtime commit `6122dd7477f3121e9f5bfbbc7353d984862a449b`. It clarifies user-facing copy and navigation across Homepage, Settings, Most Likely, Best Value, Betting Workbench and Performance loading states while preserving prediction, recommendation, settlement, learning, scheduler, provider, Replay and Current Era behavior. MC-08H is READY but not started. MC-03 was not started.

MC-08H Production Readiness Certification update on 2026-08-04: MC-08H is blocked by current production operations. The final product audit scored overall readiness at 74% and returned Production Ready: NO because market freshness, settlement closure and product readiness are CRITICAL in production. OR-01 subsequently repaired scheduler-action starvation so active market refresh can preempt older missing-result recovery when no settlement-ready rows exist. OR-01A on 2026-08-05 observed public GitHub scheduled-run success on `21f8d135f665fcf39cf2db6d64462ca9251d348e`, but production scheduler cadence remained CRITICAL. OR-01B found and repaired the workflow/app-ledger reconciliation defect: workflow success now requires response-body proof and live no-write scheduler invocations now write heartbeat evidence. Final proof observed scheduled run `31003990142` persisting protected heartbeat invocation `cf420831-ad95-4943-83a7-326d9fdad5d7`; a follow-up reconciliation fix ensures that protected heartbeat evidence is counted by Operations Health. Production Pilot Week is not ready because OR-01A remains blocked by settlement closure and Product Readiness CRITICAL evidence. MC-03 was not started.
OR-01C update on 2026-08-05: remaining Settlement Closure CRITICAL evidence was traced to a settlement scope aggregation defect. Ready rows and silent pending rows were zero; older prior-date result-recovery debt remained visible but was overblocking current Product Readiness. OR-01C keeps the old debt visible as warning evidence and preserves settlement-ready rows as the CRITICAL condition. Production Pilot Week remains not ready pending deployment proof and OR-01A / MC-08H recertification.

OR-01H update on 2026-08-05: the primary scheduler architecture decision is blocked on human Vercel dashboard evidence. `vercel.json` defines no active Cron Jobs; GitHub Actions remains the current protected scheduler path with successful scheduled runs on `931fa81543feb1fad4192b0344e555eee7ddf4c5`, but three consecutive automatic primary executions at the required 10-minute cadence are not proven. Vercel Cron cannot be promoted until the project plan and Cron Jobs settings are verified. Production Pilot Week remains NOT_READY; MC-03 was not started.

OR-02 update on 2026-08-05: Vercel Pro is active and Vercel Cron is approved as the primary protected operating-day scheduler. `vercel.json` now schedules `/api/cron/operating-day` every 10 minutes, GitHub Actions remains fallback through the same protected endpoint with a primary-success lease, and Mission Control reports the primary/fallback ownership model. Final OR-02 PASS still requires three consecutive automatic Vercel primary executions plus Scheduler, Market Freshness, Settlement, Product Readiness, Operations and MC-08H readiness proof. Production Pilot Week remains NOT_READY until that proof exists; MC-03 was not started.

OR-02A update on 2026-08-05: Vercel primary cadence was proven healthy, but market freshness stayed CRITICAL because older missing-result recovery debt selected `sync_results` before active current-slate stale market refresh. OR-02A repairs only adaptive action priority: settlement-ready rows still outrank all work, while older missing-result debt no longer starves current pregame market refresh when no settlement-ready rows exist. Final PASS requires deployment proof, fresh stored provider/source market timestamps, three post-repair automatic Vercel primary executions and healthy Product Readiness/Operations. Production Pilot Week remains NOT_READY; MC-03 was not started.

OE-003F update on 2026-08-02: Product Freshness SLA is locally implemented and build-certified. Decision surfaces now expose `product_freshness_sla_v1`, block future/post-start/timestampless market evidence, downgrade stale prices, and preserve zero provider calls, zero mutations and unchanged prediction/recommendation policy. OE-003G has not started.

Current stabilization evidence:

- 28 page routes.
- 428 API routes.
- 70 read-only diagnostic APIs.
- 321 read-mostly APIs.
- 37 mutation/protected APIs by conservative path classification.
- Static Product Consistency Score: 100. Runtime readiness, prediction readiness, recommendation readiness and deployment readiness are explicitly not scored by the static audit.
- NFL and NHL are Preview for product-status purposes because persisted Preview prediction rows and feature snapshots exist. They remain blocked from Production prediction status and blocked from recommendations/Official Picks.
- Sports Center, AI Briefing, Dashboard, Performance, Current Board, Probability Picks, Portfolio Intelligence, Market Intelligence, Closing Line Intelligence, Player Projections, Autonomous Daily AI, Data Coverage, Providers, AI Operations, Model Health, Validation, Governance and Diagnostics remain represented by existing routes and docs.

Evidence: `docs/PRODUCT_STABILIZATION_AND_INTELLIGENCE_CONSOLIDATION_V1.md`, `docs/product-stabilization-v1-audit.json`, `docs/PRODUCT_ROUTE_INVENTORY_V1.md`, `docs/product-route-inventory-v1.json` and `docs/product-readiness-matrix-v1.json`.

## Active Local Run

Pick Analyzer V2 Phase C1 Daily Betting Experience And Automatic Settlement Guarantee is locally implemented pending validation and production certification. The homepage now renders Today's Betting Plan directly, with Rent Play, Moneyline Bet, Parlay Builder and Today's Best Opportunity backed by existing `/api/dashboard/today` evidence. The automatic scheduler settlement action now settles all supported selected-date rows instead of prospective-only rows, run-line settlement grades with spread semantics, skipped rows have explicit blocked reasons, and `/api/operations/settlement-guarantee` monitors completed-game prediction rows as SETTLED, READY_FOR_SETTLEMENT or BLOCKED with reason. No prediction engine, formula, Official Pick policy, provider mapping or automatic model-training behavior changed.

Evidence: `src/app/page.tsx`, `src/components/home/HomeBettingPlan.tsx`, `src/services/operating-day.service.ts`, `src/services/settlement-guarantee.service.ts`, `src/app/api/operations/settlement-guarantee/route.ts`, `docs/PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_AND_SETTLEMENT_GUARANTEE.md`, `docs/pick-analyzer-v2-phase-c1-daily-betting-settlement-guarantee.json` and `scripts/pick-analyzer-v2-phase-c1-daily-betting-settlement-validate.mjs`.

Pick Analyzer V2 Phase B6.1 Live Freshness And Provider Budget Utilization is locally complete pending production certification. Today now separates PAGE UPDATED from MARKET UPDATED, no longer uses API `generatedAt` as market freshness fallback, treats future market timestamps as invalid, prevents stale stored market evidence from rendering FRESH in the primary market metric, and restricts selector `metricValue` as EV to explicit EV/expected-value selectors. The provider-budget audit classifies SportsDataIO MLB allowance as configured-only unless provider account/quota evidence is captured. The certified scheduler remains 10 minutes, so true 5-minute refresh is not claimed and B7 was not started. No provider calls, mutations, business formulas, Official Pick policy, scheduler behavior or provider mappings changed.

Evidence: `src/components/dashboard/TodayDecisionPanel.tsx`, `src/components/dashboard/today-opportunity-readiness.ts`, `docs/PICK_ANALYZER_V2_PHASE_B6_1_LIVE_FRESHNESS_BUDGET_AUDIT.md`, `docs/pick-analyzer-v2-phase-b6-1-live-freshness-budget-audit.json` and `scripts/pick-analyzer-v2-phase-b6-1-live-freshness-budget-validate.mjs`.

Pick Analyzer V2 Phase B6 Mobile Decision Experience is locally complete as a bounded product-experience phase. Today now uses a compact mobile-first order: sticky verdict strip, Best Opportunity hero, compact Conviction + Actionability, priority metrics, segmented Why / Risks / Readiness details, What Would Change My Mind, alternatives, performance snapshot, Advanced Evidence and bottom navigation. B5.1 Opportunities navigation remains preserved. No API, backend service, provider, scheduler, prediction, probability, confidence, EV, edge, Official Pick policy, B5 conviction/actionability rule, settlement, learning or data contract changed. B7 and later phases were not started.

Evidence: `src/components/dashboard/TodayDecisionPanel.tsx`, `src/components/dashboard/AdvancedEvidenceDisclosure.tsx`, `docs/PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE.md`, `docs/pick-analyzer-v2-phase-b6-mobile-decision-experience.json` and `scripts/pick-analyzer-v2-phase-b6-mobile-decision-experience-validate.mjs`.

Pick Analyzer V2 Phase B5.1 Mobile Opportunity Navigation is deployed and certified as a bounded P1 UX repair. The mobile bottom navigation remains five primary items, but Opportunities now opens a navigation-only sheet with visible links to Today's Best Opportunity, Official Picks / Probability Picks, Most Likely, Best Value and Current Board / Watchlist. This repairs the confirmed mobile discoverability defect where Opportunities looked like a category but linked directly only to `/most-likely`. No route, API, backend service, provider, scheduler, prediction, probability, confidence, EV, edge, Official Pick policy, B5 conviction/actionability rule, settlement, learning or data contract changed. B6 and later phases were not started.

Evidence: `src/components/dashboard/DashboardShell.tsx`, `docs/PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION.md`, `docs/pick-analyzer-v2-phase-b5-1-mobile-opportunity-navigation.json` and `scripts/pick-analyzer-v2-phase-b5-1-mobile-opportunity-navigation-validate.mjs`.

Pick Analyzer V2 Phase B5 AI Decision Explanation is deployed and certified as a bounded presentation phase. Today now includes deterministic AI Explanation, categorical AI Conviction, distinct Actionability and What Would Change My Mind conditions built from the B3 normalized opportunity and readiness evidence. Conviction has no numeric pseudo-score, Actionability has no numeric pseudo-score and ACT NOW is restricted to fresh active Official Pick evidence. Validation passed with B5, B4, B3, B2, A3-A6, unsupported-market policy, route/artifact consistency, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` with 386 generated static pages. No local server smoke was run. No API contract, backend service contract, provider behavior, mutation path, recommendation policy, Official Pick threshold, prediction formula, settlement path, learning path or model state changed. B6 and later phases were not started.

Evidence: `src/components/dashboard/today-ai-decision-presentation.ts`, `src/components/dashboard/TodayDecisionPanel.tsx`, `docs/PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION.md`, `docs/pick-analyzer-v2-phase-b5-ai-decision-explanation.json` and `scripts/pick-analyzer-v2-phase-b5-ai-decision-explanation-validate.mjs`.

Pick Analyzer V2 Phase B4 Decision Dashboard Experience is complete as a bounded product-experience phase. Today reads as a premium daily decision cockpit: large verdict hero, visual Best Opportunity hero, compact Why and Risks cards, readiness progress, compact metrics, limited alternatives, compact Performance Snapshot and mobile bottom navigation. Advanced technical evidence remains collapsed. Validation passed with B4, B3, B2, A2 route/runtime, static accessibility checks, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` with 386 generated static pages. No local server smoke was run. No business logic, recommendation logic, Official Pick policy, API contract, service contract, provider behavior, mutation path, settlement path, learning path or model formula changed.

Evidence: `src/components/dashboard/TodayDecisionPanel.tsx`, `src/components/dashboard/DashboardShell.tsx`, `docs/PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE.md`, `docs/pick-analyzer-v2-phase-b4-decision-dashboard-experience.json` and `scripts/pick-analyzer-v2-phase-b4-decision-dashboard-experience-validate.mjs`.

Pick Analyzer V2 Phase B3 Best Opportunity Readiness is complete as a bounded product-experience phase on top of the B2 Today cockpit. The Today page uses a normalized Best Opportunity helper, structured Official Pick Readiness rows and compact probability, edge/EV, freshness and data-quality graphics while preserving existing `/api/dashboard/today` data and B2 dashboard markers. Validation passed with B3, B2, A2-A6, unsupported-market policy, route/artifact consistency, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` with 386 generated static pages. No local server smoke was run. B3 is presentation-only: no recommendation policy, threshold, probability, EV, edge, confidence, provider, database, settlement, learning or scheduler behavior changed.

Evidence: `src/components/dashboard/today-opportunity-readiness.ts`, `src/components/dashboard/TodayDecisionPanel.tsx`, `docs/PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS.md`, `docs/pick-analyzer-v2-phase-b3-best-opportunity-readiness.json` and `scripts/pick-analyzer-v2-phase-b3-best-opportunity-readiness-validate.mjs`.

Six Historical Settlement Conflict Resolution V1 is locally complete as the bounded follow-up data repair to Historical Settled Status Reconciliation V1. Exactly six allowlisted MLB prediction rows were corrected from stale cross-event result linkage to the canonical `game_results` rows for their own SportsDataIO events. The post-apply dry-run reports 6 consistent stored/deterministic settlements, 0 blocked rows and 0 additional mutations. No provider calls, learning writes, model-weight mutations, probability changes, confidence changes, Trust changes, Official Pick policy changes, SQL, imports, feature rebuilds, epoch activation or deployment occurred.

Evidence: `docs/SIX_HISTORICAL_SETTLEMENT_CONFLICT_RESOLUTION_V1.md`, `docs/six-historical-settlement-conflict-resolution-v1.json`, `scripts/six-historical-settlement-conflict-resolution-v1.mjs` and `scripts/six-historical-settlement-conflict-resolution-v1-validate.mjs`.

Vercel Build Memory Recovery V1 is production-certified. Build-memory root cause is classified as duplicated Supabase server dependency bundling plus webpack single-process pressure after Phase A had already reduced prerender routes to 6. `next.config.ts` now externalizes `@supabase/supabase-js` for server builds and re-enables the webpack build worker. Repeat clean build peak memory improved from the prior Phase B final 2847.6 MB to 2414.0 MB, a 15.23% reduction, while generated static pages remained 386 and app page routes remained 30. A fresh certification build measured 2430.4 MB peak and 386 generated pages. Vercel production now serves `f1efe9a00fe8894f26270c449382fc48a2bffb8c`, and bounded read-only production smoke passed. No product routes, API contracts, business rules, prediction logic, scheduler behavior, model weights, provider behavior or database schema changed. Deployment ID/build-log details require Vercel dashboard or authenticated CLI access.

Evidence: `docs/VERCEL_BUILD_MEMORY_RECOVERY_V1.md`, `docs/VERCEL_BUILD_MEMORY_PRODUCTION_CERTIFICATION_V1.md`, `docs/vercel-build-memory-recovery-v1-summary.json`, `docs/build-memory-optimization-v1-phase2-repeat.json`, `docs/build-memory-optimization-v1-vercel-prod-cert-v1.json`, `docs/build-memory-optimization-v1-phase2-route-manifest.json`, `docs/build-memory-optimization-v1-phase2-import-pressure.json` and `scripts/vercel-build-memory-recovery-v1-validate.mjs`.

Platform Consolidation & Duplication Cleanup V1 is locally complete as a no-deletion revalidation checkpoint. Fourteen unused-service candidates, seven low-discoverability page candidates and eleven responsibility hotspots were rechecked against runtime, script and documentation references. Approved removal candidates were 0: the candidates were reachable, archival/script tooling, admin diagnostics, active deep links, auth boundaries or still requiring stronger owner proof. No files were removed, no routes were deleted or exposed, no callers were migrated and no product behavior changed.

Evidence: `docs/PLATFORM_CONSOLIDATION_DUPLICATION_CLEANUP_V1.md`, `docs/platform-consolidation-duplication-cleanup-v1.json`, `scripts/platform-consolidation-duplication-cleanup-v1.mjs` and `scripts/platform-consolidation-duplication-cleanup-v1-validate.mjs`.

Historical Learning Foundation V1 is locally complete as a read-only training-readiness foundation. It projects existing `prediction_history`, canonical `game_results`, feature snapshot references and `model_weight_history` into a deterministic readiness inventory without adding SQL, creating retrospective predictions, running Historical Replay, running feature backfill, training a model, recalibrating probabilities, changing model weights or activating an epoch. Current inventory scans 2,595 predictions, marks 354 production training-ready rows and records 2,241 rejected/blocked rows with exact reasons. Model weight history remains 41 before and after.

Evidence: `src/services/historical-learning-foundation-v1.service.ts`, `docs/HISTORICAL_LEARNING_FOUNDATION_V1.md`, `docs/HISTORICAL_LEARNING_DATASET_CONTRACT_V1.md`, `docs/HISTORICAL_LEARNING_READINESS_V1.json`, `scripts/historical-learning-foundation-v1.mjs` and `scripts/historical-learning-foundation-v1-validate.mjs`.

Historical Training Readiness And Controlled Model Training Design V1 is locally complete as a design-only operating manual for future controlled model evolution. It adds read-only planners, validators, training manifests and governance documents without fitting, optimizing, recalibrating, promoting or changing production outputs. Current readiness remains 354 production training-ready rows, 386 learning queue rows, 354 accepted learning rows and 41 model weight history rows; MLB has design sample only, while NBA, NFL, NHL, Soccer, BSN, Tennis and UFC remain blocked from training until genuine accepted production-settled evidence exists.

Evidence: `scripts/historical-training-readiness-v1.mjs`, `scripts/historical-training-readiness-v1-validate.mjs`, `docs/TRAINING_PIPELINE_ARCHITECTURE_V1.md`, `docs/MODEL_GOVERNANCE_V1.md`, `docs/TRAINING_READINESS_V1.md`, `docs/TRAINING_READINESS_V1.json`, `docs/MODEL_PROMOTION_POLICY_V1.md`, `docs/TRAINING_DATASET_SPEC_V1.md` and `docs/TRAINING_CHECKLIST_V1.md`.

Historical Evidence Expansion And Training Readiness Roadmap V1 is locally complete as a read-only route from 354 accepted learning rows toward the 1,000-row controlled candidate-training gate. The analyzer extends the historical learning evidence with exact accepted-by-sport, market, model and month counts, then forecasts recoverability without importing historical data, replaying history, consuming provider credits, creating predictions or changing production data. Current evidence has 596 recoverable rows, 1,636 partially recoverable preview/shadow rows, 9 permanent rejects and 0 unknown recoverability. Stage B recovery of the 596 rows is the fastest no-import path, reaching a maximum of 950 accepted rows before normal production settlement or future approved historical work supplies the remaining 50.

Evidence: `src/services/historical-learning-foundation-v1.service.ts`, `scripts/historical-evidence-expansion-v1.mjs`, `scripts/historical-evidence-expansion-v1-validate.mjs`, `docs/HISTORICAL_EVIDENCE_EXPANSION_V1.md`, `docs/TRAINING_EXPANSION_ROADMAP.md`, `docs/SPORT_READINESS_FORECAST.md`, `docs/MARKET_READINESS_FORECAST.md`, `docs/DATA_COVERAGE_FORECAST.json` and `docs/TRAINING_FORECAST.json`.

Historical Evidence Recovery And Training Dataset Expansion V1 is locally complete as a read-only virtual learning-dataset recovery. It identifies 65 additional MLB rows that already have canonical result, feature snapshot, model version, canonical mapping and cutoff-safe evidence. The expanded manifest raises training-ready evidence from 354 to 419 rows without writing to `prediction_history`, modifying settlements, training, changing weights, activating epochs, importing data, replaying history or calling providers. MLB expanded rows are 139 moneyline, 140 spread/runline and 140 totals, all in 2026-07. The platform remains below the 1,000-row controlled candidate-training gate with 581 rows still needed.

Evidence: `scripts/historical-evidence-recovery-v1.mjs`, `scripts/historical-evidence-recovery-v1-validate.mjs`, `docs/HISTORICAL_EVIDENCE_RECOVERY_V1.md`, `docs/TRAINING_DATASET_EXPANSION_V1.md`, `docs/LEARNING_DATASET_GROWTH.json` and `docs/RECOVERY_SUMMARY.json`.

AI Training Opportunity Analysis And Model Strategy V1 is locally complete as an analysis-only data-science strategy. It inspects 1,691 linked feature snapshots and 366 unique feature keys, then recommends no production training at the current 419-row sample size. The first future candidate should be an MLB-first regularized logistic regression challenger after 1,000+ accepted rows, pooling moneyline/spread/total until each market reaches 300+ samples. Gradient boosted challengers are deferred until roughly 2,000+ samples, while neural networks, stacking and AutoML remain 5,000+ sample research paths. No model fitting, optimization, probability change, Trust change, settlement change, provider call, model-weight mutation or epoch activation occurred.

Evidence: `scripts/ai-model-strategy-v1.mjs`, `scripts/ai-model-strategy-v1-validate.mjs`, `docs/AI_MODEL_STRATEGY_V1.json`, `docs/AI_MODEL_STRATEGY_V1.md`, `docs/MODEL_SELECTION_ANALYSIS.md`, `docs/FEATURE_ANALYSIS_V1.md`, `docs/MODEL_EVOLUTION_ROADMAP.md` and `docs/TRAINING_PRIORITY_MATRIX.md`.

Historical Settled Status Reconciliation V1 is locally complete as a targeted P1 consistency repair. The platform now has a shared canonical settlement-state classifier used by Performance Scope V2, AI Learning Lifecycle and Adaptive Refresh backlog detection. The read-only audit scanned 2,595 prediction rows, explaining the raw stored-terminal/deterministic-terminal divergence through lifecycle scope: invalid-cutoff rows, Preview/Shadow rows, legacy/audit rows, missing canonical result evidence, push/void representation and six row-level conflicts that were later resolved by Six Historical Settlement Conflict Resolution V1. Product Performance remains scoped to cutoff-safe canonical rows and learning evidence remains derived from canonical settled rows; no provider call, learning write, model-weight mutation or deployment occurred in the classifier phase.

Evidence: `src/services/canonical-settlement-state.service.ts`, `src/services/performance-scope-v2.service.ts`, `src/services/ai-learning-lifecycle.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `scripts/historical-settled-status-reconciliation-v1.mjs`, `scripts/historical-settled-status-reconciliation-v1-validate.mjs`, `docs/HISTORICAL_SETTLED_STATUS_RECONCILIATION_V1.md` and `docs/historical-settled-status-reconciliation-v1.json`.

Performance API Query Optimization V1 is locally complete as the first targeted P1 repair from Full Platform Audit V1. `/api/performance` now serves the product page through the canonical Performance Scope V2 product contract by default and keeps full AI Performance Center diagnostics behind an explicit full-diagnostics query flag. Local profiling improved the default route from the observed 26.5-32.9 second / 11.9 MB baseline to 4.4-5.5 seconds / 667 KB while preserving product-visible semantic fingerprints and keeping provider calls, remote mutations and business rules unchanged. No Vercel deployment was performed.

Evidence: `src/app/api/performance/route.ts`, `src/services/performance-scope-v2.service.ts`, `scripts/performance-api-query-optimization-v1-validate.mjs`, `docs/PERFORMANCE_API_QUERY_OPTIMIZATION_V1.md`, local build and bounded smoke.

MLB Canonical Settlement Backlog And Immutable Learning Label Closure V1 is locally complete. The remaining 36 canonical-ready MLB rows were settled through the existing protected operating-day path in oldest-ready order (`2026-07-27`, then `2026-07-28`). Canonical-ready backlog is now 0, 67 rows remain pending because canonical `game_results` evidence is still unavailable, and the AI Operations derived learning queue now reports 354 accepted deterministic samples. No standalone learning-label system was created, no model weights changed, and no deployment occurred.

Protected Canonical MLB Settlement And Learning Closure V1 is locally complete for the first safe batch. The existing operating-day settlement path processed the oldest canonical-ready date (`2026-07-26`) using `game_results` evidence only. Three NYY @ PHI predictions settled as losses against PHI 11, NYY 4; no unresolved rows were settled. A stake/profit persistence defect in operating-day settlement was repaired so future settlements persist the same stake used for profit accounting. Remaining canonical-ready pending MLB rows are 36 for later operating-day batches; 67 rows remain blocked awaiting canonical result evidence.

Canonical Result Ingestion Recovery V1 is locally complete. The July 26 NYY @ PHI event (`baseball_mlb:mlb:sportsdataio:event:78870`) now has authoritative `game_results` evidence from the existing MLB Stats result sync path. The repair stayed inside `src/services/results-sync.service.ts`: canonical game-result IDs are counted correctly, timestamp equality is idempotent across equivalent ISO formats, and `sport_events` result evidence is patched only when the canonical result row changes. The verified replay now reports 42 reused rows, 0 inserted rows, 0 updated rows and 0 event updates. Settlement reconciliation is read-only and now identifies the three NYY @ PHI predictions as deterministic settlement candidates; settlement, learning and performance writes were not executed.

MLB Operating-Day Odds Recovery V1 is locally complete. The July 28 audit found the current stored slate recovered with 16 scheduled MLB events, 96 canonical core odds rows, 48 feature snapshots, 48 stored valid pregame prediction rows and 45 Current Board candidates. The remaining defect was scheduler action masking: adaptive status correctly marked stale pregame odds as `DUE_NOW`, but execution dry-run could still select `settle` when odds were stale-but-present because it only checked `gamesWaitingForOdds`. Execution now uses `marketRefreshEligibility.marketRefreshNeeded`, so the dry-run selects `midday_refresh` before settlement. No provider probe, live refresh, prediction generation, settlement, learning write, SQL, epoch activation, model change or deployment was executed.

MLB Result Evidence Reconciliation V1 is locally complete. The settlement backlog detector now uses canonical `game_results` evidence instead of completed/scored `sport_events` alone, matching the operating-day settlement engine. Three July 26 NYY @ PHI rows remain unresolved because no authoritative `game_results` row exists; scheduler settlement-ready rows are now 0 and no settlement execution is authorized until aligned result evidence exists.

The Odds API Maximum Utilization, Historical Odds Acquisition And Multi-Sport Prediction Enablement V1 is complete as `SAFETY_GATED_PARTIAL_COMPLETE`. The run added catalog/quota/capability APIs, acquired current core odds, proved truthful empty player-prop coverage for tested events, certified historical range costs, imported a narrow MLB historical core sample, certified non-MLB score endpoint behavior and derived read-only market-history/closing-candidate evidence. It consumed 449 credits, preserved 19,521 remaining credits, wrote 11,715 auditable production mutations and did not alter prediction, recommendation, settlement, scheduler, Learning Brain or epoch behavior.

Live Multi-Sport Data Acquisition, Feature Materialization and Prediction Activation V1 is in controlled execution from commit `ec85d06b59f87d7b319f1e10afd68401403e7e36`. Checkpoint A is locally implemented with bounded live entitlement probes and sanitized evidence. SportsDataIO MLB teams, SportsDataIO NBA teams, The Odds API sports catalog and The Odds API MLB event odds returned live HTTP 200 evidence under a 4-call cap; NFL and NHL SportsDataIO probes were skipped because no runtime credentials were configured. No import, feature rebuild, prediction activation, settlement, learning, SQL or production data mutation ran in Checkpoint A.

Checkpoint B MLB bounded acquisition executed through the existing SportsDataIO MLB Discovery import executor. Current-season schedule, standings, team season stats and player season stats were refreshed under one-call execution steps with cumulative evidence of 4 provider calls, 49 inserts, 7,701 updates, 0 rejected rows and no prediction/model/recommendation changes. Remaining MLB domains continue through existing cutoff, feature, settlement and recommendation gates.

Checkpoint C NBA/NFL is partially blocked by live gates. NBA credentials are present, but the existing provider execution gate rejected broad live execution pending external blocker evidence; one bounded NBA odds call returned provider records but zero usable full-game sportsbook-priced outcomes and wrote 0 rows. NFL remains blocked because no runtime SportsDataIO NFL credential is configured.

Final certification for this live acquisition run is `PARTIAL_SAFETY_GATED_COMPLETE`. Total provider calls were 9, production insert/update mutations were 7,750, SQL migrations were 0, feature rebuilds were 0, new prediction activations were 0, settlement executions were 0, learning-label writes were 0 and postgame-explanation writes were 0. MLB remains the only active production prediction sport; no recommendation sport was added.

Multi-Sport Data, Prediction And Learning Expansion Program V1 is in local autonomous execution from commit `928be40d0ebb5db65d4b4378dff1074ab08bf954`. Checkpoint 1 adds the stored-data-only Data Coverage Center at `/data-coverage`, `/data-coverage/[sport]`, `/api/data-coverage/inventory`, `/api/data-coverage/health` and `/api/data-coverage/provider-audit`, composing existing data-foundation coverage, provider capability metadata, SportsDataIO prior audit evidence and The Odds API dry-run evidence without live provider calls, imports, SQL, prediction generation, settlement writes, feature rebuilds, recommendation changes or epoch activation.

Checkpoint 2 is locally implemented at `/api/data-coverage/expansion-checkpoint2` and in the Data Coverage page. It consolidates MLB, NBA and NFL expansion readiness with dry-run historical import manifests, provider entitlement gates and zero provider calls, imports, feature rebuilds, prediction generation, settlement writes or recommendation activation.

Checkpoint 3 is locally implemented at `/api/data-coverage/expansion-checkpoint3` and in the Data Coverage page. It covers NHL, Soccer, BSN, Tennis and UFC with cross-year season, competition-specific, custom-league/manual-source and event-driven readiness rules. It executes no provider calls, imports, feature rebuilds, predictions, settlement writes or recommendation activation.

Checkpoint 4 is locally implemented at `/api/data-coverage/final-certification` and in the Data Coverage page. It records final program status as `PARTIAL`, adds read-only Postgame Explanation V1 and Learning Expansion contracts, preserves the existing scheduler and keeps probability, confidence, Trust, Learning Brain weights, Official Pick policy, cutoff policy, epoch state and cron behavior unchanged.

Product Experience, Data Trust, And Live-State Readiness Audit V1 is in autonomous local execution from commit `1cc3853565dd41c67b36f6453b3a876aabdd9361`. The run is governed by `docs/product-audit-v1-ledger.json` and must not push, deploy, apply SQL, run production imports, execute feature rebuilds, seed or activate `DATA_FOUNDATION_V2_EPOCH`, switch scheduler behavior or change Learning Brain/model weights. Stage 1 route inventory is locally complete with 20 page routes, 409 API routes and bounded smoke evidence; `/api/data-foundation/readiness` remains a bounded local timeout caveat.

Product Audit Stage 4 Probability Picks eligibility hardening is locally implemented. MLB remains projection-only and `CERTIFIED_LIMITED`; other sports are excluded from global Probability Picks rankings as `ENGINE_NOT_CERTIFIED` until sport-specific engines and stored data are certified. Probability math, model weights, Learning Brain, Official Picks, EV, Kelly, bankroll and Portfolio Intelligence remain unchanged.

Product Audit readiness artifacts are locally prepared in `docs/PRODUCT_METRIC_LANGUAGE_V1.md`, `docs/PRODUCT_READINESS_MATRIX_V1.md`, `docs/product-readiness-matrix-v1.json`, `docs/PRODUCT_VALUE_ROADMAP_V1.md` and `docs/PRODUCT_EXPERIENCE_DATA_TRUST_AUDIT_V1_CERTIFICATION.md`. Recommended NOW priorities are data-trust hardening, consumer/operator navigation separation, freshness labels and DATA_FOUNDATION_V2_EPOCH gate readiness. Portfolio Intelligence and Player Prop EV V2 remain deferred and not started.

Product Navigation & Freshness Hardening V1 is locally implemented as the next UX-only product pass. Navigation now separates Home, Picks, Projections, Markets, Performance, Operations and Administration, and the main product pages share clearer Projection Only, No Recommendation, Limited, Preview, Blocked, Pending, Stored Data and local freshness language. No models, probabilities, thresholds, Learning Brain weights, scheduler behavior, provider calls, SQL or production data were changed.

AI Briefing V2 Daily Decision Engine is locally implemented on `/ai-operations` as the executive summary for the product. It answers whether today has qualified projection-only opportunities, summarizes certified sports, top probability/confidence/quality signals, warnings, data freshness, model trust, sport readiness and next links without changing Probability Picks, Current Board, Performance, Player Projections, models, thresholds, Learning Brain, SQL, provider calls or data writes.

Probability Picks V2 is locally implemented as the detailed exploration companion to AI Briefing V2. It keeps MLB as `CERTIFIED_LIMITED`, keeps uncertified sports out of rankings and parlays, adds additive V2 API metadata, clearer filtering/sorting, top-signal cards, by-sport grouping, not-ready sport summaries, pick explanations, freshness labels and AI Briefing deep links. Existing probability, confidence, quality, thresholds, score formula, parlay thresholds, correlation math, models, Learning Brain, scheduler, SQL, provider calls and mutations remain unchanged.

Sports Center V1 is locally implemented as the top-level sport hub. `/sports-center` and `/sports-center/[sport]` expose MLB, NBA, NFL, Soccer, BSN, NHL, Tennis and UFC with the canonical status vocabulary: Production, Certified, Foundation, Preview, Planning, Unavailable, Blocked, Pending and Deprecated. The hub links to existing product and readiness surfaces, removes the stale hardcoded root-page pick experience by redirecting `/` to `/dashboard`, and makes no provider calls, database writes, SQL changes, model changes, scheduler changes or settlement changes.

Settlement And Learning Pipeline Recovery V1 is locally implemented. The adaptive refresh orchestrator now detects stored settlement-ready prediction backlog, treats settlement as an executable due-now domain, plans settlement against the oldest ready local date and supports an optional protected `expectedAction` guard against live action drift. This repairs lifecycle routing only; deterministic settlement math, prediction engines, probabilities, confidence, quality, thresholds, Official Pick policy, Learning Brain weights, Kelly, Portfolio, Player Props, Sports Center and Current Board logic remain unchanged.

Portfolio Intelligence V1 is locally implemented as `/portfolio-intelligence` and `/api/portfolio-intelligence`. It reuses Probability Picks and Current Board rather than creating a second ranking engine, and labels combinations by deterministic shared exposure instead of fabricated correlation. The phase is analytical only with no bankroll sizing, Kelly, wagering execution, Official Pick promotion, model changes, provider calls or remote mutations.

Market Intelligence V1 is locally implemented as `/market-intelligence` and `/api/market-intelligence/movement`. It analyzes stored sportsbook snapshots from `sports_odds_snapshots`, labels earliest evidence as earliest stored price rather than true open, reports current stored price, movement, dispersion and synchronized stored-book movement without fabricated sharp-money claims, provider calls, remote mutations or prediction changes.

Closing Line Intelligence V1 is locally implemented as `/closing-line-intelligence` and `/api/closing-line/intelligence`. It defines the closing candidate as the latest valid aligned stored price before event start, calculates CLV only for valid prediction-time and closing-candidate pairs, excludes post-start prices and estimated closes, and remains read-only with zero provider calls, zero remote mutations and no prediction/model/settlement-policy changes.

Autonomous Daily AI V1 is locally implemented as `/autonomous-daily-ai` and `/api/autonomous-daily-ai`. It composes existing adaptive refresh, autonomous operations health and provider budget contracts into a 17-stage daily plan with dry-run, expected-action guard, idempotency keys, provider quota visibility and completion-state classification. It does not create a new scheduler, execute provider calls in validation, mutate data, change models or alter settlement/learning policy.

Historical Sports Data Foundation V2 and Prediction Epoch Reset V2 is in autonomous local execution. The run is governed by `docs/AUTONOMOUS_EXECUTION_V2.md` and `docs/autonomous-execution-v2.json`. It may create local commits and additive migration files, but it must not push, deploy, apply production SQL, execute historical odds, delete predictions, activate a new production epoch or enable new production cron jobs.

Prediction Epoch Shadow Readiness V1 is locally implemented as the next governance step. It adds shadow-only classifier, activation-readiness, odds-cadence SLA and odds-change-refresh readiness APIs, plus an unapplied additive migration artifact for future `prediction_origin`, `certification_status` and `certification_metadata`. The phase keeps legacy MLB history quarantined, does not activate an epoch, does not mark rows `production_eligible`, does not run Historical Replay and does not change prediction formulas, Official Pick thresholds, scheduler behavior or Learning Brain weights.

Phase 1 coverage audit is locally implemented at `/api/data-foundation/coverage` with zero provider calls and zero mutations. It reports MLB and NBA as stored-data ready, BSN as partial for prediction readiness, and NFL/NHL/Soccer/Tennis/UFC as blocked or empty until legitimate data adapters/contracts are added.

Phase 2 season and competition governance is locally implemented at `/api/data-foundation/seasons`. It defines calendar-year MLB/BSN, cross-year NBA/NHL, NFL season-year with cross-calendar postseason, competition-specific Soccer and event-driven Tennis/UFC without requiring production SQL.

Phase 3 sports data warehouse contract is locally documented in `docs/SPORTS_DATA_WAREHOUSE_V2.md`. It maps existing storage into canonical warehouse layers and defines lineage, deterministic key, validation-state and correction-state rules without adding duplicate tables.

Phase 4 historical import orchestration is locally implemented at `/api/data-foundation/import-orchestrator`. It wraps the existing Historical Import Engine Core, exposes PLAN_ONLY and DRY_RUN planning, and keeps LOCAL_EXECUTION and MANUAL_PRODUCTION_READY blocked to contract-only for this no-production-mutation run.

Phase 5 MLB historical foundation is locally implemented at `/api/data-foundation/mlb`. It certifies stored MLB coverage for 2025 and 2026, event/player mappings, feature compatibility, player props and pitcher projections without calling providers, mutating production or generating retrospective predictions.

Phase 6 NBA historical foundation is locally implemented at `/api/data-foundation/nba`. It audits stored NBA schedule, stats, odds, mappings and predictions while preserving trial/non-production isolation and reporting canonical game-result gaps.

Phase 7 NFL historical foundation is locally implemented at `/api/data-foundation/nfl`. It preserves NFL season-year and cross-calendar postseason governance while reporting the current stored-data state honestly as empty/blocked across schedule, results, stats, injuries, depth charts/starters and odds.

Phase 8 NHL historical foundation is locally implemented at `/api/data-foundation/nhl`. It preserves cross-year season governance and reports NHL readiness honestly as empty/blocked across schedule, results, stats, goalie/starter coverage, injuries and odds until legitimate stored or licensed data is available.

Phase 9 Soccer historical foundation is locally implemented at `/api/data-foundation/soccer`. It adds a competition readiness registry and preserves the explicit rule that Soccer is competition-specific; the current `soccer_generic` placeholder is migration readiness, not global production coverage.

Phase 10 BSN historical foundation is locally implemented at `/api/data-foundation/bsn`. It preserves BSN as a custom-league adapter, exposes deterministic CSV/manual import contracts, requires approved source provenance and reports current stored BSN coverage as empty rather than fabricated.

Phase 11 Tennis and UFC data readiness is locally implemented at `/api/data-foundation/tennis-ufc`. It treats both sports as event-oriented, refuses team-season schema forcing and keeps production picks blocked until certified engines and sufficient stored data exist.

Phase 12 global data quality and reconciliation is locally implemented at `/api/data-foundation/quality`, `/api/data-foundation/reconciliation` and `/api/data-foundation/readiness`. These APIs are read-only, report reconciliation items without mutation plans and keep provider calls at zero.

Phase 13 prediction epoch governance is locally implemented at `/api/data-foundation/epochs` with additive unapplied migration `202607270001_prediction_epoch_governance_v2.sql`. It defines `LEGACY_EPOCH_V1` and `DATA_FOUNDATION_V2_EPOCH` while keeping the new epoch inactive until manual migration and activation approval.

Phase 14 legacy prediction archive and metric isolation is locally implemented at `/api/data-foundation/legacy-metrics`. It provides report-only deletion-candidate classification and active-epoch metric filtering rules without deleting, archiving or updating prediction rows.

Phase 15 feature rebuild planning is locally implemented at `/api/data-foundation/feature-rebuild`. It defines sport-aware, season-aware, as-of-time-safe, checkpointed and idempotent rebuild contracts while keeping production execution disabled.

Phase 16 future-only prediction continuity is locally implemented at `/api/data-foundation/future-predictions`. It defines active-epoch future eligibility, cutoff enforcement, originating-epoch settlement and epoch-aware learning labels while keeping production scheduling disabled.

Phase 17 epoch-aware performance and learning reporting is locally implemented at `/api/data-foundation/epoch-performance`. It separates active, archived and all-epoch performance scopes, reports bounded performance groups by inferred epoch, sport and model version, and keeps learning labels epoch-aware without changing Learning Brain weights or recalibrating models.

Phase 18 final local certification is documented in `docs/HISTORICAL_SPORTS_DATA_FOUNDATION_V2_CERTIFICATION.md`. The run is complete locally and remains blocked from production SQL, push, deployment and epoch activation until separate explicit approval.

Prediction Epoch Governance V2 production migration review and hardening is locally complete. `supabase/migrations/202607270001_prediction_epoch_governance_v2.sql` remains unapplied, but has been hardened with RLS, guarded additive constraints, epoch indexes and no seed/backfill/activation behavior. Manual application is blocked until explicit approval and must follow `docs/PREDICTION_EPOCH_GOVERNANCE_V2_MIGRATION_RUNBOOK.md`.

Prediction Epoch Migration Detection Fix V1 is locally implemented. The data-foundation epoch APIs now use a canonical read-only migration-state contract that treats an empty `prediction_epochs` table as `APPLIED_EMPTY`, keeps `DATA_FOUNDATION_V2_EPOCH` inactive, preserves legacy behavior and detects partial/schema-cache states without mutating production data.

Prediction Epoch Governance Seeding V1 is locally prepared as Gate 2. The seed artifacts create exactly two canonical governance rows when manually approved: `LEGACY_EPOCH_V1` as the single active fallback and `DATA_FOUNDATION_V2_EPOCH` as `SHADOW`. No seed SQL has been applied, no prediction rows are linked, and Gate 3 legacy backfill/V2 activation remains not started.

Historical Sports Data Completion Program V1 is now in local autonomous execution. Phase A1 refreshed the global stored-data baseline across MLB, NBA, NFL, NHL, Soccer, BSN, Tennis and UFC with zero provider calls and zero mutations. The baseline is stored in `docs/HISTORICAL_DATA_COMPLETION_BASELINE_V3.md` and will feed the completion matrix and source registry phases.

Phase A2 adds `docs/data-completion-matrix-v1.json`, a machine-readable matrix across 8 sports and 22 datasets per sport. It preserves unknown expected row counts as `null`, separates provider and entitlement blockers, and marks manual-import candidates without executing imports.

Phase A3 adds `docs/SPORTS_DATA_SOURCE_REGISTRY_V2.md`, a source/provenance registry covering SportsDataIO, The Odds API, Retrosheet, approved official sources, manual CSV and existing stored tables. The registry keeps historical odds and unproven provider domains blocked until entitlement, cost and approval are explicit.

Phase B1 adds the MLB Season Coverage Plan V3 with exact previous/current/future target windows and bounded import manifests for event/results, stats/boxscores, starter/lineup context and current markets. All manifests remain plan-only and require future approval before provider calls or mutations.

Phase B2 adds the MLB Event And Result Completion V3 reconciliation contract. It explicitly records that stored MLB results are partial and prepares deterministic event identity, doubleheader safety and result idempotency rules without executing imports or claiming full result completion.

Phase B3 adds the MLB Boxscore And Stat Completion V3 reconciliation contract. It preserves recorded-outs unit safety, player identity guards, duplicate/natural-key collision handling and as-of feature boundaries while keeping full stat import execution blocked pending approval.

Phase B4 adds the MLB Player And Starter Identity V3 contract. It preserves exact/deterministic-only persistence, blocks normalized-only and ambiguous player mappings, defines manual review queue shape and keeps starter identity pregame/source-timestamp gated.

Phase B5 adds the MLB Market Data Foundation V2 contract. It documents standard current-market readiness, genuine stored pitcher-outs rows and storage lineage while keeping historical odds, opening/closing lines and broader player props blocked pending entitlement and approval.

Phase B6 adds the MLB Historical Foundation V3 certification. MLB is locally certified as core/partial, not fully historically complete; result, stat, boxscore, starter, injury and historical market gaps remain explicit import blockers.

Phase C1 adds the NBA Baseline Certification V1. NBA is locally certified only as a partial/trial stored-data baseline with canonical results still empty and production prediction readiness blocked.

Phase C2 adds the NBA Result And Stat Completion Plan V1. It defines bounded plan-only manifests and post-import gates while keeping provider calls, imports, mutations and production NBA activation blocked.

Phase C3 adds the NBA Identity And Market Readiness V1 contract. It permits only exact identity evidence, blocks fuzzy/normalized persistence and keeps NBA props, alternate/live markets and recommendation logic out of scope.

Phase D1 adds the NFL Baseline Certification V1. NFL is locally certified as empty/blocked for canonical data foundation purposes, with legacy prediction rows preserved but no production readiness claim.

Phase D2 adds the NFL Completion Plan V1. It defines bounded future import manifests and post-import gates while keeping provider calls, imports, mutations, props, recommendation logic and production NFL activation blocked.

Phase E1 adds the NHL Baseline And Completion Plan V1. NHL is locally certified as empty/blocked with future plan-only manifests, cross-year season governance and goalie/starter temporal safeguards.

Phase F1 adds the Soccer Competition Completion Plan V1. Soccer remains competition-specific only, with no global coverage claim and no production activation until scoped competition imports are approved and certified.

Phase G1 adds the BSN Completion Certification V1. BSN is certified as a partial custom-league foundation with manual/CSV source readiness only; missing results, stats, boxscores and markets remain blocked.

Phase H1 adds the Tennis And UFC Event Readiness Certification V1. Both sports remain event-driven empty/blocked domains and must not be forced into team-season workflows.

Phase I1 closes Historical Sports Data Completion Program V1 locally. The program produced a complete stored-data completion map and sport-by-sport readiness contracts without provider calls, production mutations, SQL, imports, feature rebuilds, push, deployment or certified platform tag changes.

Phase B5 adds the MLB Market Data Foundation V2 readiness contract. It preserves existing current standard-market and genuine pitcher-outs prop evidence, blocks historical odds/open-close claims without entitlement and cost approval, and adds no EV, Kelly, Official Pick or recommendation behavior.

## Completed

### Platform Certification

Status: Complete and production-certified.

Evidence: `docs/RELEASES/PLATFORM_CERTIFIED_V1.md`, `docs/PLATFORM_LOCK_POLICY.md`, `docs/PLATFORM_ROLLBACK_RUNBOOK.md`, `docs/RELEASES/v1.0-platform-certified.json`, production `/api/system/version`, `/api/operations/status`, `/api/operations/validation`, `/api/dashboard?mode=today&includeValidation=true`, `/api/current-board?includeValidation=true`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/predictions/settle?dryRun=true`, `/api/performance`, `/api/performance/goals` and `/api/performance/validation`.

Note: Product Experience, Dashboard canonical reconciliation, Grounded Opportunities integrity, Settlement dry-run safety, Operations validation, Adaptive odds operations, Production autonomous execution and Performance product contract are complete at the certified baseline. No application behavior or model policy changed during the release-governance documentation phase.

### Portfolio Intelligence V1

Status: NOT STARTED.

Note: Portfolio Intelligence V1 remains NOT STARTED. MLB Player Prop Market Comparison V1 is a separate model-vs-market comparison layer and does not create portfolio construction, bankroll, staking, Kelly or Official Pick behavior.

### Probability Picks & Parlay Builder V1

Status: Locally implemented; production deployment pending approval.

Evidence: `src/types/probability-picks.ts`, `src/services/probability-picks.service.ts`, `/api/probability-picks`, `/api/probability-picks/parlays`, `/api/probability-picks/validation`, `/api/probability-picks/preview`, `/api/probability-picks/generate`, `/probability-picks`, `docs/PROBABILITY_PICKS_V1.md`.

Note: V1 ranks internal model probabilities and builds correlation-aware projection parlays only. It reads no sportsbook lines, computes no EV, Kelly, stakes, bankroll, Official Picks or portfolio outputs, performs no provider calls, performs no remote mutations and adds no persistence migration. Portfolio Intelligence remains NOT STARTED.

### MLB Player Prop Market Comparison V1

Status: Complete and production-certified at commit `26d5e6dda95f3ff8ffe95c01a76714898b7bf86c`.

Evidence: `src/types/mlb-player-prop-comparison.ts`, `src/services/mlb-player-prop-comparison.service.ts`, `/api/mlb/player-props`, `/api/mlb/player-props/health`, `/api/mlb/player-props/validation`, `/api/mlb/player-props/[pitcherId]`, `/api/mlb/player-props/preview`, `/api/mlb/player-props/generate`, `src/components/dashboard/MlbPlayerProjectionPageClient.tsx`, `docs/MLB_PLAYER_PROP_MARKET_COMPARISON_V1.md`.

Note: V1 supports pitcher recorded-outs market comparison only for 14.5, 15.5, 16.5, 17.5 and 18.5 over/under lines. It computes implied probability, fair odds and percentage-point difference from stored `sports_odds_snapshots` player-prop rows. Current live audit found 0 stored MLB `player_props:%` rows, so comparisons return `NO_PROP_AVAILABLE` without fabricating sportsbooks, lines or prices. No provider calls, remote mutations, projection formula changes, EV, Kelly, Official Picks, settlement changes, scheduler changes or Portfolio Intelligence were introduced.

### MLB Player Prop Ingestion V1

Status: Locally implemented with deterministic The Odds API event crosswalk enablement and protected manual sync gate.

Evidence: `src/types/mlb-player-prop-ingestion.ts`, `src/services/mlb-player-prop-sync.service.ts`, `src/services/the-odds-api-event-crosswalk.service.ts`, `/api/mlb/player-props/sync`, `/api/mlb/player-props/health`, `/api/mlb/player-props/validation`, `/api/mlb/player-props/provider-audit`, `/api/providers/the-odds-api/event-crosswalk`, `docs/MLB_PLAYER_PROP_INGESTION_V1.md`, `docs/THE_ODDS_API_EVENT_CROSSWALK_AND_PROP_SYNC_V1.md`.

Note: V1 adds provider audit, canonical snapshot contracts, Odds API `pitcher_outs` normalization fixtures, storage shaping for existing `sports_odds_snapshots`, health, validation, protected dry-run sync and a deterministic current-event crosswalk. Bounded live crosswalk persisted only certified event mappings after review. The Odds API Pitcher Identity Bridge V1 now maps provider pitcher names to canonical players through existing `provider_entity_mappings` only when exact/deterministic confidence is certified. One deterministic Will Warren mapping activated 11 real stored recorded-outs prop rows with an idempotent rerun. Comparison remains projection-gated: stored prop inventory is visible, but `MARKET_LINE_AVAILABLE` is withheld until a same-event pitcher projection exists. SportsDataIO MLB player props remain enterprise-only and unconfirmed for the current Discovery Lab channel. No EV, Kelly, Official Pick, settlement, scheduler, Probability Picks or Portfolio Intelligence behavior was added.

### Production UX Polish V1

Status: Implemented locally and build-verified; Playwright walkthrough and production deployment verification pending.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `docs/PROJECT_STATUS.md`, `docs/MASTER_ROADMAP.md` and local production build.

Note: Final pre-Portfolio polish improves visible wording, empty states, tooltips, price/sportsbook display, edge units, AI Confidence, Top Game Intelligence and per-game operational labels while preserving every production intelligence contract. No prediction probabilities, production weights, Official Pick policy, Learning Brain behavior, settlement logic, provider calls, replay/backfill or Portfolio Intelligence changed.

### Dashboard Final Data Contract Regression Fix V1

Status: Implemented locally and build-verified; full Playwright and production deployment verification pending.

Evidence: `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `src/services/mlb-ai-picks-feed.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `tests/product-experience/product-experience.spec.ts`, `/api/dashboard?mode=today&includeValidation=true` and local production build.

Note: The Dashboard data contracts now keep canonical probability outcomes, directly priced markets, positive EV, Official Pick policy eligibility, per-game stored odds, displayable markets, freshness and learning labels separate. Complement-derived outcomes no longer borrow opposite-side pricing or EV, edge displays use percentage-point units, totals keep unsigned line display and waiting-for-odds appears only when stored odds are absent. No prediction probabilities, model weights, Official Pick policy, settlement, Learning Brain behavior, provider calls, replay/backfill or unsupported-market activation changed.

### Dashboard ViewModel & Product Semantics Final Certification V1

Status: Implemented locally and build-verified; production deployment verification pending.

Evidence: `src/services/dashboard-today.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `/api/dashboard?mode=today`, `/api/mlb/game-intelligence`, `tests/product-experience/product-experience.spec.ts` and local production build.

Note: The Dashboard now has a shared canonical ViewModel for probability, confidence, priced-market, uncertainty, value, player-intelligence, coverage, learning, freshness and per-game operational selectors. Visible Dashboard sections consume this contract instead of mixing Current Board, Most Likely, Best Value, pipeline trace and fallback candidates under overlapping labels. Game Intelligence index fallback is typed/degraded rather than a hard 500 when stored context is temporarily unavailable. No prediction probabilities, production weights, Official Pick policy, settlement, replay/backfill, provider credentials, supported markets or Learning Brain behavior changed.

### Homepage Consistency, Settlement Recovery & Scheduler Ownership V1

Status: Implemented locally; production settlement recovery and idempotent Performance/AI Evolution refresh completed.

Evidence: `/api/results/sync`, `/api/operating-day/[operatingDayId]/settle`, `/api/ai-operations/lifecycle`, `/api/performance/daily-update`, `src/app/api/cron/operating-day/route.ts`, Vercel cron config and GitHub observer workflow updates.

Note: July 24 MLB backlog was recovered using canonical services only: 15 final game results were synced, 45 verified eligible prediction rows were settled, 45 learning labels became accepted in AI Operations, and AI Performance snapshots were refreshed idempotently. Scheduler ownership is now explicit: Vercel Cron is the single write-capable owner for postgame continuity, while GitHub runtime, heartbeat and manual refresh workflows are dry-run observers. No model probabilities, production model weights, Official Pick policy, replay/backfill artifacts, retraining or recalibration were changed.

### Product Experience Phase 7 Recovery Certification V1

Status: Implemented, build-verified, rendered-browser certified and production-deployed.

Evidence: `playwright.config.ts`, `tests/product-experience/product-experience.spec.ts`, dev-only `@playwright/test` and `@axe-core/playwright`, screenshots in ignored `test-results/product-experience/screenshots/`, local production build and complete Playwright Chromium run.

Note: Phase 7 now has real viewport, keyboard, navigation, screenshot and axe evidence across Dashboard, Game Intelligence, Player Projections, Performance, Most Likely, Best Value, Betting Workbench, AI Operations and detail routes. Vercel production deployment `dpl_HWFtKoFnBvywiZb5wnAZSKja9S7T` reached READY and `/api/system/version` reported commit `5d37ab86f9360b97292166bc318f41acc81da7d2` before this documentation-only completion note. Fixes were limited to accessibility, responsive layout and navigable loading/error states. No prediction logic, provider calls, model weights, Official Pick policy, replay/backfill, retraining, recalibration or unsupported-market activation changed.

### Player Intelligence Experience V1

Status: Implemented locally and build-verified; production deployment verification pending.

Evidence: `src/app/api/mlb/player-projections/[projectionId]/route.ts`, `src/components/dashboard/MlbPlayerProjectionDetailClient.tsx`, existing MLB Player Projection Engine contracts and local production build.

Note: Player Detail now presents current same-player projections, distributions, projection evidence, bounded indexed history, projection-family performance and same-game comparison without activating sportsbook props, EV, Kelly, ROI or Official Picks. History is capped at 25 rows through `universal_projection_history` entity lookup, and comparison is bounded to the same game/projection family.

### AI Game Center Experience V1

Status: Implemented locally and build-verified; production deployment verification pending.

Evidence: `src/components/dashboard/MlbGameIntelligenceDetailClient.tsx`, existing `/api/games/[eventId]/intelligence` contract and local production build.

Note: The Game Intelligence detail page now presents a full AI Game Center with Overview, Team Intelligence, Starting Pitchers, Expected Lineups, Player Projections, Market Intelligence, deterministic model explanation, Performance & Evidence and Data Quality sections. It reuses existing Game Intelligence, Current Board, Starter Intelligence, Lineup Context and Player Projection contracts, keeps unavailable metrics as N/A with reasons, and does not change prediction probabilities, market policy, Official Picks, provider calls, replay/backfill artifacts or production weights.

### Current Board Database Timeout Recovery V1

Status: Implemented locally; production verification pending.

Evidence: `src/services/current-board.service.ts` and `supabase/migrations/202607240001_current_board_timeout_recovery_v1.sql`.

Note: The Current Board product read now applies a bounded pregame `commence_time` range for `CURRENT` and `UPCOMING` modes before ordering by odds timestamp, so normal requests do not scan historical prediction growth after large backfills. The migration adds narrow indexes matching current prediction reads and event/market odds snapshot lookups. Most Likely remains a Current Board consumer; no model probabilities, production weights, Official Pick policy, replay/backfill artifacts, provider calls or unsupported market activation changed.

### Product Navigation & Information Architecture V1

Status: Implemented and build-verified; production deployment verification pending.

Evidence: `src/components/dashboard/DashboardShell.tsx`, `src/components/dashboard/UserTodayPanel.tsx`, Game Intelligence list/detail clients, Player Projection list/detail clients, Most Likely, Best Value and Betting Workbench UI components.

Note: This phase preserves all existing routes while grouping primary product navigation by Today, Games, Players, Markets, Performance, AI Operations, Advanced and Administration. Visible game surfaces now link to Game Center, player projection rows link to Player Detail, expected-lineup names link to filtered Player Projections, and breadcrumbs clarify Dashboard -> Games -> Game Intelligence and Dashboard -> Players -> Player Detail context. No prediction engine, provider, settlement, replay, model weight or Official Pick policy behavior changed.

### Canonical Outcome, Odds Alignment & Performance State Reconciliation V1

Status: Implemented and build-verified; production deployment verification pending.

Evidence: `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/mlb-ai-picks-feed.service.ts`, `src/services/game-intelligence.service.ts`, `src/services/performance-product-contract.service.ts`, performance API routes, Most Likely/Best Value UI components and local production build.

Note: This product-maturity pass adds canonical outcome, canonical price, canonical implied probability, canonical EV and canonical reason fields without changing model probabilities or recommendation policy. Most Likely displays the highest-probability outcome and does not borrow the stored side's price for complement-derived outcomes. Best Value ranks only canonical actionable positive EV/edge and reports explicit blockers when EV is unavailable. Performance surfaces now expose one cutoff-safe production scope reconciliation while keeping replay/shadow samples labeled separately.

### Universal Market Intelligence Platform V1

Status: Implemented as read-only provider-independent inventory, readiness, provider coverage and diagnostics layer.

Evidence: `src/services/universal-market-intelligence.service.ts`, `/api/markets/inventory`, `/api/markets/readiness`, `/api/markets/provider-coverage`, `/api/markets/diagnostics`, `src/components/dashboard/UniversalMarketCoveragePanel.tsx`, AI Operations Universal Market Intelligence panel, `scripts/universal-market-intelligence.mjs`, additive `universal_market_registry` migration and `docs/UNIVERSAL_MARKET_INTELLIGENCE_PLATFORM_V1.md`.

Note: The platform discovers and normalizes stored market snapshots plus cataloged future market families while preserving the rule: capture everything, predict only supported markets and recommend selectively. Unsupported market families such as Team Totals, First Five, First Inning, alternate lines, winning margin, race-to-runs, props and SGP legs remain blocked or shadow-only until real provider coverage, settlement, features, learning/calibration evidence and explicit promotion exist.

### MLB First Five Markets V1

Status: Provider-independent architecture implemented; provider readiness and listed-starter rules pending.

Evidence: `src/services/mlb-first-five-readiness.service.ts`, `/api/mlb/markets/first-five`, `scripts/mlb-first-five-readiness.mjs`, AI Operations First Five panel and `docs/MLB_FIRST_FIVE_MARKETS_V1.md`.

Note: First Five is modeled as a first-five-inning market family with moneyline, run-line and total contracts. Deterministic settlement uses score after exactly five completed innings and supports pushes for tied two-way F5 moneyline, adjusted run-line ties and whole-number totals. The implementation is shadow/readiness only unless real odds coverage and explicit starter-change/no-action rules exist. Current Board, Most Likely, Best Value and Official Picks remain protected from fabricated lines, prices, EV or labels.

### MLB Team Totals V1

Status: Provider-independent architecture implemented; provider readiness pending verified real stored Team Total odds.

Evidence: `src/services/mlb-team-totals-readiness.service.ts`, `/api/mlb/markets/team-totals`, `scripts/mlb-team-totals-readiness.mjs`, AI Operations Team Totals panel and `docs/MLB_TEAM_TOTALS_V1.md`.

Note: Team Totals are modeled as full-game team-scoped Over/Under markets with required team side, line, sportsbook price, market timestamp and cutoff-safe snapshot. Deterministic settlement uses final selected-team score and supports Push when the final team score equals the listed line. The implementation is shadow/readiness only unless real odds coverage exists. Current Board, Most Likely, Best Value and AI Feed remain protected from fabricated lines or EV, and Official Picks remain disabled.

### Historical Calibration & Shadow Reweighting V1

Status: Implemented, read-only evidence-verified and build-verified; production deployment verification pending.

Evidence: `src/services/historical-shadow-calibration.service.ts`, `/api/model/shadow-calibration`, `scripts/historical-shadow-calibration.mjs`, AI Operations shadow calibration display and `docs/HISTORICAL_CALIBRATION_SHADOW_REWEIGHTING_V1.md`.

Note: Phase 2 consumes Full Historical Replay Phase 2B rows under `retrosheet_historical_replay_phase_2b_v1`, excludes 30 push rows from binary metrics and evaluates 7,260 graded rows with strict chronological splits: 4,356 training, 1,452 validation and 1,452 holdout. The versioned shadow bucket calibration improves holdout calibration error from 3.27 to 0.73 and accuracy from 56.61% to 57.16%, while Brier score moves from 0.2422 to 0.2425 and log loss from 0.6774 to 0.6782. Recommendation is Shadow equivalent / do not promote automatically. Provider calls, remote mutations, production weights, Current Board, Official Picks, Learning Brain, prediction history, replay artifacts and Historical Feature Store rows remain unchanged.

### Full Historical Replay Phase 2B

Status: Executed, idempotency-verified and build-verified; production deployment verification pending.

Evidence: `src/services/historical-replay-pilot.service.ts`, `scripts/historical-replay-pilot.mjs`, `npm.cmd run historical:replay:full -- --batch-size=50`, AI Operations Full Replay display, `universal_projection_history` replay artifacts under `retrosheet_historical_replay_phase_2b_v1`, `sports_sync_jobs` Phase 2B jobs, `historical_import_checkpoints` full-scope checkpoint and `docs/FULL_HISTORICAL_REPLAY_PHASE_2B.md`.

Note: The full replay processed 2,430 Retrosheet MLB games and generated 7,290 replay-only predictions, 7,290 replay settlements and 7,290 replay labels across Moneyline, Run Line/spread and Totals. The completed-scope rerun inserted 0 replay artifacts, reused all 7,290 deterministic artifacts and found duplicate IDs 0. Production prediction history, current production predictions, Current Board, Official Picks, scheduler behavior, Learning Brain weights and Historical Feature Store rows were not mutated. Provider calls remained 0, and historical EV was not calculated because complete historical sportsbook odds were not available.

### Historical Replay IO Readiness & Controlled Pilot V1

Status: Pilot executed, idempotency-verified and build-verified; production deployment verification pending.

Evidence: `src/services/historical-replay-pilot.service.ts`, `scripts/historical-replay-pilot.mjs`, AI Operations Replay Pilot display, `universal_projection_history` replay artifacts, `sports_sync_jobs` pilot jobs, `historical_import_checkpoints` pilot checkpoint, `docs/HISTORICAL_REPLAY_IO_READINESS_CONTROLLED_PILOT_V1.md` and local production build.

Note: The pilot processed 12 Retrosheet historical games and generated 36 replay-only predictions across moneyline, run line/spread and totals using stored historical snapshots. The second run inserted 0 replay projections and reused all 36 existing artifacts. Production prediction history, current predictions, Current Board, Official Picks, scheduler behavior, Learning Brain weights, production settlement and Historical Feature Store rows were not mutated. Full Historical Replay Phase 2B remains blocked pending explicit approval.

### Push-Aware Outcome Distribution & Market Semantics V1

Status: Locally implemented and build-verified; production deployment verification pending.

Evidence: `src/services/market-semantics.service.ts`, `src/services/current-board.service.ts`, `src/services/market-alignment.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/mlb-ai-picks-feed.service.ts`, `src/services/recommendation-explanation.service.ts`, `src/services/performance-scope-v2.service.ts`, `docs/PUSH_AWARE_OUTCOME_DISTRIBUTION_MARKET_SEMANTICS_V1.md` and local production build.

Note: This pass preserves all underlying model probabilities and completed Phase 2A/replay boundaries while distinguishing binary markets from push-capable markets. Best Value requires actionable Win/Push/Loss EV for push-capable markets, Most Likely does not fabricate complements for whole-number lines, Current Board/API responses expose market semantics, AI Feed explains the semantics and Performance treats pushes as settled but excluded from accuracy/Brier scoring.

### Market Outcome Completeness & Performance Consistency V1

Status: Locally implemented and build-verified; production deployment verification pending.

Evidence: `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/mlb-ai-picks-feed.service.ts`, `src/services/performance-scope-v2.service.ts`, `src/services/performance-product-contract.service.ts`, performance API routes, `docs/MARKET_OUTCOME_COMPLETENESS_PERFORMANCE_CONSISTENCY_V1.md` and local production build.

Note: This pass fixes product semantics only. Moneyline, Run Line and Totals expose derived binary outcome completeness from stored selected-side probabilities without changing any model probability. Most Likely ranks the highest-probability outcome, Best Value ranks actionable aligned fresh positive EV/edge, Current Board/AI Feed share the same canonical market/outcome semantics, and Performance surfaces use the same cutoff-safe production scope as Prediction History. Official Pick policy, Learning Brain, settlement, cutoff enforcement, Phase 2A and Historical Replay were not changed.

### Supabase Disk IO Recovery Audit V1

Status: Locally implemented and build-verified; production deployment verification pending.

Evidence: `scripts/database-io-readonly-audit.mjs`, `scripts/retrosheet-feature-backfill.mjs`, `src/services/retrosheet-historical-feature-store.service.ts`, `docs/SUPABASE_DISK_IO_RECOVERY_AUDIT_V1.md`, read-only Supabase REST audit output and local production build.

Note: The audit classifies the Supabase Disk IO warning as a Phase 2A backfill/resume spike amplified by repeated full scoped exact counts over `historical_feature_snapshots`. Future approved Phase 2A write paths now use deterministic-key chunk lookups instead of before/after partition counts, and diagnostics reads Phase 2A counts from completed import registry metadata. Provider calls 0, remote mutations 0, Phase 2A was not rerun, Phase 2B was not started, and retraining/recalibration were not executed. `REPLAY_IO_READINESS_PASS` remains withheld until platform cache/bloat/autovacuum/lock metrics are checked.

### Pregame Execution Recovery & Slate Prewarm V1

Status: Locally implemented and build-verified; production execution/deployment verification pending.

Evidence: `src/services/mlb-operating-date-resolution.service.ts`, `src/services/operating-day.service.ts`, `src/services/pregame-scheduler-coverage.service.ts`, `docs/PREGAME_EXECUTION_RECOVERY_SLATE_PREWARM_V1.md` and local production build.

Note: Provider-backed MLB refresh actions now select the earliest pregame-actionable slate instead of a same-day slate that is already past cutoff. `prepare_next_slate` can prewarm the next calendar date when a future slate is not stored yet, while keeping the existing SportsDataIO prospective-preview path, budget guard, action lock, idempotent upserts and cutoff enforcement. No probabilities, Official Pick policy, Learning Brain weights, settlement outcomes, Current Board policy, Historical Replay or Phase 2A backfill behavior was changed.

### Pregame Scheduler Coverage & Execution Timing V1

Status: Implemented as read-only operational validation; production readiness remains blocked until future scheduler runs prove valid pregame coverage.

Evidence: `src/services/pregame-scheduler-coverage.service.ts`, `/api/recommendation-pipeline/trace`, `/api/performance/history`, Dashboard Today, AI Operations Scheduler Coverage, `docs/PREGAME_SCHEDULER_COVERAGE_EXECUTION_TIMING_V1.md` and local production build.

Note: The existing scheduler architecture remains intact: Vercel daily cron plus GitHub external runtime/heartbeat call the same protected `/api/cron/operating-day` endpoint. This phase exposes timing, next execution, average duration, per-game cutoff margin, rejection reasons, retry policy and duplicate/idempotency evidence. Current stored evidence shows Today 0% valid-pregame coverage and Yesterday 17.65% valid-pregame coverage, so `PRODUCTION_OPERATIONAL_READY` is not certified yet. Provider calls, prediction probabilities, Official Pick policy, Learning Brain weights, settlement outcomes, Current Board policy, Historical Replay and Phase 2A backfill were not changed.

### Existing Prediction Cutoff Classification V1

Status: Persisted, idempotency-verified and build verification pending in this commit.

Evidence: `src/services/prediction-cutoff-enforcement.service.ts`, persisted `prediction_history.settlement_details.cutoff_enforcement_v1` metadata, cutoff `sports_sync_jobs` records, 8 `historical_import_checkpoints`, Performance Scope V2, AI Learning Lifecycle and local validation output.

Note: This phase did not change prediction content, generated timestamps, event timestamps, probabilities, confidence, outcomes, settlement, Learning Brain weights, feature snapshots, Current Board, Official Pick policy, Historical Replay or Historical Feature Backfill Phase 2A. It stamped only the already-diagnosed cutoff classification for 704 excluded rows: 331 `POST_START`, 370 `POST_FINAL` and 3 `INVALID_CUTOFF`. Reruns update 0 rows and skip all 704 already-classified rows.

### Prediction Cutoff Enforcement & Leakage Recovery V1

Status: Code-level enforcement implemented; existing contaminated rows are now persisted with metadata-only classification by Existing Prediction Cutoff Classification V1.

Evidence: `src/services/prediction-cutoff-enforcement.service.ts`, shared `savePredictionHistory` cutoff rejection, MLB prospective-preview cutoff rejection, Settlement/Learning/Performance/Trace read-model guards, Dashboard Today copy and local production build.

Note: The exact root cause was a missing prediction-generation-time cutoff check in the MLB prospective-preview persistence path. Existing odds snapshots were filtered as pregame, but late scheduler retries could reuse those snapshots and persist predictions after each game's cutoff. Future production-eligible rows are rejected before persistence; direct MLB preview rows are rejected before snapshot/prediction upsert. Existing rows are classified in read models and now carry persisted diagnostic-only cutoff metadata. No probabilities, outcomes, settlement, learning weights or recommendation policy fields were changed.

### Daily Prediction Continuity & Learning Closure V1

Status: Locally implemented; build, push and production deployment verification pending.

Evidence: `src/services/recommendation-pipeline-trace.service.ts`, `src/services/performance-scope-v2.service.ts`, `src/services/ai-learning-lifecycle.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `/api/recommendation-pipeline/trace`, `/api/ai-operations/lifecycle` and Dashboard Today.

Note: This pass keeps the daily lifecycle read-only while proving continuity from scheduled games through stored odds, persisted predictions, board classification, settlement labels and learning evidence. Product Performance periods now use canonical event start dates for production-day grouping. The trace reports per-game lifecycle status, miss reasons, coverage percentages and no-leakage checks. Dashboard empty states now show pipeline activity instead of appearing silently empty. Prediction probabilities, Official Pick policy, Learning Brain weights, settlement outcomes, Current Board mutation, Historical Replay, Phase 2A backfill and historical feature snapshots remain unchanged.

### Historical Feature Persistence Certification V1

Status: Single-game persistence certified; complete backfill still blocked pending explicit approval.

Evidence: Existing `scripts/retrosheet-feature-backfill.mjs` worker, selected game `retrosheet:mlb:game:CHN202503180`, persisted 29 `historical_feature_snapshots`, completed `local_game_batch_1` checkpoints, regenerated deterministic-key hash `5fe647ab02c1af600f49703bd0bc9a6e34e2559d88eacc8f665cbcfc326e576f`, AI Operations historical diagnostics and local production build.

Note: This phase proves persistence safety for exactly one historical game. It did not run a batch/season backfill, did not modify prediction probabilities, settlement outcomes, Learning Brain weights, Current Board, Official Pick policy or replay. Rerunning the same one-game scope inserted 0, updated 0 and skipped 29 existing deterministic rows.

### Product Integration & Live State Recovery V1

Status: Locally implemented, build-verified and read-only smoke-validated; production push/deployment verification pending.

Evidence: `src/app/api/performance/history/route.ts`, `src/services/performance-scope-v2.service.ts`, `src/services/dashboard-today.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/DataFreshnessPreviewCard.tsx`, local API smoke against `/api/performance/history`, `/api/dashboard/today`, `/api/operations/data-freshness` and `/api/market-opportunities/most-likely`, plus local production build.

Note: This pass unifies product-facing live state without changing prediction probabilities, Official Pick policy, Learning Brain weights, Current Board policy, settlement outcomes or historical feature-store data. Performance History now uses a compact paginated production-scope read model instead of the full AI Performance Center diagnostic graph. Dashboard Today final games show persisted settlement state, pipeline cards use the Today pipeline contract, freshness cards show real timing metadata and Model Only counts remain informational.

### Local Historical Feature Backfill Worker V1

Status: Worker implemented, dry-run verified and production write blocked by protected review.

Evidence: `scripts/retrosheet-feature-backfill.mjs`, `scripts/local-ts-loader.mjs`, npm `historical:features:*` scripts, exported batch-generation hooks in `src/services/retrosheet-historical-feature-store.service.ts`, AI Operations local backfill diagnostics, `docs/LOCAL_HISTORICAL_FEATURE_BACKFILL_V1.md`, `docs/HISTORICAL_FEATURE_BACKFILL_OPERATIONS.md`, `docs/HISTORICAL_FEATURE_BACKFILL_IDEMPOTENCY.md`, `docs/FEATURE_LABEL_COVERAGE_RECOVERY_V1.md` and full local dry-run output.

Note: The worker runs locally, loads `.env.local`, certifies the production Supabase hostname, reuses the existing Phase 2A engine, writes historical-only/non-training/non-live snapshots when approved, checkpoints each confirmed game batch and supports resume/idempotency modes. Full dry-run verified 2,430 games, 70,470 planned snapshots, 0 leakage failures and 0 deterministic key collisions. The first full write was rejected by protected approval review, so persistence/idempotency/resume execution remains blocked and was not worked around.

### Daily Settlement Closure & Learning Evidence Activation V1

Status: Implemented locally; protected production execution and deployment validation pending in this phase.

Evidence: `src/services/settlement-reconciliation.service.ts`, `src/services/retrosheet-historical-feature-store.service.ts`, `src/services/ai-learning-lifecycle.service.ts`, `/api/ai-operations/lifecycle`, `/ai-operations`, and docs for daily closure, evidence activation, feature-label contract, shadow validation and scheduler status.

Note: V1 repairs the proven settlement root cause where policy-skipped model rows were misclassified as test/fixture data. It keeps post-start rows ignored, protects settled/void/closed rows, and accepts feature/label samples only when point-in-time feature evidence exists. Production weight activation is blocked until accepted sample size and shadow validation gates pass.

### AI Learning Pipeline Validation & Autonomous Daily Lifecycle V1

Status: Locally implemented and build-verified; production push/deployment verification pending.

Evidence: `src/services/ai-learning-lifecycle.service.ts`, `/api/ai-operations/lifecycle`, `/ai-operations`, `docs/AI_OPERATIONS_CENTER.md`, `docs/AI_LEARNING_PIPELINE.md`, `docs/AUTONOMOUS_DAILY_LIFECYCLE.md` and local production build.

Note: V1 proves the autonomous AI lifecycle from persisted data only. It exposes Today, Yesterday and Last 7 Days lifecycle counts, deterministic label readiness, a derived learning queue, replay/projection evidence, calibration evidence, persisted weight-update evidence, provider budget health and scheduler metadata. It does not execute provider calls, settlement, replay, Learning Brain updates, Prediction Engine changes, Official Pick policy changes or Current Board mutations.

### Performance Product Mode & Recommendation Pipeline Verification V1

Status: Locally implemented and build-verified; production push/deployment verification pending.

Evidence: `src/services/ai-performance-center.service.ts`, `src/services/performance-scope-v2.service.ts`, `/api/performance/history`, `src/components/performance/PerformanceProductClient.tsx`, `src/services/model-only-intelligence.service.ts`, `src/services/market-opportunity-suite.service.ts`, `/api/recommendation-pipeline/trace`, `docs/PERFORMANCE_PRODUCT_MODE_V1.md`, `docs/RECOMMENDATION_PIPELINE_TRACE_V1.md` and local production build.

Note: Product Performance now defaults to production-evaluable Win/Loss/Push rows only and moves Legacy, Ignored, Historical/Replay, Shadow and other lifecycle-audit counts into Advanced diagnostics. Zero settled samples display `N/A`, not false `0%`. Most Likely remains informational when using model-only fallback; Best Value and Official Picks keep all existing safety gates. No Prediction Engine, Learning Brain, settlement outcome, Current Board policy, market-pipeline or Historical Replay behavior was changed.

### Webpack Dependency Graph Audit & Build OOM Recovery V2

Status: Locally implemented and build-verified; Vercel deployment readiness pending push/deployment observation.

Evidence: `src/lib/server-lazy-diagnostics.ts`, direct basketball service imports in API/BSN paths, lazy diagnostic route boundaries across SportsDataIO NBA readiness, AI Performance Center, historical import readiness, autonomous operations, adaptive refresh, runtime observability and MLB operations routes, `docs/WEBPACK_DEPENDENCY_GRAPH_AUDIT_V2.md`, `docs/BUILD_OOM_ROOT_CAUSE_V2.md` and local production build.

Note: V2 addresses the webpack compilation graph directly rather than relying only on heap. It preserves all routes and diagnostics while reducing repeated top-level imports of large server services. After Vercel reported repeated webpack optimization OOM failures, `webpackBuildWorker` and server-side webpack minimization were disabled while client optimization and the other memory controls remain enabled. No Prediction Engine, Learning Brain, Current Board, Official Pick, market, replay, settlement or historical feature-store behavior was changed.

### Build Memory Optimization & Deployment Recovery V1

Status: Locally implemented and build-verified; production push/deployment validation pending approval.

Evidence: `next.config.ts`, dynamic/lazy server boundaries in `/admin/historical-diagnostics`, `/mlb-operations`, `/api/historical-import/execute`, `/api/historical-import/plan`, `/api/operations/validation`, `/api/cron/operating-day`, `docs/BUILD_MEMORY_OPTIMIZATION_DEPLOYMENT_RECOVERY_V1.md` and local production build.

Note: This pass targets Vercel out-of-memory failures without removing features. It lowers build peak memory through Next Webpack memory controls, reduced static-generation concurrency, request-time rendering for heavy admin pages and branch-specific runtime imports for historical/operations service graphs. Historical Intelligence, Settlement V2, Feature Store, replay preparation, Prediction Engine, Learning Brain, Current Board and Official Pick policy remain available and unchanged.

### Production Regression Audit & UX Recovery V1

Status: Locally implemented and build-verified; production deployment pending approval.

Evidence: `src/services/market-opportunity-suite.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `src/services/ai-performance-center.service.ts`, `docs/PRODUCTION_REGRESSION_AUDIT_V1.md`, `docs/UX_RECOVERY_V1.md`.

Note: This pass restores production-facing clarity after Settlement V2 without changing Prediction Engine probabilities, Learning Brain logic, Official Pick policy, Current Board eligibility, market pipelines or provider behavior. Most Likely now shows stored model-only probabilities as informational rows when safe current market rows are unavailable. Best Value remains odds/positive-EV gated. Production trust now excludes V2 Legacy, Ignored, Historical, Replay and Shadow rows while keeping them audit-visible.

### Settlement & Historical Reconciliation Engine V2

Status: Implemented, production-executed and build-verified; deployment/push verification pending this controlled execution commit.

Evidence: `src/services/settlement-reconciliation.service.ts`, `/api/settlement/reconciliation`, `src/services/performance-scope-v2.service.ts`, `src/services/ai-performance-center.service.ts`, `src/components/performance/PerformanceProductClient.tsx`, `docs/SETTLEMENT_RECONCILIATION_ENGINE_V2.md`, `docs/PREDICTION_LIFECYCLE_V2.md` and local production build.

Note: V2 replaces ambiguous Pending handling with deterministic lifecycle classification and protected idempotent execution modes. It uses only existing persisted prediction and event/result data, reuses Settlement Core V2 for grading, records reason/source/timestamp/game/event/version/confidence metadata, updates performance/timeline/history display semantics, and keeps provider calls at 0. Controlled production execution classified all 707 V2 non-terminal rows as 342 Legacy and 365 Ignored, leaving 0 pending-like rows. No unresolved row had deterministic persisted-score Win/Loss/Push eligibility. Phase 2A feature snapshots, Prediction Engine, Learning Brain, Current Board, Official Picks, market pipelines and replay generation were not modified.

### MLB Historical Intelligence Phase 2A - Retrosheet Historical Feature Store Core V1

Status: Implemented, build-verified and full-season DRY_RUN verified; full-season historical feature import remains blocked until the protected production write receives explicit approval that passes review.

Evidence: `src/services/retrosheet-historical-feature-store.service.ts`, `/api/mlb/historical-intelligence/retrosheet/features`, `/admin/historical-diagnostics`, Operations Validation, `docs/RETROSHEET_HISTORICAL_FEATURE_STORE_PHASE_2A.md` and local production build.

Note: Phase 2A creates the durable point-in-time historical feature-store contract over persisted 2025 Retrosheet tables. It defines 80 READY features across Teams, Pitchers, Bullpen, Batters, Lineups, Park Factors, Umpires and Game State; stores deterministic historical-only snapshots in `historical_feature_snapshots`; and marks all rows non-production, non-training and non-live-prediction eligible. Completion-control DRY_RUN verified 2,430 games, 70,470 planned snapshots, duplicate deterministic keys 0 and provider calls 0. Prediction Engine, Learning Brain, Current Board, Official Picks, markets, settlement and live Performance remain untouched. The cron-secret full import/idempotency execution was blocked by approval review and was not worked around.

### MLB Historical Intelligence Phase 1.5 - Historical Coverage Intelligence Audit

Status: Complete as read-only documentation audit.

Evidence: `docs/RETROSHEET_HISTORICAL_COVERAGE_INTELLIGENCE_PHASE_1_5.md`, production aggregate coverage checks against the 11 historical tables, `docs/PROJECT_STATUS.md`.

Note: Phase 1.5 catalogs 93 candidate analytical features from the imported 2025 Retrosheet historical database: 57 READY, 24 PARTIAL, 7 BLOCKED and 5 FUTURE. The audit prioritizes pitcher workload/form, bullpen workload/effectiveness, team rolling offense/pitching, park factors, umpire K/BB tendency, base-out/game-state context and lineup continuity. It intentionally does not implement prediction features, Learning Brain inputs, model training datasets, historical replay, player props, bullpen engine, matchup engine or production behavior changes.

### Retrosheet Production Connection Recovery And Controlled 2025 Import

Status: Production historical import certified complete. Certifications: `RETROSHEET_PRODUCTION_CONNECTION_PASS`, `RETROSHEET_MIGRATIONS_PASS`, `RETROSHEET_2025_CONTROLLED_IMPORT_PASS`, `RETROSHEET_IMPORT_IDEMPOTENCY_PASS`, `RETROSHEET_IMPORT_RESUME_PASS`, `RETROSHEET_PRODUCTION_ISOLATION_PASS`, `RETROSHEET_DATA_QUALITY_PASS`, `RETROSHEET_DATABASE_FOUNDATION_PASS`.

Evidence: `src/services/retrosheet-controlled-import.service.ts`, protected `/api/mlb/historical-intelligence/retrosheet/import`, Retrosheet diagnostics services, `historical_*` production table counts, local sanitized connection/isolation probes and `docs/PROJECT_STATUS.md`.

Note: The production admin connection was certified against `ynuocvexviorgdjrfthw.supabase.co` with service-role credentials before any import writes. The 2025 Retrosheet import persisted only historical tables and remained isolated from live performance, Current Board, Official Picks, Learning Brain and market-pipeline paths. First and second imports produced stable deterministic counts: 399,497 raw records, 2,430 games, 76,135 lineups, 27,535 substitutions, 216,845 plays, 20,870 pitcher appearances and 189,311 batter appearances. Phase 1.5 requires explicit approval and should not begin automatically.

### MLB Historical Intelligence Phase 1B - Baseball Game Reconstruction Engine

Status: Implemented and used by the certified Retrosheet controlled import.

Evidence: `src/services/retrosheet-game-reconstruction.service.ts`, `/api/mlb/historical-intelligence/retrosheet/game-engine`, `/admin/historical-diagnostics`, additive migration `202607220003_retrosheet_game_engine_v1.sql`, Operations Validation and game-engine documentation.

Note: This phase turns Retrosheet event records into canonical baseball game objects with lineups, substitutions, game state, plays, historical starters, pitcher appearances, batter appearances, validation and source lineage. It intentionally does not create historical features, Learning Brain inputs, predictions, backtests, player props, bullpen/matchup intelligence or Statcast integration.

### MLB Historical Intelligence Phase 1A - Historical Data Lake Core

Status: Implemented locally; production migration/application and real import writes require explicit future approval.

Evidence: `src/services/retrosheet-historical-data-lake.service.ts`, `/api/mlb/historical-intelligence/retrosheet`, additive migration `202607220002_historical_data_lake_core_v1.sql`, Operations Validation and `.gitignore` raw-data safety.

Note: This phase creates the Retrosheet ingestion foundation only: source inventory, import registry contract, raw data lake contract, streaming parser, canonical team mapping foundation, player/event identity foundations, checkpoints, idempotency and diagnostics. It intentionally does not calculate baseball intelligence, historical features, Learning Brain inputs, projections, replay or model-training datasets.

### Prediction Quality, Calibration & UX Audit V1

Status: Locally implemented; production deployment and read-only smoke pending.

Evidence: `src/services/market-opportunity-suite.service.ts`, `src/services/market-intelligence-category.service.ts`, `src/services/recommendation-explanation.service.ts`, `src/services/mlb-projected-score.service.ts`, `/api/mlb/projected-scores`, Today dashboard panels, market-opportunity tools, Operations Validation and local production build.

Note: This pass fixes user-facing semantics without changing the predictive model. Most Likely now ranks binary outcome probability and explicitly labels complement-derived outcomes. Recommendation categories now separate Model Only and Pass from true Avoid, preserving Official Pick, EV, Kelly and edge policy. Projected scores are approximate stored-data orientation only and do not create recommendations or mutate prediction history.

### Market Intelligence Recovery V1

Status: Locally implemented; production deployment and live one-call certification pending.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/operating-day.service.ts`, `src/services/current-board.service.ts`, `src/services/mlb-market-pipeline-diagnostics.service.ts`, `/api/mlb/market-pipeline/diagnostics`, Operations Validation and local production build.

Note: The repair restores the MLB odds -> snapshots -> predictions path when a valid stored slate lacks prospective-preview metadata, while keeping final refresh pregame-gated and capped to one SportsDataIO odds call. Current Board slate scoping now uses the Puerto Rico MLB operating date so late-night same-slate games remain visible. Real operating-day odds refresh actions now check provider budget accounting and action locks before external execution. No recommendation policy, Official Pick thresholds, unsupported-market activation, settlement or prediction-promotion behavior was loosened.

### End-to-End Prediction Lifecycle Recovery V1

Status: Production partial recovery implemented and deployed.

Evidence: `src/services/model-only-intelligence.service.ts`, `src/services/performance-scope-v2.service.ts`, Most Likely fallback, Dashboard Today model-intelligence sections, informational model-only parlays, result-sync persistence repair, Operations Validation, additive projection-history schema migration and recovery docs.

Note: This recovery restores model probability visibility without loosening betting safety. Best Value still requires market odds, Official Picks still require policy eligibility, and pitcher-outs remain SHADOW / NO_MARKET. Production schema alignment is verified. A controlled MLB Stats API result sync repaired recent stale final event scores, then settlement reconciliation executed with zero prediction mutations because pending rows remain legacy, test/fixture or post-start excluded rather than deterministic production-scoped candidates.

### Missing Canonical Events Recovery V1

Status: Blocked after production-safe implementation and audit. Certification: `MISSING_CANONICAL_EVENTS_RECOVERY_BLOCKED`.

Evidence: `src/services/missing-canonical-events-recovery.service.ts`, `/api/events/recovery/missing-canonical`, `savePredictionHistory` event identity prevention gate, Operations Validation and recovery docs.

Note: The recovery audit proved the 342 eventless predictions cannot be repaired from stored evidence: 0 linked odds snapshots, 0 matching stored odds event rows, 0 result rows, 0 source lineage rows and 0/342 exact canonical team coverage. No provider calls or mutations were made. Future production-eligible prediction persistence now requires canonical `sport_events` identity and downgrades eventless rows with `EVENT_IDENTITY_REQUIRED`.

### Universal Event Identity V1

Status: Locally implemented and production-audited. Certification: `UNIVERSAL_EVENT_IDENTITY_V1_PARTIAL`.

Evidence: `src/services/universal-event-identity.service.ts`, `/api/events/identity/audit`, `/api/events/identity/unresolved`, `/api/events/identity/conflicts`, `/api/events/[eventId]/identity`, Operations Validation and event-identity docs.

Note: The resolver keeps `sport_events.id` as canonical and audits exact provider mappings, canonical provider IDs, odds event IDs, result event IDs, stat event IDs and stable multi-field evidence without provider calls. Production audit classified all 342 settlement missing-link rows as `EVENT_NOT_IMPORTED`; no deterministic event links or provider mappings were safe to repair, so settlement and performance remained unchanged. Remaining rows require imported canonical events or exact source mappings before settlement can advance.

### Settlement Reconciliation + AI Sports Analyst V2

Status: Implemented locally. Certification: `PICK_ANALYZER_SETTLEMENT_ANALYST_PARTIAL` pending production deployment and live smoke.

Evidence: `src/services/settlement-reconciliation.service.ts`, `src/app/api/settlement/reconciliation/route.ts`, `src/services/sports-analyst.service.ts`, `src/app/api/sports-analyst/game/[eventId]/route.ts`, `src/services/player-intelligence.service.ts`, `src/app/api/players/[playerId]/intelligence/route.ts`, Operations Validation and docs.

Note: The settlement audit is deterministic and dry-run first. Current production evidence found no safe settlement writes: pending-like rows are non-production/test-like, missing exact event mapping or post-start. Analyst V2 is a grounded explanation layer over existing stored evidence and does not change prediction probabilities, recommendation policy, Current Board generation, provider calls, settlement engines or official-pick activation.

### Sports Intelligence UI Integrity Refactor V1

Status: Implemented locally. Certification: `SPORTS_INTELLIGENCE_UI_REFACTOR_PARTIAL` pending production deployment and live smoke.

Evidence: `src/services/market-alignment.service.ts`, `src/services/market-intelligence-category.service.ts`, `src/services/game-intelligence.service.ts`, `src/app/api/games/[eventId]/intelligence/route.ts`, market-opportunity UI clients, Performance clients, Operations Validation and docs.

Note: This pass unifies user-facing market state metadata, separates snapshot EV from actionable EV, prevents material negative-value rows from becoming Watchlist, removes hardcoded wrong-team explanation fallbacks, makes AI Bet Finder focused queries return top 3 deterministic answers, exposes projection safety blockers, clarifies Arbitrage alerts as future infrastructure and adds a stored-data-only Game Intelligence API foundation. No provider calls, remote mutations, migrations, Official Pick policy changes, prediction formula changes, Current Board generation changes, scheduler changes, settlement changes or unsupported-market activation were made. Stale pending settlement reconciliation remains a separate deterministic data-operation phase.

### MLB Player Data Excellence And Pitcher Outs Readiness V1

Status: Partially complete with provider/data caveats. Certification: `MLB_DATA_EXCELLENCE_PITCHER_OUTS_PARTIAL`.

Evidence: `src/services/mlb-player-data-excellence.service.ts`, `src/app/api/mlb/player-data-excellence/route.ts`, `src/services/mlb-projection-integrity.service.ts`, `src/services/mlb-unresolved-player-identity.service.ts`, `src/app/api/operations/validation/route.ts`, `docs/mlb-player-catalog-completion.md`, `docs/mlb-pitcher-recorded-outs-model.md` and `docs/mlb-player-prop-readiness.md`.

Note: Exact provider-scoped identity reconciliation improved MLB 2026 player-game-stat identity coverage from 71.20% to 99.44%, leaving 250 rows across 25 provider IDs classified as `PROVIDER_METADATA_NOT_IMPORTED`. Pitcher recorded-outs conversion now treats baseball innings notation correctly and prefers direct outs when supplied. The pitcher-outs model contract remains SHADOW / NO_MARKET with 0 eligible leakage-safe pregame projection sample and no player-prop odds.

### MLB Automatic Player Discovery V1

Status: Production certified. Certification: `MLB_AUTO_PLAYER_DISCOVERY_PASS`.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `src/services/mlb-unresolved-player-identity.service.ts`, `src/app/api/mlb/players/unresolved-identities/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/mlb-auto-player-discovery.md`.

Note: SportsDataIO MLB player-stat imports now create or reuse provisional unresolved identities through existing `provider_entity_mappings` with `entity_type='unresolved_player'`, keeping trusted canonical mappings isolated under `entity_type='player'`. The workflow preserves provider player ID, provider name, team ID, source date, source stat ID and review status, marks records non-production/review-required, and never assigns a trusted `sport_players.id` from fuzzy name matching. Production smoke on commit `7f4969976785f3e5d9a2ad9f39a0b9b067d65672` passed Operations Validation with unresolved-identity fixtures 16/16, providerCallsMade 0 and remoteMutationsMade 0. Protected stored-data reconciliation created/reused provisional records including provider player `10003762` and applied exact existing mappings only; budget remained 8 calls today.

### MLB Current-Season Player Game Stats Backfill Orchestrator V1

Status: Production certified. Certification: `MLB_CURRENT_SEASON_BACKFILL_PASS`.

Evidence: `src/services/mlb-current-season-backfill-orchestrator.service.ts`, `src/app/api/mlb/historical-backfill/player-game-stats/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/mlb-current-season-backfill.md`.

Note: The orchestrator reuses the existing SportsDataIO MLB historical import executor for each `PlayerGameStatsByDate` child unit, preserving durable running checkpoints, provider-call accounting, one-call-per-date execution, 60-second timeout, idempotency keys and terminal checkpoint handling. It plans from stored eligible completed 2026 MLB events, skips completed checkpoints, refuses active/ambiguous jobs, caps batch size by provider budget configuration and records a parent `sports_sync_jobs` invocation. Production commit `0c7fa3d3fb6d6701dac7dfe307d72208c1a8d623` passed read-only smoke with 110 eligible dates, 113 completed checkpoints, 0 remaining dates, 0 active jobs, 0 ambiguous checkpoints, budget AVAILABLE/VALID and providerCallsMade 0. No live batch was executed because the season backfill planner reported complete.

### MLB Current-Season Data Quality Audit V1

Status: Production certified. Certification: `MLB_CURRENT_SEASON_DATA_QUALITY_PASS`.

Evidence: `src/services/mlb-current-season-data-quality-audit.service.ts`, `src/app/api/mlb/current-season/data-quality/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/mlb-data-quality-certification.md`.

Note: The audit reads stored 2026 MLB data only and reports transparent season-level quality metrics for teams, players, events, results, standings, team stats, player game stats, odds snapshots, predictions, settlements, feature snapshots, provider mappings, historical jobs and checkpoint coverage. Production commit `cf7075126f656f723b6f73bda6553966efb8fa0e` passed read-only smoke with providerCallsMade 0, remoteMutationsMade 0, validation 8/8, backfill complete, 44,459 player game stat rows, 0 missing dates, 0 duplicate stat row IDs, 100% event/team mapping, 46,002 odds rows and overall readiness 79.64/GOOD. Caveats remain for no genuine opening/closing odds rows, unresolved reviewable player identities and 244 natural-key collision candidates before high-confidence player-level production features.

### MLB Feature Store And Model Input Readiness V1

Status: Production certified. Certification: `MLB_FEATURE_MODEL_READINESS_PASS`.

Evidence: `src/services/mlb-feature-model-readiness.service.ts`, `src/app/api/mlb/features/model-readiness/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/mlb-feature-model-readiness.md`.

Note: The readiness audit composes existing MLB Feature Store integration with current-season data-quality evidence and classifies active, partial, blocked and unsafe model inputs without changing prediction generation. Production commit `38ba24e8861414cbd3e433ac0f3bdcfbae3e31bd` passed read-only smoke with status `PASS_WITH_CAVEATS`, validation 10/10, providerCallsMade 0, remoteMutationsMade 0, Feature Store ready, 50 compatible prediction snapshots, 0 duplicate stat row IDs and 100% event/team mapping. It blocks CLV/line movement without genuine open/close odds and keeps confirmed lineups, injuries, weather, advanced pitch tracking and props unavailable unless supported by real stored data.

### MLB Backtesting, Calibration And Model Audit V1

Status: Production certified. Certification: `MLB_MODEL_AUDIT_PASS_INSUFFICIENT_SAMPLE`.

Evidence: `src/services/mlb-model-audit.service.ts`, `src/app/api/mlb/model-audit/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/mlb-model-audit.md`.

Note: The audit reads stored MLB prediction history only, excludes post-start predictions and rows without immutable feature snapshots, reports backtest/calibration metrics and keeps threshold, Official Pick, Current Board, settlement and scheduler behavior unchanged. Production commit `c9534afa275743a071bff0f9a2f92e12326a7c01` passed read-only smoke with 909 prediction rows, 593 settled rows, 0 leakage-safe immutable-snapshot eligible rows, 561 post-start settled rows excluded, 548 settled rows missing immutable feature snapshots excluded and validation 8/8. It reports insufficient sample honestly rather than forcing recalibration or historical threshold tuning.

### MLB Core Final Certification V1

Status: Complete. Certification: `MLB_CORE_PRODUCTION_PASS`.

Premium classification: `MLB_PREMIUM_PROVIDER_BLOCKED`.

Evidence: `docs/mlb-core-final-certification.md`, production `/api/operations/validation`, `/api/providers/budget/status`, `/api/historical-import/jobs` and the MLB Phase 1-5 certification routes.

Note: MLB Core is formally closed as production ready with premium/provider-dependent features separated rather than counted as core gaps. Final production smoke reported Operations Validation PASS, provider budget AVAILABLE/VALID, accounting uncertainty false, providerCallsMade 0, remoteMutationsMade 0 and historical jobs 0 running/0 pending/0 stuck/0 reconciliationRequired. Next roadmap phase is BSN Source Inventory and Contract.

### SportsDataIO PlayerGameStatsByDate Endpoint Optimization V1

Status: Endpoint timeout root cause diagnosed locally. Certification: OPTIMIZED. Historical import remains stopped until explicitly resumed.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts` and `docs/SPORTSDATAIO_PLAYER_GAME_STATS_ENDPOINT_OPTIMIZATION.md`.

Note: One direct read-only diagnostic call to `PlayerGameStatsByDate/2026-JUL-17` returned HTTP 200 with 418 rows, 646,490 decoded bytes, 1093 ms to headers, 1121 ms to first byte, 13,945 ms body download, 15,041 ms total response and 142 ms JSON parse time. No rate-limit or retry-after header was present. Root cause is client-side timeout margin, not entitlement, server failure, rate limiting or JSON parsing. The only code change was raising the MLB Discovery historical transport default timeout from 15 seconds to 60 seconds. No import/backfill retry was run.

### SportsDataIO MLB Data Maximization Budget Fix And Controlled Extraction V1

Status: Budget fix implemented and validated locally. Certification: BLOCKED. Full extraction is stopped by a real pilot timeout.

Evidence: `src/services/provider-budget.service.ts`, `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `docs/SPORTSDATAIO_MLB_DATA_MAXIMIZATION_BUDGET_FIX_AND_CONTROLLED_EXTRACTION.md` and `sports_sync_jobs` pilot evidence.

Note: Read-only provider budget status no longer returns HTTP 500 when lifecycle accounting is unavailable; it degrades with typed warnings, uses safe defaults, reports malformed numeric config, treats missing usage as zero, and makes zero provider calls. Live MLB historical import now checks the shared budget guard and blocks immediate retry after recent failed/partial/running checkpoints. Network-enabled local validation returned accounting `AVAILABLE`, configuration `VALID`, 5 calls today, 0 last hour and validation 14/14. The controlled pilot for `PlayerGameStatsByDate/2026-JUL-17` consumed 1 call and timed out with 0 rows. The immediate rerun consumed 1 more call under old behavior, so retry-cooldown hardening was added; post-fix retry verification did not increase provider usage. Do not run full current-season backfill until the timeout is resolved.

### SportsDataIO Entitlement Discovery And Safe Extraction V1

Status: Read-only entitlement discovery completed locally. Certification: PARTIAL. New extraction remains deferred until exact full entitlement and historical budget scope are approved.

Evidence: `src/services/sportsdataio-subscription-maximization-audit.service.ts`, `src/app/api/providers/sportsdataio/maximization-audit/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/SPORTSDATAIO_ENTITLEMENT_DISCOVERY_AND_SAFE_EXTRACTION.md`.

Note: The safe discovery pass made exactly 10 external SportsDataIO calls and 0 remote mutations, with no secret exposure. Representative entitlement was verified for MLB metadata/current season, teams, GamesByDate schedule/results/starters/weather, standings, players, player game stats endpoint access, team season stats, GameOddsByDate odds, NBA teams and NBA injuries. The audit now adds entitlement status, probe evidence and historical extraction policy to each cataloged endpoint. Extraction did not run because 117 cataloged endpoints remain unprobed under the approved cap, no account entitlement export is available, local provider budget precheck returned HTTP 500, and historical depth was not proven beyond current-season/single-date probes. Utilization remains 14.2%. BSN was not started.

### SportsDataIO Subscription Maximization Audit V1

Status: Read-only audit implemented locally. Certification: PARTIAL. New ingestion is deferred until exact subscription entitlement and rate-limit evidence are available.

Evidence: `src/services/sportsdataio-subscription-maximization-audit.service.ts`, `src/app/api/providers/sportsdataio/maximization-audit/route.ts`, `src/app/api/operations/validation/route.ts`, `src/config/sportsdataio-endpoint-catalog.ts` and `docs/SPORTSDATAIO_SUBSCRIPTION_MAXIMIZATION_AUDIT.md`.

Note: The audit composes the current endpoint catalog, runtime adapter evidence, server-only env key-name checks, provider budget summary and stored table counts. Local smoke reports 127 cataloged endpoints, 7 USED, 22 PARTIALLY_USED, 98 NOT_USED and estimated weighted utilization of 14.2%. It identifies Critical/High ROI domains but does not start new ingestion because repository evidence cannot prove the exact purchased SportsDataIO plan, full endpoint entitlement matrix or per-key rate limits. Provider calls 0, remote mutations 0, build passed, and no prediction, recommendation, Current Board, settlement, scheduler, dashboard or provider-refresh behavior changed.

### BSN Foundation V1 Continuation

Status: Phase A source audit completed locally. Certification: PARTIAL. Stop gate reached before data-lake, scheduler, shadow-governance, settlement-foundation or UI expansion.

Evidence: `docs/BSN_FOUNDATION_V1_CERTIFICATION.md`, `src/services/basketball-source-framework.service.ts`, `src/services/basketball/connectors/official-bsn-homepage.connector.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts`, `src/services/bsn-platform.service.ts`, `docs/bsn-integration-v1.md`, `docs/bsn-source-framework-v1.md` and `docs/bsn-data-acquisition-strategy.md`.

Note: The audit confirmed the current BSN stack has a reusable foundation, but no permissioned production BSN API/feed is configured. Official public HTML remains suitable only for discovery and limited foundation snapshots unless written authorization is obtained. CSV/manual paths are validation-first and write/audit blocked. Verified BSN odds and approved boxscore/game-stat coverage remain unavailable. Provider calls 0, remote mutations 0, and no prediction, recommendation, Current Board, settlement, scheduler or provider logic changed. NBA has not started.

### BSN Source Inventory And Contract V1

Status: Complete. Certification: `BSN_SOURCE_INVENTORY_PASS`.

Evidence: `docs/bsn-data-source-inventory.md`, `src/services/basketball-source-framework.service.ts`, `src/services/bsn-platform.service.ts`, `/api/bsn/sources`, `/api/bsn/source-quality`, `/api/bsn/sources/validate`, `/api/bsn/capabilities` and `/api/bsn/operations/readiness`.

Note: The source inventory classifies official BSN web/app evidence, bounded homepage discovery, permissioned API/feed, operator-owned CSV, audited manual entry, future licensed providers and third-party public score sites. Production smoke confirmed source/capability/readiness routes are live with providerCallsMade 0. Odds, box scores, quarter scores and availability remain blocked or unavailable until legitimate approved sources exist.

### BSN Foundation Phase 8

Status: Blocked. Certification: `BSN_FOUNDATION_BLOCKED_SOURCE_APPROVAL_REQUIRED`.

Evidence: `docs/bsn-foundation.md`, `docs/bsn-data-source-inventory.md`, `/api/bsn/sources`, `/api/bsn/capabilities`, `/api/bsn/operations/readiness` and `/api/bsn/sources/validate`.

Note: The reusable BSN foundation architecture exists, but production ingestion expansion cannot proceed without a permissioned BSN API/feed, approved official automation agreement, attested operator-owned CSV/manual source with write audit approval, or licensed provider with verified BSN coverage. Source routes correctly report `source_approval_required` and `prepared_provider_blocked` with providerCallsMade 0.

### BSN Wave 2 Core Certification V1

Status: Implemented locally. Certification: PARTIAL. Stop gate reached at Phase 2; BSN Core completion cannot continue until verified BSN odds/stat/source gaps are resolved.

Evidence: `src/services/bsn-core-certification.service.ts`, `src/app/api/bsn/core-certification/route.ts`, `src/app/api/operations/validation/route.ts`, existing BSN data quality, Current Board readiness, operations readiness, intelligence validation, shadow prediction validation, model maturity, backtesting and calibration routes.

Note: Wave 2 reused the existing Sports Brain instead of recreating MLB. Phase 1 reuse certification passed for Prediction SDK, market alignment, recommendation explanations, Official Pick Experience and AI Feed. Local smoke confirmed `/api/bsn/core-certification?includeValidation=true` returns `BSN_CORE_PARTIAL`, `stop=true`, provider calls 0 and remote mutations 0. The required Phase 2 stop gate is caused by missing verified BSN odds, missing BSN game statistics, required approved BSN source ingestion, insufficient V7 shadow/calibration samples for production activation, and moneyline/spread/totals blocked by no verified odds. Existing BSN shadow backtesting remains available with 38 graded games, 28 correct, 10 incorrect, 73.68% accuracy and 0.21 Brier score. No prediction engine, Current Board, dashboard, recommendation, explanation, settlement, scheduler, provider budget, health, backtesting, calibration, risk or Kelly service was duplicated. NBA has not started.

### MLB Phase 6 Player Props Data Foundation V1

Status: Foundation implemented locally. Certification: BLOCKED. Phase 7 must not start.

Evidence: `src/services/mlb-player-props-foundation.service.ts`, `src/app/api/mlb/player-props/foundation/route.ts`, `src/app/api/operations/validation/route.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/config/sportsdataio-endpoint-catalog.ts` and `supabase/migrations/202607130002_sport_player_stats_v1.sql`.

Note: Phase 6 adds a provider-independent `mlb_player_props_foundation_v1` readiness contract and read-only API. It catalogs pitcher strikeouts, outs recorded, earned runs, hits allowed, walks allowed, pitches thrown, batter hits, total bases, runs, RBI, home runs, walks and strikeouts. It defines canonical player, provider mapping, participation, historical player game log, prop odds, result/settlement, feature, data-quality, lineage and import-checkpoint contracts using existing storage where possible. Local audit found stored MLB player identity and stats coverage but zero stored player prop odds. Phase 7 is blocked by unconfirmed MLB player prop odds endpoint entitlement, no stored player prop odds snapshots and missing player-prop settlement rules. Local validation passed 11/11, provider calls 0, remote mutations 0 and build passed. No migration was applied. Prediction formulas, recommendation policy, categories, ranking, Official thresholds, provider integrations, settlement and learning remain unchanged.

### MLB Phase 5 AI Picks Feed V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/mlb-ai-picks-feed.service.ts`, `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `src/app/api/operations/validation/route.ts` and `src/components/dashboard/UserTodayPanel.tsx`.

Note: Phase 5 adds an additive read-only `mlb_ai_picks_feed_v1` contract that derives feed items from existing Current Board candidates and preserves `official_pick_v1`, `market_alignment_v1`, `recommendation_explanation_v1` and selected odds lineage. Official Pick and Best Bet Today labels require an existing official contract; informational feed items remain labeled Most Likely, Best Value, Watch Closely, Hidden Value, Avoid, Data Risk or Market Update. Local validation passed 13 AI Picks Feed checks, `/api/current-board?includeValidation=true` returned 23 feed items from 12 candidates, and `/api/dashboard/today?includeValidation=true` exposed the feed section with provider calls 0 and remote mutations 0. Prediction formulas, category assignment, ranking, Official thresholds, recommendation policy, provider integrations, settlement, learning and unsupported markets remain unchanged. Phase 6 has not started.

### MLB Phase 4 Official Pick Experience V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/official-pick-experience.service.ts`, `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `src/app/api/operations/validation/route.ts` and `src/components/dashboard/UserTodayPanel.tsx`.

Note: Phase 4 adds an additive `official_pick_v1` presentation contract and `official_pick_experience_v1` Today/Current Board section using only existing Current Board, odds lineage, market alignment, recommendation explanation and recommendation-policy evidence. The dashboard now shows a premium Official Pick card when policy-qualified picks exist and a truthful empty state when zero Official Picks exist, while keeping Top AI Opportunity informational. Local validation passed 14 official-pick checks plus read-only Current Board/Today smoke with provider calls 0 and remote mutations 0. Official thresholds, category assignment, ranking, model formulas, recommendation policy, provider integrations, settlement and learning remain unchanged.

### Phase 3 Actionable Recommendation Explanations V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/recommendation-explanation.service.ts`, `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/app/api/operations/validation/route.ts` and `src/components/dashboard/UserTodayPanel.tsx`.

Note: Phase 3 adds a deterministic `recommendation_explanation_v1` contract shared by Current Board, Today/Top AI Opportunity and market insight rows. Explanations are grounded only in existing market alignment, probability, edge, EV, freshness, confidence, risk, feature/data sufficiency and blocker evidence. Operations Validation now includes 24 explanation fixture checks including stale/fresh, positive/negative/zero value, missing price/probability, line/selection mismatch, unaligned markets, Official threshold blockers, reason deduplication, blocker/reason priority, fair-odds labeling and fair-odds conversion. This phase does not change prediction formulas, category assignment, Official Pick thresholds, recommendation policy, Current Board ranking, market alignment formulas, provider integrations, settlement, learning or unsupported markets. Phase 4 has not started.

### Phase 2 Market Intelligence: Aligned Edge And Expected Value V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/market-alignment.service.ts`, `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/dashboard-today.service.ts`, `src/components/dashboard/UserTodayPanel.tsx` and `/api/operations/validation`.

Note: Phase 2 adds an auditable `market_alignment_v1` contract for exact model-versus-market comparison. Current Board candidates now expose alignment status, selected odds snapshot ID, sportsbook, model probability, implied probability, edge in percentage points, expected value percent, selected market freshness, provider/source timestamp, ingestion timestamp and risk. Best Value excludes unaligned, missing-price, missing-probability and stale market inputs. User Mode displays aligned probability, implied probability, edge, EV, confidence, risk and market age without changing prediction formulas, recommendation categories, Official Pick thresholds, Current Board generation policy, settlement, learning or supported markets. Phase 3 has not started.

### MLB Odds Freshness Timestamp Certification V1

Status: Implemented locally before Phase 2. Production deployment and post-deploy read-only smoke remain required.

Evidence: `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/operations-health.service.ts`, `src/services/dashboard-today.service.ts`, `src/components/dashboard/UserTodayPanel.tsx` and `src/components/dashboard/ProductTodayPanel.tsx`.

Note: The real 2026-07-20 21:45Z production refresh inserted the visible odds rows, but Market Prices freshness used provider/source `snapshot_time` instead of the exact persisted visible snapshot lineage. Current Board now separates provider source timestamp from selected market input freshness, uses the persisted selected snapshot ingestion timestamp for user-facing freshness when source time is not reliable, and reports visible fresh/stale counts for mixed coverage. Prediction formulas, recommendation thresholds, candidate ordering, Current Board generation policy, settlement, learning and unsupported markets remain unchanged. Phase 2 has not started.

### Scheduler Reliability Hardening V1

Status: Implemented locally before Phase 2. Production deployment and natural scheduled-run validation remain required.

Evidence: `.github/workflows/production-operating-day.yml`, `.github/workflows/production-operating-day-heartbeat.yml`, `src/services/operations-health.service.ts`, `src/components/dashboard/OperationsHealthPanel.tsx` and `docs/SCHEDULER_RELIABILITY.md`.

Note: The primary GitHub Actions scheduler avoids common quarter-hour congestion by running at `7,22,37,52 * * * *`. A heartbeat workflow runs at `14,44 * * * *` and calls the same protected operating-day endpoint with the same concurrency group; Adaptive Refresh, provider budget and execution locks remain the single control plane. Operations Health now reports missed scheduler intervals and late/critical cadence state. No prediction logic, recommendation logic, odds freshness semantics, Current Board generation, settlement logic or provider clients changed.

### Production Refresh Infrastructure V1

Status: Implemented locally before Phase 2. Production deployment and scheduler proof remain required.

Evidence: `src/app/api/cron/operating-day/route.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operations-health.service.ts`, `src/components/dashboard/OperationsHealthPanel.tsx`, `.github/workflows/production-operating-day.yml`, `.github/workflows/operating-day-refresh.yml`, `docs/PRODUCTION_REFRESH_INFRASTRUCTURE.md` and `docs/SCHEDULER_RELIABILITY.md`.

Note: The production cron entrypoint now delegates to the existing Adaptive Refresh bridge before any legacy automation short-circuit. This lets stale market prices select budget-guarded `midday_refresh` instead of returning `already_current` while the dashboard stays stale. Adaptive Refresh exposes event-level refresh windows and Operations Health exposes scheduler, provider budget, last refresh, next due, skipped-call and refresh-window evidence. Advanced Status renders the provider/scheduler fields from the existing health API, and the legacy operating-day workflow is manual-only so unattended execution has one scheduler of record. Prediction logic, recommendation logic, Current Board generation and settlement logic remain unchanged.

### MLB User Mode Freshness And Provider Budget Phase 1

Status: Implemented locally. Phase 2 has not started.

Evidence: `src/services/provider-budget.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operations-health.service.ts`, `docs/MLB_USER_MODE_FRESHNESS_PROVIDER_BUDGET_PHASE_1.md`, `docs/PROVIDER_BUDGET_POLICY.md`, `docs/PROVIDER_BUDGET_REFRESH_STRATEGY.md` and `docs/SCHEDULER_RELIABILITY.md`.

Note: This phase fixes freshness and budget truth without changing prediction formulas, Current Board generation, recommendation policy, settlement, learning or supported markets. The adaptive orchestrator now applies configurable MLB operating-window freshness thresholds and exposes the active policy. Provider Budget now supports MLB/global budget aliases, a bounded 1500-call default, soft reserve, per-action cap, rolling-hour cap, warning threshold and hard-stop threshold. The observed 267-minute market/prediction/recommendation freshness was caused by loose adaptive odds thresholds plus once-daily Vercel cron without proven intraday external scheduler activation. Confirmed lineups remain unsupported and are not polled.

### MLB Core V1 Runtime Certification Until Pass

Status: Certified locally. Production deployment and unattended external scheduler verification remain pending.

Evidence: `src/services/provider-time-normalization.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/mlb-temporal-health.service.ts`, `src/services/operating-day-automation.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `docs/MLB_OPERATING_DAY_RUNTIME_CERTIFICATION.md`, `docs/CORE_V1_CERTIFICATION.md` and `docs/MLB_TODAY_PAGE_END_TO_END_DATA_VISIBILITY_RUNTIME_ALIGNMENT_REPAIR_V1.md`.

Note: Protected local runtime execution against real providers selected the current actionable MLB slate `2026-07-20`, not stale recovery `2026-07-18`. Status refresh completed with MLB Stats API evidence; odds refresh completed with SportsDataIO `GameOddsByDate` evidence and 90 inserted odds snapshots. Today then returned `AVAILABLE` with 15 visible current-day cards, 24 Current Board candidates, 10 Most Likely rows, positive-only Best Value empty state, 0 provider calls and 0 mutations in 1996ms. Production remains pending deployment of the local commit and external scheduler proof; no model, threshold, champion/V7, settlement, learning or unsupported-market behavior changed.

### MLB Today Page End-to-End Data Visibility & Runtime Alignment Repair V1

Status: Certified locally. Deployment was explicitly not authorized for this mission.

Evidence: `src/app/api/dashboard/today/route.ts`, `src/app/api/dashboard/route.ts`, `src/app/dashboard/page.tsx`, `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/ProductTodayPanel.tsx`, `src/services/dashboard-today.service.ts`, `src/services/mlb-operating-date-resolution.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts` and `docs/MLB_TODAY_PAGE_END_TO_END_DATA_VISIBILITY_RUNTIME_ALIGNMENT_REPAIR_V1.md`.

Note: The Today UI now uses the canonical no-store `/api/dashboard/today` route and refreshes from stored state without provider calls or mutations. Market-facing adaptive actions select the current or next actionable slate instead of bounded stale recovery dates; status/results recovery remains preserved. Local runtime validation now returns all 15 current-day MLB cards and stored board-derived sections; production validation remains pending deployment.

### MLB sport_events.status Constraint Root Cause Trace V1

Status: Implemented locally. Production deployment and protected smoke validation remain required.

Evidence: `src/services/mlb-event-status-mapper.service.ts`, `src/services/operating-day.service.ts`, `src/services/results-sync.service.ts`, `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/nba-data-sync.service.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts` and `docs/MLB_SPORT_EVENTS_STATUS_CONSTRAINT_ROOT_CAUSE_TRACE_V1.md`.

Note: Local runtime validation proved the exact invalid legacy attempted DB value as `final` from MLB Stats API `Final` in `refreshMlbGameStatuses`; `final` is not allowed by `sport_events_status_check`, and canonical DB status is `completed`. Every discovered `sport_events.status` writer now calls the shared status write guard before persistence. No prediction, recommendation, EV, Kelly, confidence, scheduler, provider-budget, dashboard or temporal architecture changes were made.

### MLB Canonical Event Status, Stale Slate Recovery & Temporal Truth Repair V1

Status: Implemented locally. Production deployment and protected smoke validation remain required.

Evidence: `src/services/mlb-event-status-mapper.service.ts`, `src/services/operating-day.service.ts`, `src/services/results-sync.service.ts`, `src/services/mlb-operating-date-resolution.service.ts`, `src/services/provider-time-normalization.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/dashboard-today.service.ts` and `docs/MLB_CANONICAL_EVENT_STATUS_STALE_SLATE_TEMPORAL_REPAIR_V1.md`.

Note: Repairs the production HTTP 207 status-refresh blocker by ensuring MLB Stats API provider statuses are mapped to the existing `sport_events.status` constraint before persistence. Prior unresolved slates are only actionable inside a 2-day recovery window; older residual rows are stale-orphan diagnostics. Legacy SportsDataIO MLB start times can be repaired using metadata or `provider_ids`, and game cards expose temporal diagnostics. No scheduler redesign, dashboard redesign, prediction formula, Official policy, Champion/V7, settlement or learning changes were made.

### MLB Operating Day Runtime Certification V1

Status: Implemented with blockers. Runtime certification remains FAIL until production deployment/smoke, external scheduler activation verification and MLB Stats API results sync are completed.

Evidence: `src/services/operating-day.service.ts`, `src/services/operating-day-automation.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/app/api/cron/operating-day/route.ts`, `docs/MLB_OPERATING_DAY_RUNTIME_CERTIFICATION.md`, `docs/OPERATIONS_RUNBOOK.md`, `docs/SCHEDULER_RELIABILITY.md` and `docs/PRODUCTION_OPERATIONS_PIPELINE.md`.

Note: This mission does not redesign User Mode or change model/recommendation standards. It adds protected MLB Stats API status refresh, MLB Stats API canonical results sync, corrected market-due logic and a production scheduler workflow through the existing operating-day/adaptive execution bridge. Full runtime certification remains blocked because the authorized production Vercel deploy was rejected by the execution environment before deployment ID or smoke evidence could be produced.

## MLB Operating Date Consistency, Action Advancement & Dashboard Query Reliability V1

Status: Implemented locally

Note: Adds a canonical MLB operating-date resolver, action advancement after successful `SUCCESS_NO_CHANGE` status provider checks, lifecycle-ledger-backed health evidence and Today fallback states for query timeout/failure. It does not change dashboard design, prediction formulas, Official policy, settlement, learning, Champion/V7 or unsupported-market gates.

### MLB Slate Recovery & Lifecycle Truth Repair V1

Status: Implemented locally. Deployment and production smoke validation remain required.

Evidence: `src/services/dashboard-today.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/operations-health.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `src/app/api/dashboard/route.ts` and `docs/MLB_SLATE_RECOVERY_LIFECYCLE_TRUTH_REPAIR.md`.

Note: This focused production regression repair separates slate membership from lifecycle certainty and betting eligibility. The Today aggregator now uses a widened stored-event query and canonical Puerto Rico operating-date filtering after MLB time normalization, keeps stale-status games visible, returns lifecycle/betting counts and slate diagnostics, and preserves User Mode cards when optional intelligence sections fail. Passed-start stale games are visible as status-update-overdue and betting locked; future stale games are scheduled/data-aging. Operations health now exposes status-refresh evidence and reports `MISSED_REFRESH` when a protected MLB Stats API status check is due but not executed. Prediction formulas, projection formulas, Official Pick thresholds, champion rows, V7, settlement, learning and unsupported market gates are unchanged.

### MLB Production Certification & Closed Beta Audit V1

Status: Implemented locally. Public production certification remains blocked until deployment and production smoke validation are completed.

Evidence: `src/services/mlb-game-lifecycle.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/dashboard-today.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/services/market-intelligence-engine.service.ts`, `src/services/autonomous-daily-operations.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/app/api/dashboard/route.ts` and `docs/MLB_PRODUCTION_CERTIFICATION_CLOSED_BETA_AUDIT.md`.

Note: This is a certification repair pass, not a feature or architecture sprint. Stale `Scheduled`/`Pregame` MLB provider statuses after first pitch now resolve to status-unconfirmed instead of rendering as Pregame, user-facing Best Value surfaces now return only positive EV plus positive edge candidates and show `No positive-value opportunities today.` when empty, the standalone Best Value page no longer exposes pass rows under the Best Value label, and the dashboard route preserves separate Today and legacy error contracts. Prediction formulas, projection integrity, Official Pick thresholds, champion rows, V7, settlement, learning, provider adapters and unsupported market gates are unchanged.

### Today Dashboard Load Reliability Repair V1

Status: Implemented pending deployment and production validation.

Evidence: `src/services/dashboard-today.service.ts`, `src/app/api/dashboard/route.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `docs/TODAY_DASHBOARD_RELIABILITY.md`, `docs/AI_EXPERIENCE_CLOSED_BETA_UX.md` and `docs/CLOSED_BETA_READINESS.md`.

Note: This is a focused reliability repair. It does not add product features or change prediction/projection logic. The Today endpoint now has a stable typed envelope, bounded parallel dependency reads, independent optional sections, timing diagnostics and zero provider-call/zero-mutation page-load behavior. The client no longer blanks User Mode because Most Likely, Best Value or AI Bet Finder is temporarily unavailable. Local degraded validation improved from about 42.8s before the repair to about 1.8s server timing after the repair.

### MLB Odds Refresh Execution Repair V1

Status: Implemented pending build and controlled production validation.

Evidence: `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operating-day.service.ts`, `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/operations/adaptive-refresh`, `docs/MLB_ODDS_REFRESH_EXECUTION.md`, `docs/ADAPTIVE_REFRESH_EXECUTION.md`, `docs/PRODUCTION_OPERATIONS_PIPELINE.md`, `docs/SCHEDULER_RELIABILITY.md` and `docs/OPERATIONS_RUNBOOK.md`.

Note: This is a focused production defect repair, not new architecture. Due provider-backed `midday_refresh` work now remains provider-backed through Adaptive Refresh, Operating Day and SportsDataIO MLB odds capture. The existing preview service bypasses only the stale odds checkpoint when forced by legitimate due work, performs the canonical SportsDataIO `GameOddsByDate` check, persists accepted snapshots, blocks older provider responses from superseding newer odds and reports explicit provider-check evidence. `SUCCESS_NO_CHANGE` requires `providerCheckCompleted=true`; skipped provider work remains `MISSED_REFRESH`. Prediction formulas, official thresholds, Current Board policy, champion rows, V7, Projection Integrity, settlement and learning are unchanged.

### AI Experience & Closed Beta User Experience V1

Status: Completed pending production smoke validation.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/MlbProjectionBoardClient.tsx`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/ai-bet-finder`, `docs/AI_EXPERIENCE_CLOSED_BETA_UX.md`.

Note: This sprint surfaces existing intelligence rather than adding engines. User Mode now shows Today's Story, Most Likely probability rankings, Best Value rankings, AI Lean/Watchlist/Avoid explanations, richer game cards, truthful freshness/system-health language and educational empty states. Most Likely remains probability-only and informational. Best Value remains value-ranked and informational unless Official Pick policy qualifies it. Projection Board explains blocked state without relaxing Projection Integrity. Prediction formulas, projection formulas, Official Pick thresholds, champion rows, V7, settlement, learning, Temporal Truth, provider integrations and Current Board policy remain unchanged.

### Production Stabilization & Closed Beta Readiness V1

Status: Completed pending production smoke validation.

Evidence: `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operations-health.service.ts`, `src/services/universal-projection-engine.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `/api/operations/health`, `/api/operations/adaptive-refresh`, `docs/CLOSED_BETA_READINESS.md`.

Note: This stabilization pass does not add a new architecture. It tightens the existing adaptive refresh, operations health, projection integrity diagnostics and User Mode truthfulness. Provider-backed due refreshes can no longer be hidden behind `SUCCESS_NO_CHANGE` when no provider check occurred; those executions return `MISSED_REFRESH`. Operations Health now separates platform, provider, projection and prediction health. Projection Health explains why rows remain blocked without relaxing integrity gates. User Mode replaces vague `Ready` wording with `Healthy`, `Limited`, `Data Aging`, `Waiting for Provider` and `Operational Blocker` states. Prediction formulas, projection formulas, Official Pick thresholds, Current Board policy, champion rows, V7, settlement, learning, Temporal Truth and provider integrations remain unchanged.

### MLB Projection Integrity, Player Resolution, Historical Activation & User Projection Board V1

Status: Completed pending final deployment validation.

Evidence: `src/services/mlb-projection-integrity.service.ts`, `src/services/universal-projection-engine.service.ts`, `/api/mlb/projections/health`, `/projections`, additive projection-history migration updates and projection integrity docs.

Note: This module keeps projections shadow-only and sportsbook-independent while correcting integrity defects. Projection IDs now include model/version/entity/event context, pitcher projections require event starter resolution, league-baseline team rows are blocked from user ranking, missing values remain missing, unit/plausibility checks gate output, and the Projection Board sorts by rank score rather than projected quantity. Provider calls, betting formulas, official thresholds, Current Board policy, champion/V7 state, betting settlement, learning and provider-budget policy remain unchanged.

### MLB Temporal Truth, Game Status & Freshness Reliability V1

Status: Completed pending final build/deployment verification.

Evidence: `src/services/provider-time-normalization.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/mlb-freshness-policy.service.ts`, `src/services/mlb-temporal-health.service.ts`, `/api/mlb/temporal-health`, `src/components/dashboard/MlbTemporalHealthPanel.tsx`, Current Board/next-slate/dashboard/projection integration and temporal docs.

Note: This module fixes the production class of defects where SportsDataIO MLB Eastern-local start times were treated as UTC and displayed hours early. SportsDataIO MLB naive `DateTime` fields now normalize through `America/New_York`, API timestamps remain explicit UTC instants, UI rendering is display-only, and legacy SportsDataIO rows are repaired on read without rewriting history. Lifecycle and betting eligibility are separated; time-only fallback cannot claim `LIVE`, `FINAL`, `POSTPONED` or `CANCELED`. Provider calls, prediction mutations, remote mutations, formulas, model weights, official thresholds, Current Board policy, champion/V7 state, settlement, learning and provider quota policy remain unchanged.

### MLB Universal Projection Engine V1

Status: Completed pending build/deployment verification.

Evidence: `src/services/universal-projection-engine.service.ts`, `/api/projections`, `/api/mlb/projections`, `src/components/dashboard/UniversalProjectionEnginePanel.tsx`, `supabase/migrations/202607190002_universal_projection_history_v1.sql`, AI Brain projection-health integration and projection docs.

Note: This module creates the sportsbook-independent projection foundation for future market expansion. It produces statistical projections only and does not generate betting recommendations, Official Picks, EV, Kelly or sportsbook-line comparisons. Projection history is separate from betting prediction history. Existing prediction formulas, Current Board, official thresholds, champion/V7 state, settlement, learning and provider logic are unchanged.

### MLB Market Expansion Program V1

Status: Completed pending build/deployment verification.

Evidence: `docs/MLB_MARKET_EXPANSION_PROGRAM.md`, `src/services/mlb-market-expansion-roadmap.service.ts`, `/api/mlb/markets/expansion-roadmap`, and the AI Brain engineering advisor in `src/services/ai-performance-center.service.ts`.

Note: This module makes Team Totals V1 the official Wave 1 MLB market expansion target using a weighted per-market readiness matrix and implementation-wave plan. It is an advisory/program layer only. No market was implemented, no provider data was acquired, and prediction formulas, official thresholds, Current Board, champion/V7 status, settlement, learning, provider logic and historical rows remain unchanged.

### MLB Market Expansion Roadmap & Implementation Plan V1

Status: Completed pending build/deployment verification.

Evidence: `src/services/mlb-market-expansion-roadmap.service.ts`, `/api/mlb/markets/expansion-roadmap`, `src/components/dashboard/MlbMarketExpansionRoadmapPanel.tsx`, `docs/MLB_MARKET_EXPANSION_ROADMAP.md`, `docs/MLB_MARKET_TAXONOMY.md`, `docs/MLB_MARKET_PROVIDER_MATRIX.md`, `docs/MLB_MARKET_DATA_REQUIREMENTS.md`, `docs/MLB_MARKET_MODEL_REQUIREMENTS.md`, `docs/MLB_MARKET_SETTLEMENT_REQUIREMENTS.md`, `docs/MLB_MARKET_ACTIVATION_GATES.md` and `docs/MLB_MARKET_RISK_ANALYSIS.md`.

Note: This module is roadmap and planning only. It verifies the current MLB market baseline from existing production contracts, defines a canonical expansion taxonomy, provider/data/model/settlement/historical matrices, user-value ranking, opportunity estimates, risk grades, weighted prioritization, implementation waves and activation gates. The recommended first implementation epic is Team Totals V1 as shadow-only, not official-pick eligible, pending verified team-total odds, historical line snapshots and deterministic settlement. No provider acquisition, prediction formula, model weight, threshold, champion/challenger/V7, Current Board, settlement, learning, historical-row or betting-activation behavior changed.

### Production Readiness Audit V1

Status: Completed and build verified.

Evidence: `src/services/production-readiness-audit.service.ts`, `/api/production-readiness/audit`, `src/components/dashboard/ProductionReadinessAuditPanel.tsx`, `docs/PRODUCTION_READINESS_AUDIT.md`.

Note: This module creates the final read-only certification layer for Beta readiness. It does not introduce new scoring engines or parallel architecture; it composes existing AIPEC/AI Brain, Current Board, Adaptive Operations, Top Picks and MLB market capability contracts. It reports platform scores, Current Board universe vs candidates, market support, official-pick blockers in plain English, data availability, freshness, scheduler/provider state and guardrails. Certification is public production `NO`, closed beta `YES` with remaining blockers for mature calibration/historical odds, player availability/lineup depth and high-frequency fresh odds cadence. No prediction, threshold, champion, V7, provider, settlement, learning or historical-row behavior changed.

### Live Data Freshness & Adaptive Operations V1

Status: Completed pending build/deployment verification.

Evidence: `src/services/adaptive-refresh-orchestrator.service.ts`, `/api/operations/status`, `/api/operations/adaptive-refresh`, `/api/operations/adaptive-refresh/status`, `/api/operations/data-freshness`, `/api/operations/change-events`, `/api/operations/refresh-plan`, `/api/operations/provider-budget-forecast`, `/api/operations/validation`, `src/components/dashboard/AdaptiveOperationsPanel.tsx`, `src/components/dashboard/DataFreshnessPreviewCard.tsx` and adaptive operations docs.

Note: This module adds a decision/reporting layer over existing operations rather than a second scheduler. It audits the configured Vercel cron, normalizes freshness domains, forecasts provider-budget mode and refresh work, exposes plan-only dry runs, and keeps stale odds from being treated as actionable. Recommendation-change events are typed empty until persistent event storage is introduced. Provider calls, prediction mutations, remote mutations from status reads, thresholds, champion/challenger/V7 state, Current Board policy, settlement, learning and historical records remain unchanged.

### MLB Production Certification V1

Status: Completed and build verified.

Evidence: `docs/MLB_PRODUCTION_CERTIFICATION.md`, `docs/MLB_ARCHITECTURE.md`, `docs/MLB_OPERATIONS.md`, `docs/MLB_PROVIDER_STRATEGY.md`, `docs/MLB_AUTOMATION.md`, `docs/MLB_DATA_FLOW.md`, `docs/MLB_FEATURES.md`, `docs/MLB_LIMITATIONS.md`, `docs/MLB_KNOWN_ISSUES.md`, `docs/MLB_RELEASE_NOTES.md` and production validation of MLB read/status routes.

Note: MLB is certified as Production Stable and moved to Maintenance Mode for version `v1.0.0`. Architecture, models, dashboard architecture, automation lifecycle, recommendation policy, official-pick thresholds, champion row policy, settlement policy, learning policy and provider-budget strategy are frozen. No code feature changes, model changes, threshold changes, provider logic changes, settlement changes, learning changes, Champion promotion or V7 promotion were introduced. Future MLB work is limited to bug fixes, provider upgrades, UI polish, performance improvements, security updates and documentation refreshes. Primary roadmap priority now transitions to BSN and basketball intelligence.

### BSN Intelligence Engine V1

Status: Completed and build verified.

Evidence: `src/services/bsn-intelligence-engine.service.ts`, `/api/bsn/intelligence`, `/api/bsn/team/[id]`, `/api/bsn/compare`, `/api/bsn/power-rankings`, `/api/bsn/momentum`, `/api/bsn/features` and `src/components/dashboard/BsnIntelligencePanel.tsx`.

Note: This module turns stored BSN data into reusable basketball intelligence without enabling betting predictions. It derives team profiles, player profiles, standings context, recent form, momentum, consistency, strength, power rankings, comparison advantages, league knowledge and computed BSN feature records only from validated normalized rows. Missing player game logs, historical baselines, durable feature-store persistence, odds and prediction-ready inputs stay unavailable rather than estimated. It reuses the Basketball Data Platform, Historical Builder, Historical Import Engine contracts, Feature Store Core, Shared Prediction SDK, Provider Registry and validation patterns. No provider calls, writes, Current Board changes, official-pick changes, thresholds, champion rows, V7 promotion, settlement, learning or MLB behavior changed.

### BSN Prediction Engine V1

Status: Completed and build verified.

Evidence: `src/services/bsn-shadow-prediction-engine.service.ts`, `/api/bsn/predictions`, `/api/bsn/predictions/preview`, `/api/bsn/predictions/validation`, `/api/bsn/game/[id]`, `src/components/dashboard/BsnPredictionPreviewPanel.tsx` and `docs/bsn-prediction-engine-v1.md`.

Note: This module adds probability-only BSN game predictions in shadow mode. It reuses BSN Intelligence, the Basketball Platform, Historical Builder, Feature Store Core and Shared Prediction SDK compatibility metadata without calling the SDK EV/Kelly recommendation builder. Outputs are limited to home win probability, away win probability, confidence, data quality, prediction quality and reasoning. Missing data remains unavailable, and empty upcoming schedules return typed empty previews. Official Picks, Current Board activation, EV/value, Bet Slip, AI Leans, Watchlist, Avoid, champion rows, thresholds, V7 promotion, settlement, learning, MLB behavior, provider calls and remote mutations are unchanged.

### BSN Model Maturity Mission V1

Status: Completed and build verified.

Evidence: `src/services/bsn-model-maturity.service.ts`, `/api/bsn/model-maturity`, phase-specific maturity API routes, `src/components/dashboard/BsnModelMaturityPanel.tsx` and `docs/bsn-model-maturity-v1.md`.

Note: This module adds BSN backtesting, calibration, a performance center, explanation quality checks, readiness scoring, shadow market intelligence and an activation audit without enabling betting. It reuses the existing BSN Shadow Prediction Engine for replay math and keeps outputs probability/science-only. The current audit recommends Continue Shadow because the sample is not large enough for official activation, verified odds are missing, immutable pregame feature snapshots are not persisted, and player availability/boxscore depth remain unavailable. Provider calls, remote mutations, Official Picks, Current Board, EV/value/Kelly, AI Leans, Watchlist, Bet Slip, champion rows, thresholds, V7 promotion, settlement, learning and MLB behavior are unchanged.

### Universal AI Performance & Evolution Center V1

Status: Completed and build verified.

Evidence: `src/services/ai-performance-center.service.ts`, `/api/ai-performance-center`, `/api/ai-performance-center/daily-update`, `src/components/dashboard/AiPerformanceCenterPanel.tsx` and `docs/ai-performance-center-v1.md`.

Note: This module creates one read-only AI performance center for every enabled sport. It uses the existing sport registry for automatic future-sport discovery, stored `prediction_history` for settled/persisted rows, BSN shadow replay for shadow-only maturity evidence, the Feature Store, Prediction SDK, calibration service and Current Board status. It reports universal history, report cards, trend analysis, model evolution, performance timeline, confidence analysis and readiness without creating recommendations or changing any prediction, settlement, learning, threshold, champion, Current Board, Bet Slip, provider or V7 behavior.

### Pick Analyzer AI Brain & Trust System V1

Status: Completed and build verified.

Evidence: `src/services/ai-performance-center.service.ts`, `/api/performance`, `/api/performance/sports`, `/api/performance/[sport]`, `/api/performance/history`, `/api/performance/evolution`, `/api/performance/report-card`, `/api/performance/trust`, `/api/performance/goals`, `/api/performance/readiness`, `/api/performance/validation`, `/api/performance/daily-update`, `/performance`, `src/components/performance/PerformanceClient.tsx`, `supabase/migrations/202607190001_ai_performance_snapshots_v1.sql` and AI Brain documentation.

Note: This module extends AIPEC rather than creating parallel metrics infrastructure. It adds AI Brain contracts, AI Trust Score V1, trust-change explanations, AI evolution comparisons, optional idempotent daily snapshots, Daily AI Report Card V1, goals/progress, maturity pipelines, public and internal performance views, universal prediction-history filtering and registry-driven future-sport integration. The snapshot migration is additive and does not rewrite prediction history. Provider calls, external acquisition, prediction model changes, official thresholds, Current Board policy, Official Picks, AI Lean/Watchlist/Avoid policy, Bet Slip/Kelly, settlement, learning mutations, champion/challenger/shadow status and V7 status remain unchanged.

### AI Performance Center Product UI V1

Status: Completed and build verified.

Evidence: `/performance`, `src/components/performance/PerformanceProductClient.tsx`, `src/components/dashboard/AiPerformancePreviewCard.tsx`, dashboard navigation updates, `/api/performance` contract exposure and UI docs.

Note: This is a product UI and contract-integration sprint on top of the existing AI Brain. It adds first-class navigation, dashboard discoverability, sport filtering, All Sports and sport-specific summaries, Trust Score and component display, Daily Report Card, stored-snapshot evolution state, model maturity, goals, prediction-history filtering and detail inspection, timeline summaries, engineering recommendations and collapsed internal diagnostics. It reuses existing metrics and APIs, does not duplicate engines, and does not modify prediction formulas, trust formulas, report-card formulas, readiness formulas, thresholds, champion/challenger/shadow state, V7, Current Board, Official Picks, settlement, learning, provider acquisition or historical rows.

### Premium AI Sports Intelligence Product Experience V1

Status: Completed and build verified.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`, `/dashboard`.

Note: This is a presentation-only dashboard sprint. User Mode now opens with the betting decision first, followed by Market Mood, Updated time, Official Picks, Games Today and a primary View Opportunities action. Category cards, Top AI Opportunity, AI Confidence, Today's Games, Today at a Glance and System Health were simplified into premium, scan-first cards using only existing response fields. Requested explanatory copy and legacy labels were removed from the primary experience. Advanced Details remain grouped under Overview, Markets, Model, Historical, Data, Provider, Settlement, Learning, Calibration and Administration. No models, thresholds, champion rows, V7 promotion, provider behavior, Current Board logic, settlement, learning or database writes changed.

### BSN Data Completion Mission V1

Status: Completed with public-source limitations and build verified.

Evidence: `src/services/basketball/connectors/official-bsn-homepage.connector.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts`, `/api/basketball/bsn/acquisition`, `/api/basketball/bsn/data-coverage`, `src/components/dashboard/BasketballDataCoveragePanel.tsx`.

Note: The existing official BSN connector was deepened in place. It now discovers and acquires all supported data exposed by bounded public official pages: teams, standings, recent completed results, player-list sample and limited team leaders. It adds cache, retry, checkpoint/resume metadata, rate spacing, connector health and typed unavailable responses. Historical reconstruction continues for 2026 while real public data exists and stops for prior seasons without a permissioned archive. Knowledge/Feature Store handoff remains limited to what completed games can support; no fabricated quarter scores, boxscores, play-by-play, odds, officials, attendance or advanced metrics were introduced. No prediction model, provider policy, recommendation threshold, champion/challenger row, V7 promotion, settlement, learning or calibration behavior changed.

### Product Polish and Visual Dashboard V2

Status: Completed and build verified.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`, `/dashboard`.

Note: User Mode was redesigned around one fast visual read: AI Market Outlook, deterministic market sentiment, four category infographic cards, Top AI Opportunity progress meters, compact game cards, Today at a Glance readiness states and one System Health card. Market sentiment mapping is display-only: Official Picks -> AGGRESSIVE, AI Leans/ready analysis -> SELECTIVE, waiting odds/empty freshness -> WAITING, otherwise DEFENSIVE. Advanced Details are now one dashboard area with collapsible Overview, Markets, Model, Historical Performance, Data, Provider, Settlement, Learning, Calibration and Administration groups. Main User Mode still fetches the existing Today and Most Likely contracts only; advanced panels remain lazy/collapsed. No model, provider, recommendation, settlement, learning, threshold, champion/challenger, V7 or data-mutation behavior changed.

### BSN Acquisition Engine V1

Status: Completed and build verified.

Evidence: `src/services/basketball/connectors/official-bsn-homepage.connector.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts`, `/api/basketball/bsn/acquisition`, `sports_teams`, `sport_standings`, `provider_entity_mappings` and `sports_sync_jobs`.

Note: The first real BSN connector uses a single cached official homepage standings snapshot. It supports only teams and standings, imports only a small standings sample when explicitly confirmed, preserves source URL/fetched timestamp/provider IDs/canonical IDs, and keeps schedule, results, game IDs, players, statistics, boxscores, play-by-play, officials, attendance, arena, advanced metrics and odds typed as unavailable. Current Board and official-pick impact remain none because no events, verified odds, feature snapshots, predictions or recommendation-policy outputs are created.

### Professional AI Sports Intelligence Dashboard UX V1

Status: Completed and build verified.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`, `src/components/dashboard/DeveloperDetails.tsx`, `src/components/dashboard/DashboardShell.tsx`.

Note: The default dashboard now separates User Mode from Advanced Details. User Mode emphasizes a 10-second betting decision, Official Picks, AI Leans, Watchlist, Avoid, top AI opportunity, simplified games, progress indicators and a simple system health state. Technical panels remain available behind collapsed Advanced Details sections. This was presentation-only: no prediction models, thresholds, settlement, learning, AI calculations, champion rows or provider behavior were changed.

### BSN Historical Reconstruction V1

Status: Completed and build verified.

Evidence: `src/services/basketball/history/bsn-historical-reconstruction.ts`, `/api/basketball/bsn/historical-reconstruction`, `src/services/basketball/history/historical-builder.ts`, `src/services/basketball-source-framework.service.ts`, `src/services/bsn-platform.service.ts`, `scripts/basketball-cli.js`.

Note: This module uses the Basketball Data Platform rather than creating another platform or import engine. It discovers BSN connector capabilities, inventories seasons from existing normalized and legacy storage, composes the Historical Builder workflow, and reports reconstruction, coverage, missing datasets, validation, Feature Store and Prediction SDK compatibility. No provider calls, writes, scraping, fabricated values, official-pick changes, champion mutation, threshold changes, settlement changes or learning changes were introduced.

### Basketball Data Platform V1

Status: Completed and build verified.

Evidence: `src/services/basketball/`, `/api/basketball/platform`, `scripts/basketball-cli.js`, `package.json`, `src/services/basketball-source-framework.service.ts`, `src/services/historical-import-engine.service.ts`, `src/services/feature-store-core.service.ts` and `src/services/sport-prediction-engine-sdk.service.ts`.

Note: This is the generic basketball data infrastructure layer for BSN and future basketball leagues, not a scraper and not a one-off importer. It defines connector-first acquisition contracts, typed unsupported capability behavior, canonical basketball entities with stable IDs, normalization, data quality, reconciliation, historical builder checkpoints, knowledge generation plans, Feature Store handoffs, Prediction SDK handoffs, CLI entry points and deterministic validation. Existing Pick Analyzer services remain the system of record for provider registry, historical import, Feature Store and prediction output. No provider calls, writes, official-pick changes, champion mutation, threshold changes, settlement changes or learning changes were introduced.

### AI Market Intelligence Category Expansion V1

Status: Completed and build verified.

Evidence: `src/services/market-intelligence-category.service.ts`, `src/services/dashboard-today.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/services/market-intelligence-engine.service.ts`, `src/services/best-bets-today.service.ts`, `src/components/dashboard/ProductTodayPanel.tsx`, `src/components/dashboard/MarketIntelligenceSummaryPanel.tsx`, `src/components/dashboard/TopPicksPanel.tsx`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx` and `src/components/market-opportunities/BettingWorkbenchTool.tsx`.

Note: Stored Current Board candidates now drive four independent product categories: Official, AI Lean, Watchlist and Avoid. Non-official rows are ranked as market intelligence only, include required caution copy and reason-not-official explanations, and remain excluded from official recommendation/performance semantics. Category counters and empty independent track-record contracts are exposed without settlement-policy changes. No prediction model, V7/champion state, threshold, settlement or learning behavior was changed.

### Official Vs Informational Ranking Separation V1

Status: Completed and build verified.

Evidence: `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx`, `src/components/market-opportunities/BettingWorkbenchTool.tsx` and `src/components/dashboard/TopPicksPanel.tsx`.

Note: Most Likely, Best Value, AI Bet Finder and Betting Workbench now continue to provide display-only informational rankings when the strict Current Board has no official/current rows but stored current-day candidates exist. Labels are mutually exclusive across Official Recommendation, Informational Only and Avoid, non-official opportunities include the required warning and reason-not-official explanation, and official-pick columns clarify that empty official recommendations are not empty informational analysis. Prediction models, V7, champion rows, official thresholds, settlement, learning and confidence calculations remain unchanged.

### Dashboard Unification, Performance And Slate Consistency V1

Status: Completed and build verified.

Evidence: `src/services/dashboard-today.service.ts`, `/api/dashboard?mode=today`, `src/components/dashboard/ProductTodayPanel.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`.

Note: The dashboard now has one canonical Today contract and one primary user-facing answer. It separates Puerto Rico operating date from next slate date, distinguishes current-day games from next-slate scheduled games, reports odds/prediction/recommendation readiness from the same resolver, labels evening actions without stale Morning Sync wording and keeps advanced legacy panels collapsed behind lazy Developer Mode groups. Daily Report no longer blocks the primary dashboard. No official-pick thresholds, champion rows, settlement policy, provider-budget policy or V7 promotion state were changed.

### BSN Official Ecosystem Data Acquisition Audit V1

Status: Completed and build verified.

Evidence: `docs/bsn-data-acquisition-strategy.md`.

Note: This was a discovery-only strategy sprint. It did not add imports, prediction modules or dashboard pages. Official BSN pages and app-store metadata were audited with bounded public requests. Robots and terms make unapproved internal API/chunk scraping unsuitable; the permanent recommendation is permissioned official feed/API primary, legally sourced CSV fallback, audited manual entry emergency path and licensed provider only after BSN coverage is verified.

### BSN Source Framework V1

Status: Completed and build verified.

Evidence: `src/services/basketball-source-framework.service.ts`, `/api/bsn/sources`, `/api/bsn/source-quality`, `/api/bsn/sources/validate`, `/api/bsn/import`, BSN capability/sync/readiness integration and `docs/bsn-source-framework-v1.md`.

Note: This is the reusable basketball connector blueprint for BSN, NBA, NCAA, EuroLeague, FIBA, WNBA and future basketball leagues. It supports official-source discovery, future APIs, CSV import, manual entry and future providers with validation, dry-run import planning, quality reporting, normalized target-table mapping and strict no-fabrication/no-write guardrails. BSN remains source/provider/odds/calibration blocked for production betting.

### MLB Operations Center V1

Status: Completed and build verified.

Evidence: `src/services/mlb-operations-center.service.ts`, `/api/mlb/operations-center` and `/mlb-operations`.

Note: This is an internal admin monitor, not a user-facing recommendation feature. It aggregates operating-day lifecycle, Current Board, provider health and budget, intelligence coverage, prediction engine, model quality, settlement, automation, known limitations, developer links and a non-inflated MLB readiness score from existing read-only services. It makes 0 provider calls and does not alter official thresholds, champion rows, settlement, learning, provider budget rules, Current Board logic or V7 promotion state.

### MLB Player Status Availability Integration V1

Status: Completed and build verified.

Evidence: `src/services/mlb-missing-intelligence.service.ts`, `src/services/sportsdataio-mlb-prospective-preview.service.ts`, MLB Data Quality integration, MLB AI Coach integration and `src/components/dashboard/MlbMissingIntelligencePanel.tsx`.

Note: SportsDataIO `Player.Status` is now normalized as roster availability and injured-list detection while the detailed injury endpoint remains subscription-blocked. The integration preserves raw provider status, normalized availability, provider/canonical player IDs, team mapping, source and freshness. V7 Confidence Engine V2 applies only bounded data-confidence effects for stale/unknown status and IL context; no injury severity, expected return, confirmed lineup absence, official-threshold change, champion mutation or V7 promotion is inferred.

### MLB Missing Intelligence Integration V1

Status: Completed with provider limitations and build verified.

Evidence: `src/services/mlb-missing-intelligence.service.ts`, `/api/mlb/missing-intelligence/health`, `src/components/dashboard/MlbMissingIntelligencePanel.tsx`, MLB Data Quality integration, MLB AI Coach integration and V7 Confidence Engine V2 missing-intelligence metadata in `src/services/sportsdataio-mlb-prospective-preview.service.ts`.

Note: The module reuses existing `sport_players`, `provider_entity_mappings`, `sport_lineups`, `sport_injuries`, `sport_player_stats` and `sports_sync_jobs` tables. It supports cache-first coverage, budget-checked live preflight and idempotent player metadata hydration when the SportsDataIO MLB `Players` feed is available. Confirmed lineups and injury feeds remain typed provider limitations for the current Discovery Lab path unless entitlement is verified. V7 remains challenger-only, official thresholds are unchanged, champion history is untouched and missing data never becomes positive evidence.

### Product Experience Polish V1

Status: Completed and build verified.

Evidence: `src/components/dashboard/ProductTodayPanel.tsx`, `src/components/dashboard/DeveloperDetails.tsx`, `src/components/dashboard/SportSelector.tsx`, `src/components/dashboard/DashboardShell.tsx`, `src/app/dashboard/page.tsx` and the human-facing daily-operations response fields in `src/services/autonomous-daily-operations.service.ts`.

Note: The dashboard now opens on the question "Should I bet today?" and keeps advanced diagnostics behind lazy Developer Mode sections. This was a product-surface change only; no new prediction models, sports, official thresholds, settlement logic or champion promotion paths were added.

### Autonomous Daily Execution, Settlement, and Learning V1

Status: Completed and build verified.

Evidence: `src/services/autonomous-daily-operations.service.ts`, `/api/autonomous-daily-operations/execute`, `/api/autonomous-daily-operations/daily-report`, `/api/autonomous-daily-operations/learning-report`, `/api/autonomous-daily-operations/scheduler`, `/api/autonomous-daily-operations/health`, `/api/autonomous-daily-operations/simulation`, `/api/autonomous-daily-operations/demo` and `ProductionTodayPanel`.

Note: The execution layer is protected, idempotent, dry-run by default, confirmation-gated and provider-budget-aware. It reuses the existing Operating Day executor for eligible stages and keeps learning suggestion-only with no automatic model promotion, threshold changes, official-history edits or unnecessary provider calls.

Controlled validation: The first confirmed production attempt intentionally did not execute the quota-consuming `final_refresh` because live readiness returned `UNSAFE_TIMING` after most of the slate had started. The same idempotency key reran as a zero-call, zero-write no-op. End-to-end settlement proof remains pending a temporally valid due stage.

Postgame validation: `sync_results` now returns `WAITING_FOR_FINALS` while any operating-day game remains active pregame or unresolved in stored operating-day status. Results sync, settlement, replay and learning proof remain pending until the cohort is terminal and a safe postgame window exists.

July 18 activation validation: The MLB operating day was idempotently created from 15 stored events, but production odds/features/predictions remained blocked by missing `SPORTSDATAIO_MLB_API_KEY` in the deployed environment. Status/linking robustness and late-night external schedules were tightened; official thresholds, champion rows and settlement gates remain unchanged.

### MLB Bullpen And Pitcher Intelligence V1

Status: Completed and build verified.

Evidence: `src/services/mlb-model-platform.service.ts`, `/api/mlb/intelligence/pitcher-bullpen-foundation`, MLB Data Quality integration, AI Coach integration and `docs/mlb-bullpen-pitcher-intelligence-v1.md`.

Note: This is a cache-first intelligence layer. It uses verified starter IDs/names plus cached `sport_player_stats` rows to report starter profile coverage, cached pitcher metrics, relief row coverage and workload signals. It does not claim closer availability, high-leverage roles, injuries or lineups without verified data, and it does not change official recommendation policy.

### MLB Player Metadata Cache V1

Status: Completed and build verified.

Evidence: `src/services/mlb-model-platform.service.ts`, `/api/mlb/players/metadata-cache` and `docs/mlb-player-metadata-cache-v1.md`.

Note: This module reports cached player identity, team, provider ID, position, roster, handedness and injury-status coverage with a 7-day TTL policy and zero provider calls. It confirms current identity/position mapping is ready while handedness and injury status remain explicit blockers.

### MLB Prediction Engine V7 And Confidence Engine V2

Status: Completed and build verified.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/mlb/predictions/v7-regeneration`, V7 comparison support on `/api/mlb/predictions/comparison`, MLB prediction health annotations and `docs/mlb-prediction-engine-v7-confidence-v2.md`.

Note: V7 is challenger by default and shadow-evaluable. Confidence Engine V2 separates model, data, market and recommendation confidence. It uses verified starter/weather/stadium and persisted market evidence, but treats bullpen game workload, lineups, injuries and handedness as missing-data blockers. V7 does not change official recommendation thresholds or auto-promote.

### BSN Integration V1

Status: Architecture/readiness completed and build pending.

Evidence: `src/services/bsn-platform.service.ts`, `/api/bsn/capabilities`, `/api/bsn/data-quality`, `/api/bsn/sync`, `/api/bsn/predictions`, `/api/bsn/ai-coach`, BSN Feature Store registry entries and `docs/bsn-integration-v1.md`.

Note: BSN is registered as the second basketball league blueprint, but production predictions remain blocked. The previous mock-odds prediction path is replaced with a V7-style dry-run preflight, source/capability matrix and Confidence Engine V2 readiness output. Official picks, EV and Best Value are blocked until approved source ingestion and verified BSN odds exist.

### Highest-Probability Outcome V1

Status: Completed and build verified.

Evidence: `src/services/market-opportunity-suite.service.ts`, `/api/market-opportunities/most-likely`, `src/components/market-opportunities/MostLikelyTool.tsx`, MLB AI Coach integration and `docs/highest-probability-outcome-v1.md`.

Note: This module is informational only. It displays highest modeled probability, most-likely moneyline and an estimated two-leg moneyline parlay while preserving official recommendation-policy separation and making 0 provider calls.

### MLB Starter + Weather + Stadium Intelligence V1

Status: Completed and build verified.

Evidence: `src/services/mlb-starter-weather-stadium-intelligence.service.ts`, Feature Store Core MLB feature definitions, MLB V5 feature-set registry entries, Current Board enrichment, MLB prospective preview enrichment, Data Quality, AI Coach, Prediction Engine preview and `docs/mlb-starter-weather-stadium-intelligence-v1.md`.

Note: The module consumes stored GamesByDate verification evidence only and made 0 provider calls. Starting pitcher IDs/names, weather, wind and StadiumID are ready. Player details, player stats, stadium metadata, lineups, injuries, bullpen and historical calibration remain explicit next-phase blockers.

### MLB Games Payload Field Verification V1

Status: Completed and build verified.

Evidence: `src/services/mlb-games-payload-audit.service.ts`, `/api/mlb/games-payload-audit`, updated MLB data-quality and AI Coach evidence, and `docs/mlb-games-payload-field-verification-v1.md`.

Note: The final corrected 2026-07-17 GamesByDate verification verified populated starter IDs/names, weather, wind and `StadiumID` fields. Opener fields were present-null. No further GamesByDate verification call is needed for this audit.

### Core Dashboard And API Shell

Status: Completed.

Evidence: `src/app/dashboard/page.tsx`, dashboard panels in `src/components/dashboard`, and 100 API route files under `src/app/api`.

### Multi-Sport Engine

Status: Completed foundation.

Evidence: `docs/multi-sport-engine.md`, `src/config/sports.config.ts`, `src/types/multi-sport.ts`, `src/services/multi-sport-*.service.ts`, `/api/sports/*` routes and dashboard panels.

### Prediction Engine V4 And Shared Intelligence

Status: Completed foundation.

Evidence: `src/utils/prediction-engine-v4.ts`, `src/services/prediction-engine-v4.service.ts`, Kelly, Smart Ranking, Adaptive Scoring, model learning, risk grade, Monte Carlo and portfolio services.

### NBA Data Sync V1

Status: Completed and production-readiness verified for safe incremental behavior.

Evidence: `docs/nba-data-sync-v1.md`, `src/services/nba-data-sync.service.ts`, NBA sync API routes, NBA sync panel and migrations `202607110001` and `202607110002`.

### NBA Prediction Engine V1

Status: Completed architecture and build verified.

Evidence: `src/services/nba-prediction-engine.service.ts`, NBA prediction APIs and `NbaPredictionEnginePanel`. Current provider data may produce zero candidates when no NBA events/odds are available.

### NBA Prediction Validation & Settlement V1

Status: Completed and production-readiness verified for empty/no-op provider state.

Evidence: `docs/nba-prediction-validation-settlement-v1.md`, `src/services/nba-prediction-validation.service.ts`, `src/services/nba-prediction-settlement.service.ts`, NBA validation/settlement/performance/model-health/backlog APIs and migration `202607110003`.

### NBA Backtesting & Calibration V1

Status: Completed and build verified. Production summaries are gated by Production Data Gate V1; trial rows are exposed only as technical validation evidence.

Evidence: `docs/nba-backtesting-calibration-v1.md`, `src/services/nba-backtesting-calibration.service.ts`, `/api/nba/predictions/backtest`, `/api/nba/predictions/backtest/run`, `/api/nba/predictions/calibration` and `NbaBacktestingCalibrationPanel`.

### Production Data Gate V1

Status: Completed and build verified.

Evidence: `src/services/production-data-gate.service.ts`, `docs/production-data-gate-v1.md`, Feature Store validation fixtures, production-only prediction-history filters in analytics/model/recommendation services, and NBA backtest/calibration `trialTechnicalValidation` sections.

Note: Trial rows can validate mechanics only. Real production import promotion still requires explicit approval and the first real-data validation plan in `docs/first-real-data-validation-plan-v1.md`.

### Recommendation Experience And Official Picks Readiness V1

Status: Completed readiness and build verified; official activation remains blocked.

Evidence: `src/services/recommendation-eligibility-policy.service.ts`, `docs/recommendation-eligibility-policy-v1.md`, `docs/pick-explanation-experience-v1.md`, `docs/official-picks-readiness-v1.md`, updated Top Picks, Play of the Day, parlay, optimizer, portfolio, daily report and MLB replay surfaces.

Note: Official Top Picks, Play of the Day, parlays, Kelly/bankroll/portfolio and Bet Slip Optimizer now consume only `QUALIFIED`, `BEST_BET_CANDIDATE` and `PLAY_OF_DAY_CANDIDATE` statuses from the shared policy. Calibration is probationary, automatic production approval is false, current official picks remain 0 and quarantined replay/preview rows remain excluded from production consumers.

### MLB Day 1 Product Consolidation V1

Status: Completed without provider calls and build verified.

Evidence: `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardShell.tsx`, `/api/daily-report?mode=summary`, `/api/features/store/validation`, `/api/historical-import/jobs`, `/api/predictions/by-sport?historicalValidation=true&validationMode=quarantined&sport=baseball_mlb&date=2026-07-12`.

Note: The dashboard is consolidated into Today, Model Lab, Data & Operations and Advanced surfaces so the default MLB workflow leads with daily status, official pick gates and quarantined replay instead of provider/debug sprawl. Advanced model tools, NBA readiness, provider contracts and inactive sport engines remain available behind collapsed groups. The consolidation audit verified the configured Supabase schema probes as applied, confirmed no running historical import jobs, preserved 45 quarantined July 12 MLB replay rows with 0 production-eligible rows and made 0 SportsDataIO provider calls or remote mutations.

### Pick Analyzer UX Consolidation & Semantic Cleanup V1

Status: Completed presentation pass and build verified.

Evidence: `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `src/components/dashboard/MarketIntelligenceSummaryPanel.tsx`, `src/components/dashboard/MlbPredictionEnginePanel.tsx`, `src/app/dashboard/page.tsx`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx` and display-only semantic cleanup in `src/services/ai-bet-finder.service.ts`.

Note: This pass intentionally made no provider calls, no remote mutations and no prediction-calculation changes. It clarified selected-side explanations, current-market metrics, official-picks-off messaging, final-odds refresh wording, AI rating display, historical replay defaults and consistent opportunity-card semantics.

### Betting Workbench V1

Status: Completed and build verified.

Evidence: `src/app/betting-workbench/page.tsx`, `src/components/market-opportunities/BettingWorkbenchTool.tsx`, and the Betting Workbench navigation links in `src/components/dashboard/DashboardShell.tsx`.

Note: Betting Workbench is a workspace layer over existing read-only APIs. It compares candidates by probability, confidence, AI rating, value, risk, rationale and recommendation; drafts preview or official-only tickets; explores supported markets with search/filter/sort; and stores favorites plus notes in browser localStorage. It does not mutate Top Picks, Recommendation Policy, Current Board, production data or provider state.

### Premium Tools Reliability And Visual QA V1

Status: Completed and build verified.

Evidence: `src/services/current-board.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/services/market-intelligence-engine.service.ts`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/ArbitrageTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx`, `src/components/market-opportunities/BettingWorkbenchTool.tsx`, `docs/current-board-intelligence-engine-v1.md`, `docs/best-value-scanner-v1.md`, `docs/ai-bet-finder-v1.md`, `docs/arbitrage-scanner-v1.md` and `docs/betting-workbench-v1.md`.

Note: This pass fixed timeout-prone broad selection by making premium tools consume the canonical Current Board and scoped odds reads. It added safe scanner states for Best Value and Arbitrage, query-understood metadata for AI Bet Finder, selection-aware explanations, mobile/tablet/desktop responsive hardening and screenshot-based QA evidence. It made 0 provider calls, 0 remote mutations, 0 prediction calculation changes, 0 official-pick changes and no Production Gate changes.

### MLB Day 1 Recovery Corrections V1

Status: Completed local recovery corrections; provider execution not started.

Evidence: `src/components/dashboard/DashboardShell.tsx`, `src/components/dashboard/AICommandCenterPanel.tsx`, `src/components/dashboard/DailyReportPanel.tsx`, `src/components/dashboard/MlbPredictionEnginePanel.tsx`, `src/components/dashboard/FeatureStoreCorePanel.tsx`, `src/components/dashboard/HistoricalImportEnginePanel.tsx`, `src/services/daily-report-fast.service.ts` and `src/services/historical-import-engine.service.ts`.

Note: Recovery audit confirmed the current API route count remains 205 and no provider calls or remote mutations were made during the correction pass. The dashboard now labels the product as Day 1 ready with official picks off, treats deterministic MLB engine previews as fixture validation, groups quarantined MLB historical replay rows by matchup, keeps AI recommendation detail collapsed when official picks are 0, exposes an MLB operational summary in the fast Daily Report, and distinguishes historical failed sync jobs from active import blockers. MLB 2025/2026 provider-backed historical enrichment was not executed because the existing protected historical-import execute path is still NBA-pilot-specific for live writes; safe MLB execution requires an MLB Discovery Lab executor with durable season/date/domain checkpoints before provider calls resume.

### Pick Analyzer Intelligence Suite V2

Status: Completed as read-only orchestration and build verified.

Evidence: `src/services/best-value-scanner.service.ts`, `src/services/ai-bet-finder.service.ts`, `/api/market-opportunities/best-value`, `/api/ai-bet-finder`, `/best-value`, `/ai-bet-finder`, `docs/best-value-scanner-v1.md` and `docs/ai-bet-finder-v1.md`.

Note: Best Value Scanner and AI Bet Finder consume Current Board as the trusted candidate source. They add optional premium workflows for Best Value, deterministic natural-language search, Compare, Explain/Why Not, Build My Ticket and What Changed. They made 0 provider calls, performed 0 remote mutations, did not alter prediction calculations, did not promote official picks and did not change Production Data Gate or Recommendation Eligibility Policy behavior. Current validation shows 0 positive modeled-value Best Value candidates by default, 3 no-modeled-value passes when shown, AI Bet Finder fixture validation 24/24 and official picks still 0.

### Market Intelligence Engine V1

Status: Completed as read-only orchestration and build verified.

Evidence: `src/services/market-intelligence-engine.service.ts`, `/api/market-intelligence`, `src/components/dashboard/MarketIntelligenceSummaryPanel.tsx` and `docs/market-intelligence-engine-v1.md`.

Note: Market Intelligence Engine scans Current Board candidates plus cataloged unavailable market families and returns availability, health, quality, confidence, classification, score, reason and explanation. It adds ranking modes for highest probability, EV, confidence, AI rating, lowest risk and best combined, plus explorer filters for sport, game, market, sportsbook, odds, risk, AI rating, confidence, edge, EV and recommendation. Current validation scans 16 markets, supports 3 current `NYM @ PHI` markets, marks all 3 current candidates as Pass, keeps 13 unavailable/future/blocked entries visible, passes fixtures 18/18, makes 0 provider calls and performs 0 remote mutations.

### Day 1 Recommendation Readiness V1

Status: Completed as read-only audit and build verified.

Evidence: `src/services/day1-recommendation-readiness.service.ts`, `/api/recommendation-readiness`, `src/components/dashboard/RecommendationReadinessPanel.tsx` and `docs/day1-recommendation-readiness-v1.md`.

Note: The readiness audit verifies the full Current Board -> Market Intelligence -> Recommendation Policy -> Top Picks -> AI Bet Finder -> Bet Slip -> Dashboard path using stored data only. Current result is 3 shared candidates, 0 official picks, Bet Slip `no_ticket`, 0 provider calls, 0 remote mutations and fixture validation 20/20. Candidate-level quality audit reports probability, confidence, reliability, AI rating, feature quality, data sufficiency, market stability, edge, EV, recommendation and explanation. Threshold review keeps Day 1 gates conservative; a tiny positive edge does not qualify. An in-memory excellent-value production simulation reaches `PLAY_OF_DAY_CANDIDATE`, proving automatic activation would work when every real gate is met without promoting current quarantined previews.

### MLB Discovery Lab Historical Import Executor V1

Status: Live executor and 2025 standings reconciliation checkpoint verified.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts` and `src/app/api/historical-import/execute/route.ts`.

Note: The existing protected execute route now dispatches `baseball_mlb` requests to an MLB Discovery Lab manifest with durable checkpoint identities in `sports_sync_jobs.metadata`, zero-call dry-run planning, completed-checkpoint skip behavior, quarantine flags and production gate closure. The first approved live unit called `GET /api/mlb/odds/json/Games/2026` once, received HTTP 200, fetched 2,456 provider records, inserted 2,441 new `sport_events`, inserted 2,441 provider mappings, reused/updated 30 teams, wrote completed sync job `dbd8ab2b-8351-4b3b-b5ff-3865d672a748`, and preserved `trial=false`, `scrambled=false`, `production_eligible=false`. The executor now uses the shared Discovery Lab URL resolver for app-path SportsDataIO calls; the 2025 `Standings` checkpoint was later reconciled after a single app-path `Teams` verification classified IDs `7` and `27` as non-schedule provider records. Current 2025 dry-run skips `Standings/2025` and selects `TeamSeasonStats/2025` as the next safe unit.

### MLB First Live Recommendations Operating Day V1

Status: Current slate analyzed; official bet correctly blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/app/api/historical-import/execute/route.ts`, `/api/current-board`, `/api/market-intelligence`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/ai-bet-finder`, `/api/predictions/top`, `/api/play-of-the-day` and `/api/daily-report?mode=summary`.

Note: The operating run completed `TeamSeasonStats/2025`, `PlayerSeasonStats/2025`, `GamesByDate/2026-JUL-16`, `GameOddsByDate/2026-07-16` and `PlayerGameProjectionStatsByDate/2026-JUL-16` with 5 provider calls and no raw payload storage. Current Board has 3 `NYM @ PHI` analyzed candidates using fresh odds at `2026-07-16T14:57:10Z`; Market Intelligence marks all current markets as passes; Best Value has 0 positive modeled-value rows; AI Bet Finder ticket building returns `NO TICKET TODAY`; Top Picks and Play of the Day remain empty. A distinct `operatingDayFinalRefresh` path is available for one final pre-cutoff odds refresh without reusing the completed operating-day odds checkpoint.

### Prospective Official Eligibility Gate V1

Status: Completed as zero-call policy/audit and protected exact-candidate action.

Evidence: `src/services/prospective-official-eligibility-gate.service.ts`, `/api/recommendation-readiness?eligibilityGate=true`, `/api/recommendation-readiness?validate=eligibilityGate`, protected `POST /api/recommendation-readiness`, and `docs/prospective-official-eligibility-gate-v1.md`.

Note: The gate distinguishes permanent validation rows from real prospective rows, preserves the strict calibration and recommendation thresholds, and represents `PROSPECTIVE_OFFICIAL_ELIGIBLE` as an audit state rather than a public pick. `PROSPECTIVE_OFFICIAL` requires exact candidate activation with prediction/event/snapshot/odds identity, model and feature versions, reason and idempotency key. Current `NYM @ PHI` rows remain not official because edge and EV are negative and calibration/confidence gates fail. Fixture validation proves an excellent future candidate would become eligible for review while insufficient calibration, stale odds, historical rows and tiny edge remain blocked.

### MLB Discovery Lab Season-Wide Completion V1

Status: Completed season-wide 2026 branches and one bounded date-domain pilot; bulk date import not started.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute` and `sports_sync_jobs` jobs `2aed3a85-768f-4a13-9b22-5ed93649879f`, `4cb59805-8f2e-4632-9afd-319b2df5c236`, `de7ed98f-1182-44b1-a030-330c6e186229` and `816ec464-e838-4e6e-aa62-f62f8bff74b4`.

Note: The resumed executor completed the three approved season-wide calls: `Standings/2026` persisted 30 standings plus 30 mappings, `TeamSeasonStats/2026` persisted 30 canonical `team_stats` rows, and `PlayerSeasonStats/2026` persisted 1,303 season `sport_player_stats` plus 1,303 mappings while preserving 708 unresolved player mappings as non-blocking evidence. The generated 2026 date ledger found 76 completed import-eligible dates. The first bounded date-domain pilot called `TeamGameStatsByDate/2026-MAR-26`, inserted 26 `sport_game_stats` rows and wrote a completed checkpoint. All rows remain quarantined with `production_eligible=false`; official picks, feature generation, predictions and bulk date import remain disabled.

### MLB Discovery Lab Date Import Batch V1

Status: Completed bounded 180-call 2026 date-domain import batch; feature sample blocked by missing complete settlement inputs.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, `docs/PROJECT_STATUS.md` and 180 completed `sports_sync_jobs` from `c4a42303-44f9-4951-b9cd-816216941742` through `a3b70538-42be-4157-ad7a-37d1bd6f02ba`.

Note: The batch resumed from `PlayerGameStatsByDate/2026-MAR-26`, used exactly 180 of 180 approved provider calls, completed 60 player-stat, 60 odds and 60 team-stat checkpoints, and stopped at the cap after `TeamGameStatsByDate/2026-MAY-25`. All endpoints returned HTTP 200. The batch persisted 1,614 `sport_game_stats` rows, 23,346 game `sport_player_stats` rows, 23,346 provider mappings, 4,824 `sports_odds_snapshots` rows and 180 sync-job checkpoints, with 0 duplicate logical rows, 0 orphan rows, 0 invalid odds fields, 0 live/alternate contamination and 0 production-eligible leakage. The exact next resume unit is `PlayerGameStatsByDate/2026-MAY-25`; 47 date-domain calls remain for the current 2026 ledger. The requested historical feature/prediction sample was not generated because the new batch had only 36 cutoff-safe odds rows across 6 events and 0 events with complete result/team-game-stat settlement inputs.

### MLB Discovery Lab Date Import Resume V2

Status: Partially completed; stopped on June 8 team-stat unresolved-event validation before retrying or promoting the checkpoint.

Evidence: `sports_sync_jobs` jobs from `6bbe3543-0a05-44d6-b2c0-bc8bf00c541f` through partial job `f3f6949d-8f39-4c91-8912-493df4a2a0c0`, plus `docs/PROJECT_STATUS.md`.

Note: The resume used 42 of 47 approved provider calls. Calls 1-41 completed through `GameOddsByDate/2026-06-07`; call 42 reached `TeamGameStatsByDate/2026-JUN-08`, returned HTTP 200, inserted 10 team-stat rows for all 5 persisted June 8 events, but remained partial because 3 provider records could not be mapped to persisted events and the skipped provider IDs were not preserved in metadata. The resume persisted 358 `sport_game_stats` rows, 5,504 game `sport_player_stats` rows, 5,504 provider mappings and 1,122 `sports_odds_snapshots` rows with 0 duplicate/orphan/invalid/live/alternate/production-leakage findings. Dry-run now reports 6 incomplete units beginning with the partial June 8 team-stat checkpoint. Feature/prediction generation was not run because the ledger is incomplete and a zero-provider eligibility audit found 0 eligible completed-window events.

### MLB Discovery Lab June 8/9 Checkpoint Completion V1

Status: Completed through the approved June 8/9 ledger; feature generation blocked by cutoff-safety.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, completed sync jobs `182965b6-9e70-4f11-a376-8dc112d6c9fd`, `e87f15ef-128e-4e67-b8e7-890c07b9025b`, `50cad854-ae08-4ca1-9770-141d1fa3d142`, `551bd293-d8c3-4aa3-926b-02849bb30577`, `e5ae21a5-a426-4b40-a774-04770a428492`, `8dd683f0-180a-4674-9323-0ce623c125d5` and `docs/PROJECT_STATUS.md`.

Note: The paginated event resolver fixed the June 8 partial checkpoint safely. The final retry of `TeamGameStatsByDate/2026-JUN-08` reused the existing 10 rows, inserted the 6 missing rows and completed with 0 unresolved teams/events. The continuation completed `PlayerGameStatsByDate/2026-JUN-08`, `GameOddsByDate/2026-06-08`, `TeamGameStatsByDate/2026-JUN-09`, `PlayerGameStatsByDate/2026-JUN-09` and `GameOddsByDate/2026-06-09`, for 6 total HTTP 200 provider calls in this completion pass. The pass inserted 36 new `sport_game_stats` rows, 1,448 `sport_player_stats` rows, 1,448 player-stat provider mappings and 138 `sports_odds_snapshots` rows, with 0 duplicate/orphan/invalid/live/alternate/production-leakage findings. Dry-run now reports no pending June 8/9 units. Feature snapshots, predictions and settlement updates were not generated because a zero-provider eligibility audit found 0 cutoff-safe odds events and 0 eligible feature events in the completed May 25 through June 9 window.

### MLB Historical Foundation 2026 Completion And 2025 Checkpoint V1

Status: Partially completed; 2026 date-domain ledger complete, 2025 safely stopped on standings mapping ambiguity.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, completed sync jobs from `a91f963b-194c-4372-a02c-2ac802736583` through `a73baa79-52a0-4d07-82fe-70f67cb1cb16`, 2025 schedule job `6654651b-948e-481e-94e6-0b61b59de3fb`, partial standings job `61d79b52-1c60-4997-8e32-891a35f6cc07` and `docs/PROJECT_STATUS.md`.

Note: The guarded resume completed the remaining 2026 imported game dates through July 12. A failed `TeamGameStatsByDate/2026-JUL-12` attempt exposed that MLB team game stats must upsert against the deployed natural unique key `sport_key,event_id,team_id`, not only deterministic `id`; the executor now uses that key and the repaired retry reused/updated 30 existing July 12 team-stat rows without duplicating persistence. Final 2026 dry-run reports `estimatedCalls=0` and `nextIncompleteUnit=null`. The 2025 import started with `Games/2025`, which completed with HTTP 200 and built the regular-season date ledger. `Standings/2025` returned HTTP 200 and inserted 60 normalized rows, but remains partial because 2 provider standing records could not be mapped to stored teams. Further 2025 team/player/odds imports, recalibration, official picks and production promotion are blocked until that mapping ambiguity is reviewed without provider calls.

### MLB Standings/2025 Partial Checkpoint Resume V1

Status: Safely stopped; exact unresolved provider team IDs captured, no deterministic local repair.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, partial jobs `61d79b52-1c60-4997-8e32-891a35f6cc07` and `adbf4908-71fb-4800-8f62-0af23e753a64`, and `docs/PROJECT_STATUS.md`.

Note: Zero-provider audit proved the 30 persisted 2025 schedule teams already have canonical team rows, provider mappings and 2025 standings rows. The original partial checkpoint did not retain the skipped provider IDs, so season-wide validation metadata now records sanitized unresolved IDs. The single approved `Standings/2025` retry used one provider call, returned HTTP 200, reused/updated the existing 60 normalized standing/mapping rows and captured unresolved provider team IDs `7` and `27`. Read-only evidence found no persisted 2025 events, `sports_teams` rows or provider mappings for those IDs. No synthetic teams, broad mapping changes, feature generation, calibration, official picks or production promotion were performed. The next safe action is external/provider identity confirmation for IDs `7` and `27` or an explicit non-team skip rule before any further 2025 import.

### MLB Prospective Slate Capture And First Model Preview V1

Status: Completed for the first selected future slate; official picks remain blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/historical-import/execute`, `/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true`, `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `src/app/dashboard/page.tsx`, completed SportsDataIO prospective checkpoints and `docs/PROJECT_STATUS.md`.

Note: The first prospective capture selected `2026-07-16`, used 3 of 6 approved provider calls with HTTP 200 statuses for `GamesByDate/2026-JUL-16`, `GameOddsByDate/2026-07-16` and `PlayerGameProjectionStatsByDate/2026-JUL-16`, and persisted 6 genuine pregame `Consensus` odds rows for `NYM @ PHI`. The projections endpoint returned 0 rows, so pitcher, lineup, injury, weather and bullpen domains remain explicit unavailable warnings rather than fabricated features. The local-only feature/prediction resume inserted or reused 3 prospective feature snapshots and 3 linked preview predictions, then reran idempotently with 3 snapshots and 3 predictions reused. All rows are non-trial, non-scrambled, quarantined and `production_eligible=false`; official picks, Play of the Day, parlays, Kelly, bankroll, portfolio, settlement, model training and production promotion remain off. Safety validation found 0 duplicate snapshots, 0 duplicate predictions, 0 orphan links, 0 official picks and 0 production leakage. The Today dashboard now exposes `MLB MODEL PREVIEW` separately from historical replay.

### MLB Prospective Final Pregame Refresh V1

Status: Completed for the `2026-07-16` slate; official picks remain blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/historical-import/execute`, completed checkpoint `ec1bf8f7-0126-46b6-877e-76afe07112b6`, `/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true` and `docs/PROJECT_STATUS.md`.

Note: The final bounded pregame refresh used exactly 1 provider call to `GameOddsByDate/2026-07-16`, returned HTTP 200, inserted 6 new timestamped pregame `Consensus` odds rows at `2026-07-15T19:57:26Z`, and preserved the initial `2026-07-15T19:03:13Z` capture. Local snapshot/prediction refresh then reused the completed odds checkpoint without another provider call, leaving 6 prospective snapshots and 3 logical preview predictions tied to the latest safe odds. All three rows remained `ANALYZED_ONLY`; official Top Picks stayed 0, Play of the Day stayed none, Bet Slip stayed `no_ticket`, and safety checks found 0 duplicates, 0 orphan links and 0 production leakage.

### MLB Prediction Intelligence V1

Status: Completed for quarantined prospective previews; official picks remain blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/prediction-history.service.ts`, `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true` and `docs/PROJECT_STATUS.md`.

Note: The prospective model now derives baseball-specific intelligence from already imported rows only: last 3/5/10 and season form, home/away split, opponent difficulty, rest/schedule density, momentum, explicit bullpen-unavailable status, Team Strength Index, confidence label, reliability score, AI rating/grade, ranking score, market stability and baseball-language factors. The Team Strength Index formula is `0.30 season win pct + 0.20 last-10 win pct + 0.20 per-game run differential + 0.10 home/away split + 0.10 opponent difficulty + 0.10 rest score`. The local recompute made 0 provider calls, created immutable `mlb_prediction_intelligence_v1` snapshot lineage for the existing final odds, kept all visible previews `ANALYZED_ONLY`, and reran idempotently with 3 snapshots reused and 3 predictions reused. Missing MLB domains remain starting pitcher, confirmed lineup, injury diagnosis, weather and derivable bullpen context before official recommendations can be considered.

### Pick Analyzer User Experience And Betting Intelligence V2

Status: Completed as presentation-only UX polish; official picks remain blocked.

Evidence: `src/app/dashboard/page.tsx`, `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `src/components/dashboard/TopPicksPanel.tsx`, `src/components/dashboard/PickExplanationCard.tsx`, `src/components/dashboard/BetSlipOptimizerPanel.tsx`, `src/components/dashboard/MlbPredictionEnginePanel.tsx` and `docs/PROJECT_STATUS.md`.

Note: The dashboard now leads with the user question `Should I Bet Today?` and translates internal statuses into `GOOD BET`, `WATCH`, `NO VALUE` and `PASS` presentation labels while preserving internal recommendation enums. MLB preview cards separate model opinion from bet value, use `Sportsbook thinks` and `Pick Analyzer thinks`, group explanations into `Why We Like It`, `Why We Don't` and `Missing Information`, and keep edge, EV, feature quality, sufficiency, cutoff, timestamps and lineage under `Advanced Details`. Top Picks, Bet Slip, Pick Explanation and Historical Replay now use consumer wording and educational flows without changing recommendation policy, model calculations, provider integrations, persistence or production gates. Data Ops opens with a simple system-health summary and collapses engineering surfaces.

### Pick Analyzer Market Opportunity Suite V1

Status: Completed as optional read-only tools; no workflow or recommendation policy changes.

Evidence: `src/services/market-opportunity-suite.service.ts`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/arbitrage`, `src/app/most-likely/page.tsx`, `src/app/arbitrage/page.tsx`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/ArbitrageTool.tsx`, `src/components/dashboard/DashboardShell.tsx` and `docs/PROJECT_STATUS.md`.

Note: The suite adds separate `Most Likely` and `Arbitrage` navigation items as extra utilities. Most Likely ranks stored prediction rows by probability first and supports alternate user sorts without feeding Top Picks, Bet Slip, Play of the Day or official picks. Arbitrage scans stored odds only and refuses guaranteed-arbitrage claims unless all outcomes are covered for the same game, market, period/rules and fresh verified sportsbook prices with positive margin. Current validation used 0 provider calls and 0 remote mutations: Most Likely returned stored rows; Arbitrage returned unavailable because the current stored data does not expose verified multi-book pricing. Notification controls are UI placeholders only and do not create a backend notification service.

Correction: Most Likely now defaults to `Current Board` instead of all stored rows. The default board requires future/unstarted current-slate candidates, latest non-superseded prediction rows, latest safe pregame odds before start/cutoff, deduplication by sport/event/market/period/selection/model version, and exclusion of historical, settled, stale, live/alternate, fixture and legacy-unlinked rows. Explicit modes are `Current Board`, `Upcoming`, `Historical Explorer` and advanced `All Stored Data`. Current validation returned the `NYM @ PHI` 2026-07-16 preview slate only, with 3 analyzed candidates across moneyline, run line and total, 0 qualified official picks, 0 provider calls and 0 remote mutations.

### Current Board Intelligence Engine V1

Status: Completed as canonical read-only candidate selection.

Evidence: `src/services/current-board.service.ts`, `/api/current-board`, `src/services/market-opportunity-suite.service.ts`, `src/services/daily-report-fast.service.ts`, `docs/current-board-intelligence-engine-v1.md` and `docs/PROJECT_STATUS.md`.

Note: Current Board is the shared source for "what valid betting candidates exist right now" and does not create a prediction engine, recommendation policy or production promotion path. Default `CURRENT` mode includes only future/unstarted current-slate candidates with valid event and snapshot linkage, latest safe pregame odds before cutoff/start, supported markets, no stale/live/alternate/fixture/historical/settled/legacy rows and no duplicate logical candidate. Most Likely now consumes Current Board and only ranks/presents candidates. Daily Report Today counts now use Current Board for slate games, current odds, analyzed candidates, modeled-value candidates, watch candidates, qualified previews, official picks, latest odds and next refresh action. Official consumers still require Production Data Gate V1 plus Recommendation Eligibility Policy V1. Current validation returned `NYM @ PHI`, 3 analyzed preview candidates, 0 official picks, fixture validation 20/20, 0 provider calls and 0 remote mutations.

### NBA Data Quality And Historical Reconciliation Phase A

Status: Completed and build verified.

Evidence: `docs/nba-data-quality-reconciliation-phase-a.md`, `src/services/nba-data-quality.service.ts`, `/api/nba/data-quality`, `/api/nba/data-quality/issues`, `/api/nba/data-quality/coverage`, `/api/nba/reconciliation/plan`, `/api/nba/reconciliation/status` and `NbaDataQualityPanel`.

### NBA Multi-Book Comparison V1

Status: Completed stored-data architecture and build verified.

Evidence: `docs/nba-multi-book-comparison-v1.md`, `src/services/nba-multi-book-comparison.service.ts`, `/api/nba/markets/multi-book` and `NbaMultiBookComparisonPanel`.

Note: The module returns a typed empty response when no NBA odds snapshots exist. Real best-price opportunity volume depends on future stored odds coverage.

### NBA Steam Move Detection V1

Status: Completed stored-data architecture and build verified.

Evidence: `docs/nba-steam-move-detection-v1.md`, `src/services/nba-steam-move-detection.service.ts`, `/api/nba/markets/steam` and `NbaSteamMovePanel`.

Note: The module returns typed empty or insufficient-history responses when stored NBA odds snapshots are unavailable or too shallow. Real steam signals depend on future repeated stored odds snapshots.

### Provider Intelligence V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/provider-intelligence-v1.md`, `src/services/provider-intelligence.service.ts`, `/api/providers/intelligence`, `/api/providers/capabilities`, `/api/providers/route-plan` and `ProviderIntelligencePanel`.

Note: The module uses static registry and environment configuration only. It makes zero provider calls and supports dry-run routing decisions.

### Global Data Quality Framework V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/global-data-quality-framework-v1.md`, `src/services/global-data-quality.service.ts`, `/api/data-quality/global`, `/api/reconciliation/plan` and `GlobalDataQualityPanel`.

Note: The module is read-only and dry-run only. It identified stored-state issues and estimated provider calls without executing any provider work.

### API Contract Hardening V1

Status: Completed representative adoption and build verified.

Evidence: `docs/api-contract-hardening-v1.md`, `src/lib/api-contract.ts`, hardened provider intelligence routes, hardened global data quality routes and typed bad-request validation.

Note: This is a gradual adoption layer, not a risky whole-repository route rewrite.

### Runtime Observability V1

Status: Completed read-only aggregation and build verified.

Evidence: `docs/runtime-observability-v1.md`, `src/services/runtime-observability.service.ts`, `/api/observability/runtime` and `RuntimeObservabilityPanel`.

Note: The module uses existing storage only. Persisted request-duration and warning-event history are future additive enhancements.

### Sync Reliability Framework V1

Status: Completed additive framework and build verified.

Evidence: `docs/sync-reliability-framework-v1.md`, `src/services/sync-reliability.service.ts`, `/api/sync/reliability` and `SyncReliabilityPanel`.

Note: The framework is available for incremental adoption. Existing provider-backed sync flows were not mass-rewritten.

### Prediction Safety Framework V1

Status: Completed additive framework and build verified.

Evidence: `docs/prediction-safety-framework-v1.md`, `src/services/prediction-safety.service.ts`, `/api/prediction-safety` and `PredictionSafetyPanel`.

Note: NBA Prediction Validation V1 remains unchanged. The generic safety checks are available for incremental adoption and future sports.

### Settlement Core V2

Status: Completed additive framework and build verified.

Evidence: `docs/settlement-core-v2.md`, `src/services/settlement-core.service.ts`, `/api/settlement/core` and `SettlementCorePanel`.

Note: NBA Prediction Settlement V1 remains unchanged. Shared settlement primitives are available for incremental adoption.

### Model Metrics Framework V1

Status: Completed computed framework and build verified.

Evidence: `docs/model-metrics-framework-v1.md`, `src/services/model-metrics-framework.service.ts`, `/api/model/metrics` and `ModelMetricsFrameworkPanel`.

Note: Metrics are computed from stored `prediction_history`. Persisted metric snapshots are future optional work.

### Historical Import Engine Core V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/historical-import-engine-core-v1.md`, `src/services/historical-import-engine.service.ts`, `/api/historical-import/plan`, `/api/historical-import/health`, `/api/historical-import/jobs` and `HistoricalImportEnginePanel`.

Note: The module is dry-run only. It plans season/date-range checkpoints, idempotency, deduplication, provider routing and quota estimates without external provider calls or migrations.

### Provider Adapter SDK V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/provider-adapter-sdk-v1.md`, `src/services/provider-adapter-sdk.service.ts`, `/api/providers/sdk`, `/api/providers/sdk/validation` and `ProviderAdapterSdkPanel`.

Note: The module defines provider contracts, capability declarations, auth shape, pagination, rate-limit hints, retry hints, normalization rules and fixture validation without external provider calls.

### SportsDataIO Adapter Contract V1

Status: Completed contract-only architecture and build verified.

Evidence: `docs/sportsdataio-adapter-contract-v1.md`, `src/services/sportsdataio-adapter-contract.service.ts`, `/api/providers/sportsdataio/contract`, `/api/providers/sportsdataio/validation` and `SportsDataIoContractPanel`.

Note: The module maps SportsDataIO-style concepts into Provider Adapter SDK contracts and normalized models. Live calls are disabled, credentials are not required, and validation uses local fixtures only.

### SportsDataIO Historical Import Execution Readiness V1

Status: Completed execution architecture and deterministic validation.

Evidence: `docs/sportsdataio-historical-import-execution-readiness-v1.md`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/providers/sportsdataio/status`, `/api/providers/sportsdataio/capabilities`, `/api/providers/sportsdataio/execution-readiness/validation`, `/api/historical-import/execute`, `/api/historical-import/resume`, `/api/historical-import/cancel`, `/api/historical-import/jobs/[jobId]`, `/api/historical-import/pilot-plan`, `/api/historical-import/validate/[jobId]` and `HistoricalImportEnginePanel`.

Note: The module prepares server-only SportsDataIO execution architecture with hard caps, dry-run defaults, resume/cancel contracts, validation contracts, a zero-call execution-readiness validation API, pilot planning and dashboard guardrails. `HistoricalImportEnginePanel` also displays the execution-readiness validation packet with pass counts, closed guardrail statuses, pre-transport live-shape rejection and the one-to-many counter fixture. The initial 401 on `GamesByDate` was resolved during NBA Pilot Import V1. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE` and `PILOT_IMPORT_COMPLETE_FOR_APPROVED_TRIAL_SCOPE`.

### SportsDataIO NBA Pilot Import V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-pilot-import-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions`.

Note: The module validated SportsDataIO `Teams` and `GamesByDate/2025-DEC-25` with 2 external calls, fetched 35 trial/scrambled records, updated 30 existing NBA team rows with SportsDataIO pilot provenance, inserted 35 provider mappings, inserted 5 trial events, persisted 4 completed scores and recorded sync-job observability. Trial events and mappings are marked `trial=true`, `scrambled=true` and `production_eligible=false`; NBA prediction generation and validation exclude them from production predictions. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PILOT_IMPORT_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `REAL_DATA_RECONCILIATION_PENDING`.

### SportsDataIO NBA Pilot Import V2

Status: Completed capped live trial verification and build verified.

Evidence: `docs/sportsdataio-nba-pilot-import-v2.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs`, `/api/nba/data-quality`, `/api/nba/data-quality/coverage` and `/api/nba/features/preview`.

Note: The V2 verification rerun for `2025-DEC-26` used 4 external calls and reached GamesByDate, standings, team season stats and team game stats. It fetched 87 records, normalized 87 records, inserted 18 game-stat rows, updated existing events, standings, team stats and mappings idempotently, skipped 0 records, recorded 0 errors and completed the latest sync job. Trial rows remain `trial=true`, `scrambled=true` and `production_eligible=false`; production prediction queries returned zero trial leaks. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PILOT_IMPORT_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE`, `GAME_STATS_PERSISTENCE_COMPLETE` and `REAL_DATA_RECONCILIATION_PENDING`.

### SportsDataIO NBA Injuries Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-injuries-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions/health`.

Note: The successful import execution called `/v3/nba/projections/json/InjuredPlayers` once, fetched 6 trial/scrambled records, normalized 6 injuries, inserted 6 `sport_injuries` rows, inserted 6 injury provider mappings, skipped 0 records, preserved 2 unresolved players and 2 unresolved teams as warnings and recorded 0 row errors. Injury and mapping rows carry `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_injuries_pilot_v1`. Completion labels are `LIVE_PROVIDER_VALIDATION_COMPLETE`, `INJURY_PERSISTENCE_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `PRODUCTION_CONFIDENCE_LEAKAGE_BLOCKED`.

### NBA Injury and Lineup Confidence Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nba-injury-lineup-confidence-integration-v1.md`, `src/services/nba-injury-lineup-confidence.service.ts`, enriched `src/services/nba-feature-store-integration.service.ts`, `src/services/nba-prediction-engine.service.ts`, `src/services/prediction-safety.service.ts`, `src/services/nba-prediction-settlement.service.ts`, `NbaFeatureStoreIntegrationPanel` and `NbaPredictionEnginePanel`.

Note: The module consumes stored `sport_injuries` rows and static provider configuration state only. Trial/scrambled injuries cannot improve production confidence, stale/unresolved rows create warnings and penalties, missing lineups remain explicit unavailable context, no predictions are persisted and no provider calls are made.

### SportsDataIO NBA Players Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-players-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions/health`.

Note: The successful import execution called `Players` once, fetched 579 trial/scrambled records, normalized 579 players, inserted 579 `sport_players` rows, inserted 579 player provider mappings, skipped 0 records and recorded 0 row errors. Player and mapping rows carry `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_players_pilot_v1`. The module also hardened Supabase preflight reads by chunking large `.in()` requests. Completion labels are `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PLAYER_MAPPING_PERSISTENCE_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `PROP_AND_LINEUP_USAGE_BLOCKED`.

### SportsDataIO NBA Depth Charts And Starting Lineups Pilot V1

Status: Completed capped live verification and build verified.

Evidence: `docs/sportsdataio-nba-depth-lineups-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/nba-injury-lineup-confidence.service.ts` and `supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql`.

Note: The guarded execution path for `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26` completed with exactly 2 external calls, trial isolation, no prediction persistence, no backtesting and no model training. The `sport_lineups` migration is applied remotely and the service upserts lineup/depth relationship rows by `sport_lineups.id`. Payload Normalization V1 added sanitized payload-shape summaries, nested player-row flattening, home/away lineup context, position-group depth context and duplicate upsert-batch prevention. The verified rerun persisted 758 `sport_lineups` rows and 758 provider mappings, preserved 54 unresolved player references safely, completed sync job `ae45b0bd-57d9-4f58-9095-0f014781185c`, blocked production confidence leakage and kept trial rows excluded from production predictions. Historical Import Reporting Counter Fix V1 keeps `records_skipped` nonnegative and separately reports provider records, normalized rows, skipped provider records and skipped normalized rows for future one-to-many imports.

### SportsDataIO NBA Player Stats Readiness V1

Status: Completed readiness and build verified; capped live pilot completed.

Evidence: `docs/sportsdataio-nba-player-stats-readiness-v1.md`, `src/services/sportsdataio-nba-player-stats-readiness.service.ts`, `/api/providers/sportsdataio/nba/player-stats/readiness`, `/api/providers/sportsdataio/nba/player-stats/migration-preflight`, `supabase/migrations/202607130002_sport_player_stats_v1.sql`, `src/services/provider-adapter-sdk.service.ts`, `src/services/sportsdataio-adapter-contract.service.ts` and `src/services/sportsdataio-runtime-adapter.service.ts`.

Note: The module adds the additive `sport_player_stats` persistence contract for player season and player game stat rows, corrects provider metadata so `player_stats` is distinct from roster `players`, validates deterministic fixture normalization and returns migration preflight queries plus go/no-go gates through readiness and direct migration-preflight APIs. The confirmed paths are `/v3/nba/stats/json/PlayerSeasonStats/{season}` and `/v3/nba/stats/json/PlayerGameStatsByDate/{date}`. It does not enable production confidence improvement.

### SportsDataIO NBA Player Stats Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-player-stats-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/sportsdataio-nba-player-stats-readiness.service.ts`, `src/services/sportsdataio-nba-trial-isolation-audit.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview`, `/api/nba/features/validation` and `supabase/migrations/202607130002_sport_player_stats_v1.sql`.

Note: The approved pilot called `PlayerSeasonStats/2026` and `PlayerGameStatsByDate/2025-12-26` sequentially with no retry and exactly 2 provider calls. It persisted 918 trial-isolated `sport_player_stats` rows, including 602 season rows and 316 game rows, plus 918 provider mappings. It preserved 203 unresolved player mappings safely, found zero unresolved teams/events, zero duplicate row IDs, zero duplicate mapping keys, zero trial-isolation violations and zero production leakage. Sync job `777f9ac7-efeb-4396-a007-259557dfdcf8` is completed after a local post-persistence audit compatibility fix; no provider retry was made.

### NBA Data Quality Player Stats Expansion V1

Status: Completed zero-call audit expansion and build verified.

Evidence: `docs/nba-data-quality-player-stats-expansion-v1.md`, `src/services/nba-data-quality.service.ts` and existing `/api/nba/data-quality`, `/api/nba/data-quality/issues`, `/api/nba/data-quality/coverage`, `/api/nba/reconciliation/plan` and `/api/nba/reconciliation/status` routes.

Note: The read-only NBA data-quality audit now includes player identity coverage, duplicate player keys, unresolved player-team links, optional `sport_player_stats` coverage, duplicate player-stat natural keys, missing event/team/player references, season mismatches and trial production-eligibility violations. If the additive `sport_player_stats` migration is not applied yet, the audit reports an informational unavailable-table issue instead of failing the whole quality report.

### NBA Player Stats Feature Quality Integration V1

Status: Completed zero-call Feature Store and data-quality integration; build verified.

Evidence: `src/services/feature-store-core.service.ts`, `src/services/multi-sport-feature-registry.service.ts`, `src/services/nba-feature-store-integration.service.ts`, `src/services/nba-data-quality.service.ts`, `src/components/dashboard/NbaFeatureStoreIntegrationPanel.tsx`, `/api/nba/features/store`, `/api/nba/features/preview`, `/api/nba/features/validation`, `/api/nba/data-quality`, `/api/nba/data-quality/coverage` and `/api/nba/data-quality/issues`.

Note: The module adds `player_stats_context` as an optional Feature Store feature, registers it for NBA moneyline/spread/total feature sets, reads stored `sport_player_stats` rows into NBA feature previews and dashboard summaries, and keeps trial player stats from improving production confidence. The existing NBA data-quality APIs now also audit stored injuries and lineups for unresolved mappings, stale feeds, duplicate lineup keys, invalid depth order and trial/production contamination. No routes, migrations or provider calls were added.

### NBA Daily Sync Orchestration Contract V1

Status: Completed zero-call orchestration contract and build verified.

Evidence: `src/services/nba-data-sync.service.ts`, `src/components/dashboard/NbaDataSyncPanel.tsx`, `/api/nba/sync/status` and `/api/nba/data-health`.

Note: The existing sync status and data-health responses now expose an ordered daily NBA workflow covering schedules, results, injuries, lineups, team stats, player stats, Feature Store preview, prediction preview, settlement and data-quality audit. The contract declares route, method, protection, mutation, checkpoint, idempotency key, provider-call default, concurrency and production safety gates for each step. No new route, provider call, migration or cosmetic dashboard module was added.

### NBA Daily Sync Orchestrator V2

Status: Completed compatibility-preserving dry-run/read-only orchestrator and build verified.

Evidence: `src/services/daily-pipeline.service.ts`, existing `/api/cron/daily-sync`, `/api/nba/features/preview`, `/api/nba/predictions`, `/api/nba/predictions/model-health` and `/api/nba/data-quality`.

Note: The existing cron route now accepts `version=2` to return `daily_sync_orchestrator_v2` with dry-run defaults, provider-call budget checks, concurrency `1`, no automatic retries, checkpoint/resume/cancel metadata and dependency-aware execution planning across the 10-step NBA workflow. Runtime validation used `dryRun=true` and `providerCallBudget=0`, returned 10 steps, made 0 provider calls, left production gates closed for trial-only or externally blocked domains and kept prediction persistence disabled.

### Historical Import Multi-Sport Planning V1

Status: Superseded by V2 additive planning contract and build verified.

Evidence: `src/services/historical-import-engine.service.ts`, existing `/api/historical-import/plan` and `docs/historical-import-engine-core-v1.md`.

Note: The existing historical import planner now returns `historical_import_multi_sport_planning_v2` for NBA, MLB, NFL, NHL and soccer without adding routes, migrations or provider calls. Each sport plan declares supported domains, dependency order, V2 domain manifests, destination tables, natural keys, conflict targets, request caps, provider-call accounting, record accounting, checkpoint/resume strategy, trial isolation defaults, data-quality/Feature Store/prediction-preview handoffs and sport-specific warnings. Domain manifests distinguish current API, recent historical feeds, archive-required, unsupported, entitlement-blocked, migration-pending and trial-only execution states without inventing endpoint paths. Live execution remains blocked pending provider, quota, exact endpoint/date-window and production-promotion approvals.

### Production Readiness Phase 1 - Historical Import Engine V2 Planning

Status: Completed first shared-layer increment and build verified.

Evidence: `src/services/historical-import-engine.service.ts`, existing `/api/historical-import/plan` and `docs/historical-import-engine-core-v1.md`.

Note: The V2 planning increment adds NBA to the shared multi-sport manifest, exposes a dependency graph, season/date/week/competition scope metadata, provider-call and maximum-record budgets, stable ID components, one-to-many expansion flags and deterministic validation for priority-sport coverage, concurrency `1`, retries disabled, trial isolation defaults, stable dependency indexes and nonnegative counters for the 39 provider records -> 758 normalized rows fixture. It makes zero provider calls, adds no API routes and creates no migration.

### Historical Feature Generation Orchestrator V1

Status: Completed dry-run contract and build verified; durable persistence handoff now uses runtime schema probing.

Evidence: `docs/historical-feature-generation-orchestrator-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store/validation`, existing `/api/historical-import/plan`, `src/services/nba-data-sync.service.ts`, `src/services/daily-pipeline.service.ts` and `src/services/nba-backtesting-calibration.service.ts`.

Note: The orchestrator plans leakage-safe historical pregame feature snapshots from persisted normalized records only. It defines deterministic snapshot IDs, sport/event/market/cutoff/model/feature-set identity, trial/scrambled/production flags, lineage metadata, checkpoint/resume/cancel contracts, partial-failure isolation, nonnegative counters and a typed backtest input readiness contract. The deterministic suite covers leakage and persistence cases including cutoff inclusivity, post-cutoff rows, final scores, postgame player stats, injuries/lineups after cutoff, closing lines, trial rows in production generation, missing timestamps, deterministic regeneration, changed-lineage distinct keys, linked-snapshot immutability, batch dedupe, ROI/CLV blockers and cancellation/resume determinism. Runtime schema probing now distinguishes migration-file presence from remote schema application. Provider calls remain 0 and no route was added.

### Historical Feature Snapshot Persistence V1

Status: Implemented, runtime schema verified against the configured Supabase project and build verified.

Evidence: `supabase/migrations/202607140001_historical_feature_snapshots_v1.sql`, `docs/historical-feature-snapshot-persistence-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store/validation`, existing `/api/historical-import/plan`, `src/services/nba-data-sync.service.ts`, `src/services/daily-pipeline.service.ts` and `src/services/nba-backtesting-calibration.service.ts`.

Note: The migration creates generic `historical_feature_snapshots` persistence and adds `prediction_history.feature_snapshot_id` plus companion lineage columns. Service contracts now use a server-only Supabase schema probe and report `applied` only when required tables/columns are selectable. The existing Feature Store route now supports a bounded write-mode pilot that inserted 15 NBA trial snapshots on first execution and reused all 15 on immediate rerun, with zero provider calls, zero duplicate rows and zero prediction mutations. Production backtesting, ROI, CLV and calibration remain blocked until real prediction rows are linked to durable snapshots and have valid prices, closing snapshots and sufficient settled production samples.

### Historical Feature Trial Lineage Pilot V1

Status: Completed as a bounded trial-only lineage verification and build verified.

Evidence: `docs/historical-feature-trial-lineage-pilot-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store`, existing `/api/historical-import/plan`, `src/services/daily-pipeline.service.ts`, `src/services/nba-backtesting-calibration.service.ts` and `src/services/nba-prediction-settlement.service.ts`.

Note: The bounded pilot now prioritizes odds-enriched trial snapshots from the local snapshot pool while still considering at most 15 snapshots. After the corrected priced odds retry and legacy-moneyline cleanup, the first lineage execution found 5 eligible trial candidates, inserted 5 prediction rows, settled them locally as 3 wins and 2 losses, and the immediate rerun reused all 5 rows with 0 inserts. Provider calls remained 0. The rows remain `trial=true`, `scrambled=true`, `production_eligible=false`, so production recommendations, ROI, CLV, calibration, model promotion and confidence improvement remain blocked.

### NBA Trial Validation Batch V1

Status: Completed bounded technical trial validation and build verified.

Evidence: `docs/nba-trial-validation-batch-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store`, existing `/api/nba/predictions/backtest`, existing `/api/settlement/core` and existing NBA market/readiness endpoints.

Note: The batch reused the existing Feature Store actions with no new routes, no migrations and 0 provider calls. It generated 27 market-specific trial snapshots across 9 completed SportsDataIO NBA events, verified snapshot idempotency by reusing all 27 on rerun, inserted 22 new trial predictions while reusing the 5 prior linked predictions, then reused all 27 on immediate prediction rerun. Final linked trial state is 27 settled predictions: 9 moneyline, 9 spread and 9 total, with 9 wins, 18 losses, 0 pushes, 0 voids, 0 duplicate prediction identities, 0 duplicate snapshot links and 0 production leakage. The result is technical trial validation only; production ROI, CLV, calibration and model promotion remain blocked.

### Settlement Core Multi-Sport Fixture Coverage V1

Status: Completed deterministic fixture expansion and build verified.

Evidence: `src/services/settlement-core.service.ts`, existing `/api/settlement/core` and `docs/settlement-core-v2.md`.

Note: The existing settlement core status now includes multi-sport deterministic fixtures for NBA, MLB, NFL, NHL and Soccer. It covers moneyline/spread/total equivalents, first-half/quarter/period contracts, overtime/extra-innings inclusion, push and void scenarios. Soccer draw, double chance, extra-time/penalties and two-leg aggregate remain contract-only when dedicated result-type metadata is missing. Props remain contract-only until grading feeds and settlement rules are proven. No route, provider call or migration was added.

### SportsDataIO NBA Player Props Readiness V1

Status: Completed zero-call readiness and build verified; live prop pilot blocked pending endpoint, market, entitlement and settlement confirmation.

Evidence: `docs/sportsdataio-nba-player-props-readiness-v1.md`, `src/services/sportsdataio-nba-player-props-readiness.service.ts`, `/api/providers/sportsdataio/nba/player-props/readiness`, `/api/providers/sportsdataio/nba/player-props/endpoint-preflight`, `src/services/provider-adapter-sdk.service.ts`, `src/services/sportsdataio-adapter-contract.service.ts`, `src/services/sportsdataio-runtime-adapter.service.ts` and `src/services/historical-import-engine.service.ts`.

Note: The module adds `player_props` to contract/runtime/import-planning readiness and validates a deterministic local over/under prop fixture with zero provider calls. It now returns endpoint and settlement preflight gates through readiness and direct endpoint-preflight APIs. It uses existing `sports_odds_snapshots` as the future persistence target with player/event metadata, creates no migration and keeps production prediction, backtesting, model training and settlement disabled.

### SportsDataIO NBA Odds Readiness V1

Status: Completed zero-call readiness and build verified.

Evidence: `docs/sportsdataio-nba-odds-readiness-v1.md`, `src/services/sportsdataio-nba-odds-readiness.service.ts`, `/api/providers/sportsdataio/nba/odds/readiness`, `/api/providers/sportsdataio/nba/odds/endpoint-preflight` and existing `sports_odds_snapshots` migration `supabase/migrations/202607110001_nba_data_sync_v1.sql`.

Note: The module validates deterministic moneyline, spread and total odds rows for future `sports_odds_snapshots` persistence with zero provider calls and no migration. It now returns endpoint and entitlement preflight gates through readiness and direct endpoint-preflight APIs. Live odds and historical odds execution remain blocked until exact authenticated endpoint paths, entitlement, sportsbook coverage and capped historical windows are approved.

### SportsDataIO NBA Betting Events And Odds Contract Pilot V1

Status: Completed discovery-only verification and build verified.

Evidence: `docs/sportsdataio-nba-odds-readiness-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/config/sportsdataio-endpoint-catalog.ts`, existing `/api/historical-import/execute` and existing `sports_odds_snapshots` persistence contract.

Note: The approved pilot used `maximumRequests=2`, concurrency `1`, no retries, `trial=true`, `scrambled=true` and `production_eligible=false`. `BettingEventsByDate/2025-12-26` returned HTTP 200 with 9 records and nested `BettingMarkets` discovery metadata. The approved one-event follow-up `BettingMarkets/22888` returned HTTP 200 with 0 records. The executor now treats this honestly as discovery/index data, completed sync job `1a72e504-9737-4dd0-9b9e-8fd722b51c05`, persisted no unsupported odds snapshots, created no migration and kept production predictions, CLV, ROI, backtesting, calibration and model training disabled. The supplied `LveGameOddsByDate` path and broad alternate-market endpoint remain uncalled.

### SportsDataIO NBA Priced Game Odds Pilot V1

Status: Corrected priced odds, legacy cleanup and trial lineage verification complete for the approved scope.

Evidence: `docs/sportsdataio-nba-priced-game-odds-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, existing `/api/historical-import/execute` and existing `sports_odds_snapshots` persistence.

Note: `GameOddsByDate/2025-12-26` returned HTTP 200 with 9 game records. The first run persisted 1,476 trial/scrambled/non-production odds rows and recorded `records_skipped=0`. The approved cleanup deleted only 936 unintended `AlternateMarketPregameOdds` rows. The approved corrected one-call retry inserted 180 null-line moneyline replacements and updated 360 spread/total rows, then the approved supersession cleanup deleted exactly 180 legacy non-null-line moneylines after verifying 180 corrected replacements and 0 feature-snapshot/prediction references. Final stored SportsDataIO trial odds are 540 rows: 180 moneyline, 180 spread and 180 total, with 0 legacy moneylines, 0 duplicate logical rows and 0 production leakage.

### SportsDataIO Canonical Endpoint Catalog V1

Status: Completed provider-independent catalog and build verified.

Evidence: `src/config/sportsdataio-endpoint-catalog.ts` and `docs/providers/sportsdataio/`.

Note: The catalog records exact path templates, API version, domain, parameter format, production/historical purpose, trial status, entitlement status, implementation status, normalization status, persistence status and last pilot status for the SportsDataIO feeds Pick Analyzer actually needs across NBA, MLB, NFL, NHL and Soccer. It adds no route, performs no provider call and does not unlock production use.

### SportsDataIO MLB Discovery Lab Variant Correction V1

Status: Completed route-family correction and auth probe; import execution blocked pending exact endpoint confirmation.

Evidence: `src/config/sportsdataio-endpoint-catalog.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/services/multi-sport-providers.service.ts`, `src/services/historical-import-engine.service.ts`, `docs/providers/sportsdataio/MLB.md` and `docs/providers/sportsdataio/CAPABILITY_MATRIX.md`.

Note: The purchased personal-use MLB subscription is modeled as `sportsdataio_discovery_lab`, using `https://api.sportsdata.io/api/mlb/{product}/json/{endpoint}` with `SPORTSDATAIO_MLB_API_KEY` and the `Ocp-Apim-Subscription-Key` header. `GET /api/mlb/fantasy/json/CurrentSeason` returned HTTP 200 as a sanitized auth/capability probe. Enterprise `/v3/mlb/...` paths remain cataloged separately but are not executable with the Discovery Lab key, and the Historical Import planner blocks MLB live import domains until exact Discovery Lab Fantasy/Odds endpoints are confirmed.

### SportsDataIO MLB Real Data Validation Batch V1

Status: Completed for quarantined teams, players, events and stats; odds/feature handoff blocked; build verified.

Evidence: `docs/mlb-real-data-validation-batch-v1.md`, `src/config/sportsdataio-endpoint-catalog.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/services/historical-import-engine.service.ts`, `docs/providers/sportsdataio/MLB.md` and `docs/providers/sportsdataio/CAPABILITY_MATRIX.md`.

Note: The confirmed Discovery Lab Fantasy + Odds endpoint catalog now includes Teams, Players, FreeAgents, Standings, DFS slates, player game/season stats, player projections, GamesByDate, GameOddsByDate, GameOddsLineMovement, Games, Stadiums, TeamGameStatsByDate and TeamSeasonStats. Batch V1 first identified `2026-07-12` as the viable date, then fixed the `sport_player_stats` preflight blocker caused by oversized `.in()` chunks. The corrected retry used 5 provider calls, all HTTP 200, and inserted 30 teams, 7,258 players, 15 events, 30 team game stats, 463 player game stats, 7,796 provider mappings and 1 sync job as quarantined non-production rows. The approved odds-only retry fixed `GameId`/`GameID` and nested `PregameOdds` normalization, used 1 provider call to `GameOddsByDate/2026-07-12`, returned HTTP 200 with 15 records, inserted 90 quarantined full-game odds rows and completed sync job `4214c5a3-38de-41c8-9f53-7eab1714a34f`. Feature snapshots, predictions, settlement, backtest and production promotion remain blocked because 0 persisted odds rows were timestamp-safe relative to stored event starts.

Line Movement Probe V1 selected mapped completed GameId `78723` and used exactly 1 provider call to `GameOddsLineMovement/78723`. The endpoint returned HTTP 200 with 624 nested movement snapshots, inserted 3,720 quarantined timestamp-aware odds rows, found 2,586 cutoff-safe rows before the 10-minute pregame cutoff and completed sync job `56db235c-8837-426f-8e84-e6e0ebc70a97`. The approved one-game MLB lineage extension then used 0 provider calls and the existing Feature Store route actions to insert 3 quarantined feature snapshots, reuse all 3 on rerun, insert 3 linked predictions, reuse all 3 on rerun, and settle the bounded moneyline, spread/run-line and total rows. MLB Line Movement Expansion Batch V1 then used exactly 14 additional sequential provider calls for the remaining `2026-JUL-12` events, all HTTP 200, inserted 32,722 new line-movement rows, and produced full-date coverage of 36,442 line-movement rows with 25,498 cutoff-safe rows. The bounded multi-game Feature Store lineage run inserted 42 new snapshots plus reused 3, inserted 42 new predictions plus reused 3, settled 45 technical predictions as 21 wins and 24 losses, and reran idempotently with 45 reused rows. The rows remain `trial=false`, `scrambled=false`, `production_eligible=false`, recommended picks are 0, production leakage is 0 and production CLV remains blocked.

MLB Prospective Validation Day 1 Readiness V1 completed the zero-provider-call operations pass after the historical validation date. The existing `/api/cron/daily-sync?version=2` response now carries the disabled Day 1 MLB workflow, Puerto Rico capture windows, conservative 6/8/12 daily call budget, event-aware cutoff policy, technical closing-comparison contract, recovery/checkpoint guidance and acceptance packet. The existing `/api/daily-report` response now carries a labeled `mlbValidation` section for pregame/postgame/30-day report fields while public top-pick sections remain filtered to production-eligible rows. No new route, dashboard, migration, provider call, recurring schedule, model training or production promotion was added.

MLB Historical Recommendation Replay V1 then exposed the already-settled July 12 validation rows for product inspection without generating new predictions. The existing `/api/predictions/by-sport` route now supports explicit `historicalValidation=true&validationMode=quarantined&sport=baseball_mlb&date=2026-07-12`, returning only the 45 linked Feature Store lineage predictions with 21 wins, 24 losses, 0 pushes, 0 production-eligible rows and 0 provider calls. The existing MLB Prediction Engine panel renders the replay with market/result/confidence/matchup filters, chronological default sorting, final score/settlement display and compact pregame lineage explanations. Default production-facing calls still exclude quarantined rows.

### SportsDataIO Betting Market Normalization Core V1

Status: Completed provider-independent normalization/routing hardening and build verified.

Evidence: `src/services/sportsdataio-betting-normalizer.service.ts`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/config/sportsdataio-endpoint-catalog.ts` and `docs/providers/sportsdataio/`.

Note: The shared normalizer separates `BettingEventID`, `GameID`, `BettingMarketID`, `BettingOutcomeID` and `SportsbookID`, classifies payloads as `DISCOVERY_ONLY`, `MARKET_INDEX_AVAILABLE`, `PRICED_OUTCOMES_AVAILABLE`, `ARCHIVE_REQUIRED`, `ENTITLEMENT_BLOCKED`, `EMPTY_VALID_RESPONSE` or `UNSUPPORTED_SCHEMA`, and preserves provider-record, event, market, outcome, sportsbook, priced-outcome and normalized-snapshot counters. Runtime capabilities now include a zero-call `betting_metadata` domain for BettingMetadata and ActiveSportsbooks contracts. No provider calls, routes or migrations were added.

### SportsDataIO NBA Integration Readiness V1

Status: Completed zero-call aggregate readiness and build verified.

Evidence: `docs/sportsdataio-nba-integration-readiness-v1.md`, `src/services/sportsdataio-nba-integration-readiness.service.ts`, `src/components/dashboard/HistoricalImportEnginePanel.tsx`, `/api/providers/sportsdataio/nba/readiness`, `/api/providers/sportsdataio/nba/provider-gate`, `/api/providers/sportsdataio/nba/external-blockers`, `/api/providers/sportsdataio/nba/blocker-resolution`, `/api/providers/sportsdataio/nba/production-gate`, `/api/providers/sportsdataio/nba/production-usage-exclusion`, `/api/providers/sportsdataio/nba/domain-proof`, `/api/providers/sportsdataio/nba/completion-evidence`, `/api/providers/sportsdataio/nba/objective-audit`, `/api/providers/sportsdataio/nba/safe-next-actions`, `/api/providers/sportsdataio/nba/evidence-export`, `/api/providers/sportsdataio/nba/next-pilot-preflight`, `/api/providers/sportsdataio/nba/approval-packet`, `/api/providers/sportsdataio/nba/completion-audit`, `/api/providers/sportsdataio/nba/contract-audit`, runtime capabilities/status routes and NBA odds/player-props/player-stats readiness services including `/api/providers/sportsdataio/nba/odds/endpoint-preflight`, `/api/providers/sportsdataio/nba/player-props/endpoint-preflight` and `/api/providers/sportsdataio/nba/player-stats/migration-preflight`.

Note: The module aggregates local runtime validation, capability metadata and NBA readiness services into one blocker and safety-invariant report. `/api/providers/sportsdataio/nba/readiness` is the canonical readiness surface for new consumers. Focused domain-proof, completion-evidence, objective-audit and safe-next-actions routes remain compatibility aliases that preserve their response contracts while identifying the canonical readiness section; odds/player-props endpoint preflights and player-stats migration preflight remain operational aliases for focused approval checks. The aggregate response now carries next-pilot preflight summaries so the Historical Import dashboard can render one Readiness Summary and next-pilot gates without fetching duplicate domain readiness endpoints. It still includes the handoff matrix, production gates, safe next actions, objective completion audit, external blocker ledger and route, validated readiness evidence export and route, production gate audit, provider execution gate and route, external blocker resolution checklist, production usage exclusion audit and route, next-pilot approval checklist, next-pilot preflight route, external approval packet, blocked-state audit, contract-audit route, domain completion proof ledger, completion evidence matrix, response-shape audit and surface consistency audit. It makes zero provider calls, exposes no secrets and reports the integration as ready with external blockers rather than production-ready for uncapped provider execution.

Blocker Resolution API V1 adds `/api/providers/sportsdataio/nba/blocker-resolution` as the direct zero-call route for the external blocker resolution checklist. Historical Import and Runtime Observability now display the resolution route, and surface consistency requires the blocker-resolution route across operator surfaces.

Production Gate API V1 adds `/api/providers/sportsdataio/nba/production-gate` as the direct zero-call route for the production gate audit. Historical Import and Runtime Observability now display the production gate route, and surface consistency requires the production-gate route across operator surfaces.

Domain Proof API V1 adds `/api/providers/sportsdataio/nba/domain-proof` as the direct zero-call route for the domain completion proof ledger. Historical Import and Runtime Observability now display the domain proof route, and surface consistency requires the domain-proof route across operator surfaces.

Completion Evidence API V1 adds `/api/providers/sportsdataio/nba/completion-evidence` as the direct zero-call route for the completion evidence matrix. Historical Import and Runtime Observability now display the completion evidence route, and surface consistency requires the completion-evidence route across operator surfaces.

Objective Audit API V1 adds `/api/providers/sportsdataio/nba/objective-audit` as the direct zero-call route for objective-level remaining work and completion blockers. Historical Import and Runtime Observability now display the objective audit route, and surface consistency requires the objective-audit route across operator surfaces.

Safe Next Actions API V1 adds `/api/providers/sportsdataio/nba/safe-next-actions` as the direct zero-call route for allowed local next actions and still-closed production gates. Historical Import and Runtime Observability now display the safe-next-actions route, and surface consistency requires the route across operator surfaces.

### NBA Stored Lineup Feature Enrichment V1

Status: Completed zero-call feature enrichment and build verified.

Evidence: `src/services/nba-feature-store-integration.service.ts`, `src/services/nba-injury-lineup-confidence.service.ts`, `docs/PROJECT_STATUS.md` and existing NBA feature preview/validation APIs.

Note: The NBA Feature Store preview now uses stored `sport_lineups` sample size, freshness and provenance when lineup/depth rows exist. Trial/scrambled lineup rows remain excluded from production confidence improvement and continue to apply conservative confidence penalties.

### SportsDataIO NBA Trial Isolation Audit V1

Status: Completed read-only audit surface and build verified.

Evidence: `docs/sportsdataio-nba-trial-isolation-audit-v1.md`, `src/services/sportsdataio-nba-trial-isolation-audit.service.ts`, `/api/providers/sportsdataio/nba/trial-isolation` and `prediction_history` trial leakage checks.

Note: The audit scans stored SportsDataIO NBA rows for trial/scrambled metadata and `production_eligible=false`, tolerates optional `sport_player_stats` absence and checks that NBA prediction rows do not reference SportsDataIO trial events or carry trial feature markers.

### SportsDataIO NBA Observability Integration V1

Status: Completed zero-call runtime and dashboard observability extension; build verified.

Evidence: `docs/sportsdataio-nba-observability-integration-v1.md`, `src/services/runtime-observability.service.ts`, `src/components/dashboard/RuntimeObservabilityPanel.tsx`, `/api/observability/runtime`, `src/services/sportsdataio-nba-integration-readiness.service.ts` and `src/services/sportsdataio-nba-trial-isolation-audit.service.ts`.

Note: Runtime Observability V1 now exposes and displays a nested SportsDataIO NBA section with readiness blockers, external blocker ledger summaries and blocker route, readiness evidence export validation and route, production gate audit status, provider execution gate status and route, external blocker resolution checklist status, execution-readiness validation status, production usage exclusion audit status and route, next-pilot approval checklist status and preflight route, external approval packet status, blocked-state audit status, domain completion proof ledger status, completion evidence matrix status, response-shape audit status and contract route, surface consistency audit status and contract route, readiness-area summaries, trial-isolation totals, prediction leakage counts and safety invariants. The ledger summary preserves zero pre-approval provider calls and closed production gate visibility from the aggregate readiness endpoint, and the blocker route, evidence export validation/route, production gate audit, provider execution gate route, external blocker resolution checklist, execution-readiness validation, production usage exclusion route, next-pilot approval checklist/preflight route, external approval packet, blocked-state audit, domain completion proof ledger, completion evidence matrix, response-shape audit plus surface consistency audit give runtime observability consumer checks for the handoff packet. The extension makes zero provider calls, adds no migration and performs no mutations.

### Feature Store Core V1

Status: Completed computed architecture and build verified.

Evidence: `docs/feature-store-core-v1.md`, `src/services/feature-store-core.service.ts`, `/api/features/store`, `/api/features/store/definitions`, `/api/features/store/validation` and `FeatureStoreCorePanel`.

Note: The module defines versioned feature definitions, computed pre-event snapshots, freshness, provenance, sample size, data quality, cutoff timestamps, invalidation keys and deterministic leakage validation without persistence or provider calls.

### Multi-Sport Feature Registry V1

Status: Completed provider-independent registry and build verified.

Evidence: `docs/multi-sport-feature-registry-v1.md`, `src/services/multi-sport-feature-registry.service.ts`, `/api/features/registry`, `/api/features/registry/lookup`, `/api/features/registry/validation` and `MultiSportFeatureRegistryPanel`.

Note: The module maps feature definitions into sport, market and model-specific feature sets with readiness states and fallback policies. Unsupported sport-specific feature domains remain explicit warnings.

### NBA Feature Store Integration V1

Status: Completed read-only integration and build verified.

Evidence: `docs/nba-feature-store-integration-v1.md`, `src/services/nba-feature-store-integration.service.ts`, `/api/nba/features/store`, `/api/nba/features/preview`, `/api/nba/features/validation` and `NbaFeatureStoreIntegrationPanel`.

Note: The module validates NBA feature-set compatibility with Feature Store Core and existing `prediction_history.feature_snapshot` without changing NBA prediction generation or requiring a migration.

### Shared Sport Prediction Engine SDK V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/shared-sport-prediction-engine-sdk-v1.md`, `src/services/sport-prediction-engine-sdk.service.ts`, `/api/prediction-sdk`, `/api/prediction-sdk/validation` and `SportPredictionSdkPanel`.

Note: The module defines reusable sport engine strategy, normalized input/output, market capability, probability, fair odds, edge, expected value, confidence, uncertainty, recommendation, explanation, warning, Kelly, Smart Ranking, Monte Carlo, persistence, settlement and model health contracts. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### MLB Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/mlb-feature-store-integration-v1.md`, `src/services/mlb-feature-store-integration.service.ts`, `/api/mlb/features/store`, `/api/mlb/features/preview`, `/api/mlb/features/validation` and `MlbFeatureStoreIntegrationPanel`.

Note: The module validates MLB Feature Store compatibility without provider calls or migrations. The MLB moneyline feature set remains `partial` because probable pitcher, confirmed lineup, weather, park-factor and advanced-stat domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### MLB Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/mlb-prediction-engine-v1.md`, `src/services/mlb-prediction-engine.service.ts`, `/api/mlb/predictions`, `/api/mlb/predictions/health`, `/api/mlb/predictions/validation` and `MlbPredictionEnginePanel`.

Note: The module produces deterministic moneyline, spread/run line and total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NFL Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nfl-feature-store-integration-v1.md`, `src/services/nfl-feature-store-integration.service.ts`, `/api/nfl/features/store`, `/api/nfl/features/preview`, `/api/nfl/features/validation` and `NflFeatureStoreIntegrationPanel`.

Note: The module validates NFL Feature Store compatibility without provider calls or migrations. The NFL spread feature set remains `partial` because quarterback impact, injury impact, weather and rest/travel domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NFL Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/nfl-prediction-engine-v1.md`, `src/services/nfl-prediction-engine.service.ts`, `/api/nfl/predictions`, `/api/nfl/predictions/health`, `/api/nfl/predictions/validation` and `NflPredictionEnginePanel`.

Note: The module produces deterministic moneyline, spread, total and first-half previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Soccer Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/soccer-feature-store-integration-v1.md`, `src/services/soccer-feature-store-integration.service.ts`, `/api/soccer/features/store`, `/api/soccer/features/preview`, `/api/soccer/features/validation` and `SoccerFeatureStoreIntegrationPanel`.

Note: The module validates soccer Feature Store compatibility without provider calls or migrations. The soccer moneyline feature set remains `partial` because draw-aware context, league strength, confirmed lineup and injury domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Soccer Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/soccer-prediction-engine-v1.md`, `src/services/soccer-prediction-engine.service.ts`, `/api/soccer/predictions`, `/api/soccer/predictions/health`, `/api/soccer/predictions/validation` and `SoccerPredictionEnginePanel`.

Note: The module produces deterministic 1X2, double chance, draw no bet, totals, BTTS, first-half, qualification and Asian handicap contract previews. It validates three-way probability normalization and no-vig behavior, does not persist picks, consumes zero provider calls and does not claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NHL Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nhl-feature-store-integration-v1.md`, `src/services/nhl-feature-store-integration.service.ts`, `/api/nhl/features/store`, `/api/nhl/features/preview`, `/api/nhl/features/validation` and `NhlFeatureStoreIntegrationPanel`.

Note: The module validates NHL Feature Store compatibility without provider calls or migrations. The NHL moneyline feature set remains `partial` because starting goalie, goalie form, injury impact, special-teams and rest/travel domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NHL Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/nhl-prediction-engine-v1.md`, `src/services/nhl-prediction-engine.service.ts`, `/api/nhl/predictions`, `/api/nhl/predictions/health`, `/api/nhl/predictions/validation` and `NhlPredictionEnginePanel`.

Note: The module produces deterministic moneyline, puck line/spread and total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Tennis Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/tennis-feature-store-integration-v1.md`, `src/services/tennis-feature-store-integration.service.ts`, `/api/tennis/features/store`, `/api/tennis/features/preview`, `/api/tennis/features/validation` and `TennisFeatureStoreIntegrationPanel`.

Note: The module validates tennis Feature Store compatibility without provider calls or migrations. The tennis moneyline feature set remains `partial` because player form, surface, ranking and injury domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Tennis Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/tennis-prediction-engine-v1.md`, `src/services/tennis-prediction-engine.service.ts`, `/api/tennis/predictions`, `/api/tennis/predictions/health`, `/api/tennis/predictions/validation` and `TennisPredictionEnginePanel`.

Note: The module produces deterministic match-winner and match-total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### UFC Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/ufc-feature-store-integration-v1.md`, `src/services/ufc-feature-store-integration.service.ts`, `/api/ufc/features/store`, `/api/ufc/features/preview`, `/api/ufc/features/validation` and `UfcFeatureStoreIntegrationPanel`.

Note: The module validates UFC Feature Store compatibility without provider calls or migrations. The UFC moneyline feature set remains `partial` because fighter form, camp, injury, method and weigh-in domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### UFC Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/ufc-prediction-engine-v1.md`, `src/services/ufc-prediction-engine.service.ts`, `/api/ufc/predictions`, `/api/ufc/predictions/health`, `/api/ufc/predictions/validation` and `UfcPredictionEnginePanel`.

Note: The module produces deterministic fight-winner and method-contract previews through the Shared Sport Prediction Engine SDK. Moneyline is settlement-compatible; method contracts are explicitly not settlement-compatible until combat-specific grading exists. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

## Next Modules In Dependency Order

### 1. Provider-Backed NBA Data Quality And Historical Reconciliation Phase B

Status: Blocked until explicit provider/quota/date-window approval.

Objective: Execute capped, provider-backed reconciliation using the Phase A dry-run plan, improving NBA event/result/odds coverage without full historical downloads.

Prerequisites: NBA Data Quality and Historical Reconciliation Phase A, SportsDataIO NBA Pilot Import V1, SportsDataIO NBA Pilot Import V2, provider quota approval, credentials available and capped date windows approved.

Backend scope: Provider-backed incremental reconciliation jobs, small date-window execution, idempotent refreshes, duplicate handling and reconciliation status tracking.

Frontend scope: Extend the data quality dashboard with explicitly authorized execution controls, progress and post-run deltas.

Persistence or migration scope: Additive reconciliation job metadata only if existing `sports_sync_jobs` metadata is insufficient.

APIs: Extend `/api/nba/reconciliation/*` with protected execution endpoints while preserving existing dry-run contracts.

Validation: Use small date ranges first; never run full historical sync without approval; confirm no provider quota overrun.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Approved gaps can be refreshed idempotently, data quality improves, and provider calls stay within the approved cap.

### 2. Injury Provider Integration

Status: Partially satisfied by SportsDataIO NBA Injuries Pilot V1 and NBA Injury and Lineup Confidence Integration V1; production-eligible injury ingestion remains pending.

Objective: Add a real production-eligible provider-backed injury ingestion path.

Prerequisites: Provider selected, credentials available, production-eligible data contract reviewed.

Backend scope: Provider client, normalizer, sync job and persistence into `sport_injuries`.

Frontend scope: NBA health and prediction panels show injury freshness and coverage.

Persistence or migration scope: Additive columns only if provider fields require them.

APIs: NBA injury sync and health endpoints may be extended.

Validation: Verify no fabricated injuries; unsupported provider states return warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Production-eligible injury data can be synced idempotently and used as a feature input without trial-data confidence leakage.

### 3. Expected Lineups

Objective: Integrate real expected/confirmed lineup data for NBA.

Prerequisites: NBA Injury and Lineup Confidence Integration V1 plus exact expected/confirmed lineup provider endpoint and entitlement confirmation.

Backend scope: Lineup provider, normalizer, sync, confidence status and freshness.

Frontend scope: Lineup status in NBA dashboard.

Persistence or migration scope: Use `sport_players` and add lineup table only if needed.

APIs: NBA lineups sync/query endpoints.

Validation: No fake lineups; stale/unavailable lineups produce warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Lineup data is auditable and safely consumed by predictions.

### 4. Closing Line Value AI V2

Objective: Upgrade CLV intelligence using settled predictions and odds movement.

Prerequisites: Settlement, multi-book comparison and odds history.

Backend scope: CLV V2 scoring, sportsbook timing analysis and model feedback.

Frontend scope: Enhanced CLV dashboard.

Persistence or migration scope: Additive CLV metadata only if necessary.

APIs: Extend closing-line intelligence APIs.

Validation: Verify against stored opening/closing snapshots.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: CLV outputs are auditable and integrated with model health.

### 5. NBA Prediction Engine V2

Objective: Improve NBA predictions using calibrated features, quality checks and provider-backed context.

Prerequisites: Backtesting/calibration, data quality, injury/lineup provider readiness and odds quality.

Backend scope: Feature upgrades, calibrated probabilities, market-specific confidence and EV refinement.

Frontend scope: V2 model health and explanation updates.

Persistence or migration scope: Model version metadata only if needed.

APIs: Preserve V1 contracts or version explicitly.

Validation: Compare V2 to V1 without overwriting historical V1 records.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: V2 demonstrates measurable improvement or clearly documented tradeoffs.

### 6. Prop Bets Engine

Objective: Add player prop predictions only after player, injury and lineup data are real.

Prerequisites: Real player rosters, injuries, lineups and prop odds.

Backend scope: Player feature engineering, prop market normalization and settlement rules.

Frontend scope: Prop dashboard and explanation cards.

Persistence or migration scope: Player prop prediction and settlement metadata if not covered by existing tables.

APIs: Prop prediction and performance endpoints.

Validation: No props without real provider data.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Prop predictions are validated, persisted and settleable.

### 7. Same Game Parlays

Objective: Build correlation-aware same-game parlay recommendations.

Prerequisites: Prop engine, market correlation service and settlement coverage.

Backend scope: Correlation model, eligibility rules and EV calculation.

Frontend scope: Same-game parlay builder.

Persistence or migration scope: Parlay legs and recommendation history if needed.

APIs: Same-game parlay endpoints.

Validation: Prevent unsupported or unavailable leg combinations.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: SGP recommendations are explainable and risk-bounded.

### 8. Portfolio Optimizer V3

Objective: Upgrade portfolio allocation using calibrated NBA performance and cross-market risk.

Prerequisites: Settled predictions, calibration and market performance.

Backend scope: Allocation V3, exposure constraints and scenario simulation.

Frontend scope: Portfolio V3 panel.

Persistence or migration scope: Optional portfolio run history.

APIs: Portfolio V3 endpoint.

Validation: Verify bankroll constraints and no over-allocation.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Portfolio outputs are consistent with Kelly/risk services.

### 9. Bankroll AI

Objective: Add adaptive bankroll guidance from settled performance and risk profile.

Prerequisites: Portfolio V3 and performance history.

Backend scope: Bankroll policy, drawdown rules and stake recommendations.

Frontend scope: Bankroll AI panel.

Persistence or migration scope: User bankroll settings if supported.

APIs: Bankroll AI endpoint.

Validation: Conservative defaults and risk bounds.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Guidance is explainable and never exceeds configured constraints.

### 10. Arbitrage Finder

Objective: Detect cross-book arbitrage from multi-book odds.

Prerequisites: Multi-book comparison with fresh odds.

Backend scope: Arbitrage scanner and stale odds guardrails.

Frontend scope: Arbitrage opportunities panel.

Persistence or migration scope: Optional opportunity snapshots.

APIs: Arbitrage endpoint.

Validation: Verify math, freshness and bookmaker coverage.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Only real, fresh odds produce opportunities.

### 11. NBA Complete

Objective: Declare NBA production-complete after sync, predictions, validation, settlement, calibration, injury/lineup context and dashboards are reliable.

Prerequisites: NBA modules above.

Backend scope: Hardening and monitoring.

Frontend scope: Final NBA dashboard polish.

Persistence or migration scope: None unless hardening requires additive metadata.

APIs: Stable NBA API contracts.

Validation: Full smoke suite with real available data.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NBA can run daily without manual intervention except provider outages.

### 12. NFL Complete

Objective: Apply the proven NBA pattern to NFL.

Prerequisites: NBA complete and multi-sport abstractions validated.

Backend scope: NFL sync, features, prediction, validation and settlement.

Frontend scope: NFL dashboard surfaces.

Persistence or migration scope: Reuse generic sports tables where possible.

APIs: NFL or generic sports endpoints.

Validation: Provider-backed NFL smoke tests.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NFL has production-ready sync-to-settlement flow.

### 13. Soccer Complete

Objective: Add soccer league-specific prediction and settlement support.

Prerequisites: Provider league selection and soccer market definitions.

Backend scope: Soccer sync, draw-aware markets, xG or provider-backed features.

Frontend scope: Soccer dashboard.

Persistence or migration scope: Reuse generic tables where possible.

APIs: Soccer endpoints through multi-sport routes.

Validation: Draw/no-draw settlement and market-specific checks.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Soccer coverage is league-aware and settleable.

### 14. NHL Complete

Objective: Add NHL prediction and settlement support.

Prerequisites: Multi-sport pattern and hockey-specific feature source.

Backend scope: NHL sync, goalie/context features and settlement.

Frontend scope: NHL dashboard.

Persistence or migration scope: Reuse generic tables where possible.

APIs: NHL endpoints through multi-sport routes.

Validation: Hockey market settlement and provider freshness.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NHL has production-ready sync-to-settlement flow.

### 15. Tennis

Objective: Add tennis match prediction support.

Prerequisites: Individual-participant adapter readiness.

Backend scope: Player-form features, tournament events and match settlement.

Frontend scope: Tennis dashboard.

Persistence or migration scope: Player/participant records as needed.

APIs: Tennis endpoints through multi-sport routes.

Validation: Individual participant settlement and tournament status handling.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Tennis predictions are provider-backed and settleable.

### 16. UFC

Objective: Add UFC fight prediction support.

Prerequisites: Fighter data provider and event-based schedule support.

Backend scope: Fighter records, market settlement and event health.

Frontend scope: UFC dashboard.

Persistence or migration scope: Fighter metadata if needed.

APIs: UFC endpoints through multi-sport routes.

Validation: Event/fight settlement and method market guardrails.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: UFC predictions are provider-backed and settleable.

### 17. Live Betting AI

Objective: Add live betting intelligence only after pregame pipelines are reliable.

Prerequisites: Stable odds feeds, model calibration, bankroll constraints and settlement.

Backend scope: Live odds ingestion, momentum, cash-out and hedge intelligence.

Frontend scope: Live betting panel hardening.

Persistence or migration scope: Live snapshots if needed.

APIs: Live betting endpoints.

Validation: Strict stale data and latency warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Live recommendations are latency-aware and risk-bounded.

### 18. Prediction Engine V5

Objective: Upgrade the general prediction engine after sport-specific calibration exists.

Prerequisites: Settled/calibrated data across multiple sports.

Backend scope: Cross-sport model improvements and versioned comparison to V4.

Frontend scope: Model center V5 comparison and rollout controls.

Persistence or migration scope: Model version metadata and rollout history if needed.

APIs: Versioned prediction endpoint or backwards-compatible V4 extension.

Validation: Backtest, calibration, rollback and A/B comparison.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: V5 is demonstrably better or safely feature-flagged.

### 19. MLB Operating Day Lifecycle V1

Objective: Run each MLB operating day as a deterministic, auditable lifecycle.

Status: Implemented. Additive persistence, orchestrator routes, result-sync resilience, scoped settlement, replay report scaffolding, provider-call accounting and dashboard status panel are in place.

Backend scope: `operating-day.service.ts`, `/api/operating-day/execute`, `/api/operating-day/status`, `/api/operating-day/[operatingDayId]/settle`, `/api/operating-day/validation`, final-refresh fix in the SportsDataIO MLB prospective preview path and structured `/api/results/sync`.

Frontend scope: Compact dashboard Operating Day panel in Today.

Persistence or migration scope: `202607170001_mlb_operating_day_lifecycle_v1.sql`.

Validation: `npm.cmd run build` exits 0. Deterministic route compiles and exposes local settlement/freeze fixtures with zero provider calls.

Completion criteria: Daily actions can be dry-run with zero provider calls, final refresh no longer depends on schedule rediscovery, quota-blocked result sync is explicit, and settlement can be scoped by operating day without touching the historical backlog.

### 20. MLB Next Slate Rollover V1

Objective: Prevent started or completed MLB slates from remaining on active betting surfaces and prepare the next future slate safely.

Status: Implemented as a focused rollover correction. Shared active-event rules, stored-data next-slate status, Current Board rollover, MLB prospective-preview filtering and a compact dashboard Next Slate panel are in place.

Backend scope: `active-event.service.ts`, `next-slate.service.ts`, `/api/slate/next/status`, operating-day planning actions `resolve_next_slate`, `next_slate_preview`, `prepare_next_slate` and `postgame_rollover`.

Frontend scope: Compact dashboard Next Slate panel and slate-aware MLB prospective preview empty state.

Persistence or migration scope: None. The patch uses stored `sport_events`, `sports_odds_snapshots` and `prediction_history` only.

Validation: `npm.cmd run build` exits 0. Stored validation selected `2026-07-17` as the next MLB slate with 15 scheduled games, 0 active candidates, 0 official picks and 0 provider calls.

Completion criteria: Started/final MLB rows are excluded from active surfaces, next-slate preview is read-only, `prepare_next_slate` returns the exact bounded SportsDataIO endpoint plan without transport, and real provider execution remains blocked until explicit approval.

### 21. MLB Live Data Refresh V1

Objective: Execute approved SportsDataIO MLB preparation calls and refresh supported recommendation surfaces without weakening official-pick policy.

Status: Implemented for the bounded 2026-07-17 slate preparation and repaired by MLB Odds Coverage Reconciliation V1. Real execution is protected by auth, confirmation, budget checks, checkpoints and a local action lock.

Backend scope: `provider-budget.service.ts`, `mlb-market-capability-registry.service.ts`, `operating-day-automation.service.ts`, `/api/providers/budget/status`, `/api/mlb/markets/capabilities`, `/api/operating-day/automation/status`, `/api/cron/operating-day` and `/api/system/version`.

Frontend scope: Existing dashboard panels consume refreshed Current Board and Next Slate state.

Persistence or migration scope: No new migration. Existing operating-day and checkpoint tables are reused.

Validation: `npm.cmd run build` exits 0. The approved preparation and scoped repair linked 15 events, mapped 15/15 odds records, produced 45 prospective predictions, exposed 21 Current Board actionable candidates after price/freshness filtering and left official picks at 0.

Completion criteria: Approved real preparation can run end to end, core full-game markets refresh across Current Board/Most Likely/Best Value/Market Intelligence/AI Bet Finder/Top Picks/Bet Slip/Arbitrage, unsupported markets remain hidden or unavailable, and one consolidated Vercel cron entry drives scheduler-ready automation.

### 22. MLB Odds Coverage Reconciliation and Deployment Recovery V1

Objective: Repair the 2026-07-17 MLB odds/event mapping gap, document verified market coverage and deploy under Vercel Hobby cron limits.

Status: Implemented as a focused corrective patch. The event resolver now scopes the selected date to America/Puerto_Rico UTC boundaries (`04:00Z` to next-day `04:00Z`) and avoids reusing partial odds checkpoints as complete coverage. `/api/mlb/odds/coverage` provides a zero-provider-call diagnostic for schedule records, provider odds records, event mapping, normalized odds, feature snapshots, prediction counts, Current Board actionability and critical missing inputs.

Backend scope: SportsDataIO MLB prospective-preview date scoping, read-only odds coverage diagnostic route, automation status cron metadata and system version route counts.

Frontend scope: No new production betting surface. Existing dashboard surfaces consume the repaired stored state and remain governed by Current Board and official-pick policies.

Persistence or migration scope: None. Existing `sport_events`, `sports_odds_snapshots`, `prediction_history`, operating-day tables and sync checkpoints are reused.

Validation: `npm.cmd run build` exits 0. Zero-call diagnostics report 15 scheduled games, 15 provider odds records, 15 mapped games, 0 unmapped games, 45 predictions, 21 Current Board actionable candidates, 0 official picks and providerCallsMade 0.

Completion criteria: The root cause of 6/15 coverage is documented, all safely mappable games are recovered, unsupported markets remain unavailable rather than fabricated, missing pitcher/lineup/injury/weather/projection inputs are explicit, Vercel cron is daily-compatible and GitHub Actions provides an external scheduler-ready fallback.

### 23. Operating Day Cron Reliability and MLB Data Quality V1

Objective: Make real cron execution safe when the slate is already current and make MLB readiness scores honest when critical inputs are missing.

Status: Implemented as a reliability/data-quality correction. Real cron execution now returns compact `already_current` no-op status for the fresh 2026-07-17 slate, and Current Board/data-quality surfaces report insufficient critical data rather than null or inflated readiness.

Backend scope: `/api/cron/operating-day`, `operating-day-automation.service.ts`, `current-board.service.ts`, `mlb-data-quality.service.ts` and `/api/mlb/data-quality`.

Frontend scope: Existing intelligence surfaces receive corrected Current Board candidate fields. No new official-pick surface was added.

Persistence or migration scope: None. Existing operating-day lifecycle events and sync checkpoints remain the provider-call ledger source.

Validation: Dry-run and real local cron both make 0 provider calls. Real cron returns `already_current`, providerCallsMade 0 and writes 0. Data-quality validation returns featureQuality 35, dataSufficiency 30, criticalDataCompleteness 0 and `INSUFFICIENT` for the current slate.

Completion criteria: Production cron no longer returns a generic 500 for a fresh slate, automation status is not misleading, critical missing MLB inputs reduce readiness, and official picks remain 0 unless strict existing gates are honestly satisfied.

### 24. MLB Provider Capability Audit and AI Coach V1

Objective: Identify which SportsDataIO MLB endpoints can improve model quality under the current subscription and expose deterministic explanations for preview-only candidates.

Status: Implemented as a zero-provider-call audit and explanation layer.

Backend scope: `mlb-provider-capability-audit.service.ts`, `/api/mlb/provider-capabilities/audit`, `mlb-ai-coach.service.ts` and `/api/mlb/ai-coach`.

Frontend scope: No new production betting surface. The coach route is ready for dashboard or AI Bet Finder integration.

Persistence or migration scope: None.

Validation: Capability audit validation passes 5/5 with providerCallsMade 0. MLB Coach validation passes 4/4 with providerCallsMade 0. Current answers explain TEX and MIA positive-EV previews as preview-only because production, quarantine, calibration, confidence and critical-data gates remain blocked.

Completion criteria: Endpoint capability boundaries are explicit, no unavailable market is exposed as supported, coach explanations are grounded in Current Board/data-quality state and official recommendations remain 0.

### 25. Best Bets Today - Official And Informational Selection Engine V1

Objective: Rank the strongest supported current MLB betting options of the day while preserving the official/no-bet boundary.

Status: Implemented as a read-only Current Board scoring layer. If existing official gates produce qualified candidates, the surface returns `BEST BETS TODAY`; otherwise it returns `BEST BETS TODAY - NOT RECOMMENDED` with informational candidates and blockers.

Backend scope: `best-bets-today.service.ts`, `/api/best-bets-today`, Current Board response extension, Top Picks response extension and MLB AI Coach best-bet answers.

Frontend scope: Today dashboard Top Picks panel now includes a prominent Best Bets Today section ahead of legacy official-only Top Picks columns.

Persistence or migration scope: None. The module reads existing Current Board predictions, odds and V5 starter/weather/stadium context only.

Validation: `npm.cmd run build` exits 0. The API contract reports providerCallsMade 0, remoteMutationsMade 0, officialHistoryChanged false and predictionsRegenerated false.

Completion criteria: Official picks remain governed by existing thresholds and production gates, informational fallbacks are clearly labeled not recommended, negative EV and blockers remain visible, and no provider quota or settlement path is touched.

### 26. MLB Prediction Engine V6 Preflight, Feature Injection, And Safe Regeneration V1

Objective: Prove and prepare real starter/weather/stadium calculation injection for current MLB prospective predictions without provider calls or history rewrites.

Status: Implemented through deterministic V6 projection injection and a protected zero-provider preflight route. Write-mode regeneration is intentionally blocked by `prediction_history_unique_pick`, because inserting immutable side-by-side V6 rows would otherwise require overwriting prior event/market/team predictions.

Backend scope: `sportsdataio-mlb-prospective-preview.service.ts`, `/api/mlb/predictions/v6-regeneration`, Current Board probability-origin metadata and Most Likely/Best Bets filtering for fallback/unavailable probabilities.

Frontend scope: None in this phase.

Persistence or migration scope: None applied. A future schema migration is required before immutable V6 prediction rows can be written.

Validation: `npm.cmd run build` exits 0. Local dry-run reports 14 eligible events, 1 excluded event, 42 planned V6 predictions, deterministic validation true and providerCallsMade 0. Confirmed write mode returns `schema_blocked_prediction_history_unique_pick` without overwriting prior rows.

Completion criteria: V6 feature injection path is explicit, deterministic validation passes, write mode is safely guarded, and the next required action is schema support for immutable prediction versions.

### 27. Prediction Versioning Engine V1

Objective: Allow champion, challenger, shadow and rollback prediction rows to coexist without overwriting prior predictions.

Status: Implemented in code and migration. Remote application of `202607170002_prediction_versioning_engine_v1.sql` is required before V6 challenger rows can be persisted.

Backend scope: `prediction_history` versioning migration, `probePredictionVersioningSchemaCapabilities`, Current Board `is_current=true` filtering after migration, and V6 regeneration challenger metadata.

Frontend scope: None in this phase. Current Board behavior is preserved until the migration is applied, then current surfaces continue to read current rows only.

Persistence or migration scope: `202607170002_prediction_versioning_engine_v1.sql` adds versioning columns, lineage indexes and current-row uniqueness by `prediction_group_key`.

Validation: `npm.cmd run build` exits 0. Provider calls remain 0. V6 write mode remains blocked until the migration is applied remotely.

Completion criteria: Version-aware code compiles, migration is ready, legacy runtime remains safe before migration, and the next phase is remote migration application followed by V6 challenger regeneration.

### 28. MLB V6 Model Comparison Report V1

Objective: Compare champion V5/V5-context rows against V6 challenger calculations before promotion.

Status: Implemented as a zero-provider-call report embedded in `/api/mlb/predictions/v6-regeneration`.

Backend scope: V6 regeneration response now includes `modelComparison` with per-prediction champion/challenger values and deltas for probability, confidence, edge, EV, feature quality and data sufficiency.

Frontend scope: None in this phase.

Persistence or migration scope: No new persistence. Corrective migration `202607170003_prediction_versioning_drop_legacy_unique_pick.sql` is required before V6 challenger rows can be persisted.

Validation: `npm.cmd run build` exits 0. Production validation returned `modelComparison.mode=mlb_prediction_v6_model_comparison_v1`, compared 33 predictions, average probability delta `-1.39`, average confidence delta `-1.95`, providerCallsMade 0 and no official-history mutation.

Completion criteria: Comparison report is available even when persistence is blocked, and the platform can quantify V6 changes before any promotion decision.

### 29. Prediction Versioning Corrective Verification And MLB Model Platform Guardrails V1

Objective: Verify the remote legacy unique-pick corrective migration by safely persisting V6 challenger rows, then expose read-only model-operations surfaces without promotion or provider usage.

Status: Implemented. The remote blocker was verified cleared by persisted challenger rows and idempotency reuse. V6 remains challenger-only and default production surfaces remain champion/current.

Backend scope: `mlb-model-platform.service.ts`, `/api/mlb/predictions/comparison`, `/api/mlb/predictions/shadow-evaluation`, `/api/mlb/predictions/promotion-readiness`, `/api/mlb/predictions/rollback-plan`, `/api/mlb/players/metadata-cache`, `/api/mlb/stadiums/metadata-cache`, `/api/mlb/intelligence/pitcher-bullpen-foundation` and opt-in `modelRole` support on `/api/current-board`.

Frontend scope: None in this phase. Existing Current Board behavior is preserved unless an operator explicitly requests `modelRole=challenger` or `modelRole=shadow`.

Persistence or migration scope: Corrective migration `202607170003_prediction_versioning_drop_legacy_unique_pick.sql` was applied remotely by the operator and verified by behavior. No new migration was added in this checkpoint.

Validation: `npm.cmd run build` exits 0. V6 dry-run planned 15 challenger rows with 0 provider calls. Confirmed write inserted 15 challenger rows, reused 0 and wrote checkpoint `ffb2e6eb-cb80-421a-87a6-69b0b345c5e5`; same-key rerun inserted 0, reused 15 and wrote checkpoint `733ccb04-c751-4648-a06f-6685898d738c`. Comparison matched 15 champion/challenger pairs with average probability delta `-1.36` and average confidence delta `-1.93`.

Completion criteria: Legacy unique blocker is cleared, challenger persistence is idempotent, comparison/quality-gate/shadow/promotion/rollback surfaces are available, player/stadium/pitcher-bullpen foundations are zero-call, and no official history, settlement, recommendation thresholds or provider quota are touched.

### 30. Autonomous Daily Operations and Production User Experience V1

Objective: Turn existing Pick Analyzer modules into one daily self-operating prototype and redesign Today so a first-time user can understand the board in under 20 seconds.

Status: Implemented as a zero-provider-call orchestration and UX consolidation pass.

Backend scope: `autonomous-daily-operations.service.ts` and `/api/autonomous-daily-operations/status` compose Operating Day, Provider Budget, Current Board, Best Bets Today, Most Likely, Best Value, AI Coach, MLB data quality, pitcher/bullpen foundation, champion-vs-challenger comparison, shadow evaluation, calibration and promotion readiness into one canonical daily status.

Frontend scope: `ProductionTodayPanel` is now the first Today surface. It shows `Should I Bet Today?`, Official Pick, Best Bet Today, Most Likely, Best Value, Most Likely Moneyline, Most Likely Parlay, bankroll recommendation, compact game cards, Today's Timeline, System Health, Today's Learning and Promotion Readiness. Legacy detailed Today panels remain behind collapsed supporting detail.

Persistence or migration scope: No migration. Read-only status requests do not create rows. Real operating-day execution stages still persist through `operating_day_lifecycle_events` via the existing operating-day executor.

Validation: `npm.cmd run build` exits 0, generates 235 static pages and exposes 238 API routes. The new status route is read-only, reports `providerCallsMade=0`, `remoteMutationsMade=0`, `historyImmutable=true`, `officialHistoryChanged=false` and `modelPromotionPerformed=false`.

Completion criteria: The daily lifecycle has one canonical summary, the user-facing Today screen is simplified and duplicate information is collapsed, learning/promotion readiness are visible without automatic promotion, and provider quota/history remain untouched.

### 31. SportsDataIO Discovery Integration V1

Objective: Turn existing SportsDataIO MLB endpoint catalog, provider audit and stored import evidence into one official discovery contract without spending provider quota or activating unsupported markets.

Status: Implemented as a read-only provider capability layer.

Backend scope: `sportsdataio-mlb-discovery.service.ts` and `/api/providers/sportsdataio/discovery` classify Discovery Lab versus enterprise endpoints, endpoint runtime status, field quality, identity mapping, storage integration, projection reactivation blockers, provider quota posture and capability-matrix evidence.

Frontend scope: Advanced Details > Provider now includes a compact SportsDataIO Discovery Lab panel.

Persistence or migration scope: None. The module reads existing catalog code, `sports_sync_jobs` metadata and normalized tables only.

Validation: `npm.cmd run build` exits 0. The discovery contract reports `providerCallsMade=0`, `remoteMutationsMade=0`, no prediction mutation, no official-pick changes and no model promotion.

Completion criteria: Pick Analyzer can answer which SportsDataIO MLB endpoint should be trusted, blocked, retried or left catalog-only before spending quota; unsupported market and projection families remain blocked until full end-to-end support exists.

### 32. Live Provider Verification and Data Acquisition V1

Objective: Replace provider assumptions with controlled live runtime evidence across all connected providers while preserving all prediction, settlement and recommendation guardrails.

Status: Implemented as a protected live verification route. Dry-run is public/read-only; live mode requires `CRON_SECRET`.

Backend scope: `live-provider-verification.service.ts` and `/api/providers/live-verification` verify SportsDataIO, The Odds API, MLB Stats API and the existing BSN homepage connector. The service profiles fields, endpoint rows, usable/empty/identity fields, provider health, canonical ownership, acquisition scores, before/after entity mapping counts, before/after team-game-stat counts and before/after projection counts.

Persistence or migration scope: No migration. Live mode writes one sanitized `sports_sync_jobs` checkpoint. Durable data acquisition still uses existing provider importers.

Validation: Local `npm.cmd run build` exits 0. Live execution remains protected and budget capped.

Completion criteria: Runtime evidence can be gathered under strict provider budgets without exposing secrets, duplicating importers, changing model behavior or fabricating data.

### 33. Production Operations Completion and End-to-End Reliability V1

Objective: Make existing production operations truthful and executable without duplicating schedulers, provider adapters, feature builders, prediction engines or projection engines.

Status: Implemented as an operations reliability layer.

Backend scope: `/api/operations/health`, upgraded `/api/operations/adaptive-refresh`, `operations-health.service.ts` and Adaptive Refresh protected execution through the existing operating-day executor.

Frontend scope: Advanced Details > Data includes a compact Operations Control Center.

Persistence or migration scope: No migration. Existing `operating_day_lifecycle_events` and `sports_sync_jobs` remain the execution ledgers.

Validation: `npm.cmd run build` exits 0. Live execution requires `CRON_SECRET`, provider budget approval and an action lock.

Completion criteria: Adaptive Refresh no longer claims live execution when it only planned; due supported work can execute through the protected existing operating-day pipeline, and `/api/operations/health` reports real readiness, blockers and freshness.

### 34. MLB Historical Import Job Durability and Observability V1

Objective: Make MLB SportsDataIO historical import attempts durable, observable and safely resumable before any additional historical provider retry.

Status: Implemented locally. Production retry remains gated on applying the additive sync-job terminal-status migration and receiving explicit retry authorization.

Backend scope: `sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs` via `historical-import-engine.service.ts`, and `/api/operations/validation`.

Persistence or migration scope: Additive migration `202607210001_sports_sync_jobs_terminal_statuses.sql` extends `sports_sync_jobs.status` with `canceled` and `timed_out`. No destructive migration and no historical payload overwrite.

Validation: `npm.cmd run build` exits 0. Durability fixture validation passes 11/11 with `providerCallsMade=0` and `remoteMutationsMade=0`. Jobs smoke is read-only and reports 0 running, 0 stuck and 0 reconciliation required.

Completion criteria: Every live MLB historical import branch creates a `sports_sync_jobs` running checkpoint before provider transport, records provider call accounting states, converges to a terminal logical state when control returns, and exposes stuck-job reconciliation evidence without automatic retry.

### 35. MLB Player Identity Resolution V1

Objective: Resolve SportsDataIO MLB provider player identities deterministically before any multi-date player-game-stat backfill.

Status: Implemented and reconciled for the controlled 2026-07-17 PlayerGameStatsByDate import.

Backend scope: `sportsdataio-mlb-historical-import-executor.service.ts` now pages all canonical MLB `sport_players`, loads exact SportsDataIO MLB `provider_entity_mappings` with `entity_type='player'`, and merges them into canonical player lookups only when the mapped `sport_players.id` exists. Conflicting provider IDs are not overwritten, missing canonical players are ignored, and no fuzzy name matching is used.

Persistence or migration scope: No migration. The existing 2026-07-17 stat rows were reconciled using stored data only by updating `sport_player_stats.player_id` and resolution metadata. Statistical values, event IDs, team IDs, predictions, recommendations, Current Board, settlement and dashboard logic were not changed.

Validation: The 2026-07-17 imported stat rows improved from 82/418 player_id coverage to 418/418. Reconciliation updated 336 rows, found 0 conflicts, 0 unknown provider IDs, 0 duplicate stat IDs and 0 unresolved player flags after completion. The 2026-07-16 first pilot date initially resolved 8/27 rows because the deployed lookup still read only the first canonical player page; the pilot stopped before dates 2 and 3, the lookup was corrected to page `sport_players`, and 19 rows were reconciled from stored exact mappings only. Idempotency verification would make 0 additional updates. The durability fixture validation includes exact mapping, numeric/string provider ID normalization, conflict preservation and missing-canonical-player checks.

Completion criteria: Exact player identity resolution is available to future MLB historical imports, the controlled single-date import is fully reconciled, unresolved classifications are empty for that date, and a 3-date pilot can be considered only under a separate explicit authorization.

### 36. Legacy Prediction Provenance And Production Data Cleanup V1

Objective: Prove the origin of unresolved legacy `prediction_history` rows and isolate them from production-qualified metrics without deleting data.

Status: Implemented as a read-only provenance and scope-isolation layer.

Backend scope: `legacy-prediction-provenance.service.ts`, `/api/predictions/provenance`, `/api/operations/validation` and Settlement Reconciliation category accounting.

Persistence or migration scope: None. Existing rows remain untouched.

Validation: `npm.cmd run build` exits 0. Local fixture validation proves legacy rows classify as non-production, production-lineage rows classify as production, legacy `recommended_pick` flags do not imply official picks, and the module makes 0 provider calls and 0 remote mutations.

Completion criteria: Legacy rows are explainable by stored data plus git/migration provenance, remain available to audit/history, and are excluded from production-scoped settlement backlog and metrics.

### 37. MLB Learning Brain And Pitcher Outs End-to-End V1

Objective: Establish the first controlled daily learning loop for MLB starting-pitcher recorded-outs projections.

Status: Implemented as a stored-data-only shadow framework.

Backend scope: `mlb-learning-brain.service.ts`, `/api/mlb/learning-brain`, Operations Validation, Player Intelligence and Game Intelligence pitcher-outs integration.

Frontend scope: Projections page includes a compact Learning Center summary from the learning-brain API.

Persistence or migration scope: No new migration. `universal_projection_history` stores immutable feature snapshots, shadow projection rows, threshold probabilities, settlement actuals/errors, calibration and drift metadata.

Validation: `npm.cmd run build` exits 0. Fixture validation covers recorded-outs conversion, direct/innings conflict quarantine, monotonic threshold probabilities, NO_MARKET behavior, no auto-promotion, rollback preservation, zero provider calls and read-only validation.

Completion criteria: Pitcher-outs data, feature, model, settlement, learning, challenger policy, rollback policy, scheduler contract, player/game intelligence and projection-board surfaces are available without activating prop betting or Official Picks.

### 38. MLB Pregame Starter Evidence And First Live Shadow Projection V1

Objective: Acquire and persist timestamp-safe MLB pregame starting-pitcher evidence so the Learning Brain can generate live pitcher-outs shadow projections when eligible.

Status: Implemented locally using the existing SportsDataIO GamesByDate verification path and existing `sport_lineups` persistence.

Backend scope: `mlb-pregame-starter-evidence.service.ts`, `/api/mlb/pregame-starter-evidence`, MLB Learning Brain starter-evidence handoff, Operations Validation, Player Intelligence and Game Intelligence.

Frontend scope: Projections page Learning Center now reports starter evidence coverage.

Persistence or migration scope: No migration. Starter evidence is stored in `sport_lineups` with `lineup_type='starting_lineup'`, `role='starting_pitcher'` and precise status/freshness/eligibility metadata.

Validation: `npm.cmd run build` exits 0. Fixture validation covers pregame timestamp acceptance, post-start rejection, stale labeling, schema-safe probable storage, NO_MARKET behavior and zero-provider-call validation.

Completion criteria: Confirmed/probable starters can be refreshed through one protected date-wide GamesByDate call, exact identities are required, stale or final-only evidence is blocked, and eligible starters feed the pitcher-outs shadow generator without creating props, EV, edge, Kelly, stake or Official Picks.

### 39. Retrosheet Historical Feature Store Phase 2A Idempotency And Resume Certification

Objective: Certify the completed Retrosheet Phase 2A historical feature backfill, second-run idempotency behavior and checkpoint resume behavior without starting Phase 2B.

Status: Complete.

Backend scope: `scripts/retrosheet-feature-backfill.mjs` now uses stable ordered pagination for large read audits and retry-hardened Supabase reads/updates. `ai-learning-lifecycle.service.ts` reports Phase 2A completion from persisted local-worker registry/checkpoint evidence instead of timeout-prone full-table exact counts.

Persistence or migration scope: No migration. The certified resume used existing `historical_feature_snapshots`, `historical_import_registry`, `historical_import_checkpoints` and `sports_sync_jobs` rows.

Validation: `npm.cmd run historical:features:resume` resumed running import `4ce68718-4661-4159-ab07-d71510c40c3f`, loaded 23 completed checkpoints, completed batches 24-49, inserted 0, updated 0 and skipped 37,120 existing deterministic snapshots. Final scoped state is 2,430 games, 70,470 snapshots, 100% coverage, 0 duplicate deterministic keys, 0 leakage failures, providerCallsMade 0 and externalSportsApiCallsMade 0. AI Operations reports completed, 49 checkpoints, 70,470 snapshots, 2,430 games and 100% coverage with no active failed/pending state.

Completion criteria: `PHASE_2A_BACKFILL_PASS`, `POINT_IN_TIME_HISTORY_PASS`, `BACKFILL_IDEMPOTENCY_PASS`, `BACKFILL_RESUME_PASS` and `HISTORICAL_FEATURE_STORE_COMPLETE` are certified. Phase 2B remains unstarted pending explicit approval.

### 40. MLB Player Props Data Readiness Audit V1

Objective: Audit MLB pitcher and batter prop readiness across player identity, stored outcomes, feature foundations, sportsbook odds, settlement, learning and calibration without activating props.

Status: Implemented locally as an audit-only readiness layer.

Backend scope: `mlb-player-props-readiness-audit.service.ts`, `/api/mlb/player-props/readiness`, `/api/mlb/player-props/mapping-diagnostics`, `/api/mlb/player-props/provider-audit` and AI Operations.

Frontend scope: Dashboard Advanced Details > Markets includes the MLB Player Props Data Readiness Audit panel.

Persistence or migration scope: None. Existing `sport_players`, `provider_entity_mappings`, `sport_player_stats`, `sport_lineups`, `sports_odds_snapshots`, `historical_baseball_games`, `historical_baseball_lineups`, `historical_baseball_pitcher_appearances` and `historical_baseball_batter_appearances` rows are read only.

Validation: The module reports zero provider calls and zero remote mutations. It keeps player props out of production predictions, Current Board, Most Likely, Best Value, Official Picks, Learning Brain, model weights, Historical Replay and Historical Feature Store.

Completion criteria: `PLAYER_PROP_DATA_AUDIT_PASS`, `PLAYER_MAPPING_AUDIT_PASS`, `PLAYER_SETTLEMENT_AUDIT_PASS`, `PLAYER_PROVIDER_AUDIT_PASS` and `PLAYER_PROP_READINESS_PASS` are audit certifications only. Live props remain blocked until verified current/historical player-prop odds, opening/closing lines, line movement, live settlement and explicit activation approval exist.

### 41. MLB Player Projection Engine V1

Objective: Build a production-safe MLB player statistical projection layer before any sportsbook player-prop comparison.

Status: Implemented locally in shadow/informational mode.

Backend scope: `mlb-player-projection-engine.service.ts`, Universal Projection Engine player-family extensions, `/api/mlb/player-projections`, `/api/mlb/player-projections/pitchers`, `/api/mlb/player-projections/batters`, `/api/mlb/player-projections/[projectionId]`, `/api/mlb/player-projections/readiness`, `/api/mlb/player-projections/performance`, `/api/mlb/player-projections/lifecycle` and AI Operations.

Frontend scope: `/player-projections` plus Dashboard Advanced Details > Model Player Projections summary.

Persistence scope: Reuses isolated `universal_projection_history`; no player projection is stored in `prediction_history` or as sportsbook prop predictions.

Validation: `npm.cmd run build` exits 0. Read-only projection validation makes 0 provider calls and 0 remote mutations. Bounded historical validation uses chronological train/validation/holdout splits over stored pitcher appearances and aggregated batter player-game rows. Current slate is safely blocked by missing probable starters and expected lineups rather than fabricating participation context.

Completion criteria: `MLB_PLAYER_PROJECTION_ENGINE_PASS`, `PITCHER_PROJECTION_PASS`, `BATTER_PROJECTION_PASS`, `PLAYER_PROJECTION_DISTRIBUTION_PASS`, `PLAYER_PROJECTION_POINT_IN_TIME_PASS`, `PLAYER_PROJECTION_SETTLEMENT_PASS`, `PLAYER_PROJECTION_LEARNING_PASS`, `PLAYER_PROJECTION_IDEMPOTENCY_PASS`, `PLAYER_PROJECTION_PRODUCT_PASS` and `NO_PROP_BETTING_ACTIVATION_PASS` are certified for the projection layer. Player-prop odds acquisition and betting activation remain separate future approvals.

### 42. Current MLB Lineup Context And Game Intelligence Experience V1

Objective: Turn stored current MLB participation context into a coherent game-intelligence experience without activating sportsbook player props.

Status: Implemented locally in read-only shadow/informational mode.

Backend scope: `mlb-current-lineup-context.service.ts`, `game-intelligence.service.ts`, Current Board player-intelligence metadata, Universal Projection Engine lineup handoff, MLB Player Projection Engine expected-lineup fallback, `/api/mlb/lineup-context` and `/api/mlb/game-intelligence`.

Frontend scope: `/game-intelligence`, `/game-intelligence/[eventId]`, `/player-projections/[projectionId]`, Dashboard tool navigation and Dashboard Advanced Details > MLB Game Intelligence.

Persistence scope: None. The module reads stored `sport_events`, `sport_lineups`, `sport_player_stats`, `sport_players` and existing intelligence services only. It does not write prediction history, projection history, model weights, settlement, replay or feature-store rows.

Validation: Read-only diagnostics for 2026-07-24 report 15 MLB games, 0 confirmed/probable/expected starters, 30 unavailable starter slots, 0 confirmed lineups, 26 expected lineups and 257 eligible batter contexts. Cutoff-safe player projection generation excludes the live COL @ MIL game and produces 1,836 informational batter projections across 14 eligible games. Pitcher projections remain blocked by missing starter context. Provider calls and remote mutations remain 0.

Completion criteria: `CURRENT_MLB_LINEUP_CONTEXT_PASS`, `MLB_GAME_INTELLIGENCE_EXPERIENCE_PASS`, `PLAYER_PROJECTION_CONTEXT_PASS`, `NO_PROP_BETTING_ACTIVATION_PASS`, `NO_OFFICIAL_PICK_PROMOTION_PASS`, `PROVIDER_CALL_DISCIPLINE_PASS` and `PREGAME_CUTOFF_CONTEXT_PASS` are certified for the stored-data experience. Live provider activation remains blocked until real current starter and confirmed lineup coverage are available under explicit approval.

### 43. MLB Starter Intelligence And Probable Pitcher Recovery V1

Objective: Build a canonical current MLB starter resolver that can recover confirmed/probable/expected starters from stored evidence and feed Game Intelligence, First Five readiness and pitcher projections without activating props.

Status: Implemented locally in read-only provider-independent mode. Live probable-starter coverage for the current slate remains blocked because no current stored starter evidence exists.

Backend scope: `mlb-starter-intelligence.service.ts`, Universal Projection Engine starter handoff, Current Lineup Context starter handoff, Game Intelligence pitcher matchup enrichment, First Five readiness starter-rule handoff, AI Operations starter panel, `/api/mlb/starter-intelligence`, `/api/mlb/probable-starters`, `/api/mlb/starter-diagnostics` and `/api/mlb/starter-history`.

Frontend scope: Dashboard Advanced Details > Model includes MLB Starter Intelligence. Player Projection detail now displays starter status, last update and historical starts when available.

Persistence scope: None. The module reads stored `sport_events`, `sport_lineups`, `sport_players`, `provider_entity_mappings`, historical Retrosheet starter tables and existing starter/weather intelligence only.

Validation: `npm.cmd run mlb:starter-intelligence -- --date=2026-07-24 --summary` reports 15 games, 0 confirmed starters, 0 probable starters, 0 expected starters, 30 unavailable starter slots, 0 projection-eligible starters, 30 blocked pitcher-projection slots, 1,000 bounded player rows, 1,000 bounded SportsDataIO mappings, 0 duplicate provider IDs, 0 provider calls and 0 remote mutations. Player projections remain batter-only for the current slate until real current starter evidence appears.

Completion criteria: `STARTER_INTELLIGENCE_PASS`, `STARTER_MAPPING_PASS`, `GAME_INTELLIGENCE_STARTER_PASS` and conditional `PITCHER_PROJECTION_ACTIVATION_PASS` are certified for the resolver and integration. `PROBABLE_STARTER_PASS` is withheld for the current slate until confirmed/probable stored starter evidence is available.

### 44. Explainable Intelligence Layer V1

Objective: Create one consistent explanation framework for team, game, player and market projections using stored evidence only.

Status: Implemented locally as an additive explanation contract.

Backend scope: `explainable-intelligence.service.ts`, Current Board candidate enrichment, AI Picks Feed item passthrough, Game Intelligence detail, Player Projection detail, Most Likely and Best Value opportunity responses.

Frontend scope: Game Center Why tab, Player Projection Evidence, Most Likely advanced details, Best Value advanced details and Dashboard AI Picks Feed cards.

Persistence scope: None. The layer does not write database rows and does not change prediction probabilities, model weights, settlement, replay, learning, Official Pick policy or provider execution.

Validation: `npm.cmd run build` exits 0 with 347 static pages. The contract uses grounded qualitative impact labels only: positive drivers, negative drivers, neutral factors, unavailable factors, data-quality limitations, confidence impact and recommendation boundary.

Completion criteria: `EXPLAINABLE_INTELLIGENCE_PASS`, `EXPLANATION_CONSISTENCY_PASS` and `DATA_LIMITATION_TRANSPARENCY_PASS` are certified locally pending production deployment smoke.

### 45. Projection Evolution & Model Evidence Experience V1

Objective: Show how game and player projections changed over time while preserving cutoff-safe evidence boundaries.

Status: Implemented locally as a read-only evidence layer.

Backend scope: `projection-evolution.service.ts`, `/api/projection-evolution`, Game Intelligence detail enrichment and Player Projection detail enrichment.

Frontend scope: Game Center Performance & Evidence and Player Projection History now show bounded evolution summaries, model evidence and guardrail labels.

Persistence scope: None. The layer reads `prediction_history`, `sport_events` and `universal_projection_history` only. It does not mutate projections, model weights, settlement, replay, learning or Official Pick policy.

Validation: `npm.cmd run build` exits 0 with 348 static pages. Evolution rows are ordered by `generated_at`, post-start evidence is excluded when an event cutoff is available, and missing change reasons are explicitly labelled instead of inferred.

Completion criteria: `PROJECTION_EVOLUTION_PASS`, `MODEL_EVIDENCE_EXPERIENCE_PASS` and `PERFORMANCE_SCOPE_TRANSPARENCY_PASS` are certified locally pending production deployment smoke.

### 46. Dashboard & Daily AI Briefing Refinement V1

Objective: Make Dashboard a concise entry point into deeper intelligence without overloading the main page.

Status: Implemented locally using existing Today dashboard data.

Backend scope: None. The phase reuses `/api/dashboard/today`, Most Likely, Best Value and recommendation pipeline data already loaded by the dashboard.

Frontend scope: `UserTodayPanel` adds a ten-second briefing and top-game intelligence strip. Cards link to Game Center and preserve existing lazy advanced panels.

Persistence scope: None. No database writes, provider calls, prediction changes, model changes, settlement changes, learning changes or Official Pick policy changes.

Validation: `npm.cmd run build` exits 0 with 348 static pages. The briefing uses bounded current-day data already present on the dashboard and labels unavailable player/starter/lineup/value states explicitly.

Completion criteria: `DAILY_BRIEFING_PASS`, `DASHBOARD_INTELLIGENCE_PASS`, `PRODUCT_EMPTY_STATE_PASS` and `DASHBOARD_PERFORMANCE_PASS` are certified locally pending production deployment smoke.

### 47. Dashboard Production Data Contract Repair V1

Objective: Repair Today Dashboard operating-day semantics, lifecycle/market presentation, grounded-opportunity reconciliation, settlement backlog consistency and performance goal/status correctness without changing model or recommendation policy.

Status: Implemented locally as an additive contract repair.

Backend scope: `dashboard-today.service.ts` now exposes presentation lifecycle, market availability, settlement summary and grounded-opportunity reconciliation using stored event, prediction and odds diagnostics. `performance-product-contract.service.ts` now evaluates goals by direction and exposes qualified evolution status separately from trend-comparison availability.

Frontend scope: `UserTodayPanel` displays Grounded Opportunities separately from Best Value, uses the settlement backlog source everywhere, prioritizes settlement backlog in System Health and sanitizes internal reason codes in User Mode. `PerformanceProductClient` labels Brier, calibration error and production-scope status with user-facing text.

Persistence scope: None. The repair reads existing stored data only and does not mutate predictions, settlements, learning labels, model weights, Current Board eligibility, Official Pick policy or replay artifacts.

Validation: `npm.cmd run build` exits 0 with 348 static pages. Focused bounded API validation passed dashboard semantic contract 42/42 and performance product contract 6/6. Local live-data validation returned zero grounded rows for the local operating date with zero unexplained drops.

Completion criteria: `OPERATING_DAY_SEMANTICS_PASS`, `GAME_LIFECYCLE_CONTRACT_PASS`, `MARKET_AVAILABILITY_CONTRACT_PASS`, `GROUNDED_OPPORTUNITY_RECONCILIATION_PASS`, `SETTLEMENT_COUNT_CONSISTENCY_PASS`, `USER_MODE_REASON_SANITIZATION_PASS`, `PERFORMANCE_STATUS_CONTRACT_PASS`, `BRIER_GOAL_SEMANTICS_PASS`, `CALIBRATION_LABELING_PASS` and `FOCUSED_REGRESSION_PASS` are certified locally pending production deployment smoke.

### 48. Homepage Consistency, Automatic Settlement And Provider Budget Utilization V1

Objective: Recover the July 24 production settlement backlog, make postgame continuity automatic, and reconcile provider budget/scheduler ownership without changing models or recommendation policy.

Status: In progress with Phase 2 settlement recovery complete and GitHub-owned scheduler-budget hardening implemented locally after Vercel Hobby rejected more-than-daily cron.

Backend scope: Existing results sync, scoped operating-day settlement, operating-day cron continuity bridge, provider budget service, adaptive refresh scheduler audit and daily performance refresh.

Frontend scope: None in the scheduler/budget hardening step; homepage/performance reconciliation remains validated through existing dashboard APIs before certification.

Persistence scope: Production settlement wrote only canonical July 24 settlement outcomes and derived learning-label closure for the 45 eligible production predictions. The code patch changes provider-budget defaults and scheduler ownership/cadence only; it does not mutate predictions, model weights, Official Pick policy, replay artifacts or feature-store history.

Validation: Production settlement recovered 15 final MLB games and settled exactly 45 predictions with an idempotent rerun returning 0 newly eligible rows. Provider budget defaults are now 1,000 daily calls with a 150 reserve, 3 calls per action and 12 calls per hour. The single frequent write-capable scheduler is GitHub Actions at `7,22,37,52 * * * *`; `vercel.json` has no cron entries and heartbeat/manual workflows remain dry-run observers.

Completion criteria: `PRODUCTION_SETTLEMENT_RECOVERY_PASS`, `SETTLEMENT_IDEMPOTENCY_PASS`, `LEARNING_LABEL_CLOSURE_PASS`, `POSTGAME_CONTINUITY_PASS` and `SCHEDULER_OWNERSHIP_PASS` are certified. Remaining product consistency work adds paginated Prediction History navigation, explicit absolute probability error and Brier contribution labels, and Most Likely opposite-price display safety. Provider-budget, homepage, performance and end-to-end production certifications remain pending final deployment and smoke validation for the latest local commit.

### 49. Player Prop Multi-Market Expansion V1

Objective: Extend the certified MLB player-prop storage/comparison/UI architecture beyond Pitcher Outs without changing prediction engines or enabling betting recommendations.

Status: Implemented locally as an additive projection-only expansion.

Backend scope: `mlb-player-prop-markets.ts` adds a canonical market catalog for Pitcher Outs, Pitcher Strikeouts, Pitcher Walks, Pitcher Hits Allowed, Pitcher Earned Runs, Batter Hits, Batter Total Bases, Batter Home Runs, Batter RBI, Batter Runs, Batter Walks and Batter Stolen Bases. Ingestion normalization recognizes the matching The Odds API provider keys, including `batter_rbis` and `batter_runs_scored`, while preserving the existing protected dry-run/live gate. Comparison APIs expose supported markets, market summary, bookmaker coverage, identity coverage and storage coverage with optional market filtering.

Frontend scope: `/player-projections` adds a prop-market selector and market coverage summary inside the existing player projection workflow. Sportsbook comparison remains Projection Only / No recommendation and only displays genuine stored sportsbook rows.

Persistence scope: None. Existing `sports_odds_snapshots` rows are reused; no SQL migration, epoch activation, import, feature rebuild or scheduler change was made.

Validation: `node --loader ./scripts/local-ts-loader.mjs scripts/player-prop-multi-market-v1-validate.mjs` passed 11/11 checks with 0 provider calls and 0 remote mutations. `npm.cmd run build` exits 0 with 368 static pages.

Completion criteria: `PLAYER_PROP_MULTI_MARKET_V1_PASS`, `PLAYER_PROP_STORAGE_EXTENSION_PASS`, `PLAYER_PROP_COMPARISON_EXTENSION_PASS`, `PLAYER_PROP_IDENTITY_PASS`, `PLAYER_PROP_UI_EXTENSION_PASS`, `PLAYER_PROP_API_EXTENSION_PASS`, `NO_FAKE_MARKETS_PASS`, `NO_PROVIDER_REGRESSION_PASS`, `NO_PROBABILITY_CHANGE_PASS`, `NO_MODEL_CHANGE_PASS`, `NO_DATABASE_MUTATION_PASS` and `NO_CERTIFIED_PLATFORM_REGRESSION_PASS` are certified locally pending push/deploy approval.

### 50. Multi-Sport Results, Settlement & Preview Prediction Unlock V1

Objective: Close the odds-event to canonical-event to result to settlement to learning lifecycle for the maximum safe number of non-MLB sports without fabricating readiness or generating retrospective predictions.

Status: Complete as a truthful blocked certification. Results/crosswalk foundation is implemented with read-only API evidence and bounded live score-result acquisition. NBA, NFL, NHL, Soccer, Tennis and UFC Preview lifecycles are certified blocked rather than activated.

Backend scope: `multi-sport-results-crosswalk-foundation.service.ts`, `/api/data-foundation/results-crosswalk`, `scripts/multi-sport-results-crosswalk-foundation-v1.mjs`, `scripts/multi-sport-unlock-v1-checkpoint-b-nba.mjs`, `scripts/multi-sport-unlock-v1-checkpoint-c-nfl.mjs`, `scripts/multi-sport-unlock-v1-checkpoint-d-nhl.mjs`, `scripts/multi-sport-unlock-v1-checkpoint-e-soccer.mjs`, `scripts/multi-sport-unlock-v1-checkpoint-f-tennis-ufc.mjs` and `scripts/multi-sport-unlock-v1-final-certify.mjs`.

Persistence scope: The live Checkpoint A probe inserted 12 exact completed UFC/MMA score rows in `game_results` and one `sports_sync_jobs` evidence row. It did not apply SQL, create feature snapshots, generate predictions, settle predictions, create learning labels, activate epochs, rebuild features, change scheduler behavior or alter recommendation policy.

Validation: `node scripts/multi-sport-results-crosswalk-foundation-v1.mjs --validate` passed 5/5 with zero provider calls. `node scripts/multi-sport-unlock-v1-checkpoint-b-nba.mjs --validate` passed 4/4 with zero provider calls. NBA lifecycle dry-run generated 0 predictions, persisted 0 rows and passed 7/12 gates. `node scripts/multi-sport-unlock-v1-checkpoint-c-nfl.mjs --validate` passed 4/4 with zero provider calls. NFL lifecycle gate passed 3/10 checks and persisted 0 rows. `node scripts/multi-sport-unlock-v1-checkpoint-d-nhl.mjs --validate` passed 4/4 with zero provider calls. NHL lifecycle gate passed 3/10 checks and persisted 0 rows. `node scripts/multi-sport-unlock-v1-checkpoint-e-soccer.mjs --validate` passed 4/4 with zero provider calls. Soccer competition gate passed 6/15 checks and persisted 0 rows. `node scripts/multi-sport-unlock-v1-checkpoint-f-tennis-ufc.mjs --validate` passed 4/4 with zero provider calls. Tennis/UFC event gate passed 8/24 checks and persisted 0 rows. `node scripts/multi-sport-unlock-v1-final-certify.mjs --validate` passed 5/5 with zero provider calls. Final certification confirmed settlement core 41 fixture checks and 14/14 deterministic checks passing. `npm.cmd run build` exits 0 with 392 static pages.

Continuation: no automatic activation remains. NBA activation is blocked until genuine current pregame odds, completed result evidence, future event schedule and exact canonical event/result crosswalk are available. NFL and NHL activation are blocked until canonical events, completed results, settlement inputs and persistence gates exist. Soccer activation is blocked until stored rows are tied to certified real competition keys, canonical events, completed results, settlement inputs and persistence gates. Tennis remains empty/event-driven. UFC has 12 stored provider score rows but remains blocked by missing canonical event identity and settlement inputs.

Completion criteria: `MULTI_SPORT_RESULTS_FOUNDATION_PASS`, `MULTI_SPORT_SCORE_RESULT_PASS`, `NBA_PREVIEW_PREDICTION_LIFECYCLE_BLOCKED_TRUTHFUL_PASS`, `NFL_PREVIEW_PREDICTION_LIFECYCLE_BLOCKED_TRUTHFUL_PASS`, `NHL_PREVIEW_PREDICTION_LIFECYCLE_BLOCKED_TRUTHFUL_PASS`, `SOCCER_COMPETITION_ACTIVATION_BLOCKED_TRUTHFUL_PASS`, `SOCCER_COMPETITION_SCOPE_ENFORCED_PASS`, `SOCCER_NO_GLOBAL_COVERAGE_OVERCLAIM_PASS`, `TENNIS_EVENT_LIFECYCLE_BLOCKED_TRUTHFUL_PASS`, `UFC_EVENT_LIFECYCLE_BLOCKED_TRUTHFUL_PASS`, `UFC_PROVIDER_RESULTS_STORED_BUT_NOT_CANONICAL_PASS`, `MULTI_SPORT_RESULTS_SETTLEMENT_PREVIEW_UNLOCK_V1_FINAL_PASS`, `SETTLEMENT_CORE_CONTRACT_AVAILABLE_PASS`, `NON_CANONICAL_SETTLEMENT_BLOCKED_PASS`, `NON_CANONICAL_LEARNING_BLOCKED_PASS`, `PROVIDER_QUOTA_SAFETY_PASS`, `NO_RETROSPECTIVE_PREDICTION_PASS`, `NO_PROBABILITY_CHANGE_PASS`, `NO_CONFIDENCE_CHANGE_PASS`, `NO_TRUST_FORMULA_CHANGE_PASS`, `NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS`, `NO_OFFICIAL_PICK_POLICY_CHANGE_PASS`, `NO_EPOCH_ACTIVATION_PASS`, `NO_SECRET_EXPOSURE_PASS` and `NO_CERTIFIED_PLATFORM_REGRESSION_PASS` are certified for Checkpoints A-G.

### 51. Universal Event Identity & Crosswalk Engine V1

Objective: Evolve the existing identity components into one canonical cross-sport event identity engine without creating a duplicate crosswalk system.

Status: Implemented and partially materialized from stored evidence. The existing `/api/events/identity/audit` route now supports `?universal=true` for read-only cross-sport identity coverage, and `scripts/universal-event-identity-materialize-v1.mjs` materialized canonical NFL, NHL and UFC events from already stored provider evidence.

Backend scope: Reuses `provider_entity_mappings`, `sport_events`, `sports_teams`, `sport_players`, `sports_odds_snapshots`, `game_results`, Multi-Sport Registry, existing MLB The Odds API crosswalk and the pitcher identity bridge. Adds provider-agnostic resolver types, hierarchy keys, competition normalization, deterministic provider/canonical/participant-time resolution, cross-sport coverage reporting and a guarded identity-only materializer.

Persistence scope: Identity-only materialization inserted/upserted canonical events and provider event mappings, linked stored NFL/NHL/UFC odds rows to canonical event IDs and linked 12 UFC result rows to canonical event IDs. No SQL, provider call, prediction generation, settlement execution, learning write, feature rebuild or scheduler change was made.

Validation: Universal event identity fixtures pass 16/16 with 0 provider calls and 0 remote mutations. Materialization dry-run is idempotent with 0 odds rows and 0 result rows remaining to link. Read-only coverage audit now shows NFL and NHL current provider-evidence identity blockers cleared, UFC current provider-evidence identity coverage cleared with 9 legacy/provider-native mapping rows still flagged, and Soccer still blocked by missing competition-scoped canonical events and mappings.

Continuation: The next identity work should inspect the 9 remaining UFC legacy/provider-native mappings, then audit whether NFL/NHL/UFC prediction generation gates now advance to feature/result/settlement blockers. Soccer must be handled competition by competition; `soccer` and `soccer_generic` placeholders remain blocked.

Completion criteria: `UNIVERSAL_EVENT_IDENTITY_ENGINE_V1_PASS`, `UNIVERSAL_EVENT_IDENTITY_MATERIALIZATION_V1_PASS`, `NO_SECOND_CROSSWALK_ENGINE_PASS`, `PROVIDER_ENTITY_MAPPING_REUSE_PASS`, `CANONICAL_EVENT_ID_REUSE_PASS`, `SPORT_COMPETITION_SEASON_SCOPE_PASS`, `DETERMINISTIC_IDENTITY_RESOLUTION_PASS`, `AMBIGUOUS_MATCH_BLOCKED_PASS`, `NFL_CANONICAL_EVENT_IDENTITY_UNLOCK_PASS`, `NHL_CANONICAL_EVENT_IDENTITY_UNLOCK_PASS`, `UFC_CANONICAL_EVENT_IDENTITY_PARTIAL_PASS`, `SOCCER_COMPETITION_SCOPE_ENFORCED_PASS`, `NO_FUZZY_MATCHING_PASS`, `NO_PROVIDER_CALL_PASS`, `IDENTITY_ONLY_MUTATION_PASS`, `NO_PREDICTION_ENGINE_CHANGE_PASS`, `NO_SETTLEMENT_ENGINE_CHANGE_PASS` and `NO_LEARNING_ENGINE_CHANGE_PASS` are certified locally pending build and push.

### 52. NFL + NHL Preview Prediction Lifecycle V1

Objective: Activate genuine Preview-only prediction lifecycle coverage for NFL and NHL after canonical event identity was certified.

Status: Complete through final certification.

Backend scope: `stored-preview-prediction-lifecycle.service.ts` adds a shared stored-data adapter that reuses canonical events, stored odds snapshots, Feature Store Core, Shared Sport Prediction SDK, `historical_feature_snapshots`, `prediction_history` and Settlement Reconciliation V2. NFL and NHL prediction routes now return real stored-data Preview lifecycle output instead of fixture-only preview output.

Persistence scope: NFL Checkpoint A persisted 776 immutable feature snapshots and 776 quarantined `prediction_history` Preview rows for the first 12 future canonical NFL events. NHL Checkpoint B persisted 258 immutable feature snapshots and 258 quarantined `prediction_history` Preview rows for the first 12 future canonical NHL events. Rows are `production_eligible=false`, `recommended_pick=false`, `model_role='shadow'` and `is_current=false`.

Validation: NFL dry-run produced 776 predictions across moneyline, spread and total, rejected 0 cutoff rows and made 0 provider calls. NFL persist wrote 1,552 total feature/prediction rows. The post-persist dry-run reported 776 reused predictions, 0 inserted predictions and 0 remote mutations. NHL dry-run produced 258 predictions across moneyline, spread and total, rejected 0 cutoff rows and made 0 provider calls. NHL persist wrote 516 total feature/prediction rows. The post-persist dry-run reported 258 reused predictions, 0 inserted predictions and 0 remote mutations. Settlement dry-run remains read-only and classifies rows as scheduled/awaiting result until future games complete.

Continuation: Wait for future NFL/NHL events to complete, ingest deterministic final scores through approved result paths, then rerun settlement reconciliation before any learning, performance or promotion review.

Completion criteria: `NFL_PREVIEW_PREDICTION_ACTIVATION_PASS`, `NFL_PREGAME_FEATURE_SNAPSHOT_PASS`, `NFL_PREVIEW_ISOLATION_PASS`, `NFL_SETTLEMENT_DRY_RUN_PASS`, `NHL_PREVIEW_PREDICTION_ACTIVATION_PASS`, `NHL_PREGAME_FEATURE_SNAPSHOT_PASS`, `NHL_PREVIEW_ISOLATION_PASS`, `NHL_SETTLEMENT_DRY_RUN_PASS`, `NO_RETROSPECTIVE_PREDICTION_PASS`, `NO_POST_START_LEAKAGE_PASS`, `NO_PRODUCTION_POLLUTION_PASS`, `NO_PROVIDER_CALL_PASS`, `NO_OFFICIAL_PICK_POLICY_CHANGE_PASS`, `NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS` and `NO_SCHEDULER_DRIFT_PASS` are certified.

### 53. Build Memory Optimization V1

Objective: Reduce production build memory pressure without changing runtime behavior, prediction logic, scheduler behavior, Official Picks, Learning Brain, probabilities, APIs, database schema or provider behavior.

Status: Phase A complete; broader optimization paused by measurement gate.

Frontend scope: `/ai-bet-finder`, `/arbitrage`, `/best-value`, `/betting-workbench`, `/model` and `/most-likely` were inspected and classified as runtime-backed thin page wrappers. Each now exports `dynamic = 'force-dynamic'` only. No broad application-wide dynamic rendering policy was added.

Validation: Measured local build after Phase A exits 0. Prerender routes decreased from 12 to 6 and generated static pages decreased from 392 to 386, but peak observed working set increased from 2629.6 MB to 2715.2 MB. Server bundle audit identifies the next verified pressure area as large shared server chunks and broad server-service imports, not the six converted pages.

Continuation: Do not deploy on Phase A alone. The next pass should inspect largest server chunks, route tracing and server-service import boundaries before attempting broader changes.
# MLB Pitcher Projection Engine V1

Status: PARTIAL

Additive projection-only engine for MLB starter recorded outs is implemented locally. It supports projected outs, innings, pitch count, strikeouts, hits allowed, earned runs, discrete outs distributions and Over/Under probabilities for 14.5 through 18.5 outs. It remains sportsbook-independent and cannot create Official Picks, Best Value, EV, edge, stake or portfolio selections.

Next phase should focus on pitcher identity hardening and synchronization, not Player Prop Market Comparison or Portfolio Intelligence.

Starter Sync V1 has been added as the required bridge from current-slate starter evidence to historical pitcher logs. Portfolio Intelligence V1 remains NOT STARTED. Player Prop Market Comparison V1 remains NOT STARTED.

### 54. Feature Intelligence, Signal Quality And Leakage Audit V1

Objective: Understand every available stored feature key and classify future model value without training or changing production behavior.

Status: Complete as a read-only analysis phase.

Scope: `scripts/feature-intelligence-signal-quality-leakage-audit-v1.mjs` reads stored `historical_feature_snapshots`, calculates feature coverage, null/missing rates, constant flags, primitive distributions, numeric variance, sport/market/season coverage, redundancy groups, leakage dispositions, category priorities and first/second/future model feature-set recommendations. `scripts/feature-intelligence-signal-quality-leakage-audit-v1-validate.mjs` verifies read-only guardrails and required documentation.

Evidence: 73,719 snapshots read, 449 feature keys observed, 29 critical leakage-risk keys, 7 high-governance keys, 35 cutoff-frozen market candidates and 378 candidate non-leakage keys. Recommended first model family remains Regularized Logistic Regression using cutoff-frozen odds/market fields plus pitching, team strength, batting, schedule, home/away, rest and weather context after explicit training approval and sample threshold readiness.

Persistence scope: None. No training, fitting, feature-importance calculation, provider call, production mutation, prediction-engine change, probability change, confidence change, Trust change, Official Pick policy change, settlement change, Learning Brain weight change or epoch activation was performed.

Completion criteria: `FEATURE_INTELLIGENCE_PASS`, `FEATURE_SIGNAL_MATRIX_PASS`, `FEATURE_LEAKAGE_AUDIT_PASS`, `FEATURE_PRIORITY_MATRIX_PASS`, `FIRST_MODEL_FEATURE_SET_PASS`, `NO_MODEL_TRAINING_PASS`, `NO_MODEL_WEIGHT_MUTATION_PASS`, `NO_PROVIDER_CALL_PASS`, `NO_PRODUCTION_MUTATION_PASS` and `NO_CERTIFIED_PLATFORM_REGRESSION_PASS` are certified locally pending final build and push.

### 55. Training-Safe Feature Governance And Leakage Enforcement Contract V1

Objective: Convert the read-only feature leakage audit into one executable, training-safe contract for future dataset builders, trainers, backtests, challengers and shadow evaluation consumers.

Status: Complete as a training-only governance layer.

Scope: `src/services/training-feature-governance-v1.service.ts` provides canonical eligibility classes, quality tiers, alias grouping, temporal safety checks, default-deny handling for unknown keys and deterministic enforcement helpers. `scripts/training-safe-feature-governance-v1.mjs` generates the contract docs, first future MLB logistic regression manifest, alias map and current dataset recertification. `scripts/training-safe-feature-governance-v1-validate.mjs` validates fixtures and artifacts.

Evidence: 449 observed keys classified exactly once: 372 allowed, 33 allowed only if cutoff-frozen, 11 research-only, 14 post-final prohibited, 18 model-output prohibited and 1 unknown/review-required. The 419-row accepted MLB training baseline remains eligible after prohibited fields are excluded; broader linked MLB evidence is also inspected and prohibited/metadata fields are isolated rather than silently entering the model-input matrix.

Persistence scope: None. The contract references Feature Store Core and Multi-Sport Feature Registry concepts but does not replace them and does not alter live prediction feature consumption. No model training, fitting, feature-importance calculation, provider call, prediction write, settlement write, learning write, production mutation, model weight mutation, epoch activation, probability change, confidence change, Trust change or Official Pick policy change was performed.

Completion criteria: `TRAINING_SAFE_FEATURE_GOVERNANCE_PASS`, `FEATURE_LEAKAGE_ENFORCEMENT_PASS`, `FEATURE_TEMPORAL_SAFETY_PASS`, `FEATURE_ALIAS_CANONICALIZATION_PASS`, `FIRST_MODEL_FEATURE_MANIFEST_PASS`, `TRAINING_DATASET_FEATURE_RECERTIFICATION_PASS`, `PROHIBITED_FEATURE_EXCLUSION_PASS`, `UNKNOWN_FEATURE_DEFAULT_DENY_PASS`, `NO_MODEL_TRAINING_PASS`, `NO_MODEL_WEIGHT_MUTATION_PASS`, `NO_EPOCH_ACTIVATION_PASS`, `NO_PROVIDER_CALL_PASS`, `NO_PRODUCTION_MUTATION_PASS`, `NO_PRODUCTION_PREDICTION_CHANGE_PASS`, `NO_SETTLEMENT_CHANGE_PASS`, `NO_TRUST_FORMULA_CHANGE_PASS`, `NO_OFFICIAL_PICK_POLICY_CHANGE_PASS`, `NFL_PREVIEW_NON_REGRESSION_PASS`, `NHL_PREVIEW_NON_REGRESSION_PASS` and `NO_CERTIFIED_PLATFORM_REGRESSION_PASS` are certified locally pending build and push.

### 56. Operational Readiness, Multi-Sport Data Coverage, Odds API Completeness And Daily Autonomy Audit V1

Objective: Determine whether Pick Analyzer is genuinely ready to operate daily as a multi-sport prediction platform without executing providers, imports, prediction generation, settlement, learning writes or training.

Status: Complete as a read-only audit.

Scope: `scripts/operational-readiness-multisport-audit-v1.mjs` audits the actual daily pipeline, sport-by-sport readiness, current/previous-season coverage, The Odds API extraction completeness, provider/domain gaps, market prediction capability, daily automation, 5-10 minute odds-refresh feasibility, result/settlement/learning loops, data-retention risks and launch repair roadmap. It writes operational docs plus JSON matrices and is validated by `scripts/operational-readiness-multisport-audit-v1-validate.mjs`.

Evidence: MLB is classified `PRODUCTION_READY` for core daily operation. NFL and NHL remain `PREVIEW_READY`. NBA, Soccer, BSN and UFC remain data/contract-only or partial, and Tennis remains unavailable. The audit explicitly does not claim complete The Odds API current or previous-season extraction for every supported sport. Adaptive refresh is recommended over flat 5-minute multi-sport polling until provider budget and runtime capacity are explicitly approved.

Local smoke recovery: classified as `LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS` after two independent bounded PowerShell wrappers exceeded their hard timeouts. This is not treated as proof of an application-route defect. The audit relies on build, validators, artifact consistency, stored operational evidence and previously certified production smoke covering `/api/system/version`, dashboard, performance, operations and product routes; a future smoke-harness repair is separate.

Persistence scope: None. No provider call, import, prediction write, settlement write, learning write, model training, model weight mutation, epoch activation, scheduler cadence change, Vercel deployment or production mutation was performed.

Validation: JSON artifact validation, `node scripts/operational-readiness-multisport-audit-v1-validate.mjs`, changed-file ESLint, `git diff --check`, targeted secret scan and `npm.cmd run build` passed. Build generated 386 static pages. Local server smoke was not run because the smoke harness is classified unreliable on Windows.

Completion criteria: `OPERATIONAL_READINESS_AUDIT_PASS`, `MULTI_SPORT_DATA_COVERAGE_AUDIT_PASS`, `CURRENT_PREVIOUS_SEASON_COVERAGE_AUDIT_PASS`, `ODDS_API_EXTRACTION_COMPLETENESS_AUDIT_PASS`, `MULTI_SPORT_PREDICTION_READINESS_AUDIT_PASS`, `DAILY_AUTONOMY_AUDIT_PASS`, `ODDS_REFRESH_FEASIBILITY_AUDIT_PASS`, `RESULT_SETTLEMENT_LEARNING_LOOP_AUDIT_PASS`, `MULTI_SPORT_PRODUCTION_READINESS_MATRIX_PASS`, `NO_PROVIDER_CALL_PASS`, `NO_PRODUCTION_MUTATION_PASS`, `NO_PREDICTION_WRITE_PASS`, `NO_SETTLEMENT_WRITE_PASS`, `NO_MODEL_TRAINING_PASS`, `NO_MODEL_WEIGHT_MUTATION_PASS`, `NO_EPOCH_ACTIVATION_PASS` and `NO_CERTIFIED_PLATFORM_REGRESSION_PASS` are certified locally pending push.

### 57. MLB Adaptive Refresh, Daily Continuity And Autonomous Operations V1

Objective: Operate MLB automatically every day with the highest safe freshness while respecting provider budgets, prediction integrity and learning quality.

Status: Complete locally pending push.

Scope: The production GitHub Actions operating-day scheduler now runs every 10 minutes and still delegates to `/api/cron/operating-day`. Adaptive refresh remains the decision layer, so the 10-minute tick does not imply a provider call on every tick. A read-only heartbeat observer runs twice hourly. `/api/operations/mlb-autonomous-operations` reports scheduler inventory, refresh cadence, provider budget, continuity recovery, pregame readiness, postgame lifecycle and system health.

Persistence scope: None. The module adds no SQL and performs no provider calls or data mutations during validation. It does not change prediction formulas, confidence, Trust, Official Pick policy, settlement rules, model weights, model training, champion rows, epoch activation or retrospective prediction behavior.

Validation: `node scripts/mlb-autonomous-operations-v1-validate.mjs`, `node scripts/operational-readiness-multisport-audit-v1-validate.mjs`, focused changed-file ESLint, `git diff --check` and `npm.cmd run build` passed. Build generated 386 static pages.

Completion criteria: `MLB_AUTONOMOUS_OPERATIONS_PASS`, `ADAPTIVE_REFRESH_ENGINE_PASS`, `DAILY_CONTINUITY_PASS`, `PROVIDER_BUDGET_PASS`, `SYSTEM_HEALTH_PASS`, `NO_MODEL_TRAINING_PASS`, `NO_MODEL_WEIGHT_MUTATION_PASS`, `NO_PROBABILITY_CHANGE_PASS`, `NO_TRUST_CHANGE_PASS`, `NO_SETTLEMENT_CHANGE_PASS`, `NO_PROVIDER_WASTE_PASS` and `NO_CERTIFIED_PLATFORM_REGRESSION_PASS` are certified locally pending push.

### 58. MLB First Autonomous Operating-Day Production Certification V1

Objective: Certify one real MLB operating day from beginning to end using actual scheduled production executions and stored production evidence.

Status: Observation in progress; full end-of-day certification not yet earned.

Evidence: Production `/api/system/version` serves `e97f38900254b16bba6f1451cf384dbfad6b12c2`, and read-only production checks for autonomous operations, health, adaptive refresh, operations status, dashboard, Current Board, Performance and AI Operations returned HTTP 200. The observed MLB operating date was `2026-07-29`.

Current finding: The autonomous operations endpoint reports the new `*/10 * * * *` scheduler policy and `3,33 * * * *` heartbeat policy. Production health reports scheduler `HEALTHY`, provider budget `NORMAL`, 14 provider calls today, 3 in the last hour and 836 estimated calls remaining after reserve. The operating day was still active with 9 upcoming games and 96 predictions awaiting result, so result -> settlement -> learning -> Performance closure cannot be certified yet.

Persistence scope: Documentation-only observation. No provider calls, production mutations, settlement execution, model training, model-weight mutation, probability change, confidence change, Trust change, Official Pick policy change, historical replay, historical import, feature backfill or Vercel deployment was performed by certification.

Next safe action: Continue production read-only observation after the final game and subsequent scheduler ticks. Do not repair unless row-level evidence proves an operational defect.

### 59. Pick Analyzer V2 Phase A2 Route Runtime Integrity

Objective: Certify active and navigation-linked route/runtime integrity before continuing V2 into scheduler and freshness work.

Status: Complete locally; do not start Phase A3 until this A2 commit is reviewed or explicitly continued.

Scope: Bounded static and build-backed validation of core page routes, supporting API routes, dashboard navigation targets and shared route utilities. The phase did not start a local server, did not run the unreliable Windows smoke harness, did not call providers and did not mutate data.

Repair: Model Health navigation no longer points to missing `#model-center`; it now targets the existing `/dashboard#advanced-details` section.

Validation: `node scripts/pick-analyzer-v2-phase-a2-route-runtime-validate.mjs --timeoutMs=30000 --maxFiles=2000`, `node scripts/product-audit-v1-route-inventory.mjs --timeoutMs=30000 --maxFiles=5000`, JSON artifact parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` passed. Build generated 386 static pages.

Completion criteria: `PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_PASS`, `NO_LOCAL_SERVER_SMOKE_PASS`, `NO_PROVIDER_CALL_PASS`, `NO_PROVIDER_CREDIT_PASS`, `NO_DATABASE_MUTATION_PASS`, `NO_PREDICTION_WRITE_PASS`, `NO_SETTLEMENT_WRITE_PASS` and `NO_LEARNING_WRITE_PASS` are certified locally pending push authorization.

Next bounded phase: A3 Scheduler and Freshness Inconsistencies.

### 60. Pick Analyzer V2 Phase A3 Scheduler Freshness Integrity

Objective: Certify scheduler/freshness source-of-truth consistency before continuing V2 into UI state work.

Status: Complete locally pending push and production certification because runtime files changed.

Scope: Bounded audit of GitHub workflow schedules, Vercel cron configuration, scheduler health reporting, adaptive refresh cadence, freshness thresholds, Puerto Rico operating-date handling, read-only health routes and dashboard freshness labels.

Repairs: Operations health now reports the actual scheduler ownership model: Vercel crons are disabled and GitHub Actions owns the frequent write scheduler plus heartbeat. Data Freshness preview UI now distinguishes `NOT_SUPPORTED` from `NOT_AVAILABLE` so unsupported domains are not presented as generic unknown/unavailable state.

Validation: `node scripts/pick-analyzer-v2-phase-a3-scheduler-freshness-validate.mjs --timeoutMs=30000 --maxFiles=400`, `node scripts/scheduler-health-alignment-v1-validate.mjs`, `node scripts/mlb-autonomous-operations-v1-validate.mjs`, `node scripts/mlb-operating-day-recovery-v1-validate.mjs`, `node scripts/autonomous-daily-ai-v1-validate.mjs`, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` passed. Build generated 386 static pages.

Completion criteria: `PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_PASS`, `SCHEDULER_SOURCE_OF_TRUTH_PASS`, `FRESHNESS_SEMANTICS_PASS`, `TIMEZONE_CONTRACT_PASS`, `NO_PROVIDER_CALL_PASS`, `NO_PROVIDER_CREDIT_PASS`, `NO_DATABASE_MUTATION_PASS`, `NO_PREDICTION_WRITE_PASS`, `NO_RESULT_WRITE_PASS`, `NO_SETTLEMENT_WRITE_PASS` and `NO_LEARNING_WRITE_PASS` are certified locally pending push and automatic deployment verification.

Next bounded phase: A4 UI States, Loading States and Stale Labels. Do not start A4 until A3 production certification is complete.

### 61. Pick Analyzer V2 Phase A4 Product UI State Integrity

Objective: Certify product-facing loading, empty, stale, unavailable, unsupported, degraded, error, retry and lifecycle-label states before continuing V2 into API/database performance work.

Status: Complete locally pending push and production certification because a runtime UI file changed.

Scope: Bounded static and read-only production-evidence audit of dashboard navigation, Dashboard Today, Data Freshness, Adaptive Operations, Probability Picks, Most Likely, Best Value, Performance, AI Operations, Autonomous Daily AI, MLB Operations, Data Coverage, Sports Center, Market Intelligence, Portfolio Intelligence and Closing Line Intelligence.

Repair: Dashboard navigation lifecycle badges now use explicit semantic tones. Foundation is blue, Preview/Limited/Pending are yellow, Blocked is red and unknown badges are gray. This prevents Foundation, Preview and Limited surfaces from visually inheriting production-green semantics.

Validation: `node scripts/pick-analyzer-v2-phase-a4-ui-state-validate.mjs --timeoutMs=30000 --maxFiles=300`, A2 route/runtime validation, A3 scheduler/freshness validation, unsupported-market policy validation, navigation freshness validation, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` passed. Build generated 386 static pages.

Completion criteria: `PICK_ANALYZER_V2_PHASE_A4_UI_STATE_PASS`, `UI_LIFECYCLE_LABEL_PASS`, `LOADING_EMPTY_ERROR_STATE_PASS`, `UNSUPPORTED_MARKET_UI_GUARD_PASS`, `NO_PROVIDER_CALL_PASS`, `NO_PROVIDER_CREDIT_PASS`, `NO_DATABASE_MUTATION_PASS`, `NO_PREDICTION_WRITE_PASS`, `NO_RESULT_WRITE_PASS`, `NO_SETTLEMENT_WRITE_PASS` and `NO_LEARNING_WRITE_PASS` are certified locally pending push and automatic deployment verification.

Next bounded phase: A5 Database-query and API performance. Do not start A5 until A4 production certification is complete.

### 62. Pick Analyzer V2 Phase A5 API Query Performance

Objective: Certify bounded query behavior, compact default API responses and predictable failure handling on core read-heavy product paths before build-memory reliability work begins.

Status: Complete locally pending push and production certification because runtime API/service files changed.

Scope: Bounded audit of `/api/dashboard/today`, `/api/performance`, `/api/performance/history`, `/api/operations/health`, `/api/operations/data-freshness`, `/api/operations/mlb-autonomous-operations`, `/api/data-coverage/health`, `/api/data-coverage/final-certification`, `/api/probability-picks`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/current-board`, Sports Center support APIs, Model Health summary APIs and Provider summary APIs.

Repair: Performance summary queries now have deterministic prediction-history row caps and compact default response behavior. Default `/api/performance` no longer materializes or returns full `historyRows` unless full diagnostics are requested. `/api/performance/history` remains paginated and explicitly bounded.

Validation: `node scripts/pick-analyzer-v2-phase-a5-api-query-performance-validate.mjs --timeoutMs=30000` passed 46/46 locally. A2 route/runtime, A3 scheduler/freshness, A4 UI-state, release-candidate route/artifact consistency, unsupported-market policy, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` passed. Build generated 386 static pages.

Completion criteria: `PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_PASS`, bounded critical-query matrix, no proven unbounded critical summary query, no proven N+1 defect on audited core paths, provider-free and mutation-free read-only routes, no speculative schema migration, passing validators, passing build and production certification after deployment.

Next bounded phase: A6 Build-memory and production-build reliability. Do not start A6 until A5 production certification is complete.

### 63. Pick Analyzer V2 Phase A6 Build Reliability

Objective: Reduce build-memory and production-build risk on constrained Vercel infrastructure without deleting product routes, changing hosting architecture or requiring paid build infrastructure.

Status: Complete locally pending push and production certification because a runtime page file changed.

Scope: Bounded audit of `package.json`, `next.config.ts`, `tsconfig.json`, `vercel.json`, route inventory, prior build-memory artifacts, static/dynamic route behavior, build-time import pressure, generated artifact exposure and deterministic build scripts.

Repair: `src/app/data-coverage/page.tsx` no longer imports six heavy data/provider certification service graphs at module load. The page remains `force-dynamic` and now loads those services with request-time `import()` inside `DataCoveragePage`, preserving behavior while reducing build/module-evaluation pressure.

Validation: `node scripts/pick-analyzer-v2-phase-a6-build-reliability-validate.mjs --timeoutMs=30000` passed 37/37 locally. Bounded A1 route inventory, A2 route/runtime, A3 scheduler/freshness, A4 UI-state, A5 API/query performance, release-candidate route/artifact consistency, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` passed. The post-repair local build completed in 80.48 seconds with 386 generated static pages and 6 prerender routes.

Completion criteria: `PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_PASS`, build-pressure matrix, no build-time provider or mutation path, no local server smoke in build, no recursive build scan, no route deletion, no dependency migration, no paid infrastructure change, passing validators, passing build and production certification after deployment.

Next bounded phase: A7 Proven duplication cleanup only. Do not start A7 until A6 production certification is complete.

### 64. Pick Analyzer V2 Phase C1 Daily Betting Experience And Settlement Guarantee

Objective: Make the homepage the professional daily betting decision surface and guarantee completed games do not silently remain pending after authoritative stored results exist.

Status: Implemented pending final production settlement certification.

Scope: Homepage experience, existing Dashboard Today recommendation evidence, automatic operating-day settlement, read-only settlement guarantee monitoring, scheduler action priority and phase certification artifacts. No prediction engine, Official Pick policy, provider mapping, EV/edge/confidence/Trust formula, model weights or automatic model training are changed.

Repair: `/` now renders Today's Betting Plan with Rent Play, Moneyline Bet, Parlay Builder and Today's Best Opportunity. Automatic settlement no longer limits scheduled settlement to prospective-preview rows, run-line settlement uses spread semantics, completed rows are reported as settled, ready or explicitly blocked, and adaptive refresh now prioritizes deterministic settlement over provider-backed odds refresh when both are due.

Validation: `node scripts/pick-analyzer-v2-phase-c1-daily-betting-settlement-validate.mjs` passed 31/31 locally. Settlement-learning recovery, protected canonical MLB settlement, MLB operating-day recovery, scheduler-health alignment, A3 scheduler/freshness, JSON parsing, changed-file ESLint, targeted secret scan, `git diff --check` and `npm.cmd run build` passed. Build generated 386 static pages.

Completion criteria: `PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_SETTLEMENT_PASS`, homepage betting plan present, no backend prediction change, all completed games become `SETTLED`, `READY_FOR_SETTLEMENT` or `BLOCKED` with reason, scheduler selects settlement before stale odds when settlement-ready rows exist, no provider calls added, no unsupported-market promotion and production certification after automatic deployment.

### 65. Pick Analyzer V2 Phase C1.1 External Scheduler Recovery

Objective: Recover the external GitHub Actions scheduler boundary so protected operating-day execution automatically clears canonical settlement-ready rows and the settlement guarantee cannot pass while scheduler health is late or critical.

Status: Implemented pending final production proof.

Scope: GitHub Actions scheduler/heartbeat workflow configuration, scheduler reliability docs, settlement guarantee monitoring, C1.1 certification artifacts and validators. No C2 work is included.

Repair: The write scheduler now uses isolated concurrency group `production-operating-day-writer`, UTC cadence `7-57/10 * * * *` and a 6-minute timeout. The heartbeat now uses isolated concurrency group `production-operating-day-heartbeat` and a 5-minute timeout. The settlement guarantee monitor now reports scheduler health and returns `ACTION_REQUIRED` when scheduler cadence is late or critical.

Validation: `node scripts/pick-analyzer-v2-phase-c1-1-external-scheduler-recovery-validate.mjs` is the primary C1.1 validator. Required supporting validation includes C1, settlement-learning recovery, protected canonical MLB settlement, canonical settlement state, result ingestion, MLB operating-day recovery, scheduler-health alignment, A3 scheduler/freshness, autonomous daily AI, performance validation, JSON validation, changed-file ESLint, targeted secret scan, `git diff --check`, `git diff --cached --check` and `npm.cmd run build`.

Completion criteria: `PICK_ANALYZER_V2_PHASE_C1_1_EXTERNAL_SCHEDULER_RECOVERY_PASS`, active external workflow evidence, successful protected workflow invocation, canonical ready rows settled, idempotency validated, learning/performance evidence present, settlement guarantee PASS, scheduler health not late/critical, final commit pushed and production serving the final commit.

### 66. Operational Excellence OE-003 Adaptive Event Refresh Provider Budget Audit

Objective: Audit scheduler execution, provider-budget semantics, odds acquisition, per-event freshness and product-surface stored-data consumption before implementing an adaptive event lifecycle scheduler.

Status: Audit complete and pushed.

Scope: Documentation, architecture and validation only. No scheduler cadence, prediction formula, probability/confidence/edge/EV calculation, Official Pick policy, settlement rule, provider contract or product runtime behavior changed.

Result: Production evidence on commit `2c202983a1311a43f361afd707b32200c85da221` showed scheduler cadence `HEALTHY`, scheduler running true, missed intervals 0, provider status `HEALTHY` and fresh current-board market evidence. The earlier critical/stale state is classified as a recovered scheduler/freshness incident, not provider exhaustion.

Completion criteria: `OE_003_AUDIT_PASS`, separated scheduler execution, market freshness, provider budget, settlement and product readiness semantics, provider cost models classified, canonical acquisition flow documented, per-event freshness table captured, lifecycle states and priority bands proposed, budget simulations documented, 0 provider calls, 0 provider credits, 0 database mutations and passing OE-003 validation.

### 67. Operational Excellence OE-003A Scheduler Health Semantics

Objective: Implement the first OE-003 package by separating scheduler execution, market freshness, provider budget, settlement closure and product readiness into an additive canonical health contract.

Status: Production certified.

Scope: Observability and UI/API semantics only. No scheduler cadence, refresh cadence, provider limit, prediction formula, probability/confidence/edge/EV calculation, Official Pick policy, settlement rule, learning rule, provider mapping or provider contract changed.

Result: `/api/operations/health` exposes `healthDomains.schedulerExecution`, `marketFreshness`, `providerBudget`, `settlementClosure`, `productReadiness` and `overall`. Adaptive refresh, data freshness, settlement guarantee, MLB autonomous operations, provider budget status and MLB Operations Center consume or expose the separated evidence additively while preserving legacy fields.

Completion criteria: `OE_003A_SCHEDULER_HEALTH_SEMANTICS_IMPLEMENTED`, scheduler execution independent from market freshness, market freshness independent from scheduler invocation, provider budgets provider-specific, settlement closure independent from stale odds, product readiness limiting domain explained, API compatibility preserved, passing validation, passing build and production certification after automatic deployment.

### 68. Operational Excellence OE-003B Provider Budget Ledger Normalization

Objective: Normalize provider-specific budget evidence so future event-level refresh planning can make deterministic acquisition decisions without merging providers or fabricating quota balances.

Status: Production certified.

Scope: Provider-budget observability, canonical budget contract, dry-run forecast and authorization semantics only. No per-event planner, scheduler cadence, refresh cadence, provider limit, prediction formula, probability/confidence/edge/EV calculation, Official Pick policy, settlement rule, learning rule, provider mapping or provider subscription changed.

Result: `provider-budget.service.ts` now exposes `provider_budget_ledger_v1`, `provider_budget_authorization_v1` and `provider_budget_dry_run_forecast_v1`. SportsDataIO, The Odds API and BSN remain isolated provider/source pools. SportsDataIO usable remaining subtracts protected reserve; The Odds API current credits/reset remain unknown unless proven; request counts and quota units are distinct.

Completion criteria: `OE_003B_PROVIDER_BUDGET_LEDGER_NORMALIZATION_IMPLEMENTED`, provider isolation, unknown evidence preserved, configured-only evidence labeled, protected reserve explicit, dry-run forecast zero provider calls, exact provider-pool authorization, API compatibility preserved, passing validation, passing build and production certification after automatic deployment.

### 69. Operational Excellence OE-003C Per-Event Lifecycle State

Objective: Implement the canonical read-only per-event lifecycle contract required before event-level refresh planning.

Status: Production certified.

Scope: Dynamic lifecycle derivation, bounded read-only operations API, provider-budget dry-run context and compact MLB Operations Center visibility. No event-level refresh planner, scheduler cadence change, provider call, prediction generation, result import, settlement execution, learning write or recommendation-policy change is included.

Result: Production served commit `d7a1077eb5fc4c4dca00082a188c5908fe0aecae`. `/api/operations/event-lifecycle` derives state from stored `sport_events`, `prediction_history`, `game_results` and provider-budget evidence. Closure states outrank market refresh, terminal events missing canonical results become `RESULT_IMPORT`, settlement-ready events become `SETTLEMENT/P0`, recommendation relevance is classification-only and next actions are observational only. Production observation returned 15 current-day MLB events, with `HIGH_PRIORITY` 7, `ACTIVE_REFRESH` 8, `P1` 7, `P3` 8, provider calls 0 and database mutations 0.

Completion criteria: `EVENT_LIFECYCLE_CONTRACT_ADDED`, explicit lifecycle entry/exit rules, `FINAL` not inferred from elapsed time alone, missing result detection, settlement priority precedence, isolated provider-budget dry-run authorization, bounded current-day defaults, MLB Operations Center visibility, passing validation, passing build and production certification after automatic deployment.

### 70. Operational Excellence OE-003D Event-Level Refresh Planner

Objective: Convert OE-003C lifecycle evidence into a deterministic event-level refresh plan without activating new provider refresh behavior.

### 71. Operational Excellence OE-003E Canonical Acquisition Active Execution

Objective: Activate the canonical SportsDataIO MLB acquisition boundary for current operating-day pregame market refresh while preserving per-event planning, provider-efficient date-level batching, protected budget reserve, idempotent stored odds snapshots and zero prediction/recommendation/settlement/learning behavior changes.

Status: Production-certified in OE-003E.

Scope: Bounded SportsDataIO MLB current operating-day active acquisition through the protected adaptive scheduler path. The Odds API remains shadow-only and BSN remains observational. No scheduler cadence change, prediction generation, result import, settlement execution, learning write or recommendation-policy change is included.

Result: Production commit `c04f1ad34bac43825210b1481a12d1965116115e` executed one protected SportsDataIO MLB date-level `GameOddsByDate` request for 15 eligible current-day events. The certified acquisition wrote 90 canonical odds snapshots, consumed 1 configured quota unit, preserved reserve and recorded deduplication evidence under `canonical_acquisition_execution_v1`.

Completion criteria: `CANONICAL_ACQUISITION_ACTIVE_EXECUTION_PASS`, SportsDataIO MLB-only active scope, date-level batching, deterministic dedupe key, protected scheduler boundary, idempotent snapshot upsert, provider timestamp/fetch timestamp separation, zero prediction/result/settlement/learning writes, zero Official Pick policy change, passing validation, passing build and production certification after automatic deployment.

### 72. Mission Control MC-02 Multi-Sport Data Readiness

Objective: Certify sport-by-sport canonical data readiness before any multi-sport prediction activation.

Status: Production certified.

Scope: Read-only readiness contract, provider coverage matrix, sport-level blockers, Mission Control status, certification artifacts and validator. No prediction generation, model math, settlement, learning, scheduler cadence, provider contract or provider budget reserve changed.

Result: `/api/mission-control/data-readiness` exposes bounded evidence for MLB, NBA, NFL, NHL, Soccer, Tennis, UFC and BSN. MLB is `DATA_READY`; NBA, NFL, NHL and Soccer are `DATA_PARTIAL`; Tennis and UFC are `DATA_FOUNDATION`; BSN is `PROVIDER_BLOCKED`. Blocked sports remain isolated and do not block independent future workstreams.

Completion criteria: `MC_02_PRODUCTION_CERTIFIED`, all target sports classified, provider budgets isolated, BSN not claimed as The Odds API-covered, adapter existence not treated as readiness, normal reads provider calls 0, normal reads mutations 0, no model/settlement/learning activation, passing validation, passing build and production certification after automatic deployment.

### 73. Mission Control P2.3 Historical Progressive Replay

Objective: Create a bounded, isolated replay engine that processes stored historical validation evidence chronologically without contaminating Current Era, Official Picks, Current Board, production settlement or production learning.

Status: Production certified.

Result: P2.3 replay uses `historical_progressive_replay_v1`, max 10 events per execution and max 3 canonical markets per event. One-event certification and idempotency passed; the bounded sample processed 10 events and 30 settled replay predictions with zero provider calls and zero production writes. Replay Performance is exposed separately from Current Era.

Completion criteria: `P2_3_HISTORICAL_PROGRESSIVE_REPLAY_CERTIFIED`, one-event replay, idempotency rerun, bounded sample, leakage validation, separate Replay Performance, passing validation, passing build and production certification after automatic deployment.

### 74. Mission Control P2.4 Cross-Surface Epoch And Performance Consistency

Status: Production certified. Certification: `P2_4_PRODUCTION_CERTIFIED`.

Result: P2.4 introduces `/api/operations/e2e-integrity.surfaceConsistency` as the read-only authority for reconciling Homepage, Dashboard, Current Board, recommendation surfaces, Performance, Mission Control, Prediction Coverage and Historical Replay. Current V2 Production remains separate from Legacy and Replay scopes. MC-08E-R is next eligible after production PASS; MC-03 was not started.

### 75. Mission Control MC-08E-R Evidence-First Watchlist Experience

Status: Production certified.

Result: MC-08E-R preserves the paused MC-08E work on recovery branch `recovery/mc-08e-paused-2026-08-04` at commit `84083538f4a2932b24c09c98aa3138817c9116c6`, records external patch SHA256 `0BAA406D265C307743E6E40D2A4F97E1EFBED9C4021161D3BD491A4359926397`, and ports only the bounded Watchlist Experience onto the P2.4-certified baseline. The homepage Watchlist now uses the typed `watchlist_v1` evidence-first contract with states `ACTIONABLE`, `BEST_AVAILABLE_RESEARCH`, `WATCH`, `BLOCKED`, `UNAVAILABLE` and `NO_CURRENT_EVIDENCE`. No prediction, settlement, learning, scheduler, provider, Official Pick, Rent Play, Moneyline, Smart Parlay, ranking or model behavior changed. Production served commit `17c44f35081f199d61094704d29bc8b897850c87`; rendered desktop and mobile homepage checks passed with no horizontal overflow. MC-08F and MC-03 were not started.


MC-08F Personalization Experience update on 2026-08-04: MC-08F is locally implemented pending validation and production certification. It introduces the display-only `personalization_v1` contract, `/settings`, localStorage persistence, EN/ES language foundation, appearance, display timezone, odds format, preferred sports, preferred teams, homepage density and advanced-evidence visibility. No prediction, ranking, Official Pick, Kelly, settlement, learning, scheduler, provider or budget behavior changed. MC-08G and MC-03 were not started.


MC-08F production certification on 2026-08-04: production served commit `fabe9768cdcad2aca02773741ee44596945c7c59`; homepage/settings/performance personalization render checks passed, required read-only routes returned HTTP 200, and no provider or mutation behavior changed. MC-08G requires explicit instruction; MC-03 remains manual-only.
## OR-01D Operational Readiness Update

One automatic GitHub scheduled execution was observed, but sustained cadence is not certified. Production Pilot Week is NOT READY; do not begin MC-03 without explicit approval.

## OR-01E Adaptive Planner Behavioral Audit

OR-01E is certified as `MIXED_SCHEDULER_AND_PLANNER_DEFECT`. Scheduler delivery remains irregular, and planner continuity is also constrained because the protected operating-day route only continues after `sync_results` or `settle`; market refresh actions stop after one action and wait for another external invocation. The new protected `/api/operations/planner-trace` contract exposes the action inventory, selection policy, route loop caps, recent invocation summaries, starvation warnings and simulations with zero provider calls and zero mutations.

Production Pilot Week remains NOT_READY. MC-08H remains blocked. MC-03 remains not started. The next decision is a human architecture choice between scheduler delivery migration and a separately approved bounded planner-continuity repair.

## OR-01F Bounded Planner Continuity

OR-01F is production-certified on runtime commit `00a3badc308059811139d7c1734d1cee8cb885bf`. It implements the approved bounded planner-continuity repair without migrating scheduler infrastructure. The protected operating-day writer now uses `planner_continuity_v1`: max 3 actions, max 1 provider-backed action, read-only planner recomputation after material work, repeated-action guard, duration/mutation caps and safe internal `settle` continuation only.

The single protected proof invocation selected `midday_refresh`, made 0 provider calls, wrote 1 scheduler heartbeat, stopped with `NO_MATERIAL_CHANGE`, and did not continue because no material downstream internal action was due. This reduces dependence on repeated external scheduler ticks for internal closure, but sustained market freshness still depends on reliable scheduler delivery. Production Pilot Week remains NOT_READY, MC-08H remains blocked and MC-03 remains not started.

## PR-01 Final Production Readiness Audit

PR-01 is certified as not ready for Production Pilot Week. Current Era and Replay counts balance, and the Performance Header pipeline-readiness mapping was repaired as presentation-only. Pilot Week remains blocked by current scheduler/market freshness instability and Aug 4 result-import pending evidence. MC-08H was not rerun to PASS and MC-03 was not started.

- OR-02A certified Vercel Cron as primary scheduler with GitHub fallback and visible provider-call accounting. Next phase: Production Pilot Week, READY for 5-7 days of monitored real-world validation; MC-03 remains manual-only and not started.

## Production Pilot Week

Production Pilot Week Day 1 is active and recorded as `DAY_1_PASS_WITH_MONITORING`. The Day 1 baseline confirms an honest no-bet product state, complete remaining current-board market coverage, healthy scheduler/freshness/provider/operations domains, prior-day settlement closure and balanced Current Era Performance. Day 2 requires explicit continuation after Day 1 acceptance; MC-03 remains manual-only and not started.

ODDS-02 is locally certified as `PASS_SHADOW_ONLY`. It adds an isolated The Odds API MLB core-market shadow comparison path using `THE_ODDS_API_KEY` only, keeps `ODDS_API_KEY` untouched, preserves SportsDataIO as the production odds authority, and records one bounded shadow acquisition with 1 request, 3 credits, 24 events and 11 sportsbooks. No production recommendation, prediction, settlement, learning, provider-budget, scheduler or Official Pick behavior changed. ODDS-03, Historical Replay, Player Props and MC-03 were not started.

## SDIO-EXIT-02 Full MLB SportsDataIO Replacement

Status: Locally certified partial. SDIO-EXIT-02 reconfirmed the complete MLB SportsDataIO dependency graph and documents the replacement gates needed before cancellation. Historical MLB replay assets are independent; MLB status and result closure use MLB Stats API; settlement consumes canonical results. Full MLB exit remains blocked by ODDS-03C promotion proof, schedule/slate discovery replacement, starter identity persistence, player roster mapping and team/player stat feature parity. SportsDataIO stays enabled and product-authoritative for odds; The Odds API stays shadow-only; Production Pilot Week stays ACTIVE; MC-03 remains not started.

## SDIO-EXIT-03 MLB Official Replacement

Status: Locally implemented partial. SDIO-EXIT-03 adds the official MLB Stats API replacement foundation for schedule, event status and probable starters, including additive canonical row builders and read-only `/api/operations/mlb-official-replacement` evidence. The phase is ready for shadow observation only: SportsDataIO is not cancelled, odds authority is not promoted, model formulas and recommendation policy are unchanged, and cancellation remains blocked by real-slate shadow proof, ODDS-03C promotion, stat parity and a SportsDataIO-off operating window. HR-04, Player Props and MC-03 remain not started.

## SDIO-EXIT-03A Natural MLB Official Shadow Proof

Status: Repository repair ready for natural proof. SDIO-EXIT-03A wires `DUAL_READ` into the protected operating-day scheduler so eligible market-refresh actions also run a bounded official MLB Stats API schedule/status/probable-starter shadow acquisition. Evidence is additive and non-authoritative; canonical events, predictions, settlement, learning, odds authority and SportsDataIO rollback are unchanged. Final readiness waits for at least two consecutive eligible natural official shadow runs after deployment.

## Production Stability Repair ODDS-03C-R2A + Scheduler Health

Status: Local certification PASS, push required. The repair keeps The Odds API as Stage 3 product odds authority and MLB Official as primary non-odds source, fixes the R2 UUID persistence defect, and aligns `/api/operations/health` with real Vercel primary Stage 3 execution evidence without weakening scheduler thresholds or hiding fallback status. Next step: publish the bounded repair, deploy, then rerun SDIO-EXIT-05 zero-SportsDataIO operating-window proof.

## Health Current Board Timeout Repair

Status: Local certification PASS, push required. Health now treats Current Board as bounded supplemental product context instead of a hard dependency that can 500 the operations endpoint. Settlement guarantee remains focused on canonical result/prediction closure and records operations-health unavailability as a warning. Next step: publish, deploy, then re-certify health, settlement guarantee and SDIO-EXIT-05.

## MLB-FINAL-01 Complete Historical Market Expansion

Status: Local certification PASS, push required.

Result: MLB is certified as the reference sport with full-game Moneyline, Run Line `home -1.5` and Total Over historical model replay complete across 2,430 events and 7,290 settled replay rows. The phase intentionally activates 0 new market families because the remaining markets require real historical line/price evidence, market-specific model support, settlement replay and calibration before price-aware replay can be claimed.

Next: `MLB-FINAL-02_COMPLETE_HISTORICAL_MARKET_DATA_COLLECTION_OR_NBA_01_PREP`. Do not start NBA implementation, Historical Market Expansion spend, Player Props, HR-03 promotion or MC-03 without explicit approval.

## NBA-01 Data Foundation Provider Independence

Status: Local certification PARTIAL, push required.

Result: Existing NBA subsystems are preserved and classified for reuse. NBA has a useful partial/trial data foundation, but historical replay is not ready because full target-season schedule/results/stat/period-score coverage and official/free source import authorization are still missing. No provider calls, database mutations, NBA production activation, historical predictions or SportsDataIO expansion were performed.

Next: review/authorize official/free NBA historical source import, then `NBA-02_COMPLETE_HISTORICAL_FEATURE_RECONSTRUCTION_AND_REPLAY` after import coverage is sufficient.

## NBA-01A Historical Source Bootstrap

Status: Local certification pending push.

Result: NBA historical provider strategy is defined. The Odds API is the NBA core and historical price source candidate with a conservative historical cost model. NBA Stats public endpoints are selected as the non-odds schedule/status/results/boxscore/team-stat/player-stat candidate, pending access and terms approval. No provider calls, historical imports, NBA production activation, SportsDataIO expansion or bulk replay were performed.

Next: authorize NBA Stats public endpoint bulk import terms/access and, separately, approve The Odds API historical budget before price-aware import. Then run `NBA-02_COMPLETE_HISTORICAL_FEATURE_RECONSTRUCTION_AND_REPLAY` after the 2024-25 foundation is imported.

## NBA-01B The Odds API Historical-First Backfill

Status: Local partial/resumable certification pending push.

Result: The Odds API historical-first path discovered and persisted 1,221 NBA 2024-25 historical event foundation rows plus event provider mappings, with SportsDataIO calls 0 and NBA production still inactive. The odds-row persistence step failed on a Supabase/Cloudflare 520, so price-aware replay coverage remains 0 until a bounded persistence recovery is authorized.

Next: repair/resume NBA historical odds persistence without repeating paid successful historical requests unless explicitly authorized; stat-source access remains separately blocked.

## NBA-01B-R Historical Odds Persistence Recovery

Status: Local certification PASS, push required.

Result: The failed persistence root cause is certified as a single giant post-fetch `sports_odds_snapshots` upsert with no durable paid-payload checkpoint. The repaired importer durably checkpoints provider responses before DB writes, uses 50-row retryable odds chunks and persisted 29,214 The Odds API NBA historical odds rows from 159 bounded recovery requests. Coverage is now 1,196 price-aware 2024-25 NBA events across Moneyline, Spread and Total. SportsDataIO calls, NBA production activation, Current Era NBA prediction writes and bulk replay remained 0.

Next: resolve/certify NBA non-odds stat source access for results, quarter scores, boxscores, team stats, player stats and players before NBA replay.

## NBA-02A Historical Feature Reconstruction

Status: Local certification PASS, push required.

Result: NBA historical replay inputs are now formally reconstructed and certified as leakage-safe. The current NBA model contract supports Moneyline, Spread, Total and First Half; required team/event/scoring features are reconstructable from prior-only stored history with certified early-season fallbacks. Injuries and lineups are not required for replay and remain unavailable/degraded rather than inferred from postgame participation. Box-score D grade is not a blocker because current-engine required features are covered by team-game, player-game and advanced stat rows.

Replay scope is quantified as 3,710 model-replay-ready canonical games and 1,196 2024-25 full-core price-aware games for Moneyline, Spread and Total. First-half price-aware replay remains unavailable. NBA-02A made 0 provider calls, 0 database writes, 0 replay predictions and 0 NBA Current Era changes.

Next: `NBA-02B1_REPLAY_CANARY`. Do not begin bulk replay until canary inference, persistence, settlement preview, regime isolation and resume/idempotency pass.

## NBA-02B1 Replay Canary

Status: Local certification blocked on additive replay-isolation schema authorization.

Result: NBA-02B1 selected a deterministic 24-game canary across 2022-23, 2023-24 and 2024-25, generated 96 preview predictions for Moneyline, Spread, Total and First Half, bound 24 stored 2024-25 price-aware Moneyline/Spread/Total odds rows and preview-settled all 96 predictions with 52 wins, 44 losses, 0 pushes and 0 blockers. All work used stored evidence only with 0 BallDontLie calls, 0 The Odds API historical calls, 0 SportsDataIO calls, 0 replay writes, 0 Current Era writes and 0 product contamination.

The canary stopped before persistence because production `prediction_history.prediction_origin` is not selectable, preventing certified separation of `NBA_HISTORICAL_REPLAY_SHADOW` rows from Current Era/product rows. Next: authorize additive replay isolation schema migration, then rerun the NBA-02B1 persistence/idempotency gate before NBA-02B2 bulk replay.

## NBA-02B1-R Replay Isolation Schema

Status: Local migration/runtime support prepared; production migration application blocked by missing local DDL channel.

Result: NBA-02B1-R adds a forward-safe migration file for nullable replay-origin governance on `prediction_history`, selecting generic `HISTORICAL_REPLAY_SHADOW` as the explicit replay origin while preserving existing origin values and avoiding defaults/backfills. The canary runner now supports explicit `--persist` mode and would write deterministic non-current shadow rows only, with Official Pick, product, Current Era, production learning, production calibration and settlement-debt flags closed. No migration was applied and no replay rows were inserted because this environment has no Supabase CLI, `psql`, direct database URL or protected SQL execution route.

Next: apply `supabase/migrations/202608140001_nba_replay_isolation_prediction_origin_v1.sql` through an approved Supabase migration channel, rerun NBA-02B1-R with canary persistence/readback, then consider NBA-02B2 only after 96-row isolation and idempotency pass.

## NBA-02B1-R4 Model-Only Odds Nullability

Status: Additive odds-nullability migration prepared; production migration application required before persistence retry.

Result: NBA-02B1-R4 audits `prediction_history.odds` as an integer column still physically `NOT NULL` after replay isolation fields became available. The 96-row canary legitimately includes 72 model-only replay rows with no certified sportsbook price and 24 price-aware rows with bound odds. The prepared migration drops the physical `NOT NULL` and adds an explicit check constraint permitting null odds only for isolated `HISTORICAL_REPLAY_SHADOW` model-only rows with product, Current Era, Official Pick, production learning and production calibration flags closed. Current Era, Official Pick and price-aware replay rows continue to require odds.

Next: apply `supabase/migrations/202608140002_nba_replay_model_only_odds_nullability_v1.sql` through an approved Supabase migration channel, rerun NBA-02B1 canary persistence/readback/idempotency, then consider NBA-02B2 only after the 96-row canary persists cleanly.

## NBA-02B1-R5 Replay Canary Persistence

Status: Canary persistence/readback/idempotency passed; bulk replay requires explicit authorization.

Result: After the R4 migration was applied externally, NBA-02B1-R5 persisted the exact certified 24-game / 96-prediction replay canary as isolated `HISTORICAL_REPLAY_SHADOW` rows. The first run inserted 96 replay predictions and the second run inserted 0 while reusing all 96 deterministic rows. Readback found 96 replay rows, 72 model-only null-odds rows, 24 price-aware rows with real odds, 0 non-replay null-odds rows, 0 wrong-origin rows, 0 duplicate logical rows and 0 Current Era identity collisions. Settlement remained preview-only with 52 wins, 44 losses, 0 pushes and 0 blockers. NBA Current Era, Official Picks, production learning, production calibration, Current Era Performance, settlement debt and product surfaces remained isolated.

Next: `NBA-02B2_BULK_MODEL_REPLAY` is ready for explicit authorization. Do not start bulk replay automatically.

## NBA-02B2 Bulk Model Replay

Status: Local certification PASS, push required.

Result: NBA-02B2 completed the authorized full historical model replay from stored evidence only. The phase processed 3,710 certified replay-ready NBA events and reconciled 14,840 logical replay predictions across Moneyline, Spread, Total and First Half. It inserted 14,744 new `HISTORICAL_REPLAY_SHADOW` rows, reused the 96 canary rows, found 0 missing rows, 0 duplicate logical predictions, 0 wrong-origin rows and 0 replay Current Era contamination.

Model-only null-odds rows remain explicitly isolated and honest: 11,504 replay rows have no sportsbook price, while 3,336 price-aware rows preserve stored 2024-25 odds. No provider calls, NBA Current Era activation, NBA scheduler activation, Official Picks, production learning, production calibration, replay settlement writes, product-surface exposure or MLB mutations were performed.

Next: `NBA-02B3_PRICE_AWARE_HISTORICAL_EVALUATION` is ready after explicit authorization. Do not activate NBA Current Era, NBA scheduler or production recommendations from replay rows.

## NBA-02B3 Price-Aware Historical Evaluation

Status: Local certification PASS, push required.

Result: NBA-02B3 completed historical shadow price-aware evaluation from stored evidence only. The certified universe remains 3,710 historical events and 14,840 `HISTORICAL_REPLAY_SHADOW` predictions; 1,112 events and 3,336 Moneyline/Spread/Total rows have certified pregame historical prices. First Half remains model-only with 0 price-aware rows.

The prior 1,196 full-core estimate is reconciled: 1,112 provider events map into replay-exact price-aware rows and 84 provider-event rows are classified as `EVENT_MAPPING_MISMATCH`, with 0 unexplained. Price-aware shadow settlement produced 1,797 wins, 1,505 losses, 34 pushes, 54.42% accuracy, Brier 0.2615, calibration error 9.88 and -6.57% ROI. The result is diagnostic, not a production pick or profitability claim. Replay evaluation metadata is persisted only on isolated replay rows, final idempotency created 0 new settlements, and NBA Current Era, scheduler, Official Picks, production learning/calibration, product surfaces, provider calls and MLB mutations remain at 0.

Next: `NBA-02C_HISTORICAL_MODEL_DIAGNOSTICS_AND_CURRENT_ERA_READINESS`. Do not tune the model, activate NBA Current Era, enable NBA scheduler or create Official Picks without a separate authorization.

## NBA-02C Historical Diagnostics And Stake Policy Research

Status: Local certification PASS, push required.

Result: NBA-02C completed historical model diagnostics, Current Era shadow readiness review, predefined stake-policy research, bankroll-engine design and notification-readiness design from stored `HISTORICAL_REPLAY_SHADOW` evidence only. The certified price-aware universe remains 3,336 rows over 1,112 2024-25 events; provider calls, NBA Current Era writes, Official Picks, production learning, production calibration and MLB mutations remained 0.

The Moneyline accuracy/ROI contradiction is explained by favorite price tax: 64.3% Moneyline accuracy did not clear the 69.39% average implied break-even rate at an average selected price of -345.41. The official-like quantitative cohort remains isolated at 908 rows and was unprofitable at -5.62% flat ROI.

Stake policy research used a chronological event-level discovery/validation split within 2024-25 because 2022-23 and 2023-24 are model-only. Several predefined stake policies improved validation ROI in the held-out slice, but the result remains `RESEARCH_ONLY_NOT_PRODUCTION_READY` until forward Current Era evidence and production calibration exist. A future bankroll engine should begin as `RISK-01_BANKROLL_STAKE_ENGINE_SHADOW`; actionable notifications are deferred until Current Era, Official Pick, calibration, stake, freshness and dedupe gates are separately certified.

Next: `NBA-03A_CURRENT_ERA_SHADOW_FOUNDATION` after explicit authorization. If forward samples justify it, follow with `NBA-03B_ONLINE_CALIBRATION_OR_LEARNING_CHALLENGER`; keep any generic stake engine shadow-only until separately certified.

## NBA-03A-R1 Current Era Shadow Origin

Status: Local migration package ready; manual Supabase application required.

Result: NBA-03A-R1 prepares the additive schema/runtime contract required for `CURRENT_ERA_SHADOW`, a generic origin for real forward pregame shadow predictions. The new origin is separate from `LIVE_PREGAME`, `HISTORICAL_WALK_FORWARD_REPLAY`, `HISTORICAL_REPLAY_SHADOW` and `LEGACY_PRE_CERTIFICATION`, preserving the distinction between current-era evidence and user-facing production recommendation eligibility.

The migration package extends the origin check constraint and adds one partial current-era shadow lookup index. It does not mutate existing rows, backfill origins, change defaults or broaden RLS. The current read-only inventory has 0 existing `CURRENT_ERA_SHADOW` rows and all null-odds rows remain isolated to `HISTORICAL_REPLAY_SHADOW`; Current Era Shadow rows require real current pregame odds for core markets. Runtime typing now allows future NBA-03A writer code to pass `prediction_origin`, `certification_status` and `certification_metadata` explicitly.

Next: publish `NBA-03A-R1`, manually apply `supabase/migrations/202608150001_current_era_shadow_origin_v1.sql` through the approved Supabase SQL Editor workflow, verify 0 existing `CURRENT_ERA_SHADOW` rows after application, then resume `NBA-03A_CURRENT_ERA_SHADOW_FOUNDATION` from Block 5.

## NBA-03A Block 5 Current Era Shadow Canary

Status: Local certification PASS, push required.

Result: NBA-03A Block 5 implements the first bounded Current Era Shadow mechanism without forcing a live prediction. `NBA_CURRENT_ERA_SHADOW_CANARY_V1` scans stored future NBA events and stored odds evidence, defaults to dry-run, and refuses persistence unless explicit write authorization plus all safety gates pass.

The canary keeps the normal historical replay path unchanged while isolating Current Era Shadow from the unsafe legacy NBA production-generator fallbacks. Current Era Shadow now requires real stored The Odds API price evidence, timestamp/freshness validation, cutoff-safe pregame event state, exact market/selection/line identity, non-trial evidence and duplicate protection. Future rows will use `prediction_origin = CURRENT_ERA_SHADOW`, `certification_status = SHADOW_PENDING`, `production_eligible = false`, `recommended_pick = false` and certification metadata that keeps product, Official Pick, learning and calibration eligibility closed.

The current production-connected dry-run is a safe no-op because no legitimate future NBA event is stored. No Current Era rows, Official Picks, product-surface changes, learning/calibration writes, historical replay mutations, MLB mutations, provider calls or dry-run database mutations occurred.

Next: authorize a bounded current NBA schedule and The Odds API price-sync step. Do not create the first `CURRENT_ERA_SHADOW` row until legitimate future NBA event and real timestamped pregame price evidence exist and a separate first-shadow write is explicitly authorized.

## NBA-03A Current Data Sync

Status: Local certification PASS, push required.

Result: NBA-03A current data acquisition reused the existing NBA multi-sport adapter and canonical `nba-data-sync` persistence. A narrow runtime repair lets the adapter resolve `THE_ODDS_API_KEY` first while preserving `ODDS_API_KEY` as legacy fallback. The bounded execution made 2 The Odds API `basketball_nba` current odds calls and 0 SportsDataIO calls, then persisted/read back 41 future NBA events and 608 current/future odds rows across Moneyline, Spread and Total.

The Safe Canary remained dry-run only and found 362 eligible real-price candidates with 0 `CURRENT_ERA_SHADOW` rows written. Official Picks, product visibility, learning, calibration, historical replay and MLB all remained unchanged. Next: publish this certification, then request a separate explicit first-shadow write authorization for one bounded eligible candidate. Do not enable NBA production, NBA scheduler, recommendations, bankroll, notifications or learning/calibration from this evidence.

## NBA-03A Single-Candidate Shadow Writer

Status: Local certification PASS, push required.

Result: NBA-03A Block 5 now bounds the first Current Era Shadow write by construction. The certified canary supports `dry-run` and `write-one`; the generic all-candidate write path is disabled. `write-one` requires a stable candidate key from dry-run output and refuses persistence unless the selector resolves to exactly one write-eligible candidate.

The model/price identity repair keeps the existing NBA prediction engine as the only source of probability and confidence. Canonical model matching uses event, market, selection and exact line; sportsbook, odds, odds snapshot ID and source timestamp are attached price evidence. The dry-run found 362 price candidates and 133 safe model/price matches, with 0 production writes and 0 provider calls. Next: publish this repair, then authorize exactly one real `CURRENT_ERA_SHADOW` canary write by explicit candidate key.

## NBA-03A First Shadow Persistence Repair

Status: Code-only repair certified locally, push required.

Result: The first real `write-one` attempt was blocked by the shared `prediction_history` upsert contract, not by candidate eligibility. `savePredictionHistory` used a broad five-column conflict target that production does not enforce and that would collide legitimate different lines/model versions. The repair gives `CURRENT_ERA_SHADOW` rows a deterministic UUID primary key from the certified logical identity: sport, event, market, selection/team, exact line, sportsbook, prediction origin and model version.

Historical replay remains isolated at 14,840 rows, and the existing historical replay `id`/`idempotency_key` behavior is unchanged. No migration, provider call, production DB mutation or first-shadow retry was performed. Next: publish/deploy the repair, confirm alignment, then revalidate current price evidence before authorizing exactly one shadow write.

## NBA-03A Cross-Event Shadow Accumulation Policy

Status: `NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_CERTIFIED`

Result: NBA-03A now has a deterministic non-recommendation selection policy for controlled Current Era Shadow accumulation. The policy preserves every existing eligibility gate, excludes already-persisted logical rows, and round-robins eligible candidates across events with explicit event, event/market and model-identity caps.

The policy is designed for representative forward evidence, not betting optimization. It does not use probability, confidence, EV, edge, sportsbook preference, favorite/underdog status or settlement results. Stored-data dry-run showed the next 10 candidates improve from 2 events under old ordering to 10 events under the certified policy, with 0 provider calls and 0 database mutations.

Next: after explicit authorization, run one bounded cross-event accumulation batch using this policy. Keep NBA scheduler automation, Official Picks, product exposure, learning, calibration, bankroll and notifications inactive.

## NBA-03A Shadow Scheduler Preparation

Status: `NBA_03A_SHADOW_SCHEDULER_PREPARATION_CERTIFIED_READY_FOR_ACTIVATION_REVIEW`

Result: NBA-03A now has a bounded future scheduler contract for `NBA_CURRENT_ERA_SHADOW`, but the scheduler remains disabled. The preparation defines a default-off environment flag, Vercel-primary authority proposal, 30-minute cadence proposal, The Odds API budget envelope, lock/concurrency behavior, per-run/per-slate caps, audit trail, fail-closed states and rollback-by-config plan.

The fixture harness simulates the scheduler path without provider calls or production writes, including disabled mode, lock conflict, exhausted budget, no events, stale odds, valid candidates, all-already-persisted candidates, provider failure and deterministic reruns. Settlement, learning, calibration, Official Picks, bankroll, notifications and product recommendation exposure stay closed. Performance promotion remains blocked until enough Current Era Shadow rows settle; current readiness is `INSUFFICIENT_CURRENT_ERA_SETTLED_SAMPLE`.

Next: publish/deploy the scheduler-preparation commit, then run a separate activation review. Do not enable `NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED`, add NBA cron automation or create scheduler-driven shadow rows without explicit authorization.

## NBA-03A Shadow Scheduler Runnable Harness

Status: `NBA_03A_SHADOW_SCHEDULER_RUNNABLE_HARNESS_CERTIFIED_READY_FOR_ACTIVATION_CANARY`

Result: NBA-03A now has a protected runnable scheduler harness for a future NBA Current Era Shadow activation canary. The route `/api/cron/nba-current-era-shadow` uses the same `CRON_SECRET` convention as existing protected cron routes, consumes the default-off `NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED` flag and stops before lock, provider calls or writes when disabled.

The harness reuses existing components rather than creating a separate scheduler framework: provider-action lock, The Odds API NBA odds sync, Safe Canary, cross-event policy V1, deterministic `write-one` persistence, provider budget guard and `sports_sync_jobs` audit telemetry. Runtime bounds are 3 rows/run, review after 2 completed runs, hard max 4 runs, total canary cap 12 and pending guard 75. Vercel cron declaration remains deferred so deployment alone cannot start natural NBA scheduler runs.

Next: publish/deploy the harness, confirm production alignment and separately authorize the two-natural-run activation canary. Do not enable continuous operation, NBA Official Picks, product exposure, learning, calibration, bankroll or notifications.

## NBA-03A Shadow Scheduler Status Precheck

Status: `NBA_03A_SHADOW_SCHEDULER_STATUS_PRECHECK_CERTIFIED_READY_FOR_PUBLICATION`

Result: NBA-03A now has a protected read-only status/precheck mode on `/api/cron/nba-current-era-shadow`. The mode reuses `CRON_SECRET`, reports whether `NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED` is observed, and reads canary guard state without calling providers, syncing current data, writing predictions, mutating run counters, creating audit jobs or acquiring the active scheduler lock.

Next: publish/deploy this precheck, confirm production reports `schedulerEnabled=true` with review/hard-limit/pending/lock guards clear, then separately add the NBA Vercel Cron entry for the already-authorized two-natural-run activation canary. Do not enable indefinite continuous operation.

## NBA-03A Shadow Scheduler Cron Activation Canary

Status: `NBA_03A_SHADOW_SCHEDULER_CRON_ACTIVATION_CERTIFIED_FOR_CANARY`

Result: NBA-03A now has a certified Vercel Cron activation artifact for the first bounded Current Era Shadow scheduler canary. The artifact adds only `/api/cron/nba-current-era-shadow` at `*/30 * * * *`, keeps `/api/cron/operating-day` unchanged and preserves the two-run review boundary, 3-row per-run cap, 12-row hard cap, pending guard 75 and provider budget limits.

Next: publish/deploy the cron activation commit, verify protected precheck readiness in production, then observe exactly two natural Vercel Cron runs before review. Do not authorize continuous scheduler operation automatically.

## NBA-03A Shadow Scheduler Provider-Budget Gate Repair

Status: `NBA_03A_SHADOW_SCHEDULER_PROVIDER_BUDGET_GATE_REPAIR_CERTIFIED_READY_FOR_PUBLICATION`

Result: NBA-03A now reconciles protected precheck with the live scheduler execution budget gate. The natural Vercel Cron invocation proved the route was called but returned `PROVIDER_BUDGET_NO_OP` before provider access because The Odds API external balance evidence is unknown. The repair makes precheck evaluate the exact same 2-call authorization as execution and labels any unknown-balance canary allowance as `bounded_canary_unknown_balance`.

Global provider-budget protection remains fail-closed. The scoped allowance applies only to `NBA_CURRENT_ERA_SHADOW`, `the-odds-api`, `basketball_nba`, max 2 calls/run, max 4/hour, max 48/day, with SportsDataIO and historical odds fixed at 0. No provider calls, Current Era writes, product exposure, settlement, learning, calibration, Historical Replay or MLB behavior changed.

Next: publish/deploy this repair, verify protected precheck reports provider-budget readiness instead of a false-ready/budget-409 mismatch, then resume natural Vercel Cron observation. Do not manually invoke the scheduler.

## NBA-03A Shadow Scheduler Run 2 Cardinality Repair

Status: `NBA_03A_SHADOW_SCHEDULER_RUN2_CARDINALITY_REPAIR_CERTIFIED_READY_FOR_PUBLICATION`

Result: NBA-03A Run 2 persistence cardinality is repaired without weakening the certified single-candidate writer. Natural Run 2 selected three bounded candidates, but a later `write-one` revalidation could report `WRITE_CARDINALITY_NOT_ONE` when the exact candidate key was present only as an idempotent `ALREADY_EXISTS` row rather than a fresh `writeEligible` row.

The repair keeps `write-one` strict: zero matching keys and multiple matching keys still block as cardinality failures. The scheduler continues to loop over at most three selected candidate keys and invoke one-key write semantics independently. New audit rows now record selected candidate keys, persistence attempt count and per-candidate statuses so future Run 2 evidence can distinguish selected-candidate reuse from upstream already-persisted exclusions.

No provider-budget, scheduler cadence, Official Pick, product visibility, learning, calibration, settlement, Historical Replay, MLB or continuous-operation behavior changed. Certification used fixtures and local validators only: 0 provider calls, 0 production DB mutations and 0 production Current Era Shadow writes.

Next: publish/deploy this bounded repair, verify production alignment and protected precheck, then observe the next natural Vercel Cron execution under the repaired commit as the real Run 2 retry. Do not invoke the scheduler manually.

## NBA-03A Two-Run Canary Review Continuation

Status: `NBA_03A_REPAIRED_RUNTIME_VERIFICATION_CONTINUATION_CERTIFIED_READY_FOR_PUBLICATION`

Result: The two completed natural activation-canary runs are accepted as operationally valid automation evidence. They inserted 6 total `CURRENT_ERA_SHADOW` rows across two Vercel Cron executions, stayed within 2 The Odds API calls/run and preserved all product, Official Pick, learning, calibration, bankroll, notification, Historical Replay and MLB isolation boundaries.

Because the second successful run occurred before the Run 2 cardinality repair was deployed, one repaired-code natural verification run is still required before continuous shadow scheduler readiness can be considered. The continuation mechanism is additive and default-off: `NBA_CURRENT_ERA_SHADOW_REPAIRED_VERIFICATION_ENABLED=true` permits exactly one `REPAIRED_RUNTIME_VERIFICATION_RUN` after the two-run review pause, then the scheduler returns to review-required no-op.

The original canary history is retained. Current Era rows are not reset or deleted, and historical scheduler audit rows are not rewritten. No provider calls, production DB mutations, Current Era writes or continuous scheduling activation occurred during certification.

Next: publish/deploy this continuation mechanism, verify production alignment and protected precheck, then separately authorize the one-run repaired-runtime verification flag before observing the next natural Vercel Cron execution.
## NBA-03A Continuous Shadow Operating Policy

Status: `NBA_03A_CONTINUOUS_SHADOW_OPERATING_POLICY_CERTIFIED_READY_FOR_PUBLICATION`

Continuous NBA Current Era shadow scheduling is not activated automatically. The next gate is publication and production alignment of the default-off continuous guard, then explicit human authorization for `NBA_CURRENT_ERA_SHADOW_CONTINUOUS_ENABLED=true` only if the reviewed policy is accepted. Initial continuous collection remains shadow-only, capped at 3 rows/day and 2 The Odds API calls/day, with soft pause at 60 pending rows and hard guard at 75.

## NFL-02 Canonical Historical Import Readiness

Status: `NFL_02_CANONICAL_HISTORICAL_IMPORT_READY`

Result: NFL-02 now has an offline, local-data-first normalization dry run for the certified BallDontLie NFL historical dataset. The plan reuses shared canonical tables and produces deterministic row identities for teams, players, events, results, team stats, player stats, season stats, standings, forward-only roster supplement rows and provider mappings.

The canonical dry run validates 32 teams, 1,360 games, 1,359 completed results, 2,718 team-game stats, 85,749 player-game stats, 9,072 season-stat rows, 160 standings rows, 3,408 roster supplement rows, 0 orphan stat rows and 0 duplicate canonical IDs. The 16 provider-error payloads are quarantined as `PROVIDER_ERROR_EVIDENCE`; season stats, standings and roster data retain temporal restrictions.

Next: separately authorize the bounded production canonical import. Do not make additional BallDontLie calls, start P2, train NFL models, generate replay predictions or activate NFL production before the import gate.

## NFL-02-IMPORT-R1 Game Results Compatibility

Status: `NFL_02_GAME_RESULTS_SCHEMA_COMPATIBILITY_REPAIR_CERTIFIED`

Result: The production `game_results` table uses the established lean result shape and lacks the optional NFL-02 lineage columns `league_key`, `result_source`, `metadata` and `updated_at`. NFL-02 now projects internal rich result rows into the production-compatible persistence shape while preserving lineage through deterministic result IDs, canonical event IDs, `sport_events.provider_ids` and `provider_entity_mappings`.

Migration required: no. The repaired dry run validates 1,359 production-compatible result payloads, excludes the cancelled BUF @ CIN event, rejects unsupported result columns and preserves idempotent result identity. Next: resume NFL-02-IMPORT at the production schema and full dry-run gates, then execute the bounded canonical import only if all gates pass.

## NFL-02-IMPORT-R2 Game Results UUID Identity

Status: `NFL_02_GAME_RESULTS_UUID_IDENTITY_REPAIR_CERTIFIED`

Result: The second production dry-run gate found `game_results.id` is a UUID surrogate key generated by production, while the established shared result writer keys idempotency by `game_id`. NFL-02 now follows that contract: production result insert payloads omit `id`, lookups/reuse/update reasoning use `game_id`, and duplicate `game_id` rows block import.

Migration required: no. Result lineage remains `BallDontLie game ID -> provider_entity_mappings -> sport_events.id -> game_results.game_id -> DB-generated game_results.id`. Next: publish/deploy this R2 repair and resume NFL-02-IMPORT production dry-run/import gates.

## NFL-02-IMPORT-R3 Production Import Executor

Status: `NFL_02_PRODUCTION_IMPORT_EXECUTOR_CERTIFIED_READY_FOR_PUBLICATION`

Result: NFL-02 now has a guarded DB-only production import executor around the already-certified canonical normalizer. It writes only historical BallDontLie NFL evidence, keeps dry-run as the default, requires `--execute` plus `NFL_02_CANONICAL_PRODUCTION_IMPORT_AUTHORIZED=true`, uses bounded batches and records local progress while treating deterministic database identities as the source of truth.

The executor preserves 2026 The Odds API NFL rows, uses `game_id` for result idempotency while leaving `game_results.id` database-generated, excludes provider-error payloads, keeps roster forward-only and does not touch prediction/product state. Next: publish/deploy this executor, verify production alignment, then separately authorize the guarded production import execution.

## NFL-02-IMPORT-R5 Supabase Fetch Resilience

Status: `NFL_02_SUPABASE_FETCH_RESILIENCE_REPAIR_CERTIFIED`

Result: The partial production import safely inserted 32 NFL teams, then paused before player writes because the first `sport_players` existing-row pre-read sent 500 IDs in one Supabase `.in('id', ids)` request. Smaller bounded probes succeeded through 250 IDs, while the 500-ID request failed with `TypeError: fetch failed`, classifying the issue as `URL_OR_FILTER_TOO_LARGE`.

The import executor now keeps write batches unchanged while splitting existing-row pre-reads into 100-ID chunks with bounded read-only retry backoff of 500 ms, 1500 ms and 3000 ms. Write retries remain fail-closed. The native first-player-batch probe now passes in 5 chunks with 0 existing players and 500 `WOULD_INSERT` rows; full dry-run counts remain certified and 2026 The Odds API NFL rows remain preserved. Next: publish/deploy R5, then separately resume the guarded NFL-02 production import from `sport_players` batch 1.

## NFL-03 Temporal Feature Model Foundation

Status: `NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION_CERTIFIED`

Result: NFL-03 now has an offline temporal feature builder and first model foundation for 2021-2025 certified NFL canonical history. The split is chronological: 2021-2023 training, 2024 validation/calibration and 2025 holdout. Minimum history is 3 prior completed games per team, yielding 1,311 eligible feature rows with 86 features and 0 leakage violations.

The certified feature contract requires `source_event.start_time < target_event.start_time` and excludes same-game stats, future games, full-season stats, final standings and forward-only roster evidence from historical pregame features. The V1 model foundation uses regularized logistic regression for moneyline and ridge score regressions for home/away score, margin and total diagnostics. NFL-03 remains offline-only: 0 provider calls, 0 production DB mutations, 0 prediction writes, 0 Official Picks and no MLB/NBA runtime changes.

Next: publish NFL-03, verify alignment, then separately authorize NFL-04 current-era shadow and current-market integration using real The Odds API NFL markets. Do not fabricate historical spread/total odds or activate NFL product surfaces before NFL-04 gates pass.

## NFL-04R1 Frozen Runtime Model Artifact

Status: `NFL_04R1_FROZEN_MODEL_ARTIFACT_MATERIALIZED_CERTIFIED`

Result: NFL-04R1 converts the deterministic NFL-03 offline model state into a runtime-loadable artifact without changing the model. The artifact stores the complete ordered feature manifest, preprocessing means/stds, missing-value semantics, logistic moneyline coefficients, 2024 Platt calibration parameters, home/away score ridge coefficients, source digests, parity rows and validation/holdout residual evidence.

Runtime artifact scoring now reproduces the certified NFL-03 outputs across all 1,311 feature rows with max delta 0 and reproduces the certified validation/holdout metrics exactly. The runtime scorer is provider-free, DB-free and fails closed on missing artifact, checksum mismatch, version mismatch, feature count mismatch, invalid coefficients and missing input features. Next: publish NFL-04R1, then separately authorize NFL-04R2 current BallDontLie forward-data preflight and fresh The Odds API NFL market refresh. Do not write `CURRENT_ERA_SHADOW` predictions until that full forward evidence chain passes.

## MLB-03R3B Shadow Immutable Fingerprint Standardization

Status: `MLB_03R3B_FINGERPRINT_STANDARDIZATION_LOCAL_READY`

Result: MLB clean shadow canary preservation now has one shared canonical immutable fingerprint helper for validators and canary tooling. The contract hashes immutable evidence only and excludes lifecycle, settlement and mutable observation fields. Canary 1 reproduces the certified canonical digest `78868b4ef923ee5155cee83c2fa865ccf6c4943ecf31f45176cc7bd9f372be48` locally with deterministic serialization.

Next: publish/deploy the fingerprint standardization, verify production alignment, re-certify canary 1, then perform the separately gated second clean calibrated MLB `CURRENT_ERA_SHADOW` canary write if fresh candidate evidence still passes.

## MLB-DATA-01C-R3 Read-Only Identity Acquisition

Status: `MLB_DATA_01C_R3_IDENTITY_ACQUISITION_PARTIAL`

Result: R3 acquired authoritative MLB Official 2025 identity evidence into local resumable artifacts only. Official acquisition covered all 2,430 Statcast games and all 1,469 source MLBAM player IDs, but deterministic reconciliation remains incomplete: 614 games do not have a safe canonical event mapping and 1,469 players still lack exact canonical `sport_players.id` linkage.

Next: run a separately gated canonical event repair / canonical player creation plan. Do not persist crosswalks, write raw canonical mapping columns or start MLB-DATA-01D feature construction until that reconciliation gate passes.

## MLB-DATA-01C-R4 Canonical Reconciliation Plan

Status: `MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN_PARTIAL`

Result: R4 produced a zero-write event/player repair plan from cached R3 evidence. Event gaps are inventoried and accounted for, but 309 doubleheader/date-time identity gaps remain unsafe; player linkage is also incomplete with 1,292 existing-player identity gaps, 161 confirmed missing canonical players and 16 ambiguous players.

Next: perform a separate deterministic disambiguation proof before authorizing R5 persistence. R5 must not write crosswalks, raw canonical IDs or created canonical identities until R4 is upgraded to a complete deterministic repair plan.

## MLB-DATA-01C-R4A Deterministic Disambiguation Proof

Status: `MLB_DATA_01C_R4A_DETERMINISTIC_DISAMBIGUATION_PARTIAL`

Result: R4A extended the R4 plan with an exact-only stored identity graph and confirmed no safe broad persistence path yet. The 7 remaining event gaps still lack exact stored game_pk/provider mapping evidence, the 1,292 existing-player gaps remain name-audit-only with no exact provider-ID path to a current `sport_players.id`, the 16 ambiguous players remain unresolved, and the 161 true-missing players remain the only safe future player-create set.

Next: repair or acquire deterministic stored identity edges in a separate zero-write proof before R5. R5 persistence remains blocked, and MLB-DATA-01D feature construction remains prohibited until identity persistence is separately authorized, executed and readback-certified.

## MLB-DATA-01C-R4B Exact Identity Edge Recovery Plan

Status: `MLB_DATA_01C_R4B_EXACT_IDENTITY_EDGE_RECOVERY_PLAN_CERTIFIED`

Result: R4B converts the R4A blockers into an exact-edge recovery architecture. The seven event gaps require one deterministic `MLB game_pk -> sport_events.id` edge per game or a later Pick 2 gamePk-rooted event fallback. The 1,292 existing-player candidates remain unlinked because name evidence is explicitly rejected; the only acceptable player recovery is MLBAM person ID to exact provider player ID to one current `sport_players.id`, or an equally deterministic stored chain. The 16 ambiguous players require the same exact discriminator, and the 161 true-missing players remain safe create candidates.

Next: `MLB_DATA_01C_R4C_EXTERNAL_EXACT_EDGE_ACQUISITION`. Run a bounded, read-only, identity-only probe against already configured provider/local sources, starting with SportsDataIO MLB Players only if the call is separately authorized. If no exact MLBAM-to-SportsDataIO/current-canonical bridge exists, switch to an isolated Pick 2 MLBAM-rooted canonical namespace plan. R5 persistence and MLB-DATA-01D feature construction remain blocked.

## MLB-DATA-01C-R4C External Exact Identity Edge Acquisition

Status: `MLB_DATA_01C_R4C_EXTERNAL_EDGE_ACQUISITION_BLOCKED`

Result: R4C attempted the authorized bounded identity-only acquisition and stopped without persistence. The one SportsDataIO MLB `Players` master/list call and seven SportsDataIO `GamesByDate` event identity calls all returned HTTP 401, so no certifiable player MLBAM/person field, player crosswalk, event edge or event crosswalk could be produced. The 1,292 existing-player gap, 16 ambiguous-player gap, 161 safe-create set and seven event edge gaps remain unchanged.

Next: recheck SportsDataIO MLB credential/entitlement out of band, then rerun only the bounded R4C provider-auth recheck if authorized. Do not proceed to R4D namespace planning unless a successful identity payload proves there is no exact MLBAM bridge, and do not start R5 or MLB-DATA-01D.
