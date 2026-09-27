# MLB FanDuel Exact-Market Coverage Board V1

Status: **RESEARCH-ONLY**

This board answers a narrow operational question: for each already-frozen MLB prop contract, does FanDuel currently expose the **same market, exact line, and exact side**?

It does not create new predictions or transfer accuracy between lines/sides.

## Sep 27, 2026 readback

Exact-side available:
- Pitcher K O3.5;
- Pitcher K U6.5;
- Pitcher Outs O14.5.

Opposite-side only:
- Batter Doubles U0.5;
- Batter Hits U1.5;
- Batter HR U0.5;
- Batter RBI U0.5;
- Batter Total Bases U1.5;
- Batter Total Bases U2.5;
- Batter HRRBI U0.5/U1.5/U2.5.

Other-line only:
- Batter Singles U1.5;
- Pitcher Outs U18.5 V2.

Not captured on FanDuel today:
- Pitcher Walks O0.5/U2.5/U3.5;
- Pitcher ER O1.5/U3.5;
- Pitcher Hits Allowed U6.5;
- Batter Strikeouts U1.5;
- Batter Walks U0.5.

Interpretation: today FanDuel's directly actionable frozen prop surface is concentrated in Pitcher K. Pitcher Outs O14.5 is available but still requires its projection gate; today's JR Ritchie O14.5 does **not** qualify because projection 14.30 < 15.75.

For batter markets, current FanDuel capture is mostly YES-only. Existing UNDER formulas remain valid research contracts, but cannot be treated as FanDuel plays without the exact NO/UNDER side.
