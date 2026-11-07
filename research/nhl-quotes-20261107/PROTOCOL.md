# NHL quote capture improvement — November 7, 2026

Owner scope: improve free NHL quote capture without changing frozen forecasts or using later prices as original entry odds. No paid provider, Official promotion, new predictive model, selection threshold or stake policy.

## Technical changes

- Preserve the existing 12-request / 230-second per-cycle acquisition budget, authenticated production cron, 30-minute slot dedup and lease. Do not add another writer/scheduler or make provider requests from pages/APIs.
- Reuse only a successful official team-directory raw captured within 24 hours, verifying its compressed bytes and SHA256 before decoding. Preserve its original source FK; this is identity metadata, never a stale score/price cache.
- Read DRatings' upcoming slate before allocating calendar requests. Always collect today's official calendar; collect additional prior dates for unresolved observations and the following day only when there is a published upcoming forecast for it. Historical reconciliation remains bounded. No missing score becomes zero or an invented result.
- Rank pregame price targets by missing/expired paired price, oldest previous attempt, then start time and event ID. Persist attempt metadata even when no Circa pair is available. Never repeatedly favor the first games while leaving later games unqueried.
- Parse exactly the existing two-sided Circa moneyline table; do not use mixed Best Line, another book, provider-ID assumptions or price inference. The NHL score payload contains partner prices, but their market/contract semantics are not promoted by this change.
- Append contemporaneous model/price snapshots in `nhl_free_quote_observations_v1`, with original prediction, run, detail price raw, DRatings probability raw, official schedule raw and directory raw FKs. Observe before the official start; validate event/team IDs and unchanged scheduled time. No historical raw-to-price backfill in the production writer.
- Show a previous paired snapshot only if it is at most 45 minutes old, still pregame, and matches current official game identity. Carry the WHOLE historical forecast/price snapshot: never combine yesterday's price with a new probability or replace its timestamp. In-progress/finished games and expired pairs cannot enter current edge rankings.

## Immutable accounting

Original prediction bodies, their optional odds and selection directions are unchanged. Original settlement and ROI continue to use their original prices only. Later prices are explicitly labeled observations and never counted as original priced entries or additional wins. No new ROI/accuracy cohort is introduced. This does not claim that every market is offered or that displayed prices were executable.

The new quote table is append-only, RLS-enabled and inaccessible to anon/authenticated roles. Service role has only SELECT/INSERT. The latest-observation view uses SECURITY INVOKER, is service-role-only, and exposes only completed PASS/PARTIAL runs.

## Preflight

Verified current main `bc94af857dba084e661b9d21ffc6ec107fa685bc` and open PRs. Isolated worktree includes all 62 changed paths since the previous NHL release, verified against GitHub blob SHAs; concurrent Edge Lab and MLB pause changes are preserved. Original worktree's untracked files are not modified.

Initial observed state: 29 original forecasts, 18 outcome observations; forecast-body aggregate MD5 `2a00657824d511d8d705a1b65948f42d`. Existing jobs may append subsequent observations while this work proceeds; preservation is checked on the frozen original IDs. Preflight security advisories were read; existing service-only tables intentionally have RLS without browser policies. Supabase CLI is not installed/cached; use the production migration connector and its recorded migration version for the checked-in filename. Changelog markdown retrieval was unsupported by the search transport; current RLS/view documentation was consulted. No subscription changes.

## Verification required

Unit/integration checks for target rotation, source-cache tampering/expiry, stale/started/identity-conflicting prices, whole-snapshot consistency, independent quote coverage, and unchanged original ROI. Full module build and deployed preview/production checks. Apply additive schema and inspect its security grants/advisories. Verify a natural authenticated scheduled cycle, both current pair coverage and immutable original-ID hashes before/after, no page-triggered acquisitions/writes, and preserved other-sport runtime configuration.

Additional stored-raw diagnostic: both previously unpriced requested games had exact Circa pairs, but DRatings labeled them NY Rangers and NY Islanders. Add only those two explicit full-name aliases, normalize accents/punctuation, and reject ambiguous/reversed row identities. This repairs source identity parsing, not model probabilities, frozen entry prices, betting thresholds or historical ROI. Archived pre-change observations are not backfilled.

Post-migration privilege audit found an inherited TRUNCATE privilege for the service role on the new quote table. A second recorded migration explicitly revokes all default grants before granting only SELECT/INSERT; UPDATE/DELETE/TRUNCATE and browser access were verified false. No data was truncated or modified and other tables were not changed.

Calendar-boundary verification: the relevant-date planner keeps Puerto Rico and Eastern source dates across the ±15-minute prediction/official-start tolerance, and both dates for unresolved observed starts around winter midnight. It remains bounded to five calendar requests and the same total per-run budget. Tests cover ordinary daytime, winter midnight, summer day transitions and prior unresolved games; no inference of scores, dates or prices from outcomes.
