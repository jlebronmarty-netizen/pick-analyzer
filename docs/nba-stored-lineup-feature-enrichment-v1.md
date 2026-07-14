# NBA Stored Lineup Feature Enrichment V1

Date: 2026-07-13

## Summary

NBA Stored Lineup Feature Enrichment V1 updates the NBA Feature Store preview to consume stored `sport_lineups` availability when lineup/depth rows exist.

The enrichment is read-only and makes no provider calls.

## Behavior

- Lineup feature preview now uses stored lineup/depth sample size.
- Freshness and provenance come from `sport_lineups` when rows are present.
- Trial/scrambled lineup rows remain excluded from production confidence improvement.
- Lineup warnings and confidence penalties remain visible.

## Safety

- External provider calls used: 0.
- Persistence changed: no.
- Prediction persistence enabled: no.
- Backtesting enabled: no.
- Model training enabled: no.
- Trial lineup data can improve observability, not production confidence.
