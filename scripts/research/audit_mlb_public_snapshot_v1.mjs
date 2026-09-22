import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Offline only: accepts the explicitly licensed public sample, never calls a provider.
export function parseCsv(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted&&text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  assert(!quoted,'UNTERMINATED_CSV_QUOTE');
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift(); assert(new Set(header).size===header.length,'DUPLICATE_HEADER');
  return rows.map(r=>{assert(r.length===header.length,'CSV_WIDTH');return Object.fromEntries(header.map((k,i)=>[k,r[i]]));});
}
const counts=(rows,key)=>Object.fromEntries([...new Set(rows.map(r=>r[key]))].sort().map(k=>[k,rows.filter(r=>r[key]===k).length]));
const targetMarkets=['1st_3_innings_run_line','1st_5_innings_run_line','1st_7_innings_run_line','1st_3_innings_total_runs','1st_5_innings_total_runs','1st_7_innings_total_runs'];
export function audit(rows) {
  const targets=rows.filter(r=>targetMarkets.includes(r.market_type));
  const timed=r=>Number.isFinite(Date.parse(r.timestamp))&&Number.isFinite(Date.parse(r.event_start_time));
  const pregame=r=>timed(r)&&r.is_live==='False'&&Date.parse(r.timestamp)<Date.parse(r.event_start_time);
  const groups=Object.fromEntries(targetMarkets.map(m=>{const rs=targets.filter(r=>r.market_type===m);return [m,{rows:rs.length,events:new Set(rs.map(r=>r.event_id)).size,books:counts(rs,'sportsbook'),pregame_rows:rs.filter(pregame).length,post_start_rows:rs.filter(r=>timed(r)&&Date.parse(r.timestamp)>=Date.parse(r.event_start_time)).length,missing_or_invalid_timestamps:rs.filter(r=>!timed(r)).length,lines:[...new Set(rs.map(r=>r.line))].sort(),non_finite_lines:rs.filter(r=>!r.line||!Number.isFinite(Number(r.line))).length}];}));
  return {schema:'MLB_PUBLIC_SNAPSHOT_AUDIT_V1',research_only:true,total_rows:rows.length,books:counts(rows,'sportsbook'),market_counts:counts(rows,'market_type'),target_rows:targets.length,target_source_events:[...new Set(targets.map(r=>r.event_id))],target_capture_dates:[...new Set(targets.map(r=>r.timestamp.slice(0,10)))],target_start_dates:[...new Set(targets.map(r=>r.event_start_time.slice(0,10)))],groups,team_total_explicit_market_rows:rows.filter(r=>/team.*total/.test(r.market_type)).length,admitted_rows:0,status:'REJECTED_FOR_PREGAME_RESEARCH',reasons:['14 regular-game target rows captured after start despite is_live=False; 14 pre-start target rows concern the All-Star exhibition','Two source events (one regular game, one exhibition) and one capture day cannot satisfy multi-month gates','No authoritative MLBAM game mapping or independent original-book quote verification','Ordinal inning moneylines are not cumulative first-N innings; generic game_prop not silently mapped','Run-line ladders lack main/alternate designation; no inferred designation'],training_performed:false,provider_calls:0,odds_api_credits_consumed:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: licensed-sample.csv summary.json');
  const data=fs.readFileSync(process.argv[2]);
  const upstream=Buffer.from(data.toString('utf8').replace(/\r?\n/g,'\r\n'));
  assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+upstream.length+'\0')).update(upstream).digest('hex'),'69ca871bcd510b11c2c6679af169f022a5bbbc82','UNREVIEWED_SOURCE_BYTES');
  const result=audit(parseCsv(data.toString('utf8')));
  const targets=parseCsv(data.toString('utf8')).filter(r=>targetMarkets.includes(r.market_type));
  const exhibition=r=>[r.home_team,r.away_team].some(t=>t==='American League'||t==='National League');
  for(const m of targetMarkets)result.groups[m].pregame_exhibition_rows=targets.filter(r=>r.market_type===m&&exhibition(r)&&Date.parse(r.timestamp)<Date.parse(r.event_start_time)).length;
  result.reasons[0]='14 regular-game target rows captured after start despite is_live=False; 14 pre-start target rows concern the All-Star exhibition';
  result.reasons[1]='Two source events (one regular game, one exhibition) and one capture day cannot satisfy multi-month gates';
  result.provenance={publisher:'SharpAPI',repository:'https://github.com/Sharp-API/SharpAPI-Sample-Data',commit:'cddb647cc9d06bd244cb8b72111cb39bd5587478',path:'data/mlb_odds_snapshot.csv',upstream_git_blob_sha:'69ca871bcd510b11c2c6679af169f022a5bbbc82',audited_local_bytes_sha256:crypto.createHash('sha256').update(data).digest('hex'),license:'CC BY 4.0 (publisher declaration; not independent certification of upstream collection)',license_url:'https://creativecommons.org/licenses/by/4.0/',attribution:'Odds data from SharpAPI (sharpapi.io), Sports Betting Odds Sample Dataset, 2026.',modification:'Aggregate audit only; original rows not redistributed; supplied without warranties',scope:'Quarantined structural audit only; no import into model datasets or Supabase'};
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({rows:result.total_rows,target_rows:result.target_rows,groups:result.groups,admitted:result.admitted_rows},null,2));
}
