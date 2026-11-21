/** Prints owner-reviewed SQL only. Has no connection or execution mode. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hashes={
 'model':'a7402efcb40b632fa9e86355defdd7cd91e7ed9baefe84f85c4383ef22a2e4e1',
 'forward-20261120':'d66434bf1091300017b24de47c82194c21e285d9518fd853e79317359cf6b57d',
 'forward-20261121':'1d6487dbf0939f5357eedbf60b11e3bd3b5d8adaf1f3fe2396edd6c7fd424e54',
 'outcomes-20261120':'e669d63383150768b5dcf6d34808592b27d3a92d18ee577d06a6bca24665d18e',
 'operations/evidence-20261120':'2f1b52fb33fc81ddb27fca45ea84ff48a83fb0736a1b10300dba926e5e48fe04',
 'operations/evidence-20261121':'bb339cf0ced04418b33645587b953ef59978fa61baca7b4fc69162a7e50ae3f2'};
function read(name){
 const bytes=readFileSync('docs/research/nba-v2/'+name+'.json');
 if(createHash('sha256').update(bytes).digest('hex')!==hashes[name])throw Error('UNEXPECTED_IMMUTABLE_FILE');
 return JSON.parse(bytes);
}
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const sql=['BEGIN;','SET LOCAL standard_conforming_strings=on;'];
const model=createHash('sha256').update(JSON.stringify(read('model'))).digest('hex');
sql.push("SELECT pg_advisory_xact_lock(hashtextextended('nba_v2_shadow_'||"+quote(model)+",0));");
// Fail before doing any work if operational records already exist. A repeated seed is a no-op.
sql.push("DO $$ BEGIN IF EXISTS(SELECT FROM nba_v2_shadow.cycles WHERE model_hash="+quote(model)+
 " AND kind<>'seed' AND diagnostics->>'seedFile' IS NULL) THEN RAISE EXCEPTION 'SEED_BEFORE_ACTIVATION_ONLY'; END IF; END $$;");
function addCycle(kind,stamp,file){
 const stampSql=quote(stamp)+'::timestamptz';
 const key="model_hash="+quote(model)+" AND kind="+quote(kind)+" AND slot="+stampSql;
 sql.push("INSERT INTO nba_v2_shadow.cycles(model_hash,slot,kind,captured_at,diagnostics) VALUES ("+
 [quote(model),stampSql,quote(kind),stampSql,quote(JSON.stringify({seedFile:file,sha256:hashes[file]}))+'::jsonb'].join(',')+") ON CONFLICT DO NOTHING;");
 return '(SELECT id FROM nba_v2_shadow.cycles WHERE '+key+')';
}
function seedFreeze(day){
 const file='forward-'+day,b=read(file),receipt=read('operations/evidence-'+day);
 if(b.modelHash!==model || receipt.modelHash!==model)throw Error('MIXED_MODEL_SEED');
 const cycle=addCycle('seed',b.frozenAt,file);
 for(const r of b.rows){
  const pair=receipt.benchmarks.find(p=>p.forecastId===r.forecastId);
  sql.push("INSERT INTO nba_v2_shadow.forecasts(id,cycle_id,game_id,tip,record,benchmark) VALUES ("+
   [quote(r.forecastId),cycle,r.gameId,quote(r.gameStartAt),quote(JSON.stringify(r))+'::jsonb',pair?quote(JSON.stringify(pair))+'::jsonb':'NULL'].join(',')+") ON CONFLICT DO NOTHING;");
 }
}
seedFreeze('20261120');
const o=read('outcomes-20261120'),cycle=addCycle('settle',o.checkedAt,'outcomes-20261120');
for(const r of o.outcomes)sql.push("INSERT INTO nba_v2_shadow.judgments(cycle_id,forecast_id,record) VALUES ("+
 [cycle,quote(r.forecastId),quote(JSON.stringify(r))+'::jsonb'].join(',')+") ON CONFLICT DO NOTHING;");
seedFreeze('20261121');
sql.push('COMMIT;');
console.log(sql.join('\n'));
