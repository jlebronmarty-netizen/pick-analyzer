# MLB Approved Props — Real Line Contract V1

**Contract:** `MLB_APPROVED_PROP_REAL_LINE_CONTRACT/1.0.0`  
**State:** research/shadow only  
**Official Picks:** writes forbidden  
**APOSTAR:** disabled

## Permanent operational rule

A row may be `QUALIFIES_MARKET_VERIFIED` only when all four gates are true:

1. the frozen/certified model qualifies;
2. the real required market/side/line exists at a sportsbook;
3. game and player/team identity are exact;
4. the quote is strictly pregame and has a real sportsbook, price, and timestamp.

Historical accuracy is model-level evidence. It is **not** the probability of an individual play.

Alternate provider lines are captured and preserved as market evidence, but they are not automatically model-eligible.

## Line certification

| Candidate | Market | Side | Certified line | Historical certified evidence | Runtime line scope |
|---|---|---|---:|---:|---|
| `pitcher_bb_under_2p5_p85_v1` | Pitcher Walks | UNDER | 2.5 | 125/137 = 91.24% | `EXACT_FROZEN_LINE_ONLY` |
| `pitcher_er_over_1p5_p70_v1` | Pitcher Earned Runs | OVER | 1.5 | 73/91 = 80.22% | `EXACT_FROZEN_LINE_ONLY` |
| `pitcher_hits_allowed_under_6p5_proj_5p0_v1` | Pitcher Hits Allowed | UNDER | 6.5 | 968/1226 = 78.96% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_hits_under_1p5_edge_0p75_v1` | Batter Hits | UNDER | 1.5 | 8496/9833 = 86.40% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_total_bases_under_2p5_edge_1p5_v1` | Batter Total Bases | UNDER | 2.5 | 2021/2336 = 86.52% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_hr_under_0p5_proj_0p10_v1` | Batter Home Runs | UNDER | 0.5 | 12448/13507 = 92.16% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_k_under_1p5_proj_0p5_v1` | Batter Strikeouts | UNDER | 1.5 | 1000/1074 = 93.11% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_walks_under_0p5_proj_0p20_v1` | Batter Walks | UNDER | 0.5 | 2590/3106 = 83.39% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_singles_under_1p5_proj_0p50_v1` | Batter Singles | UNDER | 1.5 | 12690/13634 = 93.08% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_doubles_under_0p5_proj_0p16_v1` | Batter Doubles | UNDER | 0.5 | 17632/20282 = 86.93% | `EXACT_FROZEN_LINE_ONLY` |
| `batter_triples_under_0p5_proj_0p015_v1` | Batter Triples | UNDER | 0.5 | 29689/30045 = 98.82% | `EXACT_FROZEN_LINE_ONLY` |
| `pitcher_win_forward_numeric_p015_v1` | Pitcher Record a Win | NO | n/a | rolling OOF 128/147 = 87.07% | `NO_NUMERIC_LINE_BINARY_SIDE` |
| `pitcher_outs_under_18p5_p90_v1` | Pitcher Outs | UNDER | 18.5 | frozen 215/226 = 95.13% | `RUNTIME_PARITY_BLOCKED` |

Pitcher Outs blocker remains:

`PITCHER_OUTS_INPUT_LINEAGE_NOT_EXACTLY_RECONCILED`

It must not become a recommendation even when a real 18.5 quote exists.

## Multi-line policy

No numeric-line model above is currently certified to transfer its threshold, calibration, or individual probability to a different sportsbook line.

Examples:

- ER model certified at OVER 1.5 cannot be evaluated as OVER 2.5 without a separate line-specific validation.
- Hits Allowed model certified at UNDER 6.5 cannot be converted to UNDER 5.5 or UNDER 7.5 merely because those quotes exist.
- Walks calibration is explicitly certified at line 2.5; alternate lines remain evidence only.

A future multi-line extension must be a separate research project with frozen development/validation boundaries. It must not infer a probability from the current single-line rule.

## Final statuses

- `QUALIFIES_MARKET_VERIFIED` — model qualifies and an exact real sportsbook quote exists for the certified side/line, with exact identity and strict pregame lineage.
- `MODEL_QUALIFIES_MARKET_NOT_AVAILABLE` — model qualifies, but no usable real market/side quote exists.
- `MARKET_AVAILABLE_REQUIRED_LINE_NOT_AVAILABLE` — the market exists pregame, but the model's certified numeric line is absent.
- `NO_EVALUABLE_IDENTITY` — the market may exist, but exact MLBAM identity is not persisted/verified.
- `NO_EVALUABLE_PREGAME_LINEAGE` — quote evidence exists but cannot be certified as strictly pregame.
- `NO_EVALUABLE` — model inputs/history are insufficient.
- `NO_PLAY` — model was evaluable but did not qualify.
- `RUNTIME_PARITY_NOT_CERTIFIED` — runtime/model lineage is not certified; recommendation forbidden.

Only `QUALIFIES_MARKET_VERIFIED` belongs in the board's `playable` collection.

## ARI–NYY audit example

The recovered prospective pitcher quotes for gamePk `825028` demonstrate the required distinction between capture and model eligibility.

Examples observed in the preserved pregame snapshot:

- Corbin Burnes ER included 0.5, 1.5, 2.5, 3.5, and 4.5 lines. The ER model remains eligible only at OVER 1.5.
- Corbin Burnes Hits Allowed included 3.5 through 9.5 alternatives. The Hits Allowed model remains eligible only at UNDER 6.5, and only if that exact side/line quote exists.
- Will Warren ER had multiple 2.5 quotes but also a 1.5 quote. Only the certified OVER 1.5 line can be evaluated by the current ER model.
- Pitcher Outs quotes remain non-recommendable regardless of real line availability because runtime parity is not certified.

The game had already begun by the time this contract was finalized; these rows are audit evidence only and are not reconstructed recommendations.
