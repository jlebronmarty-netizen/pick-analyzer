# ODDS-02F Full Market Evidence Capture Contract

Status: `ODDS_02F_CONTRACT_READY_FOR_NEXT_AUTHORIZED_SAMPLE`

Starting commit: `e623322aeb5cbe6906b03c78d2b24df8ae7e4a8b`.

Provider calls: `0`.

Database mutations: `0`.

## Verdict

ODDS-02F repairs the shadow evidence contract and capture parser before any new provider-consuming request.

The protected live shadow response will now carry sanitized `fullMarketEvidence` rows in addition to aggregate counts and exact-match comparisons. The capture harness validates this row contract and exposes deterministic parser utilities for future certification.

No ODDS-03 cutover was performed.

## Evidence Loss Point

ODDS-02C lost non-exact total row detail at the route response boundary:

`ROUTE_RESPONSE_DROPPED_ALTERNATE_LINES`

The service normalized full `ShadowSnapshot` rows in memory, but returned only a count plus exact comparison rows. The capture harness faithfully saved the response, so it could not recover rows that were not emitted.

## Contract Implemented

The future protected live response includes:

- event identity;
- canonical event identity;
- provider event identity;
- home/away/start;
- bookmaker identity;
- normalized market;
- provider market;
- selection;
- exact line;
- price;
- provider source timestamp;
- capture timestamp;
- mapping status and reason;
- freshness status;
- source age.

## Fixture Results

The ODDS-02F validator covers:

1. exact Total 8.0 across several books;
2. prediction 8.0 with current books at 8.5;
3. split books at 8.0 and 8.5;
4. alternate totals 7.5 / 8.0 / 8.5;
5. Run Line -1.5 / +1.5;
6. Moneyline;
7. stale and fresh books mixed;
8. missing book;
9. unmapped event;
10. ATH/OAK alias remains certified by ODDS-02D.

The validator proves total bettable coverage, exact-line coverage, line movement, and best fresh exact-line price are derivable from row-level evidence.

## Readiness

Ready for a future separately authorized wide sample:

`YES`

The next sample can answer from one request:

- current events mapped;
- moneyline availability;
- run line availability;
- total availability;
- exact predicted-line survival;
- moved lines;
- core-book current lines;
- best fresh exact-line book and price;
- book freshness.

Provider calls remain unauthorized in ODDS-02F.

## Production Isolation

- SportsDataIO production odds authority unchanged.
- The Odds API remains shadow-only.
- Official Pick policy unchanged.
- Rent Play unchanged.
- Moneyline unchanged.
- Smart Parlay unchanged.
- Current Board production pricing unchanged.
- Prediction probabilities unchanged.
- HR-03 unchanged.
- Settlement unchanged.
- Learning unchanged.
- Performance unchanged.
