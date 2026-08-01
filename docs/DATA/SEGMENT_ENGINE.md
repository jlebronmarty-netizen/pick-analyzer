# Segment Engine V1

Status: RELEASE 06 IMPLEMENTED

Implementation: `src/services/model-segments.service.ts`

API: `/api/model/segments`

The segment engine reads persisted prediction history and joined event context, derives stable analytical dimensions and returns segment metrics. It does not call providers, mutate data, recalculate predictions, recalibrate probabilities or change Official Pick policy.

## Supported Filters

- `sport`
- `league`
- `market`
- `dateFrom`
- `dateTo`
- `confidenceBucket`
- `probabilityBucket`
- `homeAway`
- `favoriteUnderdog`
- `settlementResult`
- `limit`

## Supported Segment Dimensions

- sport
- league
- market
- probabilityBucket
- confidenceBucket
- homeAway
- favoriteUnderdog
- modelVersion
- featureVersion
- settlementResult
- predictionSource

## Metrics

Every segment exposes:

| Metric | Meaning |
| --- | --- |
| `sampleSize` | Rows in the segment after filters. |
| `scored` | Win/loss rows used for accuracy and Brier. |
| `wins` | Settled wins. |
| `losses` | Settled losses. |
| `pushes` | Settled pushes, excluded from accuracy and Brier. |
| `voids` | Settled voids, excluded from accuracy and Brier. |
| `accuracy` | Wins divided by wins plus losses. |
| `brier` | Mean squared probability error on win/loss rows. |
| `calibrationError` | Average predicted probability minus accuracy. |
| `averageProbability` | Mean model probability over scored rows. |

## Stability Contract

The response mode is `model_segments_v1`. Bucket boundaries are deterministic. The route includes `readOnly: true`, `providerCallsMade: 0`, and `remoteMutationsMade: 0`.

