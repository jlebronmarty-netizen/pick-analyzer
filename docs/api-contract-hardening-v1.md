# API Contract Hardening V1

API Contract Hardening V1 adds reusable helpers for consistent route envelopes, request IDs, typed errors and safe query parsing.

## Scope

- Add `src/lib/api-contract.ts`.
- Provide reusable helpers for:
  - request IDs
  - success envelopes
  - typed error envelopes
  - safe error messages
  - bounded integer query parsing
  - boolean query parsing
- Migrate representative new routes instead of rewriting the whole API surface.

## Migrated Routes

- `GET /api/providers/intelligence`
- `GET /api/providers/capabilities`
- `GET /api/providers/route-plan`
- `GET /api/data-quality/global`
- `GET /api/reconciliation/plan`

These routes now include `requestId` in successful responses and typed errors in failure responses.

## Error Shape

```json
{
  "success": false,
  "requestId": "uuid",
  "error": {
    "code": "BAD_REQUEST",
    "message": "Readable error message"
  }
}
```

## Success Shape

Existing route payloads are preserved and extended with:

```json
{
  "requestId": "uuid"
}
```

## Adoption Strategy

Do not rewrite every route at once. Apply the helper when:

- creating new routes
- touching a route for a module
- fixing an API bug
- adding authorization
- adding typed query/body validation

This keeps public contracts stable and reduces regression risk.

## Logging

Routes should log structured objects containing `requestId` and error objects. They must not log secrets or raw authorization headers.

## Future Work

Potential future additions:

- shared pagination parser
- date-range parser
- sport/league validator
- CRON_SECRET authorization helper
- body-schema validation
- OpenAPI-style route manifest generation
