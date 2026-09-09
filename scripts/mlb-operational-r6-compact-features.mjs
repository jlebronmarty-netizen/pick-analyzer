// Read-only runtime adapter. Every feature row/vector is still produced by the
// existing certified R1 builder. At most one game's dependency rows are retained.
import { buildAllPregameFeatureRows, expandAllGameTargets, buildPregameFeatureRows, pregameGameDefinition, assemblePregameVector } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import {inferChampion} from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
const ensure = (ok, reason) => { if (!ok) throw Error(`R6_FEATURES:${reason}`) }
const physicalRow=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['identity','feature_digest'].includes(key)))
const domainRows=(rows,gamePk)=>Object.fromEntries(Object.entries(rows).filter(([domain])=>domain!=='offense').map(([domain,list])=>[domain,list.filter(r=>r.target_game_pk===gamePk).map(physicalRow).sort((a,b)=>String(a.id).localeCompare(String(b.id)))]))

export function pinnedFeatureReferences({generated,persistedRows}) {
  return generated.games.map(game=>{
    const rows=domainRows(persistedRows,game.target.gamePk)
    return {kind:'persisted_features',identity:String(game.target.gamePk),digest:sha256(rows),count:Object.values(rows).reduce((n,list)=>n+list.length,0),asOf:game.target.runAsOf,
      identities:rows.snapshots.map(r=>r.id),vectorDigest:sha256(game.vector.values)}
  })
}

export async function restorePinnedFeaturePlan({contexts,references,repository}) {
  ensure(references.length===contexts.length,'PINNED_GAME_COUNT')
  const rows={snapshots:[],team:[],starter:[],bullpen:[],batter:[],matchup:[],firstInning:[],offense:0},games=[]
  for(const context of [...contexts].sort((a,b)=>a.target.gamePk-b.target.gamePk)) {
    const reference=references.find(r=>r.identity===String(context.target.gamePk))
    ensure(reference?.identities?.length===10 && reference.asOf===context.target.runAsOf,'PINNED_REFERENCE')
    const pinned=await repository.readPinnedFeatureRows(reference.identities)
    const selected=domainRows(pinned,context.target.gamePk)
    ensure(sha256(selected)===reference.digest && Object.values(selected).reduce((n,list)=>n+list.length,0)===reference.count,'PINNED_FEATURE_DRIFT')
    const game=pregameGameDefinition(context.target,context.starters)
    const built={rows:selected,game,provenance:{dependencyDigest:context.dependencies.dependencyDigest,latestAvailableAt:context.dependencies.latestAvailableAt}}
    const vector=assemblePregameVector({target:context.target,starters:context.starters,built})
    ensure(sha256(vector.values)===reference.vectorDigest,'PINNED_VECTOR_DRIFT')
    games.push({target:context.target,starters:context.starters,built,vector,inference:inferChampion({vector})})
    for(const domain of Object.keys(selected))rows[domain].push(...selected[domain].map(row=>domain==='snapshots'?row:Object.fromEntries(Object.entries(row).filter(([key])=>!['id','created_at'].includes(key)))))
    rows.offense+=selected.snapshots.filter(r=>r.native_identity_metadata?.family==='offense').length
  }
  return {rows,games,inventory:expandAllGameTargets(contexts),memory:{maximumConcurrentDependencyContexts:0,maximumDependencyRows:0,rawCheckpointBytes:0}}
}

export function compactFeatureContext(context) {
  const {target,starters,dependencies} = context
  const built = buildPregameFeatureRows({target,starters,rawRows:dependencies.rows,dependencyGamePks:dependencies.dependencyGamePks})
  return compactFromProvenance(context,built.provenance)
}
const compactFromProvenance = ({target,starters},provenance) => ({target,starters,dependencies:{scopeDigest:sha256(provenance.dependencyGamePks),dependencyCount:provenance.dependencyGamePks.length,actualRows:provenance.rawRows,dependencyDigest:provenance.dependencyDigest,latestAvailableAt:provenance.latestAvailableAt}})

export function prepareCompactFeatureContext({context,runDate,runAsOf}) {
  const generated=buildAllPregameFeatureRows({contexts:[context],runDate,runAsOf})
  return {context:compactFromProvenance(context,generated.games[0].built.provenance),generated}
}

export function durableContextReferences(context) {
  return [
    {kind:'pregame_target',identity:String(context.target.gamePk),digest:sha256({target:context.target,starters:context.starters}),count:1,asOf:context.target.runAsOf},
    {kind:'raw_dependencies',identity:String(context.target.gamePk),digest:context.dependencies.dependencyDigest,count:context.dependencies.actualRows,asOf:context.dependencies.latestAvailableAt},
    {kind:'dependency_scope',identity:String(context.target.gamePk),digest:context.dependencies.scopeDigest,count:context.dependencies.dependencyCount,asOf:context.target.runAsOf},
  ]
}

export function featureContextReference(context) {
  ensure(!context.dependencies.rows, 'RAW_CONTEXT_NOT_COMPACT')
  return {kind:'pregame_context',identity:String(context.target.gamePk),digest:sha256(context),count:context.dependencies.actualRows,asOf:context.target.runAsOf}
}

export async function buildCompactFeaturePlan({contexts,runDate,runAsOf,readDependencies,onGame=null,preparedPlans=null}) {
  ensure(typeof readDependencies === 'function' && contexts.length <= 50, 'DEPENDENCY_READER')
  const inventory = expandAllGameTargets(contexts)
  const rows = {snapshots:[],team:[],starter:[],bullpen:[],batter:[],matchup:[],firstInning:[],offense:0}, games=[]
  let maximumDependencyRows = 0
  for (const context of [...contexts].sort((a,b)=>a.target.gamePk-b.target.gamePk)) {
    let generated=preparedPlans?.get(context.target.gamePk)
    if(!generated) {
      const dependencies = await readDependencies(context.target,context.starters)
      ensure(dependencies.rows.length <= 500000, 'PER_GAME_MEMORY_ROW_CAP')
      generated = buildAllPregameFeatureRows({contexts:[{...context,dependencies}],runDate,runAsOf})
    }
    const reconstructed = compactFromProvenance(context,generated.games[0].built.provenance)
    ensure(sha256(reconstructed) === sha256(context), 'CANONICAL_EVIDENCE_DRIFT')
    maximumDependencyRows = Math.max(maximumDependencyRows,generated.games[0].built.provenance.rawRows)
    // Optional awaited persistence/checkpoint hook permits bounded stage yields.
    if (onGame) await onGame(generated)
    for (const domain of Object.keys(rows)) {
      if (domain === 'offense') rows.offense += generated.rows.offense
      else rows[domain].push(...generated.rows[domain])
    }
    games.push(...generated.games)
  }
  for (const [domain,cap] of Object.entries(inventory.maximumCandidateCaps)) ensure(rows[domain].length === cap,'ALL_GAME_ROW_CAP')
  return {rows,games,inventory,memory:{maximumConcurrentDependencyContexts:1,maximumDependencyRows,rawCheckpointBytes:0}}
}
