# MLB Period & Team Total Historical Line Coverage Audit — 2026-09-19

Status: RESEARCH-ONLY

## Purpose

Document which supported MLB markets require a historical sportsbook point/line before a valid market backtest can be performed.

This audit does not spend Odds API credits and does not authorize Official Picks, APOSTAR, production promotion, ROI, EV or CLV claims.

## Current internal snapshot coverage

The canonical `public.sports_odds_snapshots` corpus was queried for the exact supported market keys below.

Result: **0 stored rows** for every listed market.

### Full-game additional line-dependent markets

- `alternate_spreads`
- `alternate_totals`
- `team_totals`
- `alternate_team_totals`

### Full-game 3-way

- `h2h_3_way`

No internal snapshots are stored for this key. The generic market definition includes a draw outcome, but the MLB settlement window for a full-game draw is not frozen in the project contract. Do not assume regulation/9-inning settlement.

### 1st inning

- `spreads_1st_1_innings`
- `alternate_spreads_1st_1_innings`
- `totals_1st_1_innings`
- `alternate_totals_1st_1_innings`

### 1st 3 innings

- `spreads_1st_3_innings`
- `alternate_spreads_1st_3_innings`
- `totals_1st_3_innings`
- `alternate_totals_1st_3_innings`

### 1st 5 innings

- `spreads_1st_5_innings`
- `alternate_spreads_1st_5_innings`
- `totals_1st_5_innings`
- `alternate_totals_1st_5_innings`

### 1st 7 innings

- `spreads_1st_7_innings`
- `alternate_spreads_1st_7_innings`
- `totals_1st_7_innings`
- `alternate_totals_1st_7_innings`

The Odds API currently documents all of these period spread/total markets as supported baseball markets, plus full-game `team_totals` / `alternate_team_totals`.

## Gate

### Period spreads

State:

`BLOCKED_HISTORICAL_LINE_COVERAGE`

A period spread outcome cannot be evaluated without the historical handicap point.

Do not assume:

- ±0.5;
- ±1.0;
- ±1.5;
- a current line;
- a modal line;
- an alternate line.

Any such substitution would change the actual bet outcome and invalidate market accuracy.

This applies to:

- 1st 1 inning spread;
- 1st 3 innings spread;
- 1st 5 innings spread;
- 1st 7 innings spread;
- all corresponding alternate spreads.

### Period totals

State:

`REFERENCE_LINE_RESEARCH_ONLY / BLOCKED_HISTORICAL_LINE_COVERAGE`

Research reference-line studies were allowed only to test whether the underlying period-total signal exists:

- F3 reference 2.5;
- F5 reference 4.5;
- F7 reference 6.5;
- F1 under/over 0.5 outcome family represented by NRFI/YRFI research.

These reference points are **not** claimed to be the historical sportsbook line for every game.

Therefore:

- reference-line event accuracy may be retained as diagnostic evidence;
- sportsbook market accuracy, ROI, EV and CLV are not certified;
- standard and alternate period totals remain blocked for price/line-aware evaluation until exact historical points are available.

### Full-game alternate spreads / alternate totals

State:

`BLOCKED_HISTORICAL_LINE_COVERAGE`

The base full-game score target is available, but alternate spread/total outcomes depend on the exact historical point. No internal snapshots exist for `alternate_spreads` or `alternate_totals`.

Do not derive alternate points from the standard Run Line / Total or from current odds.

### Team totals

State:

`BLOCKED_HISTORICAL_LINE_COVERAGE`

Team total outcomes can be reconstructed from game scores, but a sportsbook team-total market cannot be backtested without the historical team-specific point.

Do not substitute a fixed 3.5 / 4.5 / 5.5 line.

This applies to both:

- `team_totals`;
- `alternate_team_totals`.

### Full-game 3-way moneyline

State:

`BLOCKED_SETTLEMENT_SEMANTICS`

The generic `h2h_3_way` market includes a draw outcome, but the project has no stored MLB examples and no frozen settlement contract defining the full-game draw window. MLB standard moneyline includes extra innings and normally has no draw, so the 3-way target must not be inferred from ordinary final winner data.

Unblock only after a real MLB `h2h_3_way` market sample or bookmaker settlement contract is captured and the regulation window is frozen.

## Relationship to existing period research

Line-free period outcomes remain valid research families:

- 2-way period Moneyline;
- 3-way period Moneyline;
- NRFI/YRFI event outcome.

Line-dependent period spreads/totals are a separate pricing/point layer.

Alternate period markets reuse the same underlying period score outcome and should not create a new outcome model. Once exact historical lines exist, evaluate them as a line-specific layer over the frozen period outcome model.

## Future unblock

The Odds API documents historical additional-market availability from 2023 onward.

Per project rules, do **not** spend historical Odds API credits automatically.

Unblock only after:

1. existing local / Supabase / archived coverage is exhausted;
2. exact event identity and timestamp requirements are frozen;
3. the user explicitly authorizes historical credit spend.

Historical Odds API credits consumed by this audit: **0**.
Official Picks writes: **0**.
APOSTAR activation: **false**.
Production promotion: **false**.
