import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {archiveReadOptions,originalContext,readOriginalContexts} from '../src/lib/nba/decision-storage-original.mjs';
import {archivedPlayerPayload,PLAYER_MATERIALIZER_VERSION} from '../src/lib/nba/archived-player-materializer-core.mjs';
test('private archive reads are disabled by default, bounded, hash checked, and reused only for identical objects',async()=>{
  const json=Buffer.from(JSON.stringify({data:[{pts:0}],meta:{next_cursor:null}}));
  const bytes=gzipSync(json), hash=createHash('sha256').update(json).digest('hex');
  const manifest={season:2026,provider_game_id:11,source_captured_at:'2026-11-18T10:00:00Z',
    storage_bucket:'nba-goat-2026-private',storage_object_path:'2026/11/player_stats/'+hash+'.json.gz',
    response_sha256:hash,compressed_bytes:bytes.length,json_bytes:json.length,data_count:1};
  assert.equal(originalContext(bytes,{...manifest,response_sha256:'b'.repeat(64)}),null);
  assert.equal(originalContext(bytes,{...manifest,data_count:2}),null);
  assert.equal(originalContext(bytes,{...manifest,json_bytes:1}),null);
  assert.equal(originalContext(bytes,{...manifest,compressed_bytes:bytes.length+1}),null);
  assert.equal(originalContext(bytes,{...manifest,json_bytes:512001}),null);
  const ids=new Set([11]);let calls=0;
  const fetchObject=async()=>{calls++;return bytes};
  assert.deepEqual(await readOriginalContexts([manifest],[],ids,fetchObject),[]);
  assert.deepEqual(await readOriginalContexts([manifest],[],ids,fetchObject,bytes.length-1),[]);
  assert.deepEqual(await readOriginalContexts([{...manifest,storage_bucket:'public'}],[],ids,fetchObject,bytes.length),[]);
  assert.deepEqual(await readOriginalContexts([{...manifest,storage_object_path:'https://provider.invalid/box'}],[],ids,fetchObject,bytes.length),[]);
  assert.equal(calls,0);
  assert.equal((await readOriginalContexts([manifest],[],ids,fetchObject,bytes.length))[0].player_stats.data[0].pts,0);
  assert.equal((await readOriginalContexts([manifest],[],ids,fetchObject,bytes.length)).length,1);
  assert.deepEqual(await readOriginalContexts([manifest],[{provider_game_id:11}],ids,fetchObject,bytes.length),[]);
  assert.equal(calls,1);
});

test('the display override and its warmed archive never supply a scheduled read',async()=>{
  const env={NBA_DECISION_DISPLAY_ARCHIVE_READ_BYTES:'262144'};
  const screen=archiveReadOptions(true,env), scheduled=archiveReadOptions(false,env);
  assert.equal(screen.limit,262144);
  assert.equal(scheduled.limit,0);
  assert.notEqual(screen.cache,scheduled.cache);
  assert.equal(archiveReadOptions(true,{}).cache,scheduled.cache);
  assert.equal(archiveReadOptions(false,{...env,NBA_DECISION_ARCHIVE_READ_BYTES:'4096'}).limit,4096);
  const json=Buffer.from(JSON.stringify([{pts:8}]));
  const bytes=gzipSync(json), hash=createHash('sha256').update(json).digest('hex');
  const manifest={season:2026,provider_game_id:37,source_captured_at:'2026-11-18T10:00:00Z',
    storage_bucket:'nba-goat-2026-private',storage_object_path:'2026/37/player_stats/'+hash+'.json.gz',
    response_sha256:hash,compressed_bytes:bytes.length,json_bytes:json.length,data_count:1};
  const ids=new Set([37]);let downloads=0;
  const read=({limit,cache})=>readOriginalContexts([manifest],[],ids,async()=>{downloads++;return bytes;},limit,cache);
  assert.equal((await read(screen)).length,1);
  assert.equal((await read(screen)).length,1);
  assert.deepEqual(await read(scheduled),[]);
  assert.deepEqual(await read({...scheduled,limit:1}),[]);
  assert.deepEqual(await read({...screen,limit:0}),[]);
  assert.equal(downloads,1);
});

test('reads the season writer array after verifying the original bytes and still rejects incomplete evidence',()=>{
  const rows=[{player:{id:41},pts:12}];
  const encode=payload=>{
    const json=Buffer.from(JSON.stringify(payload));
    const bytes=gzipSync(json);
    return {bytes,manifest:{provider_game_id:22,source_captured_at:'2026-11-20T03:30:00Z',
      data_count:1,response_sha256:createHash('sha256').update(json).digest('hex'),
      json_bytes:json.length,compressed_bytes:bytes.length}};
  };
  const {bytes,manifest}=encode(rows);
  assert.deepEqual(originalContext(bytes,manifest),{
    provider_game_id:22,player_stats_captured_at:manifest.source_captured_at,player_stats:{data:rows}
  });
  assert.equal(originalContext(bytes,{...manifest,data_count:2}),null);
  const changed=encode([{player:{id:41},pts:13}]);
  assert.equal(originalContext(changed.bytes,{...changed.manifest,response_sha256:manifest.response_sha256}),null);
  const partial=encode({data:rows,meta:{next_cursor:4}});
  assert.equal(originalContext(partial.bytes,partial.manifest),null);
});

test('reads the operational materializer envelope and preserves its declared provenance',()=>{
  const context={game_id:'bdl_nba_44',provider_game_id:44,source_version:'archived-fixture',
    player_stats_captured_at:'2026-11-20T03:30:00Z',
    player_stats:{data:[{player:{id:41},pts:12}],meta:{next_cursor:null}}};
  const json=Buffer.from(archivedPlayerPayload(context),'utf8'),bytes=gzipSync(json);
  const manifest={provider_game_id:44,source_captured_at:context.player_stats_captured_at,
    response_sha256:createHash('sha256').update(json).digest('hex'),
    compressed_bytes:bytes.length,json_bytes:json.length,data_count:1};
  const result=originalContext(bytes,manifest);
  assert.deepEqual(result,{provider_game_id:44,player_stats_captured_at:context.player_stats_captured_at,
    player_stats:JSON.parse(json.toString('utf8'))});
  assert.equal(result.player_stats.archive_provenance.version,PLAYER_MATERIALIZER_VERSION);
  assert.equal(result.player_stats.archive_provenance.source_kind,'STORED_OPERATIONAL_JSON');
  assert.equal(result.player_stats.archive_provenance.source_captured_at,context.player_stats_captured_at);
});

test('display spends the same budget on chronological prop windows, including a verified DNP extension',async()=>{
  const {readDisplayWindowContexts}=await import('../src/lib/nba/decision-storage-original.mjs');
  const {indexEvidence,playerWindow}=await import('../src/lib/nba/decision-integrity.mjs');
  const games=[],manifests=[],playerHistory=[],bytesById=new Map();
  for(let day=1;day<=15;day++){
    const date='2026-11-'+String(day).padStart(2,'0'), id=day===15?100:day;
    const tip=date+'T15:00:00Z', capturedAt=date+'T23:00:00Z', dnp=day===14;
    const game={id,datetime:tip,date,season:2026,postseason:false,status_state:'final',
      home_team:{id:1},visitor_team:{id:2},home_team_score:50,visitor_team_score:45};
    games.push({game,capturedAt});
    const data=Array.from({length:10},(_,i)=>{
      const team=i<5?1:2;
      return {game,player:{id:i+1,team_id:team},team:{id:team},min:dnp&&i===0?'0':'24:00',
        pts:i>=5?9:dnp&&i===0?0:dnp&&i===1?20:10,ast:dnp&&i===0?0:2,reb:0,fg3m:0};
    });
    const json=Buffer.from(JSON.stringify({data})), bytes=gzipSync(json);
    const hash=createHash('sha256').update(json).digest('hex');
    bytesById.set(id,bytes);
    manifests.push({season:2026,provider_game_id:id,source_captured_at:capturedAt,response_sha256:hash,
      compressed_bytes:bytes.length,json_bytes:json.length,data_count:data.length,storage_bucket:'nba-goat-2026-private',
      storage_object_path:'2026/'+id+'/player_stats/'+hash+'.json.gz'});
    playerHistory.push({season:2026,provider_game_id:id,game_datetime:tip,team_id:1,opponent_team_id:2,player_id:1,
      source_captured_at:capturedAt,materialized_at:capturedAt,source_sha256:hash,minutes_played:dnp?0:24,ast:dnp?0:2});
  }
  const target={...games.at(-1).game,id:101,datetime:'2026-11-16T23:30:00Z',status_state:'scheduled'};
  const quote={provider_game_id:101,player_id:1};
  const inputs={games:[target],propQuotes:[quote,quote],calendar:{games,issues:[]},asOf:'2026-11-16T21:00:00Z',playerHistory};
  const needed=new Set(bytesById.keys()), expected=games.slice(-11).map(({game})=>game.id);
  const budget=expected.reduce((sum,id)=>sum+bytesById.get(id).length,0);
  const fetched=[], cache=new Map();
  const fetchBox=async m=>{fetched.push(m.provider_game_id);return bytesById.get(m.provider_game_id);};
  const verified=await readDisplayWindowContexts(manifests,[],needed,fetchBox,budget,cache,inputs);
  assert.deepEqual(fetched,[...expected].reverse());
  const audit=playerWindow(indexEvidence({...inputs,manifests,contexts:verified}),target,1,['ast']);
  assert.equal(audit.status,'VALIDATED');
  assert.deepEqual(audit.included.map(r=>r.id),[...expected].reverse().filter(id=>id!==14));
  assert.deepEqual(audit.excluded,[{id:14,reason:'DNP'}]);
  fetched.length=0;
  const warm=await readDisplayWindowContexts(manifests,[],needed,fetchBox,budget,cache,inputs);
  assert.equal(warm.length,verified.length);assert.deepEqual(fetched,[]);

  const limited=await readDisplayWindowContexts(manifests,[],needed,fetchBox,budget-1,new Map(),inputs);
  assert.equal(fetched.length,10);
  assert.notEqual(playerWindow(indexEvidence({...inputs,manifests,contexts:limited}),target,1,['ast']).status,'VALIDATED');
  fetched.length=0;
  const corrupt=await readDisplayWindowContexts(manifests,[],needed,async m=>{
    fetched.push(m.provider_game_id);return m.provider_game_id===14?Buffer.from('invalid'):bytesById.get(m.provider_game_id);
  },budget,new Map(),inputs);
  const unresolved=playerWindow(indexEvidence({...inputs,manifests,contexts:corrupt}),target,1,['ast']);
  assert.equal(unresolved.status,'PARTIAL');
  assert.ok(unresolved.issues.some(i=>i.id===14&&i.reason==='MINUTE_EXCLUSION_UNVERIFIED'));
  assert.equal(fetched.filter(id=>id===14).length,1);
  fetched.length=0;
  const quarantine={provider_game_id:14,player_stats_captured_at:games[13].capturedAt,player_stats:null};
  const withQuarantine=await readDisplayWindowContexts(manifests,[quarantine],needed,fetchBox,budget,new Map(),inputs);
  assert.ok(!fetched.includes(14));
  const quarantinedWindow=playerWindow(indexEvidence({...inputs,manifests,contexts:[quarantine,...withQuarantine]}),target,1,['ast']);
  assert.ok(quarantinedWindow.issues.some(i=>i.id===14&&i.reason==='ORIGINAL_BOX_NOT_VERIFIED'));

  fetched.length=0;
  const shared={objects:127,bytes:0};
  await readOriginalContexts(manifests.slice(0,1),[],needed,fetchBox,budget,new Map(),shared);
  await readOriginalContexts(manifests.slice(1,2),[],needed,fetchBox,budget,new Map(),shared);
  assert.deepEqual(fetched,[1]);
  assert.equal(shared.objects,128);
  assert.equal(shared.bytes,bytesById.get(1).length);
  assert.equal(archiveReadOptions(false,{NBA_DECISION_DISPLAY_ARCHIVE_READ_BYTES:'262144'}).prioritizeWindows,false);
});
