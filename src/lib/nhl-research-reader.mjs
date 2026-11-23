// Read-only, bounded archive adapter. A partial page must never look like a full cohort.
export const NHL_RESEARCH_PAGE_SIZE = 250;
export const NHL_RESEARCH_TABLES = [
  {key:'contexts', table:'nhl_game_context_v2', select:'event_id,provider_game_id,boxscore,boxscore_captured_at,pbp_captured_at,provider,source_version,updated_at,pbp_period:play_by_play->periodDescriptor,pbp_state:play_by_play->gameState', time:'updated_at', order:['event_id'], cap:4000},
  {key:'predictions', table:'nhl_free_predictions_v1', select:'*', time:'created_at', order:['id'], cap:6000},
  {key:'outcomes', table:'nhl_free_outcomes_v1', select:'*', time:'observed_at', order:['id'], cap:6000},
  {key:'early', table:'nhl_challenger_shadow_v1', select:'*', time:'created_at', order:['id'], cap:4000},
  {key:'late', table:'nhl_late_shadow_v6', select:'*', time:'created_at', order:['id'], cap:4000},
  {key:'goalies', table:'nhl_espn_goalie_probables_v1', select:'*', time:'created_at', order:['id'], cap:1000},
  {key:'specialTeams', table:'nhl_special_teams_asof_v1', select:'*', time:'created_at', order:['id'], cap:1000},
  {key:'quotes', table:'nhl_free_quote_observations_v1', select:'id,event_id,captured_at,created_at,scheduled_at,prediction_id,source_id', time:'created_at', order:['id'], cap:50000},
  {key:'runs', table:'nhl_free_runs_v1', select:'id,started_at,completed_at,status,provider_calls,games:detail->games,calendarCapturedAt:detail->calendarCapturedAt,marketQuotes:detail->marketQuoteObservations', time:'completed_at', order:['id'], cap:12000},
  {key:'matchups', table:'nhl_matchup_observations_v3', select:'event_id,provider_game_id,game_date,shooting_player_id,goalie_id,shots,goals,captured_at', time:'captured_at', order:['event_id','shooting_player_id','goalie_id'], cap:50000},
  {key:'diagnostics', table:'nhl_causal_diagnostics_v1', select:'prediction_id,event_id,analyzed_at,evidence_quality,causal_status', time:'analyzed_at', order:['prediction_id'], cap:6000},
  {key:'sourceMetadata', table:'nhl_free_source_v1', select:'id,captured_at,source_url,sha256:body->>sha256,http_status:body->>http_status,encoding:body->>encoding,access_denied:body->>access_denied,error:body->>error', time:'captured_at', order:['id'], cap:18000, scoreOnly:true},
];

export class NhlResearchReadError extends Error {
  constructor(code, table) { super(code); this.code=code; this.table=table; }
}

export async function readNhlResearchPages(db, spec, {cutoff, signal, pageSize=NHL_RESEARCH_PAGE_SIZE}={}) {
  if (!Number.isFinite(Date.parse(cutoff)) || !Number.isSafeInteger(pageSize) || pageSize<1 || pageSize>1000)
    throw new NhlResearchReadError('INVALID_READ_REQUEST',spec.table);
  const rows=[], keys=new Set(); let expected=null, pages=0;
  while (true) {
    if(signal?.aborted) throw new NhlResearchReadError('READ_TIMEOUT',spec.table);
    let query=db.from(spec.table).select(spec.select,{count:'exact'}).lte(spec.time,cutoff);
    if(spec.scoreOnly) query=query.like('source_url','https://api-web.nhle.com/v1/score/%');
    if(spec.ids) query=query.in('id',spec.ids);
    for(const column of spec.order) query=query.order(column,{ascending:true});
    query=query.range(rows.length,rows.length+pageSize-1);
    if(signal) query=query.abortSignal(signal);
    const result=await query;
    pages++;
    if(result.error) throw new NhlResearchReadError(signal?.aborted?'READ_TIMEOUT':'READ_UNAVAILABLE',spec.table);
    if(!Array.isArray(result.data)||!Number.isSafeInteger(result.count)||result.count<0)
      throw new NhlResearchReadError('COUNT_UNVERIFIED',spec.table);
    if(expected===null) expected=result.count;
    if(result.count!==expected) throw new NhlResearchReadError('SNAPSHOT_CHANGED_DURING_READ',spec.table);
    if(expected>spec.cap) throw new NhlResearchReadError('SOURCE_SCAN_CAPPED',spec.table);
    if(result.data.length===0 && rows.length<expected)
      throw new NhlResearchReadError('INCOMPLETE_ARCHIVE_PAGE',spec.table);
    for(const row of result.data) {
      const key=JSON.stringify(spec.order.map(k=>row[k]));
      if(spec.order.some(k=>row[k]===undefined||row[k]===null)||keys.has(key))
        throw new NhlResearchReadError('DUPLICATE_OR_MISSING_PAGE_KEY',spec.table);
      keys.add(key);rows.push(row);
    }
    if(rows.length>expected) throw new NhlResearchReadError('ARCHIVE_COUNT_MISMATCH',spec.table);
    if(rows.length===expected) return {rows,evidence:{table:spec.table,rows:rows.length,pages,expected,complete:true}};
    // Advance by actual returned rows, including a server-imposed limit below pageSize.
  }
}

// Only the latest receipt for each official day at each actual decision cutoff is needed.
// Do not select by outcome, stat value, or result availability.
export function selectNhlScheduleReceiptIds(metadata, decisions, cutoff) {
  const end=Date.parse(cutoff), byUrl=new Map(), selected=new Set();
  const times=[end,...decisions.map(x=>Date.parse(x?.frozen_at)).filter(t=>Number.isFinite(t)&&t<=end)];
  for(const row of metadata) {
    const t=Date.parse(row?.captured_at);
    if(!row?.id||!/^https:\/\/api-web\.nhle\.com\/v1\/score\/\d{4}-\d{2}-\d{2}$/.test(row.source_url??'')||!Number.isFinite(t)||t>end||
      Number(row.http_status)!==200||row.encoding!=='gzip/base64'||row.error||
      row.access_denied===true||row.access_denied==='true'||!/^[a-f0-9]{64}$/i.test(row.sha256??'')) continue;
    const list=byUrl.get(row.source_url)??[];list.push(row);byUrl.set(row.source_url,list);
  }
  for(const list of byUrl.values()) {
    list.sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at)||String(a.id).localeCompare(String(b.id)));
    for(const at of times) {
      const eligible=list.filter(r=>Date.parse(r.captured_at)<at);
      if(!eligible.length)continue;
      const last=eligible.at(-1), time=Date.parse(last.captured_at);
      // Preserve simultaneous contradictory receipts so the normalizer can quarantine them.
      for(const row of eligible) if(Date.parse(row.captured_at)===time) selected.add(row.id);
    }
  }
  return [...selected].sort();
}

/** @param {any} db @param {{cutoff?:string,signal?:AbortSignal}} options */
export async function readNhlResearchArchive(db,{cutoff=new Date().toISOString(),signal}={}) {
  const data={cutoff}, evidence=[]; let cursor=0;
  async function worker() {
    while(cursor<NHL_RESEARCH_TABLES.length) {
      const spec=NHL_RESEARCH_TABLES[cursor++];
      const result=await readNhlResearchPages(db,spec,{cutoff,signal});
      data[spec.key]=result.rows;evidence.push(result.evidence);
    }
  }
  const workers=await Promise.allSettled([worker(),worker(),worker()]);
  const failed=workers.find(x=>x.status==='rejected');
  if(failed)throw failed.reason;
  data.runs=data.runs.map(row=>({...row,detail:{games:row.games,calendarCapturedAt:row.calendarCapturedAt,marketQuoteObservations:row.marketQuotes}}));
  const ids=selectNhlScheduleReceiptIds(data.sourceMetadata,[...data.early,...data.late],cutoff);
  data.sources=[];
  for(let offset=0;offset<ids.length;offset+=50) {
    const batch=ids.slice(offset,offset+50);
    const result=await readNhlResearchPages(db,{table:'nhl_free_source_v1',select:'id,captured_at,source_url,body',time:'captured_at',order:['id'],cap:50,ids:batch},{cutoff,signal});
    if(result.rows.length!==batch.length)throw new NhlResearchReadError('SCHEDULE_RECEIPT_MISSING','nhl_free_source_v1');
    data.sources.push(...result.rows);evidence.push(result.evidence);
  }
  data.readEvidence={complete:true,cutoff,tables:evidence,selectedScheduleReceipts:ids.length,
    consistency:'Capture cutoff and stable per-page counts; separate read transactions, not a database-wide snapshot.'};
  return data;
}
