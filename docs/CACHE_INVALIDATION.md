# Cache Invalidation

Status: Implemented
Version: V1

## Policy

Operational APIs are dynamic server routes and dashboard panels fetch them with `cache: no-store`.

Current-state routes must not rely on:

- Static generation time
- Failed attempt timestamps
- Plan creation timestamps
- Browser state after mutation

## Affected Surfaces

- `/api/operations/health`
- `/api/operations/status`
- `/api/operations/adaptive-refresh/status`
- `/api/current-board`
- `/api/mlb/projections/health`
- `/dashboard`

Global caching is not disabled. Only operational consumers are forced to fetch fresh state.
