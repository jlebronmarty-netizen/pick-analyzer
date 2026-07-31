# Pick Analyzer V2 Phase B5 AI Decision Explanation

Generated: 2026-07-31T00:00:00.000Z

Baseline commit: `a0a4c6032d6bb28389da98f64e1f546a58b54337`

## Product Objective

B5 adds deterministic explanation, AI Conviction, Actionability and What Would Change My Mind presentation systems to the Today cockpit.

## Input Evidence Matrix

- Normalized opportunity: Official Pick status, sport, market, odds, model probability, implied probability, confidence, edge, EV, freshness, data quality, blockers, warnings and source.
- Official Pick Readiness: gate rows, gate states, blocker summary and known requirements.
- Today contract: freshness, warnings and next action time.

## Explanation Templates

The visible explanation includes one verdict summary, up to three supporting reasons, up to three risks and one Official Pick status explanation. The copy is deterministic and evidence-backed.

## Conviction Rule Order

Allowed labels are `VERY HIGH`, `HIGH`, `MODERATE`, `LOW`, `AVOID` and `UNAVAILABLE`.

1. Missing core opportunity, probability or pricing evidence returns `UNAVAILABLE`.
2. Unsupported market or non-positive complete value evidence returns `AVOID`.
3. Fresh Official Pick evidence returns `VERY HIGH` or `HIGH`.
4. Official Pick evidence with freshness limitation returns `HIGH`.
5. Stale non-official evidence returns `MODERATE`.
6. Probability advantage plus positive edge and EV returns `HIGH` for attention only.
7. Partial positive evidence returns `MODERATE`.
8. Otherwise the label is `LOW`.

Conviction is categorical. It is not probability, confidence, EV, Trust or an Official Pick score.

## Actionability Rule Order

Allowed states are `ACT NOW`, `ACTIONABLE`, `REVIEW FIRST`, `WAIT`, `DO NOT ACT` and `UNAVAILABLE`.

1. Missing core evidence returns `UNAVAILABLE`.
2. Unsupported market, invalid pregame evidence or non-positive complete value returns `DO NOT ACT`.
3. Stale or aging odds returns `WAIT`.
4. Fresh active Official Pick returns `ACT NOW`.
5. Certified official readiness without stronger wording returns `ACTIONABLE`.
6. Otherwise the state is `REVIEW FIRST`.

Actionability is separate from Conviction and does not override Official Pick policy.

## Conditional Explanation Rules

The What Would Change My Mind panel shows up to three conditions using conditional language:

- fresh odds update could improve actionability;
- confidence gate clearing could improve readiness;
- supported price becoming available could allow value evaluation;
- policy blocker resolution could move the state stronger;
- non-positive value would weaken conviction;
- otherwise no single observed change is sufficient.

The panel never promises future Official Pick status.

## Visual Integration

B5 replaces the B4 placeholder Conviction and Actionability cards with compact categorical cards. It adds an AI Explanation summary and converts What Would Change My Mind into a conditional evidence panel. B4 visual hierarchy, alternatives, readiness progress, performance snapshot and collapsed advanced evidence remain intact.

## Accessibility

Status indicators include text labels, Conviction has an accessible categorical band label, Actionability has explicit text state, conditional items use a screen-reader-friendly list, disclosures remain keyboard-accessible and the mobile layout remains stacked.

## API And Service Changes

No API or backend service contract changed. B5 adds a client-side presentation helper that consumes the B3 normalized contract and existing readiness rows.

## Safety

- Provider calls introduced: 0.
- Provider credits consumed: 0.
- External AI API calls: 0.
- Database reads added: 0.
- Database mutations: 0.
- Prediction writes: 0.
- Result writes: 0.
- Settlement writes: 0.
- Learning writes: 0.
- Business-rule changes: 0.

## Deferred B6-B8 Work

- B6: mobile decision experience refinement.
- B7: Performance trust integration.
- B8: operations/admin separation.

## Validation

Passed:

- B5 validator: 27/27.
- B4 validator: 23/23.
- B3 validator: 26/26.
- B2 validator: 35/35.
- A3 scheduler/freshness validator: 39/39.
- A4 UI-state validator: 57/57.
- A5 API/query performance validator: 46/46.
- A6 build reliability validator: 37/37.
- Official Pick policy validation: covered by unsupported-market recommendation-policy lock.
- Unsupported-market recommendation-policy lock validator: 19/19.
- Route/artifact consistency validator: 14/14.
- JSON validation.
- Changed-file ESLint.
- Targeted secret scan.
- `git diff --check`.
- `npm.cmd run build` with 386 generated static pages.

No local server smoke test was run.

## Final Verdict

`PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION_PASS` pending production certification after commit and push.
