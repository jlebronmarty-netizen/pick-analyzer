# MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION

**Certification Verdict:** `MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION_CERTIFIED`

Read-only review and conditional repair authorization packet only. Production is not repaired. Game 823092's two starters remain UNKNOWN. Live execution is disabled and R2T-R2 Gate 5 was not executed.

## Package and scope

Prior package: `5602d03907af269061bef97f6dc375fe349eb9b5`. New package: the enclosing local commit, resolved by `git log -1 --format=%H -- docs/CERTIFICATION/MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION.json`; the final response reports the actual SHA.

The review covers every one of R2B's 140 proposed assignments across 15 native games. It also accounts for the two unresolved fields that were never proposed. Five SELECT-only statements inspect 22 internal sources and discover all seven shared Statcast relations with a game_pk column. All data searches concern game 823092; the catalog discovery reads relation names only. Seven existing local certification artifacts match that game. No provider was called, no production statement mutated data, and no protected directory was accessed.

## Gates

| Gate | Contract | Result |
|---|---|---|
| 1 | MLB_02R_R2T_R2C_UNKNOWN_STARTER_INVENTORY | COMPLETE |
| 2 | MLB_02R_R2T_R2C_INTERNAL_STARTER_RECOVERY | NONE |
| 3 | MLB_02R_R2T_R2C_STARTER_REQUIREMENT_MATRIX | COMPLETE |
| 4 | MLB_02R_R2T_R2C_UNKNOWN_STARTER_POLICY | PASS |
| 5 | MLB_02R_R2T_R2C_REPAIR_PREVIEW_REVIEW | COMPLETE |
| 6 | MLB_02R_R2T_R2C_REPAIR_PROVENANCE_CONTRACT | PASS |
| 7 | MLB_02R_R2T_R2C_IMMUTABILITY_REVIEW | PASS |
| 8 | MLB_02R_R2T_R2C_SAFE_DML_SUBSET | READY |
| 9 | MLB_02R_R2T_R2C_REPAIR_IDEMPOTENCY | PASS |
| 10 | MLB_02R_R2T_R2C_GATE4_PASS_CRITERIA | READY |
| 11 | MLB_02R_R2T_R2C_REPAIR_AUTH_PACKET | READY |
| 12 | MLB_02R_R2T_R2C_LIVE_CONTAINMENT | PASS |

NONE for internal starter recovery is a valid reviewed result, not invented recovery. Immutability PASS applies to the final safe authorization subset, whose unsafe/conflict counts are both zero. The rejected proposals remain explicitly classified and excluded.

## Exact unresolved starter inventory

| Game | Physical table | Column/path | Current value | Side | Required semantic type |
|---|---|---|---|---|---|
| 823092 | public.pick2_mlb_games | metadata: homeProbablePitcher.id | Absent top-level key; original nested value NULL | home | Positive MLBAM pitcher ID plus exact game/side and availability provenance |
| 823092 | public.pick2_mlb_games | metadata: awayProbablePitcher.id | Absent top-level key; original nested value NULL | away | Positive MLBAM pitcher ID plus exact game/side and availability provenance |

Consumer: the existing resolveStarterContext supplies entity identity to starter feature construction and buildPregameFeatureRows. A required entity ID cannot be median-imputed or replaced by a roster player. The original same-game metadata contains null homeProbablePitcher and awayProbablePitcher under starter_evidence. R2B's exact response, observed at 2026-09-08T19:16:32.018Z, still omitted both probablePitcher assignments. Its SHA-256 is `0a58516d4337e8183a77ac69979eaa91e0dbeff16b01301e741076a87081e345`. The current internal search provides no replacement assignment.

## Internal evidence search

| Source | Same-game rows |
|---|---:|
| native | 1 |
| players_same_game_metadata | 0 |
| raw | 0 |
| snapshots | 0 |
| pitcher_features | 0 |
| predictions | 0 |
| market_mappings | 0 |
| market_prices | 0 |
| value_evaluations | 0 |
| pitcher_rollups | 0 |
| batter_rollups | 0 |
| exact_events | 0 |
| event_crosswalks | 0 |
| context_exact_candidates | 0 |
| batter_materialized | 0 |
| pitcher_materialized | 0 |
| batter_total_bases | 0 |
| first_inning | 0 |
| classified_raw_view | 0 |
| exact_event_id | 0 |
| lineup_same_game_metadata | 0 |
| starter_assignments_exact_event | 0 |

The one native row is unchanged from the certified baseline and still has null starter evidence. All other searched sources are empty. Raw and classified-view capped reads returned zero, so no truncation is hidden. The seven game-scoped Statcast views/materializations were all checked; no refresh operation ran. Season/aggregate views without game_pk cannot establish a target starter assignment. Player metadata searches found no same-game edge, and no pitcher IDs were available for a meaningful identity join. Exact events, event mappings, context and lineup searches also supply no edge. Substring searches were candidate discovery only and returned zero; such a match alone would not qualify as authoritative identity.

Local artifacts searched:

- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R1_PREGAME_EVIDENCE_PROVENANCE_AND_TARGET_BINDING.json`: 1 exact-identity objects, zero new positive starter candidates; digest recorded in JSON.
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN.json`: 48 exact-identity objects, zero new positive starter candidates; digest recorded in JSON.
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN_AUDIT.md`: 0 exact-identity objects, zero new positive starter candidates; digest recorded in JSON.
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2B_BOUNDED_MLB_OFFICIAL_EVIDENCE_RECOVERY_AUDIT.md`: 0 exact-identity objects, zero new positive starter candidates; digest recorded in JSON.
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION_AUDIT.md`: 0 exact-identity objects, zero new positive starter candidates; digest recorded in JSON.
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2B_BOUNDED_MLB_OFFICIAL_EVIDENCE_RECOVERY.json`: 48 exact-identity objects, zero new positive starter candidates; digest recorded in JSON.
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json`: 2 exact-identity objects, zero new positive starter candidates; digest recorded in JSON.

The embedded cached MLB Official response was inspected directly. No provider request was repeated. R2B's earlier one-call count remains part of historical evidence; **this R2C phase consumes zero provider calls**.

## Semantic requirements and unknown policy

| Context | Are 823092 starters required? | Certified treatment |
|---|---|---|
| A_CURRENT_CANONICAL_NATIVE_ENRICHMENT | NO | UNKNOWN_ALLOWED_FOR_CANONICAL_ROW |
| B_HISTORICAL_STORED_OUTPUT_PARITY_824552 | NO | NOT_REQUIRED_FOR_R2T_R2_TEST_CASE |
| B_HISTORICAL_RECONSTRUCTION_823092 | YES | BLOCK_HISTORICAL_RECONSTRUCTION |
| C_FUTURE_LIVE_823092_IF_TARGETED | YES | BLOCK_FUTURE_LIVE_GAME_IF_TARGETED |
| D_R2T_R2_SELECTED_INJECTED_PERSISTENCE_824552 | NO | NOT_REQUIRED_FOR_R2T_R2_TEST_CASE |
| D_ALL_GAME_PERSISTENCE_IF_823092_TARGETED | YES | BLOCK_FUTURE_LIVE_GAME_IF_TARGETED |

Canonical enrichment is independent of a pitcher assignment: the native schema permits absent starter metadata. For a historical reconstruction of 823092, a target-dependent starter assignment and its historical availability are required. For live or all-game persistence work that actually targets it, UNKNOWN blocks that game. Neither a different game's pitcher nor current/postgame pitcher evidence may stand in for a historical pregame assignment.

The existing selected parity/injected-persistence case is **824552**, with home pitcher **680732** and away pitcher **641927**. Its native evidence was observed before its archived as-of 2026-09-05T01:51:21.667Z. The actual existing R1 resolver confirms its native/own-starter binding; no 823092 entity enters that scope. This verifies the native binding dependency only, not a new feature vector or persistence proof. Stored-output parity and its feature-history semantics remain unchanged and were not rerun.

## Row-by-row preview review

Every original proposal is retained in canonical reviewedPatches with physical column/path, old/new values, source, observation timestamp, digest, current-only/historical flags, safety classification, starter dependency and safeToPatch. rowReviews indexes these exact entries by game and field rather than duplicating them. authorizationPacket.rows contains every exact final safe patch and expected source row.

| game_pk | Original proposals | Safe assignments | Excluded proposals | Safe physical columns |
|---|---:|---:|---:|---|
| 823092 | 7 | 6 | 1 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 823174 | 9 | 6 | 3 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 823250 | 9 | 6 | 3 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 823414 | 10 | 6 | 4 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 823500 | 10 | 6 | 4 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 823738 | 9 | 6 | 3 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 823821 | 10 | 6 | 4 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 823901 | 9 | 6 | 3 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 824063 | 9 | 6 | 3 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 824228 | 10 | 6 | 4 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 824551 | 9 | 6 | 3 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 824714 | 10 | 6 | 4 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 824792 | 10 | 6 | 4 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 824875 | 10 | 6 | 4 | home_team_id, away_team_id, game_type, metadata, updated_at |
| 824957 | 9 | 6 | 3 | home_team_id, away_team_id, game_type, metadata, updated_at |

For every row, the six assignments are:

1. home_team_id: SQL NULL to its already-certified canonical team ID.
2. away_team_id: SQL NULL to its already-certified canonical team ID.
3. game_type: SQL NULL to the explicitly observed official R value.
4. metadata.officialDate: absent to the exact official date 2026-09-08.
5. metadata.r2t_r2b_evidence: absent to the exact dated observation plus explicit repair version/reason and canonical source chains.
6. updated_at: its exact prior timestamp to actual future statement_timestamp(), only on first application.

The final provenance value extends the R2B proposal to meet the explicit repair-version/reason contract; the record's logical assignment count remains one per game. The two metadata paths are merged into one metadata column assignment per row, preserving every unrelated key.

| Game | Old home / away | New home canonical ID | New away canonical ID | Old type / official-date key | New type / official date |
|---|---|---|---|---|---|
| 823092 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:13 | baseball_mlb:mlb:sportsdataio:team:28 | NULL / absent | R / 2026-09-08 |
| 823174 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:15 | baseball_mlb:mlb:sportsdataio:team:31 | NULL / absent | R / 2026-09-08 |
| 823250 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:33 | baseball_mlb:mlb:sportsdataio:team:35 | NULL / absent | R / 2026-09-08 |
| 823414 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:12 | baseball_mlb:mlb:sportsdataio:team:30 | NULL / absent | R / 2026-09-08 |
| 823500 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:29 | baseball_mlb:mlb:sportsdataio:team:23 | NULL / absent | R / 2026-09-08 |
| 823738 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:32 | baseball_mlb:mlb:sportsdataio:team:9 | NULL / absent | R / 2026-09-08 |
| 823821 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:22 | baseball_mlb:mlb:sportsdataio:team:18 | NULL / absent | R / 2026-09-08 |
| 823901 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:1 | baseball_mlb:mlb:sportsdataio:team:2 | NULL / absent | R / 2026-09-08 |
| 824063 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:5 | baseball_mlb:mlb:sportsdataio:team:14 | NULL / absent | R / 2026-09-08 |
| 824228 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:17 | baseball_mlb:mlb:sportsdataio:team:20 | NULL / absent | R / 2026-09-08 |
| 824551 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:16 | baseball_mlb:mlb:sportsdataio:team:4 | NULL / absent | R / 2026-09-08 |
| 824714 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:25 | baseball_mlb:mlb:sportsdataio:team:21 | NULL / absent | R / 2026-09-08 |
| 824792 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:19 | baseball_mlb:mlb:sportsdataio:team:10 | NULL / absent | R / 2026-09-08 |
| 824875 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:26 | baseball_mlb:mlb:sportsdataio:team:11 | NULL / absent | R / 2026-09-08 |
| 824957 | NULL / NULL | baseball_mlb:mlb:sportsdataio:team:24 | baseball_mlb:mlb:sportsdataio:team:3 | NULL / absent | R / 2026-09-08 |

All 15 safe rows require no starter assignment for canonical enrichment. Their current-only observation provenance does not certify historical pregame availability. The existing official_status, top-level starter/state bindings, nested starter_evidence and all historical records remain unchanged by this packet.

## Why the safe subset is narrower

R2B's broad preview mixed stable null enrichments with transient status/starter observations. Under a future packet with no fresh provider authority, promoting an old observation into an unqualified current starter or pregame state is unsafe. The dated observations remain available inside provenance; they are not discarded.

| Exclusion | Count | Reason |
|---|---:|---|
| Detailed status transitions | 7 | No timeless authority to overwrite current status with an earlier observation |
| Abstract pregame-state promotions | 15 | Old Preview observation must not become unqualified current/historical state |
| Probable-starter promotions | 28 | Known only as dated observations; not timeless current or historical assignments |
| Unresolved starters, never proposed | 2 | No supported pitcher IDs |
| **Total excluded candidates** | **52** | 50 of 140 proposals, plus two never-proposed unknowns |

Final cap: **15 rows / 90 logical field assignments**, equivalent to **75 physical column assignments** after metadata coalescing. These comprise 60 stable canonical gap enrichments, 15 provenance records and 15 write timestamps. The timestamp values are explicitly deferred expressions evaluated at actual future write time, not fabricated fixed dates. This packet does not repair all original gaps or enable the 15 games for live use.

## Provenance and immutability

Storage: public.pick2_mlb_games.metadata.r2t_r2b_evidence. Each exact proposed record contains provider, observedAt, sourcePayloadDigest, repairVersion, repairReason, canonicalEvidence, originalSourcePayloadDigest, observationOnly=true, notCurrentStateAuthority=true, and historicalPregameProven=false. Original source_payload_digest, created_at and original starter_evidence are preserved. The new write timestamp is separate from observation time. No earlier snapshot, prediction or Official Pick is rewritten.

Repair version: `MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION_V1`.

| Final safe-packet classification | Assignments |
|---|---:|
| SAFE_NULL_ENRICHMENT | 45 |
| SAFE_CANONICAL_ALIAS_ENRICHMENT | 30 |
| SAFE_CURRENT_STATUS_ENRICHMENT | 15 |
| UNSAFE_HISTORICAL_REWRITE | **0** |
| CONFLICT | **0** |

The 15 SAFE_CURRENT_STATUS_ENRICHMENT assignments are updated_at bookkeeping only; they do not alter baseball status. The 50 excluded original promotions are classified UNSAFE_HISTORICAL_REWRITE under unqualified historical/current-state reuse. They are outside the future authorization packet, and are not contradictory provider facts. No historical rewrite occurred. Historically pregame-proven recovered fields remain zero.

## Idempotency and future authorization

The pure classifier requires exact row identity, full expected old-row digest/values and original source digest. An exact already-applied row must also match the expected version, complete applied values and write-time constraints. Any conflicting or partial state is BLOCK_CONFLICT. First-pass simulation: **15 updates / 90 assignments**. Second pass: **0 updates / 0 assignments**, with no timestamp churn. These are in-memory classifications, not production DML.

Future execution requires separate explicit authorization and fresh locked reads of all 15 rows in one bounded transaction. A preview hash comparison outside a lock is insufficient. Abort the whole operation on any conflict; REUSE_NO_OP rows consume no update cap. Only game 823092 was freshly reread in this phase; other rows retain the certified frozen baseline and must be revalidated before any mutation. There is no executable production SQL or database writer in the new review module.

Authorized-now DML: zero. Future packet: only public.pick2_mlb_games and the exact listed 15 row identities/90 assignments. No DELETE, unrestricted UPDATE, DDL, provider acquisition, model change, live refresh, prediction write, feature write, Official Pick change, automation, cron or settlement.

## Gate 4 pass criteria

For the selected real case 824552, native identity/date/type/state and its own starters must resolve from real pregame evidence at the archived as-of, with exact game/entity scope and source digests. That native binding check **passes** using unchanged R1 code. Missing starters for 823092 do not block this separate case. The canonical repair packet is not a prerequisite for the already-bound case.

A broader all-current-game claim remains separate: each actually selected game needs its own valid native binding and pregame starter provenance. This review neither changes an all-game test's scope nor claims all 15 are ready. The earlier certificate's global current-row stop is preserved as historical evidence, with its unrelated-case dependency clarified here. **R2T-R2 Gate 5 was not run.** A later instruction must explicitly continue the selected injected persistence work. Actual live execution remains disabled regardless of selected-case binding.

## Validation and commit boundary

- Dedicated validator: **27 checks PASS**, including source completeness, expected-value guards, no-op replay, conflict/timestamp rejection, actual selected-case native binding and actual LIVE_EXECUTE containment.
- Build: `npm.cmd run build`, exit 0, 400 static pages; TypeScript passes.
- ESLint: two new scripts, zero warnings.
- Final canonical replay, source-hash, whitespace and scoped secret checks: **PASS**, recorded in canonical validation.
- Provider calls 0; production DML 0; production DDL 0. Five SELECT-only statements are recorded verbatim in internalEvidence. No materialized view refresh occurred.
- Champion, preprocessing, 76-feature and runtime/parity source files remain unchanged. All 19 inherited generated artifacts retain their original byte hashes. .tmp/ and .worktrees/ are untouched.
- Exactly one bounded local commit, no push, containing these six files:

- `scripts/mlb-data-02r-r2t-r2c-repair-review.mjs`
- `scripts/mlb-data-02r-r2t-r2c-repair-review-validate.mjs`
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION.json`
- `docs/CERTIFICATION/MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION_AUDIT.md`
- `docs/PROJECT_STATUS.md`
- `docs/MASTER_ROADMAP.md`

Recommended next instruction: review and separately authorize the exact 15-row/90-field canonical-only packet with no providers, DDL or live refresh; alternatively separately instruct R2T-R2 Gate 5 for the existing selected case 824552. Unknown starters for 823092 remain a per-target blocker, not a prerequisite for that independent case. Do not use dated current evidence as historical pregame proof.
