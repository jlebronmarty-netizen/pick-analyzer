# P2.1A Canonical Market Prediction Granularity

Status: LOCAL VALIDATION PASS PENDING PRODUCTION CERTIFICATION

P2.1A is a correction to the supported-market prediction coverage contract.

The approved operating model is:

- Provider selection evidence can represent both sides of moneyline, spread/run line and total markets.
- Production model predictions are evaluated at one canonical event-market row per supported market.
- Opposing provider sides are contextual evidence, not independent Performance or settlement-learning samples.

For an 8-game MLB slate this means 48 provider-backed selection observations may exist, but only 24 canonical model predictions are production-evaluable.

The correction preserves the existing Current V2 selection-level rows as preview evidence and prevents them from silently entering Performance, settlement or learning as duplicate independent predictions.
