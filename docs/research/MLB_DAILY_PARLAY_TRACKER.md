# MLB Daily Full-Slate ML Parlay Tracker

Research-only. Moneyline only. Official Picks unchanged. APOSTAR disabled.

| Date | Slate games | Legs per ticket | Outcome space | Target tickets | Frozen | Stake | Winning ticket in portfolio? | Gross return | Net P/L | ROI | Status | Freeze digest |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| 2026-09-27 | 15 | 15 | 32,768 | 1,000 | 1,000 | $1,000 | PENDING | PENDING | PENDING | PENDING | FROZEN_PRE_SETTLEMENT_ML_ONLY | `014e6177b7dd5ba3753633ad1252841d60160e15f1cd76b869e9fd606c9d3007` |

## Day 1 — 2026-09-27

This row supersedes the earlier incorrect mixed-market 3-5 leg draft. That portfolio is INVALIDATED and must never be settled or included in experiment statistics.

Correct experiment:
- market: Moneyline only;
- 15 MLB games;
- every ticket: exactly 15 legs, one ML per game;
- binary outcome space: 32,768;
- frozen portfolio: top 1,000 unique complete-slate combinations;
- paper stake: $1 each = $1,000 total;
- primary preserved price source: FanDuel pregame ML;
- 12 matchups use canonical internal pregame FanDuel capture;
- NYM-WSH, BAL-NYY and ARI-SD use preserved FanDuel Research pregame lines because canonical internal FanDuel mapping was absent for those matchups at freeze;
- MLB Outcome + Portfolio Engine V1 default frozen architecture used for ranking;
- external probability input: numberFire pregame probability where available on the same FanDuel Research slate page; TB-PHI had no extracted numberFire probability and therefore external residual = 0 for that game;
- no live scores or final results used;
- Pick Analyzer selective gate is not converted to a per-game probability.

Portfolio summary:
- modeled probability mass covered by top 1,000: 13.3851% under the development slate-regime model;
- average estimated payout for $1 ticket: $11,340.83;
- minimum estimated payout among frozen tickets: $2,011.40;
- maximum estimated payout among frozen tickets: $308,229.28;
- average upset count in frozen tickets: 4.118;
- exact freeze digest: `014e6177b7dd5ba3753633ad1252841d60160e15f1cd76b869e9fd606c9d3007`.

These are development/paper estimates, not guaranteed probabilities or returns.
