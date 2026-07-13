# Multi-Sport Feature Registry V1

## Status

Completed as a provider-independent registry over Feature Store Core definitions. It does not require persistence, migrations or provider calls.

## Objective

Map generic Feature Store Core definitions into sport, market and model-specific feature sets so future prediction engines can request the correct features without reading provider payload fields.

## Implementation

- Service: `src/services/multi-sport-feature-registry.service.ts`
- Dashboard panel: `src/components/dashboard/MultiSportFeatureRegistryPanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/features/registry`
  - `GET /api/features/registry/lookup`
  - `GET /api/features/registry/validation`

## Feature Set Contract

Each feature set declares:

- sport key
- league key
- market
- model version
- readiness status
- required features
- optional features
- minimum data sufficiency score
- minimum feature quality score
- fallback policy
- warnings

## Current Registry Coverage

Registered feature sets include:

- NBA moneyline, spread and total: ready
- MLB moneyline: partial
- NFL spread: partial
- NHL moneyline: partial
- Soccer moneyline: partial
- Tennis moneyline: unsupported
- UFC moneyline: unsupported

Partial or unsupported states are explicit because sport-specific features such as pitchers, quarterbacks, goalies, draw-aware soccer context, tennis player form and fighter form are not yet defined.

## Validation

`GET /api/features/registry/validation` verifies:

- required roadmap sports have registry entries
- required features exist in Feature Store Core
- unsupported feature sets are reported explicitly
- provider calls made: `0`

## Future Work

- NBA Feature Store Integration.
- Sport-specific feature extensions for MLB, NFL, NHL, soccer, tennis and UFC.
- Durable feature snapshot persistence if approved.
- Prediction Engine V5 feature-set selection.
