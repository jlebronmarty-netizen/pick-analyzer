import assert from 'node:assert/strict'
import fs from 'node:fs'

const service = fs.readFileSync('src/services/mlb-pitcher-earned-runs-training-readiness.service.ts', 'utf8')
const docs = fs.readFileSync('docs/CERTIFICATION/PA12_PITCHER_ER_TRAINING_READINESS_V1.md', 'utf8')
const pa13 = fs.readFileSync('docs/CERTIFICATION/PA13_PITCHER_ER_PRICING_AUDIT_2026-09-15.md', 'utf8')

assert.match(service, /SHARED_MLB_PITCHER_ER_OUTCOME_VERSION/)
assert.match(service, /readSharedPitcherErOutcomePage/)
assert.match(service, /EXPECTED_OUTCOMES = 4473/)
assert.match(service, /EXPECTED_ELIGIBLE_OUTCOMES = 4470/)
assert.match(service, /EXPECTED_ZERO_OUT_EXCLUSIONS = 3/)
assert.match(service, /train\.length !== 2194 \|\| validation\.length !== 729 \|\| test\.length !== 645/)
assert.match(service, /candidateSelection: 'VALIDATION_RMSE_ONLY'/)
assert.match(service, /probabilityCalibration: 'EMPIRICAL_TRAIN_RESIDUALS_ONLY'/)
assert.match(service, /testPolicy: 'SCORE_ONLY_AFTER_VALIDATION_SELECTION_NO_TEST_TUNING'/)
assert.match(service, /officialPickWrites: 0/)
assert.match(service, /productionBettingActivation: false/)
assert.match(service, /modelPromotion: false/)
assert.match(docs, /RESEARCH_ONLY_NOT_PROMOTED/)
assert.match(pa13, /HISTORICAL_PITCHER_ER_PRICING=ABSENT/)
assert.match(pa13, /historical Pitcher ER ROI: \*\*NOT COMPUTABLE\*\*/)

console.log('PA-12 ER training-readiness static contract: PASS')
