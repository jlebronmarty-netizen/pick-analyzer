# Production Failure Recovery

Status: Implemented
Version: V1

## Retryable

- Provider timeout
- Temporary network failure
- Rate limiting
- Transient Supabase failure
- Serverless timeout

## Terminal

- Missing credentials
- Unsupported endpoint
- Missing migration
- Invalid provider schema
- Subscription denial

## Current Recovery

Adaptive Refresh blocks duplicate runs, checks provider budget before execution and returns retryable status when delegated operating-day execution fails.

Detailed exponential retry scheduling remains an operations hardening item.
