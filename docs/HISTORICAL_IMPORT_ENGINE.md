# Historical Import Engine

Status: Active

The Historical Import Engine owns controlled provider acquisition, checkpointing and idempotent import execution.

SportsDataIO Discovery V1 is not a historical importer. It reads stored import evidence and helps decide the next safe acquisition unit.

Future SportsDataIO imports must continue to use the existing protected historical import executor with:

- Exact sport/provider/date/season scope
- Max-call budget
- Checkpoint reuse
- Quarantine policy
- Mapping validation
- No production recommendation promotion
