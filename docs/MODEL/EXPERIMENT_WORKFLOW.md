# Experiment Workflow

Status: RELEASE 10 HUMAN-CONTROLLED EXPERIMENTATION GATE

Release 10 converts model evolution from recommendation-only analysis into a controlled experiment process. It still does not apply any model change to production.

## Workflow

1. Candidate
2. Evidence
3. Experiment registration
4. Baseline snapshot
5. Offline run
6. Regression report
7. Human approval
8. Future production release

## Offline Runner Contract

The runner is read-only. It accepts a candidate record and compares it against the frozen Release 10 baseline.

Required output:

| Metric | Requirement |
| --- | --- |
| Accuracy | Candidate must not decrease global accuracy |
| Brier | Candidate must improve or preserve global Brier |
| Calibration | Candidate must improve or preserve calibration error |
| Confidence | Candidate confidence cannot become less stable |
| ROI | Report when available; never infer missing ROI |
| Official Picks impact | Must not degrade Official Pick subset |
| Regression status | Must be explicit |

## Candidate Evaluation

Every candidate receives exactly one result:

| Result | Meaning |
| --- | --- |
| PASS | Candidate beats baseline and no protected metric regresses |
| FAIL | Candidate regresses or fails a hard gate |
| INSUFFICIENT DATA | Candidate may be plausible but evidence is too sparse |

## Regression Report

Every experiment must classify each area:

| Area | Classification |
| --- | --- |
| Global | Improved, worsened or unchanged |
| Market | Improved, worsened or unchanged |
| Bucket | Improved, worsened or unchanged |
| Segment | Improved, worsened or unchanged |
| Official Picks | Improved, worsened or unchanged |

If any protected metric worsens, the candidate fails automatically.

## Human Approval

Human approval is required after a candidate passes offline experimentation. Approval must name:

- experiment ID;
- candidate;
- accepted evidence;
- regression report;
- rollback plan;
- future production release scope.

An approved experiment still cannot modify production until a separate release implements it.
