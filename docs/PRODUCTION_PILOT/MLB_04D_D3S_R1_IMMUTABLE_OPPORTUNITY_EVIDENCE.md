# MLB-04D-D3S-R1 Immutable Opportunity Evidence

Classification: `MLB_04D_D3S_R1_IMMUTABLE_OPPORTUNITY_EVIDENCE_REPAIR_CERTIFIED`

This repair separates mutable prospective current-board rows from frozen research evidence. `prediction_history` remains the current-state row used by the active prospective preview flow. It can still refresh book, odds, odds timestamp, feature snapshot and D3W metadata by logical event/market/selection/line identity.

Forward research ledger candidates now have a separate append-only storage contract: `mlb_forward_opportunity_evidence`. The table is additive, not applied by this certification, and stores exact event, market, selection, line, sportsbook, odds, odds timestamp, odds snapshot id, generated timestamp, raw probability, calibrated probability and calibration lineage.

Writes are default-off. Future execution requires execute mode plus `MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZED=true`. This phase did not write production data, create ledger rows, create snapshots, activate automation, call providers, backfill old opportunities or create Observation #4.

The future one-event canary is:

1. Capture or reuse one legitimate `MORNING` or `FINAL_PREGAME` `mlb_context_snapshots` row.
2. Capture or reuse one immutable `mlb_forward_opportunity_evidence` row.
3. Verify opportunity evidence timestamp is at or before snapshot cutoff and snapshot cutoff is before first pitch.
4. Build the ledger payload from immutable evidence plus frozen snapshot only.
5. Insert exactly one `mlb_forward_research_ledger` row.
6. Read back and rerun idempotency.
7. Stop without cron activation.
