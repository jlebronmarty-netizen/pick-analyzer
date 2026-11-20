import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

// Existing immutable objects only. Never construct a URL from a provider payload.
export function originalContext(bytes, manifest) {
  const hash = manifest.response_sha256;
  if (!/^[a-f0-9]{64}$/.test(hash) || bytes.length !== manifest.compressed_bytes ||
      bytes.length > 32768 || !(manifest.json_bytes > 0 && manifest.json_bytes <= 512000)) return null;
  try {
    const json = gunzipSync(bytes,{maxOutputLength:512000});
    if (json.length !== manifest.json_bytes || createHash('sha256').update(json).digest('hex') !== hash) return null;
    const payload = JSON.parse(json.toString('utf8'));
    if (!Array.isArray(payload.data) || payload.data.length !== manifest.data_count || payload.meta?.next_cursor != null)
      return null;
    return {provider_game_id:manifest.provider_game_id,player_stats_captured_at:manifest.source_captured_at,player_stats:payload};
  } catch { return null; }
}

// No recurring downloads by default. The limit is an explicit per-read ceiling
// for a reviewed deployment. Each compressed object is read at most once per warm process.
const verified = new Map();
export async function readOriginalContexts(manifests, operational, needed, fetchObject, limit = 0) {
  const result = [], pending = [], have = new Set(operational.map(c => c.provider_game_id));
  let reserved = 0;
  for (const m of manifests) {
    const id=m.provider_game_id;
    if (!needed.has(id) || have.has(id)) continue;
    if (m.storage_bucket !== 'nba-goat-2026-private' || !Number.isSafeInteger(m.season) ||
        !Number.isSafeInteger(id) || !/^[a-f0-9]{64}$/.test(m.response_sha256) ||
        m.storage_object_path !== [m.season,id,'player_stats',m.response_sha256+'.json.gz'].join('/')) continue;
    const key=m.storage_object_path;
    if (verified.has(key)) { result.push(verified.get(key)); continue; }
    if (!Number.isSafeInteger(limit) || limit<=0 || pending.length>=128 || !(m.compressed_bytes>0) ||
        m.compressed_bytes>32768 || reserved+m.compressed_bytes>Math.min(limit,512000)) continue;
    pending.push(m);
    reserved+=m.compressed_bytes;
  }
  for (let i=0;i<pending.length;i+=8) {
    const batch=await Promise.all(pending.slice(i,i+8).map(async m=>{
      try {
        const bytes=await fetchObject(m);
        const ctx=bytes && originalContext(bytes,m);
        if (ctx) {
          if (verified.size >= 192) verified.delete(verified.keys().next().value);
          verified.set(m.storage_object_path,ctx);
        }
        return ctx;
      } catch { return null; }
    }));
    result.push(...batch.filter(Boolean));
  }
  return result;
}
