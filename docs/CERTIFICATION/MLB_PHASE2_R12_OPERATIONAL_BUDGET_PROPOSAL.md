# R12 operational Odds budget proposal

Status: READY FOR USER REVIEW, NOT ACTIVE. Baseline: 5019efd81a8a482641f036cf23995ea4b2d772ca. No provider request or production mutation is authorized by this document.

## Exact proposed policy

| Setting | Proposal |
| --- | --- |
| Policy identity | MLB_ODDS_OPERATIONAL_BUDGET_V1 |
| Provider scope | The Odds API, baseball_mlb, h2h, regions=us, American odds |
| Daily hard cap | 48 attempted/reserved requests across every host and run |
| Per-run cap | 1; includes retries and uncertain attempts |
| Day identity | America/Puerto_Rico calendar date at atomic reservation time |
| Reset | A new dated ledger row at 00:00 PR / 04:00 UTC; never reset an old row |
| Minimum request interval | 15 minutes across all hosts, based on last reservation and acquisition |
| More than 180 minutes to nearest eligible start | 60-minute acquisition interval |
| More than 60 through 180 minutes | 30-minute interval |
| More than 5 through 60 minutes | 15-minute interval |
| No independently eligible game more than 5 minutes from start | No request; existing downstream pre-start guards remain mandatory |
| Operating window | Existing quarter-hour ticks from 08:00 PR until no eligible current-day target remains; no Odds during overnight modes |
| Same-scope batch | One league-wide response per permitted interval, not a request per game/book |
| Emergency exhaustion | ODDS_BUDGET_EXHAUSTED / deferred market evaluation; no provider call, no new pick, no counter refund, safe non-Odds modes continue |

The daily cap is a proposed ceiling, not a target. Today's stored start times produce 42 proposed acquisitions, versus 55 quarter-hour eligible slots (23.6% fewer). Forty-eight provides six requests of headroom; it never authorizes bypassing cadence or per-run limits. This is one day's zero-latency planning simulation assuming all 15 start times might be eligible, not a production run or a multi-day expected-value estimate. Actual eligibility may reduce usage to zero. Operational expectation for comparable long slates: up to roughly 42 requests, always bounded by 48; validate additional days before claiming a general average.

The documented odds endpoint cost is one credit per region per market: this unchanged request shape is approximately one credit per nonempty response. Planning estimate: 42 credits for the analyzed day's cadence; maximum 48/day, 1,440 over 30 days if every daily cap were reached. Account plan/quota adequacy must be verified before activation. Empty responses may be provider-credit-free but still consume our attempt budget. No dollar-price assumption is made. Source: https://the-odds-api.com/liveapi/guides/v4/#usage-quota-costs-1 (documentation only; no sports API call made).

## Freshness, freeze and reuse

Reuse only digest-verified immutable evidence with valid run/scope/game/starter/market mapping and timestamp lineage. Keep original acquiredAt and provider_last_update. Preserve the existing 10-minute FRESH threshold; AGING/stale quotes never become current because a scheduler skipped an acquisition. Provider timestamps can make even a recently acquired quote stale.

Same frozen-run retries recover the original durable Odds envelope before considering another request; per-run cap remains one. A new freeze cannot attach earlier Odds to a newer prediction if that violates prediction_as_of <= market_acquired_at. Reuse of a last-complete still-fresh decision is a read/no-op path, not a new prediction/value/pick write. Defer non-due paid evaluation before creating a new partial prediction publication. No historical Odds reacquisition, synthetic prices, or frozen-run time changes.

Tradeoff: with a 10-minute freshness limit and 30/60-minute acquisition cadence, fresh actionable prices are deliberately unavailable during some far-pregame intervals. Continuous fresh recommendations would require more calls or a separately approved product policy; R12 does not weaken freshness.

## Durable authority and races (implementation/activation pending)

The historical MLB_OPERATIONAL_MISSION counter remains 20/20 and becomes read-only certification history. Two separately recorded legacy acquisitions remain separate. New counter identity must include policy version, provider, sport and PR operating day, e.g. MLB_ODDS_OPERATIONAL_BUDGET_V1:THE_ODDS_API:baseball_mlb:2026-09-13. No overwrite or reinterpretation of the mission row.

Use one service-only transaction authority and the existing global fenced lease. Atomically lock the dated counter and a cross-day last-reservation record, validate cap/interval/fence, and insert a unique policy/run/provider reservation before network I/O. Never accept a caller-supplied budget/date/clock. A request crossing PR midnight retains its reservation's day; finishing it does not decrement or transfer consumption. A new day must not bypass the global interval.

Each reservation records request identity, frozen scope digest, reservedAt, acquisition state and optional durable response reference. RESERVED_AND_ACQUIRED follows verified immutable storage. A lost/uncertain attempt remains CONSUMED_UNCERTAIN and cannot auto-refund. REJECTED_BEFORE_PROVIDER consumes zero. Credit usage headers, when returned, are separate from request-attempt counters and stored as numeric accounting only. Never retry an uncertain request merely because the provider might not have charged it.

The existing runtime table constrains state kinds and the single mission identity. Do not overload it with the recurring counter. A separately reviewed additive service-only schema and exact migration authorization will be required before recurring-budget implementation is deployed. No migration is included or applied in R12. Certification must cover simultaneous reservations, idempotent retries, cap saturation, interval races, cross-midnight concurrency, paid-evidence recovery, and actual production readback before activation. Existing mission race tests passing does not certify the as-yet-unimplemented recurring store.

## Graceful mission exhaustion repair

The local host wrapper detects mission20/20 with no paid Odds for the run before entering daily execution. It returns ODDS_BUDGET_EXHAUSTED and the existing fenced completion contract stores COMPLETE with that explicit result/stage. COMPLETE means coordinator processing ended, not that a recommendation refresh succeeded. Data Health must report degraded market capability.

An in-flight MISSION_ODDS_CAP error reloads the fenced state and permits the same outcome only when the counter is exactly20, Odds calls remain0, receipts have PASS readback/zero conflicts and there is no market evidence or downstream market/value/pick receipt. It preserves prior features/predictions/checkpoints and supplies truthful prediction counts. Unknown failures, bad ledger values, conflicts and other hard stops still fail closed. A run that already paid for Odds may recover evidence even at20/20.

Following terminal completion and lease release, the existing loop continues independently safe INCREMENTAL/POSTGAME/OVERNIGHT work under its unchanged provider and DML caps. No parallel executor or new scheduler is created. No recurring budget is wired into this repair.

## Current failed-run disposition

Target: automation-2be095cab0b8e3aea0c0d5d92d39f897210507393791bd625d742de74e2d8303. Production execution is NOT performed in R12.

Use only the existing dispose contract after every frozen scheduled start has passed. The current maximum stored start is 2026-09-13T01:40:00Z (Sep12 21:40 PR); reread every target and do not rely on this timestamp if the schedule changes. Require inactive lease, exact fresh reviewDigest/revision, complete scope identities, PASS readback/zero conflicts, and physical count of13 predictions at the original freeze. Read back full-row digests before/after, all references/checkpoint/accounting, mission20/20, and no new downstream rows. Preserve the historical UNCLASSIFIED_STAGE_EXCEPTION record; attach the known budget diagnosis only as subsequent audit evidence. Do not relabel it as a successful live refresh.

Disposable SQL proves early disposition and stale digest rejection, preservation of all13 rows, unchanged accounting/freeze, terminal partial status and subsequent independent run acquisition. Production disposition remains time-gated and requires the deployment/recovery phase; do not bypass the guard in order to pass certification.

## Data Health and shadow surface contract

Test-first, no UI change: expose webDeploymentSha, observed Edge version/asOf, frozenRunPackageSha, schedulerConfiguration, schedulerHealth, historicalMissionBudget and operationalBudget separately. Configuration ENABLED is never equivalent to OBSERVED_OK. Budget exhaustion is DEGRADED_ODDS_BUDGET_EXHAUSTED; unresolved failure is BLOCKED_FAILED_RUN; absent scheduler observation is UNVERIFIED. Include last attempted and last complete run/counts distinctly; physical historical rows, latest prediction links and currently actionable opportunities have different denominators. Static activation prose is historical certification evidence, not observed Edge state.

Keep /mlb and its engines intact. Proposed label: MLB Research Lab, subtitle Experimental Decision Board - shadow projections, not Champion/Policy V1 recommendations. Do not rename/reclassify shadow LEAN/APOSTAR as Official Picks. Label/navigation implementation is deferred for product review.

## Authorization boundary

Review and explicitly authorize this exact48/day,1/run,PR-day,60/30/15-minute policy before any recurring-budget activation. Separate exact privileged Edge deployment approval is required for the R12 ten-file manifest, plus paired host publication and guarded recovery. The recurring store will need its own exact migration review/DDL authorization. This proposal authorizes none of those actions by itself. Historical20/20 is never reset.
