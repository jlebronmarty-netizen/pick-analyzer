import fs from 'node:fs'

const source=fs.readFileSync('scripts/mlb-data-02r-r2t-production-bindings.mjs','utf8')

const exactCatch=/error\.message === 'R2TR1_BLOCK:REQUIRED_HISTORY_MISSING'/g
const blockedReason=/blockedGames\.push\(\{ gamePk: game\.game_pk, reason: 'REQUIRED_HISTORY_MISSING' \}\)/g

const checks=[
  ['compact path catches exact required-history guard', (source.match(exactCatch)||[]).length===2],
  ['both branches block target locally', (source.match(blockedReason)||[]).length===2],
  ['no broad R2TR1 catch introduced', !/error\.message\.startsWith\(['"]R2TR1_BLOCK:/.test(source)],
  ['non-matching errors are rethrown', (source.match(/throw error/g)||[]).length>=2],
]

const failed=checks.filter(([,ok])=>!ok).map(([name])=>name)
console.log(JSON.stringify({
  success:failed.length===0,
  mode:'MLB_TARGET_LOCAL_REQUIRED_HISTORY_BLOCK_V1',
  checks:checks.length,
  passed:checks.length-failed.length,
  failed,
  allowedTargetLocalGuard:['R2TR1_BLOCK:REQUIRED_HISTORY_MISSING'],
},null,2))
if(failed.length)process.exitCode=1
