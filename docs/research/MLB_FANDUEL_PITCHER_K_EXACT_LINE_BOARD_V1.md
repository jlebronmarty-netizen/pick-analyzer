# MLB FanDuel Pitcher K Exact-Line Board V1

Status: **RESEARCH-ONLY / FORWARD-ONLY**

This board does not search for a new formula. It operationalizes the already-frozen Pitcher K exact-line surface from PR #190 on **FanDuel** quotes.

## Why this exists

The 2025-only line search and frozen 2026 replay already established exact-line contracts. The missing operational layer was a FanDuel-specific board that:

- requires an exact FanDuel line;
- requires the exact direction;
- uses exact MLBAM identity;
- uses a strictly pregame quote;
- reconstructs the frozen K projection from strict-prior 2026 starts;
- never transfers accuracy between neighboring lines.

## Stable contracts

| Exact line | Side | Frozen projection gate | 2025 | 2026 diagnostic | Status |
|---|---|---:|---:|---:|---|
| 3.5 | OVER | >= 4.25 | 75.94% | 76.03% | Cross-year stable |
| 6.5 | UNDER | <= 4.50 | 86.98% | 89.03% | Existing certified control |
| 7.5 | UNDER | <= 5.50 | 90.19% | 90.59% | Stable, high baseline |
| 8.5 | UNDER | <= 4.75 | 96.54% | 96.56% | Stable, high baseline |

Historical hit rate is not a calibrated per-play probability.

## Diagnostic-only contracts

These are shown when FanDuel carries the exact market, but must not be promoted:

- O4.5 at projection >= 6.25;
- O5.5 at projection >= 7.75;
- U5.5 at projection <= 4.50.

All three have pooled 75%+ evidence but fail the frozen 2026 monthly-stability requirement.

## Same-opponent context

The board also reports prior starts against today's opponent across 2025-26:
- prior start count;
- average strikeouts;
- most recent strikeout count/date.

This information is **display-only context**. It cannot change the frozen selection decision.

## 2026-09-27 readback

Using the latest strictly pregame FanDuel captures available during this research block:

Stable O3.5 candidates:
- Dean Kremer — projection 4.855 — FanDuel O3.5 -320;
- Jacob Misiorowski — 6.878 — O3.5 -2200;
- Jared Jones — 7.250 — O3.5 -1000;
- JR Ritchie — 5.115 — O3.5 -260;
- Logan Gilbert — 6.697 — O3.5 -4500;
- Max Scherzer — 4.447 — O3.5 -500;
- Parker Messick — 6.531 — O3.5 -115;
- Shota Imanaga — 5.375 — O3.5 -390;
- Yusei Kikuchi — 4.827 — O3.5 -400;
- Zack Wheeler — 7.661 — O3.5 -1450.

No U6.5 FanDuel candidate qualified in the same readback.

Diagnostic-only qualifiers were present at O4.5 and U5.5, but remain blocked from promotion by their frozen stability state.

The current FanDuel price is descriptive. No EV is calculated.

## Boundaries

- no historical Odds API spend;
- no provider call is required by the SQL board;
- no Official Picks write;
- APOSTAR disabled;
- no production promotion;
- no threshold or formula changes.
