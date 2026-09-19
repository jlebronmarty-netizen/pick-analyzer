# PA-12 Sealed TEST Execution Policy

The PA-12 Pitcher Earned Runs readiness branch freezes candidate code and selection rules before any branch-specific sealed TEST HTTP readback.

The first successful runtime invocation of `/api/mlb/research/pitcher-earned-runs/training-readiness` on the frozen preview is the sealed TEST evaluation for this branch.

After that readback:

- TEST metrics may be recorded but not used to alter features, candidates, coefficients, lines, calibration or thresholds;
- any code change affecting model behavior invalidates this branch as a single-run sealed TEST and requires a new versioned research path;
- no model promotion follows automatically regardless of the TEST result;
- PA-13 remains price-data blocked unless genuine historical Pitcher Earned Runs sportsbook prices are later recovered.
