// Read-only selection of the latest archived NBA schedule evidence per game.
// A newer archive run may finish writing yesterday's schedule AFTER today's slate.
export function mergeNbaScheduleGames(snapshots) {
  const byId = new Map();
  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    const sourceReceivedAt = snapshot?.source_received_at;
    const receivedMs = Date.parse(sourceReceivedAt ?? '');
    const games = snapshot?.payload?.data?.games;
    if (!Number.isFinite(receivedMs) || !Array.isArray(games)) continue;
    for (const game of games) {
      const id = game?.id;
      if (!Number.isSafeInteger(id)) continue;
      const old = byId.get(id);
      if (!old || receivedMs > old.receivedMs) {
        byId.set(id, {
          game,
          sourceReceivedAt,
          snapshotId: snapshot.snapshot_id ?? null,
          receivedMs,
        });
      }
    }
  }
  return byId;
}

export function upcomingNbaScheduleGames(snapshots, nowMs = Date.now(), windowMs = 18 * 3600000) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(windowMs) || windowMs <= 0) return [];
  return [...mergeNbaScheduleGames(snapshots).values()]
    .filter(({game}) => {
      const startMs = Date.parse(game?.datetime ?? '');
      return Number.isFinite(startMs)
        && startMs > nowMs
        && startMs <= nowMs + windowMs
        && String(game?.status_state ?? '').toLowerCase() === 'scheduled';
    })
    .sort((a, b) => Date.parse(a.game.datetime) - Date.parse(b.game.datetime));
}
