# Run Line V2 Prospective Shadow — Sep 17 Operational Audit

Date: 2026-09-17

Status: `PREGAME_PRICING_CAPTURED_FORWARD_FREEZE_NOT_RECONSTRUCTED`

## Candidate boundary

Frozen candidate:

`rl_v2_home_p15_alt_favorite_tsh_q92_v1`

Frozen score threshold:

`2.065112`

No candidate parameter, threshold, feature formula, or prospective start date is changed by this audit.

## Pregame market evidence that exists

Canonical `sports_sync_jobs` readback for Sep 17 confirms the existing daily acquisition completed before the games:

### Standard market capture

- source: `RUNLINE_V2_TOTALS_PROSPECTIVE_DAILY_CAPTURE`
- completed: `2026-09-17T10:15:24.264Z`
- provider: The Odds API
- mapped events: **9**
- stored rows across Moneyline / Run Line / Total: **576**
- provider calls: **1**
- provider credits consumed: **3**
- errors: **0**

### Alternate HOME +1.5 capture

- job: `runline_v2_home_p15_alt_shadow_capture_v1`
- completed: `2026-09-17T10:15:29.121Z`
- candidate: `rl_v2_home_p15_alt_favorite_tsh_q92_v1`
- standard HOME -1.5 eligible events: **4**
- alternate rows captured: **50**
- HOME +1.5 events captured: **4**
- provider calls: **4**
- provider credits consumed: **4**
- requests remaining after capture: **5,601**
- errors: **0**
- research-only: **true**
- production eligible: **false**

This proves Sep 17 had real pregame standard Run Line evidence and real alternate HOME +1.5 price evidence for the four market-eligible events.

## Missing forward freeze

No canonical job exists for:

- `runline_v2_home_p15_alt_forward_freeze_v1`
- `runline_v2_home_p15_alt_forward_settlement_v1`

Therefore Sep 17 must **not** be counted as a scored prospective selection date for this candidate.

The 10:45 AM Puerto Rico execution was inspected in Vercel. The scheduled request:

`GET /api/cron/mlb-statcast-daily`

returned HTTP **500** at `2026-09-17T14:45:49Z` on production deployment:

`dpl_6bSHMZEZtFt6jdfwohmzKg8d7k26`

That deployment was running Pick Analyzer revision:

`dfd90b65003dbe0950fb3378887e7c0b67878d4b`

The failure occurred before a Run Line forward-freeze job was persisted.

## Corrective runtime already merged

Commit:

`f0a84f3dba5b10b003ce60befb497b09b254e2f1`

changed the existing scheduler so the independent Run Line shadow freeze executes before the Moneyline freeze and a Moneyline runtime exception is converted into an explicit fail-closed result rather than aborting the Run Line evidence stage.

Current Pick Analyzer main includes that correction. This audit does not claim a future freeze will succeed; it only records that the Sep 17 failure mode has been isolated in the current runtime.

## Sep 17 disposition

Valid evidence retained:

- standard pregame Run Line capture: **YES**
- real pregame alternate HOME +1.5 quotes: **YES**
- pregame frozen score/selection ledger: **NO**
- settlement: **NO**
- ROI / EV evidence for this date: **NO**

No retrospective score freeze will be created after first pitch. No postgame information will be used to fabricate a missing pregame state.

## Safety

- candidate retuned: **false**
- Official Picks modified: **false**
- APOSTAR activated: **false**
- production promotion: **false**
- historical Odds API calls: **0**
- missing freeze reconstructed: **false**
