# MLB Phase E — New Family Readiness

Status: **RESEARCH-ONLY / MARKET-FIRST**

## Goal

Do not immediately search formulas for every newly supported provider family.

PR #228 prepares prospective BALLDONTLIE capture for eight additional canonical families. Phase E ranks the families using exact 2025 outcome distributions, but **formula research remains sealed until real sportsbook rows are captured**.

## 2025 label readiness

Exact Retrosheet-derived player-game labels are available for:

- runs scored;
- runs + RBI;
- stolen bases;
- extra-base hits;
- hits + runs + stolen bases;
- hits + stolen bases;
- hits + walks + stolen bases.

There are 48,858 eligible 2025 player-games in the baseline audit.

## Priority order

| Priority | Family | Reference line | UNDER baseline | Why |
|---:|---|---:|---:|---|
| 1 | Extra-base hits | 0.5 | 74.62% | close to 75% but not baseline-dominated; strong lift opportunity |
| 2 | Runs + RBI | 0.5 | 71.06% | meaningful headroom for selective under signal |
| 3 | Hits + Runs + SB | 1.5 | 72.56% | near gate with room for incremental signal |
| 4 | Hits + Walks + SB | 1.5 | 63.85% | large lift headroom |
| 5 | Hits + SB | 1.5 | 77.38% | already >75%; must prove >=5pp lift |
| 6 | Runs scored | 0.5 | 89.19% | baseline-dominance risk |
| 7 | Stolen bases | 0.5 | 93.62% | very high baseline; simple under filters not useful |
| 8 | First home run | milestone | — | needs ordered play-by-play settlement lineage first |

These are readiness references, **not assumptions about which exact lines the books will offer tomorrow**.

## Admission rule

A family enters formula research only after prospective capture proves a real exact surface:

`market + exact line + exact side`

Then:
- 2025 development selects the rule;
- 2026 remains sealed until the rule is frozen;
- accuracy >=75%;
- lift >=5 pp;
- temporal stability required;
- no threshold rescue after external evidence.

## Boundaries

- no Official Picks
- APOSTAR disabled
- no production promotion
- no historical Odds API spend
- no tracker modification
