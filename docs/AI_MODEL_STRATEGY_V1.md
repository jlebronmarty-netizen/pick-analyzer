# AI Model Strategy V1

Date: 2026-07-29

Status: ANALYSIS ONLY

No model training. No production mutation.

## Recommendation

The best future AI strategy is an MLB-first champion/challenger program using a regularized logistic regression baseline after the dataset reaches 1,000+ accepted rows. Pick Analyzer should pool MLB moneyline, spread/runline and total markets at first, then split by market only after each market reaches at least 300 accepted samples.

Current state:

- Training-ready rows: 419
- Target for first controlled candidate training: 1,000+
- Accepted MLB moneyline rows: 139
- Accepted MLB spread/runline rows: 140
- Accepted MLB total rows: 140
- No model has ever been trained.

## Best Architecture

1. Keep current production prediction engine unchanged.
2. Freeze a future dataset manifest after 1,000+ accepted rows.
3. Train a regularized logistic challenger offline only after explicit approval.
4. Evaluate walk-forward Brier score, calibration, log loss and market-sliced performance.
5. Run the candidate as shadow-only.
6. Promote only after governance approval and rollback readiness.

No global ensemble is justified yet. No neural network, stacking or reinforcement learning is justified at current sample size.

## Sport Strategy

MLB is the only sport with accepted training evidence. NBA, NFL, NHL, Soccer and BSN remain blocked until accepted production-settled samples exist.

## Market Strategy

Moneyline, spread/runline and totals should be pooled initially because each has fewer than 300 accepted samples. Per-market models become reviewable only when each market has enough accepted samples to survive walk-forward validation.

## Business Impact

Near-term business impact comes from better transparency, not model replacement. Expected model lift is low and unstable below 1,000 rows. At 1,000 rows, a shadow-only regularized baseline can test calibration improvement. At 2,000+ rows, gradient-boosted challengers become reasonable. At 5,000+ rows, ensemble and meta-model research becomes safer.

## Evidence

Machine-readable evidence: `docs/AI_MODEL_STRATEGY_V1.json`.
