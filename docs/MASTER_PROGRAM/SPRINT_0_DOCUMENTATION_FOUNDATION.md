# Sprint 0 Documentation Foundation

Date: 2026-07-31

Status: IMPLEMENTED

## Mission

Align the repository with the Master Program development methodology without changing product functionality.

No runtime behavior, Decision Core logic, predictions, providers, settlement, learning, APIs, database schema or UI was changed.

## Repository Inventory

Read-only inventory found:

| Category | Count |
| --- | ---: |
| Documentation artifacts under `docs/` | 582 |
| Markdown files under `docs/` | 490 |
| JSON artifacts under `docs/` | 92 |
| V2 phase artifacts | 28 |
| Release documents | 12 |
| Certification/readiness documents | 76 |
| Architecture/policy/contract documents | 40 |
| Product/UX documents | 77 |

Root-level documentation:

- `README.md`
- `START_HERE.md`
- `AGENTS.md`

Primary documentation groups already present:

- V1 certification and evidence artifacts.
- V2 phase artifacts.
- Release 01 planning documents.
- MLB, NBA, NFL, NHL, BSN, Soccer, Tennis and UFC sport-specific documents.
- Provider, data coverage and budget documents.
- Settlement, learning, performance and prediction governance documents.
- Build, Vercel and Webpack recovery documents.

## Duplicates And Overlap

Known overlap categories:

- AI and Decision Core naming: multiple `AI_*` documents overlap with the approved Decision Core direction.
- Provider budget policy: `PROVIDER_BUDGET_POLICY.md`, `PROVIDER_BUDGET_POLICY_V1.md` and provider-specific budget docs overlap.
- Build-memory evidence: multiple `build-memory-optimization-*` JSON artifacts represent historical build investigations.
- Settlement documentation: `settlement-core-v2.md`, reconciliation docs and multiple recovery docs should eventually be indexed by canonical/current vs historical.
- Product readiness: product matrices, route inventories, stabilization audits and V2 phase artifacts overlap in scope.
- Release records: certified V1 release evidence and Release 01 planning now live together under `docs/RELEASES`.

No duplicate was deleted in Sprint 0.

## Current To Proposed Structure

Current:

```text
/
  README.md
  START_HERE.md
  docs/
    many root-level product, architecture, certification, provider, history and phase artifacts
    releases/
```

Proposed and partially executed:

```text
/
  README.md
  START_HERE.md
  docs/
    README.md
    MASTER_PROGRAM/
    RELEASES/
    PRODUCT/
    ARCHITECTURE/
    CERTIFICATION/
    HISTORY/
```

## Executed Safe Operations

| Operation | Result | Justification |
| --- | --- | --- |
| Replace generic Next.js `README.md` | Done | The repository needed a product README that links the Master Program and current release. |
| Normalize `docs/releases` to `docs/RELEASES` | Done | Aligns release docs with the approved structure. |
| Add `docs/README.md` | Done | Creates a documentation entry point. |
| Add `docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md` | Done | Required Master Program index. |
| Add Master Program chapter placeholders | Done | Provides stable chapter links without inventing release functionality. |
| Add `PRODUCT`, `ARCHITECTURE`, `CERTIFICATION`, `HISTORY` indexes | Done | Creates target landing pages without risky mass moves. |

## Migration Plan

| File or Group | Decision | Justification |
| --- | --- | --- |
| `README.md` | Rename content in place | Root README should be product-facing, not framework boilerplate. |
| `START_HERE.md` | Keep at root | It is the contributor entry point required by the Master Program. |
| `docs/MASTER_ROADMAP.md` | Keep | Canonical detailed roadmap remains referenced by Master Program Roadmap chapter. |
| `docs/PROJECT_STATUS.md` | Keep | Ongoing operational status remains a top-level docs status ledger. |
| `docs/releases/*` | Move to `docs/RELEASES/*` | Release docs belong under the release folder. |
| `docs/PICK_ANALYZER_V2_PHASE_*` | Keep for now | These are phase certifications; move later to `CERTIFICATION` or `HISTORY` in bounded batches. |
| `docs/PICK_ANALYZER_V1_*` | Keep for now | V1 evidence should eventually move to `HISTORY` or `CERTIFICATION`; do not break audit links. |
| Product docs | Keep for now | Move to `PRODUCT` only after link validation per batch. |
| Architecture/policy/contract docs | Keep for now | Move to `ARCHITECTURE` only after link validation per batch. |
| Certification/readiness docs | Keep for now | Move to `CERTIFICATION` only after link validation per batch. |
| Historical/build/provider evidence JSON | Keep for now | Archive only after canonical indexes and links exist. |
| Obsolete docs | Archive later | No automatic delete in Sprint 0. |

## Missing Documents Filled

- `docs/README.md`
- `docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md`
- `docs/MASTER_PROGRAM/PRODUCT_VISION.md`
- `docs/MASTER_PROGRAM/DECISION_CORE.md`
- `docs/MASTER_PROGRAM/RELEASE_METHODOLOGY.md`
- `docs/MASTER_PROGRAM/ENGINEERING_GOVERNANCE.md`
- `docs/MASTER_PROGRAM/DOCUMENTATION_STRUCTURE.md`
- `docs/MASTER_PROGRAM/ROADMAP.md`
- `docs/RELEASES/README.md`
- `docs/PRODUCT/README.md`
- `docs/ARCHITECTURE/README.md`
- `docs/CERTIFICATION/README.md`
- `docs/HISTORY/README.md`

## Deferred Moves

Most root-level documents were intentionally not moved in Sprint 0. The repository has hundreds of historical links and phase artifacts; moving them all at once would create avoidable broken links and noisy history.

Future documentation migration should happen one category at a time:

1. Product docs to `docs/PRODUCT`.
2. Architecture/policy/contract docs to `docs/ARCHITECTURE`.
3. Certification/readiness docs to `docs/CERTIFICATION`.
4. Superseded historical docs to `docs/HISTORY`.

Every batch must update links and pass link validation.

## Deleted Documents

Zero.

## Runtime Impact

None.

## Sprint 0 Verdict

PASS.
