# Platform Lock Policy

Certified baseline: 94159038571ba16cf31107403efce3af7f13ba50

Stable release tag: v1.0-platform-certified

Certification date: 2026-07-26

## Purpose

This policy freezes the certified Pick Analyzer production platform as a trusted rollback and governance baseline. Locked does not mean files can never change. It means changes require explicit release discipline because these modules are part of the certified production contract.

## Locked Modules

- architecture
- operating-day context
- scheduler ownership
- odds pipeline
- provider evidence contract
- prediction cutoff policy
- Grounded Opportunities contract
- Current Board candidate contract
- Most Likely lifecycle filtering
- Best Value price integrity
- Official Pick policy
- settlement grading
- settlement dry-run safety
- Learning Brain weights and policy
- Performance scope v2
- Dashboard canonical ViewModel
- cache invalidation chain
- operations diagnostics

## Required Change Gate

Any future change to a locked module requires:

1. Documented reason.
2. Proven production defect or approved product requirement.
3. Impact analysis.
4. Focused regression tests.
5. Build pass.
6. Production smoke verification.
7. Explicit approval before deployment.

## Non-Negotiable Protections

- Do not alter model probabilities or confidence formulas without explicit model-governance approval.
- Do not loosen Official Pick policy to create bets.
- Do not change settlement grading without deterministic fixture and production smoke evidence.
- Do not change Learning Brain weights or promotion policy without explicit approval.
- Do not add a second write-capable scheduler.
- Do not fabricate odds, timestamps, probabilities, EV, edge, confidence or missing metrics.
- Do not promote BSN beyond Shadow / Preview without a separate approved certification.
- Do not begin Portfolio Intelligence under this platform lock phase.

## Release Evidence Expectations

Each locked-module change must leave evidence in the repository, including the affected contract, tests or focused validation, build result and production smoke result. Production-impacting changes must verify `/api/system/version`, operations status, Dashboard, Current Board, Most Likely, Best Value, settlement dry-run and Performance as applicable.
