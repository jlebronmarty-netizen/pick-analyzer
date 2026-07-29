# Training Priority Matrix

Date: 2026-07-29

Status: ANALYSIS ONLY

No model training. No production mutation.

## Priorities

| Priority | Work | Why |
| --- | --- | --- |
| P0 | Do not train before 1,000+ accepted rows | Current 419-row sample is too small and one-month concentrated. |
| P1 | Continue MLB evidence growth | MLB is the only sport with accepted rows. |
| P1 | Add row-level leakage audit before dataset freeze | Feature inventory includes model-output and context fields that must be excluded or proven safe. |
| P1 | Build future frozen dataset manifest | Required before any training run. |
| P2 | Reach 300+ rows per MLB market | Needed before per-market models or calibration claims. |
| P2 | Prospective shadow reporting | Needed before promotion. |
| P3 | Gradient-boosted challenger | Useful after 2,000+ rows. |
| P4 | Ensembles, stacking, AutoML | Only after multi-season and 5,000+ sample evidence. |

## Minimum Samples

- Current: 419
- Architecture/design review: met
- First training candidate: 1,000+
- Per-market candidate: 300+ per market
- Tree challenger: 2,000+
- Neural/stacking research: 5,000+

## Expected Gains

At 419, expected gains are not reliable. At 1,000, calibration can be tested in shadow. At 2,000, nonlinear challengers may produce modest lift if feature signal holds. At 5,000, ensemble and meta-model strategies become plausible.
