// Called only inside the runtime authority's transaction while its lease row is
// locked. Reuses the existing R2 exact-row comparison and identity contract.
import { identityColumns, matches } from '../../../scripts/mlb-data-02r-r2t-write-contract.mjs'
import { sha256 } from '../../../scripts/mlb-data-02r-r2f-stage-contracts.mjs'
const ensure=(ok,reason)=>{if(!ok)throw Error(`R6_STATE:${reason}`)}
const quote=x=>{ensure(/^[a-z_][a-z0-9_]*$/.test(x),'WRITE_COLUMN');return `"${x}"`}
const immutableMarkets=new Set(['pick2_mlb_market_price_observations','pick2_mlb_market_value_evaluations','pick2_mlb_official_picks'])

export async function performFencedWrite({query,run,write,columnsByTable,clock}) {
  ensure(write && Object.keys(write).every(k=>['table','rows','cap','operation','expectedOld'].includes(k)),'WRITE_FIELDS')
  const {table,rows,cap,operation='INSERT',expectedOld=null}=write
  ensure(Object.hasOwn(identityColumns,table) && Array.isArray(columnsByTable[table]),'WRITE_TARGET')
  ensure(['INSERT','UPDATE'].includes(operation) && Array.isArray(rows) && rows.length>0 && rows.length<=100,'WRITE_BATCH')
  ensure(Number.isSafeInteger(cap) && cap>=rows.length,'WRITE_CAP')
  ensure(operation!=='UPDATE' || (table==='pick2_mlb_games' && rows.length===1 && expectedOld?.game_pk===rows[0].game_pk),'UPDATE_PREDICATES')
  const scope=run.checkpoint.scope,rawScope=run.checkpoint.dependencyScope ?? []
  ensure(scope.length>0,'WRITE_SCOPE_REQUIRED')
  const column=identityColumns[table],fields=Object.keys(rows[0]).sort()
  ensure(fields.length>0 && fields.every(k=>columnsByTable[table].includes(k)),'WRITE_PAYLOAD_SHAPE')
  const ids=rows.map(r=>r[column]);ensure(ids.every(x=>x!==null&&x!==undefined) && new Set(ids.map(String)).size===ids.length,'WRITE_IDENTITY')
  const games=new Set()
  for(const row of rows) {
    ensure(JSON.stringify(Object.keys(row).sort())===JSON.stringify(fields),'WRITE_PAYLOAD_SHAPE')
    const gamePk=Number(row.target_game_pk ?? row.game_pk ?? row.metadata?.source_game_pk)
    if(table==='pick2_raw_mlb_statcast_pitches')ensure(rawScope.includes(gamePk),'RAW_SCOPE_ESCAPE')
    else {ensure(scope.includes(gamePk),'WRITE_SCOPE_ESCAPE');games.add(gamePk)}
    if(['pick2_game_predictions','pick2_mlb_market_event_mappings','pick2_mlb_market_price_observations','pick2_mlb_market_value_evaluations','pick2_mlb_official_picks'].includes(table)) {
      ensure(!(run.checkpoint.gameVetoes??[]).some(r=>r.gamePk===gamePk) && !(run.checkpoint.blocked??[]).some(r=>r.gamePk===gamePk),'GAME_VETO_WRITE_BLOCKED')
    }
    if(table.endsWith('_daily_features'))ensure(typeof row.feature_snapshot_id==='string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(row.feature_snapshot_id),'SNAPSHOT_ID_REQUIRED')
  }
  if(table!=='pick2_raw_mlb_statcast_pitches') {
    const native=await query('SELECT game_pk,scheduled_at,game_date::text,official_status FROM public.pick2_mlb_games WHERE game_pk = ANY($1::bigint[]) FOR SHARE',[[...games]])
    for(const gamePk of games) {
      const existing=native.find(r=>Number(r.game_pk)===gamePk)
      const candidate=table==='pick2_mlb_games'?rows.find(r=>Number(r.game_pk)===gamePk):existing
      ensure(candidate && Date.parse(candidate.scheduled_at)>Date.parse(clock.at) && String(candidate.game_date).slice(0,10)===clock.date && ['Scheduled','Pre-Game','Warmup'].includes(candidate.official_status),'STARTED_GAME_WRITE')
      if(existing)ensure(Date.parse(existing.scheduled_at)>Date.parse(clock.at) && !/Final|Game Over|Completed/.test(existing.official_status ?? ''),'STARTED_GAME_WRITE')
    }
  }
  // Cast caller identities through text. SQL identifiers come exclusively from
  // the fixed contract; values always remain bound parameters.
  const immutable=immutableMarkets.has(table)
  const readSql=`SELECT to_jsonb(t) AS row FROM public.${quote(table)} t WHERE ${quote(column)}::text = ANY($1::text[])${immutable?'':' FOR UPDATE'}`
  const existing=await query(readSql,[ids.map(String)])
  const stored=existing.map(r=>r.row),inserts=[],reused=[]
  ensure(new Set(stored.map(r=>String(r[column]))).size===stored.length,'WRITE_DUPLICATE_IDENTITY')
  for(const planned of rows) {
    const prior=stored.find(r=>String(r[column])===String(planned[column]))
    if(prior && matches(prior,planned,operation==='UPDATE'))reused.push(prior)
    else if(!prior && operation==='INSERT')inserts.push(planned)
    else ensure(operation==='UPDATE' && prior && matches(prior,expectedOld),'BLOCK_CONFLICT')
  }
  const previous=run.dml_accounting.stages.find(s=>s.target===table)
  const factors={pick2_mlb_games:1,pick2_mlb_players:2,pick2_feature_snapshots:10,pick2_mlb_team_daily_features:2,pick2_mlb_pitcher_daily_features:2,pick2_mlb_bullpen_daily_features:2,pick2_mlb_batter_daily_features:0,pick2_mlb_matchup_daily_features:1,pick2_mlb_first_inning_daily_features:1,pick2_game_predictions:1,pick2_mlb_market_event_mappings:1,pick2_mlb_official_picks:1}
  const ceiling=table==='pick2_raw_mlb_statcast_pitches'?rawScope.length*1000:Object.hasOwn(factors,table)?scope.length*factors[table]:cap
  const plannedChanges=operation==='INSERT'?inserts.length:reused.length?0:1
  ensure((previous?.inserted??0)+(previous?.updated??0)+plannedChanges<=ceiling,'CUMULATIVE_DML_CAP')
  if(previous)ensure(previous.cap===ceiling,'DML_CAP_DRIFT')
  let changed=[]
  if(operation==='INSERT' && inserts.length) {
    const names=fields.map(quote).join(',')
    changed=(await query(`WITH inserted AS (INSERT INTO public.${quote(table)} (${names}) SELECT ${names} FROM jsonb_populate_recordset(NULL::public.${quote(table)},$1::text::jsonb)${immutable?` ON CONFLICT (${quote(column)}) DO NOTHING`:''} RETURNING *) SELECT to_jsonb(inserted) AS row FROM inserted`,[JSON.stringify(inserts)])).map(r=>r.row)
    if(immutable && changed.length<inserts.length) {
      // A separate READ COMMITTED statement sees a competing committed insert.
      // Never UPDATE an immutable row, and never swallow a different unique key.
      const missing=inserts.filter(p=>!changed.some(r=>String(r[column])===String(p[column])))
      const canonical=(await query(readSql,[missing.map(p=>String(p[column]))])).map(r=>r.row)
      ensure(canonical.length===missing.length && new Set(canonical.map(r=>String(r[column]))).size===canonical.length,'BLOCK_CONFLICT')
      for(const p of missing) {
        const prior=canonical.find(r=>String(r[column])===String(p[column]))
        ensure(prior && matches(prior,p),'BLOCK_CONFLICT')
        reused.push(prior)
      }
    }
  } else if(operation==='UPDATE' && !reused.length) {
    ensure(Object.keys(expectedOld).every(k=>columnsByTable[table].includes(k)),'OLD_PAYLOAD_SHAPE')
    const assignments=fields.filter(k=>k!==column).map(k=>`${quote(k)}=p.${quote(k)}`).join(',')
    changed=(await query(`WITH changed AS (UPDATE public.${quote(table)} t SET ${assignments} FROM jsonb_populate_record(NULL::public.${quote(table)},$1::text::jsonb) p WHERE t.${quote(column)}=p.${quote(column)} RETURNING t.*) SELECT to_jsonb(changed) AS row FROM changed`,[JSON.stringify(rows[0])])).map(r=>r.row)
  }
  const all=[...changed,...reused]
  ensure(all.length===rows.length && rows.every(p=>all.some(r=>String(r[column])===String(p[column]) && matches(r,p,operation==='UPDATE'))),'WRITE_READBACK')
  if(table!=='pick2_raw_mlb_statcast_pitches') {
    const started=await query('SELECT game_pk FROM public.pick2_mlb_games WHERE game_pk = ANY($1::bigint[]) AND scheduled_at <= clock_timestamp() LIMIT 1',[[...games]])
    ensure(started.length===0,'STARTED_GAME_WRITE')
  }
  const result={table,inserted:operation==='INSERT'?changed.length:0,updated:operation==='UPDATE'?changed.length:0,reused:reused.length,rows:all}
  // Global ceilings derive from the frozen entity/dependency scope. Existing R2
  // prewrite classifiers additionally enforce each supplied plan's exact cap.
  const inserted=(previous?.inserted??0)+result.inserted,updated=(previous?.updated??0)+result.updated
  ensure(inserted+updated<=ceiling,'CUMULATIVE_DML_CAP')
  const reusedCount=(previous?.reused??0)+reused.length
  const stage={stage:'PERSISTENCE',target:table,planned:inserted+updated+reusedCount,cap:ceiling,inserted,updated,reused:reusedCount,conflicts:0,readback:'PASS',digest:sha256({prior:previous?.digest??null,operation,identities:ids,inserted:result.inserted,updated:result.updated})}
  // A retry containing only already-committed rows changes neither counters nor
  // receipt digest. Its return value still explicitly reports REUSE_NO_OP.
  if(!changed.length && previous)return {result,dml:run.dml_accounting}
  return {result,dml:{...run.dml_accounting,stages:[...run.dml_accounting.stages.filter(s=>s.target!==table),stage]}}
}
