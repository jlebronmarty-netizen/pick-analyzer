# Most Likely Model Ranking V1

Most Likely is a probability-ranking product, not an Official Pick product.

It can read:

- Current Board rows when valid market-backed candidates exist.
- Stored `prediction_history` model probabilities when market odds are absent.
- Stored pitcher-outs shadows from `universal_projection_history`.

It never promotes a row to Official Pick and never computes EV without market odds.

