# Intelligence API V1

Status: RELEASE 06 IMPLEMENTED

API: `/api/model/intelligence`

The intelligence API summarizes the current production sample, supported dimensions, available markets, buckets, feature coverage and missing analytical dimensions. It wraps the same read-only segment engine used by `/api/model/segments`.

## Response Summary

| Field | Meaning |
| --- | --- |
| `currentProductionSample` | Aggregate segment metrics for the filtered scope. |
| `supportedSegmentDimensions` | Dimensions exposed by the segment engine. |
| `availableMarkets` | Markets present in returned rows. |
| `confidenceBuckets` | Deterministic confidence bucket labels. |
| `probabilityBuckets` | Deterministic probability bucket labels. |
| `featureCoverage` | Counts of rows with persisted snapshot domains. |
| `missingAnalyticalDimensions` | Context not yet consistently available from stored rows. |
| `segmentSummary` | High-value segment summaries for model optimization. |

## Read-Only Guarantees

The route performs only stored-row reads. It does not call providers, write to Supabase, create predictions, settle rows, update learning labels, or mutate model state.

Certification wording: No provider calls. No database mutations.
