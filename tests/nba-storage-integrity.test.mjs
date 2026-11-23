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
