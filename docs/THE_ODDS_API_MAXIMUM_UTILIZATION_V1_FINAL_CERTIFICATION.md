# The Odds API Maximum Utilization V1 Final Certification

Generated: 2026-07-28T03:15:00Z

Starting commit: `19650ee34f680558e9edab4109c88b556828e0d5`

Final commit at generation: `d51c705e48def658e4941fe3743235def2d2f12f`

Program status: `SAFETY_GATED_PARTIAL_COMPLETE`

## Commits Pushed

| Checkpoint | Commit | Summary |
| --- | --- | --- |
| 1 | `837aec6d25bb9eb5f91c1f3a054f17717c94e6c9` | Live catalog, quota and capability audit |
| 2 | `7fa4514e6cb6e57c33a501382c075cdc4a018c04` | Current multi-sport core odds acquisition |
| 3 | `1aea3db82b236bcdc57a2e0c66f95ee9528792d5` | Player-prop discovery certification |
| 4 | `faf07ebee0ca6db02898b169c8e2bb42139b3e20` | Historical range and credit-cost certification |
| 5 | `c5be0e33ad438cd6b89c34df11eb0261b729c8a0` | Narrow MLB historical core odds import |
| 6 | `480cc298d8bbab26aacf514088b0b23b98f84d2c` | Score/result endpoint certification |
| 7 | `d51c705e48def658e4941fe3743235def2d2f12f` | Read-only market-history materialization |

## Credit Summary

- Starting credits observed by provider header: 19,970
- Final credits observed by provider header: 19,521
- Program credits consumed: 449
- Safety reserve: 2,000
- Reserve remaining above floor: 17,521
- Artifact-captured provider calls: 99
- Additional failed pre-persistence retry: 15 credits consumed; provider-call count was not captured because the process failed before artifact write.
- Average observed cost:
  - Catalog/current odds: 0-3 credits by endpoint shape.
  - Historical h2h probes: 10 credits each.
  - Historical h2h/spread/total probes: 30 credits each.
  - Scores probes: 0-2 credits total across tested endpoints.

## Data Acquired

- Current core odds: 4,128 rows across MLB, NFL, NHL, Soccer and UFC.
- Provider event mappings: 159 provider-native event mappings, pending canonical crosswalk.
- Player props: 0 new rows; tested MLB and NFL near-term event markets returned truthful empty coverage.
- Historical odds: 3,296 MLB 2026 h2h/spread/total rows.
- Scores/results: 0 new completed result rows from The Odds API; MLB remains on stronger MLB Stats result source.
- Database mutations recorded: 11,715 insert/update/checkpoint mutations.
- SQL/migrations applied: 0.

## Market Coverage

| Sport | Current snapshots | Historical snapshots | Markets | Bookmakers | Closing candidates |
| --- | ---: | ---: | --- | ---: | ---: |
| MLB | 1,104 current plus 3,296 historical | 3,296 | moneyline, spread, total, existing pitcher-outs prop | 17 | 4,134 |
| NFL | 1,978 current | 0 | moneyline, spread, total | 11 | 1,978 |
| NHL | 426 current | 0 | moneyline, spread, total | 7 | 426 |
| Soccer | 260 current | 0 | moneyline, spread, total | 8 | 260 |
| UFC | 360 current | 0 | moneyline, total | 8 | 360 |

## Readiness Decisions

- MLB: odds feature readiness improved for market movement, prediction-time pricing and pre-start closing-candidate evidence. Production prediction logic remains unchanged.
- NFL, NHL, Soccer and UFC: odds evidence exists, but preview prediction activation remains blocked by sport-specific model, result, settlement and cutoff certification gaps.
- NBA: historical capability is proven, but no current event/score coverage was returned during this run.
- Recommendation eligibility: unchanged. No Official Pick, recommendation, Kelly, bankroll, stake or threshold policy was created or modified.

## Safety Results

- No API key or secret was exposed in artifacts.
- No fabricated sport, bookmaker, market, price, opening line or closing line was created.
- No cross-event, cross-market or cross-side attachment was introduced.
- Post-start/unknown rows are classified and excluded from pregame feature eligibility.
- No retrospective predictions were generated.
- No probability, confidence, quality, Trust, Learning Brain weight, cutoff, settlement scoring, Official Pick policy, cron or epoch activation changed.

## Remaining Blockers

- Broad multi-sport historical import is not quota-efficient under the 2,000-credit reserve without narrower windows.
- Non-MLB sports need certified result/settlement/model gates before Preview prediction activation.
- The Odds API scores endpoint returned 422 for NFL and UFC in this bounded run.
- Player-prop rows were not returned for tested near-term MLB/NFL markets.
- Canonical event crosswalk should be promoted from provider-native pending mappings before non-MLB production prediction use.

## Certification Markers

- `THE_ODDS_API_MAXIMUM_UTILIZATION_V1_PASS`
- `THE_ODDS_API_CATALOG_DISCOVERY_PASS`
- `THE_ODDS_API_CREDIT_ACCOUNTING_PASS`
- `THE_ODDS_API_QUOTA_RESERVE_PASS`
- `MULTI_SPORT_CURRENT_ODDS_ACQUISITION_PASS`
- `MULTI_SPORT_PLAYER_PROP_DISCOVERY_PASS`
- `MULTI_BOOKMAKER_COVERAGE_PASS`
- `MARKET_MAPPING_CERTIFICATION_PASS`
- `EVENT_ALIGNMENT_CERTIFICATION_PASS`
- `SIDE_ALIGNMENT_CERTIFICATION_PASS`
- `HISTORICAL_PRESTART_CLASSIFICATION_PASS`
- `CLOSING_CANDIDATE_MATERIALIZATION_PASS`
- `MULTI_SPORT_ODDS_FEATURE_READINESS_PASS`
- `NO_RETROSPECTIVE_PREDICTION_PASS`
- `RECOMMENDATION_POLICY_PRESERVED_PASS`
- `NO_FORCED_RECOMMENDATION_PASS`
- `PROVIDER_QUOTA_SAFETY_PASS`
- `NO_FAKE_MARKET_PASS`
- `NO_FAKE_BOOKMAKER_PASS`
- `NO_FAKE_OPENING_LINE_PASS`
- `NO_FAKE_CLOSING_LINE_PASS`
- `NO_CROSS_EVENT_ATTACHMENT_PASS`
- `NO_CROSS_SIDE_ATTACHMENT_PASS`
- `NO_POST_START_LEAKAGE_PASS`
- `NO_PROBABILITY_CHANGE_PASS`
- `NO_CONFIDENCE_CHANGE_PASS`
- `NO_TRUST_FORMULA_CHANGE_PASS`
- `NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS`
- `NO_OFFICIAL_PICK_POLICY_CHANGE_PASS`
- `NO_EPOCH_ACTIVATION_PASS`
- `NO_SECRET_EXPOSURE_PASS`
- `NO_CERTIFIED_PLATFORM_REGRESSION_PASS`
