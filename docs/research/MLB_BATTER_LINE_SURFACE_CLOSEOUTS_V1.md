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


### Batter Walks

Certified control:
`batter_walks_under_0p5_proj_0p20_v1`

Exact lineage recovered from the certified runtime:

- strict prior-date game logs with plate appearances >=1;
- minimum 10 prior games;
- raw feature = **L10 PA/game × all-prior BB/PA**;
- monthly linear fit uses only data available before the target month;
- canonical target-game key gate = `pick2_mlb_batter_daily_features`;
- same-day games are excluded from one another's prior history.

All-2025 refit reproduced **n=40,886**, intercept **0.117815177785939**, slope **0.593708345578887**.

Control replay:
- **1,253/1,489 = 84.15%**
- baseline U0.5 = **73.92%**
- lift = **+10.23 pp**
- worst month = **81.49%**
- Wilson lower bound = **82.21%**
- exact parity: **PASS**

Alternate exact lines observed in the current 2026-09-22 book inventory were evaluated on 2025 development only:

- O0.5: no 75% candidate; best n>=60 was 46/96 = **47.92%**
- O1.5: no 75% candidate; best n>=60 was 37/417 = **8.87%**
- U1.5: raw accuracy can be very high, but the line baseline is **96.20%** and the signal gate is not met

State: `NO_NEW_LINE_SURFACE_CANDIDATE`.

No 2026 threshold rescue was attempted.

### Batter Home Runs

Certified control:
`batter_hr_under_0p5_proj_0p10_v1`

The same exact strict-prior runtime lineage reproduced the all-2025 refit at **n=40,886**, intercept
**0.0562641814171271**, slope **0.536870614141035**.

Control replay:
- **11,176/12,016 = 93.01%**
- baseline U0.5 = **88.75%**
- lift = **+4.26 pp**
- worst month = **92.31%**
- exact parity: **PASS**

The existing certified U0.5 rule is preserved unchanged. Its lift is below the newer 5 pp line-surface
signal gate; that does not revoke or retune the already-certified model.

Current-book alternate lines were tested on 2025 development only:

- O0.5: no 75% candidate; best n>=60 was 136/529 = **25.71%**
- O1.5: no 75% candidate; best n>=60 was 8/213 = **3.76%**
- U1.5: baseline = **99.22%**; representative rule reached 99.72% but added only **+0.50 pp**

State: `NO_NEW_LINE_SURFACE_CANDIDATE`.

No 2026 threshold rescue was attempted.

### Batter Total Bases

Certified control:
`batter_total_bases_under_2p5_edge_1p5_v1`

The canonical target-game feature-key gate recovered exact parity:

- all-2025 refit: n **40,886**
- intercept **0.599532796678854**
- slope **0.563175501776575**
- 2025 control: **1,081/1,187 = 91.07%**
- 2026 control: **2,021/2,336 = 86.52%**
- exact parity: **PASS**

A fixed 2025 threshold grid (0.25..4.00 by 0.05) was evaluated across current exact lines before any
2026 diagnostic read.

Development passers:

- U1.5 @ projection <=1.20: **5,217/6,843 = 76.24%**, +9.70 pp lift, worst month 75.05%
- U2.5 @ projection <=1.30: **10,557/12,280 = 85.97%**, +5.56 pp lift, worst month 85.33%
- U3.5 @ projection <=1.20: **6,264/6,843 = 91.54%**, +5.46 pp lift, worst month 90.12%

Frozen-threshold 2026 diagnostic:

- U1.5 <=1.20: **7,081/9,471 = 74.77%** -> below 75%; no retune
- U2.5 <=1.30: **12,193/14,405 = 84.64%**, but lift falls to **+3.91 pp**
- U3.5 <=1.20: **8,583/9,471 = 90.62%**, but lift falls to **+4.12 pp**

Therefore no new Total Bases line survives the full cross-year signal gate. The existing U2.5
<=1.00 control remains unchanged and retains 2026 lift **+5.78 pp**.

State: `NO_NEW_CROSS_YEAR_LINE_SURFACE_CANDIDATE`.


### Batter Total Bases

Certified control:
`batter_total_bases_under_2p5_edge_1p5_v1`

Exact runtime lineage was recovered with the canonical target-game pregame feature-key gate and the
same strict-prior raw feature used by the approved runtime:

`raw = L10 PA/game × all-prior total_bases/PA`

All-2025 refit reproduced exactly:
- n = **40,886**
- intercept = **0.599532796678854**
- slope = **0.563175501776575**

Control U2.5 <=1.00:
- **1,081/1,187 = 91.07%**
- exact parity: **PASS**

2025 development-only line surface froze three candidates before opening 2026:

- U1.5 @ projection <=1.20: 5,217/6,843 = **76.24%**, lift **+9.70 pp**
- broader U2.5 @ projection <=1.30: 10,557/12,280 = **85.97%**, lift **+5.56 pp**
- U3.5 @ projection <=1.20: 6,264/6,843 = **91.54%**, lift **+5.46 pp**

One-shot 2026 through 2026-09-21, using the frozen all-2025 refit and no threshold changes:

- U1.5 <=1.20: 7,081/9,471 = **74.77%**, lift +7.58 pp -> `EXTERNAL_BELOW_75_NO_RETUNE`
- U2.5 <=1.30: 12,193/14,405 = **84.64%**, lift +3.91 pp -> do not replace the existing U2.5 <=1.00 rule
- U3.5 <=1.20: 8,583/9,471 = **90.62%**, lift +4.12 pp -> `EXTERNAL_75_PLUS_LIFT_BELOW_5PP_NO_PROMOTE`

The existing certified U2.5 <=1.00 control remains unchanged and authoritative.

## Exact replay blocks

### Pitcher Hits Allowed

Frozen control:
`pitcher_hits_allowed_under_6p5_proj_5p0_v1` = **634/761** on 2025, with all-2025 refit n=3,099.

Two read-only reconstructions were attempted without retuning:

- xyear starter rows + canonical target-game pitcher gate -> refit n=3,334; control **663/783**
- Retrosheet historical starter rows -> refit n=3,404; control **672/796**

Neither reproduces the frozen universe. State remains:

`LINE_SURFACE_BLOCKED_EXACT_REPLAY`

No approximate corpus is authorized for alternate-line search.

### RBI / H+R+RBI current-board audit

Batter RBI has only line **0.5** on the captured 2026-09-22 board, the same line as its existing
certified U0.5 control. There is no alternate exact line to expand today.

Batter H+R+RBI has real **0.5 and 1.5** lines today, but its frozen 2025 development control
(2,278/2,582 = 88.23% on U2.5 <=0.70) came from Retrosheet `2025batting.csv` inside the frozen
2025 CSV archive. That exact player-game source is not preserved in the repository or current
Supabase normalized tables. The normalized event-derived tables do not reproduce the frozen
player-run/RBI totals exactly, so they are not substituted.

State:
`LINE_SURFACE_BLOCKED_EXACT_SOURCE_CORPUS_NOT_RECOVERED`.

## Concurrent replay reconciliation

Two earlier generic replay blocks in this closeout were superseded by later exact lineage recovery:

- **Batter Hits** — PR #194 recovered the exact U1.5 <=0.75 control at **6123/7011** by using the canonical target-game pregame feature-key gate. The earlier block here is no longer authoritative.
- **Batter Strikeouts** — PR #193 recovered the exact U1.5 <=0.50 control at **564/592** using the same canonical target-game pregame lineage gate. The earlier block here is no longer authoritative.

Active traditional replay blocker is now limited to **Pitcher Hits Allowed**. Batter Total Bases, Walks and Home Runs were recovered to exact parity in this PR. H+R+RBI is separately blocked on recovery of its exact frozen 2025 CSV source corpus.

## Boundaries

- research-only
- no historical Odds API spend
- no provider calls for this work
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- tracker unchanged
