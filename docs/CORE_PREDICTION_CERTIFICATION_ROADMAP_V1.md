# Core Prediction Certification Roadmap V1

Status: audit complete, production betting engine not certified.

Generated from existing repository evidence and the read-only MLB certification audit stored at `docs/certified-prediction-epoch-mlb-readiness-audit-v1.json`.

## Executive Answer

Pick Analyzer is capable of becoming a production betting engine, but it is not yet trustworthy enough to recommend real-money bets every day.

Current MLB evidence proves the pipeline can discover events, ingest odds, build features, persist pregame predictions, settle rows and derive learning queues. It does not yet prove certified live pregame lineage, epoch linkage, calibrated positive expected value, reliable Official Pick promotion or walk-forward profitability.

## Current Certification Status

| Area | Status | Evidence |
| --- | --- | --- |
| MLB events | Partial | Event identity and doubleheader contracts exist; full operating-day completeness still needs daily certification. |
| MLB odds | Partial | 53,774 stored core-market MLB odds rows across moneyline, run line and totals; freshness remains unverified for many prediction rows. |
| MLB features | Partial | Feature snapshots exist for core markets; certification requires event-by-event as-of checks. |
| MLB predictions | Shadow/pre-certification | 1,194 rows audited; 100 valid pregame rows; 0 certified live pregame rows. |
| Current Board | Projection-only | Displays current model rows, but official eligibility remains blocked by `production_eligible=false` and absent epoch linkage. |
| Official Picks | Not certified | 0 certified live pregame rows are eligible for production recommendation metrics. |
| Settlement | Partial | Settled rows exist and settlement primitives cover moneyline, spread and totals; first-half markets remain unsupported. |
| Learning | Derivable queue only | Settled feature-linked rows can feed future labels, but direct certified learning-label evidence is not active. |
| Historical Replay | Audit only | Core markets are design-ready but not walk-forward certified; expanded markets are missing historical evidence. |

## MLB Audit Evidence

Read-only production audit:

| Metric | Value |
| --- | ---: |
| MLB prediction rows audited | 1,194 |
| Date range | 2026-06-21 to 2026-07-29 |
| Certified live pregame rows | 0 |
| Valid but pre-certification rows | 100 |
| Valid pregame rows with fresh odds and complete lineage | 100 |
| Production eligible rows | 0 |
| Epoch-linked rows | 0 |
| Post-start rows | 90 |
| Post-final rows | 54 |
| Invalid rows | 564 |
| Odds freshness unverified rows | 386 |
| EV mismatch audit findings | 5 |
| Provider calls during audit | 0 |
| Production mutations during audit | 0 |

Conclusion: use valid pre-certification rows for shadow evidence only. Exclude every non-certified row from certified performance, calibration, Official Pick readiness, Learning Brain updates and production trust metrics.

## Prediction Lifecycle

Target lifecycle:

```text
DISCOVERED
  -> ODDS_AVAILABLE
  -> FEATURES_READY
  -> PREDICTION_GENERATED
  -> PREGAME_CERTIFIED
  -> CURRENT_BOARD
  -> OFFICIAL_PICK_ELIGIBLE
  -> OFFICIAL_PICK
  -> SETTLED
  -> LEARNING_LABEL
  -> CALIBRATION
  -> MODEL_EVOLUTION
```

Current MLB entry and exit points:

| Stage | Current State | Gap |
| --- | --- | --- |
| DISCOVERED | Supported by schedule/event services. | Daily completeness, doubleheader and postponement certification must be measured per slate. |
| ODDS_AVAILABLE | Supported by stored odds snapshots. | Freshness SLA is shadow-only; missed refreshes are not yet persisted as operating evidence. |
| FEATURES_READY | Supported by feature snapshots. | As-of-time and leakage-free feature completeness must be certified per prediction. |
| PREDICTION_GENERATED | Supported by stored MLB prediction rows. | Mixed legacy, preview and pre-certification rows need strict separation. |
| PREGAME_CERTIFIED | Not active. | Requires nullable governance migration, shadow epoch seed, row certification and activation approval. |
| CURRENT_BOARD | Active projection surface. | Board may show quarantined/pre-certification rows, but they must not become Official Picks. |
| OFFICIAL_PICK_ELIGIBLE | Blocked. | No certified live pregame rows and no active certified epoch. |
| OFFICIAL_PICK | Blocked. | Official Pick policy should remain unchanged until certification evidence exists. |
| SETTLED | Partial. | Moneyline, spread and totals supported; first-half and prop settlement remain blocked. |
| LEARNING_LABEL | Derivable only. | Certified learning labels are not active for this epoch path. |
| CALIBRATION | Partial/reporting. | Certified calibration must exclude legacy and pre-certification rows. |
| MODEL_EVOLUTION | Blocked. | No Learning Brain weight changes or model promotion until certified evidence exists. |

## Betting Readiness Score Design

Informational only. This must not replace Trust, Official Pick policy or existing model formulas.

| Dimension | Weight | Measurement |
| --- | ---: | --- |
| Data Quality | 10 | Missing fields, duplicate keys, identity conflicts, provider provenance. |
| Odds Freshness | 12 | Age at generation, provider timestamp availability, cutoff-safe snapshots. |
| Prediction Coverage | 10 | Scheduled games with all supported market predictions before cutoff. |
| Feature Completeness | 10 | Feature snapshot lineage, as-of timestamps, leakage status. |
| Calibration | 10 | Brier score, calibration error and reliability buckets on certified rows only. |
| Settlement Integrity | 10 | Final-result match rate, moneyline/spread/total grading accuracy, void handling. |
| Learning Integrity | 8 | Feature-linked settled labels, lineage, no trial/scrambled leakage. |
| Official Pick Readiness | 8 | Count passing row certification plus unchanged policy gates. |
| Market Coverage | 7 | Moneyline, run line, totals and future market certification coverage. |
| Scheduler Reliability | 5 | Refresh opportunities completed, lock safety, missed refreshes. |
| Historical Validation | 5 | Walk-forward replay readiness without leakage. |
| Missed Opportunity Rate | 5 | Certified candidates lost due stale odds, missing features or missed refresh windows. |

Initial classification from current evidence: `BLOCKED_TO_SHADOW`, because certified live pregame rows are 0.

## Shadow Certification Program

Do not activate the certified epoch until the system completes a live shadow observation period.

Minimum requirement:

- At least 7 full MLB operating slates.
- At least 250 certified shadow pregame predictions overall.
- At least 50 certified shadow predictions per core market before claiming market-level readiness.
- Zero critical cutoff violations.
- Zero duplicate deterministic prediction keys.
- Zero duplicate deterministic odds keys for current-state rows.
- 95 percent or better scheduled-event discovery coverage per slate, with every miss explained.
- 95 percent or better supported-market prediction coverage for discovered games with odds.
- Odds freshness within the shadow SLA: <=12 minutes normally and <=7 minutes in the final 90-minute window.
- Settlement compatibility proven for every completed certified shadow row.
- Learning-label compatibility proven without changing Learning Brain weights.
- Official Pick candidates counted but not promoted.

Each slate must record:

- scheduled events;
- discovered events;
- doubleheaders;
- postponements or voids;
- games with odds;
- odds age and timestamp source;
- expected refresh opportunities;
- completed refresh opportunities;
- missed refreshes;
- predictions generated before cutoff;
- cutoff violations;
- feature completeness;
- Official Pick candidates;
- settlement outcomes;
- learning-label compatibility;
- duplicate prediction and odds keys;
- provider calls;
- database writes.

Activation condition: all required shadow gates pass across the observation period, governance SQL has explicit approval, epoch rows are seeded by approved SQL, and production scheduler ownership is proven.

## Historical Replay Readiness

Audit only. Historical Replay remains disabled.

| Market | Classification | Reason |
| --- | --- | --- |
| Moneyline | PARTIAL | 17,987 odds rows, 704 feature rows and 727 settled prediction rows; walk-forward clock still not certified. |
| Run Line | PARTIAL | 17,800 odds rows, 707 feature rows and 181 settled prediction rows; line/handicap mapping needs replay certification. |
| Totals | PARTIAL | 17,987 odds rows, 708 feature rows and 180 settled prediction rows; totals settlement exists but replay clock still unproven. |
| First Five ML | MISSING_ODDS | No historical odds, features or settled rows in audit. |
| First Five RL | MISSING_ODDS | No historical odds, features or settled rows in audit. |
| First Five Totals | MISSING_ODDS | No historical odds, features or settled rows in audit. |
| Team Totals | MISSING_ODDS | No historical odds, features or settled rows in audit. |
| Player Props | PARTIAL | Genuine current pitcher-outs rows exist, but historical odds, full props features, settlement and replay certification are missing. |

No market is `READY` for Historical Replay until an event-by-event walk-forward clock proves feature, odds and result availability before each prediction cutoff.

## Multi-Sport Framework

| Sport | Certification Frame |
| --- | --- |
| MLB | First certification target; shadow-only until epoch and slate evidence pass. |
| NBA | Foundation/trial evidence only; production prediction certification blocked. |
| NFL | Preview lifecycle evidence exists, but production data foundation remains blocked/incomplete. |
| Soccer | Competition-specific only; no global production claim. |
| NHL | Preview/foundation only; production certification blocked. |
| Tennis | Event-driven empty/blocked until source, odds, result and feature coverage exists. |
| UFC | Event-driven partial/blocked; canonical identity, features, settlement and learning gates required. |
| BSN | Custom-league partial; source provenance and market coverage remain blockers. |

## Roadmap Reset

Top priorities now:

1. Core Production Stability.
2. Prediction Certification.
3. Shadow Observation.
4. Certified Epoch.
5. Historical Walk Forward Replay.
6. Official Pick Certification.
7. Multi-Sport Production Certification.

Deferred until after certification:

- new dashboards;
- new recommendation surfaces;
- cosmetic product expansion;
- Portfolio Intelligence expansion;
- Player Prop EV expansion;
- unsupported market recommendation UX.

## Reasons Not To Trust Real-Money Recommendations Today

- Zero MLB rows are certified live pregame.
- No prediction row is `production_eligible=true`.
- No audited row is linked to a certified active epoch.
- 386 rows have unverified odds freshness.
- 90 rows are classified post-start and 54 post-final.
- 564 rows are invalid for certification metrics.
- EV mismatch audit found 5 rows needing review.
- Official Pick eligibility has no certified row population to operate on.
- Learning labels are derivable but not certified active lineage.
- Historical replay has not proven a leakage-free walk-forward clock.
- First Five, Team Totals and most prop markets lack historical odds/features/settlement coverage.
- Fixed 5-minute production refresh is not quota/scheduler certified.
- Vercel Standard build OOM still blocks confident production deployment flow.

## Exact Next Implementation Phase

`CORE_PREDICTION_CERTIFICATION_AUDIT_V2`

Scope:

- build a read-only, reusable certification auditor over the existing services;
- no model, probability, confidence, quality, Trust, Official Pick, Learning Brain or scheduler changes;
- no Historical Replay execution;
- no epoch activation;
- no new dashboards;
- produce daily MLB slate certification evidence for events, odds, features, predictions, Current Board, Official Pick eligibility, settlement and learning compatibility.
