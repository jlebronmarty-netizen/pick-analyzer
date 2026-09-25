# MLB HRRBI YES Milestones V1

Status: **RESEARCH-ONLY / 2025 DEVELOPMENT ONLY**

This experiment addresses two exact sportsbook surfaces observed at high volume on 2026-09-25:

- Batter Hits + Runs + RBIs 2.5 — side **YES**
- Batter Hits + Runs + RBIs 3.5 — side **YES**

YES is treated as its own contract token. It is not aliased to OVER in the market matching layer.

The underlying settlement target is whether the batter records more than the milestone line in H+R+RBI.

## Lineage

Source: exact Retrosheet 2025 batting CSV from the SHA-verified archive already used by HRRBI research.

Permanent leakage rule is enforced more strictly than the older replay:
- all games on a target date share the same history;
- Game 1 of a doubleheader is never prior history for Game 2;
- source rule is `source_game_date < target_game_date`.

## Search protocol

Projection uses the existing HRRBI component formula, but these YES lines are independent contracts.

Threshold grid is frozen before search:
- 0.00 to 5.00
- step 0.05
- select when HRRBI projection >= threshold

Gate:
- n >=60
- accuracy >=75%
- lift >=5 pp
- >=5 months
- worst month >=65%

2026 remains sealed until a 2025 threshold is frozen.

No Official Picks, APOSTAR, production promotion, historical Odds API spend, or YES/OVER aliasing.
