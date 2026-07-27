# MLB Market Data Foundation V2

Status: local market-readiness contract prepared; no live market sync, historical odds call, EV calculation or recommendation logic is executed.

This phase audits and prepares current-market foundations for MLB without changing Current Board, Most Likely, Best Value, Probability Picks, Player Prop Comparison, Official Pick policy, settlement, scheduler behavior or Learning Brain weights.

## Stored Market Evidence

From Phase A1:

- MLB odds snapshots: 48569
- MLB genuine stored player-prop rows: 11
- Player-prop provider: The Odds API
- Certified event crosswalk: present from prior approved work
- Certified pitcher identity bridge: deterministic Will Warren mapping exists
- Historical odds/opening/closing line completeness: not certified

## Market Scope

| Market family | Current state | Readiness | Notes |
| --- | --- | --- | --- |
| moneyline | stored current odds available | partial/current-ready | use existing SportsDataIO odds path and market normalization |
| run line/spread | stored current odds available | partial/current-ready | supported by existing full-game market contracts |
| totals | stored current odds available | partial/current-ready | supported by existing full-game market contracts |
| alternate lines | not certified | blocked | no activation until provider payload, settlement and UI contracts are proven |
| pitcher props | 11 genuine recorded-outs rows | partial/projection-gated | no fake lines; only same-event projection can expose comparison |
| batter props | not stored/certified | blocked | future readiness only |
| opening lines | not certified complete | entitlement/lineage blocked | no historical odds calls in this program |
| closing lines | not certified complete | entitlement/lineage blocked | no CLV expansion in this phase |
| historical odds | not approved | entitlement/cost blocked | The Odds API historical calls remain 0 |

## Provider Rules

The Odds API:

- may supply current events/bookmakers/markets only after entitlement and budget gates
- historical endpoints are not called in this program
- player props require certified event crosswalk and deterministic player identity
- no sportsbook line may be fabricated

SportsDataIO:

- remains valid for current standard MLB odds where the existing pipeline already uses it
- player props remain enterprise/unconfirmed in the repository catalog unless entitlement is proven

## Storage Contract

Existing `sports_odds_snapshots` remains the storage surface.

Required fields:

- sport key
- event ID
- provider/source
- sportsbook/bookmaker
- market
- outcome
- line
- price
- snapshot timestamp
- provider timestamp where available
- deterministic snapshot ID
- metadata lineage

Player prop rows must preserve:

- event
- pitcher/player identity
- bookmaker
- market
- line
- price
- outcome
- provider timestamp

## Activation Boundary

This phase does not:

- calculate EV
- calculate Kelly
- recommend bets
- create Official Picks
- schedule provider sync
- call historical odds
- fabricate missing markets
- mutate market rows
- change comparison UI behavior

## Certification

- `MLB_MARKET_DATA_FOUNDATION_V2_PASS`
- `MLB_PROP_MARKET_READINESS_PASS`
- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- Historical odds calls: 0
- EV/Kelly/recommendation logic added: false
