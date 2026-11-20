# Soccer, UFC and ATP — free-source readiness audit
**Snapshot:** 2026-11-20, Puerto Rico. Read-only verification against Pick Analyzer Supabase, private sports-edge-hub GitHub reference, and existing source code. NCAAF explicitly excluded; no model weights, prices, crons or subscriptions changed.

## Soccer — not an active continuous predictor
- In Pick Analyzer, `src/services/soccer-shadow-read.service.ts` fetches `https://sports-edge-hub.vercel.app/api/soccer/read-bridge`; it does not ingest Soccer into `edge_lab_multi_runs_v1`.
- Verified private upstream repository `jlebronmarty-netizen/sports-edge-hub` main: `app/api/soccer/read-bridge/route.ts` reads exact static `data/soccer/shadow-checkpoint.json`, hash guarded; **no live Soccer provider capture or settlement**.
- Upstream checkpoint captured **2026-10-16 02:17:50 UTC**, fixed LaLiga Total 2.5 study, **7 projected, 7 insufficient warmup, zero qualified, zero decided and accuracy/ROI null**. No continuous collection (`continuousCollection=false`).
- Pick's parser already rejects warmup bypass/invalid prices, but a status of AVAILABLE can be confused with current readiness: new read-only operations health distinguishes `PUBLISHED_CHECKPOINT_NO_CONTINUOUS_CAPTURE`, age in days and valid sample denominators.
- Source activation requires a *separate* safe upstream collector, verified free-feed terms and coverage of >=5 home/away venue games and >=20 competition matches, unique event IDs and official postgame settlement. Do not create synthetic results or label seven blocked quotes as picks.

## UFC — free capture working, V2 selective
- `ufc_free_runs_v1`: 77 runs, **76 PARTIAL**, one PASS. Latest Nov 20 ~21:49 UTC made **8 provider requests** (2 UFC scoreboards + up to 6 odds), reported **28 upcoming bouts**, **315 historical bouts**, **14 abstentions**, and six uncertain or unresolved historical identities. Latest issue is a documented safety reason, not a source outage.
- `ufc_free_predictions_v1`: **47 stored** total, **21 retired V1** and **26 V2**. Strict matching against verified final evidence showed **9 distinct eligible V2 settled winners, 6 correct**; denominator is extremely small, so no validated accuracy/ROI. Do not include retired V1 or unresolved/mismatched finals.
- `ufc_free_quotes_v1`: **450** archived ML quotes across **17** distinct bouts, ~26.5 observations/bout, every bout has changing price pairs across observations. This is price observation history, not evidence of a betting edge, and fresh external calls have consumption consequences.
- Preserve `INSUFFICIENT_OR_UNCERTAIN_HISTORY` abstentions; do not recover winners from name assumptions or postgame lookahead. Source permits a maximum eight provider reads per four-hour run. Future quota optimization must preserve useful refresh opportunities and be researched separately.

## ATP — credential/source transport works, event identity not stable
- `free_sports_runs_v1` ATP: **9 OK capture-only** and **2 historical ERROR**. Latest successful preflight **2026-11-20 00:13 UTC**, HTTP200, **2 ATP fixtures**, **zero currently priced**; one source read/day after claim, no paid plan changes.
- Across the nine archived successful snapshots: **48 fixture appearances, 24 distinct fixture keys, 12 keys repeated, 5 repeat IDs observed with different scheduled UTC times**. Source field `sourceTimeBasis='live'` is not a verified immutable kickoff timestamp. Some different snapshots contain historical odds objects: **17/48 appearances priced**, but that is NOT a verified current or executable quote and cannot be converted into ROI.
- ATP currently has **zero forecasts and zero results** in `free_sports_forecasts_v1`/`free_sports_results_v1`. Preflight runs intentionally have `captureOnly=true` and `OFFLINE_CONTRACT_ONLY`. WTA remains inactive.
- Before enabling any ATP SHADOW: certify durable match/event ID and correct reschedule behavior, the entitlement and usage rights of archived *decisive* historical/final results, valid score and walkover/retirement semantics, timestamps and book quote provenance. Prevent mixing player pair/round-only keys when the provider reuses them for separate fixtures.

## New diagnostics
- Pure `src/lib/three-sports-readiness.mjs`: distinct statuses for an aged Soccer checkpoint, UFC selective capturer with retired V1, and ATP capture-only temporal drift. No picks, no fake accuracy, no ROI claims.
- Read-only `src/services/three-sports-readiness.service.ts`: reuses existing Soccer bridge and *already stored* UFC and ATP Supabase receipts. Rejects capped scans and source errors. Does not call any new sporting provider.
- `/api/operations/soccer-ufc-atp`: sanitized operations result (aggregate counts/status only), no keys, tokens, raw odds payload or individual bettor data.
- CI tests against mock receipts + original UFC identity, ATP parser and dashboard regressions. The source-read endpoint does not publish a new model or modify NCAAF.

## Release gates and priority
1. **Soccer:** partner-source workflow & signed static data update design; preserve strict history/warmup threshold; publish ongoing *qualified* model only after permissioned free source and prospective freezes.
2. **UFC:** audit identity disambiguation and controlled history recovery; distinguish six unresolved prior results vs 14 upcoming abstentions. Add safe quote-refresh efficiency assessment before increasing calls.
3. **ATP:** analyze repeat-key timestamp drift with actual provider time semantics and propose immutable identity/reconciliation; then add historical decisive results using verified free plan terms; do not promote capture-only candidate to live forecasts.
4. Only with independent *frozen-and-later-settled* samples can accuracy, Brier or ROI be tested. A high percentage from a tiny sample is not sufficient.

**This change is diagnostics only**: zero database writes, new source API calls, cron triggers, official picks or model promotions. No changes to NCAAF.
