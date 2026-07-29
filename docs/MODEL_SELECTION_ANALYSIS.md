# Model Selection Analysis

Date: 2026-07-29

Status: ANALYSIS ONLY

No model training. No production mutation.

## Model Ranking

1. No production training now.
2. Regularized Logistic Regression as the first future champion candidate.
3. Gradient boosted trees as future challengers after 2,000+ accepted rows.
4. Bayesian calibration or uncertainty layers after baseline validation.
5. Neural networks, stacking and blending only after 5,000+ rows and multi-season coverage.

## Suitability

| Model | Current Suitability |
| --- | --- |
| Logistic Regression | Best first candidate after 1,000+ rows because it is interpretable and stable with limited data. |
| Random Forest | Future challenger; overfit risk at 1,000 rows. |
| XGBoost | Strong future challenger after 2,000+ rows and leakage audit. |
| LightGBM | Similar to XGBoost; useful if feature count grows materially. |
| CatBoost | Useful if categorical feature inventory expands. |
| Neural Networks | Not justified before 5,000+ samples and multi-season coverage. |
| Bayesian Models | Useful for uncertainty and calibration, not first production replacement. |
| Ensembles | Future V3 after multiple validated base learners. |
| Stacking | Future V4 only; sample hungry and governance-heavy. |
| Blending | Future V3/V4 after shadow validation. |

## Best Candidate By Sport

| Sport | Strategy |
| --- | --- |
| MLB | Regularized logistic regression shadow-only after 1,000+ accepted rows. |
| NBA | Blocked until accepted production-settled rows exist. |
| NFL | Blocked until preview rows settle and pass training contract review. |
| NHL | Blocked until preview rows settle and pass training contract review. |
| Soccer | Blocked until production lifecycle evidence exists. |
| BSN | Blocked until production lifecycle evidence exists. |

No current sport is approved for training.
