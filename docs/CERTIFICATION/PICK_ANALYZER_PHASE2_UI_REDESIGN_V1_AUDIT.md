# Pick Analyzer 2.0 presentation design

Starting package: 492d3334eb32dca0b9992701ce3534e7b21fae39.

Design system: navy surfaces in dark mode and white/slate surfaces in the existing light mode; restrained teal for Official Picks, sky for candidates, amber for Watchlist, slate for No Edge/waiting. Every state has a text label. Rounded16px cards, 16-24px spacing, tabular numeric hierarchy, two-column side comparison without horizontal scrolling. The matchup leads, followed by model probability, price, consensus edge/EV and recommendation context.

Today renders the complete canonical games collection once. Value Board uses opportunity_status (falling back to legacy status only when absent), keeping NO_EDGE separate from Watchlist. Presentation ordering preserves canonical within-class ranks. Filters change visibility only. Games without board rows are counted separately and linked to Today; no blocked opportunity rows are fabricated.

No single-book no-vig field exists in the certified read model. The UI explicitly explains its absence and labels consensus probability accurately; it performs no replacement calculation. Price/edge/EV on opportunity cards stay bound to the same canonical row. Null never becomes zero. All visible times use America/Puerto_Rico. Technical details remain in Data Health.

Navigation: Today/MLB/Value Board primary, Performance/Model Lab/Data Health secondary. Existing routes remain functional. Loading/error/empty states show no fixture opportunities. Keyboard controls have labels and focus outlines; skip link and semantic articles improve navigation.

The existing runtime readiness file hashes UI dependencies. Only approved presentation entries are refreshed; all protected hashes are asserted unchanged. No scheduling, activation, executor, provider, model, feature, preprocessing, persistence, settlement or Policy V1 code changes.

Validation so far: production build PASS; presentation checks7 PASS on current empty and preserved non-empty canonical views; R10 checks17 PASS; provider-disabled readiness checks17 PASS. Screenshot review found and fixed existing light-theme override incompatibility, navigation flag fallback and a nested definition-list accessibility defect. Final visual/Preview/production results pending. Private canonical payloads and screenshots remain outside Git.
