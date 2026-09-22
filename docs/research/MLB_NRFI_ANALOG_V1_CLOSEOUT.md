# NRFI joint historical analogs V1

Status: RESEARCH ONLY — DEVELOPMENT GATE FAILED; external remains closed.

The contract and evaluator were committed as `e80e265a` before the first real-data evaluation. Contract SHA256: `d15c2f4b3db8dd1c73c35996367320fa0a6ed0d6a67700e564920fa8c19786f7`; evaluator SHA256 at execution: `76aa6a035f192a739cee260d9442d5cf630e16c4c6f66d84a84a9b0966f80495`. Exact-source canonical JSON SHA256: `740ccad6ec6b0a93298165465269435e256e2c81e335f572bf9acc250174f513`.

## Prespecified architecture

This classifier estimates a joint NRFI label from 100 nearest historical games, rather than multiplying half-inning probabilities or fitting Davidson outcome odds. Each half contributes its pitcher's and opposing offense's strictly prior scoreless rates, shrunk toward the prior league rate with strength 20. Lexicographically sorting the two pitcher/offense pairs makes home/away swapping symmetric. Equal Euclidean distances use these four probabilities; historical date and exact game ID resolve ties. The probability is `(NRFI neighbor labels + 1) / 102`.

All neighbors are from the same season and strictly earlier dates. Each neighbor's feature vector was frozen before its own game date. Entire dates are forecast before histories or analog labels update. Initial eligibility requires 300 prior league games, three starts per pitcher, ten games per offense, and 100 eligible prior analogs. Threshold 0.75, sample gate 60, five selected calendar months and worst-month accuracy 65% were unchanged. No grid or post-result adjustment was run.

## Result

| Measure | Result |
|---|---:|
| Certified historical source rows | 4,683 |
| Eligible forecasts | 2,984 |
| Excluded: insufficient entity/league history | 1,495 |
| Excluded: insufficient eligible analogs | 204 |
| Selected | 0 |
| Wins / losses / pushes | 0 / 0 / 0 |
| Accuracy | Not estimable |
| Coverage among eligible / all source | 0% / 0% |
| Selected months | 0 |

The model abstained throughout development. This is a failure of usable selective coverage, not evidence of zero predictive accuracy. No threshold was lowered to obtain selections. All 2,984 forecasts and their 100 neighbor IDs are preserved in `artifacts/research/mlb_nrfi_analog_v1_result.json.gz`; its sibling JSON contains the compact summary and forecast probability range.

## Data quality and limitations

The reused certified `mlb_f1_nrfi_revisit_base_v1` export covers 2025-03-18 through 2026-09-14. It contains exact starter identities, stored team identities, certified F1 outcomes, lineage, prior cutoff and the historical-seen development flag. Only prior-game outcomes form features; current outcomes are settlement labels. No FULL payload, market prices, same-day labels or external games enter forecasts. This is historical seen development, not an independent external validation. Source certification is inherited from the existing export, not a new audit proving historical announcement timestamps for every starter. Symmetry deliberately removes venue direction, and same-season resets reduce early-season coverage. The observed corpus has no weather, confirmed batting-order or pitch-mix feature certificate admitted to this design.

Four tests cover current-date/future-label invariance, strictly earlier unique neighbors and beta arithmetic, home-away symmetry, season reset, invalid source fail-closed behavior, and full-artifact arithmetic. Parent integration runs repository build and CI. Provider calls and historical Odds API credits: zero. No external opening, tracker modification, official writes or production promotion.

Next permitted work requires a materially different mechanism or new certified information. Preserve this failed architecture without changing k, features, smoothing, threshold or gates in response to its result.

Integration validation: sixteen offline tests PASS; npm.cmd run build PASS (exit0, 400 static pages, CI placeholder configuration). Original frozen contract/evaluator preserved.
