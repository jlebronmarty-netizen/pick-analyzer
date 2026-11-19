# NHL goalie-form signal: preliminary as-of pilot (2026-11-19)

Research-only, read-only Supabase Pick Analyzer. This pilot reuses the already captured ESPN probable goalies and official *prior* NHL postgame boxscores. It is **not** an out-of-sample model validation, a pregame goalie confirmation, an adjustment to official picks, or an authorized winning strategy.

## Identity and sample size
- 16 NHL matches with both ESPN probable goalie names in the Nov 16–18 snapshot history; 32 distinct goalie-side probabilities.
- Exact team ID + first initial + surname matching against official NHL boxscore rows whose boxscore_captured_at predated the ESPN probable observation yields **31/32** unique historical goalie candidate identities, **0 ambiguous**, **1 unmatched** (Nikita Tolopilo). This is a possible as-of crosswalk, *not* an independently certified ESPN-to-NHL ID conversion.
- **27/32** had at least 50 prior official shots against observed; **12/32** had >=100. For only **12 games** did both proposed goalies have >=50 prior shots in the stored sample.

## Directional probe — explicitly reject using goalie save% alone
- Restrict to prior final games visible before the probable source was captured, goalie ID unique within that NHL team, and last five observed goalie appearances with shots>0.
- Among **12** two-goalie eligible games, selecting the team with the higher previous shot-weighted save percentage would have correctly identified **5/12** winners (41.7%).
- Mean prior home goalie save%-minus-away save% was **+0.00371** (0.371 percentage points). In games won by the home team, the mean was **-0.00376**; in games won by the visitor, **+0.01417**. This sample is small and imbalanced, so these descriptors are not predictive conclusions.
- The experiment does not demonstrate an improvement over DRatings, Circa or Poisson, and must not alter their weights. The percentages may be noisy due to opponent strength, shot difficulty, goalie role changes and small samples.

## Operational code
- PR #370 adds goalie history research enrichment to NHL V6 as immutable historicalFormV7. No actual Poisson adjustment or new source subscriptions.
- PR #369 adds line-specific Circa Puck Line/Total evaluation, including exact lines and push gates, with a read-only endpoint.
- Independent retrospective exact-line 15-game results: Poisson Puck Brier .25823 vs Circa no-vig .24863; Total Poisson .25972 vs Circa .24990. Directional choices 9/15 (Puck), 8/15 (Total). Not out-of-sample or verified ROI.

## Next experiments (do not pre-approve)
1. Keep capturing V6 frozen decisions and the as-of goalie prior-form evidence, then evaluate exact paired same-match cohorts on new games.
2. Pre-register a goalie-aware challenger using shrinkage, opponent-adjusted shots/shot quality and home/away context, comparing the same games to the unchanged independent Poisson baseline. Do not tune and select using only the 12 known games.
3. Explore NHL PBP regulation-vs-OT/SO breakdown to handle official totals and goalie statistics correctly. The current Poisson uses **final score** priors and a 50/50 tie resolution approximation; do not add one extra goal to every tie without first separating regular-time scoring, or it may double count.
4. Verify published-before-puckdrop confirmed starter sources and reuse rights before collecting. Probable source is unconfirmed; postgame longest-time goalie is not pregame confirmation.
5. Promote nothing to Official Picks unless prospectively frozen Brier, Log Loss and market-specific accuracy improve on a meaningful independent sample (initial screen >=30, preferable 100+).

No paid calls, database changes, outside-provider scraping, official model edits or forced crons were used in this pilot.
