# Live Multi-Sport Data Acquisition V1

Last updated: 2026-07-28T01:58:09.531Z

Starting commit: `ec85d06b59f87d7b319f1e10afd68401403e7e36`

Current checkpoint: `CHECKPOINT_A_LIVE_ENTITLEMENT_AND_IDENTITY_CERTIFICATION`

## Checkpoint A Summary

- Status: PARTIAL_PASS_LIVE_ENTITLEMENT_EVIDENCE_CAPTURED
- Provider calls made: 4
- Remote mutations made: 0
- Production mutations made: 0
- Work performed: live entitlement proof and identity sample certification only.

## Provider Probe Matrix

| Provider | Sport | Endpoint family | Classification | HTTP | Rows | Calls |
| --- | --- | --- | --- | ---: | ---: | ---: |
| sportsdataio | mlb | teams_identity_sample | ENTITLED_AND_WORKING | 200 | 30 | 1 |
| sportsdataio | nba | teams_identity_sample | ENTITLED_AND_WORKING | 200 | 30 | 1 |
| sportsdataio | nfl | teams_identity_sample | UNKNOWN | N/A | 0 | 0 |
| sportsdataio | nhl | teams_identity_sample | UNKNOWN | N/A | 0 | 0 |
| the_odds_api | all | sports_catalog | ENTITLED_AND_WORKING | 200 | 71 | 1 |
| the_odds_api | baseball_mlb | event_odds | ENTITLED_AND_WORKING | 200 | 21 | 1 |

## Safety

- Secret values are not written to this artifact.
- No broad import, feature rebuild, prediction activation, settlement write or learning write ran in Checkpoint A.
- Non-configured or non-entitled endpoints are documented and skipped.

## Next Checkpoint

Checkpoint B may proceed only for sports/endpoints classified ENTITLED_AND_WORKING after targeted import dry-run and idempotent write guard validation.

