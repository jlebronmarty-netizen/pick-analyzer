# Vercel Research Build Cost Policy

Purpose: reduce Vercel Build CPU spend without weakening production validation.

## Repository-enforced build rule

`main` always builds.

For non-main branches, Vercel may skip a preview build only when every changed path is under one of:

- `.github/`
- `docs/research/`
- `artifacts/research/`
- `scripts/research/`

Any other path forces a normal build. Missing/unknown Git SHAs also force a build.

Runtime-sensitive paths such as `src/`, `supabase/`, `contracts/`, root config files and the build-filter script itself are intentionally not skippable.

## Agent/chat working convention

When doing research-only work:

- batch related artifact/doc/test edits into as few commits as practical;
- prefer GitHub Actions for research validation;
- do not create a Vercel preview solely to validate docs, frozen artifacts or offline research tests;
- do not split one logical research result into many commits unless needed for pre-evaluation freezing discipline;
- when a pre-evaluation freeze must be a separate commit, keep subsequent evidence/docs/tests grouped where possible.

These cost controls do not relax research gates, temporal-safety rules, Official Picks boundaries, APOSTAR controls or production review requirements.
