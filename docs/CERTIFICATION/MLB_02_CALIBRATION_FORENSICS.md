# MLB-02 Calibration Forensics

Classification: MLB_02_CALIBRATION_FORENSICS_CERTIFIED

Provider calls: 0

Production DB mutations: 0

Root cause: Current dominant MLB rows carry skipped/null calibration because no production calibration artifact is eligible for this model/version path; productionEligible is 0 and learning_labels is 0, so runtime calibration has no approved bootstrap label/artifact source.

Market-specific calibration recommended: YES

Context-enhanced shadow design ready: YES
