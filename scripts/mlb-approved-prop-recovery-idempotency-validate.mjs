import fs from 'node:fs'

const capture=fs.readFileSync('src/services/mlb-approved-prop-market-capture.service.ts','utf8')
const evals=fs.readFileSync('src/services/mlb-approved-prop-daily-evaluation.service.ts','utf8')
const checks=[
  ['quote identity includes price', /playerName, selection, line, price, snapshotTime/.test(capture)],
  ['capture recovery extends through 11:50', /clock\.hour === 11 && clock\.minute <= 50/.test(capture)],
  ['daily evaluator has 11:50 recovery window', /recoveryFreezeWindow = clock\.hour === 11 && clock\.minute <= 50/.test(evals)],
  ['freeze still blocks after first pitch', /BLOCK_FREEZE_AFTER_FIRST_PITCH/.test(evals)],
  ['duplicate payload conflict guard preserved', /MLB_APPROVED_PROP_DUPLICATE_ID_PAYLOAD_CONFLICT/.test(capture)],
]
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name)
console.log(JSON.stringify({success:!failed.length,checks:checks.length,passed:checks.length-failed.length,failed},null,2))
if(failed.length)process.exitCode=1
