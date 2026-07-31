# Pick Analyzer V2 Phase B2 Today Experience

Generated: 2026-07-31T00:00:00.000Z

Baseline commit: `8fad0ebaa5c84d4e2782f9bee230a910132ba7c2`

## Product Objective

B2 turns `/dashboard` into the first bounded implementation of the daily decision cockpit. The page now prioritizes two questions: should the user bet today, and what is the strongest available opportunity if they review anyway.

## Exact Files Changed

- `src/app/dashboard/page.tsx`
- `src/components/dashboard/AdvancedEvidenceDisclosure.tsx`
- `src/components/dashboard/DashboardShell.tsx`
- `src/components/dashboard/TodayDecisionPanel.tsx`
- `docs/PICK_ANALYZER_V2_PHASE_B2_TODAY_EXPERIENCE.md`
- `docs/pick-analyzer-v2-phase-b2-today-experience.json`
- `scripts/pick-analyzer-v2-phase-b2-today-experience-validate.mjs`

## Data Sources Used

- `/api/dashboard/today`
- Existing Today canonical view model selectors
- Existing official pick, grounded opportunity, freshness, warning and timing fields returned by the Today contract

No new API, provider call, database mutation, prediction write, settlement write or learning write is introduced.

## Verdict Derivation

Allowed labels remain `BET`, `REVIEW`, `WAIT` and `PASS`.

- `BET`: existing `officialPicks > 0`
- `WAIT`: no official pick and stale freshness or games waiting for stored odds
- `REVIEW`: no official pick, but an existing best available opportunity is visible
- `PASS`: no official pick and no eligible supported opportunity is visible

This is presentation logic only. Official Pick policy, thresholds, probabilities, confidence, EV and edge are unchanged.

## Best Opportunity Source

B2 uses the least invasive existing source order:

1. `sections.officialPicks.data[0]` when `officialPicks > 0`
2. `viewModel.selectors.bestAvailableValue`
3. `viewModel.selectors.highestRankedPricedMarket`
4. `viewModel.selectors.mostLikelySummary.selector`
5. `viewModel.selectors.highestProjectedOutcome`
6. `sections.groundedOpportunities.data[0]`

If none exists, the page renders a truthful no-opportunity state and does not fabricate a pick.

## Advanced Hiding Strategy

The existing advanced dashboard stack is preserved but placed behind `AdvancedEvidenceDisclosure`. It is collapsed by default and only renders the advanced child tree when opened.

## Navigation Changes

The desktop rail now presents the product through five primary concepts: Today, Opportunities, Performance, Sports and More. Existing route links remain accessible. No routes are deleted, redirected or renamed in B2.

## Visual Hierarchy

The page foregrounds:

- verdict strip;
- Today's Best Opportunity hero;
- compact decision metrics;
- Why and Risks;
- What Would Change My Mind;
- alternatives preview;
- compact freshness and performance links;
- collapsed advanced evidence.

Full Most Likely, Best Value, Current Board, provider matrices, scheduler internals and model diagnostics remain outside the primary flow.

## State Handling

- Loading: decision-shell skeleton with `aria-busy`
- No Official Pick: still shows Best Opportunity when present
- No eligible opportunity: explicit no-opportunity state
- Stale: `WAIT` path and freshness context
- Provider unavailable: no live-provider claim
- Error: safe degraded message and Operations link

## Accessibility

B2 includes semantic headings, text status labels, keyboard-accessible disclosure, visible focus rings, accessible loading state and compact cards that avoid horizontal overflow.

## Deferred Work

- B3: Best Opportunity normalization and Official Pick Readiness gates
- B4: unified Opportunities tabs and taxonomy
- B5: AI Conviction, Actionability and What Would Change My Mind presentation models
- B6: mobile decision experience refinement
- B7: Performance trust integration
- B8: operations/admin separation

## Provider Calls

0 introduced by B2.

## Mutations

0 database mutations, prediction writes, result writes, settlement writes or learning writes.

## Production Evidence

Pending automatic deployment after the B2 commit is pushed.

## Final Verdict

Pending local validation and production certification.
