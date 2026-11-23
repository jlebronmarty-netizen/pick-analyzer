import {localDay} from '../nba-archive-core.mjs';
import {auditWindow} from '../data-quality/window.mjs';
import {verifiedArchivedPlayerFinal} from './decision-archived-final-core.mjs';

const stamp = Date.parse;
const finite = v => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v));
// SQL NUMERIC may arrive as text; the archived JSON carries the same line as a number.
const sameLine = (a,b) => a === null && b === null || finite(a) && finite(b) && Number(a) === Number(b);
const issue = (status, reason) => ({issue:{status,reason}});
const teams = g => [g.home_team?.id,g.visitor_team?.id];
function index(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const k = key(row);
    if (!groups.has(k)) groups.set(k,[]);
    groups.get(k).push(row);
  }
  return groups;
}

export function indexEvidence({calendar, playerHistory, manifests, contexts, pregame, asOf}) {
  const games = (calendar?.games ?? []).filter(x => stamp(x.capturedAt) <= stamp(asOf))
    .sort((a,b) => stamp(b.game.datetime)-stamp(a.game.datetime));
  const boxes = new Map();
  for (const context of contexts ?? []) {
    if (!(stamp(context.player_stats_captured_at) <= stamp(asOf))) continue;
    const id = Number(context.provider_game_id), final = games.find(x => x.game.id === id)?.game;
    if (!final) continue;
    const verified = verifiedArchivedPlayerFinal({context, final, providerGameId:id, allowPartialComponents:true});
    boxes.set(id, verified && !boxes.has(id) ? index(context.player_stats.data, x => x.player.id) : null);
  }
  return {games,calendarScope:calendar?.scoped??{}, calendarIssues:calendar?.issues ?? ['CALENDAR_UNAVAILABLE'], boxes, pregame, asOf,
    compact:index(playerHistory, r => Number(r.player_id)),
    manifests:index(manifests ?? [], r => Number(r.provider_game_id))};
}

function expected(evidence, target, team) {
  const cutoff = Math.min(stamp(evidence.asOf),stamp(target.datetime));
  return evidence.games.filter(({game}) => game.id !== target.id && game.season === target.season &&
    game.postseason === target.postseason && teams(game).includes(team) && stamp(game.datetime) < cutoff)
    .map(({game,capturedAt}) => ({...game,receiptAt:capturedAt}));
}
function unavailable(e, status, reason) {
  return {status,cutoff:e.asOf,required:10,evaluated:0,included:[],excluded:[],lastGame:null,issues:[{status,reason}]};
}
function inspectFinal(game) {
  if (game.postponed === true || /^(cancelled|canceled|postponed)$/i.test(game.status_state)) return {exclude:'POSTPONED_OR_CANCELLED'};
  if (game.status_state !== 'final' || !(stamp(game.receiptAt)>stamp(game.datetime))) return issue('INCOMPLETE_HISTORY','FINAL_NOT_ARCHIVED');
  return null;
}
function calendarCheck(e,team,a){
  const oldest=a.included.length===a.required?localDay(new Date(a.included.at(-1).date)):null;
  const issues=e.calendarIssues.filter(key=>{
    const affected=e.calendarScope?.[key];
    if(affected?.length && affected.every(Number.isSafeInteger) && !affected.includes(team))return false;
    const day=key.match(/^(?:MISSING_OR_STALE_CALENDAR_|INVALID_CALENDAR_)(\d{4}-\d{2}-\d{2})$/)?.[1];
    return !(day&&oldest&&day<oldest);
  });
  return issues.length?unavailable(e,'SOURCE_UNAVAILABLE',issues.join(',')):a;
}
export function teamWindow(e,target,team,observedIds) {
  const audit=auditWindow(expected(e,target,team), game => inspectFinal(game) ??
    (observedIds.has(game.id) ? {include:{}} : issue('PARTIAL','INVALID_PERIOD_SCORE_OR_FINAL')),e.asOf);
  return calendarCheck(e,team,audit);
}

export function playerWindow(e,target,playerId,parts) {
  const records = (e.compact.get(playerId) ?? []).filter(r => r.season === target.season &&
      stamp(r.game_datetime) < Math.min(stamp(target.datetime),stamp(e.asOf)) &&
      stamp(r.materialized_at) <= stamp(e.asOf) && stamp(r.source_captured_at) <= stamp(e.asOf));
  const byGame = index(records,r => Number(r.provider_game_id));
  const latest = records.slice().sort((a,b)=>stamp(b.game_datetime)-stamp(a.game_datetime))[0];
  if (!latest) return calendarCheck(e,null,unavailable(e,'INCOMPLETE_HISTORY','NO_MATERIALIZED_PLAYER_HISTORY'));
  const team = Number(latest.team_id);
  if (!teams(target).includes(team)) return unavailable(e,'IDENTITY_MISMATCH','TEAM_OUTSIDE_TARGET_GAME');
  const audit = auditWindow(expected(e,target,team), game => {
    const final = inspectFinal(game);
    if (final) return final;
    const matches = byGame.get(game.id) ?? [];
    if (!matches.length) {
      const appearance=e.boxes.get(game.id)?.get(playerId)?.[0];
      if(appearance?.team?.id===team && (appearance.min==='0'||appearance.min===0||appearance.min==='0:00'))
        return {exclude:'DNP'};
      return issue('INCOMPLETE_HISTORY','PLAYER_ROW_MISSING_AT_CUTOFF');
    }
    if (matches.length !== 1) return issue('DUPLICATE_DATA','PLAYER_GAME_NOT_UNIQUE');
    const r = matches[0], m = e.manifests.get(game.id) ?? [];
    if (m.length !== 1) return issue(m.length ? 'DUPLICATE_DATA' : 'SOURCE_UNAVAILABLE','ARCHIVE_MANIFEST_NOT_UNIQUE');
    if (r.team_id !== team || !teams(game).includes(r.opponent_team_id) || r.team_id === r.opponent_team_id ||
        stamp(r.game_datetime) !== stamp(game.datetime) || m[0].season !== target.season)
      return issue('IDENTITY_MISMATCH','TEAM_SEASON_OR_START_MISMATCH');
    if (!/^[a-f0-9]{64}$/.test(r.source_sha256) || r.source_sha256 !== m[0].response_sha256 ||
        stamp(r.source_captured_at) !== stamp(m[0].source_captured_at) ||
        !(stamp(r.game_datetime) < stamp(r.source_captured_at) && stamp(r.source_captured_at) <= stamp(r.materialized_at)))
      return issue('PARTIAL','SOURCE_RECEIPT_MISMATCH');
    const min = Number(r.minutes_played);
    if (!finite(r.minutes_played) || min < 0) return issue('PARTIAL','MISSING_OR_INVALID_MINUTES');
    const hasBox = e.boxes.has(game.id), raw = e.boxes.get(game.id)?.get(playerId)?.[0];
    // A quarantined whole box is unverified evidence, not proof that this player belongs to another team.
    // It still consumes an unresolved history slot and cannot supply a projection or SHADOW freeze.
    if (hasBox && e.boxes.get(game.id) === null) return issue('PARTIAL','ORIGINAL_BOX_NOT_VERIFIED');
    if (hasBox && (!raw || raw.team.id !== team)) return issue('IDENTITY_MISMATCH','ORIGINAL_BOX_OR_IDENTITY_DISAGREES');
    if (raw) {
      const [whole,seconds = 0] = String(raw.min).split(':').map(Number);
      if (Math.abs(whole + seconds/60 - min) > .001 ||
          (min >= 10 && parts.some(k=>raw[k] !== r[k]))) return issue('PARTIAL','ORIGINAL_BOX_DISAGREES');
    }
    if (min < 10) {
      if (!raw) return issue('PARTIAL','MINUTE_EXCLUSION_UNVERIFIED');
      return {exclude:min === 0 ? 'DNP' : 'UNDER_TEN_MINUTES'};
    }
    if (parts.some(k => !Number.isSafeInteger(r[k]) || r[k] < 0)) return issue('PARTIAL','MISSING_OR_INVALID_STAT');
    const include = {sourceHash:r.source_sha256, teamId:team};
    return raw ? {include} : {include, ...issue('PARTIAL','ORIGINAL_BOX_NOT_CROSS_CHECKED')};
  }, e.asOf);
  const oldest = audit.included.at(-1)?.date;
  if (oldest && records.some(r => stamp(r.game_datetime) >= stamp(oldest) &&
      !audit.included.some(v=>v.id===r.provider_game_id) && !audit.excluded.some(v=>v.id===r.provider_game_id) &&
      !audit.issues.some(v=>v.id===r.provider_game_id))) {
    audit.issues.unshift({status:'IDENTITY_MISMATCH',reason:'TRANSFER_OR_GAME_OUTSIDE_SCHEDULE'});
  }
  // Documentary gaps may coexist with an actual missing game. Report the latter first.
  audit.status = audit.issues.find(i=>i.status==='INCOMPLETE_HISTORY')?.status ??
    audit.issues.find(i=>i.reason!=='ORIGINAL_BOX_NOT_CROSS_CHECKED')?.status ?? audit.status;
  return calendarCheck(e,team,audit);
}

export function readableWindow(a) {
  return a.included.length === a.required && a.issues.every(i => i.reason === 'ORIGINAL_BOX_NOT_CROSS_CHECKED');
}

export function marketQuality(q, game, evidence, histories) {
  const warnings = [];
  const issues = histories.flatMap(h => h.status === 'VALIDATED' ? [] :
    [{status:h.status,reason:h.issues.find(i=>i.status===h.status)?.reason ?? h.status}]);
  const cutoff = stamp(evidence.asOf), captured = stamp(q.source_received_at), updated = stamp(q.provider_updated_at);
  const book = q.sportsbook ?? q.payload?.sportsbook;
  if (!(captured <= cutoff && updated <= captured && cutoff-updated <= (q.provider==='hoopsapi'?360:180)*60000))
    issues.push({status:'STALE',reason:'PRICE_TIME_UNVERIFIED_OR_STALE'});
  if (book !== 'FanDuel' || !q.quote_id || !Number.isInteger(q.american_odds ?? q.american_odds_approx) ||
      Math.abs(q.american_odds ?? q.american_odds_approx)<100)
    issues.push({status:'CONTRACT_UNVERIFIED',reason:'BOOK_OR_PRICE_UNVERIFIED'});
  if (q.phase && q.phase !== 'PREGAME' || game.status_state !== 'scheduled' || stamp(game.datetime)<=cutoff)
    issues.push({status:'STALE',reason:'NOT_PREGAME'});
  const teamSide=q.market==='moneyline'||q.market==='spread';
  if(!(teamSide?['home','away']:['over','under']).includes(q.side) ||
      q.provider!=='hoopsapi' && !['FULL_GAME_INCLUDING_OT','FULL_GAME_LABEL_OT_UNVERIFIED'].includes(q.period) ||
      q.provider==='hoopsapi' && (!finite(q.decimal_odds)||Number(q.decimal_odds)<=1))
    issues.push({status:'CONTRACT_UNVERIFIED',reason:'MARKET_SIDE_PERIOD_OR_PRICE_MISMATCH'});
  const mainContract = {moneyline:'WINNER',spread:'SIGNED_HANDICAP',total:q.side==='over'?'STRICT_GREATER_THAN':'STRICT_LESS_THAN'};
  if (q.provider!=='hoopsapi' && (q.phase!=='PREGAME' ||
      (q.market==='props' ? q.contract !== (q.side==='over'?'STRICT_GREATER_THAN':'STRICT_LESS_THAN') :
      q.contract!==mainContract[q.market]))) issues.push({status:'CONTRACT_UNVERIFIED',reason:'MARKET_SIDE_OR_PHASE_UNVERIFIED'});
  if (q.market!=='moneyline' && !finite(q.line)) issues.push({status:'CONTRACT_UNVERIFIED',reason:'MISSING_LINE'});
  if(q.ambiguousPrice) issues.push({status:'DUPLICATE_DATA',reason:'SIMULTANEOUS_CONFLICTING_PRICES'});
  if(q.provider!=='hoopsapi'){
    const raw=q.payload;
    const same=raw && raw.sportsbook===book && raw.game_id===q.provider_game_id && raw.quote_id===q.quote_id &&
      raw.market===q.market && raw.period===q.period && raw.side===q.side && sameLine(raw.line,q.line) &&
      raw.american_odds===q.american_odds && raw.contract===q.contract &&
      stamp(raw.provider_updated_at)===updated && stamp(raw.source_received_at??q.envelopeReceivedAt)===captured &&
      (q.market!=='props' || raw.player_id===q.player_id && raw.statistic===q.statistic);
    if(!same)issues.push({status:'CONTRACT_UNVERIFIED',reason:'QUOTE_RECEIPT_MISMATCH'});
    if(raw?.freshness==='STALE')issues.push({status:'STALE',reason:'STALE_AT_CAPTURE'});
  }
  const rule = q.provider==='hoopsapi' ? q.overtime_rule : q.payload?.overtime_rule;
  if (!['q1','q2','q3','q4','h1'].includes(q.period) && (rule!=='INCLUDES_OVERTIME' || q.period==='FULL_GAME_LABEL_OT_UNVERIFIED'))
    issues.push({status:'CONTRACT_UNVERIFIED',reason:'OVERTIME_RULE_UNVERIFIED'});
  const p = Array.isArray(evidence.pregame)?evidence.pregame.find(r=>r.game_ids?.includes(game.id)):
    evidence.pregame;
  const coverage = p?.coverage?.injuriesComplete && p.coverage.projectedLineupsComplete &&
    Array.isArray(p.injuries?.data) && Array.isArray(p.projected_lineups?.data) && p.game_ids?.includes(game.id) &&
    stamp(p.captured_at)<=cutoff && cutoff-stamp(p.captured_at)<=3*3600000;
  if (!coverage && q.market!=='props') warnings.push('TEAM_AVAILABILITY_UNCONFIRMED');
  if (q.market === 'props') {
    const lineups = p?.projected_lineups?.data ?? [];
    const matching = lineups.filter(v=>v.game_id===game.id && teams(game).includes(v.team_id) &&
      stamp(v.updated_at)<=cutoff && v.lineup?.some(entry=>entry.player?.id===q.player_id));
    const injuries=(p?.injuries?.data??[]).filter(v=>v.player?.id===q.player_id);
    const reported=injuries.filter(v=>String(v.status).toLowerCase()==='available');
    const unsafe=injuries.some(v=>String(v.status).toLowerCase()!=='available');
    const team=histories[0]?.included[0]?.teamId;
    const teamGames=evidence.games.filter(({game:g})=>p?.game_ids?.includes(g.id)&&teams(g).includes(team));
    const available=reported.length===1 && reported[0].player.team_id===team &&
      (reported[0].game_id===game.id || reported[0].game_id==null && teamGames.length===1 && teamGames[0].game.id===game.id);
    const confirmed=p?.coverage?.projectedLineupsComplete && matching.length===1 && matching[0].status==='confirmed';
    if (!p?.coverage?.injuriesComplete || !Array.isArray(p.injuries?.data) || unsafe ||
        !(stamp(p.captured_at)<=cutoff && cutoff-stamp(p.captured_at)<=3*3600000) ||
        !p.game_ids?.includes(game.id) || (!confirmed&&!available))
      issues.push({status:'PARTIAL',reason:'PLAYER_AVAILABILITY_UNCONFIRMED'});
    else if (matching.length>1 || matching.some(line=>line.team_id!==team) || reported.some(v=>v.player.team_id!==team))
      issues.push({status:'IDENTITY_MISMATCH',reason:'CURRENT_TEAM_DIFFERS_FROM_HISTORY'});
    else if(!confirmed) warnings.push('AVAILABLE_STARTING_ROLE_UNCONFIRMED');
  }
  const validUntil=Math.min(stamp(game.datetime)-10*60000,updated+(q.provider==='hoopsapi'?360:180)*60000,
    q.market==='props'?stamp(p?.captured_at)+3*3600000:Infinity);
  return {status:issues[0]?.status ?? 'VALIDATED',issues,warnings,overtimeRule:rule??'NOT_VERIFIED',regionalExecutionVerified:false,expiresAt:Number.isFinite(validUntil)?new Date(validUntil).toISOString():null,book:book ?? null,providerUpdatedAt:q.provider_updated_at ?? null};
}
