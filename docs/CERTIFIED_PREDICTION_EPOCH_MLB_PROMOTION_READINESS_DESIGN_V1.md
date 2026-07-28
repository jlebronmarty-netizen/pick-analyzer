# Certified Prediction Epoch & MLB Promotion Readiness Design V1

Generated: 2026-07-28

Evidence:
- `docs/certified-prediction-epoch-mlb-readiness-audit-v1.json`
- `docs/official-picks-eligibility-audit-v1.json`
- `src/services/recommendation-eligibility-policy.service.ts`
- `src/services/top-picks.service.ts`
- `src/services/sportsdataio-mlb-prospective-preview.service.ts`
- `supabase/migrations/202607270001_prediction_epoch_governance_v2.sql`

Safety result:

| Action | Result |
| --- | --- |
| SQL applied | no |
| Epoch activated | no |
| Historical replay executed | no |
| Prediction rows changed | no |
| Probabilities changed | no |
| Confidence or quality formulas changed | no |
| Official Pick thresholds changed | no |
| Learning Brain weights changed | no |
| Provider calls | 0 |
| Remote mutations | 0 |
| Production mutations | 0 |

## 1. Legacy Prediction Classification

Read-only MLB `prediction_history` sample: 1,194 rows, operating-date range 2026-06-21 through 2026-07-29.

Primary classification table:

| Classification | Rows | Date range | Valid pregame | Odds timestamp present | Odds <= cutoff | Freshness verified | Feature lineage complete | Production eligible | Settled | Learning-label state | Must exclude from certified performance/calibration/official readiness/learning/trust |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| CERTIFIED_LIVE_PREGAME | 0 | N/A | 0 | 0 | 0 | 0 | 0 | 0 | 0 | no direct certified labels | no |
| VALID_BUT_PRE_CERTIFICATION | 100 | 2026-07-16 to 2026-07-29 | 100 | 100 | 100 | 100 | 100 | 0 | 49 | derivable read-only queue only | yes |
| POST_START | 90 | 2026-07-19 to 2026-07-23 | 0 | 90 | 90 | 90 | 90 | 0 | 90 | derivable read-only queue only | yes |
| POST_FINAL | 54 | 2026-07-12 to 2026-07-23 | 0 | 54 | 54 | 54 | 54 | 0 | 54 | derivable read-only queue only | yes |
| INVALID | 564 | 2026-06-21 to 2026-07-18 | 0 | 0 | 0 | 0 | 0 | 0 | 548 | no direct label evidence | yes |
| DATA_LINEAGE_INCOMPLETE | 0 | N/A | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N/A | yes if encountered |
| ODDS_FRESHNESS_UNVERIFIED | 386 | 2026-07-18 to 2026-07-28 | 383 | 386 | 386 | 0 | 386 | 0 | 347 | derivable read-only queue only | yes |
| FEATURE_LINEAGE_UNVERIFIED | 0 | N/A | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N/A | yes if encountered |
| LEGACY_UNTRUSTED | 0 | N/A | 0 | 0 | 0 | 0 | 0 | 0 | 0 | N/A | yes if encountered |

Classification flags, non-exclusive:

| Flag | Rows |
| --- | ---: |
| CERTIFIED_LIVE_PREGAME | 0 |
| VALID_BUT_PRE_CERTIFICATION | 483 |
| POST_START | 666 |
| POST_FINAL | 562 |
| INVALID | 564 |
| DATA_LINEAGE_INCOMPLETE | 564 |
| ODDS_FRESHNESS_UNVERIFIED | 1,094 |
| FEATURE_LINEAGE_UNVERIFIED | 0 |
| LEGACY_UNTRUSTED | 45 |

Interpretation:
- Existing MLB history is not all bad, but it is not certified production evidence.
- The 100 primary `VALID_BUT_PRE_CERTIFICATION` rows are audit-useful only. They must not count toward certified performance, calibration, Official Pick readiness, Learning Brain updates or production trust metrics until individually linked to a certified epoch with proven lineage.
- All 1,194 rows are excluded from certified production metrics today because `CERTIFIED_LIVE_PREGAME = 0`.

## 2. Certified Epoch Activation Criteria

Existing schema support:
- `prediction_epochs` exists as an additive governance contract in `202607270001_prediction_epoch_governance_v2.sql`.
- `prediction_history.prediction_epoch_id` and `prediction_history.prediction_epoch_key` are nullable.
- The migration explicitly does not seed, activate, backfill or mutate prediction rows.

Recommended epoch boundary:

`certified_prediction_epoch_start` should be a condition, not merely a date.

Safest start condition:

1. The epoch governance migration is applied and postcheck passes.
2. A manual seed creates one `SHADOW` epoch, not `ACTIVE`.
3. A live operating day starts after the seed is present.
4. The scheduler produces only `LIVE_PREGAME` rows for that epoch.
5. Each row proves:
   - event discovered before cutoff;
   - fresh odds timestamped before cutoff;
   - market and selection mapping valid;
   - complete feature snapshot lineage;
   - `generated_at <= cutoff_at < commence_time`;
   - no target-game result/stat/post-start input;
   - deterministic idempotent persistence;
   - settlement compatibility;
   - learning-label compatibility;
   - `trial=false`, `scrambled=false`, `production_eligible=false` until promotion review.
6. A read-only certification report confirms the first epoch day contains no post-start, post-final, invalid, stale, unlinked, duplicate or retrospective rows.
7. Only after manual approval may the epoch be marked `ACTIVE` for reporting scope. Activation alone must not mark rows `production_eligible=true`.

Rows before the boundary:
- remain queryable for audit and diagnostics;
- remain excluded from certified performance unless individually proven;
- remain excluded from calibration, Official Pick readiness and Learning Brain updates.

## 3. MLB Promotion-Readiness State Machine

State transitions:

`PREVIEW / QUARANTINED -> PRODUCTION_ELIGIBLE -> OFFICIAL_PICK_ELIGIBLE`

Row-level eligibility:

| Gate | Existing implementation | Readiness |
| --- | --- | --- |
| Pregame cutoff | `generated_at <= cutoff_at < commence_time` checked by policy/audits | required |
| Fresh odds | max 120 minutes in `RECOMMENDATION_THRESHOLDS_V1.maximumOddsAgeMinutes` | required |
| Valid odds/market/selection | supported markets: moneyline, spread, run_line, total | required |
| Feature lineage | feature snapshot id/key/version plus inline quality/sufficiency | required |
| Production flags | `production_eligible=true`, non-trial, non-scrambled | required |
| Epoch link | nullable columns exist, but no rows linked today | GOVERNANCE_GAP until activated |
| Settlement compatibility | result/status support exists | required |
| Learning-label compatibility | read-only derived queue exists; direct production label table not proven by this audit | GOVERNANCE_GAP |

Model-version eligibility:

| Gate | Existing threshold/behavior | Status |
| --- | --- | --- |
| Minimum calibration sample | 250 documented in `RECOMMENDATION_THRESHOLDS_V1.minimumCalibrationSample` | not proven for certified epoch |
| Maximum calibration error | 8 documented in `RECOMMENDATION_THRESHOLDS_V1.maximumCalibrationError` | not proven for certified epoch |
| Brier score threshold | no formal Official Pick promotion threshold | GOVERNANCE_GAP |
| ROI evidence | no formal promotion threshold | GOVERNANCE_GAP |
| Confidence reliability | no formal promotion threshold beyond row confidence | GOVERNANCE_GAP |
| Risk-grade reliability | no formal promotion threshold | GOVERNANCE_GAP |
| Model version freeze | model version persisted | required before promotion |

Sport-level readiness:

| Gate | Existing threshold/behavior | Status |
| --- | --- | --- |
| Settlement completeness | no formal sport promotion threshold found | GOVERNANCE_GAP |
| Missed-opportunity rate | no formal threshold found | GOVERNANCE_GAP |
| Scheduler cutoff integrity | code/audits exist; current legacy history is mixed | must prove in certified epoch |
| Provider budget/lineage | budget guards exist elsewhere; no provider calls in this audit | required for live use |

Market-level readiness:

| Gate | Existing threshold/behavior | Status |
| --- | --- | --- |
| Minimum market sample | 50 documented in `RECOMMENDATION_THRESHOLDS_V1.minimumMarketSample` | not certified by market epoch yet |
| Market odds and line completeness | stored odds snapshots exist for moneyline, run line/spread and total | partial |
| Market settlement support | settled prediction rows exist for moneyline, run line/spread and total | partial |
| First five/team totals | no stored historical odds evidence found | blocked |

Official Pick eligibility remains unchanged:
- minimum official edge: 5 percentage points;
- minimum official EV: 5%;
- minimum model probability: 52%;
- minimum official confidence: 65%;
- minimum feature quality: 60;
- minimum data sufficiency: 60;
- calibration status must be `acceptable` or `mature`;
- automatic production approval is false.

No threshold should be lowered in this phase.

## 4. Governance Gaps

1. No formal row promotion operation exists to move certified live MLB rows from quarantined preview to `production_eligible=true`.
2. `top-picks.service.ts` filters to `production_eligible=true`, while MLB preview persistence writes `production_eligible=false`.
3. `top-picks.service.ts` passes `calibrationStatus: 'probationary'`; Official Pick policy blocks probationary calibration.
4. No production-certified method currently derives `acceptable` or `mature` calibration status by sport, model version and market.
5. No formal Brier, ROI, confidence-reliability or risk-grade-reliability promotion thresholds are documented.
6. No formal missed-opportunity threshold is documented.
7. No direct learning-label table evidence was proven by this audit; learning evidence is derivable from settled rows plus feature snapshots only.
8. Epoch governance schema exists, but no epoch is active and no MLB rows are linked.

Proposed alternatives for review, not activation:
- Conservative: require all documented thresholds plus a manually reviewed calibration report for each sport/model/market before `production_eligible=true`.
- Shadow-first: activate a `SHADOW` epoch, collect live pregame rows for at least the documented minimum calibration sample, then review calibration and ROI evidence.
- Market-by-market: allow moneyline, run line and total to progress separately; keep unsupported markets blocked.

## 5. EV Mismatch Findings

Five rows differ from the current American-odds EV formula by more than 0.25 points.

| Prediction ID | Date | Event | Market | Selection | Odds | Model probability | Stored EV | Recomputed EV | Difference | Finding |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| b31c5fcf-c924-4ca8-addc-06b3ab57a710 | 2026-06-23 | Houston Astros @ Toronto Blue Jays | moneyline | Toronto Blue Jays | 1700 | 11.00 | 60.00 | 98.00 | -38.00 | legacy stored EV/input mismatch |
| e70be02b-a046-4e62-9e40-fb998950a316 | 2026-06-23 | Texas Rangers @ Miami Marlins | moneyline | Texas Rangers | 2000 | 9.00 | 60.00 | 89.00 | -29.00 | legacy stored EV/input mismatch |
| 474b4240-c12f-4232-8910-781b5b422ea3 | 2026-07-07 | New York Yankees @ Tampa Bay Rays | moneyline | New York Yankees | 1400 | 12.18 | 60.00 | 82.70 | -22.70 | legacy stored EV/input mismatch |
| 222432f8-5d12-4d5e-9963-186e8aace660 | 2026-07-07 | Athletics @ Detroit Tigers | moneyline | Athletics | 3300 | 6.77 | 60.00 | 130.18 | -70.18 | legacy stored EV/input mismatch |
| c6eff569-f910-49a9-ac65-aba7cfa2a647 | 2026-07-07 | Seattle Mariners @ Miami Marlins | moneyline | Miami Marlins | 290 | 54.79 | 100.00 | 113.68 | -13.68 | legacy stored EV/input mismatch |

Cause classification:
- Not rounding.
- Not no-vig normalization.
- Not favorite/underdog sign handling in current formula.
- Most likely legacy EV capping or earlier stored input behavior on non-certified rows.

Recommendation:
- Do not rewrite EV logic from this evidence alone.
- Exclude these rows from certified calibration and Official Pick readiness.
- Add a future read-only invariant check for newly epoch-linked live rows: stored EV must match the canonical formula within a small tolerance.

## 6. Historical Market Readiness Matrix

| Market | Historical odds rows | Feature rows | Settled prediction rows | Bookmakers/source | Line/handicap | Readiness |
| --- | ---: | ---: | ---: | --- | --- | --- |
| moneyline | 17,985 | 702 | 727 | SportsDataIO and The Odds API; multiple books plus Consensus | not applicable | REPLAY_DESIGN_READY_NOT_CERTIFIED |
| run line | 17,801 | 707 | 181 | SportsDataIO and The Odds API; multiple books plus Consensus | yes | REPLAY_DESIGN_READY_NOT_CERTIFIED |
| total | 17,988 | 710 | 180 | SportsDataIO and The Odds API; multiple books plus Consensus | yes | REPLAY_DESIGN_READY_NOT_CERTIFIED |
| first five moneyline | 0 | 0 | 0 | none | no | HISTORICAL_MARKET_DATA_MISSING |
| first five run line | 0 | 0 | 0 | none | no | HISTORICAL_MARKET_DATA_MISSING |
| first five total | 0 | 0 | 0 | none | no | HISTORICAL_MARKET_DATA_MISSING |
| team totals | 0 | 0 | 0 | none | no | HISTORICAL_MARKET_DATA_MISSING |

Moneyline, run line and total are design-ready only. They still require event-by-event proof that every feature row was generated from information knowable before cutoff and that replay will not expose result data before prediction persistence.

Unsupported historical markets must remain blocked.

## 7. Leakage-Safe Replay Execution Plan

Design only. Do not execute replay in this phase.

For each historical event in chronological order:

1. Set a simulated clock to a pre-cutoff time.
2. Load only event, team, odds, line, bookmaker and feature data with timestamps before the simulated cutoff.
3. Reject any event where odds, features, result linkage or event identity is missing or ambiguous.
4. Generate predictions only for historically available markets.
5. Persist immutable replay rows with `prediction_origin = HISTORICAL_WALK_FORWARD_REPLAY`.
6. Assert result/status/postgame stats are not visible to prediction generation.
7. Expose the completed result only after prediction persistence.
8. Settle replay predictions.
9. Create replay learning labels.
10. Advance to the next event.

Replay isolation:
- Replay rows must never be `LIVE_PREGAME`.
- Replay rows must not update production Learning Brain weights.
- Replay rows must not become Official Picks.
- Replay output can support calibration review only after leakage certification passes.

Live prediction origin:
- Future live rows should use `prediction_origin = LIVE_PREGAME`.

## 8. Recommended Next Implementation Phase

Next phase:

`PREDICTION_EPOCH_SHADOW_READINESS_IMPLEMENTATION_V1`

Scope:
- Add read-only epoch readiness endpoints/reports over existing epoch columns.
- Add non-mutating validators for `LIVE_PREGAME` row invariants.
- Add an explicit promotion review artifact format for sport/model/market.
- Add canonical EV invariant validation for future epoch-linked rows.
- Do not activate the epoch.
- Do not backfill legacy rows.
- Do not mark any preview row production eligible.
- Do not run replay.

Definitive recommendation:

`C. A mixed classification is required.`

Existing history can be partially classified for audit and replay-design readiness, but it cannot be certified wholesale. All prior rows should remain quarantined from certified production metrics, calibration, Official Pick readiness and Learning Brain updates unless individually proven under the new epoch governance criteria.

