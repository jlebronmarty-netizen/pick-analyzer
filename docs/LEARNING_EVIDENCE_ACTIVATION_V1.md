# Learning Evidence Activation V1

Status: implemented as evidence acceptance and shadow-readiness validation.

## Contract

Learning samples may be accepted only when all are true:

- deterministic production label exists
- row is not Legacy, Ignored, Historical, Replay, Shadow, cancelled, voided or test-like
- point-in-time feature evidence exists
- feature cutoff is not after game start
- leakage status is not blocked

Accepted samples are not the same as production weight updates.

## Current Result

The current deterministic MLB production label set contains 593 labels. Feature evidence exists for 45 labels. The remaining 548 labels are rejected because no point-in-time feature snapshot is linked.

Production weight activation remains blocked until accepted evidence is sufficient and validation gates pass.
