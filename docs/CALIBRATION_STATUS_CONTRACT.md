# Calibration Status Contract V1

Adaptive Operations reports calibration as a typed informational state:

- `SAMPLE_GATED`: calibration exists but remains limited by settled sample size.
- `READY`: sufficient settled sample and calibration evidence exist.
- `INSUFFICIENT_DATA`: no meaningful calibration evidence exists.
- `ERROR`: calibration read failed.

The current Adaptive Operations surface uses `SAMPLE_GATED` unless a future stored calibration contract is connected directly. This status never promotes a model, changes weights or changes official-pick thresholds.
