# F7 ML stability block V1

Research-only, 2026-09-22. Frozen contract/evaluator/synthetic tests: **6d31b65**, before evaluating these selection rules. Three new selectors FAIL. Status: **F7_ML_RESEARCH_SATURATION_PENDING_NEW_INFORMATION**. External remains closed.

The source is the unchanged e4072652 hierarchical, Kalman, latent-archetype and isotonic rolling probability artifacts. All four families are included, with no pair chosen from joint wins. Exact gamePK/date/truth/baseline intersection produces **3,319 games**; source hashes bind the immutable artifacts to previously certified historical-development F7 outcomes. No current-game outcomes enter predictors. Calibration sees only previous calendar dates and resets by season; entire dates are predicted before updates. Draws never enter conditional ML calibration. No lineup, starter, odds or newly reconstructed temporal inputs are used. The original seven architecture failures remain immutable.

## Predeclared rules and robustness interpretation

- **Consensus:** all four conditional probabilities favor the same side, at least two independently give that side >=0.75. No preferred pair; ties abstain. This is a new frozen conjunction, not a change to any source threshold.
- **Conformal:** arithmetic-mean conditional probability, fixed 0.75 confidence plus a singleton Mondrian prediction set at alpha0.25. Uses last300 same-season prior nonpush contexts and requires100 each class; plus-one rank formula. Temporal drift prevents claiming a formal exchangeability guarantee.
- **Month bootstrap:** same equal-weight score, fixed confidence bins and completed prior months. At least60 prior nonpush cases, three represented months and ten cases in every represented month;1000 whole-month resamples and lower5th percentile >=0.75. This is a predeclared conservative reliability screen, not a guarantee of calibrated coverage.

Original gates remain accuracy>=75%,n>=60,at least5 selected months,worst-month>=65%. Before outcomes, this block additionally operationalized robustness as minimum selected-month n>=10, every leave-one-month-out accuracy>=75%, top-two-month selection share<=50%, and two-sided95% Wilson lower>=75%. These are **new conservative operational definitions**, not user-supplied numbers or retrospective changes to old gates. They only tighten admission. Beta(1,1) equal-tailed95% lower is also reported. Both bounds are descriptive Bernoulli approximations under dependent repeated historical development.

LOMO means excluding each month from already-frozen rolling decisions. It is an influence diagnostic, **not a retrained fold**, and is never used to choose a selector. Zero-selection eligible months stay in the artifact. Coverage denominator is the3,319 common model-available contexts, including calibration abstentions; it is not a smaller post-calibration denominator.

## Results

| Rule | Selected | n | W-L-P | Accuracy | Coverage | Worst month | Min month n | Months | Min LOMO | Wilson lower | Beta lower | Top2 share |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Consensus |57|52|44-8-5|84.62%|1.7174%|75.00%|1|6|82.98%|72.48%|72.41%|54.39%|
| Conformal |3|3|2-1-0|66.67%|0.0904%|66.67%|3|1|Undefined|20.77%|19.41%|100%|
| Month bootstrap |0|0|0-0-0|Undefined|0%|Undefined|Undefined|0|Undefined|Undefined|Undefined|Undefined|

Consensus baseline on the same selected nonpush cohort is69.23%,lift+15.38pp; eligible baseline52.76%. Conformal selected baseline66.67%,lift0. Bootstrap selected baseline/lift undefined. The baselines are prior league modal sides, not sportsbook favorites.

Consensus fails the original n>=60 gate, plus minimum-month n, confidence-bound and concentration requirements. It is preserved as the strongest evidence, not rescued. Conformal fails accuracy,n and represented-month gates. Bootstrap provides no selected sample. **None passes all historical gates.**

| Consensus month | W/n | Pushes | Accuracy | Accuracy excluding this month |
|---|---|---:|---:|---:|
|2025-05|9/12|2|75.00%|35/40=87.50%|
|2025-06|6/7|1|85.71%|38/45=84.44%|
|2025-07|5/5|0|100.00%|39/47=82.98%|
|2025-08|13/15|2|86.67%|31/37=83.78%|
|2025-09|10/12|0|83.33%|34/40=85.00%|
|2026-05|1/1|0|100.00%|43/51=84.31%|
|2026-06|0/0|0|Undefined|44/52=84.62%|
|2026-07|0/0|0|Undefined|44/52=84.62%|
|2026-08|0/0|0|Undefined|44/52=84.62%|
|2026-09|0/0|0|Undefined|44/52=84.62%|

Conformal selects only2025-09 (2/3), so removing that month leaves no sample; excluding any other eligible month retains2/3. Bootstrap has no selected months and every month-deletion accuracy is undefined. Full monthly eligible counts and all metric numerators are in the JSON. A reporting-only companion `mlb_f7_stability_metrics_audit_v1.json` explicitly expands the frozen selected-month LOMO output to every eligible month, including empty ones; it binds the original full artifact hash and does not change predictions or gates.

2026-07 was **not removed**:371 common eligible games are evaluated and none meets the new frozen consensus. This does not replace the original hierarchical0/1 result. Consensus's56/57 selections in2025 and only1 in2026 further limit generalizability. Absence of poor selected months is not proof of stable coverage across seasons.

## Saturation decision and follow-through

Multiple independent outcome-model families plus three distinct uncertainty/consensus rules have now been evaluated. Point estimates above75% still lack sample size, month support or sufficiently strong uncertainty bounds. Further marginal variants are not justified without new admissible information. The saturation status is temporary research prioritization, **not mathematical exhaustion**. Do not change confidence, remove months, add retrospective picks or reopen a failed source model.

Next market: **F5 ML**. Its prior second-pass CatBoost43/64=67.1875% and newer hierarchical23/34=67.65% remain below target; the latter is too small and unstable. F5 has exact certified period outcomes without needing missing exact lines. The next permitted mechanism is a separately frozen opponent-adjusted offense/defense negative-binomial count model, not a reused F7 consensus or retuned F5 source candidate.

Reproduce with `node scripts/research/evaluate_mlb_f7_stability_block_v1.mjs`. Artifacts: `artifacts/research/mlb_f7_stability_block_v1.json` and `.json.gz`; complete probabilities, selection reasons, calibration support, source hashes, monthly/LOMO and bounds retained. Seven tests cover date isolation, season reset, join guards, analytic interval values, exact conformal ranks, all-artifact replay and independent LOMO recounts. External closed, lineup blocker maintained, no provider calls or Odds API credits, no tracker/Official Picks/APOSTAR/production changes.


## Validation and boundaries

59 combined offline tests PASS. Both completed modules were followed by successful npm.cmd run build (exit0,400 pages, CI placeholders). Canonical Supabase readback restricted to development dates confirms2,418 F7 games in2025 and2,255 in2026, all research-only; last2026 date2026-09-14. Temporary F5 exporter HTTP GET returns410 GONE; none opened. Main remains c8aac466. No changes to src, Supabase schema/data, prior frozen models, tracker, Official Picks, APOSTAR or production.
