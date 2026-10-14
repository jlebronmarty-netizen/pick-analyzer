# MLB engine hub — October 14

Review branch: `feat/mlb-engine-hub`. Production remains on the previously approved PR 270 release.

The hub at `/mlb/overview` organizes recorded MLB selections into General, Pick, Edge, Equilizer and Formula views. Links are available from Today, Qualified Plays and the existing MLB Research Lab. The current research source is `mlb_2026_forward_master_ledger_v1`; the independent official card reuses the existing deduplicated Official Pick performance reader. No recommendation/model/settlement logic is copied or changed.

Research accuracy is WIN/(WIN+LOSS), with OPEN/PUSH/VOID excluded. Regular season and postseason remain separate. Each model/engine/exact market/line/direction/contract/evidence group has its own metrics. Engine subtotals are descriptive accounting, not calibrated probabilities, executable ROI or unique bets. Formula view shows the same observations without creating another engine. Equilizer postseason does not extend the original cohort. PE_ML_V1 remains artifact-direction evidence, never an Official Pick.

The history includes selection, game identifier, target date, frozen projection, observed result/value and freeze/settlement timestamps. Filters by engine, exact formula, phase, date and result apply to history; cards and formula accuracy intentionally retain the full selected phase. History uses 25 rows per page. OPEN does not imply an active market. Projection values retain each model's native units and do not become per-play probabilities. Raw metadata, source pointers, model probabilities and sportsbook fields are not serialized in the new history DTO.

The guarded complete snapshot reader retains exact count/watermark, stable cursor, duplicate and as-of checks. Additional display fields are opt-in and validated. A missing/invalid/changed/partial ledger fails closed. Read-only `/api/mlb/engines` supplies the same sanitized DTO as the server-rendered page. Sources are read concurrently and no client-side provider requests or N+1 queries are introduced.

Canonical SQL audit: 815 master observations, 16 exact groups, no missing target date/selection/game identifier, no nonfinite projection. Snapshot fingerprint at audit: `f42af747f961b1453852180f509639f9`. Counts are a snapshot, not hardcoded display metrics. Only synced canonical forward observations are included; no claim of all historical formula availability, backtest/forward pooling, or retroactive prediction creation.

Verification: 32 dashboard logic/render tests PASS; targeted ESLint PASS; release readiness guard PASS with all 107 operational pins unchanged. Completed production-build and configured-preview review are recorded below. No database writes, migrations, provider acquisitions, scheduler changes, production merge or deployment by this change.

## Preview and data verification

Application source `b96a1ecf26a0daf880a14d09e801c8442ca7ba94` is deployed READY at `dpl_GtNmWQT5HRfDzjqRVTrc6cmKjCQj`. The version API confirms the exact SHA and preview environment. Eight GitHub check runs passed. The immutable preview is https://pick-analyzer-jqja6dwg0-pick-analyzer.vercel.app/mlb/overview (normal Vercel preview protection remains enabled).

The real SDK/API read returned HTTP 200, AVAILABLE, 815 sanitized history entries and 16 complete groups. Independent SQL agrees exactly on all group counts and accuracy values. Every detail belongs to its group, all group detail counts match, and OPEN observations disclose no observed result or settlement timestamp. The master watermark is 2026-10-14T15:20:18.612Z.

Browser verification: regular-season General shows 488 observations; Pick research 196 W / 43 L (82.01%), Edge 42 W / 31 L / 2 VOID (57.53%), Equilizer 77 W / 53 L (59.23%). Official ML is separately 19 W / 23 L (45.24%). Edge history contains 75 rows, Equilizer 130; its postseason view is empty. Exact Doubles U0.5 LOSS filtering returns 33 rows across two pages; next/previous controls work. Pick postseason + Today returns 14 research observations, without official promotion. Phase and formula controls, selections, results, source/read timestamps and the light-theme desktop layout were checked. Mobile device certification is not claimed.

After verification, the master remains 815 rows with fingerprint `f42af747f961b1453852180f509639f9`; original official picks remain 151 decision rows with fingerprint `2f421c6a03cc71716a22868fa54508c7`, and champion predictions remain 452. These agree with the read-only baselines. Screenshot and machine-readable receipt accompany this report.

## Preserved build attempts

The first local build exhausted the default 2GB Node heap; subsequent attempts used 6144MB without changing source/configuration. The first preview exposed SDK type inference for the dynamic select string; the corrected reader validates unknown object rows before the existing strict ledger checks, rather than asserting a successful query type. An intermediate local attempt was stopped for that correction. A later local build passed TypeScript but lacked the existing publishable-key placeholder; no real credentials were fetched. With all required non-live placeholders, it generated 400 pages but hit ENOTEMPTY while cleaning a stale export directory. That generated directory was preserved outside the repository and a final build started from clean output. The configured Vercel build independently completed successfully. No failed build is relabeled as a pass.


## Final local build

The exact tracked application tree `84c1da0b52a3c8227cf45af1fa115e51a9f4f4de` was archived unchanged to an isolated temporary directory, reusing installed dependencies. `npm run build` completed with exit code 0, including TypeScript, 400 static pages and final traces. Only non-live placeholder environment values and a 6144MB Node heap were used; no real credentials were pulled. Log SHA256: `e06dc4e3dfd1588bf8fe9d52f6e3222fbb6f25556b353c4640b95048fd329b14`. This isolates the observed workspace export-cleanup failure from the verified source build without editing configuration or weakening validation.

No task build/test/download process remains active. Existing independent production crons remain unchanged. This change is ready for review in PR #271, not merged or promoted. Receipt: `MLB_ENGINE_HUB_VERIFICATION_20261014.json`; screenshot: `qa/mlb-engine-hub-b96a1ec.jpg`. The final evidence commit changes documentation/image only; the tested application remains b96a1ec.
