# Projection History V1

Projection history is stored separately from betting prediction history.

Table:
- `universal_projection_history`

Migration:
- `supabase/migrations/202607190002_universal_projection_history_v1.sql`

Tracked fields:
- Projection
- Actual result
- Error
- Absolute error
- Percentage error
- Calibration metadata
- Evolution metadata
- Drift metadata
- Feature snapshot
- Explanation
- Readiness
- Shadow status
- Model version
- Unit
- Projection origin
- Validity status
- Rank score and rank tier
- Identity confidence
- Starter or participation status
- Provider and internal player IDs
- Invalidation reason

Historical projection rows must not rewrite sportsbook predictions, Official Picks, Current Board rows, champion rows or V7 rows.
# Operations Integration

Projection history remains separate from betting prediction history.

Production Operations V1 checks `universal_projection_history` migration availability and reports projection health through `/api/operations/health`. The operations layer does not write projection history by itself; protected projection routes remain responsible for persistence.
