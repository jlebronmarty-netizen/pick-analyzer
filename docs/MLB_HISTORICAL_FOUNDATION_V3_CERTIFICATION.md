# MLB Historical Foundation V3 Certification

Status: certified core/partial foundation; full historical completion remains blocked until approved imports fill documented gaps.

This phase certifies the MLB historical foundation prepared by Phases B1 through B5. It does not execute provider calls, imports, SQL, feature rebuilds, retrospective prediction generation, settlement changes, epoch activation, scheduler changes, market sync, EV calculation, Kelly calculation or recommendation logic.

## Certification Scope

Included:

- season windows and plan-only import manifests
- event/result reconciliation contract
- boxscore/stat reconciliation contract
- player, starter and market identity rules
- current standard market storage contract
- genuine stored player-prop coverage boundary
- temporal/as-of safety rules
- provider-call and mutation accounting

Excluded:

- live or historical provider execution
- production database mutations
- historical odds retrieval
- opening/closing line backfill
- feature rebuild execution
- retrospective prediction creation
- official-pick promotion
- Player Prop EV V2
- Portfolio Intelligence

## Stored MLB Coverage Evidence

| Dataset | Stored evidence | Certification state | Notes |
| --- | ---: | --- | --- |
| sport teams | 30 | core available | MLB team dimension exists |
| sport players | 7389 | core available | canonical/player-provider identity exists but still requires deterministic import rules |
| provider identities | 59239 | core available | exact provider mappings are available |
| sport events | 4922 | core available | 4012 completed events and 847 future events observed in baseline |
| sport results | 471 | partial/import-required | result rows are materially below completed-event count |
| standings | 60 | partial/current-ready | stored standings exist |
| team/game stats | 2926 | partial/import-required | useful but not full completed-event coverage |
| player stats | 47232 | partial/import-required | useful but not full completed-event coverage |
| boxscores | 2926 | partial/import-required | useful but not full completed-event coverage |
| starters/lineups | 27 | partial/import-required | starter history requires approved completion path |
| injuries | 0 | empty/provider-blocked | no fabricated injury rows |
| odds snapshots | 48569 | partial/current-ready | standard current markets available; historical open/close not certified |
| genuine player props | 11 | partial/projection-gated | recorded-outs rows only, no cross-event attachment |
| features | 72223 | available/as-of constrained | no feature rebuild executed |
| predictions | 1110 | preserved legacy rows | no retrospective prediction generation |
| settlements | 837 | preserved legacy rows | no settlement mutation |

## Foundation Verdict

MLB is certified as the strongest stored foundation in the repository, but not certified as historically complete.

Certified:

- season windows are explicit and safe
- import manifests are bounded and plan-only
- event identity and doubleheader safeguards are defined
- result/stat/boxscore idempotency contracts are defined
- player and starter identity persistence is deterministic-only
- normalized-only and ambiguous identities remain blocked
- current standard market storage is documented
- genuine player-prop rows remain projection-gated and no fake lines are allowed
- temporal leakage protections are preserved
- provider calls remain 0
- remote and production mutations remain 0

Not certified complete:

- completed-event result coverage
- full team/game stats
- full player stats
- full boxscores
- historical starter/lineup coverage
- injury coverage
- historical odds/opening/closing line coverage
- broader player props and alternate markets

## Next Approved Work Required

Full MLB completion requires a later explicit approval gate for one or more of:

- stored-data-only result import where source files are locally available
- approved provider result/stat import with budget and mutation limits
- Retrosheet-backed historical game/stat import with provenance review
- starter/lineup completion with deterministic identity postchecks
- market-history import only after entitlement, cost and historical-odds approval

Until that happens, downstream systems must continue treating MLB as core/partial rather than complete.

## Certification Markers

- `MLB_HISTORICAL_FOUNDATION_V3_CORE_PARTIAL_PASS`
- `MLB_HISTORICAL_FOUNDATION_V3_NO_FULL_COMPLETION_OVERCLAIM_PASS`
- `MLB_TEMPORAL_SAFETY_V3_PASS`
- `MLB_IMPORT_BLOCKERS_RECORDED_PASS`
- `NO_PROVIDER_CALL_B6_PASS`
- `NO_REMOTE_MUTATION_B6_PASS`
- `NO_HISTORICAL_ODDS_B6_PASS`
- `NO_RETROSPECTIVE_PREDICTIONS_B6_PASS`

Provider calls: 0

Remote mutations: 0

Production mutations: 0

Historical odds calls: 0

Retrospective predictions generated: 0
