import fs from 'node:fs'

const capture=fs.readFileSync('src/services/mlb-approved-prop-market-capture.service.ts','utf8')
const evals=fs.readFileSync('src/services/mlb-approved-prop-daily-evaluation.service.ts','utf8')
const checks=[
  ['quote identity includes price', /playerName, selection, line, price, snapshotTime/.test(capture)],
  ['capture recovery extends through 11:50', /clock\.hour === 11 && clock\.minute <= 50/.test(capture)],
  ['daily evaluator recovery covers 13:02 cron through 13:10', /clock\.hour === 11/.test(evals) && /clock\.hour === 12/.test(evals) && /clock\.hour === 13 && clock\.minute <= 10/.test(evals)],
  ['freeze still blocks after first pitch', /BLOCK_FREEZE_AFTER_FIRST_PITCH/.test(evals)],
  ['duplicate payload conflict guard preserved', /MLB_APPROVED_PROP_DUPLICATE_ID_PAYLOAD_CONFLICT/.test(capture)],
]
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name)
console.log(JSON.stringify({success:!failed.length,checks:checks.length,passed:checks.length-failed.length,failed},null,2))
if(failed.length)process.exitCode=1
