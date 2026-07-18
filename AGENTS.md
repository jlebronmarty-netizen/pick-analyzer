# Pick Analyzer Codex Instructions

These instructions apply repository-wide.

## Operating Rules

- Inspect the repository before modifying code. Read the relevant services, API routes, components, migrations and docs first.
- Reuse the existing architecture in `src/app`, `src/services`, `src/components`, `src/config`, `src/types`, `src/lib` and `supabase/migrations`.
- Do not duplicate prediction logic, Kelly logic, Monte Carlo logic, smart ranking, portfolio logic, sync orchestration, provider adapters or settlement logic.
- Preserve existing endpoints, public response contracts and dashboard workflows unless the user explicitly asks for a breaking change.
- Implement production-ready modules end to end: backend, frontend, persistence, validation, observability, docs and build verification when applicable.
- Run `npm.cmd run build` after every completed module. Fix all TypeScript and build errors before continuing.
- Update `docs/PROJECT_STATUS.md` and `docs/MASTER_ROADMAP.md` after each completed module.
- Never fabricate unsupported data. Return empty typed responses or explicit warnings when providers do not supply a capability.
- Keep Official Recommendations, Highest-Probability Outcomes, Best-Value Opportunities, Preview Candidates, Informational Parlays and unsupported markets clearly separated.
- Never force, relabel or promote an official pick because a user wants something to bet. Informational probability surfaces must remain distinct from recommendation-policy outputs.
- High probability and positive EV are different concepts. User-facing copy must say when a likely outcome is poor value, negative EV, insufficiently calibrated or blocked by policy.
- Unsupported markets such as First Five, Team Totals, NRFI/YRFI, pitcher props, batter props and alternate lines must not appear as available recommendations until ingestion, modeling, validation, settlement, replay and dashboard support are complete.
- Prediction history is versioned. Do not overwrite prior model rows to make a new model current; write challenger or shadow rows, keep Current Board scoped to current champion rows, and require explicit promotion/rollback logic before changing `is_current`.

## Safety

- Do not run destructive commands such as `git reset --hard`, `git clean`, destructive recursive deletes or broad file rewrites unless the user explicitly approves the exact action.
- Do not revert user changes. The worktree may already contain unrelated edits.
- Never write secrets, tokens, keys or real credentials to documentation, code comments, logs or committed files.
- Migrations must be additive and non-destructive unless the user explicitly approves a destructive migration.
- Stop only for genuine external blockers, missing credentials, destructive migrations, ambiguous business decisions or unrecoverable build failures after focused debugging.
- Preserve historical prediction snapshots, locked official picks, settlement, replay, calibration and adaptive-learning integrity.
- Do not use post-start or postgame information as pregame input. Preserve immutable prior feature snapshots when starters, lineups, weather or odds change.
- Prefer stored data before provider calls. Every necessary provider call must have a specific business reason, budget check, duplicate-call guard, ledger entry and sanitized evidence handling.
- Do not expose API keys, `CRON_SECRET`, authorization headers or provider credentials in documentation, logs or API responses.
- Do not manufacture arbitrage from consensus pricing or claim multi-book behavior when only consensus data is available.

## Autonomous Completion Standard

- A module is not complete until its APIs, services, persistence, dashboard integration, validation, docs and build are handled to the extent required by the module.
- If a provider or dataset is empty, verify typed empty behavior and document the limitation instead of forcing fake data.
- If a build fails, fix the real cause and repeat `npm.cmd run build` until exit code 0 or a true blocker is reached.
- Continue through the next safe phase when stored data is sufficient. Stop only for an unapproved provider call, unavailable credential/subscription, destructive migration, material business decision or true technical blocker.
- After production-impacting modules, deploy and verify affected APIs, dashboard HTTP behavior, system version, provider-call count and official-history immutability.
