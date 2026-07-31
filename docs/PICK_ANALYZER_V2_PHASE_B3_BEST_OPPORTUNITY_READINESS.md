# Pick Analyzer V2 Phase B3 Best Opportunity Readiness

Generated: 2026-07-31T00:00:00.000Z

Baseline commit: `8029ebae734cb53940e34389a25fe06a7f6fa702`

## Product Objective

B3 makes Today more explainable by normalizing the Best Opportunity presentation and replacing the readiness placeholder with structured Official Pick Readiness rows.

## Scope

B3 is presentation-only. It does not change recommendation policy, thresholds, probabilities, confidence, edge, EV, settlement, learning, provider mappings, scheduler behavior, model weights or epoch state.

## Files Changed

- `src/components/dashboard/TodayDecisionPanel.tsx`
- `src/components/dashboard/today-opportunity-readiness.ts`
- `docs/PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS.md`
- `docs/pick-analyzer-v2-phase-b3-best-opportunity-readiness.json`
- `scripts/pick-analyzer-v2-phase-b3-best-opportunity-readiness-validate.mjs`

## Normalized Contract

The normalized Best Opportunity view model exposes stable presentation fields for identity, sport, event, selection, market, odds, sportsbook, model probability, implied probability, confidence, edge, expected value, freshness, data quality, Official Pick status, blockers, warnings, supporting reasons, source, provenance and update time.

## Source Priority

1. Existing Official Pick when present.
2. Existing Best Value selector.
3. Existing highest ranked priced selector.
4. Existing Most Likely selector.
5. Existing highest projected selector.
6. Existing grounded opportunity row.
7. No opportunity.

No fallback fabricates a pick.

## Official Pick Readiness

Readiness rows use the states `PASS`, `FAIL`, `PENDING`, `NOT_APPLICABLE` and `NOT_AVAILABLE`.

Known applicable rows are counted when their state is `PASS`, `FAIL` or `PENDING`. `NOT_APPLICABLE` and `NOT_AVAILABLE` are excluded from the known denominator. `NOT_AVAILABLE` is reported separately and never counted as a pass.

When the current contract cannot prove a policy gate, B3 marks that row `NOT_AVAILABLE` rather than reconstructing the policy in the UI.

## Blockers

Existing blocker codes are translated into plain-language summaries. Raw enum-like codes are not shown as the main user explanation.

## Graphics

- Probability vs implied probability is shown only when both values are available.
- Edge / EV shows positive, neutral, negative or unavailable state. Missing values are not treated as zero.
- Freshness and data quality are shown from normalized evidence.

## State Handling

B3 preserves safe states for loading, no Official Pick, no eligible opportunity, stale evidence, unavailable fields and API errors.

## Today Integration

The Today page still reads only `/api/dashboard/today`. No API contract or service contract changes were introduced, so no new route latency measurement was required.

The B2 markers remain in place and the advanced dashboard remains collapsed behind the existing disclosure.

## Safety

- Provider calls introduced: 0.
- Provider credits consumed: 0.
- Database reads added: 0.
- Database mutations: 0.
- Prediction writes: 0.
- Result writes: 0.
- Settlement writes: 0.
- Learning writes: 0.
- Business-rule changes: 0.

## Deferred Work

- B4: unified Opportunities tabs and taxonomy.
- B5: AI Conviction, Actionability and What Would Change My Mind presentation models.
- B6: mobile decision experience refinement.
- B7: Performance trust integration.
- B8: operations/admin separation.

## Local Validation

The B3 validator passed with 26 checks. B2 compatibility validation also passed.

Additional non-server validation passed:

- A2 route/runtime validator.
- A3 scheduler/freshness validator.
- A4 UI-state validator.
- A5 API/query performance validator.
- A6 build reliability validator.
- Unsupported-market recommendation-policy lock validator.
- Release-candidate route/artifact consistency validator.
- JSON artifact parsing.
- Changed-file ESLint.
- Targeted secret scan.
- `git diff --check`.
- `npm.cmd run build` with 386 generated static pages.

No local server smoke test was run.

## Final Verdict

`PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS_PASS` pending production deployment certification after commit and push.
