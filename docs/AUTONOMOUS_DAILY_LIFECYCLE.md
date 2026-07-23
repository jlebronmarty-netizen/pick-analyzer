# Autonomous Daily Lifecycle

Status: implemented as read-only operational verification

## Daily Story

The AI Operations Center reports Today, Yesterday and Last 7 Days using persisted data:

- games scheduled
- games completed
- odds snapshots
- predictions generated
- production settlements
- wins, losses and pushes
- learning queued, accepted and rejected
- reason codes for zero counts

## Refresh Timeline

Refresh timing is read from stored timestamps where available:

- latest odds snapshot
- latest prediction generation
- latest settlement
- latest replay/projection generation
- latest weight update
- provider budget next eligible refresh
- scheduler evidence from stored sync jobs

If a next run cannot be proven from stored metadata, the UI says `Waiting for next scheduler execution`.

## No-Fabrication Rule

The lifecycle report may say that a stage is waiting or blocked. It must not claim replay, learning, calibration, provider refresh, settlement or weight changes unless persisted evidence supports the claim.
