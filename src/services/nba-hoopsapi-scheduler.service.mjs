// Scheduled-only orchestration. No external provider requests in preflight.
import {createHash} from 'node:crypto';
import {captureHoopsPreviewDurably} from './nba-hoopsapi-preview.service.mjs';

export const HOOPS_SCHEDULED_VERSION = 'NBA_HOOPSAPI_AUTO_CAPTURE_V1';
export const HOOPS_SCHEDULED_WINDOWS_UTC = Object.freeze([
  Object.freeze({hour:15,minute:15,label:'morning'}),
  Object.freeze({hour:21,minute:15,label:'early-evening'}),
  Object.freeze({hour:23,minute:15,label:'late-evening'}),
]);

const validScope = x => typeof x==='string' && /^[a-z0-9_-]{3,80}$/.test(x);
const isoDate = v => new Date(v).toISOString();
const localDate = date => {
  const parts = new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(date);
  const pick = type => parts.find(part=>part.type===type)?.value??'';
  return pick('year')+'-'+pick('month')+'-'+pick('day');
};
export function utcScheduleSlot(now = new Date()) {
  const date=now instanceof Date?now:new Date(now);
  if (!Number.isFinite(date.getTime())) return null;
  const minuteOfDay=date.getUTCHours()*60+date.getUTCMinutes();
  const entry=HOOPS_SCHEDULED_WINDOWS_UTC.find(x=>{
    const scheduled=x.hour*60+x.minute;
    return minuteOfDay>=scheduled && minuteOfDay<=scheduled+20;
  });
  if (!entry) return null;
  return {label:entry.label,local_date:localDate(date),
    scheduled_utc:date.toISOString().slice(0,10)+'T'+String(entry.hour).padStart(2,'0')+':'+String(entry.minute).padStart(2,'0')+':00Z'};
}
export function scheduledRequestId(accountScope,slot) {
  if (!validScope(accountScope) || !slot?.scheduled_utc || !slot?.label) throw new Error('INVALID_SCHEDULE_ID');
  const hex=createHash('sha256').update(HOOPS_SCHEDULED_VERSION+'|'+accountScope+'|'+slot.scheduled_utc).digest('hex');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
}
export function evaluateUpcomingNbaGames(archivedRows,now = new Date()) {
  const when=now instanceof Date?now:new Date(now);
  if (!Number.isFinite(when.getTime())) return {status:'INVALID_CLOCK',eligible_games:0};
  if (!Array.isArray(archivedRows) || !archivedRows.length) return {status:'NO_ARCHIVED_NBA_SCHEDULE',eligible_games:0};
  const day=localDate(when);
  for(const row of archivedRows) {
    const stamp=Date.parse(row?.source_received_at);
    if (!Number.isFinite(stamp) || stamp>when.getTime()+60000 || when.getTime()-stamp>120*60000) continue;
    const data=row?.payload?.data;
    const meta=row?.payload?.meta;
    if (meta?.provider!=='BALLDONTLIE' || !Array.isArray(data?.games) || meta?.date_local!==day) continue;
    const eligible=data.games.filter(g=>{
      if (g?.status_state!=='scheduled' || !g.datetime) return false;
      const t=Date.parse(g.datetime);
      return Number.isFinite(t) && t>when.getTime()+5*60000 && localDate(new Date(t))===day;
    });
    return {status:eligible.length?'NBA_GAMES_PENDING':'NO_MORE_TODAY_NBA_GAMES',
      eligible_games:new Set(eligible.map(g=>String(g.id))).size,
      schedule_received_at:row.source_received_at,local_date:day};
  }
  return {status:'FRESH_LOCAL_NBA_SCHEDULE_UNAVAILABLE',eligible_games:0};
}
export function scheduledEnvReady(env = process.env) {
  return {
    enabled:env.VERCEL_ENV==='production' && env.HOOPS_API_SCHEDULED_ENABLED==='true',
    safe_configuration:Boolean(env.HOOPS_API_KEY && env.HOOPS_API_KEY.length>=10 &&
      validScope(env.HOOPS_API_ACCOUNT_SCOPE) && env.CRON_SECRET && env.CRON_SECRET.length>=12),
  };
}
export async function runScheduledHoopsCapture({env=process.env,now=new Date(),store,readSlate,fetcher=fetch}={}) {
  const state=scheduledEnvReady(env);
  if (!state.enabled) return {status:'SCHEDULE_DISABLED',provider_calls_made:0};
  if (!state.safe_configuration || !store || typeof readSlate!=='function')
    return {status:'SCHEDULE_CONFIGURATION_UNAVAILABLE',provider_calls_made:0};
  const slot=utcScheduleSlot(now);
  if (!slot) return {status:'OUTSIDE_CRON_SCHEDULE_WINDOW',provider_calls_made:0};
  let slate;
  try { slate=evaluateUpcomingNbaGames(await readSlate(now),now); }
  catch { return {status:'NBA_SCHEDULE_READ_UNAVAILABLE',provider_calls_made:0}; }
  if (slate.status!=='NBA_GAMES_PENDING')
    return {status:slate.status,eligible_games:slate.eligible_games,provider_calls_made:0};
  let quota;
  try { quota=await store.status(env.HOOPS_API_ACCOUNT_SCOPE); }
  catch { return {status:'HOOPSAPI_LEDGER_UNAVAILABLE',provider_calls_made:0}; }
  if (!quota?.enabled || quota.blocked_until || quota.uncertain_or_in_flight ||
      quota.remaining_app_reservations<=2)
    return {status:'SCHEDULE_QUOTA_PREFLIGHT_BLOCKED',quota_remaining:quota?.remaining_app_reservations??null,provider_calls_made:0};
  const requestId=scheduledRequestId(env.HOOPS_API_ACCOUNT_SCOPE,slot);
  const result=await captureHoopsPreviewDurably({
    key:env.HOOPS_API_KEY,store,accountScope:env.HOOPS_API_ACCOUNT_SCOPE,
    requestId,claimMode:'scheduled',fetcher,
  });
  return {
    status:result.status,capture_persisted:Boolean(result.capture_persisted),
    provider_calls_made:result.provider_calls_made??0,
    capture_id:result.capture_id??null,attempt_id:result.attempt_id??null,
    quote_sides:result.coverage?.normalized_quote_sides??null,
    nba_games:result.coverage?.nba_games??null,eligible_games:slate.eligible_games,
    scheduled_slot:slot.label,local_date:slot.local_date,
    regional_price_verified:false,automatic_retry:false,
  };
}
