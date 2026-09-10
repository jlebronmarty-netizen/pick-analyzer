# Phase 2 current-slate dependency recovery

Status: LOCAL_REPAIR_CERTIFIED_EDGE_DEPLOYMENT_APPROVAL_BLOCKED. Operational recovery is not certified.

## Authorized deployment and fresh reproduction

The subsequent exact authorization was executed: Edge version 7 is ACTIVE, all ten downloaded files match commit 2c287299 and its manifest, and actual missing/wrong/public bearer checks return 401 while server-only inspect returns 200. The original failed run is TERMINAL_PARTIAL_PRESERVED at revision 9 with its failure, evidence and accounting unchanged. No unresolved guard remained immediately after disposition.

A fresh current-slate execution from fcf140e reproduced R6_CLIENT:WRITE_REQUEST_SIZE in the actual Vercel response after one Official and one Statcast acquisition, with zero business DML and zero Odds. This is observed current evidence, not a reconstruction of the original historical exception. The durable failure remained generic because that client code was not in the approved Edge classification vocabulary.

An indexed read of 100 existing canonical raw rows reproduced a 512,964-byte write request, exceeding the existing 500,000-byte client limit. The narrow Vercel repair plans batches by both UTF-8 byte size (400,000 maximum) and row count (100 maximum), validates every single row before the first write, and preserves row order, identity, values and cumulative caps. The same production-shaped payload now splits into two requests; a repeat reuses every row. Oversized single rows fail before mutation with RangeError/WRITE_PAYLOAD_SHAPE, already accepted by the exact approved Edge candidate. No Edge files or endpoint limits are changed by this additional repair.

The executable repair is published in `2c287299c007fbf4620b4a63f1d460c97a7634ac`. Its exact ten-file Edge manifest is `MLB_PHASE2_DEPENDENCY_EDGE_MANIFEST.json`. Server-only bearer authentication is unchanged. No production DDL is included.

## Reproducible findings

The five-target dependency inventory replays against privately captured production-shaped reads with providers disabled. The union has six missing historical games across two dates. The compact failed checkpoint is 1,296 bytes; size overflow was not reproduced. No schema mismatch was reproduced by the offline dependency inventory.

Known Statcast HTTP/timeout exceptions lost their specific classification. HTTP 200 non-CSV responses could silently produce no rows. The narrow repair retains bounded sanitized transport/read classifications and rejects invalid CSV headers and row shapes before transformation. Injected failures establish these current defects, not the cause of the historical request. The exact historical first exception remains unknown and was not reconstructed.

The released lease is not the recovery blocker. The undispositioned FAILED run causes the next acquisition to return BLOCKED_RUN_REQUIRES_REVIEW. A guarded disposition was implemented and tested: exact reviewed state, no active lease, failed dependency stage, schedule reference, matching native scope, zero Odds, zero business receipts, and zero prediction readback. It preserves FAILED status, evidence, original failure, and accounting.

## Validation

- Five-game replay and injected dependency checks: 6 PASS.
- Full real-feature/Champion SQL regression: 72 PASS.
- Operational behavior groups: 17 PASS.
- Durable state checks: 21 PASS.
- R7 runtime checks: 5 PASS.
- Unchanged bearer handler: missing/wrong/public credentials rejected; server-only inspect accepted with disposable adapters.
- Targeted lint and production build: PASS.

## Production readback and hard stop

Read-only checks on 2026-09-10 at approximately 15:16 UTC show the failed run still at revision 8, DEPENDENCY_SCOPE, with no disposition and no active lease. Current target feature snapshots, predictions, market observations, value evaluations, and picks remain zero for all five games. Edge remains version 6.

Automatic approval review rejected deployment of the new Edge candidate because its contents differ from the previously authorized exact be19887 candidate and the general repair authorization was not judged to clearly authorize this exact deployment. No alternative deployment method or direct-SQL disposition was attempted. Deployment of the manifest-matched candidate from 2c287299 requires explicit approval before production disposition and scheduled recovery can continue.

Phase provider calls: 0. Phase production DML: 0. Phase production DDL: 0. Failed-run accounting remains MLB Official 1, Statcast 1, Odds 0. Mission Odds remains 3/20, with the two historical legacy acquisitions separately retained. The failed-run request has not been discounted.

The existing 15-minute Cron configuration is unchanged. A fresh run remains fail-closed pending disposition; no successful schedule-to-prediction progression is claimed. After approved deployment, reverify code/auth/schema, review and disposition the exact failed state, then observe a genuinely pregame-safe fresh run. Respect newly acquired evidence as-of boundaries and individually block any games that have started or lack required provenance. No UI implementation belongs to this phase.
