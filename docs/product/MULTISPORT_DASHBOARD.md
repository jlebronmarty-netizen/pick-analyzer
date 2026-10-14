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

This evidence can support contract-level diagnostics, prospective calibration work and identifying which offered markets merit further validation. Historical hit rate is not a calibrated per-pick probability. The supplied summary contains no per-ticket historical prices/stakes/contract availability sufficient to establish ROI or current executable edge. Do not populate those fields from these percentages. This follow-up research tab is documented, **not implemented or connected by this branch**.
