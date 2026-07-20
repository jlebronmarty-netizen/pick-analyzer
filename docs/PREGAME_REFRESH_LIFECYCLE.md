# Pregame Refresh Lifecycle V1

The lifecycle is:

1. Resolve schedule and active slate.
2. Refresh odds only through existing Operating Day actions when budget allows.
3. Generate or reuse feature snapshots through existing prediction infrastructure.
4. Evaluate recommendations without changing official thresholds.
5. Lock recommendations before event start.
6. Sync results after games finish.
7. Settle, replay and calibrate after authoritative results.

Adaptive Operations adds visibility into which step is due. It does not create a new prediction path.
