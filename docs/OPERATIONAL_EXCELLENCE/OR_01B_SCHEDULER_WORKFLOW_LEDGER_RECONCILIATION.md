# OR-01B Scheduler Workflow Ledger Reconciliation

OR-01B repairs the mismatch where GitHub Actions could report scheduler success while the application-side scheduler-health ledger did not advance.

Status: `WORKFLOW_LEDGER_RECONCILIATION_REPAIR_DEPLOYMENT_REQUIRED`

Repair summary:

- workflow now validates JSON body semantics, not only HTTP status;
- no-write successful protected invocations now write scheduler heartbeat evidence;
- heartbeat metadata carries the adaptive invocation ID;
- scheduler cadence and product behavior are unchanged.

Production proof is still required from one protected scheduler execution after deployment.
