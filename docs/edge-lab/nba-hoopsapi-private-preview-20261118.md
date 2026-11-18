# HoopsAPI NBA durable capture: private Preview (2026-11-18)

## Scope
This branch captures the provider's NBA main lines for ft, h1, h2 and q1–q4. The first manually observed response contained 744 FanDuel quote sides for 12 games; this observation is source evidence, not proof of the complete Puerto Rico menu. Full-game and period overtime/settlement contracts, alternates, probabilities and EV remain unverified.

The raw provider response is retained alongside normalized quotes, receipt time and SHA-256 in immutable research tables. Neither capture nor recovery creates predictions, changes model weights, settles bets or modifies the existing GOAT archive. No automatic schedule or paid plan is enabled.

## Durable request boundary
- Preview-only runtime and the existing Vercel Authentication deployment gate remain required. The route's OIDC-header check is defense in depth, not a substitute for that deployment gate.
- A server-configured stable account scope identifies the provider account across Preview deployments and API-key rotations. Never use a browser-supplied scope or hash the current key to create a fresh budget.
- One transaction locks the account row, rejects reused request IDs, unresolved in-flight requests and a full rolling-24h window, then reserves the request before any external call.
- A second atomic dispatch claim may succeed only once and within 15 seconds. A missing/ambiguous database acknowledgement prevents the provider request.
- All attempted dispatches, timeouts, HTTP failures and abandoned reservations remain charged conservatively. A provider 429 also sets a persisted cooldown.
- Success archives raw and normalized evidence and closes the attempt in one transaction. An uncertain archive keeps the dispatched attempt unresolved, blocking new calls until recovery or the 24h window passes.
- The browser locks an attempt immediately, including transport errors, and persists the lock for this tab session. Recovery GET and CSV/JSON download consume zero provider calls.
- The application budget tracks this integration plus explicitly recorded observations. Unobserved calls outside Pick Analyzer still consume the provider's quota; the displayed remainder is not a claim of provider-account balance.

## Configuration and additive database setup
1. Review and apply nba-hoopsapi-durable-preview-schema.sql through the normal migration process. New tables have RLS and no anonymous/authenticated access; functions use SECURITY INVOKER with service_role-only execution. Raw captures cannot be updated or deleted through the application.
2. Run nba-hoopsapi-durable-preview-rollback-test.sql. It rolls back all fixture data and makes no provider requests.
3. Run nba-hoopsapi-durable-preview-activate.sql to provision the stable account and record the known first manual request. Its receipt was reported at 21:57Z with minute precision, so the quota anchor is conservatively 21:58Z. It is explicitly external_observed, not an invented raw API capture.
4. Set Preview-only HOOPS_API_ACCOUNT_SCOPE=pick-analyzer-hoopsapi-free-primary and HOOPS_API_DURABLE_ENABLED=true. The existing sensitive HOOPS_API_KEY and server-side Supabase administrative credential are reused, never exposed or logged.
5. Deploy and verify authenticated GET status, ledger counts and restored capture. No provider request is required for these checks. The next user-triggered capture will exercise real evidence persistence.

## Verification status
Twelve Node tests pass for normalization, receipt/provenance, duplicate/concurrent request suppression, a ten-attempt rolling budget, expiry, ledger failure, archive failure, acknowledgement recovery, 429, malformed payload, response size and credential echo. Additive migration nba_hoopsapi_durable_preview_v1 was applied and the rollback-only database contract test passed. The known prior manual request is charged as one external observation; the app ledger reports nine remaining reservations, without claiming knowledge of other external usage. Branch-only Preview configuration is ready. Local full build was attempted but the restored workspace has no Next dependency installation; the protected Vercel Preview build is the required build gate.

Source references: https://hoopsapi.com/docs ; https://supabase.com/docs/guides/database/functions ; https://www.postgresql.org/docs/17/explicit-locking.html .

This branch remains a draft Preview. Production/main, all existing models, official history, GOAT capture and all sport schedulers are unchanged.

