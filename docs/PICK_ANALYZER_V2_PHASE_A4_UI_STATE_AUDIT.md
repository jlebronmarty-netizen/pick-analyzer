# Pick Analyzer V2 Phase A4 UI State Audit

Generated: 2026-07-30T23:28:47.019Z
Baseline commit: 0704679be3325082131e8952d8766cac5af64ee7

## Verdict

PASS - product UI states are semantically coherent after scoped repair.

## Scope

Bounded audit of product-facing loading, empty, stale, delayed, unavailable, unsupported, degraded, error, retry and lifecycle-label UI states. No local server smoke, provider calls, provider credits, data mutations, prediction writes, result writes, settlement writes or learning writes were performed.

## UI-State Matrix

| Page / Component | Result | Loading | Empty | Stale | Unavailable | Unsupported | Error | Retry | Defect | Severity | Repair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard/UserTodayPanel | PASS | slow-loading message plus structured shell | explicit no-official-pick/no-visible-slate states | Refresh overdue / Data Aging / No Stored Odds labels | Today temporarily unavailable | unsupported markets remain gated by copy | error EmptyState | automatic interval/focus refetch only, no mutation retry | None | NONE | None |
| DashboardShell navigation | PASS | not applicable | not applicable | not applicable | badge-driven | badge-driven | not applicable | not applicable | Preview/Foundation/Limited badges inherited green production tone | P2 | navBadgeTone maps lifecycle badges to blue/yellow/red/gray |
| DataFreshnessPreviewCard | PASS | returns null until data exists | returns null when no items | server status rendered with relative time | NOT_AVAILABLE blue unavailable tone | NOT_SUPPORTED gray disabled tone | silent card omission for optional dashboard preview | single no-store fetch; no mutation retry | None | NONE | A3 distinct state mapping retained |
| ProbabilityPicksClient | PASS | setLoading true and finally false | eligible-row threshold explanation | freshness summary from API | error message | sport eligibility exclusion copy | catch sets error | filter change refetch; no mutation retry | None | NONE | None |
| MostLikelyTool | PASS | fetch effect with error path | no supported outcome footer | currentHistoricalPreviewLabel and warnings | data temporarily unavailable copy | unavailable market list | error panel | sort/mode refetch; no mutation retry | None | NONE | None |
| BestValueTool | PASS | fetch effect with error path | No positive-value opportunities today | warning mentions fresher odds | Data temporarily unavailable | informational warning / no unsupported CTA | safe message details | no mutation retry | None | NONE | None |
| PerformanceProductClient | PASS | skeleton while data missing | no settled production predictions explanation | last update from API | temporarily unavailable | sport readiness labels | error screen | reload button only; no mutation endpoint | None | NONE | None |
| AI Operations / Autonomous Daily AI / MLB Operations / Data Coverage / Sports Center | PASS | bounded or server-rendered states | blocked/no-data sections | freshness and scheduler labels | temporarily unavailable/readiness copy | sports and providers gated | safe message panels | no unsafe retry control found | None | NONE | None |

## Findings

- Loading: Core sampled client pages terminate loading on success/error where statically provable. No persistent local server smoke was used.
- Empty state: Valid empty recommendations remain distinct from failures. Probability, Most Likely, Best Value and Performance include explanatory empty copy.
- Stale/delayed: Freshness preview consumes server-provided statuses and clamps relative time to avoid negative values. Stale/refresh-overdue labels remain visible on Dashboard Today.
- Unavailable/unsupported: NOT_SUPPORTED and NOT_AVAILABLE remain distinct. Unsupported market recommendation policy remains locked by existing validator. Sports Center copy keeps only MLB production-ready.
- Degraded/error: Partial/degraded API states are not shown as complete success on repaired surfaces. Core error states avoid stack exposure.
- Retry: No audited retry control targets known mutation routes. Performance retry reloads the page rather than invoking generation/settlement/sync.
- Lifecycle labels: Dashboard navigation lifecycle badge tones now match ProductStatus semantics. Foundation and Preview no longer inherit green production color.
- Accessibility: Repaired badge states carry visible text, not color alone. Existing controls use accessible labels where sampled selects/buttons expose labels.

## Defects

| Severity | Area | Defect | Repair |
| --- | --- | --- | --- |
| P2 | dashboard navigation lifecycle badges | Dashboard navigation mapped every non-blocked/non-pending badge to green, so Foundation, Preview and Limited surfaces could read as production-ready by color. | Added navBadgeTone so Foundation is blue, Preview/Limited/Pending are yellow, Blocked is red and unknown badges are gray. |

## Production Evidence

| Path | HTTP | Latency ms | Semantic State | Provider Calls | Mutations |
| --- | ---: | ---: | --- | ---: | ---: |
| `/dashboard` | 200 | 423 | page_available | n/a | n/a |
| `/probability-picks` | 200 | 391 | page_available | n/a | n/a |
| `/most-likely` | 200 | 401 | page_available | n/a | n/a |
| `/best-value` | 200 | 403 | page_available | n/a | n/a |
| `/performance` | 200 | 462 | page_available | n/a | n/a |
| `/ai-operations` | 200 | 18339 | page_available | n/a | n/a |
| `/autonomous-daily-ai` | 200 | 12201 | page_available | n/a | n/a |
| `/mlb-operations` | 200 | 6484 | page_available | n/a | n/a |
| `/data-coverage` | 200 | 6932 | page_available | n/a | n/a |
| `/sports-center` | 200 | 401 | page_available | n/a | n/a |
| `/market-intelligence` | 200 | 2003 | page_available | n/a | n/a |
| `/portfolio-intelligence` | 200 | 1316 | page_available | n/a | n/a |
| `/closing-line-intelligence` | 200 | 332 | page_available | n/a | n/a |
| `/api/system/version` | 200 | 437 | 0704679be3325082131e8952d8766cac5af64ee7 | 0 | n/a |
| `/api/dashboard/today` | 200 | 3207 | AVAILABLE | 0 | 0 |
| `/api/operations/data-freshness` | 200 | 8753 | PARTIAL | 0 | 0 |
| `/api/performance` | 200 | 5693 | true | 0 | 0 |
| `/api/market-opportunities/most-likely` | 200 | 7025 | true | n/a | n/a |
| `/api/market-opportunities/best-value` | 200 | 1399 | true | 0 | 0 |

## Safety Counters

- Provider calls: 0
- Provider credits: 0
- Database reads: production read-only page/API observation only; local validator performs static file reads
- Database mutations: 0
- Prediction writes: 0
- Result writes: 0
- Settlement writes: 0
- Learning writes: 0

## Validation Results

- input exists: docs/product-route-inventory-v1.json: PASS
- input exists: docs/pick-analyzer-v2-phase-a2-route-runtime-audit.json: PASS
- input exists: docs/pick-analyzer-v2-phase-a3-scheduler-freshness-audit.json: PASS
- input exists: src/components/dashboard/DashboardShell.tsx: PASS
- input exists: src/components/product/ProductStatus.tsx: PASS
- input exists: src/config/product-status.ts: PASS
- input exists: src/components/dashboard/UserTodayPanel.tsx: PASS
- input exists: src/components/dashboard/DataFreshnessPreviewCard.tsx: PASS
- input exists: src/components/dashboard/AdaptiveOperationsPanel.tsx: PASS
- input exists: src/components/probability-picks/ProbabilityPicksClient.tsx: PASS
- input exists: src/components/market-opportunities/MostLikelyTool.tsx: PASS
- input exists: src/components/market-opportunities/BestValueTool.tsx: PASS
- input exists: src/components/performance/PerformanceProductClient.tsx: PASS
- input exists: src/app/ai-operations/page.tsx: PASS
- input exists: src/app/autonomous-daily-ai/page.tsx: PASS
- input exists: src/app/mlb-operations/page.tsx: PASS
- input exists: src/app/data-coverage/page.tsx: PASS
- input exists: src/app/sports-center/page.tsx: PASS
- input exists: src/app/market-intelligence/page.tsx: PASS
- input exists: src/app/portfolio-intelligence/page.tsx: PASS
- input exists: src/app/closing-line-intelligence/page.tsx: PASS
- input exists: scripts/unsupported-market-recommendation-policy-lock-v1-validate.mjs: PASS
- A1 route inventory is certified: PASS
- A2 route runtime audit passed: PASS
- A3 scheduler freshness audit passed: PASS
- product status config keeps Preview/Foundation/Unavailable distinct: PASS
- dashboard navigation has badge tone helper: PASS
- dashboard Foundation badge is not green: PASS
- dashboard Preview and Limited badges are caution states: PASS
- dashboard Blocked badge is red: PASS
- data freshness keeps NOT_SUPPORTED distinct: PASS
- data freshness keeps NOT_AVAILABLE distinct: PASS
- data freshness relative times cannot go negative: PASS
- shared product datetime has invalid fallback: PASS
- Probability Picks loading terminates: PASS
- Probability Picks has empty state copy: PASS
- Probability Picks separates projection from recommendation: PASS
- Most Likely handles fetch errors: PASS
- Most Likely explains data unavailable state: PASS
- Best Value handles fetch errors: PASS
- Best Value separates no value from data unavailable: PASS
- Performance handles main and history errors: PASS
- Performance retry does not call mutation API: PASS
- Dashboard Today handles loading and errors: PASS
- Dashboard Today preserves stale/no-odds labels: PASS
- Adaptive operations handles loading and errors: PASS
- AI Operations has bounded evidence timeout: PASS
- Autonomous Daily AI has explicit blocked state: PASS
- MLB Operations surfaces section errors: PASS
- Data Coverage maps Foundation/Preview away from production green: PASS
- Sports Center states only MLB production-ready: PASS
- Market Intelligence route has unavailable/empty state text: PASS
- Portfolio Intelligence route has unavailable/empty state text: PASS
- Closing Line route has unavailable/empty state text: PASS
- no unsupported market actionable CTA in audited product files: PASS
- retry controls do not target known mutation routes: PASS
- core product surfaces avoid raw stack display: PASS

## Remaining Risks

- Static validation cannot prove every possible browser interaction without a server or browser smoke harness.
- Some optional dashboard preview cards intentionally omit themselves when read-only preview data is unavailable.
- PowerShell Invoke-WebRequest is unreliable in this shell for page evidence; curl.exe was used for page HTTP evidence.

## Certification

PICK_ANALYZER_V2_PHASE_A4_UI_STATE_PASS
