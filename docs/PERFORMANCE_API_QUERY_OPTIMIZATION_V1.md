# Performance API Query Optimization V1

Date: 2026-07-28

Status: `LOCAL_CERTIFIED`

## Scope

Targeted P1 repair for `/api/performance` latency and payload pressure. This phase keeps Performance Scope V2 as the canonical metric source and makes no business-rule, prediction, settlement, learning, probability, confidence, Trust, Official Pick, scheduler, provider or database-schema changes.

## Root Cause

Read-only profiling showed the hot `/api/performance` route executed both:

- the product contract path used by `/performance`;
- the full AI Performance Center diagnostics graph.

The diagnostics graph loaded unrendered prediction history and broad diagnostics into the default response, producing an approximately 11.9 MB payload and 26.5-32.9 second local response times. Narrow product-contract routes were already much smaller but still paid repeated production-scope reads.

Classification:

- `DUPLICATE_QUERY`
- `LARGE_JSON_PAYLOAD`
- `UNBOUNDED_DIAGNOSTIC_RESPONSE_ON_HOT_ROUTE`
- `SEQUENTIAL_SCOPE_DEPENDENCY`

## Changes

- `/api/performance` now defaults to `responseMode: "product_summary"` and uses the canonical `getPerformanceProductContract` output for the fields rendered by `/performance` and Dashboard preview.
- Full AI Performance Center diagnostics remain available only with `?diagnostics=full` or `?includeDiagnostics=full`.
- Performance Scope V2 now loads scheduler coverage and prediction rows in parallel.
- Event lookup batching remains at 100 IDs because prior Supabase/PostgREST validation showed larger batches can exceed request/header limits.

## Before

Local bounded HTTP profiling with a fresh Next.js server lifecycle:

| Route | HTTP | Time | Payload |
| --- | ---: | ---: | ---: |
| `/api/performance` | 200 | 32.930s | 11,921,761 bytes |
| `/api/performance?profile=1` | 200 | 26.503s | 11,921,761 bytes |
| `/api/performance/sports` | 200 | 8.541s | 38,893 bytes |
| `/api/performance/trust` | 200 | 9.056s | 3,307 bytes |
| `/api/performance/report-card` | 200 | 8.838s | 5,923 bytes |

## After

Bounded local profiling after the repair:

| Route | HTTP | Time | Payload |
| --- | ---: | ---: | ---: |
| `/api/performance` run 1 | 200 | 5.470s | 667,864 bytes |
| `/api/performance` run 2 | 200 | 4.399s | 667,864 bytes |
| `/api/performance` run 3 | 200 | 4.857s | 667,864 bytes |
| `/api/performance?diagnostics=full` | 200 | 22.361s | 9,297,365 bytes |
| `/performance` | 200 | 0.092s | 6,315 bytes |
| `/dashboard` | 200 | 0.041s | 31,435 bytes |
| `/api/system/version` | 200 | 0.076s | 232 bytes |

Median default `/api/performance` latency improved from the observed 26.5-32.9 second range to approximately 4.86 seconds, and default payload size dropped by about 94.4%.

## Semantic Fingerprint

Default `product_summary` and explicit `full_diagnostics` matched for the product-visible fields:

- `apiStatus: SUCCESS`
- grade `C`
- trust label `MODERATE`
- settled sample `386`
- accuracy `48.95`
- trust score `67.52`
- season generated `2595`
- season settled `386`
- season record `186-194-6`
- sport count `8`
- timeline rows `6`

Both modes reported `providerCallsMade: 0` and `remoteMutationsMade: 0`.

## Validation

- `npm.cmd run build`: passed, 386 static pages.
- Bounded local smoke: passed for `/api/performance`, `/api/performance?diagnostics=full`, `/performance`, `/dashboard` and `/api/system/version`.
- Cleanup: temporary port listener released; remaining sockets were `TIME_WAIT` only.

## Certifications

- `PERFORMANCE_API_QUERY_OPTIMIZATION_PASS`
- `PERFORMANCE_PRODUCT_SEMANTIC_PARITY_PASS`
- `PERFORMANCE_PAGE_CONNECTION_PASS`
- `NO_PROVIDER_CALL_PASS`
- `NO_REMOTE_MUTATION_PASS`
- `NO_BUSINESS_RULE_CHANGE_PASS`
