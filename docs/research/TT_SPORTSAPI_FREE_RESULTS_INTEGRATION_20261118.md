# SportsAPI.app FREE TT Elite Series — results-only adapter (2026-11-18)

**Scope:** Pick Analyzer only. Research/SHADOW first, then optionally ACTIVE after real cross-provider evidence. Does not alter original Table Tennis model, premiums, FanDuel, source quotas, existing historical finals, or future prediction creation. No source key exists in Vercel yet.

Official docs:
- https://sportsapi.app/sports/table-tennis
- https://sportsapi.app/docs/search/query (`GET /v2/search?q=TT%20Elite%20Series&type=league`)
- https://sportsapi.app/docs/fixtures/list (`GET /v2/fixtures?date=YYYY-MM-DD&league=<verifiedId>`)
- https://sportsapi.app/pricing (Free $0, beta 1000/day reducing to 100/day; 10/min, 7 days history; no Free betting odds)
- https://sportsapi.app/docs/reference (`homeScore.current` is number of sets won; `periodN` is the TT set-point score)

## Deployment configuration (server only; never paste your token into chat or GitHub)

1. User registers for SportsAPI **Free** at https://sportsapi.app/pricing or https://sportsapi.app/dashboard and creates a key.
2. In the existing **Pick Analyzer** Vercel project, go to Settings -> Environment Variables and add:
   - `SPORTSAPI_TT_API_KEY`: **secret** API token, Production (and Preview if testing). Do not use a `NEXT_PUBLIC_` name.
   - `SPORTSAPI_TT_RESULTS_MODE`: `SHADOW` initially. Allowed values: `OFF` (default, zero calls), `SHADOW` (capture/match counts, no SportsAPI settlements), `ACTIVE` (only after validated real records, settle from SportsAPI when original PulseScore result is PENDING).
   - Optional `SPORTSAPI_TT_LEAGUE_ID`: the positive integer returned by an **exact** SportsAPI league search; if absent, the adapter uses one free search call each due cycle.
3. Redeploy the exact reviewed commit into production after setting variables; this picks them up without changing models or adding any subscription.
4. Let the **existing scheduled TT cron** run. Never trigger premium PulseScore calls manually just to test.
5. Examine `edge_lab_multi_runs_v1.summary.sportsapi` for `mode`, `calls`, `status`, `finals`, `shadow_candidates` and `errors`. Compare with `edge_lab_multi_sources_v1` read-only captures; verify TT Elite Series league identity, participant names, exact start times, finals and set scores from actual SportsAPI responses. First run **must not grade** anything.
6. Once several actual matches agree in participant identity, timing and decisive result with independent known results, optionally change mode to `ACTIVE` and redeploy. Continue monitoring for `DISPUTE`, Brier/accuracy and unresolved backlog. If conflicts rise, switch back to `SHADOW` or `OFF`. Official picks remain untouched.

### Billing and call limits

- Maximum **3 SportsAPI GET calls per due cycle** (1 optional league ID search + up to 2 per-day fixture reads).
- Maximum **9 SportsAPI calls per UTC day** using existing Pick TT run ledger, below both 100/day stable Free and beta 1000/day.
- Queries only unfinished **already frozen** TT forecast-market events in the last **six** days, allowing slack against Free's seven-day history limit. No browsing of all table tennis leagues or new event acquisition.
- Any 401/403/429/timeout/malformed response fails closed with a status warning; never retry immediately, never risk exceeding quota.
- Does not touch `edge_lab_tt_request_budget_v1` (the existing paid-source accounting) and adds **no new PulseScore calls**.
- All source URLs explicitly allowlisted to `api.sportsapi.app/v2/search` or `/v2/fixtures`; key passed only as Authorization header.
- SportsAPI answers are archived as named source receipts in the **existing** `edge_lab_multi_sources_v1`; no database migration or new table.

### Safe settlement contract

- Require exact `sport='table-tennis'`, `league.id`, `league.name='TT Elite Series'`, `status.type='finished'`, unique numeric fixture ID, and valid side identities.
- Require decisive best-of-five set score (3–0/1/2), and compatible optional provider winner.
- Require unique cross-provider player pair match within **±5 minutes** of the original frozen scheduled time, plus source receipt after frozen prediction emission and after match started; changed fixtures and ambiguous matches are not graded.
- `MONEYLINE` and `SETS_ODD_EVEN`: grade from actual decisive set scores.
- `TOTAL_POINTS`: grade **only when all per-set point scores are valid and consistent** with total set score. Otherwise remains PENDING (do not manufacture points).
- Existing PulseScore winner/result source stays first. SportsAPI is a fallback for its `PENDING` contracts only. Source records are deliberately **not fed to the model's historical finals**: avoid double counting two copies of the same match and changing the frozen prediction engine.
- `SHADOW` allows source capture and `shadow_candidates` comparison but **zero** SportsAPI outcome writes; `ACTIVE` must be explicitly configured and verified.

### Current evidence and limits

- Snapshot 2026-11-19 around 00:50 UTC: **121** TT unique past-due games / **363** forecast-market rows. At another run's slightly earlier time, **115/120** eligible overdue events were within six days and **5/120** older than that window. The count changes as more fixtures become overdue.
- **Coverage unverified:** SportsAPI's public site lists TT Elite Series, but without a user-created SportsAPI key we have not tested that its actual results match our NetBet/PulseScore event names, timing or set-score completeness. Don't promise any number of recovered games or call the integration operational until a real SHADOW pilot succeeds.
- Older-than-seven-day matches cannot be recovered through Free history, regardless of the number of requests. Explore separately a rights-compatible authorized archive for the residual cohort.
- An account/provider subscription is **not** created automatically; the user controls registration and key installation. Do not log, echo, or store key material in Supabase.
