# NCAAB daily FREE activation


## 2026-11-03 — NCAAB daily FREE shadow

Connected `/ncaab`, `/api/ncaab/overview`, the sport accuracy card and combined daily selections to an append-only Supabase history. Original 73 preseason forecasts are preserved byte-equivalently at JSON-field level with their original creation timestamps; the source snapshot/profile provenance remains pinned to c451d9fc9. Frozen profile coefficients are projected without fitting or retuning; all 73 original scores, winners and probabilities match the TypeScript hosting port within 1e-11. V1.1 remains independently inactive and needs its original warmup/integration; no automatic model switch.

Cron `/api/cron/ncaab-daily`: UTC 04:00, 10:00, 16:00, 22:00 (Puerto Rico midnight/06:00/noon/18:00), current/yesterday/tomorrow plus bounded unresolved reconciliation (maximum 10 FREE ESPN calls per execution). Distributed lease, 15-minute duplicate guard, persisted call counts/raw evidence, fail-closed auth, no parameters, no writes on overview/page reads. A 401/403 blocks subsequent acquisitions pending manual review; there is no automatic retry/bypass. Cron uses the existing production CRON_SECRET and Supabase server configuration; no credentials added or exposed.

Finals are append-only observations. Exact event/team/home-away/tip agreement is required; changed schedules/identities or conflicting corrected finals are excluded from W/L and shown as REVIEW_REQUIRED. Accuracy = WIN/(WIN+LOSS), null at denominator zero; no odds/edge/ROI or Official recommendations. Original opening reconciliation: 56 WIN / 9 LOSS / 8 REVIEW, 86.15% on 65 eligible settlements. This is descriptive forward accuracy, not validated profitability.

Manual activation acquired exactly two FREE scoreboards using the same hosted normalization/prediction functions. No post-start forecast is created. Immutable originals remain included. There is no Windows scheduler or second worker. Future daily scheduling runs in Vercel. Other-sport crons, Official Picks and prior research remain unchanged.

DB migration 20261103231506_ncaab_daily_shadow_v1 is additive: runs, sources, predictions, outcomes and lease. RLS is enabled, anon/authenticated permissions revoked; only server service_role reads/writes. Evidence tables reject updates/deletes. The RLS-with-no-client-policies advisory is intentional server-only access, not public exposure.

Verification: 78 dashboard tests passed, including 73-case frozen parity, pregame/as-of/venue/history/phase gates, duplicate-final denominator and correction review. Production build, release checks and hosted runtime verification are recorded in research/ncaab-daily-20261103. Rollback: remove the new cron and restore only NCAAB read wiring to the preserved checkpoint reader; do not drop tables, delete forecasts or revert unrelated work.

The activation SQL is evidence, not a recurring launcher. No historical forecasts are regenerated. The original Windows SQLite is not modified. DB is the separate hosted continuity store.
