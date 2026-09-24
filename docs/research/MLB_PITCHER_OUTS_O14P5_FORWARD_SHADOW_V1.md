# MLB Pitcher Outs O14.5 Forward Shadow V1

Status: RESEARCH-ONLY / FORWARD-ONLY

This track operationalizes the frozen O14.5 Pitcher Outs candidate from PR #195 without changing any thresholds.

## Exact contract

- Market: Pitcher Outs
- Exact line: 14.5
- Side: OVER
- Rule: projection >=15.75
- Minimum prior starts: 5
- Projection: 0.50 × prior season-to-date outs/start + 0.50 × L5 outs/start

No other Outs line is interchangeable with this contract.

## Frozen evidence

2025:
- 1550/2010 = 77.11%
- baseline 71.45%
- lift +5.67 pp
- worst month 72.37%

2026 diagnostic:
- 1430/1811 = 78.96%
- baseline 70.83%
- lift +8.13 pp
- worst month 75.86%

2026 remains diagnostic, not pristine external.

## Prior observed crossing

Nick Martinez O14.5 at DraftKings -189:
- projection 17.204
- result WIN
- observed outs 18

This was observational and does not count as untouched forward certification.

## Forward protocol

Forward collection begins 2026-09-24.

A SHADOW_CANDIDATE requires:
1. strict-pregame exact 14.5 quote;
2. side OVER;
3. exact MLBAM pitcher identity;
4. >=5 strict-prior starts;
5. frozen projection >=15.75.

If line 14.5 is absent, there is no candidate.

## Price handling

Price is persisted when available, but no EV is calculated because there is no calibrated per-play probability for this rule.

## Current 2026-09-24 state

At the audit performed while opening this track, no approved exact O14.5 quote had yet been captured today. Therefore no forward candidate is claimed yet.

## Boundaries

- no U17.5 rescue
- no line extrapolation
- no threshold changes
- no fuzzy matching
- strict-pregame only
- no historical Odds API spend
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
