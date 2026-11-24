import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {indexEvidence,playerWindow} from './decision-integrity.mjs';

// Existing immutable objects only. Never construct a URL from a provider payload.
export function originalContext(bytes, manifest) {
  const hash = manifest.response_sha256;
  if (!/^[a-f0-9]{64}$/.test(hash) || bytes.length !== manifest.compressed_bytes ||
      bytes.length > 32768 || !(manifest.json_bytes > 0 && manifest.json_bytes <= 512000)) return null;
  try {
    const json = gunzipSync(bytes,{maxOutputLength:512000});
    if (json.length !== manifest.json_bytes || createHash('sha256').update(json).digest('hex') !== hash) return null;
    const stored = JSON.parse(json.toString('utf8'));
    // Season archives store the aggregated row array. Operational archives use a page envelope.
    const payload = Array.isArray(stored) ? {data: stored} : stored;
    if (!Array.isArray(payload.data) || payload.data.length !== manifest.data_count || payload.meta?.next_cursor != null)
      return null;
    return {provider_game_id:manifest.provider_game_id,player_stats_captured_at:manifest.source_captured_at,player_stats:payload};
  } catch { return null; }
}

// No recurring downloads by default. The limit is an explicit per-read ceiling
// for a reviewed deployment. Verified objects are reused while cached.
// Concurrent reads may still download the same uncached object.
const sharedCache = new Map();
const displayCache = new Map();

export function archiveReadOptions(forDisplay, env = process.env) {
  const displayLimit = forDisplay ? env.NBA_DECISION_DISPLAY_ARCHIVE_READ_BYTES : undefined;
  return {
    limit: Number(displayLimit ?? env.NBA_DECISION_ARCHIVE_READ_BYTES ?? 0),
    prioritizeWindows: displayLimit !== undefined && Number(displayLimit) > 0,
    cache: displayLimit === undefined ? sharedCache : displayCache
  };
}

// Only the display override uses this path. Recheck the window when an original
// establishes a DNP or a minutes exclusion, which can bring an older game into L10.
export async function readDisplayWindowContexts(manifests, operational, needed, fetchObject, limit, cache, inputs) {
  if (!Number.isSafeInteger(limit) || limit <= 0 || !needed.size) return [];
  const targets = new Map(inputs.games
    .filter(game => !game.postponed && ['scheduled', 'in_progress'].includes(game.status_state))
    .map(game => [game.id, game]));
  const subjects = new Map();
  for (const quote of inputs.propQuotes) {
    const target = targets.get(quote.provider_game_id);
    const playerId = Number(quote.player_id);
    if (target && Number.isSafeInteger(playerId) && playerId > 0) {
      subjects.set(target.id + '|' + playerId, {target, playerId});
    }
  }
  if (!subjects.size) return [];

  const starts = new Map(inputs.calendar.games.map(({game}) => [game.id, Date.parse(game.datetime)]));
  const ordered = [...manifests].sort((a, b) =>
    (starts.get(b.provider_game_id) ?? 0) - (starts.get(a.provider_game_id) ?? 0) ||
    a.provider_game_id - b.provider_game_id);
  const result = [];
  const attempted = new Set();
  const budget = {objects: 0, bytes: 0};

  // Bound sequential I/O as well as bytes and downloads. The board still applies
  // its normal integrity gate if any part of the window remains unverified.
  for (let pass = 0; pass < 3; pass++) {
    const evidence = indexEvidence({...inputs, manifests, contexts: operational.concat(result)});
    const wanted = new Set();
    const visit = gameId => wanted.add(gameId);
    for (const {target, playerId} of subjects.values()) {
      // A missing component consumes a chronological slot too. We use only
      // the visited game IDs, never the calculated features or classification.
      playerWindow(evidence, target, playerId, [], visit);
    }
    const candidates = ordered.filter(manifest => needed.has(manifest.provider_game_id) &&
      wanted.has(manifest.provider_game_id) && !attempted.has(manifest));
    if (!candidates.length) break;
    for (const manifest of candidates) attempted.add(manifest);
    const found = await readOriginalContexts(candidates, operational, needed, fetchObject, limit, cache, budget);
    if (!found.length) break;
    result.push(...found);
  }
  return result;
}

export async function readOriginalContexts(manifests, operational, needed, fetchObject, limit = 0, verified = sharedCache, budget = {objects:0,bytes:0}) {
  if (!Number.isSafeInteger(limit) || limit <= 0) return [];
  const result = [], pending = [], have = new Set(operational.map(c => c.provider_game_id));
  for (const m of manifests) {
    const id=m.provider_game_id;
    if (!needed.has(id) || have.has(id)) continue;
    if (m.storage_bucket !== 'nba-goat-2026-private' || !Number.isSafeInteger(m.season) ||
        !Number.isSafeInteger(id) || !/^[a-f0-9]{64}$/.test(m.response_sha256) ||
        m.storage_object_path !== [m.season,id,'player_stats',m.response_sha256+'.json.gz'].join('/')) continue;
    const key=m.storage_object_path;
    if (verified.has(key)) { result.push(verified.get(key)); continue; }
    if (budget.objects>=128 || !(m.compressed_bytes>0) ||
        m.compressed_bytes>32768 || budget.bytes+m.compressed_bytes>Math.min(limit,512000)) continue;
    pending.push(m);
    budget.objects++;
    budget.bytes+=m.compressed_bytes;
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
