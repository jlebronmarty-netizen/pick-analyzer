# MLB First 3 Innings Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical target surface

2025 target preserves the previously certified score after inning 3:

- mapped games: 2,430;
- exact Statcast/Retrosheet matches: 2,425;
- one-run mismatches excluded fail-closed: 5;
- exact-match rate: 99.79%.

2026 uses complete Statcast F3 scores only. Rows without a complete score are excluded fail-closed and never treated as pushes.

Usable surface:

- 2025: 2,425 games;
- 2026: 2,255 games;
- total: 4,680 games;
- 2025 pushes: 601;
- 2026 pushes: 561;
- rolling OOF: 4,148 games;
- rolling OOF non-push: 3,114;
- actual max target date used: 2026-09-14.

## Architectures tested

The revisit materially changed the first-pass rule.

Tested:

- CatBoost HOME-vs-AWAY probability ensemble;
- HOME-only / AWAY-only / symmetric confidence filters;
- CatBoost regression of F3 run margin;
- classifier + predicted-margin agreement;
- prior win-percentage sign agreement;
- original first-pass q95 prior-win-percentage rule as benchmark.

All folds were chronological. Pushes were excluded from event accuracy. The May 2025 fold had 347 prior non-push training rows, so the operational fold guard was 300; model hyperparameters, labels, feature set, and gates were unchanged.

## Preserved fallback

Research identifier:

`f3_ml_revisit_classifier_margin_p058_m075_fallback_v1`

Rule:

- classifier confidence: p(HOME) >= 0.58 or p(HOME) <= 0.42;
- predicted absolute F3 run margin >= 0.75;
- classifier and margin-regression side must agree;
- predict the agreed HOME/AWAY side.

Rolling OOF:

- correct: **202 / 320**;
- accuracy: **63.13%**;
- selected total including pushes: 414;
- pushes: 94;
- non-push OOF coverage: **10.28%**;
- months with selections: 11;
- minimum monthly non-push n: 12;
- worst month: **52.94%**;
- unconditional majority baseline: **55.11%**;
- lift: **+8.02 pts**.

This candidate passes the sample-size gate but fails the stability and 75% accuracy gates.

## Highest pooled sample-eligible candidate

A stricter classifier + margin agreement candidate reached:

- **49 / 72 = 68.06%**;
- probability threshold 0.70;
- predicted margin threshold 1.0;
- but minimum monthly n = 1;
- worst month = **0.00%**.

It is not a defensible 75% candidate.

## Original benchmark on unified OOF

The original q95 rule using absolute prior win-percentage advantage >= 0.268037684706378 produced:

- **78 / 124 = 62.90%**;
- 37 pushes;
- worst selected month = **0.00%**.

## Closeout

No tested second-pass formula reached the frozen 75% gate with acceptable stability.

State:

`REVISIT_SECOND_PASS_BELOW_75`

- forward eligible: false;
- 2026-09-19 remains quarantined;
- no 2026-09-20+ outcomes were opened;
- do not threshold-rescue from future outcomes.

## Boundaries

Official Picks writes: 0.

APOSTAR: disabled.

Production promotion: none.

Historical Odds API credits consumed: 0.

The temporary Supabase exporter was closed after the bounded run.
