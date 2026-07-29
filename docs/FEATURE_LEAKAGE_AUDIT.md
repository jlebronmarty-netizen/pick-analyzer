# Feature Leakage Audit

Date: 2026-07-29

Status: READ-ONLY LEAKAGE CLASSIFICATION

No model training. No production mutation.

## Summary

- Critical leakage-risk keys: 29
- High leakage-governance keys: 7
- Cutoff-frozen market candidates: 35
- Candidate non-leakage keys: 378
- Excluded or metadata-only keys: 36

## Required Training Exclusions

- left_unknown_lineup_warning: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- lineup_recent_ops_proxy: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- lineup_recent_pa_sample: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- same_order_slots_from_previous_game: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- same_starters_from_previous_game: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- marketOdds: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketOdds.line: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketOdds.market: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketOdds.price: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketOdds.snapshotTime: High, Metadata only. Identifier, timing or lineage metadata is useful for governance but not as predictive input.
- marketOdds.sportsbook: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketOdds.providerMarket: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- derivedBaseballFeatures.away.momentum.label: Critical, Exclude. Could expose postgame labels or settlement outcomes.
- derivedBaseballFeatures.away.rest.extraInningsPreviousGame: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- derivedBaseballFeatures.away.splitLabel: Critical, Exclude. Could expose postgame labels or settlement outcomes.
- derivedBaseballFeatures.home.momentum.label: Critical, Exclude. Could expose postgame labels or settlement outcomes.
- derivedBaseballFeatures.home.rest.extraInningsPreviousGame: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- derivedBaseballFeatures.home.splitLabel: Critical, Exclude. Could expose postgame labels or settlement outcomes.
- derivedBaseballFeatures.reliabilityLabel: Critical, Exclude. Could expose postgame labels or settlement outcomes.
- intelligenceVersion: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- marketStability: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.direction: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.initialLine: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.initialOdds: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.latestLine: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.latestOdds: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.lineMove: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.priceMove: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketStability.score: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- eventContext: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- eventContext.awayTeam: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- eventContext.eventId: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- eventContext.homeTeam: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- eventContext.source: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- eventContext.startTime: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- eventContext.status: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- marketOdds.oddsSnapshotId: High, Metadata only. Identifier, timing or lineage metadata is useful for governance but not as predictive input.
- marketOdds.outcome: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- marketOdds.peerRowsInEventMarketBook: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- contextCounts.sourceRecords: High, Metadata only. Identifier, timing or lineage metadata is useful for governance but not as predictive input.
- event: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- event.awayTeamId: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- event.homeTeamId: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- event.id: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- event.startTime: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- odds: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- mlbV6FeatureContract.awayStarter.status: High, Metadata only. Identifier, timing or lineage metadata is useful for governance but not as predictive input.
- mlbV6FeatureContract.eventId: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- mlbV6FeatureContract.homeStarter.status: High, Metadata only. Identifier, timing or lineage metadata is useful for governance but not as predictive input.
- mlbV6FeatureContract.source: High, Metadata only. Identifier, timing or lineage metadata is useful for governance but not as predictive input.
- contextCounts.lineups: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- contextCounts.odds: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- event.status: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- lineups: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- contextCounts.cutoffSafeLineMovementOddsRows: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- contextCounts.lineMovementOddsRows: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- contextCounts.selectedOddsRows: Medium, Use only if cutoff-frozen. Market fields are valid only when proven pre-cutoff and frozen at prediction time.
- event.awayTeam: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- event.homeTeam: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.
- event.providerGameId: Critical, Exclude. Could feed prior model outputs or recommendation outputs back into training.

## Policy

Closing-line, settlement, label, prediction-output, recommendation-output and model-output fields must not be used as pregame model inputs. Odds and line fields may be used only when the stored snapshot proves the value was available before cutoff and frozen for the prediction.
