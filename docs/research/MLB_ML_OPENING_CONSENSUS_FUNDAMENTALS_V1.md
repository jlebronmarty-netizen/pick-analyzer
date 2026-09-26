# MLB Moneyline Opening Consensus + Fundamentals V1

Status: **RESEARCH-ONLY / FROZEN BEFORE 2026 EXTERNAL**

## Why this is a genuinely new Moneyline family

The prior Moneyline work used internal pregame fundamentals and selective thresholds, but did not have a clean historical 2025 opening-market surface.

The 2025 BALLDONTLIE opening-odds backfill now provides 1,853 canonical games with Moneyline opening evidence.

Before model development, the opening feed was audited for data quality. BetMGM and BetRivers are the only two vendors with zero Moneyline rows where |price| > 1000 across the 2025 backfill. Other vendors contain a small but material tail of extreme values. No attempt is made to rescale or repair those prices.

Therefore this contract uses only BetMGM + BetRivers and requires both books to be present.

## Exact market consensus

For each book:

- negative American odds: `abs(price)/(abs(price)+100)`
- positive American odds: `100/(price+100)`
- no-vig home probability:
  `home_implied / (home_implied + away_implied)`

Consensus home probability is the arithmetic mean of the BetMGM and BetRivers no-vig home probabilities.

Market favorite:
- HOME if consensus home probability >=0.50
- AWAY otherwise

Favorite probability:
`max(home_probability, 1-home_probability)`

## Exact identity

Opening-odds canonical IDs and xyear feature IDs use different namespaces.

The research join is exact and deterministic:

- game date
- normalized home team
- normalized away team
- game number

Allowed aliases only:
- ARI -> AZ
- CHW -> CWS

Readback:
- 1,853 opening-odds games
- 1,853 exact feature matches
- 0 unmatched
- 0 ambiguous
- no fuzzy matching

## Frozen formula

Select the opening Moneyline favorite only when:

1. clean two-book no-vig favorite probability >= **0.65**; and
2. all **6 of 6** pregame fundamentals favor the same side.

The six fundamentals are:

1. season win percentage;
2. run differential per game;
3. Pythagorean win percentage;
4. L5 win percentage;
5. starting pitcher RA9, lower is better;
6. bullpen RA9, lower is better.

Any missing required feature fails closed.

HOME and AWAY are both eligible. The later HOME/AWAY readback is descriptive only and cannot be used to make the formula HOME-only after the fact.

## Bounded 2025 development search

The development search was bounded before external testing:

Market-only:
- 0.60
- 0.65
- 0.70
- 0.75

Market + fundamentals:
- market cut 0.60 / 0.65
- aligned votes 4/6, 5/6, 6/6

Residual family:
- minimum aligned votes 5/6 or 6/6
- residual cuts 0.15 / 0.25

No additional cuts are authorized after 2026 is opened.

## 2025 frozen result

Exact formula:

`opening favorite probability >=0.65 AND fundamentals = 6/6 aligned`

Result:
- 59 / 78
- **75.64% accuracy**
- 5 months
- worst month **66.67%**

Month readback:
- May: 23/29 = 79.31%
- Jun: 10/14 = 71.43%
- Jul: 6/8 = 75.00%
- Aug: 8/12 = 66.67%
- Sep: 12/15 = 80.00%

Market-only at the same 0.65 cut:
- 131/176 = 74.43%

The 6/6 filter therefore adds about +1.21 percentage points over the same opening-probability threshold.

The selected games averaged 69.42% consensus favorite probability and produced 4.855 more wins than the aggregate market expectation. That is descriptive calibration evidence, **not** a per-play EV claim.

Side readback:
- HOME: 49/64 = 76.56%
- AWAY: 10/14 = 71.43%

No side restriction is authorized after seeing this result.

## Rejected related families

Market-only:
- 0.65: 74.43%, below gate
- 0.70: 82.76%, but n=58, below minimum n=60

Market/fundamental residual:
- best bounded result ~65.15%
- FAIL

## External gate

2026 remains sealed.

State:

`FROZEN_2025_GATE_PASS_EXTERNAL_2026_SEALED`

The next valid step is one untouched 2026 external evaluation using the frozen formula and the same clean opening-market lineage.

No threshold, side, vendor set, feature definition or identity rule may change after the 2026 external set is opened.

## Two-book consensus robustness

The frozen formula is not altered, but the 78 selected rows were checked for book dependence:

- average absolute BetMGM vs BetRivers home-probability gap: **1.02 pp**
- maximum gap: **3.26 pp**
- 70/78 selected games were individually >=65% at both books
- 8/78 crossed 65% only after taking the frozen two-book consensus mean
- average favorite probability: BetMGM 69.08%, BetRivers 69.75%

This is descriptive only. The formula remains the two-book consensus mean >=65%; it is not tightened to require both books individually after seeing the result.

## Untouched 2026 external result

The frozen 2025 formula was evaluated once on the independently acquired 2026 opening-market surface with no changes to threshold, side policy, vendors or fundamentals.

Backfill:
- 182/182 dates complete
- 0 failed dates
- 7,464 stored BetMGM/BetRivers rows
- 1,866 canonical games with both books
- 427 BALLDONTLIE provider calls
- 0 historical Odds API calls
- 0 blocked exact vendor-market contracts
- 16 extreme-price rows in the stored external surface
- **0 of the 37 selected games contained an extreme-price row**

Frozen external score:
- 30 / 37 = **81.08%**
- average consensus favorite probability = 67.91%
- wins above aggregate market expectation = +4.874 (descriptive only)
- months = 6
- worst month = **33.33%**

Monthly:
- Apr: 2/4 = 50.00%
- May: 5/5 = 100.00%
- Jun: 1/3 = 33.33%
- Jul: 3/4 = 75.00%
- Aug: 7/8 = 87.50%
- Sep: 12/13 = 92.31%

Side readback:
- HOME: 23/29 = 79.31%
- AWAY: 7/8 = 87.50%

Permanent external gate:
- accuracy >=75%: PASS
- n >=60: **FAIL**
- >=5 months: PASS
- worst month >=65%: **FAIL**

Final state:

`EXTERNAL_ACCURACY_PASS_N_AND_STABILITY_FAIL_NO_RETUNE`

No threshold, vendor, side or feature rescue is authorized from this result. The 81.08% pooled accuracy is promising descriptive evidence, but it is not certification.
