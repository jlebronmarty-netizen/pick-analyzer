# Pick Analyzer V1 Release Notes

## Verdict

`PICK_ANALYZER_V1_READY`

## What V1 Includes

- MLB core daily operation for moneyline, spread/runline and totals.
- Current Board, Probability Picks, Performance, AI Operations, Operations, Data Coverage and Providers route certification.
- Canonical result ingestion, protected settlement, derived learning evidence and Performance visibility.
- Adaptive refresh and provider-budget governance for MLB core workflows.
- Clear lifecycle labels for preview, data-only, unavailable and blocked sports.
- Unsupported-market recommendation lock.
- Final validation bundle, Definition of Done matrix, production certification and provider/mutation accounting.

## What V1 Does Not Include

- Non-MLB production recommendations.
- Player props, pitcher props, batter props, team totals, NRFI/YRFI, first-five, alternate lines or live betting as recommendations.
- Automatic model training, AutoML, neural networks, stacking or epoch promotion.
- Full historical Odds API coverage or all-sport 5-minute polling.
- Multi-book arbitrage claims beyond stored consensus evidence.

## Operational Notes

No local server smoke was run because the local harness is classified `LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS`. Certification relies on build, validators, artifact consistency, stored operational evidence and read-only production evidence.

No manual Vercel deployment was performed. No new tag was created.
