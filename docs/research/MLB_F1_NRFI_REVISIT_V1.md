# MLB First 1 Inning NRFI / YRFI — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical development surface

Target:

`NRFI = 1 when home_f1 = 0 and away_f1 = 0`

The target is derived from the certified First 1 Inning score corpus.

Coverage:

- 2025: 2,428 games;
- 2026: 2,255 games;
- total source rows: 4,683;
- 2025 NRFI: 1,210 / 2,428 = **49.84%**;
- 2026 NRFI: 1,118 / 2,255 = **49.58%**;
- rolling OOF rows: 4,149;
- actual max target date used: 2026-09-14.

All 4,683 rows have exact home and away starter MLBAM IDs.

## New second-pass information

The second pass added strictly-prior starter first-inning scoreless history.

For each expected starter:

- prior starts;
- prior scoreless first innings;
- prior first-inning scoreless rate.

Doubleheaders are handled by date: games on the same calendar date never update one another's prior-history features.

No fuzzy pitcher identity matching is used.

## Architectures tested

- CatBoost PREGAME NRFI probability ensemble;
- NRFI-only confidence filters;
- YRFI-only confidence filters;
- two-sided NRFI/YRFI confidence selection;
- CatBoost + both-starters prior F1 scoreless-rate filters;
- pure both-starters prior F1 scoreless-rate rules;
- the prior 80% / minimum-5-starts rule as a benchmark.

All folds were chronological.

## Preserved second-pass fallback

Research identifier:

`f1_nrfi_revisit_both_starters_075_min3_fallback_v1`

Rule:

- select **NRFI**;
- both starters must have at least 3 prior starts;
- each starter's strictly-prior F1 scoreless rate >=75%.

Rolling OOF:

- **399 / 738 = 54.07%**;
- coverage **17.79%**;
- 11 months represented;
- minimum monthly n **36**;
- worst month **47.95%**;
- unconditional NRFI baseline **49.53%**;
- lift **+4.54 pts**.

This is more stable than the higher-accuracy selective CatBoost variants but remains far below the 75% target.

## Highest pooled sample-eligible candidate

CatBoost + both-starters scoreless history reached:

- **63 / 105 = 60.00%**;
- NRFI direction;
- p(NRFI) >=0.60;
- both starters minimum 5 prior starts;
- each starter prior F1 scoreless rate >=75%;
- worst month **28.57%**;
- minimum monthly n **1**.

It fails the stability gate.

## Closeout

No F1 NRFI/YRFI second-pass candidate reached the frozen 75% gate.

State:

`REVISIT_SECOND_PASS_BELOW_75`

- `forward_eligible=false`;
- 2026-09-19 remains quarantined;
- no 2026-09-20+ outcomes were opened;
- do not threshold-rescue from prospective outcomes.

## Boundaries

Official Picks writes: 0.

APOSTAR: disabled.

Production promotion: none.

Historical Odds API credits consumed: 0.

The temporary Supabase research exporter was closed after the bounded run.
