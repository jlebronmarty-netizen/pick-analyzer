import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {prepareArchivedPlayerMaterialization,archivedPlayerPayload} from '../src/lib/nba/archived-player-materializer-core.mjs';
import {originalContext} from '../src/lib/nba/decision-storage-original.mjs';
import {materializerFixture} from './fixtures/nba-archived-player-materializer.mjs';

test('complete archived finals yield deterministic verified bytes and honest immutable provenance',()=>{
 const fixture=materializerFixture(),before=structuredClone(fixture),p=prepareArchivedPlayerMaterialization(fixture);
 assert.deepEqual(fixture,before);assert.equal(p.rows.length,12);
 assert.equal(p.manifest.response_sha256,createHash('sha256').update(p.payloadText).digest('hex'));
 assert.equal(gunzipSync(p.compressed).toString('utf8'),p.payloadText);
 assert.ok(originalContext(p.compressed,p.manifest));
 const provenance=JSON.parse(p.payloadText).archive_provenance;
 assert.equal(provenance.source_kind,'STORED_OPERATIONAL_JSON');
 assert.equal(provenance.source_captured_at,fixture.context.player_stats_captured_at);
 assert.ok(p.rows.every(r=>r.projection_eligible===false&&r.materialized_at===undefined));
 assert.ok(p.rows.filter(r=>r.minutes_played===0).every(r=>r.pts===null&&r.ast===null));
 assert.equal(archivedPlayerPayload({...fixture.context,player_stats:{meta:fixture.context.player_stats.meta,data:fixture.context.player_stats.data}}),p.payloadText);
 assert.equal(prepareArchivedPlayerMaterialization({...fixture,asOf:'2026-11-23T01:00:00.000Z'}).payloadText,p.payloadText);
});
for(const [name,mutate] of [
 ['future source',f=>f.context.player_stats_captured_at='2026-11-24T00:00:00Z'],
 ['future independent receipt',f=>f.schedule.source_received_at='2026-11-24T00:00:00Z'],
 ['future independent storage',f=>f.schedule.recorded_at='2026-11-24T00:00:00Z'],
 ['missing final',f=>f.schedule.payload.data.games=[]],
 ['duplicate final',f=>f.schedule.payload.data.games.push(structuredClone(f.schedule.payload.data.games[0]))],
 ['incomplete page',f=>f.context.player_stats.meta.next_cursor=123],
 ['incomplete declared payload',f=>f.context.player_stats.meta.complete=false],
 ['unknown source identity',f=>f.context.game_id='unmatched'],
 ['blank source version',f=>f.context.source_version='  '],
 ['source provider mismatch',f=>f.context.provider='other'],
 ['wrong final score',f=>f.schedule.payload.data.games[0].home_team_score=101],
 ['wrong original score',f=>f.context.player_stats.data[0].game.home_team_score=101],
 ['conflicting final IDs',f=>f.schedule.payload.data.games[0].home_team_id=3],
 ['conflicting player-game IDs',f=>f.context.player_stats.data[0].game.home_team_id=3],
 ['duplicate player',f=>f.context.player_stats.data.push(structuredClone(f.context.player_stats.data[0]))],
 ['incomplete points',f=>f.context.player_stats.data[0].pts--],
 ['incomplete team minutes',f=>f.context.player_stats.data[0].min='30:00'],
 ['invalid minute format',f=>f.context.player_stats.data[0].min='47:75'],
 ['too many minutes',f=>f.context.player_stats.data[0].min='49:01'],
 ['negative component',f=>f.context.player_stats.data[0].stl=-1],
 ['missing component',f=>delete f.context.player_stats.data[0].blk],
 ['fractional component',f=>f.context.player_stats.data[0].turnover=0.5],
 ['DNP with stats',f=>f.context.player_stats.data[5].blk=1],
 ['nonfinal period',f=>f.schedule.payload.data.games[0].period=3],
 ['unplayed overtime score',f=>f.schedule.payload.data.games[0].home_ot1=2],
 ['stale game',f=>f.asOf='2027-02-23T00:00:00Z'],
])test('rejects '+name,()=>{const f=materializerFixture();mutate(f);assert.throws(()=>prepareArchivedPlayerMaterialization(f));});
test('stored bytes must pass compressed length, decompression and SHA256 before persistence',()=>{
 const p=prepareArchivedPlayerMaterialization(materializerFixture());
 const corrupt=Buffer.from(p.compressed);corrupt[Math.floor(corrupt.length/2)]^=1;
 assert.equal(originalContext(corrupt,p.manifest),null);
 assert.equal(originalContext(p.compressed,{...p.manifest,response_sha256:'0'.repeat(64)}),null);
 assert.equal(originalContext(p.compressed.subarray(1),p.manifest),null);
});
