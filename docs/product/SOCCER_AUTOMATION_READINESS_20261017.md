# Soccer visual closeout and automation preflight

Desktop production review completed: model and capture date, null accuracy/ROI/CLV, paired decimal quotes/no-vig/raw diagnostic edge, seven blocked observations and no current edge are visible. Filters return 0 valid Shadow, 0 STRONG, 7 INSUFFICIENT_HISTORY; Today shows two Soccer games on October 17 Puerto Rico and zero picks/official selections. No horizontal overflow at the observed 1348px desktop viewport. Mobile-device validation is not claimed. Screenshot and receipt are preserved beside this report. Earlier stalled-browser evidence remains historical and is not erased.

## Verified automation target

Sports Edge Hub main at audit: `a9f5389c356bc166ab6a7a09ebfa80cbc9116a78` (includes concurrent table-tennis work). Soccer still has only the stored read bridge/data and no collection cron. Research PR #23 remains open at `63f7a4dcb53770217c5549399f8e9bf4c1dbc437`; its model/adapters are not deployed by the display release.

The correct source database is Supabase project `pltvdwuponathattyzhu`, identified by the public, plain `NEXT_PUBLIC_SUPABASE_URL` configuration in the Sports Edge Hub Vercel project. Metadata confirms production THERUNDOWN_API_KEY, SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET are configured; sensitive values were not read or copied.

The Supabase connector lists Pick Analyzer (`ynuocvexviorgdjrfthw`) and an unrelated project, but not the source project. A read-only source catalog query was explicitly rejected: `You do not have permission to perform this action`. Pick Analyzer has no Soccer or table-tennis tables; it must not be used as a substitute backend. No migration is drafted as executable DDL against an uninspected source schema, and no service credential is retrieved to bypass the connector denial.

## Concrete continuation sequence once source access is connected

1. Inspect the source project catalog, migrations, roles and existing Soccer objects. Freeze a source schema/row-count baseline and isolate all Soccer tables/RPCs from NHL/NBA/table-tennis.
2. Reuse the frozen V0 model/adapters from PR #23 without retuning. Store original history/raw responses with captures/digests. Enforce event identity, UTC pregame cutoff, original per-event forecast/entry quote immutability, separate quote versions and history evidence. Do not silently certify the original seven as warmup-valid.
3. Prepare an additive Soccer ledger migration after catalog inspection: raw captures, first-seen forecasts, quote versions, final-result evidence, independent settlement/correction review, atomic run locks/leases and request/data-point accounting. Preserve original snapshots and an exact recovery export. Verify RLS/service-only writes and public safe read projection.
4. Budget FREE requests using actual plan/data-point accounting; no MLB Odds API use. The frozen source policy cites 20,000 data points/day and 200,000/month, not a request count; reconfirm current entitlement and budget response headers before enabling. Failed/unknown-cost calls must reserve budget before transport, preserve receipts, and never retry indefinitely.
5. Run one bounded cycle before scheduling: fetch/cache history, request only upcoming LaLiga main O/U2.5 pairs, freeze source gate evidence, reconcile final results against exact fixture identity, write idempotent settlements and publish a complete validated read snapshot. No current Official Picks/policy writes.
6. Validate arithmetic and timestamp lineage independently, duplicates/idempotency, lock overlap/failure recovery, quota refusal, post-start freeze, completed/void/missing-score cases, backup restoration and Pick contract parity. Then propose/activate a small explicit UTC cadence within measured FREE budget. Keep publication unavailable rather than replacing an incomplete ledger by zeros.

Continuous acquisition, settlement, schema changes, new crons and provider calls remain **not activated**. Next required external action is to connect/authorize this chat's Supabase connector for project `pltvdwuponathattyzhu`; this is an actual tool permission boundary, not a model/sample-size gate. Runtime and frozen-model source files are unchanged by this audit.
