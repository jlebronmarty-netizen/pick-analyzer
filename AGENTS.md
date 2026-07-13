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

## Safety

- Do not run destructive commands such as `git reset --hard`, `git clean`, destructive recursive deletes or broad file rewrites unless the user explicitly approves the exact action.
- Do not revert user changes. The worktree may already contain unrelated edits.
- Never write secrets, tokens, keys or real credentials to documentation, code comments, logs or committed files.
- Migrations must be additive and non-destructive unless the user explicitly approves a destructive migration.
- Stop only for genuine external blockers, missing credentials, destructive migrations, ambiguous business decisions or unrecoverable build failures after focused debugging.

## Autonomous Completion Standard

- A module is not complete until its APIs, services, persistence, dashboard integration, validation, docs and build are handled to the extent required by the module.
- If a provider or dataset is empty, verify typed empty behavior and document the limitation instead of forcing fake data.
- If a build fails, fix the real cause and repeat `npm.cmd run build` until exit code 0 or a true blocker is reached.
