# Pick Analyzer V2 Phase B4 Decision Dashboard Experience

Generated: 2026-07-31T00:00:00.000Z

Baseline commit: `196b0e444f5b3340239db6dcdf8d6d30bc2ca60a`

## Product Objective

B4 turns Today into a premium daily decision cockpit. The page now prioritizes the decision sequence: Today&apos;s Verdict, Today&apos;s Best Opportunity and Why.

## Experience Sections

- Today&apos;s Verdict: large semantic hero with `BET`, `REVIEW`, `WAIT` and `PASS` states.
- Today&apos;s Best Opportunity: visual hero card with sport, teams, market, odds, probability, implied probability, edge, EV, confidence, Official status and freshness.
- Why: maximum three compact reason cards.
- Risks: maximum three compact risk cards.
- Readiness: visual progress bar plus compact gate chips and expandable detail.
- Compact Metrics: premium metric tiles and probability/edge/freshness graphics.
- Alternatives: limited preview cards with links to Most Likely and Best Value.
- Performance Snapshot: compact trust, accuracy and trend card using the existing Performance route.
- Advanced: remains collapsed behind the existing advanced evidence disclosure.

## Safety

B4 is presentation-only. It does not change business logic, recommendation logic, Official Pick policy, prediction formulas, probability formulas, confidence, edge, EV, settlement, learning, scheduler behavior, provider mappings or model state.

## API Posture

The Today cockpit continues to use `/api/dashboard/today`. The compact Performance Snapshot uses the existing `/api/performance` product summary route. No API or service contract changed.

## Mobile

Dashboard mobile now includes a bottom navigation using the existing primary product links: Today, Opportunities, Performance, Sports and More.

## Deferred

- B5: AI Conviction, Actionability and What Would Change My Mind presentation models.
- B6: mobile decision experience refinement.
- B7: Performance trust integration.
- B8: operations/admin separation.

## Validation

Passed:

- B4 validator: 23/23.
- B3 validator: 26/26.
- B2 validator: 35/35.
- Route validator: A2 route/runtime validator passed.
- Accessibility validation: static semantic, focus and mobile navigation checks passed through the B4 validator.
- JSON validation.
- Changed-file ESLint.
- `git diff --check`.
- Targeted secret scan.
- `npm.cmd run build` with 386 generated static pages.

No local server smoke test was run.

## Final Verdict

`PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE_PASS` pending production certification after commit and push.
