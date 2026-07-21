# SportsDataIO PlayerGameStatsByDate Endpoint Optimization

Date: 2026-07-21

Status: `ENDPOINT_TIMEOUT_OPTIMIZED`

## Scope

This investigation did not continue historical import, backfill or extraction. It made one direct read-only diagnostic provider request for:

`/api/mlb/fantasy/json/PlayerGameStatsByDate/2026-JUL-17`

No database writes were performed by the diagnostic request.

## Finding

The endpoint is entitled and returns HTTP 200, but it is slow enough that the previous 15-20 second client-side timeout window was too tight for reliable import execution.

Measured diagnostic result:

- HTTP status: 200
- Time to headers: 1093 ms
- Time to first byte: 1121 ms
- Body download time: 13945 ms
- Total response time: 15041 ms
- Decoded payload size: 646,490 bytes
- Rows: 418
- JSON parse time: 142 ms
- Memory delta during diagnostic process: 46.24 MB
- Content-Length header: not provided
- Content-Encoding header: not provided
- Rate-limit header: not provided
- Retry-After header: not provided

## Root Cause

Root cause is client-side timeout margin, not provider entitlement, rate limiting, server HTTP failure, JSON parse time or payload size alone.

The endpoint returns a moderately sized JSON payload, but body transfer consumed nearly 14 seconds and the import transport timeout previously wrapped the full `fetch`/body read path. A 15 second default timeout, or a 20 second route override under server load, can abort a valid response before it completes.

## Optimization

The MLB Discovery historical import transport default timeout was raised from 15 seconds to 60 seconds.

No import logic, scheduler, prediction logic, recommendation logic or Current Board behavior was changed.

## Recommendation

Recommended timeout: 60 seconds.

Recommended batch size: one `PlayerGameStatsByDate` date per provider call/checkpoint.

Recommended extraction strategy:

- Keep sequential execution.
- Keep no automatic retry inside the same run.
- Keep the recent failed-checkpoint retry cooldown.
- Use one completed date at a time for this endpoint.
- Stop on timeout, 401, 403, 429, billing warning, malformed payload or persistence mismatch.

