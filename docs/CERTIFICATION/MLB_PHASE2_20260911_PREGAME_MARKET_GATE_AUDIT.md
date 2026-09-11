# September 11 production market certification gate

Verdict: BLOCKED_DEPENDENCY_NETWORK_FAILURE_WITH_PRESERVED_PARTIAL_WRITES.

The current production package is cc1a359b3c7492cb5f62efc39eb5f5b05e85c6d4. Fresh schema preflight passes with zero orphan references; missing, wrong and public credentials are rejected, and server-only inspection succeeds. Edge v8 remains active.

The first scheduled PREGAME run after initialization, automation-0271e170de9e0280a03f773c6cd7a7fc18ac9226c4643bcc4bc0fcef018a1f21, froze at 2026-09-11T12:15:10.378Z with 15 target games. It failed in DEPENDENCY_SCOPE at 12:27:03.567Z and durably recorded R2N_STATCAST_NETWORK_FAILURE, Error, checkpoint revision158, lease holder and authoritative provider/DML accounting. The terminal revision is159. This is a new dependency acquisition failure, not evidence of another market INSERT failure.

The shared Statcast adapter emits this classification when its fetch operation rejects with an error other than a named TimeoutError or AbortError. The underlying network cause is not retained; no DNS, provider outage, deadline or socket cause is asserted. Two bounded Vercel log queries timed out, so the durable record and source are the available authority.

The failed run consumed MLB Official1 / Statcast10 / Odds0 and preserved 3,795 canonical raw pitch inserts under its 15,000-row cap, readback PASS and conflicts0. Today's earlier INITIALIZE run inserted15 native games; those are separate from this failed run's DML. Current readback across all15 target games finds zero feature snapshots, predictions, mappings, observations, values and Official Picks. The scope is provisional, not a claim that all15 passed final inference eligibility. No individual starter/provenance rejection was recorded before the global stage failure.

The exact deployed runtime contract prevents continuation: acquire rejects FAILED runs; disposeDependencyFailure requires zero business writes and therefore cannot apply; dispose requires all target games to have started, which is false. The targets start between September11 18:20UTC and September12 02:15UTC. The lease is inactive, but one unresolved run remains. No reset, alternate write path, fresh-run bypass or premature disposition was attempted.

Mission Odds remains4/20, with the historical legacy acquisitions separately retained. The old market failure stays TERMINAL_PARTIAL_PRESERVED at revision44. This continuation used zero provider calls and performed zero production DML/DDL. No historical Odds response was reacquired or changed. No model, feature, preprocessing, policy or UI implementation was changed.

The next repair must certify bounded recovery after partial dependency writes, preserving raw rows, provider reservations, DML counters, recorded failure, and as-of protections. A real pregame market/value/policy run remains required afterward. An empty result before Policy V1 is not a successful zero-pick policy evaluation. MARKET_PERSISTENCE_PRODUCTION_CERTIFIED=NO and UI_REDESIGN_READY=NO.
