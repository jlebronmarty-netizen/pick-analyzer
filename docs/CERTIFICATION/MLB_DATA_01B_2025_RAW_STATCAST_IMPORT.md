# MLB-DATA-01B 2025 Raw Statcast Import

Verdict: `MLB_DATA_01B_2025_RAW_STATCAST_IMPORT_CERTIFIED`

The certified 2025 Baseball Savant Statcast package was imported into `pick2_raw_mlb_statcast_pitches` only. The package remained unchanged from MLB-DATA-01A: 30 source CSV files, 712,528 pitches, 2,430 games, 119 source columns and 0 duplicate/null source pitch identities.

Production readback certified:

- Pre-import raw count: 0
- Post-import raw count: 712,528
- Raw inserts: 712,528
- Safe checkpoint reuses after interrupted batches: 30,200
- Rejected rows: 0
- Identity conflicts: 0
- Payload conflicts: 0
- Quarantined rows: 0
- Production pitch identities: 712,528 unique, 0 duplicates
- Raw payload sample readback: PASS, 60 deterministic samples from the 30-file source set
- Bounded idempotency proof: PASS, 250 existing identities reused with 0 would-insert rows

Canonical mapping remains deferred to MLB-DATA-01C. `event_id`, canonical pitcher IDs and canonical batter IDs are intentionally not populated by this phase.

No derived features, model rows, prediction rows, market-value rows, 2026 Statcast rows, automation or cron changes were created. Provider calls were 0. Production schema mutations were 0. The only authorized production DML was raw 2025 Statcast insertion into `pick2_raw_mlb_statcast_pitches`.

Certification artifact: `docs/CERTIFICATION/mlb-data-01b-2025-raw-statcast-import.json`
