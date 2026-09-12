import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {durableContextReferences} from './mlb-operational-r6-compact-features.mjs'
const ensure=(ok,reason)=>{if(!ok)throw Error(`R6_CHECKPOINT:${reason}`)}

// Provider responses are immutable private objects. Runtime checkpoints retain
// compact references only; missing consumed evidence never permits reacquisition.
export function createDurableRunStore({runtime,runContext,root}) {
  const runId=runContext.run_id
  let canonical=null
  const persist=checkpoint=>runtime.checkpoint(checkpoint,{stages:runtime.run.dml_accounting.stages})
  const store={
    root,referenceOnly:true,providerLedger:runtime.ledger,
    get locked(){return runtime.locked},
    get frozenScope(){return runtime.run.checkpoint.completed.includes('SCOPE')?[...runtime.run.checkpoint.scope]:null},
    setCanonical(bindings){canonical=bindings},
    async checkOddsBudget() {
      if(runtime.ledger.operationalBudget?.()?.activation!=='ACTIVE')return
      const plan=await runtime.ledger.planOdds()
      if(!['ACQUIRE','RESUME_DURABLE_EVIDENCE'].includes(plan.decision))throw Error(`R6_STATE:${plan.decision==='ODDS_BUDGET_EXHAUSTED'?'OPERATIONAL_ODDS_DAILY_CAP':plan.decision==='ODDS_CADENCE_DEFERRED'?'ODDS_MIN_INTERVAL':'NO_ELIGIBLE_PREGAME_SCOPE'}`)
    },
    async recordGameVetoes(entries) {
      const cp=runtime.run.checkpoint,prior=cp.gameVetoes??[]
      const added=entries.filter(r=>!prior.some(p=>p.gamePk===r.gamePk))
      if(added.length)await persist({...cp,gameVetoes:[...prior,...added]})
      return runtime.run.checkpoint.gameVetoes??[]
    },
    async markStage(stage) {
      ensure(['PREDICTIONS','ODDS_ACQUISITION','MARKET_PERSISTENCE','VALUES','OFFICIAL_PICKS','BOARD_READBACK'].includes(stage),'STAGE')
      const cp=runtime.run.checkpoint
      if(cp.stage!==stage)await persist({...cp,stage})
    },
    async freezeScope(scope) {
      const cp=runtime.run.checkpoint
      if(cp.completed.includes('SCOPE')){ensure(JSON.stringify(cp.scope)===JSON.stringify(scope),'FROZEN_SCOPE_DRIFT');return}
      await persist({...cp,scope,stage:'SCOPE',completed:[...cp.completed,'SCOPE']})
    },
    async freezeDependencyScope(scope) {
      const cp=runtime.run.checkpoint
      if(cp.completed.includes('DEPENDENCY_SCOPE')){ensure(scope.every(id=>cp.dependencyScope.includes(id)),'FROZEN_DEPENDENCY_SCOPE_ESCAPE');return}
      await persist({...cp,dependencyScope:scope,stage:'DEPENDENCY_SCOPE',completed:[...cp.completed,'DEPENDENCY_SCOPE']})
    },
    async load(key) {
      if(key==='mission-provider-budget')return {oddsCalls:runtime.ledger.missionOddsConsumed()}
      if(key===`accounting-${runId}`)return {frozen:sha256(runContext),providers:runtime.ledger.snapshot(),dml:runtime.run.checkpoint.result?.reused?[{aggregate:true,reused:runtime.run.checkpoint.result.reused}]:[]}
      if(key===runId) {
        const cp=runtime.run.checkpoint
        if(!cp.completed.includes('CONTEXTS'))return null
        ensure(canonical,'CANONICAL_RESOLVER_REQUIRED')
        const frozen=cp.references.find(r=>r.kind==='run_freeze')
        ensure(frozen?.digest===sha256(runContext),'FROZEN_CONTEXT_DRIFT')
        const vetoed=new Set((cp.gameVetoes??[]).map(r=>r.gamePk))
        const activeReferences=cp.references.filter(r=>!vetoed.has(Number(r.identity)))
        const evidence={contexts:await canonical.restoreContexts({references:activeReferences,scope:cp.scope}),nativeGames:cp.marketGames,blockedGames:cp.blocked}
        const digest=sha256(evidence)
        // Keep the aggregate immutable; restoreContexts verifies every remaining
        // game's exact frozen digest. Vetoed targets are never reconstructed.
        if(!vetoed.size)ensure(cp.references.find(r=>r.kind==='context_evidence')?.digest===digest,'EVIDENCE_REFERENCE_DRIFT')
        return {frozenDigest:frozen.digest,runContext,evidence,evidenceDigest:digest,gameVetoes:cp.gameVetoes??[],...(cp.completed.includes('FEATURES')?{featureReferences:activeReferences.filter(r=>r.kind==='persisted_features')} : {}),...(cp.marketReference?{marketReference:cp.marketReference,evaluatedAt:cp.marketReference.evaluatedAt,oddsDigest:cp.marketReference.oddsDigest}:{})}
      }
      if(key===`schedule-${runId}` || key===`odds-${runId}`){
        const kind=key===`odds-${runId}`?'odds':'schedule',provider=kind==='odds'?'THE_ODDS_API':'MLB_OFFICIAL'
        if(runtime.ledger.read(provider)===0)return null
        const evidence=await runtime.evidence(kind)
        ensure(evidence,kind==='odds'?'ODDS_OUTCOME_UNCERTAIN':'INCOMPLETE_SOURCE_ACQUISITION')
        return evidence
      }
      throw Error('R6_CHECKPOINT:UNSUPPORTED_DOCUMENT')
    },
    async save(key,value) {
      if(key===`schedule-${runId}` || key===`odds-${runId}`) {
        ensure(Buffer.byteLength(JSON.stringify(value))<=4*1024*1024,'PROVIDER_RESPONSE_MEMORY_CAP')
        const recovered=await runtime.evidence(key===`odds-${runId}`?'odds':'schedule',value)
        ensure(sha256(recovered)===sha256(value),'PROVIDER_DURABLE_READBACK');return
      }
      if(key===`accounting-${runId}`) {
        ensure(value.frozen===sha256(runContext),'ACCOUNTING_FREEZE')
        const cp=runtime.run.checkpoint,reused=value.dml.reduce((n,r)=>n+(r.reused??0),0)
        await persist({...cp,result:{status:'SOURCE_RECONCILIATION',predictions:0,values:0,picks:0,inserted:0,reused,conflicts:0,readback:'PENDING'}})
        return
      }
      ensure(key===runId && value.frozenDigest===sha256(runContext) && value.evidenceDigest===sha256(value.evidence),'DOCUMENT_FREEZE')
      ensure(!value.odds,'RAW_ODDS_CHECKPOINT_FORBIDDEN')
      const cp=runtime.run.checkpoint,evidence=value.evidence
      const references=cp.completed.includes('CONTEXTS')?[...cp.references]:[{kind:'run_freeze',identity:runId,digest:value.frozenDigest,count:1,asOf:runContext.run_as_of},
        {kind:'context_evidence',identity:runId,digest:value.evidenceDigest,count:evidence.contexts.length,asOf:runContext.run_as_of},...evidence.contexts.flatMap(durableContextReferences)]
      if(value.featureReferences)for(const ref of value.featureReferences)if(!references.some(r=>r.kind===ref.kind && r.identity===ref.identity))references.push(ref)
      for(const old of cp.references)if(!references.some(r=>r.kind===old.kind && r.identity===old.identity))references.push(old)
      await persist({...cp,stage:value.marketReference?'MARKETS':value.featureReferences?'FEATURES':'CONTEXTS',references,marketGames:cp.completed.includes('CONTEXTS')?cp.marketGames:evidence.nativeGames,blocked:cp.completed.includes('CONTEXTS')?cp.blocked:evidence.blockedGames??[],completed:[...new Set([...cp.completed,'CONTEXTS',...(value.featureReferences?['FEATURES']:[]),...(value.marketReference?['MARKETS']:[])])],...(value.marketReference?{marketReference:value.marketReference}:{})})
    },
  }
  return store
}
