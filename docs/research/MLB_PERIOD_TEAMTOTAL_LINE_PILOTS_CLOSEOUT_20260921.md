# MLB Period / Team-Total Historical Line Pilots — 2026-09-21 Closeout

State: `RESEARCH_ONLY_NO_PROMOTION`

## Scope

This closeout records two bounded The Odds API historical pilots executed at T-60 minutes on eight 2025 MLB games across May and August.

No Official Pick, APOSTAR state, production model, frozen threshold, or Supabase market row was changed.

## Provider budget

### Standard period-spread pilot

Markets:

- `spreads_1st_3_innings`
- `spreads_1st_5_innings`
- `spreads_1st_7_innings`

Observed:

- provider calls: **10**
- observed credits: **242**
- requests remaining after: **2,658**
- DB writes: **0**

### Period-total / team-total pilot

Markets:

- `totals_1st_3_innings`
- `totals_1st_5_innings`
- `totals_1st_7_innings`
- `team_totals`
- `alternate_team_totals`

Observed:

- provider calls: **10**
- observed credits: **402**
- requests remaining after: **2,255**
- DB writes: **0**

Project reserve remains **2,000**. No further historical Odds API acquisition is authorized by this closeout because only 255 credits remain above reserve.

## Market characterization

### First 5 Innings Spread — strongest spread surface

Across the eight games:

- T-60 book coverage: **5–6 books per game**;
- the dominant standard line was usually **±0.5**;
- however the line is **not fixed**:
  - one sampled game included -0.5/+0.5, -1/+1 and -1.5/+1.5 across books;
  - therefore a fixed ±0.5 historical reconstruction would violate the exact-line contract.

Disposition:

`HISTORICAL_LINE_CONFIRMED_DEEP_ACQUISITION_REQUIRED`

This is the highest-priority period spread family for any future large real-line corpus.

### First 3 Innings Spread

Observed T-60 coverage:

- only **1–2 books per game**;
- points included 0, ±0.5 and ±1.5.

Disposition:

`HISTORICAL_LINE_CONFIRMED_COVERAGE_THIN`

Do not spend the current Odds API reserve on broad F3 spread acquisition.

### First 7 Innings Spread

Observed T-60 coverage:

- only **1 book per game**;
- points included 0, ±0.5, ±1 and ±1.5.

Disposition:

`HISTORICAL_LINE_CONFIRMED_COVERAGE_THIN`

Do not spend the current Odds API reserve on broad F7 spread acquisition.

### First 5 Innings Total — strongest period-total surface

Observed T-60 coverage:

- **5–6 books per game**;
- sampled points ranged from **3.5 to 5.5**;
- multiple books sometimes disagreed by 0.5 runs.

This confirms the prior 4.5 research reference line cannot be treated as historical sportsbook truth.

The already-frozen reference model `f5_total_over_ref4p5_proj5p0_v1` was additionally reconstructed on the eight sampled games using its frozen prior-team-F5-form formula:

- projection >=5.0 qualified only two sampled games;
- both OVER calls lost at the actual sampled market line;
- diagnostic result: **0/2**;
- a non-frozen line-aware diagnostic using projection minus actual line >=0.5 produced one non-push loss plus one push.

This tiny diagnostic is not a certification sample. It is sufficient only to say that there is no evidence here supporting additional Odds API spend to rescue the existing F5 Total formula.

Disposition:

`REAL_LINE_AVAILABLE_EXISTING_MODEL_NOT_PROMISING_NO_THRESHOLD_RESCUE`

### First 3 Innings Total

Observed T-60 coverage:

- **1–2 books per game**;
- 2.5 dominated the sample, with 1.5 also observed.

Disposition:

`HISTORICAL_LINE_CONFIRMED_COVERAGE_THIN`

### First 7 Innings Total

Observed T-60 coverage:

- **1 book per game**;
- sampled points included 5.5, 6.5 and 7.5.

Disposition:

`HISTORICAL_LINE_CONFIRMED_COVERAGE_THIN`

### Team Totals

Observed T-60 coverage:

- **5–6 books per game**;
- both teams were identified explicitly;
- main points varied by team/game;
- providers sometimes returned additional nearby team-total points in the same market response.

Disposition:

`HISTORICAL_LINE_CONFIRMED_NEW_MODEL_REQUIRED`

Team Totals are a viable future research family, but there is no certified team-total model yet. Do not infer a fixed 3.5/4.5/5.5 line.

### Alternate Team Totals

Observed T-60 coverage:

- **4 books per game**;
- dense ladders from approximately 0.5 through 9.5 depending on team/book.

Disposition:

`HISTORICAL_LINE_CONFIRMED_HIGH_DIMENSIONAL`

The market is real and deep but too expensive/high-dimensional for the remaining historical API budget.

## Priority after pilots

1. **F5 Spread** — best combination of market depth and already-certified F5 outcome surface; requires a materially new spread/margin architecture plus a larger real-line corpus.
2. **Team Totals** — excellent book coverage and reconstructable team scoring outcomes; requires a new team-total model and larger real-line corpus.
3. **F5 Total** — real lines are available, but the current frozen model remains far below target and the exact-line mini-diagnostic did not improve the case for further spend.
4. **F3/F7 spreads and totals** — preserve as confirmed but thin historical coverage.
5. **Alternate Team Totals** — preserve as confirmed/high-dimensional; defer until a larger data budget/source exists.

## Current external-data blockers

- The Odds API: operational, but only **2,255** requests remained after the second pilot and the project reserve is **2,000**.
- BALLDONTLIE GOAT: subscription exists, but `BALLDONTLIE_API_KEY` is **not configured in Vercel**; verified safely with zero provider calls.
- No complete free/versioned 2025 F5 real-line corpus was found in the public-source audit.
- A commercial Pinnacle F5 totals corpus exists, but purchasing external data requires separate user authorization.

## Safety

- Official Picks writes: **0**
- APOSTAR activation: **false**
- production model promotion: **none**
- tracker modification: **none**
- retrospective recommendation backfill: **none**
