# MLB Pitcher K O3.5 Forward Shadow V1

Status: RESEARCH-ONLY / FORWARD-ONLY

This track operationalizes the frozen Pitcher K line-surface candidate from PR #190 without retuning.

## Exact contract

- Market: Pitcher Strikeouts
- Exact line: 3.5
- Side: OVER
- Rule: projection >= 4.25
- Minimum prior starts: 5
- Projection: 0.60 × (prior K/BF × L5 BF/start) + 0.40 × L5 K/start

No other K line is interchangeable with this contract.

## Frozen evidence

2025 development:
- 1771/2332 = 75.94%
- baseline 70.39%
- lift +5.56 pp
- worst month 71.43%

2026 diagnostic:
- 1741/2290 = 76.03%
- baseline 70.21%
- lift +5.81 pp
- worst month 74.85%

The 2026 evidence is diagnostic, not pristine external.

## Forward protocol

Forward collection starts 2026-09-24.

A row becomes SHADOW_CANDIDATE only when:
1. a strict-pregame sportsbook quote exists;
2. exact line is 3.5;
3. side is OVER;
4. player identity is exact MLBAM;
5. at least five strict-prior starts exist;
6. frozen projection >=4.25.

If the exact line is absent, there is no candidate.

## Price handling

The sportsbook price is recorded, but EV is not calculated from the 75.94% historical accuracy. This model does not currently expose a calibrated per-play probability, so historical accuracy must not be substituted for one.

## Current 2026-09-24 state

At the audit performed after creating this track, no approved exact O3.5 quote had yet been captured for today. Therefore there is no current forward candidate yet.

## Boundaries

- no line extrapolation
- no O4.5/O5.5 rescue
- no threshold changes
- no fuzzy player matching
- strict-pregame only
- no historical Odds API spend
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
