# ODDS-02B Capture Harness Repair

Status: `CAPTURE_HARNESS_REPAIRED`

Starting commit: `b210e61627c99bc4394136477da782d0660ece3f`.

Production commit at start: `b210e61627c99bc4394136477da782d0660ece3f`.

Provider calls during ODDS-02B: `0`.

Database mutations during ODDS-02B: `0`.

## Root Cause

ODDS-02A lost certifiable response evidence because the local certification command expected the protected route response at `response.data`.

The canonical repository envelope is different. `/api/operations/odds-shadow-comparison` returns `apiOk(result, requestId)`, and `apiOk` spreads the service result at the response top level while adding `requestId`.

Canonical envelope:

```json
{
  "success": true,
  "mode": "odds02_the_odds_api_shadow_comparison_v1",
  "status": "SHADOW_ACQUISITION_COMPLETE",
  "providerCallsMade": 1,
  "remoteMutationsMade": 0,
  "requestId": "..."
}
```

Incorrect ODDS-02A assumption:

```json
{
  "data": {
    "success": true
  }
}
```

Classification: `CERTIFICATION_CLIENT_RESPONSE_CAPTURE_DEFECT`.

The protected endpoint itself is not proven defective.

## Response Contract Trace

Route:

- `src/app/api/operations/odds-shadow-comparison/route.ts`
- `GET ?validate=true` returns credential isolation validation.
- `GET` without `validate=true` returns dry-run shadow comparison.
- `POST` requires `CRON_SECRET`, `live=true`, `confirm=ODDS_02_SHADOW`, and bounded `maxCalls`.

Envelope:

- `src/lib/api-contract.ts`
- `apiOk(payload, requestId)` returns top-level payload fields plus `requestId`.

Service:

- `src/services/odds02-shadow-comparison.service.ts`
- Dry-run exposes credential, authority and production-isolation fields with `providerCallsMade: 0`.
- Live exposes provider accounting, event mapping, snapshots, coverage, comparisons, source ages, freshness improvement, case study and cutover decision.

Provider-accounting fields include:

- `providerCallsMade`
- `requestsUsed`
- `creditsUsed`
- `creditsRemaining`
- `calls[].requestsLast`
- `calls[].requestsUsed`
- `calls[].requestsRemaining`

Certification fields include:

- `eventsReturned`
- `eventsMapped`
- `eventsUnmapped`
- `ambiguousEvents`
- `shadowSnapshots`
- `coverage.bookmakers`
- `coverage.moneylineRows`
- `coverage.spreadRows`
- `coverage.totalRows`
- `comparisons[]`
- `sourceAges`
- `freshnessImprovementMinutes`
- `cutoverDecision`

## Capture-First Harness

Created:

- `scripts/odds-shadow-certification-capture.mjs`

The future command flow is:

1. HTTP response.
2. Durable temporary raw body capture.
3. Safe response metadata capture.
4. HTTP status validation.
5. JSON parse.
6. Canonical top-level `apiOk` contract validation.
7. Metric extraction.

The parser is no longer the only copy of a provider-consuming response.

## Capture Directory

Capture directory:

- `.tmp/odds-shadow-certification/`

The directory is gitignored in `.gitignore`.

The capture stores:

- response body;
- safe response metadata;
- HTTP status;
- endpoint path without secrets;
- method;
- live/dry-run mode;
- max live requests for the invocation.

The capture does not store:

- `THE_ODDS_API_KEY`;
- `CRON_SECRET`;
- request headers;
- `Authorization` header;
- provider URL query strings containing credentials.

## One-Call Guarantee

The live path in `scripts/odds-shadow-certification-capture.mjs` makes at most one protected request per invocation.

There is no automatic retry on:

- timeout;
- HTTP failure;
- malformed JSON;
- contract failure;
- parser failure.

Any retry after a provider-consuming attempt requires fresh explicit authorization.

## Failure Injection

The ODDS-02B validator proves:

- valid top-level `apiOk` response parses successfully;
- stale nested `response.data` envelope is rejected clearly;
- malformed JSON is captured before parse failure;
- HTTP non-2xx status is captured;
- missing required fields fail contract validation;
- simulated parser exception preserves the raw captured response;
- secrets and authorization strings are blocked from capture;
- future live script supports request and credit accounting;
- no runtime recommendation logic changed.

## ODDS-02A Status

ODDS-02A remains:

`ODDS_02A_FINAL_REQUEST_CONSUMED_CERTIFICATION_INCOMPLETE`

ODDS-02B does not rewrite ODDS-02A to PASS and does not authorize a new provider request.

## Future Wide-Sample Readiness

The repaired harness is ready for a separately authorized wide-sample certification. It can preserve the raw response locally and extract sanitized aggregate evidence for:

- events returned;
- expected mappable events;
- mapped, unmapped and ambiguous events;
- bookmaker coverage;
- moneyline, run line and total coverage;
- source timestamps;
- freshness;
- book prices;
- best fresh prices;
- SportsDataIO comparison;
- shadow edge and EV where exposed by the endpoint.

No ODDS-03 cutover was performed.
