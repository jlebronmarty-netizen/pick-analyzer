# MLB Value Board Gated Deployment Readback Audit

## Verdict

MLB_DATA_02Q_R2_GATED_VALUE_BOARD_DEPLOYMENT_CERTIFIED

## Production

- Commit: 7d5e5321e3e60d1d4534874e86b5d78af658b8a2
- Feature gate state: OFF
- Route behavior: OTHER_FAIL_CLOSED
- Public board exposure: NO
- Public navigation hidden: PASS

## Board Counts

| Status | Count |
| --- | ---: |
| Official Picks | 5 |
| Value Candidates | 14 |
| Watchlist | 23 |
| Blocked | 0 |
| Total | 42 |

## Top Pick

- game_pk: 823904
- side: AWAY
- book: betrivers
- consensus edge: 0.081935617141676
- unit EV: 0.2409281394125

## Boundary

No Value Board publication, provider calls, odds refresh, Official Pick changes, production DML, production DDL, automation, or cron changes were performed by this readback.
