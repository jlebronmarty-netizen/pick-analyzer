# SportsDataIO Endpoint Capabilities

Status: Implemented
Version: V1

## Status Labels

- `ACCESSIBLE`: stored or pilot evidence supports a current narrow use.
- `ACCESSIBLE_PARTIAL`: provider or stored evidence exists, but field completeness or normalization is incomplete.
- `ACCESSIBLE_EMPTY`: endpoint returned HTTP 200 with zero rows for the tested scope.
- `SUBSCRIPTION_BLOCKED`: endpoint belongs to enterprise/currently unavailable subscription surface.
- `BLOCKED_BY_POLICY`: endpoint is cataloged but intentionally excluded from validation or production use.
- `CATALOG_ONLY`: endpoint is known but has no runtime evidence in the stored repository state.
- `UNTESTED`: endpoint was confirmed/cataloged but not called in the current validation batch.
- `UNKNOWN`: no safe classification exists.

## Current Production MLB Markets

Supported production market families remain:

- Moneyline
- Run line
- Full game total

No new SportsDataIO endpoint discovered by V1 changes Current Board, official-pick thresholds or settlement policy.

## Blocked Families

- First five
- Team totals
- NRFI/YRFI
- Pitcher props
- Batter props
- Alternate lines
- Detailed injury feed
- Confirmed lineup feed under current Discovery Lab access

These remain blocked until provider endpoint evidence, normalized persistence, feature builders, validation, settlement, replay and dashboard support exist.
