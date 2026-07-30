# MLB First Autonomous Operating-Day Production Certification V1

Date: 2026-07-29

Status: CERTIFIED AFTER BOUNDED TERMINAL RESULT RECOVERY

Certification used production evidence, direct non-server service execution and read-only validation. No local server smoke was run. No manual Vercel deployment was initiated.

## Production Alignment

- Expected commit: `9c066b00aaf0c348d9948e13af48a5f10982d40f`
- Production `/api/system/version` commit: `9c066b00aaf0c348d9948e13af48a5f10982d40f`
- Deployment alignment: MATCH
- Existing successful production evidence: `/api/system/version`, dashboard, Performance, operations and product routes were already HTTP 200 in the certified production smoke evidence.

## Local Smoke Classification

`LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS`

- Two independent bounded PowerShell wrappers exceeded their hard timeouts.
- The route itself is not proven defective.
- Prior production and local smoke evidence already showed `/api/system/version` HTTP 200.
- This certification relies on build, validators, artifact consistency, stored operational evidence and previously certified production smoke.
- A separate future smoke-harness repair may be created, but it is out of scope.

## Terminal Result Recovery

Four SportsDataIO MLB events remained non-terminal after the operating day:

| Event | Start | Final | Canonical source |
| --- | --- | --- | --- |
| `baseball_mlb:mlb:sportsdataio:event:79744` ATL @ NYM | `2026-07-29T23:10:00Z` | ATL 1, NYM 0 | MLB Stats `823598` |
| `baseball_mlb:mlb:sportsdataio:event:78910` HOU @ LAA | `2026-07-30T01:38:00Z` | HOU 7, LAA 4 | MLB Stats `824002` |
| `baseball_mlb:mlb:sportsdataio:event:78918` BOS @ ATH | `2026-07-30T01:40:00Z` | BOS 4, ATH 2 | MLB Stats `824973` |
| `baseball_mlb:mlb:sportsdataio:event:78911` SEA @ LAD | `2026-07-30T02:10:00Z` | LAD 4, SEA 2 | MLB Stats `823924` |

Root cause: MLB Stats ids do not equal SportsDataIO ids, and the previous fallback could match by same teams plus local date before checking exact start minute. The ATL/NYM doubleheader exposed that ambiguity. The repair now prefers exact start-minute plus teams, then falls back to same-team local-date matching.

Recovery evidence:

- SportsDataIO bounded result probe: 1 call, 4 target rows, all Final.
- MLB Stats targeted recovery: 1 call, 26 rows received, 4 target finals inserted to `game_results`, 4 `sport_events` marked completed.
- Targeted idempotency repeat: 1 call, 4 rows reused, 0 event rows updated.

## Scheduler Health Alignment

- Write scheduler policy: `*/10 * * * *`
- Heartbeat policy: `3,33 * * * *`
- Operations health expected cadence: 10 minutes plus 10 minute grace.
- The legacy `7,22,37,52 * * * *` health text has been removed from the health surfaces.

5-10 minute refresh is feasible when window-gated and budget-gated. Recommended cadence remains 10-minute protected scheduler ticks, 5-10 minute near-start odds refresh, 15-minute normal pregame refresh, 60-minute early pregame refresh and no market refresh after start.

## Settlement And Learning

Protected settlement dry-run for operating day `1f926d6c-d37f-48cd-ad19-2a08ee464a7e`:

- Checked: 48
- Eligible: 48
- Unresolved: 0
- Warnings: none

Executed protected settlement:

- Settled: 48
- Wins: 27
- Losses: 21
- Pushes: 0
- Official settled: 0
- Hypothetical settled: 48
- Provider calls: 0

The four recovered events contributed 12 settled rows: 8 wins and 4 losses.

Learning and Performance status:

- Result -> settlement is complete for the July 29 prospective operating-day rows.
- Learning evidence is derived read-only from settled `prediction_history` rows.
- Accepted learning samples observed: 402.
- Rejected learning samples observed: 32.
- Automatic model training: false.
- Model weight mutation: false.
- Performance can read the settled rows through the existing Performance Product Contract / Performance Scope V2 path.

## Provider Usage

- Pre-recovery observed SportsDataIO usage: 14 calls, 1.4% of 1000 daily limit.
- Recovery certification provider calls: 3 total.
- Settlement provider calls: 0.
- Typical core MLB daily operating estimate: 20-40 calls/credits per day, or 600-1200 calls/credits per 30-day month, depending on slate size, final-result timing and cache reuse.

## Certification Result

Daily MLB operation is currently possible for core workflows: slate discovery, odds freshness, feature/prediction refresh, Current Board read-through, AI Briefing/read-through surfaces, result sync, protected settlement, derived learning evidence and Performance visibility.

Certified:

- `MLB_FIRST_AUTONOMOUS_OPERATING_DAY_PASS`
- `MLB_TERMINAL_RESULT_RECOVERY_PASS`
- `MLB_RESULT_SETTLEMENT_LEARNING_PASS`
- `MLB_SCHEDULER_HEALTH_ALIGNMENT_PASS`
- `NO_LOCAL_SERVER_SMOKE_PASS`
- `NO_MODEL_TRAINING_PASS`
- `NO_MODEL_WEIGHT_MUTATION_PASS`
- `NO_PROBABILITY_CHANGE_PASS`
- `NO_TRUST_FORMULA_CHANGE_PASS`
- `NO_OFFICIAL_PICK_POLICY_CHANGE_PASS`
- `NO_CERTIFIED_PLATFORM_REGRESSION_PASS`

Remaining blockers:

- No production Official Picks existed for July 29, so official-pick ROI remains not applicable.
- Automatic model training remains disabled by design.
- Future work should repair the Windows local smoke harness separately.

## Next Implementation Phases

1. Repair the Windows smoke harness as its own process-control task.
2. Continue observing 10-minute scheduler health over complete operating windows.
3. Add a replay/Performance daily artifact once settled samples grow large enough for meaningful official-pick reporting.
4. Keep unsupported markets blocked until ingestion, modeling, settlement, replay and dashboard support are complete.
