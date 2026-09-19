# MLB First 1 Inning NRFI — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f1_nrfi_both_starters_scoreless_0p80_v1`

## Target certification

NRFI = no runs scored through inning 1, from Statcast end-of-inning score.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,428
- one-run mismatches excluded fail-closed: 2
- exact-match rate: 99.92%

## Frozen rule

Select **NRFI** only when:

- both expected starters have at least 5 prior starts;
- home starter prior first-inning scoreless rate >= **80%**;
- away starter prior first-inning scoreless rate >= **80%**.

Exact team aliases used for starter-team mapping:

- AZ -> ARI
- CWS -> CHW

No fuzzy identity matching.

A team-offense filter was tested but was redundant: thresholds 0.45–0.55 produced exactly the same 108 selected games. It is therefore omitted from the frozen rule.

## 2025 evidence

- 58 / 108 = **53.70%**
- baseline NRFI = **50.96%**
- lift = **+2.75 percentage points**
- worst month = **36.84%**
- minimum monthly n = 17

Monthly:
- May: 17/26 = 65.38%
- Jun: 11/24 = 45.83%
- Jul: 10/17 = 58.82%
- Aug: 13/22 = 59.09%
- Sep: 7/19 = 36.84%

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No historical First 1 pricing is certified in the current corpus.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_TO_2026_ONE_SHOT`.

- eligible starter-qualified rows: 892
- baseline NRFI: **51.57%**
- selected: 130
- correct: 68
- accuracy: **52.31%**
- selection coverage: **14.57%**
- lift vs baseline: **+0.74 percentage points**
- worst selected month: **25.00%** on n=4 in September
- retuned after external result: **NO**

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version with 2026-driven starter scoreless thresholds.
