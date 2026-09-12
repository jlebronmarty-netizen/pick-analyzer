# Pick Analyzer 2.0 presentation design

Starting package: 492d3334eb32dca0b9992701ce3534e7b21fae39.

Design system: navy surfaces in dark mode and white/slate surfaces in the existing light mode; restrained teal for Official Picks, sky for candidates, amber for Watchlist, slate for No Edge/waiting. Every state has a text label. Rounded16px cards, 16-24px spacing, tabular numeric hierarchy, two-column side comparison without horizontal scrolling. The matchup leads, followed by model probability, price, consensus edge/EV and recommendation context.

Today renders the complete canonical games collection once. Value Board uses opportunity_status (falling back to legacy status only when absent), keeping NO_EDGE separate from Watchlist. Presentation ordering preserves canonical within-class ranks. Filters change visibility only. Games without board rows are counted separately and linked to Today; no blocked opportunity rows are fabricated.

No single-book no-vig field exists in the certified read model. The UI explicitly explains its absence and labels consensus probability accurately; it performs no replacement calculation. Price/edge/EV on opportunity cards stay bound to the same canonical row. Null never becomes zero. All visible times use America/Puerto_Rico. Technical details remain in Data Health.

Navigation: Today/MLB/Value Board primary, Performance/Model Lab/Data Health secondary. Existing routes remain functional. Loading/error/empty states show no fixture opportunities. Keyboard controls have labels and focus outlines; skip link and semantic articles improve navigation.

The existing runtime readiness file hashes UI dependencies. Only approved presentation entries are refreshed; all protected hashes are asserted unchanged. No scheduling, activation, executor, provider, model, feature, preprocessing, persistence, settlement or Policy V1 code changes.

Validation so far: production build PASS; presentation checks7 PASS on current empty and preserved non-empty canonical views; R10 checks17 PASS; provider-disabled readiness checks17 PASS. Screenshot review found and fixed existing light-theme override incompatibility, navigation flag fallback and a nested definition-list accessibility defect. Final visual/Preview/production results pending. Private canonical payloads and screenshots remain outside Git.

## Final production certification

UI_REDESIGN_CERTIFIED = YES. Tested UI package aa93dc26118600b5adc5381c59b44bd63f2e8551 passed Preview before normal publication to main. Production system-version readback matches that SHA. Both routes pass HTTP, browser-error and overflow checks at 375/390/430/768/1440 pixels; mobile axe reports zero violations. Private nonempty light/dark specimens cover the same widths. Build, scoped ESLint, 7 presentation, 17 R10 and 17 injected readiness checks pass.

At 2026-09-12T17:36:31.515Z, the canonical view contains 15 games and zero opportunity rows in every classification. Game reasons: 2 started, 11 stale evidence, 2 unknown starter evidence. The deployed pages match those counts. This certificate verifies UI fidelity, not a new operational freshness result. Earlier nonempty canonical observations remain private test evidence only.

UI provider calls, business production DML, production DDL and automation behavior changes are all zero. Readiness metadata updates only presentation file hashes. All protected engine/model/policy/runtime source remains unchanged; 19 inherited worktree changes remain unstaged. Public certification contains structural results and counts, not raw production evidence or secrets. Single-book no-vig remains unavailable in the canonical contract. See PICK_ANALYZER_PHASE2_UI_REDESIGN_V1_CERTIFICATION.json.
