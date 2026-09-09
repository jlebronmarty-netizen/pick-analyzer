import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {durableContextReferences} from './mlb-operational-r6-compact-features.mjs'
const ensure=(ok,reason)=>{if(!ok)throw Error(`R6_CHECKPOINT:${reason}`)}

// Durable state contains references/counts only. Short-lived provider responses
// may be held during this invocation; loss before canonical persistence is an
// explicit ambiguous-outcome stop, never permission for an extra Odds request.
export function createDurableRunStore({runtime,runContext,root}) {
  const ephemeral=new Map(),runId=runContext.run_id
  let canonical=null
  const persist=checkpoint=>runtime.checkpoint(checkpoint,{stages:runtime.run.dml_accounting.stages})
  const store={
    root,referenceOnly:true,providerLedger:runtime.ledger,
    get locked(){return runtime.locked},
    setCanonical(bindings){canonical=bindings},
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
        const evidence={contexts:await canonical.restoreContexts({references:cp.references,scope:cp.scope}),nativeGames:cp.marketGames,blockedGames:cp.blocked}
        const digest=sha256(evidence)
        ensure(cp.references.find(r=>r.kind==='context_evidence')?.digest===digest,'EVIDENCE_REFERENCE_DRIFT')
        return {frozenDigest:frozen.digest,runContext,evidence,evidenceDigest:digest,...(cp.completed.includes('FEATURES')?{featureReferences:cp.references.filter(r=>r.kind==='persisted_features')} : {}),...(cp.marketReference?{marketReference:cp.marketReference,evaluatedAt:cp.marketReference.evaluatedAt,oddsDigest:cp.marketReference.oddsDigest}:{})}
      }
      if(ephemeral.has(key))return ephemeral.get(key)
      if(key===`schedule-${runId}`){ensure(runtime.ledger.read('MLB_OFFICIAL')===0,'INCOMPLETE_SOURCE_ACQUISITION');return null}
      if(key===`odds-${runId}`){ensure(runtime.ledger.read('THE_ODDS_API')===0,'ODDS_OUTCOME_UNCERTAIN');return null}
      throw Error('R6_CHECKPOINT:UNSUPPORTED_DOCUMENT')
    },
    async save(key,value) {
      if(key===`schedule-${runId}` || key===`odds-${runId}`) {
        ensure(Buffer.byteLength(JSON.stringify(value))<=4*1024*1024,'PROVIDER_RESPONSE_MEMORY_CAP')
        ephemeral.set(key,value);return
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
      const references=[{kind:'run_freeze',identity:runId,digest:value.frozenDigest,count:1,asOf:runContext.run_as_of},
        {kind:'context_evidence',identity:runId,digest:value.evidenceDigest,count:evidence.contexts.length,asOf:runContext.run_as_of},...evidence.contexts.flatMap(durableContextReferences)]
      if(value.featureReferences)references.push(...value.featureReferences)
      for(const old of cp.references)if(!references.some(r=>r.kind===old.kind && r.identity===old.identity))references.push(old)
      await persist({...cp,stage:value.marketReference?'MARKETS':value.featureReferences?'FEATURES':'CONTEXTS',references,marketGames:evidence.nativeGames,blocked:evidence.blockedGames??[],completed:[...new Set([...cp.completed,'CONTEXTS',...(value.featureReferences?['FEATURES']:[]),...(value.marketReference?['MARKETS']:[])])],...(value.marketReference?{marketReference:value.marketReference}:{})})
    },
  }
  return store
}
