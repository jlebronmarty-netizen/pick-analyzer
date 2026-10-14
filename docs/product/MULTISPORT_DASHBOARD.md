# Multisport dashboard preparation — 2026-10-14

## Behavior

The dashboard leads with overall official accuracy and one card per sport in the existing Sports Center registry. Accuracy is `sum(wins) / (sum(wins) + sum(losses))`, weighted by decided selections rather than averaged sport percentages. Pending picks, pushes, voids, preview predictions and research predictions are excluded. Invalid or unavailable connected counts make overall performance unavailable; an unknown record is never displayed as zero accuracy.

MLB is the only connected official performance adapter in this change. It reuses `getMlbOfficialPerformance()` and its existing game/side deduplication, original decision selection, bounded-read guard and settlement validation. Other sport cards retain the repository's current readiness labels and link to their existing Sports Center pages. Nothing activates another sport or imports a Sports Edge Hub certification. The pre-existing production-model snapshot remains available under a clearly labeled advanced diagnostics disclosure; it is not labeled as the official pick sample, and a null diagnostic accuracy stays unavailable.

Two separate daily lists reuse the existing `/api/dashboard/today` response:

- **Today's official picks:** existing official-policy contracts only, on the Puerto Rico operating date. No policy changes or candidate promotion.
- **Highest model edge:** up to ten informational candidates with a positive canonical edge and EV, an available canonical price, fresh/aging selected-side alignment, a finite canonical probability and a pregame-safe event. Order is edge (percentage points), then EV, then prediction identity. This is independently ranked across the eligible daily candidates, not a re-sort of the existing EV top ten. Complement prices use complement freshness. Missing section/date and unavailable responses remain distinguishable from an empty list.

`sections.highestEdge` is additive and optional in the Today contract. Existing selectors, Best Value, verdict, recommendations and endpoints remain in place. No additional provider request or client fetch was introduced.

The Performance page adds a paginated official selection table with result and Puerto Rico pick-date filters. Wins, losses, pushes, voids and pending selections remain separate. Net units come from the original stored settlement, not a new settlement calculation. Partially settled or conflicting snapshot groups stay pending; original odds and decision-time details remain available. The original last-30 detail cards are preserved, while the new table receives the complete successfully read bounded ledger. Reaching the existing 1,000-row read limit fails closed rather than presenting partial totals.

## Next sport integration

| Sport | Current Pick Analyzer registry state | Work before inclusion in official metrics |
| --- | --- | --- |
| MLB | Production | Existing official adapter connected by this UI change |
| NHL | Preview | Audit production data/prediction eligibility; certify official recommendations, settlement and a sport-specific performance adapter |
| NFL | Preview | Same production and official lifecycle gates; preview rows remain separate |
| NBA | Foundation | Complete canonical results, stats, odds and prediction certification before the official lifecycle |
| Soccer / BSN / Tennis / UFC | Planning / Preview / Blocked | Follow each existing Sports Center gate; no automatic activation |

NHL and NFL are the next implementation audits to consider because they already have persisted preview prediction lifecycle evidence in this repository. This is a code-readiness assessment, not a claim of current feed availability or profitability. NCAAB research in Sports Edge Hub remains independent.

## Reproduction and release checks

```bash
node --loader ./tests/dashboard-multisport/tsx-loader.mjs --test tests/dashboard-multisport/metrics.test.mjs tests/dashboard-multisport/components.test.mjs
NODE_OPTIONS=--max-old-space-size=6144 npm run build
```

The first command uses deterministic test fixtures, never live or invented production results. Component checks render the real React components with React DOM Server; they do not substitute for browser interaction, screenshot or live Supabase verification.

Release requires a build with the existing environment configured, desktop/mobile browser review, filters/pagination verification and authenticated read-only checks of the real official ledger. Only after those checks should this branch be merged/deployed. The changes contain no migrations, provider workers, scheduler changes, settlement writes, model changes or historical backfills.

## Verification outcome

- `npm run test:dashboard-multisport`: **12 PASS**, zero failures (weighted metrics, unavailable/empty behavior, PR day boundaries, edge versus EV order, canonical complement freshness, filters and actual React component rendering).
- Targeted ESLint: **PASS** for the changed application files. `git diff --check`: **PASS**.
- First build: webpack compiled; TypeScript worker exhausted the default Node heap. A parallel standalone type check was stopped before the memory-adjusted retry.
- Retry with `NODE_OPTIONS=--max-old-space-size=6144 npm run build`: webpack **PASS** (96s), TypeScript **PASS** (106s). Page-data collection then failed on existing `/api/ai/copilot/chat` with `Missing NEXT_PUBLIC_SUPABASE_URL`. Overall build: **BLOCKED_MISSING_BUILD_ENV**, not PASS. No dummy credentials were supplied.
- Browser review: **BLOCKED_BROWSER_INSTALL**. No Chromium was installed; Playwright's official download repeatedly returned a truncated/non-ZIP archive. No screenshot, mobile interaction or live production certification is claimed.
- Live database/HTTP validation and deployment: **not performed**. No production state or immutable pick/result rows were changed.

This is a reviewable implementation draft. Release checks above remain outstanding; no newly connected sport or profitable predictive model is certified by these UI changes.

## Qualified Plays handoff supplied by the owner (2026-10-14)

The owner supplied updated MLB forward-research counts in chat. These are a **reported snapshot**, not a fresh database read or certified live import in this UI task. The existing `mlb-forward-master-ledger.service.ts` already identifies `mlb_2026_forward_master_ledger_v1` and marks this evidence research-only, not production/Official Pick eligible. Preserve that boundary.

| Reported cohort | Wins | Losses | W/L n | W/L accuracy | Open / other state |
| --- | --- | --- | --- | --- | --- |
| Pick Analyzer regular season, accounting subtotal | 196 | 43 | 239 | 82.01% | 44 OPEN |
| Pick Analyzer postseason, accounting subtotal | 261 | 25 | 286 | 91.26% | 27 canonical OPEN; 11 newer frozen candidates excluded pending master sync |
| Pick Edge original regular artifact cohort | 42 | 31 | 73 | 57.53% | 2 VOID, 0 OPEN; 75 artifacts |
| Equilizer original regular cohort | 77 | 53 | 130 | 59.23% | 0 OPEN; cohort remains 130/150, evaluator locked |

The reported Pick Analyzer subtotals reconcile arithmetically with their listed exact-contract rows. That does not verify source lineage, freshness, deduplication or economic execution. Batter Doubles U0.5 contributes 201/239 regular settled observations (168W/33L) and 260/286 postseason observations (241W/19L). Postseason is `POSTSEASON_SHADOW_DOMAIN_SHIFT`; never pool its hit rate with regular season to claim generalization. Single-observation 100% records do not establish predictive reliability.

Useful next UI feature: a **Research / Qualified Plays** tab with engine, season phase, exact market/line/direction, sample size, W/L/PUSH/VOID, OPEN and source sync timestamp. Read it from a separately audited, read-only master-ledger report; do not write pasted totals into the official-performance adapter or present the snapshot as current live data. Keep engine cohorts independent and preserve Equilizer's original completion counter.

This evidence can support contract-level diagnostics, prospective calibration work and identifying which offered markets merit further validation. Historical hit rate is not a calibrated per-pick probability. The supplied summary contains no per-ticket historical prices/stakes/contract availability sufficient to establish ROI or current executable edge. Do not populate those fields from these percentages. The initial handoff recorded this as follow-up. The implementation update below now provides the read-only research page; it uses actual ledger records rather than these pasted totals.

## Implementation update — Qualified Plays and actual homepage

`/qualified-plays` is now implemented and linked in the shared navigation. It renders canonical ledger observations with phase and engine filters and one row per exact model/contract/market/line/direction/evidence class. OPEN, PUSH and VOID are excluded from W/L hit rate. No cross-phase or cross-engine performance total is created; absent markets are not fabricated as zero captures. Low W/L sample sizes are explicitly labeled. Equilizer's original cohort is not extended using postseason evidence.

`getQualifiedPlaysReport()` uses server-only, read-only Supabase access. It reads count/update-time boundaries and ID-ordered 500-row pages, then rechecks boundaries. Duplicate identities/source tuples, invalid phase labels or flags, late known freezes, missing settlement timestamps, partial pages, changed boundaries or a 15-second deadline produce UNAVAILABLE with no substitute counts. Reads above the explicit 10,000-row safety cap fail closed; that cap is a UI-read resource guard, not a scientific search limit. Only aggregate groups reach the client; no service key, raw metadata or SQL execution endpoint is exposed. No RLS/schema/grants were changed.

A fresh atomic read-only SQL snapshot on 2026-10-14T20:17:49.762647Z contains **815 observations /16 groups**. The actual application aggregator and its paginated mapper match independent SQL GROUP BY counts exactly. Pick Analyzer regular:196W/43L/44OPEN; postseason:271W/26L/30OPEN. Postseason Doubles:250W/20L/27OPEN, superseding the earlier owner's pasted snapshot. This verifies ledger arithmetic and specific input guards, not the original outcome/quote lineage or executable ROI. Of all ledger rows, 607 have a non-null price; mere price presence does not certify execution or ROI.

The raw atomic snapshot remains a local verification input, not a hardcoded UI dataset. The committed verification receipt records its SHA256, groups, source and read time. Reproduction against a new live snapshot must preserve the new snapshot's date and report differences rather than force parity with old counts:

```bash
npm run test:dashboard-multisport
node --loader ./tests/dashboard-multisport/tsx-loader.mjs scripts/verify-qualified-plays-live.mjs /path/to/atomic-sql-snapshot.json
```

Preview inspection found that `/` and `/today` render `MlbToday`, whereas the first UI commit had enhanced only `/dashboard`. This update fixes that integration gap. The actual homepage now includes the official performance overview and daily lists built from the **same Pick 2 operational snapshot as the game slate**. Fractional Pick 2 probabilities/consensus edges are explicitly converted to percent/percentage points for display. Original persisted Official Picks stay recorded with a current-blocked label when appropriate; started, blocked or stale current rows cannot enter the informational edge ranking. Links use the current Pick 2 Value Board. Legacy dashboard selectors and the canonical game cards remain intact.

Validation at implementation: **23 tests PASS**; independent SQL/paginated mapper parity **PASS**. First new-module build compiled webpack before being stopped when preview inspection revealed the homepage route gap; a fresh final build includes the correction. No migration, source sync, provider request, worker/scheduler activation or database write was performed. The initial PR commit (78fe463) independently received green GitHub checks and a Ready Vercel preview; that does not yet certify this subsequent update or browser behavior.

## Final preview checkpoint

The functional update and its contrast/layout follow-up were verified in the configured Vercel branch preview (source e583ebad33702b2614d37df5fdc856c24f0baf3d). GitHub checks are green and Vercel is Ready. Browser checks cover the actual homepage, real official settlement filtering, Qualified Plays live read, phase/engine isolation, empty states and model/evidence disclosures. See `QUALIFIED_PLAYS_PREVIEW_VERIFICATION.md` and its unedited screenshots.

23 tests and targeted ESLint PASS. Latest local webpack/TypeScript PASS; complete local page-data collection is still blocked by missing Supabase environment (existing `/api/ai-bet-finder`). Desktop preview succeeds with the configured server environment. Mobile review remains pending. No merge, production promotion, database write, migration, provider request, model/policy change or scheduler activation. Official MLB19W/23L(45.2%) remains distinct from Qualified Plays research hit rates.

## Desktop audit before mobile or production

At the owner's request, mobile and production remain paused. `DESKTOP_REVIEW_20261014.md` records an independent SQL cross-check of151 original snapshots collapsed to42 selections(19W/23L), complete pagination/filter/navigation checks and a confirmed light-theme Performance contrast defect. Source3047f48 fixes that defect and labels one-unit returns explicitly. The fix is verified in browser,23 tests PASS, targeted lint PASS, configured Vercel preview Ready and nine GitHub checks green. Local webpack/TypeScript PASS; full local build is still blocked by the existing missing Supabase environment.

The audit also confirms an open operational dependency: game849811 currently lacks canonical champion prediction and stored market prices. The UI's waiting/empty state is accurate; the reason and expected input timing were not established by this UI review. Historical metrics do not certify today's input pipeline. No activation, provider fetch or production promotion was attempted.

## Operational readiness follow-up

The October 14 read-only diagnosis reproduces an existing production certificate drift that prevents current MLB predictions. See [pipeline diagnosis](MLB_PIPELINE_DIAGNOSTIC_20261014.md). UI readiness does not imply operational readiness; production and mobile remain paused.

The reviewed runtime repair and desktop/API verification are recorded in [release readiness](MLB_RELEASE_READINESS_20261014.md). The exact application preview passed build and all ten checks; production approval and production-target readback remain pending.
