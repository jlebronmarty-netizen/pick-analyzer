# Operational source review — November 22, 2026

Scope: the user-authorized shared navigation and presentation corrections for the NBA incident. This is a bounded source review for the MLB release gate, not statistical validation, model promotion, data certification or MLB activation.

## Baseline and exact review

The provider-free release gate stopped at `SOURCE_DRIFT:src/components/dashboard/DashboardShell.tsx` in the worktree based on `a3d2a1a15ba4afa8594c933efe2a1c3de01458be`. All 37 source pins in the canonical R3 certificate still matched. Among the 110 operational source pins from November 19, exactly three presentation sources drifted: DashboardShell, DashboardShellClient and SportNavigation. The other four presentation sources below were inspected against the same base and are newly included in the inventory.

Every diff in these seven presentation files was read. Digests are SHA256 of UTF-8 source with CRLF normalized to LF, matching `normalizedFileDigest` in the existing gate.

| Reviewed source | Base SHA256 | Reviewed SHA256 | Reviewed behavior and boundary |
| --- | --- | --- | --- |
| `src/components/dashboard/DashboardShell.tsx` | `bb3bf9c51f14123486f60e772321567ac0e1acce8a4ef773ddcbf68493205fc2` | `80f0c36f0f89ef4233d2d0e287d5c2b3b6325e9300733e82bd3a1f4c34381411` | Changes the home label to Deportes and adds distinct NBA Board/archive route titles. Existing destinations and provider mounting remain unchanged. |
| `src/components/dashboard/DashboardShellClient.tsx` | `62ce1ac6b990e90f359c9b147839205c94d2734ac9a4820b1d32de6db1f78b6d` | `748e80c1014811093945878e4306eaad0103561ed6a3198123db241aafdd4802` | Adds the current sport Board link to desktop and mobile navigation using the shared static sport registry. It does not fetch, mutate records, or alter SportProvider mounting. |
| `src/components/dashboard/SportNavigation.tsx` | `31db8a8004f92c7d5ac5cc29dd6dd6b3f8c783b06c7a7b14a588a35eefbe0fd3` | `d3f52c7fcd80632710eb0b8ed044fd1b692da6bba95f9aca569751a231a4cb8b` | Uses the shared sport registry; NBA opens the Board and archive/learning tools remain available in a details section. Link prefetch stays disabled. |
| `src/components/dashboard/SportDecisionNavigation.tsx` | `72114543d38786d608f20c8682608ece5b77cb473f3ebe08d50aebaf3dde312c` | `f39c8cd5c32942d9bf7927fce27df77f45bc9212eb38887c44207d735b9216a7` | Makes the NBA destination explicit, includes the already available sport destinations and gives compact navigation a horizontal scroll region. No I/O or recommendation policy. |
| `src/components/dashboard/SportModelOverview.tsx` | `07da7a4939a7b71f32a6fdb655123657d844264e492395a655fb039909792fd0` | `f8b74629e8d65e9fdfcb3189be561aae2511a9abd1efc286ea705a14a342c17a` | Displays accuracy per sport, market and cohort; removes the combined cross-sport subtotal. Preserves the MLB regular/postseason selector and cohort choice; formats unavailable values as unknown, exposes unique games only when present and preserves model versions in history. |
| `src/components/pick2/MlbTodayContent.tsx` | `8093f17b644bd2d140dc00d6228ec6ce9299f22aa73c691734933335327931c2` | `bb6a3553911d8e7fc51adb5096f8f2853488e010850980b0456d10e1e7011ae5` | Places the sport cards first and the existing all-sport calendar in an expandable section. It renders the same supplied view/performance/calendar data and keeps the fallback navigation; the source of the Puerto Rico date is unchanged. |
| `src/components/dashboard/NbaBoardAccess.tsx` | `NEW FILE` | `04e89410ee4e444268e31c5515e8ea0285657e1b9412622f1eb1371b37fcc0f8` | New static accessible Board link with the six view names. No model, reads, writes or provider access. |

The cohort selection expression remains `find(cohort.key === phase) ?? cohorts[0]`; the MLB phase control still selects regular season or postseason without recomputing predictions. Formatting and navigation do not change stored W/L, settlement, probability, EV, policy or model inputs. The new count of evaluated contracts is explicitly W + L; it is not advertised as independent games. The read-only sports route classifier and CanonicalDashboardBoundary are unchanged, so this review does not broaden legacy-provider mounting.

## Manifest extension and historical evidence

`MLB_OPERATIONAL_READINESS_REVALIDATION_20261122.json` preserves all 110 prior source paths and all prior non-source fields. It adds four inspected presentation sources, the immutable November 19 manifest, and three unchanged sources that document scheduling/pause/activation boundaries: 118 source pins. No existing protected source is removed. The November 19 manifest retains SHA256 `1c72396e8f85ade8a75e30f6c64222dfe64892638afa78706b976b602ec6f135`. The October manifests, R3 certificate, 37 R3 source pins and original evidence remain unchanged.

The three runtime-reference files (`next.config.ts`, `scripts/mlb-operational-r6-vercel-runtime.mjs`, `scripts/mlb-operational-tick.mjs`) differ only by the active operational manifest filename, from November 19 to November 22. Runtime source-validation loops, activation checks, scheduling logic, source budgets and business stages remain byte-identical after reversing that filename substitution. The preflight service and canonical R3 reference are unchanged. Next.js traces the new manifest and every pinned source.

`scripts/verify-mlb-release-readiness.mjs` now validates both source-review links, including exact predecessor hashes, every retained source, all declared changes/additions and all evidence. It additionally checks that no inherited readiness claim or field changed. The original November 19 test referenced the old active manifest and a 110-source inventory; its exact bytes are preserved at `docs/audits/2026-11-22-nba-flow/historical/source-review-20261119.test.mjs.txt` with SHA256 `578618e9c47ecf94ded6ce3a992d289bc637efad8d3059e1476c33ba7143272f`. The November 19 certificate still contains its original test hash. The new review explicitly pins that preserved receipt and the updated test separately; this one named evidence supersession cannot be generalized to skip other historical evidence.

## MLB pause and runtime limits

The following source files are added unchanged to the current inventory:

| Source | SHA256 | Observed boundary |
| --- | --- | --- |
| `vercel.json` | `3afef6b0792753f6320385c7ce17b7fd16135f164e143fdb7ff87ccb01cbe1a6` | No MLB operational, MLB settlement or legacy operating-day cron is scheduled. Existing NBA and other sport schedules are unchanged. |
| `src/services/edge-lab-multi.service.mjs` | `ecbc33e50bdc980821e568b7f4471a3d320811239f7510c8ffdf7b8f4c3f51af` | MLB returns `OFFSEASON_PAUSED` with zero provider attempts when the existing `MLB_OFFSEASON_PAUSED` flag is true, before collecting from providers. |
| `docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json` | `e7ab6396e224f060df85dc8565cda306d20d4a0b236869f39e2fa486c551e701` | The historical activation artifact is preserved exactly; its enabled state does not authorize executing an MLB tick during this review. |

The already pinned `.github/workflows/production-operating-day.yml` still has manual dispatch only. No environment setting, schedule, activation artifact or provider budget is changed. The existence of an authenticated route and historical activation state is acknowledged; this offline source review does not establish current production environment values or schedule delivery. Passing the source gate is not authorization to invoke a tick or enable MLB. Production readback and the final build remain separate enclosing-release gates.

## Verification scope

The updated `tests/mlb-production-readiness/source-review.test.mjs` uses disposable source copies to verify both old and new manifests, historical and current evidence, source mutation/removal, unreviewed hash refresh, inherited runtime claims, the pause sources and newly pinned presentation dependencies. Tests do not invoke any operational tick, provider or database. The existing route-isolation and pagination tests remain unchanged.

Local validation passed: `node scripts/verify-mlb-release-readiness.mjs` returned `OFFLINE_RELEASE_GUARDS_PASS`, with all 37 R3 pins and all 118 current operational pins. `node --test tests/mlb-production-readiness/*.test.mjs` passed 42/42 tests (20 pagination, 3 route-isolation and 19 source-review tests). The failure log emitted by the mocked pagination-error case is expected; the suite completed with zero failures. This document records the exact reviewed source scope; it does not claim a new statistical validation, new production success, or a completed deployment. Full build/preview verification must run after this manifest and its references are included.

Provider calls: 0. Database writes: 0. Scheduler/environment changes: 0. Official runtime functional changes: 0. Model, policy, frozen history and `JUGADA` changes: 0 within this source-review scope.
