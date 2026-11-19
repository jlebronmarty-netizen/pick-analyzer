import test from 'node:test';
import assert from 'node:assert/strict';
import {readEdgeLabOverviewLedger} from '../src/services/edge-lab-overview-ledger.mjs';
import {buildEdgeLabOverviewCard} from '../src/lib/edge-lab/overview-cards.mjs';
import {groupReportRowsByDate, reportDatePR} from '../src/lib/edge-lab/report-calendar.mjs';
import {multiMetrics} from '../src/lib/edge-lab/multisport-core.mjs';

function fakeDb(tables, calls, errorTable) {
  return {from(table) {
    const call={table}; calls.push(call);
    return {
      select(columns) { call.columns=columns; return this; },
      order(column) { call.order=column; return this; },
      range(from,to) { call.from=from; call.to=to; return this; },
      abortSignal(signal) { call.signal=signal; return this; },
      then(resolve,reject) {
        const data=(tables[table]??[]).slice(call.from,call.to+1)
          .map(row=>Object.fromEntries(call.columns.split(',').map(k=>[k,row[k]??null])));
        return Promise.resolve(table===errorTable?{error:{message:'unavailable'},data:null}:{error:null,data}).then(resolve,reject);
      },
    };
  }};
}

const now='2026-11-19T14:00:00.000Z';
const forecast=(i, extra={})=>({
  id:String(i),sport:'TT',cohort:'EDGE_LAB_LIVE_20261104',model_version:'TT_ML_V1_PICK_PORT_1',
  event_id:'event-'+i,market:'MONEYLINE',status:'FORECAST',
  emitted_at:'2026-11-18T12:00:00Z',scheduled_at:'2026-11-19T20:00:00Z',
  payload:{private:'raw provider response'},selection:'not needed by overview',...extra,
});

test('minimal paginated ledger preserves all card results and never fetches operational state or raw payloads',async()=>{
  const forecasts=Array.from({length:501},(_,i)=>forecast(i));
  forecasts.push(forecast('other',{cohort:'OLD'}));
  forecasts.push(forecast('num',{market:'TOTAL_POINTS',status:'PROJECTION',model_version:'TT_TOTAL_V1_PICK_PORT_1'}));
  const outcomes=[{id:'o0',forecast_id:'0',status:'W'},{id:'o1',forecast_id:'1',status:'L'},
    {id:'on',forecast_id:'num',status:'NUMERIC',absolute_error:4.5,payload:{raw:'private'}}];
  const calls=[],tables={edge_lab_multi_forecasts_v1:forecasts,edge_lab_multi_outcomes_v1:outcomes};
  const report=await readEdgeLabOverviewLedger(fakeDb(tables,calls),'MULTI');
  const byId=new Map(outcomes.map(o=>[o.forecast_id,o]));
  const expected={rows:forecasts.map(r=>({...r,outcome:byId.get(r.id)??null}))};
  for(const sport of ['TT','NCAAF'])assert.deepEqual(buildEdgeLabOverviewCard(sport,report,now),buildEdgeLabOverviewCard(sport,expected,now));
  assert.equal(report.rows.length,503);
  assert.deepEqual(new Set(calls.map(c=>c.table)),new Set(Object.keys(tables)));
  assert.ok(calls.every(c=>!c.columns.includes('*')&&!c.columns.includes('payload')&&!c.columns.includes('selection')));
  assert.ok(calls.every(c=>c.signal===calls[0].signal&&c.signal instanceof AbortSignal));
  assert.ok(calls.some(c=>c.from===500));
  assert.ok(!JSON.stringify(report).includes('raw provider'));
});

test('soccer projects only columns that its outcome table contains',async()=>{
  const row=forecast('soc',{sport:'SOCCER',cohort:'EDGE_LAB_RESTART_20261104',model_version:'SOCCER_V0_PICK_PORT_1',market:'1X2'});
  const outcome={id:'s',forecast_id:row.id,status:'W'},calls=[];
  const report=await readEdgeLabOverviewLedger(fakeDb({edge_lab_forecasts_v1:[row,{...row,id:'old',cohort:'OLD'}],edge_lab_outcomes_v1:[outcome]},calls),'SOCCER');
  assert.equal(buildEdgeLabOverviewCard('SOCCER',report,now).cohorts[0].wins,1);
  assert.equal(report.rows.length,1);
  assert.equal(calls.find(c=>c.table==='edge_lab_outcomes_v1').columns,'id,forecast_id,status');
});

test('database failure and full scan cap reject instead of publishing partial accuracy',async()=>{
  const calls=[];
  await assert.rejects(()=>readEdgeLabOverviewLedger(fakeDb({},calls,'edge_lab_multi_outcomes_v1'),'MULTI'),/OVERVIEW_LEDGER_UNAVAILABLE/);
  await assert.rejects(()=>readEdgeLabOverviewLedger(fakeDb({edge_lab_forecasts_v1:Array.from({length:10000},(_,i)=>forecast(i))},[]),'SOCCER'),/OVERVIEW_LEDGER_READ_LIMIT/);
  await assert.rejects(()=>readEdgeLabOverviewLedger(fakeDb({},[]),'ARBITRARY_TABLE'),/OVERVIEW_SOURCE_INVALID/);
});

test('stalled reads share an abort deadline and cannot become an empty successful report',async t=>{
  const timeout=AbortSignal.timeout.bind(AbortSignal),signals=[];
  t.mock.method(AbortSignal,'timeout',ms=>{assert.equal(ms,15000);return timeout(10);});
  const db={from(){let signal;return {
    select(){return this;},order(){return this;},range(){return this;},
    abortSignal(s){signal=s;signals.push(s);return this;},
    then(resolve,reject){return new Promise(done=>{
      const finish=()=>done({data:null,error:{message:'aborted'}});
      if(signal.aborted)finish();else signal.addEventListener('abort',finish,{once:true});
    }).then(resolve,reject);},
  };}};
  // AbortSignal.timeout is unref'ed in Node; keep the test alive until abort.
  const keepAlive=setTimeout(()=>{},100);
  try{await assert.rejects(()=>readEdgeLabOverviewLedger(db,'MULTI'),/OVERVIEW_LEDGER_UNAVAILABLE/);}
  finally{clearTimeout(keepAlive);}
  assert.equal(signals.length,2);
  assert.equal(signals[0],signals[1]);
  assert.equal(signals[0].aborted,true);
});

test('Puerto Rico grouping matches prior daily metrics, preserves order and does not mutate forecasts',()=>{
  const rows=[
    forecast('1',{emitted_at:'2026-11-19T03:59:59Z',outcome:{status:'W'}}),
    forecast('2',{emitted_at:'2026-11-19T04:00:00Z',outcome:{status:'L'}}),
    forecast('3',{emitted_at:'2026-11-18T18:00:00Z',status:'ABSTAIN'}),
    forecast('4',{emitted_at:'2026-11-19T05:00:00Z',market:'TOTAL_POINTS',status:'PROJECTION',outcome:{status:'NUMERIC',absolute_error:4.5}}),
  ];
  const before=JSON.stringify(rows);
  const oldDate=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(v));
  const oldDays=[...new Set(rows.map(r=>oldDate(r.emitted_at)))];
  const old=oldDays.flatMap(date=>multiMetrics(rows.filter(r=>oldDate(r.emitted_at)===date)).map(m=>({date,...m})));
  const next=[...groupReportRowsByDate(rows)].flatMap(([date,dayRows])=>multiMetrics(dayRows).map(m=>({date,...m})));
  assert.deepEqual(next,old);
  assert.equal(JSON.stringify(rows),before);
  assert.equal(reportDatePR('2026-11-19T03:59:59Z'),'2026-11-18');
  assert.equal(reportDatePR('2026-11-19T04:00:00Z'),'2026-11-19');
  assert.throws(()=>groupReportRowsByDate([{emitted_at:'invalid'}]),RangeError);
});
