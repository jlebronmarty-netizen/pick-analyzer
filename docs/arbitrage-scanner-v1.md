# Arbitrage Scanner V1

Status: Completed as a conservative stored-odds scanner.

Arbitrage scans only future, unstarted stored events with supported full-game markets, fresh odds and verified sportsbook separation. Consensus-only rows cannot prove arbitrage.

## Status Contract

- `ARBITRAGE_FOUND`
- `NO_ARBITRAGE_FOUND`
- `MULTIBOOK_DATA_UNAVAILABLE`
- `SCANNER_DATA_ERROR`

The current MLB slate returns `MULTIBOOK_DATA_UNAVAILABLE` because stored verified multi-book pricing is not available. Provider calls remain 0 and remote mutations remain 0.

## Reliability Rules

- Bound odds reads to future/unstarted event IDs.
- Apply max odds age.
- Require matching market rules and all outcomes covered.
- Exclude live, alternate, stale and invalid odds.
- Return a safe scanner-error state instead of exposing raw errors.

