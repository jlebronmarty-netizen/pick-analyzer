# MLB Phase D Market-First Coverage Expansion Closeout — 2026-09-25

Status: **RESEARCH-ONLY / SHADOW-ONLY**

## Objective

The phase started from the live exact-contract coverage board and asked one question:

> Can materially different architectures add real sportsbook coverage without rescuing already-failed thresholds?

The live board at the start of this block had advanced slightly from the earlier PR #215 snapshot:

- 11,586 unique quote rows
- 1,009 exact-contract-compatible rows
- **8.71% row coverage**
- 99 exact market+line+side surfaces
- 9 covered surfaces
- **9.09% surface coverage**

Coverage means contract compatibility, not selections.

## Successful expansion 1 — Batter Total Bases U1.5

PR #221.

A new architecture was used rather than retuning the failed projection<=1.20 rule.

Frozen rule:

`prior PA/game <= 3.50`

with:
- minimum 10 strict-prior games;
- same-date history forbidden;
- exact UNDER 1.5 only.

2025:
- 7,406 / 9,813 = **75.47%**
- baseline 66.55%
- lift **+8.92 pp**
- worst month **74.27%**

Untouched 2026:
- 9,145 / 12,142 = **75.32%**
- baseline 68.07%
- lift **+7.25 pp**
- worst month **72.69%**

State:

`CROSS_YEAR_STABLE_75_PLUS_FORWARD_VALIDATION_REQUIRED`

Current Sep25 shadow qualifiers:
- Hao-Yu Lee U1.5 TB, BetMGM -175, PIT @ DET
- Carlos Jorge U1.5 TB, DraftKings -199, CIN @ TOR

No EV is claimed.

## Successful expansion 2 — HRRBI U1.5 forward-only

PR #222.

The frozen 2025 candidate was operationalized prospectively without pretending the revised MLB Official history is the frozen 2026 retrospective test.

Exact contract:
- HRRBI UNDER 1.5
- projection <=0.90
- MLB Official gameLog
- exact MLBAM
- `game_date < target_date`

2026-09-25:
- 119 targets
- 119 evaluable
- 3 qualifiers

Qualifiers:
- Nick Fortes — 0.8557 — BetMGM -190 — TB @ PHI
- Carlos Jorge — 0.6375 — DraftKings -131 — CIN @ TOR
- Charles McAdoo — 0.8722 — BetMGM -130 — CIN @ TOR

## Successful expansion 3 — HRRBI U0.5 forward-only

PR #223.

Frozen development:
- 117 / 118 = 99.15%
- lift +46.98 pp
- worst month 96%

2026-09-25:
- 50 targets
- 50 evaluable
- 0 qualifiers today

The contract still adds exact menu compatibility while remaining forward-only.

## Coverage result

After the three valid research expansions:

- 1,591 / 11,586 rows compatible
- **13.73% row coverage**
- 12 / 99 surfaces
- **12.12% surface coverage**

Delta from the live baseline:
- **+582 exact rows**
- **+5.02 percentage points row coverage**
- **+3 exact surfaces**

## New architectures that failed

All of the following were tested in 2025 first. 2026 was not opened unless a 2025 rule was frozen.

- Singles U0.5 — playing-time volume: FAIL
- Singles U0.5 — contact scarcity: FAIL
- Singles O0.5 — contact opportunity: FAIL
- TB 1.5 YES — production + hard-hit: FAIL
- Home Runs 0.5 YES — Statcast power: FAIL
- Home Runs 1.5 YES — Statcast power: FAIL
- RBI O0.5 — RBI opportunity: FAIL
- RBI 1.5 YES — RBI opportunity: FAIL
- Hits 1.5 YES — hit opportunity: FAIL
- Hits 2.5 YES — hit opportunity: FAIL
- HRRBI 2.5 YES — strict-date exact Retrosheet replay: FAIL
- HRRBI 3.5 YES — strict-date exact Retrosheet replay: FAIL
- Batter K 1.5 YES — strikeout opportunity: FAIL

Batter K 0.5 YES did pass 2025:
- 958 / 1,270 = 75.43%
- +16.62 pp lift
- worst month 72.43%

But untouched 2026 was:
- 1,304 / 1,732 = 75.29%
- +18.72 pp lift
- September = **63.57%**

Therefore PR #225 closes as:

`EXTERNAL_75_PLUS_STABILITY_FAIL_NO_RETUNE`

No threshold rescue is authorized.

## Methodological gate reached

The remaining large uncovered surfaces are no longer good candidates for more threshold search with the same information.

They are now in one of four buckets:

1. failed under a materially different architecture;
2. failed untouched cross-year stability;
3. baseline-dominated / already closed;
4. blocked by source lineage that cannot be certified exactly.

The next valid gains should come from:
- untouched forward evidence for the new successful contracts;
- genuinely new feature families;
- genuinely new market families;
- exact lineage recovery when the frozen source can be proven.

Do **not** continue by lowering thresholds, aliasing YES to OVER, extrapolating lines, or opening 2026 to select a rule.

## Boundaries

- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- no historical Odds API calls
- no tracker modification
