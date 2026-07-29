# Model Evolution Roadmap

Date: 2026-07-29

Status: GOVERNANCE ROADMAP

No model training. No production mutation.

## Champion And Challenger

The current production prediction logic remains champion by default. A future trained model can only be a challenger until it passes offline validation, prospective shadow evaluation and explicit promotion approval.

## Roadmap

| Phase | Gate | Action |
| --- | --- | --- |
| Training V1 | 1,000+ accepted MLB rows | Regularized logistic regression shadow candidate only |
| Training V2 | 2,000+ accepted rows or 300+ per market | Per-market calibration and gradient-boosted challenger |
| Training V3 | Multi-season evidence and stable shadow lift | Small ensemble/blending with champion comparison |
| Training V4 | 5,000+ samples and multi-sport coverage | Stacked meta-models under strict governance |
| Future RL | Separate approval only | Research for portfolio simulation, not prediction probabilities |
| Future AutoML | Mature manifests and leakage guards | Offline challenger search only |

## Monitoring

Future promoted models require:

- calibration drift monitoring;
- feature distribution drift monitoring;
- market mix drift monitoring;
- sport status drift monitoring;
- rollback target verification;
- immutable validation reports.

Automatic promotion remains disabled.
