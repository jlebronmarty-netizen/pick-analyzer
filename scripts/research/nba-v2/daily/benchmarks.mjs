import {impliedProbability} from '../../../../src/lib/nba/decision-probability-v2.mjs';
import {hasValidatedInputs} from '../../../../src/lib/data-quality/window.mjs';

export function pairFromBoard(f,board) {
  const game=board.games.find(g=>g.id===f.gameId);
  if(!game)return null;
  const team=['moneyline','spread'].includes(f.market);
  const opposite=team?game.away:'Under';
  const all=Object.values(board.rows).flat();
  const offers=all.filter(r=>r.quoteId===f.quoteId && r.id===f.rowId);
  if(offers.length!==1)return null;
  const matches=all.filter(r=>r.gameId===f.gameId && r.startsAt===f.gameStartAt && r.source===offers[0].source &&
    r.market===f.market && r.period===f.period && (r.playerId??null)===f.playerId && (r.statistic??null)===f.statistic &&
    String(r.selection).toLowerCase()===String(opposite).toLowerCase() && r.line===(f.market==='spread'?-f.line:f.line) &&
    r.dataQuality?.book===f.book && hasValidatedInputs(r) && r.dataQuality.overtimeRule===f.quality.overtimeRule &&
    Date.parse(r.capturedAt)===Date.parse(f.capturedAt) && Date.parse(r.dataQuality.providerUpdatedAt)===Date.parse(f.quoteAt) &&
    Date.parse(r.dataQuality.expiresAt)>Date.parse(f.frozenAt) && r.quoteId && r.quoteId!==f.quoteId && impliedProbability(r.odds));
  if(matches.length!==1)return null;
  const b=matches[0],p=impliedProbability(f.americanOdds),other=impliedProbability(b.odds);
  return {forecastId:f.forecastId,quoteId:f.quoteId,oppositeQuoteId:b.quoteId,book:f.book,
    capturedAt:f.capturedAt,quoteAt:f.quoteAt,oppositeAmericanOdds:b.odds,probability:p/(p+other),basis:'ARCHIVED_AMERICAN_PAIR'};
}
