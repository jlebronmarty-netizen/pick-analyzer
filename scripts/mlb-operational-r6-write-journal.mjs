import {identityColumns} from './mlb-data-02r-r2t-write-contract.mjs'
const ensure=(ok,reason)=>{if(!ok)throw Error(`R6_JOURNAL:${reason}`)}

// The existing R2 repository still performs classification and physical shape
// guards. Its commit is delegated to the fenced transaction, not its unfenced
// PostgREST callback. The database commits rows and compact accounting together.
export function createDurableWriteJournal(runtime) {
  return {
    async recover() {await runtime.refresh()},
    async perform({table,rows,cap,operation='INSERT',expectedOld=null}) {
      ensure(runtime.locked && Object.hasOwn(identityColumns,table),'LOCK_AND_TARGET')
      ensure(Array.isArray(rows) && rows.length>0 && Number.isSafeInteger(cap) && rows.length<=cap,'CAP')
      ensure(operation==='INSERT' || (operation==='UPDATE' && table==='pick2_mlb_games' && rows.length===1 && expectedOld?.game_pk===rows[0].game_pk),'UPDATE_PREDICATES')
      const result={table,inserted:0,updated:0,reused:0,rows:[]}
      for(let start=0;start<rows.length;start+=100) {
        const batch=rows.slice(start,start+100)
        const committed=await runtime.write({table,rows:batch,cap,operation,expectedOld})
        ensure(committed.rows.length===batch.length && committed.inserted+committed.updated+committed.reused===batch.length,'READBACK_COUNT')
        for(const k of ['inserted','updated','reused'])result[k]+=committed[k]
        result.rows.push(...committed.rows)
      }
      return operation==='UPDATE'?{data:result.rows,error:null}:result
    },
    summary() {
      return (runtime.run?.dml_accounting.stages??[]).flatMap(stage=>['INSERT','UPDATE'].filter(operation=>stage[operation==='INSERT'?'inserted':'updated']>0).map(operation=>({table:stage.target,operation,plannedRows:stage.planned,cap:stage.cap,state:'APPLIED',actualRows:stage[operation==='INSERT'?'inserted':'updated'],atomicReadback:true,recoveredByIndependentReadback:false})))
    },
  }
}
