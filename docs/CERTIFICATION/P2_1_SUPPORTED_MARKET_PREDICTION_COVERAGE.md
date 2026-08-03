# P2.1 Supported-Market Prediction Coverage Certification

Status: `LOCAL_VALIDATION_PASS_PENDING_PRODUCTION`

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

- Odds selection now keys by event, normalized market, outcome and line.
- Prediction reuse/supersession identity now includes line identity.
- New protected read-only coverage endpoint exposes expected selections and reconciliation states.

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

Pending deployment and protected production coverage observation.
