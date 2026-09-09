# R2T-R2 real persistence and stored-output integration

Verdict: `MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION_CERTIFIED`. All 23 integration gates have explicit passing evidence and publication quality review passes. Production live execution remains contained until R3. This supersedes the earlier Gate 4 stop after the separately certified R2D enrichment.

## What is proven

The retained historical parity case keeps its exact certified stored-input digest and probability error below 3.7e-13. No completed stored-output investigation was restarted. The production prediction adapter now calls the existing 02I stored-input serializer; the shorter R2F inference summary digest is retained separately.

Two real archived eligible targets traverse the actual R2B -> R2I canonical path and production adapter body against disposable PostgreSQL. Real feature builders write entity snapshots and all applicable daily domains, resolve canonical UUIDs independently, and reconstruct the exact 76-value vector from persisted rows. Champion coefficients, preprocessing, feature order and semantics are unchanged.

The batter domain is legitimately empty for the current moneyline contract: 0/76 inputs depend on lineups. A separate private real historical batter row validates physical schema, insertion, uniqueness and foreign keys without being supplied to moneyline inference.

Explicit structural odds fixtures exercise canonical market mappings, observations, no-vig/edge/EV, unchanged Policy V1, immutable Official Pick persistence and actual Value Board readback. They are isolated test inputs, never claimed as real market acquisition. Empty market/slate and zero-pick behavior are supported; a watchlist row cannot become a top Official Pick.

Snapshot revision retries, interruption after features, interruption after market handoff, uncertain writes before/after database commit, independent readback and zero-cap reuse pass. Provider budgets persist across restart; the shared Statcast cold-fetch test counts actual injected requests and reuses its cache. Raw availability, current starter/status vetoes, scope, physical shape and post-start guards remain fail-closed.

## Narrow integration corrections

Market matching normalizes equivalent PostgreSQL/ISO/offset timestamps to UTC. Journal readback compares timestamp instants rather than formatting. Physical numeric(18,15) storage coercion is checked against PostgreSQL, without altering model or policy formulas. The live wrapper cannot enter the legacy synthetic dry graph.

Native enrichment preserves existing business facts on reuse and uses bounded expected-old provenance predicates for necessary updates. Newly acquired evidence is never backdated; evidence newer than the frozen run_as_of blocks that game until a subsequent freeze. R2D's 52 excluded fields were not promoted by this certification, and unknown starters remain blocked individually.

## Validation and limitations

- Disposable PostgreSQL: 64 passing checks, including retained stored-input digest parity.
- R1: 41 passing provenance/negative checks.
- Feature/model regressions: all nine pass.
- Private-store/provider/crosswalk guards: three pass.
- Legacy stack: seven pass; nine return nonzero because their fixture-backed live expectations encounter deliberate R2T containment. These are recorded as failures with explicit containment-incompatibility classification, not relabeled PASS. Two also report Windows teardown assertions.
- Legacy R2T: 29 assertions pass, but its deliberate containment status remains BLOCKED.
- Build: exit 0, 400 static pages. Changed-file ESLint: zero warnings. Diff and 30-file publication scans pass: no configured secret values, JWT/private-key material or retained raw sample payloads.

Sports-provider calls, production row DML and production DDL during this integration certification are all zero. The mission prerequisite is one separately authorized and already certified uniqueness migration; it was not repeated. No automation, cron, settlement, training or Champion changes occurred.

## Publication and reproduction

The canonical JSON records per-gate assertion evidence and aggregate conclusions. Raw vectors, sample predictions, native/player rows and detailed production payloads were removed from this updated artifact. Authorized private replay inputs stay outside the repository. No production data was modified for sanitization.

Use the external private inputs documented in MLB_OPERATIONAL_MISSION_AUDIT.md, including R2T_MULTI_READ_CACHE and private-registry.json. Run mlb-operational-feature-schema-validate.mjs, mlb-data-02r-r2t-operational-guards-validate.mjs and mlb-data-02r-r2t-r2-integration-certify.mjs under the R2S isolation preload. Set R2T_LEGACY_VALIDATION_DIR to the completed private legacy stack directory. Missing evidence causes failure; there is no fixture fallback for real model replay.

All 19 inherited tracked artifacts and .tmp/.worktrees remain untouched and excluded from the bounded commit. R3 live re-enablement is the next phase; nonempty live execution, repeatability, automation, settlement and Today remain incomplete mission gates.
