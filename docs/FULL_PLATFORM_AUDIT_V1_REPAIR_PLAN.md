# Full Platform Audit V1 Repair Plan

## P0

No P0 data-corruption, unsafe official recommendation, cross-event settlement, or secret exposure was proven by this read-only audit. Do not start P0 repairs without row-level evidence.

## P1

1. Performance API bounded-response repair: profile /api/performance, add strict sport/date bounds or cached summary, preserve output contract.
2. Vercel build OOM continuation: continue build-memory optimization using server bundle import graph; do not change prediction behavior.
3. Settlement/performance count contract: standardize production settled metrics on deterministic result fields and document legacy status rows.

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
