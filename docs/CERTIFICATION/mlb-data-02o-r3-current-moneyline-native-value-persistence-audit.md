# Current Moneyline Native Value Persistence Audit

Classification: `MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_CERTIFIED`

This audit is **ANALYTICAL ONLY**. These rows are not Official Picks, are not bankroll/Kelly/stake recommendations, and are not historically profitability-certified.

## Persistence

| plan rows | attempted | inserted | reused | conflicts | failures |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 386 | 386 | 386 | 0 | 0 | 0 |

## Distribution

| positive edge | max edge | median edge | positive EV | max EV | median EV |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 193 | 0.09588225856366206 | -2.7755575615628914e-17 | 137 | 0.24092813941250002 | -0.03498981521906108 |

Top analytical candidate: game `823904`, `AWAY`, book `betrivers`, edge `0.09588225856366206`, unit EV `0.24092813941250002`.

## Boundaries

- Provider calls: 0
- Official Picks: 0
- Value Board publication: NO
- Production DDL: 0
- Automation: OFF
