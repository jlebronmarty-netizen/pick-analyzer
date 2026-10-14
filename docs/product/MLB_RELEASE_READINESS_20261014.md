# Pick Analyzer — release preparation, October 14

Status: READY_FOR_USER_RELEASE_REVIEW_NOT_DEPLOYED. Application commit `92aa7e476024a5c2dfa6f11b145b2a9a17a545e4` passed configured Vercel preview build, ten GitHub checks and desktop/API review. Local final build exited 0; all 107 operational source pins and both versioned certificates are present in the function trace. No production deployment, merge, migration, provider acquisition, model promotion, or scheduler edit.

## Changes

- Restored exact-count, complete-page, stable-count, duplicate-ID and per-game cap checks to both batched raw readers. Read optimization remains; partial data cannot silently become a complete feature sample.
- Replaced runtime references with versioned, reviewed readiness manifests. The original certificates remain byte-for-byte unchanged and are referenced by SHA256. All original operational source pins remain covered; the new manifest pins 107 files. Next.js traces the same versioned certificates used by the runtime and schema preflight.
- Added a provider-free PR/main CI job that fails on source/evidence drift, broken manifest references, pagination failures or dashboard regressions. No live secrets are available to this job.
- Made the current champion's existing regular-season-only contract explicit in the current board. Known postseason games are blocked with an understandable explanation; no model, threshold, outcome or recommendation was promoted.
- Updated an obsolete regression assertion to verify that recorded official status remains immutable while a changed starter blocks current actionability. It does not rewrite picks or remove the current blocker.

## Evidence

`mlb-release-readiness-20261014/` contains the current independent receipts and preserved initial attempts. The original private raw-cache SQL integration was not rerun or reconstructed from later observations. Historical certification evidence remains historical; no new live/pregame availability certification is claimed.

- 20 pagination boundary tests: complete multi-game corpus, exactly 1000, truncation, null/negative/changing counts, duplicates, scope escape, provider/read failure and original per-game cap.
- 26 multisport/dashboard tests, including regular-season versus postseason scope.
- Three stored prediction replays: all 76 vector values match their immutable digests; both model probabilities match exactly, absolute error zero. This is stored-input inference parity, not a new raw reconstruction or live prediction.
- Exact AST function-text comparison against the last approved Git revision verifies unchanged `scanRawRows`, `updateStatsFromGame` and `addDailyRows` feature math.
- Current disposable PostgreSQL and host/mock tests cover schema, RLS, auth, fencing, concurrency, recovery, immutable evidence, provider reservation, cadence, budget exhaustion, settlement, idempotency and truthful empty states.
- Supabase deployed Edge runtime version 15 is ACTIVE. All 13 deployed source files exactly match repository source; it enables the separate operational budget (48/day, one per run). The historical mission count of 20 is preserved. Current provider credits are not inferred from reservation counts.

## Production procedure prepared, not executed

1. Review the exact PR commit, source/evidence guards, preview build and pages `/`, `/today`, `/performance`, `/qualified-plays`, `/mlb-value-board` and `/data-health`.
2. Obtain release approval before merge or production promotion. Production currently serves main `f7e5f5694660bc97e1d8946271bc277c995d0947`; record the deployment selected for rollback. This release restores the preflight path used by existing operational crons, so those crons can resume provider work after release, within the existing durable budget/cadence guards. No additional scheduler is needed.
3. Use a production-target deployment with production environment settings, verify its exact commit and packaged manifest/source hashes, then promote the tested production artifact. Do not promote an untested preview as if its environment were identical.
4. Observe actual cron delivery/authentication, canonical schema preflight, released lease, mode result and provider accounting. No manual parallel tick, no budget reset and no paid historical calls. A postseason or empty valid slate should produce no official picks. A future eligible regular-season run must provide fresh, immutable prediction/market/decision readback before claiming operational recovery.
5. Recheck original official/settlement record fingerprints, the dashboard counters and any release errors. Roll back the application artifact if package/preflight/regression checks fail, preserving every recorded row and consumed reservation. Never erase a receipt to retry.

Mobile rollout and production remain paused for the user's review. NHL/NBA/NCAAB and the separate Sports Edge Hub project were not modified.

## Final verification

- [Verification receipt](MLB_RELEASE_VERIFICATION_20261014.json), [build/package receipt](MLB_RELEASE_BUILD_TRACE_20261014.json), [final R3 guard replay](MLB_RELEASE_R3_GUARDS_FINAL_20261014.json).
- Browser pages `/`, `/today`, `/performance`, `/qualified-plays`, `/mlb-value-board` and `/data-health` reviewed. Read-only API operations/performance/version returned 200 and matched the displayed counts and exact application SHA. Outcome filters showed 19 wins, 23 losses and zero pending. The board remained empty for the known postseason game, with an explicit scope explanation on Today.
- Production read-only health returned Edge 15, active operational budget, 0/48 consumed and NO_RECENT_COMPLETION_OBSERVED. The existing production source-drift blocker was not removed in production. Preview Edge health repeatedly remained RUNTIME_UNAVAILABLE; its precise environment/transport cause is undetermined. Production-target candidate health must be verified at release; do not hide the preview failure or copy credentials.
- Official row count 151 and fingerprint `2f421c6a03cc71716a22868fa54508c7` match before/after; champion row count stays 452; provider reservations today stay zero.
- One full-page browser screenshot timed out; a viewport screenshot succeeded. Direct browser navigation to the JSON API was blocked by the browser client; authenticated Vercel read-only fetch verified those API responses instead. Observed console errors came from browser-extension metadata messaging.
- Mobile device validation was not performed. No claim of fresh production inference or full original private raw-cache SQL replay. The release procedure remains prepared for approval and production-target readback.
