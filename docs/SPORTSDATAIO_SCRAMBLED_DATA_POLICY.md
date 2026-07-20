# SportsDataIO Scrambled Data Policy

Status: Implemented
Version: V1

## Policy

SportsDataIO fields flagged as possibly scrambled, trial-only or range-invalid are quarantine/display-only until a deterministic normalizer proves stable identity, units, timing and ranges.

## Detection Heuristics

V1 checks for:

- Probability fields outside 0 to 1.
- Percentage fields outside expected percentage range.
- Innings or temperature fields outside plausible ranges.
- Single constant values across many rows.

These checks are warning gates, not proof of provider corruption.

## Product Use

Possibly scrambled data must not:

- Improve confidence.
- Activate a recommendation.
- Feed official picks.
- Train learning.
- Rewrite historical rows.
- Promote a model.
