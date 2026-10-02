# MLB Phase C Market-First Closeout — 2026-09-25

Status: **RESEARCH-ONLY**

## Scope

Batter Walks, Batter Strikeouts, Pitcher Walks, and Batter Stolen Bases.

## Market-first findings

### Batter Walks

The most useful exact surface is already in hand:

- **UNDER 0.5**
- model: `batter_walks_under_0p5_proj_0p20_v1`
- 2026 frozen accuracy: **83.39%**

Stored market snapshots show the exact 0.5 line repeatedly:
- UNDER 0.5: 1,962 quote rows;
- 6 days;
- 27 games;
- 187 players;
- 4 books.

This becomes the top forward market/price-validation priority.

Prior line-surface research already closed:
- O0.5 -> no stable 75% signal;
- O1.5 -> no stable 75% signal;
- U1.5 -> baseline dominated.

No retune is authorized.

### Batter Strikeouts

Existing U1.5 remains strong:
- 2026: **1,000/1,074 = 93.11%**.

However the side appearing most frequently in the stored board is OVER, especially at 0.5.

PR #193 already tested O0.5:
- frozen 2025 rule: projection >=1.10;
- 2025: 1,036/1,340 = **77.31%**, +18.47 pp lift;
- 2026: 2,382/3,203 = **74.37%**.

State:
`EXTERNAL_BELOW_75_NO_RETUNE`.

U2.5 was baseline dominated. No new Batter K surface is opened.

### Pitcher Walks

PR #191 already evaluated 0.5/1.5/2.5/3.5 independently.

Passing surfaces:
- O0.5 @ expected walks >=1.75: 2026 **87.33%**, but OOS lift **+4.49 pp**, just below the 5 pp signal gate.
- U2.5 @ expected walks <=1.50: 2026 **86.60%**, +12.11 pp lift.
- U3.5 @ expected walks <=1.25: 2026 **96.35%**, +5.68 pp lift, low coverage.

The line currently most common in our stored board is **1.5**, but both O1.5 and U1.5 already failed development. Do not reopen them.

Operationally:
- watch O0.5 when exact quotes exist;
- preserve U2.5/U3.5 when offered;
- do not invent a 1.5 rule.

### Batter Stolen Bases

Official player-game labels were recovered. U0.5 has an unconditional eligible baseline around **95.27%**. Simple filters can reach ~97% but add less than 3 pp.

State:
`BASELINE_DOMINATED_NOT_PROMOTED`.

Only a materially different, higher-lift architecture would justify reopening this family.

## Phase C conclusion

No new formula search is justified from the already-tested line surfaces.

Forward priorities:
1. **Batter Walks U0.5** — best mix of exact-line availability and strong existing accuracy.
2. **Pitcher Walks O0.5** — secondary watch only when exact market exists.
3. Preserve Pitcher Walks U2.5/U3.5 when offered.

Do not reopen failed 1.5 Pitcher Walks, Batter Walks OVER surfaces, Batter K O0.5, or baseline-dominated stolen-base UNDER without materially new information.

## Boundaries

- research/shadow only
- no line extrapolation
- no threshold rescue
- no Official Picks
- APOSTAR disabled
- no historical Odds API spend
