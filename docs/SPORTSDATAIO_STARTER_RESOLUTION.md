# SportsDataIO Starter Resolution

Status: Implemented
Version: V1

## Documented GamesByDate Starter Fields

The MLB provider capability audit tracks documented SportsDataIO starter fields from GamesByDate, including probable and starting pitcher IDs/names.

## Current Policy

Starter data can support pitcher projections only when identity is provider-backed and event-linked.

User-visible pitcher rows remain blocked when:

- Starter identity is absent.
- Starter identity is unverified.
- Event mapping is missing.
- Player mapping is missing or ambiguous.
- Projection units fail plausibility checks.

## Non-Inference

The platform must not claim confirmed lineup absence or confirmed pitcher participation without provider-backed evidence.
