import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const key=r=>`${r[2]}:${r[3]}`;
export function reconcile(projected,raw){
 assert.deepEqual(projected.stats,raw.stats); const stats=raw.stats;
 const grouped=new Map(),players=new Map(),ids=new Set(),rawCounts=Object.fromEntries(stats.map(s=>[s,{exact:0,within_tolerance:0}]));
 const integrity={missing_raw:0,missing_canonical:0,duplicate_terminal:0,empty_events:0,bad_half:0,id_disagreement:0};
 for(const r of raw.rows){const id=`${r[0]}:${key(r)}`;assert(!ids.has(id),'DUPLICATE_RAW_GAME');ids.add(id);
  for(const [i,k] of Object.keys(integrity).entries())integrity[k]+=Number(r[7+i]??0);
  for(let i=0;i<stats.length;i++){const a=r[4][i],b=r[5][i];if(a===b)rawCounts[stats[i]].exact++;if(a===b||(stats[i]==='ev_sum'&&a!==null&&b!==null&&Math.abs(a-b)<=1e-8))rawCounts[stats[i]].within_tolerance++;}
  if(!grouped.has(key(r)))grouped.set(key(r),[]);grouped.get(key(r)).push(r);
  if(!players.has(r[3]))players.set(r[3],[]);players.get(r[3]).push(r);
 }
 const counts=Object.fromEntries(stats.map(s=>[s,{canonical_exact:0,raw_exact:0,raw_within_tolerance:0,max_absolute_raw_difference:0}]));
 const original={pa:0,hits:0,walks:0,hr:0},records=[],seen=new Set();let affected=0,unexplained=0;
 for(const r of projected.rows){const id=`${r[0]}:${key(r)}`;assert(!seen.has(id),'DUPLICATE_PROJECTION');seen.add(id);
  const lower=new Date(Date.parse(r[1]+'T00:00:00Z')-30*86400000).toISOString().slice(0,10);
  const contributing=(grouped.get(key(r))??[]).filter(g=>g[1]>=lower&&g[1]<r[1]);
  const rebuilt=stats.map((_,i)=>contributing.reduce((s,g)=>s+(g[4][i]??0),0));
  assert.deepEqual(contributing.map(g=>g[0]).sort((a,b)=>a-b),(r[9]??[]).slice().sort((a,b)=>a-b),'SOURCE_GAME_MEMBERSHIP');
  const differences=[];
  for(let i=0;i<stats.length;i++){const c=counts[stats[i]],d=Math.abs(r[4][i]-rebuilt[i]);if(r[4][i]===r[5][i])c.canonical_exact++;if(r[4][i]===rebuilt[i])c.raw_exact++;if(d===0||(stats[i]==='ev_sum'&&d<=1e-8))c.raw_within_tolerance++;else differences.push(stats[i]);c.max_absolute_raw_difference=Math.max(c.max_absolute_raw_difference,d);}
  const allTeamRaw=(players.get(r[3])??[]).filter(g=>g[1]>=lower&&g[1]<r[1]);
  assert.deepEqual(['pa','hits','walks','hr'].map(s=>allTeamRaw.reduce((n,g)=>n+g[4][stats.indexOf(s)],0)),r[6],'ALL_TEAM_RAW_REPLAY');
  const old=[];for(const [j,s]of ['pa','hits','walks','hr'].entries())if(r[4][stats.indexOf(s)]!==r[6][j]){original[s]++;old.push(s);}
  if(old.length)affected++;if(differences.length)unexplained++;
  records.push({game_pk:r[0],game_date:r[1],team:r[2],batter:r[3],stored:r[4],canonical:r[5],raw_rebuilt:rebuilt,all_team_pa_hits_walks_hr:r[6],original_mismatch_features:old,cause:old.length&&differences.length===0?'TEAM_SCOPE_OTHER_TEAM_HISTORY':differences.length?'UNRESOLVED':'MATCH',source_game_ids:r[9]??[],source_min_date:r[7],source_max_date:r[8],canonical_md5:r[10],raw_lineage_sha256:sha(JSON.stringify(contributing.map(g=>[g[0],g[6]]).sort((a,b)=>a[0]-b[0]))),remaining_mismatches:differences});
 }
 return {status:'BLOCKED_LINEUP_FEATURE_LINEAGE',research_only:true,external_opened:false,odds_api_credits_consumed:0,projected_rows:projected.rows.length,games:new Set(projected.rows.map(r=>r[0])).size,raw_batter_game_rows:raw.rows.length,raw_pitch_rows:raw.rows.reduce((n,r)=>n+r[13],0),stats,raw_canonical_feature_matches:rawCounts,projected_feature_matches:counts,raw_integrity:integrity,original_all_team_mismatches:original,affected_unique_records:affected,unexplained_rebuilt_records:unexplained,ev_absolute_tolerance:1e-8,as_published_certificate:false,blocker:'Original projected builder snapshot unavailable; raw 2025 data was ingested in 2026 and has no verified per-cutoff as-published correction history.',records};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [p,r,prefix]=process.argv.slice(2);assert(p&&r&&prefix,'Usage: node reconcile_mlb_lineup_v1.mjs projected.json raw.json output-prefix');
 const pb=fs.readFileSync(p),rb=fs.readFileSync(r),out=reconcile(JSON.parse(pb),JSON.parse(rb));out.input_sha256={projected:sha(pb),raw:sha(rb)};
 const full=JSON.stringify(out);fs.writeFileSync(prefix+'.records.json.gz',zlib.gzipSync(full));const {records,...summary}=out;summary.full_result_sha256=sha(full);fs.writeFileSync(prefix+'.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
}
