# MLB Market-First Real Candidate Research V1

Status: RESEARCH-ONLY / SHADOW-ONLY

## Objective

Stop optimizing primarily for historical accuracy on markets that are rarely offered. From this point, candidate development prioritizes contracts that are both:

1. historically predictive under frozen rules; and
2. repeatedly offered pregame by real sportsbooks at the exact line/side.

No candidate becomes a real-bet shadow candidate from accuracy alone.

## Required pipeline

`MODEL_QUALIFIES -> EXACT_MARKET_EXISTS -> EXACT_IDENTITY -> STRICT_PREGAME_LINEAGE -> PRICE_AVAILABLE -> PRICE_EDGE_CHECK_IF_AVAILABLE -> FORWARD_EVIDENCE -> REAL_BET_CANDIDATE_SHADOW`

If a model has no legitimate per-play probability, price is collected but EV is not claimed. Historical accuracy is not substituted for a calibrated probability.

## Current priorities

### 1. Pitcher Record a Win — NO

Frozen model: `pitcher_win_forward_numeric_p015_v1`.

Historical rolling OOF: 128/147 = 87.07%.

Prospective model selections already observed from Sep20-Sep21: 6/6 wins.

However only one persisted selection had an exact real NO quote:
- DJ Herz NO, DraftKings -830.
- model P(NO) = 88.05%.
- market implied probability ≈ 89.25%.
- result: WIN, but price gate = NO_PRICE_EDGE.

This is the clearest example of why accuracy and bettable value must be separated.

### 2. Pitcher Earned Runs — O1.5

Frozen event accuracy: 80.22%.

Market availability is strong: O1.5 has been repeatedly captured across multiple books.

Primary blocker is not market availability; it is target-day runtime input coverage. The strict pitcher daily feature table had:
- Sep20: 1 game;
- Sep21: 2 games;
- Sep22: 14 games;
- Sep23: 0 rows at audit time.

When target rows exist, k_rate is populated. Therefore the next operational task is to repair full-slate target-day feature materialization without changing the ER model.

### 3. Pitcher Strikeouts — O3.5

Frozen line-surface rule:
- exact line: 3.5
- side: OVER
- projection >=4.25

2025: 1771/2332 = 75.94%.
2026 diagnostic: 1741/2290 = 76.03%.
Lift remains >5pp.

The exact 3.5 line is repeatedly offered by major books. This candidate moves to untouched forward validation. O4.5/O5.5 remain frozen as stability failures; no threshold rescue.

### 4. Pitcher Outs — O14.5

Frozen line-surface rule:
- exact line: 14.5
- side: OVER
- projection >=15.75

2025: 1550/2010 = 77.11%.
2026 diagnostic: 1430/1811 = 78.96%.
One observed exact-line crossing (Nick Martinez O14.5 -189) settled WIN.

This remains forward-validation-required; the one observed win does not certify it.

## Market-availability observations

The market audit shows that common real lines differ from many historically certified contracts. High-frequency examples include:
- Pitcher K 3.5/4.5/5.5
- Pitcher Outs 14.5/15.5/17.5
- Pitcher ER 1.5/2.5/3.5
- Batter Hits 0.5/1.5
- Batter Total Bases 0.5/1.5/2.5/3.5
- Batter Walks 0.5
- Batter Doubles 0.5

Research must not invent a rule for a liquid line after inspecting future outcomes. Existing failed line-surface results remain frozen.

## Price discipline

American-odds implied probability:
- negative odds: `abs(odds)/(abs(odds)+100)`
- positive odds: `100/(odds+100)`

A candidate with a legitimate per-play model probability passes the initial price gate only if model probability exceeds implied probability. This is a model-edge screen, not yet certified EV or ROI.

If no per-play probability exists, the system records:
- sportsbook
- exact line/side
- price
- result

but does not calculate EV from historical accuracy.

## Boundaries

- research/shadow only
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- no historical Odds API spend
- no line extrapolation
- no threshold rescue
- no forward-result retuning
- canonical MLB market tracker remains unchanged
