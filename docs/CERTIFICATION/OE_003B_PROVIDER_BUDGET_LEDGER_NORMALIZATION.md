# OE-003B Provider Budget Ledger Normalization Certification

Status: IMPLEMENTED PENDING PRODUCTION CERTIFICATION

## Summary

OE-003B adds a canonical provider-budget ledger and authorization contract over the existing app-ledger evidence. It preserves provider isolation, distinguishes HTTP requests from provider credits or quota units, labels unknown and configured-only evidence honestly, and exposes dry-run budget forecasts without provider calls.

## Before

Provider budget status exposed SportsDataIO-oriented fields and a health domain. The Odds API and BSN were visible as separate pools in OE-003A, but did not yet share a normalized canonical budget contract or dry-run authorization result.

## After

Provider budget status now exposes:

- `canonicalBudget`
- `providerPools`
- `costModels`
- `healthDomain.evidence.unitType`
- `healthDomain.evidence.requestCountsAndQuotaUnitsAreDistinct`

The dry-run forecast route returns:

- estimated HTTP requests;
- estimated quota units;
- evidence level;
- usable remaining;
- expected remaining after action;
- reserve impact;
- authorization result;
- unknown-cost factors;
- zero provider calls and zero mutations.

## Guardrails

No scheduler cadence, refresh cadence, provider limit, prediction formula, probability, confidence, edge, EV, Official Pick policy, settlement rule, learning rule, result import, provider mapping, provider subscription, sport certification or market certification changed.

No migration was required.

## Certification Requirements

- Provider budgets are isolated.
- SportsDataIO and The Odds API are never merged for authorization.
- Unknown evidence remains unknown.
- Configured-only evidence is labeled.
- Usable remaining subtracts reserve safely.
- Request counts and quota units are distinct.
- Dry-run forecasts make no provider calls.
- Authorization uses exact provider pool.
- Existing API compatibility fields remain.
- No secrets are exposed.
