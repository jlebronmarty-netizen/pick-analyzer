import {localDay, validateArchive} from '../nba-archive-core.mjs';

const dayMs = 86400000;
const dayAt = value => new Date(value).toISOString().slice(0,10);
export function tailDays(capture, today) {
  // Start on the provider's end date to cover games that tip after midnight PR.
  const end = Date.parse(capture?.provider_date_range?.endDate + 'T12:00:00Z');
  const last = Date.parse(today + 'T12:00:00Z');
  const first = Math.max(last - 27 * dayMs, Number.isFinite(end) ? end : -Infinity);
  const dates = [];
  for (let t = Math.min(first,last); t <= last; t += dayMs) dates.push(dayAt(t));
  return dates;
}

export function archivedCalendar(capture, snapshots, asOf) {
  const now = Date.parse(asOf), today = localDay(new Date(now));
  const tail = tailDays(capture,today), games = new Map();
  const issues = [], scoped={};
  const issueFor=(reason,...affected)=>{
    const key=reason+'_'+affected[0].id;
    issues.push(key);
    scoped[key]=[...new Set([...(scoped[key]??[]),...affected.flatMap(g=>[g.home_team?.id,g.visitor_team?.id])])];
  };
  const put = (game, capturedAt) => {
    const prior = games.get(game.id);
    if (prior && (prior.game.season !== game.season || prior.game.home_team?.id !== game.home_team?.id ||
        prior.game.visitor_team?.id !== game.visitor_team?.id)) issueFor('IDENTITY_MISMATCH',game,prior.game);
    if (!prior || Date.parse(prior.capturedAt) <= Date.parse(capturedAt)) games.set(game.id,{game,capturedAt});
  };
  const pages = capture?.raw_provider_responses;
  const usableBase = capture?.complete && Date.parse(capture.received_at) <= now && Array.isArray(pages) &&
      pages.length > 0 && pages.every(p => Array.isArray(p.data)) && pages.at(-1)?.meta?.next_cursor == null;
  if (usableBase) {
    const seen = new Set();
    for (const page of pages) for (const game of page.data) {
      if (seen.has(game.id)) issueFor('DUPLICATE_DATA',game);
      seen.add(game.id);
      // Only the portion continuously connected to the tail is usable.
      if (game.date < capture.provider_date_range.startDate || game.date > capture.provider_date_range.endDate ||
          capture.provider_date_range.endDate < tail[0]) continue;
      put(game,capture.received_at);
    }
  }
  const receipts = new Map(snapshots.filter(Boolean).map(s => [s.date_local,s]));
  for (const date of tail) {
    const s = receipts.get(date);
    const stamp = Date.parse(s?.source_received_at);
    const meta = s?.payload?.meta;
    if (!Number.isFinite(stamp) || stamp > now || meta?.date_local !== date ||
        Date.parse(meta.source_received_at) !== stamp || meta.status !== 'SCHEDULE_RETRIEVED' ||
        (meta.warnings?.length ?? 0) > 0 || (date === today && now - stamp > 3 * 3600000)) {
      issues.push('MISSING_OR_STALE_CALENDAR_' + date);
      continue;
    }
    try { validateArchive(s.payload, new Date(now)); } catch { issues.push('INVALID_CALENDAR_' + date); continue; }
    const dayGames = s.payload.data.games;
    if (!Array.isArray(dayGames)) { issues.push('INVALID_CALENDAR_' + date); continue; }
    const dayIds = new Set(dayGames.map(g => g.id));
    for (const {game} of games.values()) {
      if (localDay(new Date(game.datetime)) === date && !dayIds.has(game.id) && !game.postponed)
        issueFor('CALENDAR_DISAGREEMENT',game);
    }
    for (const game of dayGames) put(game,s.source_received_at);
  }
  return {games:[...games.values()], issues:[...new Set(issues)], scoped, cutoff:asOf};
}
