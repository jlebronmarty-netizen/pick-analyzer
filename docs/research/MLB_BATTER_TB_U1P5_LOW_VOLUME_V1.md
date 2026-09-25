# MLB Batter Total Bases U1.5 — Low-Volume Architecture V1

Status: **RESEARCH-ONLY / FORWARD-SHADOW**

## Why this is a new architecture

The prior Total Bases U1.5 rule `projection <= 1.20` is frozen as an external failure at 74.77% and is not retuned here.

This model uses a different signal: **strict-prior role volume**.

Exact contract:
- market: `batter_total_bases`
- line: **1.5**
- side: **UNDER**
- rule: **prior PA/game <= 3.50**
- minimum strict-prior games: 10

`prior PA/game = sum plate appearances from games with source_game_date < target_game_date / count of those prior games`.

Same-date history is excluded. Game 1 of a doubleheader never enters Game 2.

## Frozen development protocol

Only 2025 was visible while choosing the cutoff.

Grid: 2.50 through 4.50 in 0.05 steps.

Gate:
- n >= 60
- accuracy >= 75%
- lift >= 5 pp
- >=5 months
- worst month >=65%

Champion policy: maximize selected n among passing rules, then accuracy, then lower cutoff.

The maximum-coverage passing rule was frozen at **3.50** before opening 2026.

## 2025 development

- eligible: 37,744
- baseline U1.5: 66.55%
- selected: 9,813
- wins: 7,406
- accuracy: **75.47%**
- lift: **+8.92 pp**
- worst month: **74.27%**

## 2026 untouched external

No cutoff changes were made after opening 2026.

- baseline: 25,310 / 37,183 = **68.07%**
- selected: 12,142
- wins: 9,145
- accuracy: **75.32%**
- lift: **+7.25 pp**
- worst month: **72.69%**

State: `EXTERNAL_75_PLUS_STABLE_PASS`.

## Market-first value on 2026-09-25

The exact sportsbook surface U1.5 had:
- 147 unique market/player/book rows
- 56 player-game targets

Two player-games crossed the frozen rule before their games:
- Carlos Jorge U1.5 Total Bases — Caesars -195 — prior PA/game 2.769
- Hao-Yu Lee U1.5 Total Bases — BetMGM -185 — prior PA/game 3.302

These are research shadow candidates, not Official Picks. No EV is calculated because this rule does not expose a calibrated per-play probability.

## Coverage impact

Against the current coverage-board denominator:
- row coverage: **8.72% -> 9.99%** (+1.27 pp)
- surface coverage: **9.09% -> 10.10%** (+1.01 pp)

Coverage means exact contract compatibility, not that every quote becomes a play.

## Boundaries

- no retuning of the failed `projection <=1.20` architecture
- exact U1.5 UNDER only
- strict `source_game_date < target_game_date`
- no same-day doubleheader leakage
- no line extrapolation
- no side substitution
- no fuzzy identity
- no historical Odds API spend
- no Official Picks
- APOSTAR disabled
- tracker unchanged
