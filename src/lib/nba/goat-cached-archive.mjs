import { verifiedArchivedPlayerFinal } from './decision-archived-final-core.mjs';

export function validCacheBatch(ids) {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 10 &&
    ids.every(id => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length;
}

export function verifiedCacheSource(context, receipt, gameId, now = Date.now()) {
  const game = receipt?.payload?.data?.games?.find(row => row.id === gameId);
  const capture = Date.parse(context?.player_stats_captured_at);
  const received = Date.parse(receipt?.source_received_at);
  const tip = Date.parse(game?.datetime);
  if (context?.provider !== 'balldontlie' || game?.season !== 2026 ||
      game.postponed !== false || game.postseason !== false ||
      !Number.isFinite(received) || received <= tip || received > now || capture > now) return null;
  if (!verifiedArchivedPlayerFinal({ context, final: game, providerGameId: gameId })) return null;
  return {game, rows: context.player_stats.data, capturedAt: context.player_stats_captured_at};
}

export async function archiveCachedBoxscores({ db, ids, completed, save }) {
  const result = [];
  for (const gameId of ids) {
    if (completed.has(gameId + ':player_stats')) {
      result.push({ gameId, status: 'ALREADY_INDEXED' });
      continue;
    }
    const context = await db.from('nba_game_context_v2')
      .select('provider,provider_game_id,player_stats,player_stats_captured_at')
      .eq('provider_game_id', gameId).maybeSingle();
    if (context.error) throw new Error('CACHED_CONTEXT_READ_FAILED');
    const embedded = context.data?.player_stats?.data?.[0]?.game;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(embedded?.date) || !Number.isFinite(Date.parse(embedded?.datetime))) {
      result.push({ gameId, status: 'FINAL_OR_BOXSCORE_UNVERIFIED' });
      continue;
    }
    // Match the provider event inside the receipt. The archive partition can
    // roll into the following day for a late Puerto Rico tip.
    const receipt = await db.from('nba_market_schedules_v1').select('source_received_at,payload')
      .in('date_local', [...new Set([embedded.date, new Date(embedded.datetime).toISOString().slice(0,10)])])
      .contains('payload', {data: {games: [{id: gameId, status_state: 'final'}]}})
      .order('source_received_at', {ascending:false}).limit(1).maybeSingle();
    if (receipt.error) throw new Error('CACHED_SCHEDULE_READ_FAILED');
    const verified = verifiedCacheSource(context.data, receipt.data, gameId);
    if (!verified) {
      result.push({ gameId, status: 'FINAL_OR_BOXSCORE_UNVERIFIED' });
      continue;
    }
    await save(verified.game, 'player_stats', verified.rows, verified.capturedAt);
    result.push({ gameId, status: 'ARCHIVED', rows: verified.rows.length });
  }
  return result;
}
