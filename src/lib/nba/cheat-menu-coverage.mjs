import {inOddsBand, markets, oddsBands} from './cheat-ranking.mjs';
import {latestUniqueQuotes} from './decision-board-core.mjs';

// Count offered lines in one reconciled pregame menu. These totals describe the
// archive at the page cutoff and are never supplied to ranking or settlement.
export function describeMenu(batches) {
  const counts = {};
  const milestones = [];
  const quotes = latestUniqueQuotes(batches.flatMap(batch => batch.quotes),
    q => [q.game_id, q.player_id, q.statistic, q.period, q.side, q.line].join('|'));
  for (const q of quotes) {
    if (!Object.hasOwn(markets, q.statistic) || q.ambiguousPrice || q.market !== 'props' ||
        !Number.isSafeInteger(q.player_id) || q.player_id <= 0 ||
        !Number.isFinite(q.line) || q.line < 0 ||
        !['FULL_GAME_INCLUDING_OT', 'FULL_GAME_LABEL_OT_UNVERIFIED'].includes(q.period)) continue;
    const band = Object.keys(oddsBands).find(key => inOddsBand(q.american_odds, Number(key)));
    if (!band) continue;
    const milestone = q.side === 'yes' && q.contract === 'PROVIDER_MILESTONE_UNVERIFIED';
    const strict = (q.side === 'over' && q.contract === 'STRICT_GREATER_THAN') ||
      (q.side === 'under' && q.contract === 'STRICT_LESS_THAN');
    if (!milestone && !strict) continue;
    const byBand = counts[q.statistic] ??= {};
    const group = byBand[band] ??= {strict: 0, milestones: 0};
    if (milestone && Number.isSafeInteger(q.line) && q.freshness === 'RECENT' &&
        Number.isFinite(Date.parse(q.provider_updated_at)) &&
        Date.parse(q.provider_updated_at) <= Date.parse(q.source_received_at)) {
      milestones.push({gameId:q.game_id, player:q.player_id, market:q.statistic,
        threshold:q.line, odds:q.american_odds, quote:q.quote_id, updated:q.provider_updated_at});
    }
    if (strict) group.strict++;
    else group.milestones++;
  }
  return {menuCounts:counts, milestones};
}

export function milestoneHistory(milestones, projections) {
  const histories = new Map();
  for (const row of projections) {
    if (row.trend?.length === 10 && row.trend.every(g => Number.isSafeInteger(g.value) && g.value >= 0))
      histories.set([row.gameId,row.player,row.market].join('|'),row);
  }
  return milestones.flatMap(m => {
    const row = histories.get([m.gameId,m.player,m.market].join('|'));
    if (!row) return [];
    const expires = Math.min(Date.parse(row.expires), Date.parse(row.start)-600000, Date.parse(m.updated)+10800000);
    if (!Number.isFinite(expires)) return [];
    const reached = n => row.trend.slice(0,n).filter(g => g.value >= m.threshold).length;
    return [{...m,projectionQuote:row.quote,name:row.name,matchup:row.matchup,expires,five:reached(5),ten:reached(10)}];
  });
}
