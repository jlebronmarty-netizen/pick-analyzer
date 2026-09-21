import fs from 'node:fs'

const path='scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs'
const source=fs.readFileSync(path,'utf8')
const checks=[]
const check=(name,ok)=>checks.push({name,ok:Boolean(ok)})

check('legacy pick rows forced empty', /const\s+pickRows\s*=\s*\[\]/.test(source))
check('legacy official pick cap forced zero', /const\s+officialPickCap\s*=\s*0/.test(source))
check('canonical path persists zero official pick rows',
  /persistDownstreamRows\(\{\s*domain:\s*['"]officialPicks['"],\s*rows:\s*\[\],\s*repository,\s*eligibleGamePks:\s*scope,\s*cap:\s*0/.test(source))
check('canonical decision rows preserved as shadow evidence',
  /const\s+shadowOfficialPickRows\s*=\s*decision\.rows/.test(source))
check('canonical path asserts zero persisted official picks',
  /OFFICIAL_PICK_WRITE_BOUNDARY_VIOLATION/.test(source))
check('production repository hard rejects nonempty official pick writes',
  /OFFICIAL_PICK_WRITES_DISABLED_RESEARCH_BOUNDARY/.test(source))
check('production repository no direct official pick write passthrough',
  !/async\s+insertOfficialPicks\(rows,\s*cap\)\s*\{\s*return\s+write\(R2I_LIVE_TARGETS\.officialPicks/.test(source))
check('canonical path no longer persists decision rows',
  !/domain:\s*['"]officialPicks['"],\s*rows:\s*decision\.rows/.test(source))

const failed=checks.filter(x=>!x.ok)
const result={
  success:failed.length===0,
  mode:'mlb_official_pick_write_boundary_validation_v1',
  source:path,
  checks:checks.length,
  passed:checks.length-failed.length,
  failed:failed.length,
  failedChecks:failed.map(x=>x.name),
  expectedBoundary:{
    officialPickCreationAuthorized:false,
    canonicalRowsPersisted:0,
    repositoryNonemptyInsertAllowed:false,
  }
}
console.log(JSON.stringify(result,null,2))
if(failed.length)process.exitCode=1
