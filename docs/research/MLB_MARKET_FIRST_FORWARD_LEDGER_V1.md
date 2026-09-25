# MLB Market-First Forward Ledger V1 — 2026-09-25

Status: **RESEARCH-ONLY / FROZEN FORWARD EVIDENCE**

This ledger unifies the earliest pregame freezes from:
- PR #216 — Batter Total Bases U1.5
- PR #217 — HRRBI U1.5
- PR #218 — HRRBI U0.5 (0 crossings)

Five player-market crossings are frozen. Later quote snapshots do not replace these prices.

## Frozen candidates

| Player | Market | Matchup | Frozen model value | Book | Price |
|---|---|---|---:|---|---:|
| Carlos Jorge | TB U1.5 | CIN @ TOR | PA/game 2.769 | Caesars | -195 |
| Hao-Yu Lee | TB U1.5 | PIT @ DET | PA/game 3.302 | BetMGM | -185 |
| Nick Fortes | HRRBI U1.5 | TB @ PHI | 0.856 | BetMGM | -190 |
| Carlos Jorge | HRRBI U1.5 | CIN @ TOR | 0.638 | DraftKings | -131 |
| Charles McAdoo | HRRBI U1.5 | CIN @ TOR | 0.872 | BetMGM | -130 |

HRRBI U0.5 had 50 exact targets and zero threshold crossings. It remains forward-trackable but contributes no selection today.

## Settlement contract

Settlement reads the final MLB Official game feed by exact `gamePk`, then locates the player by exact MLBAM ID.

- Total Bases = singles + 2*doubles + 3*triples + 4*home runs.
- HRRBI = hits + runs + RBI.
- UNDER wins only when actual stat < exact line.
- No postgame model recomputation.
- No replacement of frozen pregame prices.
- No EV from aggregate historical accuracy.

The settlement script is safe to run before games finish: unfinished games remain `PENDING_GAME_NOT_FINAL`.

## Boundaries

- research/shadow only
- Official Picks untouched
- APOSTAR disabled
- no threshold retuning
- no fuzzy identity
- no historical Odds API spend
