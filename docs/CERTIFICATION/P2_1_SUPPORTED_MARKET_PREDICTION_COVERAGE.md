# P2.1 Supported-Market Prediction Coverage Certification

Status: `PRODUCTION_CERTIFIED`

## Scope

P2.1 implements comprehensive supported-market coverage for Current V2 production MLB prediction generation.

## Starting Evidence

- Starting commit: `d909ac9e48c3bed2c2a00c1989d57dad0d48edb5`.
- Active epoch: `CURRENT_V2_PRODUCTION`.
- Epoch start: `2026-08-03T19:57:02.418+00:00`.
- Prior Current V2 evidence: generated 24, production-evaluable 24, recommendation/action/official 0, settled 0.

## Root Cause

The prior 24-row contract came from selecting one odds row per event and normalized market. That chose one side for each moneyline, spread and total market, even when canonical odds held both sides.

## Implemented Repair

- Odds selection now keys by event, normalized market and outcome, preserving the latest selected line on the row.
- Prediction reuse/supersession identity now includes line identity.
- New protected read-only coverage endpoint exposes expected selections and reconciliation states.

After production execution exposed the existing current-version uniqueness constraint, P2.1 narrowed the production universe to the latest canonical line per side. This avoids treating stale historical line changes as separate current selections while preserving exact line identity for the selected current row.

## Certification Gates

- P2.1 validator: PASS.
- P2.0 validator: PASS.
- P1.4/P1.3/P1.2 validators: PASS.
- Mission Control validator: PASS.
- Scheduler, settlement, unsupported-market and Performance validators: PASS.
- Changed-file ESLint: PASS.
- JSON validation: PASS.
- Markdown validation: PASS.
- Targeted secret scan: PASS.
- `git diff --check`: PASS.
- Build because runtime code changed: PASS, 397 static pages.

## Policy Guardrails

No prediction formula, Official Pick policy, recommendation threshold, Kelly logic, scheduler cadence, provider contract, settlement rule, learning weight or historical row is changed.

## Production Certification

Production-certified on commit `a0e6329293686fe2557949f3f30e445c7e6880b8`.

Evidence:

- `/api/system/version`: HTTP 200, commit `a0e6329293686fe2557949f3f30e445c7e6880b8`, provider calls 0.
- `/api/operations/prediction-coverage`: HTTP 200.
- Current MLB events: 8.
- Expected selections: 48.
- Predictions created: 48.
- Production-evaluable rows: 48.
- Recommendation eligible: 0.
- Actionable: 0.
- Official Pick eligible: 0.
- Missed opportunities: 0.
- Cutoff missed: 0.
- Duplicate rows: 0.
- Coverage: 100%.
- Counts by market: moneyline 16, spread 16, total 16.
- Counts by selection side: home 16, away 16, over 8, under 8.
- Read-only coverage provider calls: 0.
- Read-only coverage remote mutations: 0.

One protected production writer execution after the repair returned HTTP 200 `SUCCESS_CHANGED`, selected `midday_refresh`, used 1 SportsDataIO provider call, made 145 remote mutations, and rebuilt 48 downstream prediction rows with no persistence error.

P2.2 is ready to begin after this certification. MC-03 was not started. MC-08E remains paused.
