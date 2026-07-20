# MLB Market Provider Matrix V1

Current verified production provider state:
- SportsDataIO is the active MLB provider contract represented in repository code.
- Full-game moneyline, run line and game total odds are stored and modeled.
- Pricing is consensus-only.
- No verified multi-book depth exists.
- No verified stored team totals, first-five markets, first-inning markets, player props, alternate lines or arbitrage inputs exist.

Repository evidence:
- `src/config/sportsdataio-endpoint-catalog.ts`
- `src/services/mlb-market-capability-registry.service.ts`
- `src/services/production-readiness-audit.service.ts`

Provider implications:
- Team Totals: not verified in current production rows; may require SportsDataIO market endpoint verification, commercial upgrade, CSV import or another provider.
- First Five: not verified in current production rows; requires market endpoint verification and inning-score settlement.
- NRFI/YRFI: not verified; requires first-inning odds and first-inning result fields.
- Pitcher Props: SportsDataIO catalog has enterprise/player-prop endpoints, but current subscription and production support are not verified.
- Batter Props: same provider limitation as pitcher props, with stronger lineup dependency.
- Alternate Lines: catalog references alternate market endpoints, but production entitlement, payload shape, normalization and settlement are not verified.
- Arbitrage: requires at least two distinct books with synchronized prices; consensus pricing is insufficient.

Do not claim provider support without a stored production row, verified contract or approved capped validation result.
