# Operational source review — November 19, 2026

Scope: reconcile reviewed dashboard and read-only route changes with the exact
operational source inventory. This review grants no MLB activation, provider
calls, database writes, model changes, scheduler changes, or fresh prediction
certification. Historical certification statements remain historical.

## Cause and baseline

Main `0eabc5a5c9f634cb399534429a8240303321d629` failed the provider-free
`MLB release readiness` job at `SOURCE_DRIFT:src/app/globals.css`. The failure
was present on PR #381's base `233a059aad34486a4948e6891253f5d5af2466b5`:
that base had identical CSS and operational manifest blobs to merged main.
Job: <https://github.com/jlebronmarty-netizen/pick-analyzer/actions/runs/44633452654/job/135945849036>.

Full inventory audit found no mismatch among the 37 R3 sources, and exactly
five mismatches among the 107 operational sources. All historical certificate
and evidence hashes matched. Certified versions of the five files were read
from `92aa7e476024a5c2dfa6f11b145b2a9a17a545e4`; their normalized SHA256 values
match the October manifest before comparison with current source.

| Reviewed path | Change and boundary |
| --- | --- |
| `src/app/globals.css` | Additive UFC contrast and shared sport presentation rules. |
| `src/app/layout.tsx` | Spanish language/metadata and static sport navigation; personalization remains. |
| `src/components/dashboard/DashboardShell.tsx` | Translated/reordered labels and sport route titles; existing destinations preserved. |
| `src/components/dashboard/DashboardShellClient.tsx` | Translated labels and section headings. |
| `src/components/pick2/CanonicalDashboardBoundary.tsx` | Delegates route classification to a pure helper; the five originally protected routes still avoid the legacy provider. Additional read-only sports routes avoid its unrelated mount side effects. |

The boundary change concerns client data mounting, beyond visual presentation.
Its new helper `src/lib/read-only-sport-route.mjs` performs no I/O. The new
`src/components/dashboard/SportNavigation.tsx` renders static links with
prefetch disabled. Both dependencies are now pinned.

## Versioned manifest and preserved guards

The new `MLB_OPERATIONAL_READINESS_REVALIDATION_20261119.json` retains all 107
previously protected paths, adds the two UI dependencies and pins the prior
October operational manifest: 110 source pins total. The prior manifest and
every historical certificate/evidence file remain byte-for-byte unchanged.
All 37 R3 pins and the canonical R3 certificate reference remain unchanged.

Current review metadata records the exact prior and reviewed digest for each
of the five inspected files and the four necessary certificate-reference/gate
files. Those four are `next.config.ts`, `scripts/mlb-operational-tick.mjs`,
`scripts/mlb-operational-r6-vercel-runtime.mjs`, and
`scripts/verify-mlb-release-readiness.mjs`. Runtime source-validation loops,
activation checks, scheduling logic, provider budgets and business stages are
unchanged. Next.js traces the new manifest and all its pinned sources.

The provider-free checker retains prior certificate/evidence and source
integrity checks, then requires the new review's prior-manifest digest,
complete protected inventory, exact declared changes/additions and evidence
hashes. A current source digest alone does not constitute a review.

## Offseason pause and activation limits

- `vercel.json` has no `/api/cron/mlb-operational`, MLB settlement, or legacy
  operating-day cron entry. This change does not edit that file.
- `.github/workflows/production-operating-day.yml` has only manual dispatch,
  with a comment documenting removal of its independent scheduled writer.
- The shared Edge Lab schedule remains present. In
  `src/services/edge-lab-multi.service.mjs`, MLB returns `OFFSEASON_PAUSED`
  with zero provider attempts when `MLB_OFFSEASON_PAUSED` is `true`, before
  provider collection. This guard and all environment settings are unchanged.
- The historical automation activation artifact still says `ENABLED` and the
  authenticated operational route still exists. Passing the repaired source
  gate removes source drift as one blocker; it does not authorize invoking
  that route. No operational tick, manual workflow dispatch, environment
  change or new scheduler is part of this review.
- Live environment values and scheduler delivery are not established by this
  offline report. Production pause verification remains a separate read-only
  release check; no MLB reactivation is claimed.

## Verification scope

The focused regression suite exercises the unchanged original protected
routes, added read-only sports paths and legacy fallback. Disposable source
copies test valid inventory, protected source mutation/removal, unreviewed
hash refresh, historical manifest mutation, evidence mutation and new route
helper mutation. Tests do not invoke providers, databases or the operational
runtime. The existing MLB pagination and dashboard suites remain required.

Local verification: the standalone source checker passes all 37 R3 pins and
110 current operational pins. The full MLB production-readiness suite passes
31 tests (20 existing pagination tests plus 11 route/source review tests), and
`npm run test:dashboard-multisport` passes all 98 tests. The first combined
attempt could not load the existing pagination suite because this isolated
worktree had no installed dependencies; it passed after reusing the unchanged
dependencies installed from the repository lockfile in the sibling checkout.
The first attempt's new route/source tests passed independently.

Full application build, function-trace inspection and deployment readback are
handled in the enclosing release verification; this offline review does not
claim them. No operational tick was executed. Provider calls: 0. Database
writes: 0. Scheduler/environment changes: 0.
