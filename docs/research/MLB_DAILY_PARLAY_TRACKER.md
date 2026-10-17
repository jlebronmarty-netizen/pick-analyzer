# MLB Daily Full-Slate ML Parlay Tracker

Research-only. Moneyline only. Official Picks unchanged. APOSTAR disabled.

| Date | Slate games | Settled games | Void games | Legs per ticket | Outcome space | Target tickets | Frozen | Stake | Winning ticket in portfolio? | Winning rank | Gross return | Net P/L | ROI | Status | Freeze digest |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|
| 2026-09-27 | 15 | 14 | 1 | 15 pregame / 14 settled | 32,768 pregame | 1,000 | 1,000 | $1,000 | YES | 614 | $2,564.72 | +$1,564.72 | +156.47% | SETTLED_WIN | `014e6177b7dd5ba3753633ad1252841d60160e15f1cd76b869e9fd606c9d3007` |

## Day 1 — 2026-09-27

This row supersedes the earlier incorrect mixed-market 3-5 leg draft. That portfolio is INVALIDATED and must never be settled or included in experiment statistics.

Correct experiment:
- market: Moneyline only;
- 15 scheduled MLB games;
- every frozen ticket: exactly 15 ML legs, one per game;
- BAL-NYY was cancelled and therefore settled as a void leg;
- 14 game results determined the winning outcome;
- binary pregame outcome space: 32,768;
- frozen portfolio: top 1,000 unique complete-slate combinations;
- paper stake: $1 each = $1,000 total;
- exact winning 14-game result pattern was covered by frozen ticket rank 614;
- rank 614 carried NYY on the cancelled game, so its NYY ML leg was removed from payout;
- equivalent BAL version ranked 1,025 and was outside the top 1,000, but cancellation made that distinction irrelevant to the settled 14-game outcome;
- rank 614 original 15-leg listed payout: 4,666.943988x;
- cancelled NYY ML (-122) decimal factor: 1.819672131x;
- adjusted settled payout: 2,564.716966x;
- $1 winning ticket gross return: $2,564.72;
- 999 other frozen tickets returned $0 under the all-or-nothing full-slate settlement;
- total portfolio gross return: $2,564.72;
- net profit/loss after $1,000 paper stake: +$1,564.72;
- realized ROI: +156.47%;
- Day 1 investment criterion: YES, gross return exceeded total theoretical stake.

Pregame methodology preserved:
- primary price source: FanDuel pregame ML;
- 12 matchups use canonical internal pregame FanDuel capture;
- NYM-WSH, BAL-NYY and ARI-SD use preserved FanDuel Research pregame lines because canonical internal FanDuel mapping was absent for those matchups at freeze;
- MLB Outcome + Portfolio Engine V1 default frozen architecture used for ranking;
- external probability input: numberFire pregame probability where available on the same FanDuel Research slate page;
- no live scores or final results were used to build or reorder the frozen portfolio.

Exact winning settled sides:
WSH, PHI, CHC, HOU, LAD, TOR, MIA, CWS, MIL, PIT, SD, KC, SEA, MIN.
BAL-NYY: VOID / cancelled.

Freeze digest remains unchanged:
`014e6177b7dd5ba3753633ad1252841d60160e15f1cd76b869e9fd606c9d3007`.
