// Read-only replay of previously certified private evidence. No network or DML.
// Only aggregate certification results may be published; evidence stays private.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { compactFeatureContext, durableContextReferences, pinnedFeatureReferences, buildCompactFeaturePlan } from './mlb-operational-r6-compact-features.mjs'
import { buildAllPregameFeatureRows } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { validateCheckpoint, serializedBytes } from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {canonicalMarketReference} from './mlb-data-02r-r2t-market-binding.mjs'
const root = path.join(os.tmpdir(),'pick-analyzer-mlb-operational-live')
const runId = 'mlb-operational-04035c55-b6b8-47f6-9882-4553fc43df85'
const manifest = JSON.parse(fs.readFileSync(path.join(root,`${runId}.json`),'utf8'))
const persisted=JSON.parse(fs.readFileSync(path.join(root,`result-${runId}.json`),'utf8'))
assert.equal(manifest.privateContextShards.version,1)
const contexts=[], references=[], sourceByGame=new Map(), expected=new Map()
const start=performance.now()
// The unchanged builder allocates provisional snapshot UUIDs. Persistence binds
// these by deterministic_identity. Compare every field after that same identity
// substitution, including daily-row FK references; never omit feature values.
const semanticDigest = generated => {
  const identities=new Map(generated.rows.snapshots.map(r=>[r.id,r.deterministic_identity]))
  return sha256(JSON.parse(JSON.stringify(generated,(_key,value)=>typeof value === 'string' && identities.has(value) ? identities.get(value) : value)))
}
let sourceBytes=0,peakRss=process.memoryUsage().rss
for (const part of manifest.privateContextShards.parts) {
  assert.ok(part.key.startsWith(`${runId}-context-`) && /^[A-Za-z0-9_-]+$/.test(part.key))
  const filename=path.join(root,`${part.key}.json`)
  sourceBytes+=fs.statSync(filename).size
  const context=JSON.parse(fs.readFileSync(filename,'utf8'))
  assert.equal(sha256(context),part.digest)
  const generated=buildAllPregameFeatureRows({contexts:[context],runDate:manifest.runContext.run_date,runAsOf:manifest.runContext.run_as_of})
  expected.set(context.target.gamePk,semanticDigest(generated))
  contexts.push(compactFeatureContext(context));sourceByGame.set(context.target.gamePk,filename)
  references.push(...pinnedFeatureReferences({generated,persistedRows:persisted.features.rows}))
  peakRss=Math.max(peakRss,process.memoryUsage().rss)
}
const evidence={contexts,nativeGames:manifest.evidence.nativeGames,blockedGames:manifest.evidence.blockedGames??[]}
const checkpoint={version:1,mode:'PREGAME',stage:'COMPLETE',scope:contexts.map(c=>c.target.gamePk),dependencyScope:[],completed:['SCOPE','DEPENDENCY_SCOPE','CONTEXTS','FEATURES','MARKETS'],references:[{kind:'run_freeze',identity:runId,digest:sha256(manifest.runContext),count:1,asOf:manifest.runContext.run_as_of},{kind:'context_evidence',identity:runId,digest:sha256(evidence),count:contexts.length,asOf:manifest.runContext.run_as_of},...contexts.flatMap(durableContextReferences),...references],blocked:evidence.blockedGames,marketGames:evidence.nativeGames,marketReference:canonicalMarketReference({markets:persisted.markets,evidence:manifest.odds,evaluatedAt:manifest.evaluatedAt}),result:{status:persisted.status,predictions:persisted.predictions.rows.length,values:persisted.values.rows.length,picks:persisted.picks.rows.length,inserted:persisted.insertedRows,reused:0,conflicts:0,readback:'PASS'}}
validateCheckpoint(checkpoint)
let verified=0
const plan=await buildCompactFeaturePlan({contexts,runDate:manifest.runContext.run_date,runAsOf:manifest.runContext.run_as_of,
  readDependencies:async target=>JSON.parse(fs.readFileSync(sourceByGame.get(target.gamePk),'utf8')).dependencies,
  onGame:async generated=>{assert.equal(semanticDigest(generated),expected.get(generated.games[0].target.gamePk));verified++;peakRss=Math.max(peakRss,process.memoryUsage().rss)},
})
assert.equal(verified,manifest.privateContextShards.parts.length)
assert.equal(plan.memory.maximumConcurrentDependencyContexts,1)
assert.ok(plan.games.every(g=>g.vector.length===76 || g.vector.values?.length===76))
const drift=structuredClone(contexts[0]);drift.dependencies.dependencyDigest='0'.repeat(64)
await assert.rejects(buildCompactFeaturePlan({contexts:[drift],runDate:manifest.runContext.run_date,runAsOf:manifest.runContext.run_as_of,readDependencies:async target=>JSON.parse(fs.readFileSync(sourceByGame.get(target.gamePk),'utf8')).dependencies}),/CANONICAL_EVIDENCE_DRIFT/)
const result={status:'PASS',scope:'READ_ONLY_REAL_FEATURE_PARITY_NOT_LIVE_PERSISTENCE',checkpointStage:'COMPLETE_WITH_CANONICAL_FEATURE_AND_MARKET_REFERENCES',games:verified,allSixDomainParity:'PASS',vectorAndChampionParity:'PASS',evidenceDriftRejected:true,sourceBytes,checkpointBytes:serializedBytes(checkpoint),maximumDependencyContexts:1,maximumDependencyRows:plan.memory.maximumDependencyRows,peakRssBytes:Math.max(peakRss,process.memoryUsage().rss),elapsedSeconds:Math.round((performance.now()-start)/1000),temporaryEvidenceWrites:0,providerCalls:0,productionDml:0,productionDdl:0,productionEntrypointIntegrated:'LOCAL_ONLY_PENDING_DEPLOYMENT'}
fs.writeFileSync(path.join(os.tmpdir(),'pick-analyzer-operational-mission','r6-compact-feature-validation.json'),JSON.stringify(result,null,2))
console.log(JSON.stringify(result))
