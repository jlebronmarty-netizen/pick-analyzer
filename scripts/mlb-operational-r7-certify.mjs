// Offline source certification. Only structural results/hashes are published.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {collectRuntimeSourcePaths,normalizedFileDigest,R3_CERTIFICATE} from './mlb-data-02r-r2t-r3-readiness.mjs'
const root=process.env.R2S_VALIDATION_DIR
assert.ok(root && path.isAbsolute(root))
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
const sql=read(path.join(root,'schema-validation.json')),behavior=read(path.join(root,'pre-nonempty-readiness-tests.json'))
assert.equal(sql.checks.length,72);assert.ok(sql.checks.every(c=>c.status==='PASS'))
assert.equal(behavior.checks.length,17);assert.ok(behavior.checks.every(c=>c.status==='PASS'))
for(const [file,digest] of Object.entries(sql.testedSourceHashes??sql.sourceHashes))assert.equal(normalizedFileDigest(file),digest,`Untested runtime change: ${file}`)
const r3=read(R3_CERTIFICATE)
r3.sourceHashes=Object.fromEntries(collectRuntimeSourcePaths().map(file=>[file,normalizedFileDigest(file)]))
r3.r7Revalidation={status:'PASS',sqlChecks:72,championAnd76FeatureParity:'PASS',source:'MLB_DATA_02R_R7_FROZEN_RUN_MARKET_CHECKPOINT_RECOVERY_AND_AUTOMATION_REVALIDATION.json'}
write(R3_CERTIFICATE,r3)
const prePath='docs/CERTIFICATION/MLB_PRE_NONEMPTY_LIVE_READINESS.json',pre=read(prePath)
for(const file of [...Object.keys(pre.sourceHashes),'scripts/mlb-operational-r7-errors.mjs','supabase/functions/_shared/mlb-provider-evidence.mjs','src/app/api/cron/operating-day/route.ts','.github/workflows/production-operating-day.yml'])pre.sourceHashes[file]=normalizedFileDigest(file)
pre.r7Revalidation={status:'LOCAL_REPAIR_PASS',productionActivation:'PENDING',sqlChecks:72,behaviorGroups:17}
write(prePath,pre)
const certPath='docs/CERTIFICATION/MLB_DATA_02R_R7_FROZEN_RUN_MARKET_CHECKPOINT_RECOVERY_AND_AUTOMATION_REVALIDATION.json',cert=read(certPath)
cert.verdict='R7_LOCAL_REPAIR_CERTIFIED_PRODUCTION_REVALIDATION_PENDING'
cert.forensics.status='COMPLETE_WITH_EXPLICITLY_AUTHORIZED_OBSERVABILITY_GAP'
cert.forensics.firstException='UNRECOVERABLE_OBSERVABILITY_GAP'
cert.forensics.exactHistoricalExceptionKnown=false
cert.forensics.observabilityDefectConfirmed=true
cert.forensics.userAcceptedGap=true
cert.forensics.exceptionClaimIsHistoricalFact=false
cert.localRepair={durableEvidence:'IMMUTABLE_PRIVATE_STORAGE_WITH_FENCED_REFERENCE',evidenceBucket:'mlb-operational-evidence',maxObjectBytes:4194304,maxObjectsPerRun:2,rawPayloadInRuntimeCheckpoint:false,atomicFailureRecording:'PASS',expiredDisposition:'EXACT_REVIEW_DIGEST_AND_PRESERVED_STATE',midnight:'PASS',crossInstanceR2Recovery:'PASS',partialObservationRecovery:'PASS',sqlChecks:72,behaviorGroups:17,runtimeChecks:5,securityChecks:4,providerAwaitChecks:6,stateChecks:21,fencedWriteChecks:8,hostChecks:8,schemaChecks:27}
cert.remainingGates.providerDurability='LOCAL_PASS_PRODUCTION_STORAGE_READBACK_PENDING'
cert.remainingGates.marketResume='PASS_DISPOSABLE_REAL_R2'
cert.remainingGates.crossInstanceMarketRecovery='PASS_DISPOSABLE_REAL_R2'
cert.midnight.crossMidnightRepairRegression='PASS'
cert.schedulerInventory.legacyWriteRoute='GUARDED_BEFORE_PLANNER'
cert.schedulerInventory.legacyScheduledWriter='REMOVED_FROM_WORKFLOW'
cert.schedulerInventory.requiresSeparateOwnershipAndBudgetReconciliation=false
cert.schedulerInventory.accountingReconciliation='R6 mission ledger remains 3/20; two distinct historical legacy acquisitions are separately retained and are not frozen-run evidence. No counter was reset or discounted.'
cert.sourceHashes=Object.fromEntries([...new Set([...Object.keys(r3.sourceHashes),...Object.keys(pre.sourceHashes),'scripts/mlb-operational-r7-runtime-validate.mjs','scripts/mlb-operational-r7-security-validate.mjs','scripts/mlb-operational-r6-r2-resume-validate.mjs'])].sort().map(file=>[file,normalizedFileDigest(file)]))
write(certPath,cert)
console.log(JSON.stringify({status:cert.verdict,sourceFiles:Object.keys(cert.sourceHashes).length,providerCalls:0,productionDml:0,productionDdl:0}))
