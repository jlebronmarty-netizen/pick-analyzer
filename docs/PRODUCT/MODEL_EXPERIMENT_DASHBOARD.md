# Model Experiment Dashboard

Status: RELEASE 10 READ-ONLY PRODUCT SPECIFICATION

The Model Experiment Dashboard is an operational view for model governance. Release 10 defines the dashboard contract and source evidence; it does not change production model behavior.

## Purpose

The dashboard should answer:

- What is the current baseline?
- Which experiments are waiting for data?
- Which experiments failed?
- Which experiments are approved for a future release?
- Which protected metrics would regress?

## Sections

| Section | Contents | Source |
| --- | --- | --- |
| Current Baseline | Accuracy, Brier, calibration, confidence, Official Pick sample | `docs/MODEL/BASELINE_MODEL.md` and `/api/model/intelligence` |
| Running Experiments | Experiments with `RUNNING` status | `docs/MODEL/EXPERIMENT_REGISTRY.md` |
| Rejected Experiments | Failed or unsafe candidates with reason | Experiment registry and Release 08 candidates |
| Approved Experiments | Human-approved candidates waiting for a production release | Experiment registry |
| Waiting For Data | Candidates below sample or confidence threshold | Experiment registry |
| Trend Over Time | Future baseline snapshots by release | Certification history |

## Current Dashboard Summary

| Status | Count |
| --- | ---: |
| Running | 0 |
| Approved | 0 |
| Rejected / Failed | 2 |
| Waiting or insufficient data | 2 |
| Production model changes | 0 |

## Presentation Rules

- Show baseline metrics before experiment results.
- Display `INSUFFICIENT DATA` as a valid outcome, not a failure of the system.
- Never show a candidate as approved unless human approval exists.
- Never imply production prediction quality changed during Release 10.
- Include provider calls and database mutations as zero during certification.
