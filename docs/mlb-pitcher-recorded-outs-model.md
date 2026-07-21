# MLB Pitcher Recorded Outs Model V1

Certification: `MLB_PITCHER_RECORDED_OUTS_MODEL_PASS_INSUFFICIENT_SAMPLE`

Date: 2026-07-21

## Scope

This module adds a leakage-safe, model-only pitcher recorded-outs readiness contract through `/api/mlb/player-data-excellence`.

The active output is SHADOW / NO_MARKET only. It does not create Official Picks, betting edges, EV, Kelly stakes or recommendation candidates.

## Recorded-Outs Conversion

Baseball innings notation is handled as baseball notation, not decimal arithmetic:

- `0.0 -> 0`
- `0.1 -> 1`
- `0.2 -> 2`
- `1.0 -> 3`
- `5.1 -> 16`
- `5.2 -> 17`
- `6.0 -> 18`

Malformed notation such as `5.3` is rejected. A direct trusted outs field is preferred when supplied.

## Stored Pitcher Data

Final read-only audit reports:

- Pitcher rows available: 12,777
- Pitcher identities resolved: 12,652
- Pitcher identity rate: 99.02%
- Valid recorded-outs rows: 8,069
- Malformed or unsupported recorded-outs rows: 4,708
- Starter rows detected from trusted pitching evidence: 30

## Projection Status

The baseline model contract is `mlb_pitcher_recorded_outs_baseline_v1`.

It uses transparent empirical pitcher starter distributions over stored recorded-outs game logs and emits:

- expected recorded outs
- median recorded outs
- standard deviation
- probabilities for 15+, 16+, 17+, 18+, 19+ and 20+ outs
- feature quality
- data sufficiency
- model version
- market status

Current production status is `INSUFFICIENT_PREGAME_STARTER_SAMPLE` because leakage-safe pregame starter identity and sufficient pre-cutoff pitcher history are not yet available for a production-quality named projection sample.

## Leakage Guardrails

- Post-start inputs are rejected.
- Final box-score starter evidence is not treated as historical pregame evidence.
- Settlement fields are excluded from prediction inputs.
- Later identity resolution may improve linkage without changing original feature timestamps.
- Ordinary reads make 0 provider calls.

## Threshold Semantics

- `17+ outs` means recorded outs >= 17.
- Over 17.5 recorded outs requires >= 18.
- Over 16.5 recorded outs requires >= 17.
