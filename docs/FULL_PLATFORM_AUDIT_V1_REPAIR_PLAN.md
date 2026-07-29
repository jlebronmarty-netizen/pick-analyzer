# Full Platform Audit V1 Repair Plan

## P0

No P0 data-corruption, unsafe official recommendation, cross-event settlement, or secret exposure was proven by this read-only audit. Do not start P0 repairs without row-level evidence.

## P1

1. Performance API bounded-response repair: COMPLETE in Performance API Query Optimization V1. `/api/performance` now defaults to the canonical product summary contract, keeps full AI diagnostics explicit, preserves product-visible semantic fingerprints, and reduces local default response latency/payload without business-rule changes.
2. Vercel build OOM continuation: COMPLETE locally in Vercel Build Memory Recovery V1. Server bundle diagnostics proved duplicated Supabase server dependency bundling and webpack single-process pressure. `@supabase/supabase-js` is now server-externalized and webpack build worker is enabled, reducing repeat clean-build peak memory from the prior Phase B final 2847.6 MB to 2414.0 MB without product or prediction behavior changes. Automatic Vercel build completion remains to be observed after push; no manual deployment was performed.
3. Settlement/performance count contract: COMPLETE in Historical Settled Status Reconciliation V1. A shared canonical settlement-state classifier now explains stored terminal, deterministic terminal, Performance, learning and scheduler counts with explicit lifecycle exclusions and legacy compatibility. The six stored/deterministic conflicts were repaired in Six Historical Settlement Conflict Resolution V1 as an exact allowlist-only data correction, not a broad rewrite.

## P2

1. Extract shared canonical settlement-readiness helper used by scheduler, operating-day settlement, and reconciliation diagnostics.
2. Consolidate learning terminology around derived learning evidence unless a dedicated label table is formally added.
3. Classify duplicate/legacy routes and pages before removal.
4. Navigation/discoverability pass for active pages and admin diagnostics.

## P3

1. Add ownership metadata for scripts and services: ACTIVE, PREVIEW, SHADOW, EXPERIMENTAL, DEPRECATED.
2. Clean documentation drift around historical phase docs after current product state is certified.
3. Retire obsolete validators only after replacement validator coverage is proven.

## Guardrails

- No formula changes in repair phases unless explicitly approved.
- No model-weight mutation while repairing evidence/reporting contracts.
- No deletion based only on static unused-service detection.
- No production SQL or data rewrite without a focused migration/runbook gate.
