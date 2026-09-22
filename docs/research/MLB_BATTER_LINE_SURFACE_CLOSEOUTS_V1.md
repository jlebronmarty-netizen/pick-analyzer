# MLB Batter Line Surface Closeouts V1

Status: **RESEARCH ONLY**

Contract: `MLB_BATTER_LINE_SURFACE_CLOSEOUTS_V1/1.0.0`

## Purpose

Preserve exact-replay line-surface attempts across batter markets without substituting approximate
historical corpora. A market may only enter line-surface research after its currently certified
rule reproduces exactly.

## Exact replay passes

### Batter Singles

Certified control:
`batter_singles_under_1p5_proj_0p50_v1`

Observed replay:
- selected: **8,328**
- wins: **7,822**
- accuracy: **93.92%**
- exact parity: **PASS**

New exact-line target tested:
- U0.5

Best candidate with n>=60:
- threshold <=0.350
- 67/91 = **73.63%**
- baseline = 57.30%
- lift = +16.32 pp
- only 3 selected months
- worst selected month = 60.00%

State:
`NO_75_PLUS_STABLE_CANDIDATE`

No retuning.

### Batter Doubles

Certified control:
`batter_doubles_under_0p5_proj_0p16_v1`

Observed replay:
- selected: **14,454**
- wins: **12,507**
- accuracy: **86.53%**
- exact parity: **PASS**

New surfaces tested:
- OVER 0.5
- UNDER/OVER 1.5
- UNDER/OVER 2.5

No OVER 0.5 candidate passed the 75% + sample + monthly stability + signal gates.

The higher UNDER lines were baseline-dominated and do not establish meaningful incremental signal.

State:
`NO_NEW_LINE_SURFACE_CANDIDATE`

### Batter Triples

Certified control:
`batter_triples_under_0p5_proj_0p015_v1`

Observed replay:
- selected: **27,832**
- wins: **27,562**
- accuracy: **99.03%**
- exact parity: **PASS**

OVER 0.5 search:
- best n>=60 candidate: projection >=0.037
- 11/149 = **7.38%**
- baseline OVER = 1.26%
- lift = +6.13 pp
- worst selected month = 0%

State:
`NO_75_PLUS_CANDIDATE`

The existing U0.5 rule remains explicitly baseline-dominated.

## Exact replay blocks

The following markets were NOT expanded because the reconstructed development universe did not
exactly reproduce the certified frozen result:

| Market | Certified control | Reconstructed evidence | State |
|---|---|---|---|
| Pitcher Hits Allowed | U6.5 <=5.0 = 634/761 | close, but May and total counts differ | LINE_SURFACE_BLOCKED_EXACT_REPLAY |
| Batter Total Bases | U2.5 <=1.0 = 1081/1187 | near but monthly universe differs | LINE_SURFACE_BLOCKED_EXACT_REPLAY |
| Batter Walks | U0.5 <=0.20 = 1253/1489 | reconstructed selected n=1288 | LINE_SURFACE_BLOCKED_EXACT_REPLAY |
| Batter Home Runs | U0.5 <=0.10 = 11176/12016 | reconstructed 11251/12092 | LINE_SURFACE_BLOCKED_EXACT_REPLAY |

These are not evidence that alternate lines cannot work. They are lineage/replay blocks. No line
surface should be promoted from an approximate reconstruction.

## Concurrent replay reconciliation

Two earlier generic replay blocks in this closeout were superseded by later exact lineage recovery:

- **Batter Hits** — PR #194 recovered the exact U1.5 <=0.75 control at **6123/7011** by using the canonical target-game pregame feature-key gate. The earlier block here is no longer authoritative.
- **Batter Strikeouts** — PR #193 recovered the exact U1.5 <=0.50 control at **564/592** using the same canonical target-game pregame lineage gate. The earlier block here is no longer authoritative.

Active replay blockers in this document are therefore limited to Pitcher Hits Allowed, Batter Total
Bases, Batter Walks, and Batter Home Runs unless a later exact-replay branch supersedes them.

## Boundaries

- research-only
- no historical Odds API spend
- no provider calls for this work
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- tracker unchanged
