# Recommendation Eligibility Policy V1

Status: implemented as a shared production-safety policy.

## Canonical Service

- Service: `src/services/recommendation-eligibility-policy.service.ts`
- Builds on: `src/services/production-data-gate.service.ts`
- API routes added: 0
- Provider calls: 0
- Remote mutations: 0

## Statuses

- `ANALYZED_ONLY`: technical or quarantined analysis row; not a wager.
- `INELIGIBLE`: production row blocked by required conditions.
- `WATCH`: positive value signal that still misses official gates.
- `QUALIFIED`: official-pick eligible under current policy.
- `BEST_BET_CANDIDATE`: stronger qualified candidate.
- `PLAY_OF_DAY_CANDIDATE`: strongest candidate; requires stricter gates.

Official consumers may use only `QUALIFIED`, `BEST_BET_CANDIDATE` and
`PLAY_OF_DAY_CANDIDATE`.

## Conservative Defaults

The defaults intentionally produce fewer picks:

- minimum official edge: 5 percentage points
- minimum official EV: 5%
- minimum official confidence: 65%
- minimum model probability: 52%
- minimum feature quality: 60
- minimum data sufficiency: 60
- maximum odds age: 120 minutes
- minimum calibration sample: 250 settled production rows
- automatic production approval: false

Calibration remains probationary until enough settled production-eligible
predictions exist by sport, market, model version and feature-set version.

## Required Gates

An official recommendation must pass Production Data Gate V1, be future and
unsettled, have mapped participants, supported market, genuine offered odds,
odds before cutoff, valid immutable feature snapshot, model and feature-set
versions, valid probability, sufficient quality/sufficiency, acceptable
calibration, positive edge and EV, no unresolved critical mappings, no stale
odds, no critical leakage warnings and no duplicate recommendation identity.

Historical results never change eligibility.

