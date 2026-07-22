# Pitcher Outs Shadow Model V1

The V1 pitcher recorded-outs model is transparent and deterministic.

## Method

The model uses an empirical pitcher-start distribution with recency weighting and small league shrinkage:

- historical eligible starts establish the distribution
- recent starts influence expected outs
- league shrinkage stabilizes small samples
- probabilities are empirical threshold hit rates

## Outputs

- expected recorded outs
- median recorded outs
- prediction interval
- uncertainty
- probabilities for 15+, 16+, 17+, 18+, 19+, 20+ and 21+
- feature quality
- data sufficiency
- starter status
- explanation

Probabilities must be monotonic. Outputs are `SHADOW` and `NO_MARKET`.
