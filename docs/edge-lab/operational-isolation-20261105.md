# Edge Lab operational isolation and read-only diagnostics — 2026-11-05

Scope: existing Pick application; no NHL changes or MLB reactivation. Production baseline47a73a106494d3341524deea0f0aaa2c6dac0275 already contains TT pending-result recoveryV3 and NCAAF PPG activation. Do not duplicate those changes or describe them as newly authored here.

The shared authenticated cron starts its existing TT/MLB worker and NCAAF worker independently with Promise.allSettled. Each retains its own database locks and limits. A rejected worker cannot prevent the other from starting. No fire-and-forget jobs, timeout races, extra schedules or bypass credentials. Uncaught errors are scoped and redacted and cause HTTP500; normal coverage limitations remain PARTIAL.

Read-only diagnostics calculate UTC-day/month TT limits and distinguish local counters from unknown provider balance. Future versus started-but-unsettled events are separate; several markets on one event count once. Abstentions never enter pending results or accuracy. Elapsed time is not proof of a final and cannot create a loss. Display reset in Puerto Rico without assuming local midnight. Diagnostics neither change nor reserve quota, and never promise execution. Existing atomic budget RPC remains enforcement.

The protected multi API adds diagnostics to status/summary. Source-health and authentication checks are unchanged. An expandable section in Edge Lab performs one read on mount and manual refresh, never launches collectors. This adds one database read, not paid-provider calls. No existing weights, forecasts, outcomes, schemas, secrets, quotas, vercel.json, NHL or MLB code changed.

Verification:38 pure unit tests cover budget boundaries, invalid metadata, independent failures and event/contract accounting. Existing suite must also pass on exact candidate. UI tests are synthetic unless a protected production browser was used. Build, private reads and immutable-ledger comparison are separate from real scheduler completion.

Baseline live read2026-11-05T15:39:54Z:519 multi forecasts;zero non-pregame emissions/abstention settlements. TT actual results cover one event only(winner and odd sets W;numeric total error10.3689393939394). NCAAF PPG192records for64events:62winner forecasts,124numeric projections,6abstentions. Observed records are not predictive validation. Ridge unavailable without a valid frozen weekly profile. TT local daily9/9;no paid-provider call required for this change. Old Hub retirement remains a separate dependency review.
