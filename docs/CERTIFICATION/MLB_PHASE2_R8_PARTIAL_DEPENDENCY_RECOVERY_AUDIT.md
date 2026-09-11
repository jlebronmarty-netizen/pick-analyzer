# R8 partial dependency recovery

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
