# R2T-R1 pregame evidence provenance and target binding

**MLB_DATA_02R_R2T_R1_PREGAME_EVIDENCE_PROVENANCE_AND_TARGET_BINDING_CERTIFIED**

Prior package: `b51472db38caa7b18776d4c42ec57a014b131368`. The new package is the enclosing bounded local commit. No push. **LIVE_EXECUTE remains disabled; R2B Live Execution Ready = NO.**

This certifies the 2026 regular-season moneyline V1 pregame evidence contract, a real historical pregame reconstruction, the pure model path and future persistence design. It does not certify stored-output parity, execute feature persistence, complete the broader R2T executor or authorize live re-enablement.

## Real pregame evidence

The current native-game candidates lacked required canonical target fields and were rejected. The validator inspected the latest 100 historical native candidates in descending scheduled-time order and selected the most recent qualifying target, game **824552**. This is explicitly a historical pregame reconstruction, not today's live slate.

| Evidence | Value |
|---|---|
| Official game date | 2026-09-06 |
| Stored scheduled start | 2026-09-06 22:20:00Z |
| Frozen pregame as-of | 2026-09-05 01:51:21.667Z |
| As-of authority | Existing certified 02I inference capture, not a fixture clock |
| Native schedule/starter observation | 2026-09-04 23:04:12.540272Z |
| Home team | `baseball_mlb:mlb:sportsdataio:team:16` |
| Away team | `baseball_mlb:mlb:sportsdataio:team:20` |
| Home probable starter | Sean Burke, MLBAM 680732 |
| Away probable starter | Bailey Ober, MLBAM 641927 |
| Latest source performance date | 2026-09-03 |
| Latest raw availability timestamp | 2026-09-05 00:54:52.174099Z |
| Historical scope | 80,667 pitches, 270 complete stored dependency games |
| Model home probability | 0.582930267104607 |
| Model away probability | 0.41706973289539295 |

The source team-ID namespace is an existing canonical identity, not a SportsDataIO provider request. Native `updated_at` is used as a conservative persisted observation upper bound; no original provider publication timestamp is invented. Raw `ingested_at` and `created_at` must precede the frozen as-of. The raw dependency digest and complete dependency-game list are in the canonical JSON.

The initial bulk query timed out with PostgreSQL 57014. It was stopped and replaced by indexed per-game queries with bounded concurrency and exact count/truncation checks. The final validation replays the just-captured production read cache with matching game/as-of and digest checks, while refreshing registry and physical-column reads. It does not substitute a test fixture for real data.

## Target, starter and lineup contract

The target resolver requires scoped positive `game_pk`, official date evidence, future `scheduled_at`, distinct native teams, certified season/game type, doubleheader/game number, frozen pregame status and timestamped canonical source evidence. Missing or contradictory fields block the game.

Starter resolution uses the latest observation first. Confirmed outranks probable only at that observation time and for the same pitcher. Unknown, changed, conflicting, wrong-game/team, out-of-time or fixture-source evidence blocks. A replacement pitcher inconsistent with the frozen native target also blocks; an older confirmed assignment cannot override a later replacement.

**No moneyline V1 feature directly consumes a starting lineup, projected lineup, individual batter identity, lineup composition or individual batter-state row.** The 76-feature manifest consists of team, starter and bullpen home/away/difference values plus the certified home-field constant.

The existing certified 02H `addDailyRows(..., persistBatter=false)` future-schedule branch explicitly emits `future_schedule_no_lineup`, zero batter rows and empty first-inning lineup identities. This resolves the earlier R2T blocker without using observed target-game batters or inventing a lineup. Confirmed/projected lineups, when supplied, require provenance checks and remain context-only for this feature set. Missing required lineups/batters in a future dependent capability must block; projected-only required inputs are not certified here.

## As-of and seven-domain contract

Performance cutoff is the earlier of the target's official date and the Puerto Rico calendar date of `run_as_of`. Source game dates must be strictly earlier than that cutoff. For this case the run operating date is September 4, so performance stops September 3, even though the target game is September 6. Target-date rest calculations remain unchanged.

| Domain | Permissible evidence and target |
|---|---|
| Snapshots | Exact entity/family identity, target date, source cutoff and digest; all underlying evidence available by as-of |
| Team | Canonical home/away team histories from prior-date raw games; no target lineup substitution |
| Starter/pitcher | Provenance-resolved starters; prior appearances; assignments observed by as-of |
| Bullpen | Canonical team relief history; certified baseline workload constants preserved |
| Batter | Empty for the moneyline no-lineup branch; no invented identities or rows |
| Matchup | Target game, canonical teams and frozen starters; no observed target-game batting context |
| First inning | Target game and frozen starters; prior history; empty lineup identities explicitly retained |

All domains reject target-game performance, same-day performance, source observations after as-of and inconsistent snapshot/entity/date/version linkage. Nullable numerical inputs use only certified train-fitted median imputation; absent rows/fields and non-finite values block.

The canonical JSON maps all **76/76 features** to physical source, selection key, entity IDs, as-of rule, missingness, starter/lineup dependency and numerical lineage.

## Persistence and all-game design

All seven future payload column sets were checked against production through SELECT-only queries. One no-lineup target generates 10 entity/family snapshots, two team rows, two starter rows, two bullpen rows, zero batter rows, one matchup row and one first-inning row. These are observed outputs of target expansion and the unchanged builder, not hard-coded execution caps. Three real qualified contexts exercise all-game expansion; duplicate games block.

Prospective snapshot UUIDs exist only in memory. They are not represented as production IDs. Future persistence must resolve each deterministic snapshot identity to the inserted/reused canonical UUID, bind the exact entity/family FK, and then invoke the existing physical-payload insert/reuse/conflict classifier. INSERT_ELIGIBLE count determines the write cap; REUSE_NO_OP consumes zero DML; any BLOCK_CONFLICT stops. No persistence was executed in R1.

## Stored-output parity plan

A stored Champion prediction exists for the same target and frozen as-of, alongside 23 other candidate rows. The selected target's raw source state has been reconstructed, and registry/artifact/preprocessing identities match. The exact plan is **READY**, not a parity claim.

The next phase must compare the certified 02I current-vector rounding and `inputPayload` serialization against the new reconstruction. The stored digest includes market, feature version, team identities, starter/data state and missingness; R2F's shorter digest input must not replace it. Require exact input-digest agreement and probability agreement within 1e-12, accounting for stored 12-decimal probability precision. Late database persistence is not evidence that a prediction's inputs existed at its claimed as-of; source availability must remain independently verified.

## Validation and certification gates

All 15 R1 gates are satisfied: target provenance, starter provenance, lineup policy, as-of contract, source matrix, entity resolution, real pregame case, real vector, missing-evidence policy, parity plan READY, persistence contract, all-game expansion, dry model path, negative tests and live containment.

The dedicated R1 validator passes **41 checks**. The source comparison passes **85 checks**: all 02H function bodies remain unchanged, as do the Champion artifact, existing vector/inference math, R2T loader and live containment. Only three existing helper declarations were exported.

The required legacy stack was run. R2F/G/H pass. R2I/L/M/N/O/P/Q/R/S remain nonzero at the preserved R2T live stop and are explicitly classified **EXPECTED_LIVE_CONTAINMENT_INCOMPATIBILITY**, as permitted by the R1 instruction. Their results are not relabelled PASS; R2M/Q additionally emit a Windows libuv shutdown assertion. Existing R2T assertions still run, with its broader verdict intentionally incomplete. Certified 01D build/recovery, 02A–02F model/Champion and 02H-R2 foundation validators pass.

Final `npm.cmd run build`: exit 0, 400 static pages. Changed-file ESLint: exit 0, no warnings. Final diff and targeted secret-scan results are recorded in the canonical JSON.

## Safety, repository and next phase

**Provider calls 0; production DML 0; production DDL 0.** Training, Champion changes, automation changes, cron changes and settlement are also 0. No prediction/market/value/pick write, live refresh, push or deployment occurred. Completed validator ledgers record GET/HEAD-only access; the canceled bulk-read attempt has no complete exit ledger and is not silently included in that total.

All 19 inherited unstaged artifact changes remain hash-identical and outside the commit. `.tmp/` and `.worktrees/` were not physically accessed; legacy validator cache/output paths were intercepted and redirected to isolated OS temporary directories. Existing R2T/R2S evidence remains unchanged.

R2T completion readiness: **ready for stored-output parity and real per-domain persistence binding; R2T itself remains incomplete**. Current native target deficiencies still block those games. Next, prove stored-output parity, bind real per-entity persistence and all eligible games, and complete the full real-model executor simulations. Keep providers and production mutations at zero and preserve live containment until a separate re-enablement certification.
