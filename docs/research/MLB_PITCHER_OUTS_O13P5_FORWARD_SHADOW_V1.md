# MLB Pitcher Outs O13.5 Forward Shadow V1

Status: **RESEARCH-ONLY / FORWARD-ONLY**

Operationalizes the frozen exact Pitcher Outs O13.5 candidate from the Sep 27 line-surface extension.

## Exact contract
- market: Pitcher Outs
- exact line: 13.5
- side: OVER
- frozen projection >= 16.00
- minimum prior starts: 5
- projection: 0.50 × prior season-to-date outs/start + 0.50 × L5 outs/start

No other outs line is interchangeable.

## Evidence
2025 development:
- 1,526/1,802 = **84.68%**
- lift +5.37 pp
- worst month 81.72%

2026 diagnostic:
- 1,437/1,690 = **85.03%**
- lift +8.09 pp
- worst month 80.75%

2026 is diagnostic rather than pristine external because Pitcher Outs outcomes were already inspected by prior families.

## Forward protocol
A row becomes SHADOW_CANDIDATE only when:
1. a strict-pregame sportsbook quote exists;
2. exact line is 13.5;
3. side is OVER;
4. player identity is exact MLBAM;
5. at least five strict-prior starts exist;
6. frozen projection >=16.00.

Price is recorded but no EV is inferred from aggregate historical accuracy.

## Sep 27 readback
FanDuel Janson Junk O13.5 -112:
- frozen projection 13.371
- state: MARKET_AVAILABLE_NOT_QUALIFIED

No candidate is claimed for today.

## Boundaries
- no line extrapolation
- no side substitution
- no threshold retuning
- exact MLBAM only
- strict pregame only
- no historical Odds API spend
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
