# R8 partial dependency recovery

Current verdict: `R8_PARTIAL_DEPENDENCY_PRODUCTION_RECOVERY_CERTIFIED_DOWNSTREAM_PRIVILEGE_BLOCKED`.

The user-authorized exact ten-file candidate `20f8c944b009cd774cc4e228061ce09eb3c9ed0c` is deployed as Edge **v9**. Downloaded production code matches all ten manifest hashes with no extra files. Missing, wrong and public credentials return 401; the server-only read operation returns 200. No production DDL or credential/privilege change occurred. Vercel executed the compatible published package `b654a3d74cff473ab6917f15078a95925b3e2ab2`. Champion V1, the 76-feature contract, preprocessing and Policy V1 remain unchanged.

The reviewed `resumeDependency` advanced the original failed run from revision159 to160 and acquired a new fence. The original identity, package, freeze, scopes, eleven provider reservations, DML receipts and failure history were preserved. Independent readback confirms that all **3,795 original raw rows are unchanged**, including their source payloads and timestamps. Only two missing dependency items were acquired: game823088 added269 rows and game823172 added282 rows. The canonical raw total is **4,346**; every source digest verifies. The 3,795 existing rows were reused as evidence, without rewriting them. The cumulative raw INSERT receipt is4,346, cap15,000, with receipt reuse counter0; these are distinct accounting concepts.

The original run completed at revision209 at `2026-09-11T15:42:34.847Z`, honestly returning `NO_VALID_PREGAME_SLATE`. Thirteen targets were blocked by `NEW_RAW_EVIDENCE_AFTER_RUN_FREEZE`; games823817 and825036 lacked required starters. No Odds were acquired for that freeze. A local host request lost its response, but durable independent readback proved production completion; no duplicate manual execution was issued. The subsequent INCREMENTAL run completed at revision3 with `NO_SCOPED_GAMES`.

The **natural 15:45 UTC scheduled PREGAME** invocation then exercised the recovered cache without Statcast calls. Run `automation-9756864d6172709d333ee55f5522d6d400b8983f0e2038a064bb05463b895c95`, frozen at `2026-09-11T15:45:11.920Z`, processed13 independently eligible games and blocked the same two missing-starter targets. It persisted130 feature snapshots,104 daily-feature rows,13 Champion predictions and13 market mappings. It acquired one Odds response and preserved it in private durable evidence. At `2026-09-11T15:55:54.611Z`, it failed at `MARKET_PERSISTENCE`, revision50, with durable **`RUNTIME_SQLSTATE_42501_HTTP_409`**. Production Vercel logs record the scheduled503. Market observations, values and Official Picks remain0; zero picks here reflects an unexecuted policy stage, not a successful no-pick policy decision.

The new cause is reproducible with the actual `performFencedWrite` implementation and production grants. The runtime uses `SET LOCAL ROLE service_role`. Market observations, value evaluations and Official Picks permit SELECT and INSERT but deliberately withhold UPDATE. The writer unconditionally performs `SELECT ... FOR UPDATE` while reading existing identities. PostgreSQL requires UPDATE privilege for this statement, even when no row matches. Disposable PostgreSQL using those grants throws42501 on that exact query before any INSERT. Market mappings permit UPDATE and therefore passed the same read. Earlier disposable persistence tests granted UPDATE to all tables and missed this production permission mismatch. Structural schema preflight still passes; its success does not certify this required-privilege relationship. This finding does not reconstruct the unknown internal reason for the older v7 HTTP409.

The stored new Odds evidence passed reference/digest readback. Reconstructing its286-row prospective market plan required no provider calls or production writes; plan digest is `4cc909824a425888cc796b404ae2f1ee628431e1db7753311d95ebeef80b8b23`. It remains a plan, not persisted observations. No broad UPDATE grant, ad hoc failed-run mutation, dependency-resume misuse or fresh Odds reconstruction was attempted.

Accounting for this deployment authorization, including the observed scheduled execution:

| Item | Result |
|---|---|
| Provider calls | MLB Official3, Statcast2, Odds1; all other providers0 |
| Mission Odds | 5/20; historical legacy acquisitions separately retained |
| New business INSERTs | 811 = raw551 + snapshots130 + daily features104 + predictions13 + mappings13 |
| Business UPDATE / DELETE | 0 / 0 |
| Runtime coordination INSERT / UPDATE | 2 / 133 |
| Runtime update derivation | Original run50 + incremental3 + scheduled50 + lease29 + mission1 |
| Production DDL | 0 |
| Committed receipt conflicts / started-game leakage | 0 / 0 |
| New unresolved failed runs / active lease | 1 / none |

Runtime accounting is independently derived from revision deltas: original159->209, new incremental0->3, new scheduled0->50, lease236->265, mission2->3. It excludes the previously committed3,795 business inserts. All committed write receipts pass readback and caps. Production count queries confirm130 snapshots,26 team,26 pitcher,26 bullpen,0 batter,13 matchup,13 first-inning,13 predictions,13 mappings and0 observations/values/picks. Prediction duplicate count and prediction start-time leakage are0. No market/value/pick rows were written that could introduce duplicates at those stages.

Local R8 Gates1-8 remain supported by the unchanged implementation's recorded tests/build. Production recovery Gate9 passes. Gate10 recovered the original failed-run guard, but the subsequent scheduled invocation introduced a distinct unresolved market failure. Gate11 is blocked. Automation remains enabled and fail-closed behind that new guard; it is not currently healthy end to end. A narrow immutable-read repair under the existing transaction lease/unique constraints, exact-ACL regression tests, and certified guarded market resume from stored paid Odds are the next requirements. R8 dependency-only resume cannot apply to this downstream failure. Temporal eligibility must be rechecked before any future market/value/pick write.

`MARKET_PERSISTENCE_PRODUCTION_CERTIFIED=NO`; `UI_REDESIGN_READY=NO`. UI work is untouched. Private payloads, storage paths and credentials are excluded from this public audit. The nineteen inherited generated-artifact modifications remain excluded. The following record is historical pre-deployment evidence, retained without treating the original failure as a historical success.

---

Local Gates 1–8 pass. Production recovery and subsequent scheduled market/value certification remain pending. This certificate does not turn the failed historical execution into a success.

Starting package: `8e96cfea93a2293047e8a22d019bda3a65b71db2`.
Failed run: `automation-0271e170de9e0280a03f773c6cd7a7fc18ac9226c4643bcc4bc0fcef018a1f21`.
Original frozen package: `cc1a359b3c7492cb5f62efc39eb5f5b05e85c6d4`.
Original freeze: `2026-09-11T12:15:10.378Z`; failure revision: 159.

Independent production readback found exactly 3,795 distinct deterministic pitch identities within the frozen 15-game dependency scope. Every source payload digest reproduces using the existing 01A certificate's 119-column CSV order. JSONB key order alone does not reproduce the original source digest. All 3,795 rows fall within the original write interval and match the committed raw receipt. The private inventory and raw payloads remain outside the repository; the JSON certificate contains only counts, game IDs, aggregate digests and structural results.

Thirteen dependency games are `SATISFIED_REUSE`; games 823088 and 823172 are `MISSING_FETCH_REQUIRED`. Exact per-game counts are in the canonical JSON certificate. Coverage follows the existing certified canonical stored-game contract. The fetch rejection occurred before a successful response for the failing request. Its request date and underlying network cause were not durably retained and are not reconstructed here. Earlier successful streams yielded their bounded batches before the next fetch; their committed rows remain preserved.

The ten consumed Statcast requests remain consumed. The eleven deterministic reservations match one MLB Official request and ten Statcast requests, with no duplicate reservation. The failed run used no Odds request. Mission Odds remains 4/20; historical legacy acquisitions remain separately retained. The existing per-run Statcast cap leaves 90 requests, while the current two missing games span at most two dates. No provider call was made during local certification or production readback.

`resumeDependency` is a separate service-only reviewed operation. It requires an inactive lease, one exact pending FAILED dependency run, a network/timeout classification, exact state and raw readback digests, raw-only committed PASS receipts, no conflicts, no downstream rows, valid source digests, the original package, and reconciled reservations. It atomically appends recovery lineage, advances revision and acquires a new fence. It never resets a counter or replaces the original run, freeze or scope. Three reviewed recoveries is the bounded lineage limit; further failures require review.

The original package SHA remains part of the run identity. A separately recorded compatible repaired executor SHA permits that exact Vercel deployment to continue the run. Ordinary acquisition still rejects other packages, and caller checkpoints cannot edit recovery metadata. Future failures retain the prior failure in recovery lineage. All existing provider reservations, byte/DML caps, leases, write classifiers and readback contracts continue to apply.

The temporal repair preserves the frozen scope while excluding started games individually. Late-acquired historical pitches remain valid stored evidence, but cannot support predictions under the earlier run freeze. The disposable canonical adapter explicitly verifies both started-game exclusion and `NEW_RAW_EVIDENCE_AFTER_RUN_FREEZE` blocking without refetching. Production recovery must accept these blocks honestly; it must not acquire Odds merely to complete an expired freeze.

Validation passed:

- 10 R8 checks: exact 3,795-row readback/reuse, adverse guards, immutable lineage and shared-engine network recovery.
- Actual shared Statcast replay: 311 pitches committed before injected network failure; a new authority acquired only the missing game, reaching 569 pitches with cumulative request count 3. Another instance reused everything without a fourth request.
- 74 disposable physical-schema, real Champion/76-vector, snapshot, prediction, market/value/policy, cross-instance and temporal checks.
- 21 runtime-state checks, 5 R7/midnight checks and 5 R3 readiness checks.
- Exact 88-row market replay: 88 inserts, then 88 reuses and zero inserts; race/transaction failure tests remain fail-closed.
- Current Edge entrypoint hash equals the bearer-auth-tested handler; missing, wrong and public credentials reject before database access.
- `npm.cmd run build`: exit 0.
- Production read-only schema preflight: PASS, 406 columns, 116 preserved constraints, 84 indexes, zero orphan references or invalid indexes.

The ten-file candidate is bound by `MLB_PHASE2_R8_EDGE_MANIFEST.json`. No migration, UI, Champion, feature definition, preprocessing, Policy V1, provider substitution or scheduler configuration changed. The 19 inherited generated-artifact modifications are excluded from the R8 package.

Next: deploy and independently verify the exact candidate, repeat fresh state/raw/schema/auth preconditions, use the guarded resume, preserve evidence/accounting, and read back completion. Then observe a genuinely eligible scheduled run for production market/value persistence. `MARKET_PERSISTENCE_PRODUCTION_CERTIFIED=NO`; `UI_REDESIGN_READY=NO` until those production gates pass.

Deployment stop: automatic approval review rejected production deployment of exact candidate `20f8c944b009cd774cc4e228061ce09eb3c9ed0c` because explicit authorization for this R8 privileged candidate is required. No alternate deployment or production resume was attempted. Edge remains v8. Local Gates 1-8 remain certified; Gates 9-11 remain pending.
