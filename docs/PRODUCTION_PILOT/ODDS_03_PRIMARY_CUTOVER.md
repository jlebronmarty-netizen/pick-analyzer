# ODDS-03 / SDIO-EXIT-02 Primary Odds Cutover

Status: `DUAL_READ_IMPLEMENTED_NOT_PRODUCT_PROMOTED`

Starting commit: `dc47be3ba0102b29fa68c78f9e3b1dd2a74d0797`

ODDS-03 implements the bounded reversible foundation required before The Odds API can become the production product odds authority. It does not cancel SportsDataIO and does not promote The Odds API to product authority in this local certification.

## What Changed

- Added explicit odds authority stages.
- Added `CERTIFIED_BOOK_SET_V1`: FanDuel, DraftKings, BetMGM, Caesars.
- Added read-only `/api/operations/odds-primary-authority`.
- Added planner authority metadata.
- Isolated The Odds API current-odds acquisition to `THE_ODDS_API_KEY`.
- Added deterministic lifecycle-scoped event mapping fixtures for CIN @ WSH, TB @ SEA, ATH/OAK, future, started and final events.
- Added best-fresh exact-line certified-book price selection.
- Added executable gated line-versioned re-prediction contract.

## Authority Before

SportsDataIO was the production odds authority.

## Authority After Local Implementation

`STAGE_1_DUAL_READ`.

SportsDataIO remains product odds authority. The Odds API is configured as primary odds candidate/internal comparison source only.

## Promotion Gate

Promotion to `THE_ODDS_API_PRIMARY_PRODUCT` is not authorized by this commit. It requires production evidence that mapping, coverage, freshness, exact-line safety, re-prediction, budget health, scheduler health, settlement safety, recommendation exposure policy and rollback capability all pass.

## SportsDataIO Exit

SportsDataIO odds exit is not complete. If future production proof passes, odds-specific SportsDataIO polling may become ready for a separately authorized disable stage. Full SportsDataIO cancellation remains blocked by SDIO-EXIT-01 because schedule, event status, starters, team stats, player stats and multi-sport dependencies remain.

## Certification Safety

- Provider calls during local certification: 0.
- Database mutations during local certification: 0.
- SportsDataIO cancelled: false.
- SportsDataIO disabled: false.
- ODDS-03 production promotion: false.
- HR-03 remains shadow-only.
- Official Pick policy unchanged.
- No local Windows server smoke run.
