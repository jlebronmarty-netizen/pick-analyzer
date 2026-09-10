import {identityColumns} from './mlb-data-02r-r2t-write-contract.mjs'
const ensure=(ok,reason)=>{if(!ok)throw Error(`R6_JOURNAL:${reason}`)}

export function planDurableWriteBatches({table,rows,cap,operation='INSERT',expectedOld=null}) {
  const batches=[]
  let batch=[]
  const bytes=rows=>Buffer.byteLength(JSON.stringify({table,rows,cap,operation,expectedOld}))
  // Plan before writing, so a single oversized immutable row cannot cause a
  // partially applied operation. Preserve the existing endpoint limits.
  for(const row of rows) {
    if(bytes([row])>400000)throw new RangeError('R6_STATE:WRITE_PAYLOAD_SHAPE')
    if(batch.length && (batch.length===100 || bytes([...batch,row])>400000)) {batches.push(batch);batch=[]}
    batch.push(row)
  }
  if(batch.length)batches.push(batch)
  return batches
}

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
      for(const batch of planDurableWriteBatches({table,rows,cap,operation,expectedOld})) {
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
