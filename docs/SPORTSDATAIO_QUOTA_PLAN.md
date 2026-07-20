# SportsDataIO Quota Plan

Status: Implemented
Version: V1

## Discovery V1

Provider calls made by the discovery API: 0.

## Safe Call Policy

Any future live discovery execution must include:

- Protected authorization
- Endpoint allowlist
- Date or season scope
- Max-call budget
- Sanitized payload retention policy
- Ledger entry in `sports_sync_jobs`
- No production promotion

## Current Forecast

- Catalog and stored-evidence discovery: 0 calls
- One corrected GamesByDate verification when explicitly approved: 0-1 calls
- Current slate odds refresh: existing operations only
- Line movement, props, alternates: blocked until explicit scope and budget
