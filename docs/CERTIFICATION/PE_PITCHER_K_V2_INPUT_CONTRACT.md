# PE_PITCHER_K_V2_INPUT_CONTRACT / 2.0.0

Semantic freeze, PA14-V3, 2026-09-14. This specification supersedes the V2 proposal only. V1 remains HISTORICAL_ARTIFACT_INCOMPLETE. No claim of V1 feature equivalence. No endpoint, production builder, model, migration or deployment is supplied. The companion JSON Schema and offline reference verifier are normative parts of this freeze.

## Identity and population

Canonical names are exactly seasonPitches, l5Pitches, seasonBF, l5BF, daysRest, pitcherKRateV2, opponentKRateV2, avgReleaseSpeedV2, strikeRateV2. Their semantics are scoped to contractVersion PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0. Workload names retain the requested interface, not a claim that historical V1 extraction matched.

Use positive integer MLB game_pk and MLBAM pitcher identity, authoritative home/away team mapping, a versioned target schedule and probable OR confirmed starter record. Never infer target starters from actual outcome. A starter change invalidates eligibility of the old target snapshot for current serving; preserve its historical lineage. Ambiguous identity or conflicting evidence blocks, never fuzzy-match.

Freeze cutoff C before targetStart. Source regular-season games must be in the target's MLB season, have official game_date strictly before target official game_date, and certified completion upper bound strictly before C. No prior-season carryover, postseason, same-day games, partial games or unfinished suspended games. No training-label data from the target. Completion bounds may establish chronology without CSV acquisition time. Actual source start ordering uses authoritative UTC start; ties/unknown ordering block L5. daysRest uses official game_date calendar subtraction, not UTC date or elapsed hours.

Pitcher population: all qualifying prior starts; first pitcher in a complete ordered source team sequence corroborated by canonical start identity. Openers count. Relief excluded. Team population: all qualifying opponent batting-team games, all batters, both pitcher hands, all opposing appearances. No projected/confirmed lineup, platoon adjustment or shrinkage. Complete source-game census must prove none of the qualifying games/starts was silently omitted. Invalid qualifying dependencies block the target; do not select five older good starts around a bad start.

## Raw vocabulary / 2.0.0

Exact case-sensitive strings; no substring or lowercase repair. Unique pitch key is (game_pk, at_bat_number, pitch_number), positive integer components. Identical duplicate transport rows reuse once; any full-field conflict blocks. Count completed PA by (game_pk, at_bat_number), once; more than one terminal outcome or more than one pitcher in a PA blocks pending a separately versioned attribution contract.

| Description | Required type | Delivered pitch denominator | Strike numerator |
|---|---|---|---|
| called_strike, swinging_strike, swinging_strike_blocked, foul, foul_tip, foul_bunt, missed_bunt, bunt_foul_tip, swinging_pitchout, foul_pitchout | S | yes | yes |
| ball, blocked_ball, pitchout, hit_by_pitch, intentional_ball | B | yes | no |
| hit_into_play, hit_into_play_no_out, hit_into_play_score | X | yes | no |
| automatic_ball | B | no | no |
| automatic_strike | S | no | no |

This enumerates accepted modern/legacy descriptions; every other description, null, unknown type or mismatch returns SOURCE_VOCABULARY_INVALID or STRIKE_TYPE_CONFLICT. Automatic penalties are not thrown pitches: exclude from workload pitch counts, speed and strike denominator, but retain any legitimate completed PA/K outcome. All pitch types are included; pitch_type is not an inclusion filter. This consciously replaces the draft's unspecified automatic-event behavior.

The known 778319 / 686752 / AB6 / pitch3 swinging_strike + X + field_out is STRIKE_TYPE_CONFLICT. Block any row depending on that source; never repair it, count it as S, or silently drop it. Full stored vocabulary inspection also found 21 hit_into_play/type S records; same rule. No raw mutation.

Completed PA whitelist: catcher_interf, double, double_play, field_error, field_out, fielders_choice, fielders_choice_out, force_out, grounded_into_double_play, hit_by_pitch, home_run, intent_walk, sac_bunt, sac_bunt_double_play, sac_fly, sac_fly_double_play, single, strikeout, strikeout_double_play, triple, triple_play, walk. K whitelist is exactly strikeout and strikeout_double_play. Multiple outs remain one PA. BF means completed PA attributed wholly to the starter, not encountered at-bats. Reconcile against authoritative source box-score BF; missing corroboration or mismatch blocks production admission. Pitchless intentional walks require canonical terminal evidence and count as BF, not delivered pitches; absence from a pitch-only extract cannot silently reduce BF.

Null/empty events within a PA are ordinary nonterminal pitch records. A whole at-bat with no terminal outcome requires an authoritative unfinished-PA witness tied to inning/order (runner third out or suspended unfinished PA); it contributes pitches but zero BF/K. truncated_pa also requires this witness and never counts as completed PA. Any other nonempty event blocks. Runner witnesses are separate from batter-terminal events. Known historical witnesses: 777449/542881 AB50 CS3(1356); 777578/571510 AB23 PO1(13); 778288/571510 AB25 PO1(13). These resolve unfinished PA, not original V1 semantics.

## Nine quantities

Let N be qualifying starts (require N >= 5), P total delivered pitches, B total reconciled BF, K terminal strikeouts; suffix 5 denotes latest five starts. Rates are pooled counts, not means of per-game rates.

| Field | Exact value | Missing policy |
|---|---|---|
| seasonPitches | P / N | missing/invalid dependency blocks |
| l5Pitches | P5 / 5 | fewer than five starts blocks |
| seasonBF | B / N | unreconciled BF blocks |
| l5BF | B5 / 5 | same exact five starts as pitches |
| daysRest | target official date - latest prior start official date, calendar days | missing ordering/date blocks |
| pitcherKRateV2 | K / B, starts-only same season | B must be positive |
| opponentKRateV2 | opponent season terminal K / completed team PA | complete census; PA positive; no lineup/handedness |
| avgReleaseSpeedV2 | sum delivered-pitch release_speed / delivered-pitch count, mph | all delivered pitches require finite positive measured speed; no zero/imputation |
| strikeRateV2 | delivered pitches with validated type S / P | P positive; contradiction blocks |

No early rounding. Parse raw release_speed decimal exactly; positive finite decimal only. Source zero, null, blank, NaN/infinity or negative is missing/invalid. Automatic events need no velocity. Initial coverage threshold is 100% of delivered pitches; this strict rule may reduce eligibility and cannot be weakened without a new version.

Publish workload inputs only. Consumer arithmetic remains exactly seasonPitches + 0.35 * max(l5Pitches - seasonPitches, 0) - (daysRest >= 9 ? 6 : 0), and seasonBF + 0.35 * max(l5BF - seasonBF, 0) - (daysRest >= 9 ? 1.5 : 0). Do not subtract on short rest, clamp outputs or change coefficients. Workload arithmetic compatibility is distinct from unrecovered V1 input equivalence.

## Time and lineage

dataAsOf = maximum authoritative contributing evidence timestamp; every contributor <= C < targetStart. Event evidence uses authoritative completion upper bound (including resumed completion), not historical download time. Schedule and target starter state each need a source-state timestamp tied to the exact immutable version and independently retained proof that version was available by C. A later corrected state with an earlier effective date cannot retroactively enter. Collector acquiredAt, odds timestamps, created_at, updated_at and response/page time alone are not source-state authority. Missing either state time or availability proof blocks. No observation-receipt-only alternative is silently enabled in 2.0.0.

Each row includes target identity, targetStart, dataAsOf, cutoff, contractVersion, builderVersion, sourceVersions, dependencies and lineageDigest. Dependencies identify schedule, target starter, source games, pitch evidence, terminal/box-score evidence and coverage census via evidenceDigest; retain role, canonical game, nullable source pitcher, authoritativeAt, availableBy and sourceVersion. Completion bounds may serve both authoritativeAt and availableBy for historical events. Source manifests retain per-game pitch keys, counts and raw content hashes privately. Public digests are not permission to publish raw evidence. Do not derive lineage from prediction_history or model outputs.

## Exact JSON and digest rules

Normative schema: PE_PITCHER_K_V2_INPUT_CONTRACT.schema.json. additionalProperties=false throughout. Envelope {version,status,asOf,data,blocked}; asOf is request clock only, never feature authority. UTC timestamps use YYYY-MM-DDTHH:mm:ss.sssZ. Positive safe-integer IDs. Data sorted by canonicalGamePk then pitcherMlbamId; duplicates conflict. Blocked rows contain identity plus sorted unique reasons only, no partial actionable values. OK: data nonempty, blocked empty; PARTIAL: both nonempty; BLOCKED: data empty, blocked nonempty; EMPTY: both empty. No eligible zero-filled row.

All numeric feature values are JSON numbers rounded once to 8 decimal places using exact rational round-half-to-even. daysRest remains integer. Integer count audit ratios and exact decimal speed sum are retained in statistics: seasonStarts, seasonDeliveredPitches, l5DeliveredPitches, seasonBFCount, l5BFCount, pitcherStrikeouts, opponentStrikeouts, opponentPA, speedSumMph, speedCount, strikeCount. Raw counts allow exact reconstruction and prevent serialization roundoff being mistaken for a different definition. Consumer uses these serialized numeric inputs for frozen workload arithmetic; does not inherit V1 source extraction.

Canonical bytes: UTF-8, no BOM/newline, no whitespace, object keys lexicographically sorted recursively, arrays in specified order, JSON strings escaped per JSON.stringify for ASCII contract fields, booleans/null standard. Nonnegative finite numbers only, shortest fixed decimal with at most 8 places, no exponent or trailing fractional zeros, -0 forbidden. All contract text fields ASCII. Dependency order: role, canonicalGamePk, pitcherMlbamId (null first), evidenceDigest; sourceVersions sorted unique. lineageDigest = lowercase SHA-256 of canonical row excluding lineageDigest only (including statistics/dependencies). Envelope request asOf is outside row digest. builderVersion is immutable implementation-content SHA-256; the future production builder must bind its exact build, not reuse an arbitrary label.

JSON Schema checks structure and status/cardinality, not database authority. Admission MUST also verify dataAsOf equals the maximum dependency authoritativeAt; all availableBy/authoritativeAt <= cutoff < targetStart; coverage/start/box-score requirements above; at least one of every dependency role; sourceVersions exactly match dependency versions; sorted unique identity/dependency arrays; no identity in both data and blocked; feature/statistics arithmetic; minimum samples; and recomputed lineageDigest. A schema-valid row alone is never eligible evidence. Missing required input yields only a blocked entry, never null inside an eligible row. Whole-request availability failures use an HTTP error in future implementation, not an invented EMPTY success.

## Freeze versus release

Offline contract examples are explicitly test fixtures; they never represent production availability. Real raw extracts validate counts and failure rules independently, without inventing source-state timestamps. Contract freeze does not certify a production eligible row, Consumer readiness, model fit or deployment. Endpoint and model training remain prohibited in this phase. Any semantics/vocabulary/coverage/serialization change requires a new contract version and new golden outputs.
