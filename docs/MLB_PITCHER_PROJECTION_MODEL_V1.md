# MLB Pitcher Projection Model V1

Status: PARTIAL

This model answers one primary question: expected recorded outs for a grounded probable or confirmed MLB starting pitcher.

## Scope

- Projection only
- No sportsbook line comparison
- No EV, edge, Kelly, stake, Best Value, Official Pick, or Portfolio output
- Recommendation status is always `MODEL_PROJECTION_ONLY`

## Required Evidence

Numeric projections require:

- mapped pitcher ID
- mapped event ID
- starter status other than `UNVERIFIED`
- at least 3 historical starter logs
- recorded outs history
- recent workload evidence
- opponent team mapping
- zero invalid feature timestamp counters

Missing evidence blocks numeric projection and returns explicit blockers. Missing values are rendered as `N/A`, never synthetic zeroes.

## Formula

Projected outs is a transparent weighted baseline:

`0.55 * season_average_outs + 0.35 * weighted_recent_outs + 0.10 * season_median_outs + adjustments`

Adjustments:

- workload trend: bounded to +/- 1.5 outs, weighted 0.35
- pitch-efficiency trend: bounded to +/- 0.75 outs
- rest: short rest penalty, normal rest small positive context
- starter certainty: confirmed small positive, probable neutral, expected negative
- volatility: high standard deviation reduces expectation

Output bounds:

- Expected outs: 3 to 24 for numeric projections
- Distribution support: integer outs 0 through 27

## Secondary Projections

- Projected innings: outs / 3
- Pitch count: historical pitches per inning times projected innings, bounded 35 to 120 when available
- Strikeouts: projected batters faced times historical strikeout rate
- Hits allowed: WHIP and walk-rate proxy
- Earned runs: ERA proxy times projected innings

Each secondary field has independent availability: `AVAILABLE`, `LIMITED`, or `UNAVAILABLE`.

## Probability Distribution

The V1 distribution is a discrete normal-shaped distribution over integer outs 0..27.

- Mean: projected outs
- Standard deviation: historical outs volatility, widened by lower quality
- Probabilities are normalized to sum to approximately 1
- No negative probabilities
- No push probability is exposed for half-out lines

Supported thresholds:

- Over/Under 14.5
- Over/Under 15.5
- Over/Under 16.5
- Over/Under 17.5
- Over/Under 18.5

For every line: `P(Over) + P(Under) ~= 1`.

## Confidence

Confidence is distinct from any over probability. It is based on:

- starter confirmation
- sample size
- recency
- workload stability
- feature completeness
- matchup completeness
- role certainty
- historical volatility
- data freshness

Levels: `HIGH`, `MODERATE`, `LOW`, `INSUFFICIENT`.
