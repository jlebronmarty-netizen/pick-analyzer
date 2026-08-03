# P2.1A Canonical Market Prediction Granularity

Status: PRODUCTION CERTIFIED

P2.1A is a correction to the supported-market prediction coverage contract.

The approved operating model is:

- Provider selection evidence can represent both sides of moneyline, spread/run line and total markets.
- Production model predictions are evaluated at one canonical event-market row per supported market.
- Opposing provider sides are contextual evidence, not independent Performance or settlement-learning samples.

For an 8-game MLB slate this means 48 provider-backed selection observations may exist, but only 24 canonical model predictions are production-evaluable.

The correction preserves the existing Current V2 selection-level rows as preview evidence and prevents them from silently entering Performance, settlement or learning as duplicate independent predictions.

Production certification on commit `8821aa7830874653cc05744ff8eaad03cf42b6b3` proved 48 provider selections, 24 canonical markets, 24 canonical predictions, 24 production-evaluable rows, 0 missed canonical opportunities, 0 duplicates and 100% canonical coverage.
