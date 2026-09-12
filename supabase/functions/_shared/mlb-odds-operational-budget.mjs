import {sha256} from '../../../scripts/mlb-data-02r-r2f-stage-contracts.mjs'
export const ODDS_POLICY='MLB_ODDS_OPERATIONAL_BUDGET_V1'
const TABLE='public.pick2_mlb_odds_operational_requests'
const ensure=(ok,code)=>{if(!ok)throw Error(`R6_STATE:${code}`)}
export async function inspectOddsBudget(query) {
  const [row]=await query(`SELECT (clock_timestamp() AT TIME ZONE 'America/Puerto_Rico')::date::text AS day,
    count(*)::int AS consumed,
    (SELECT greatest(reserved_at,response_at) FROM ${TABLE} ORDER BY reserved_at DESC LIMIT 1) AS last_reserved_at,
    count(*) FILTER (WHERE response_at IS NULL)::int AS uncertain, sum(credits_last) AS observed_credits,
    count(*) FILTER (WHERE credits_last IS NULL)::int AS unknown_credit_requests FROM ${TABLE}
    WHERE operational_day=(clock_timestamp() AT TIME ZONE 'America/Puerto_Rico')::date`)
  return {version:ODDS_POLICY,activation:'ACTIVE',day:row.day,timezone:'America/Puerto_Rico',cap:48,perRunCap:1,consumed:row.consumed,remaining:48-row.consumed,lastReservedAt:row.last_reserved_at,uncertainReservations:row.uncertain,observedCredits:row.observed_credits===null?null:Number(row.observed_credits),unknownCreditRequests:row.unknown_credit_requests}
}
// Caller holds the existing global lease row lock in the same transaction.
export async function planOddsBudget(query,run,clock) {
  if(run.odds_calls===1)return {decision:'RESUME_DURABLE_EVIDENCE'}
  const budget=await inspectOddsBudget(query)
  const blocked=new Set([...(run.checkpoint.blocked??[]).map(r=>r.gamePk),...(run.checkpoint.gameVetoes??[]).map(r=>r.gamePk)])
  const games=(run.checkpoint.marketGames??[]).filter(g=>run.checkpoint.scope.includes(g.game_pk)&&!blocked.has(g.game_pk)&&Date.parse(g.scheduled_at)>Date.parse(clock.at)+300000)
  if(!games.length)return {decision:'NO_ELIGIBLE_PREGAME_SCOPE',budget}
  if(budget.remaining<=0)return {decision:'ODDS_BUDGET_EXHAUSTED',budget}
  const nearest=(Math.min(...games.map(g=>Date.parse(g.scheduled_at)))-Date.parse(clock.at))/60000
  const interval=nearest>180?60:nearest>60?30:15
  const age=budget.lastReservedAt===null?Infinity:(Date.parse(clock.at)-Date.parse(budget.lastReservedAt))/60000
  ensure(age>=0,'OPERATIONAL_BUDGET_CLOCK')
  return {decision:age<interval?'ODDS_CADENCE_DEFERRED':'ACQUIRE',intervalMinutes:interval,budget}
}
export async function reserveOperationalOdds(query,run,clock,reservationId) {
  ensure(reservationId===sha256(`${run.run_id}:THE_ODDS_API:1`),'OPERATIONAL_RESERVATION_IDENTITY')
  ensure(run.odds_calls===0 && run.checkpoint.stage==='ODDS_ACQUISITION' && run.checkpoint.completed.includes('FEATURES'),'OPERATIONAL_ODDS_STAGE')
  const plan=await planOddsBudget(query,run,clock)
  ensure(plan.decision==='ACQUIRE',plan.decision==='ODDS_BUDGET_EXHAUSTED'?'OPERATIONAL_ODDS_DAILY_CAP':plan.decision==='ODDS_CADENCE_DEFERRED'?'ODDS_MIN_INTERVAL':'NO_ELIGIBLE_PREGAME_SCOPE')
  await query(`INSERT INTO ${TABLE}(run_scope_key,reservation_id,operational_day,daily_slot,reserved_at) VALUES ($1,$2,$3,$4,$5)`,[run.scope_key,reservationId,clock.date,plan.budget.consumed+1,clock.at])
  return {...plan.budget,consumed:plan.budget.consumed+1,remaining:plan.budget.remaining-1,lastReservedAt:clock.at}
}
export async function recordOddsCredits(query,run,clock,credits) {
  ensure(credits && Object.keys(credits).length===4 && ['httpStatus','last','used','remaining'].every(k=>Object.hasOwn(credits,k)),'ODDS_CREDIT_SHAPE')
  ensure(Number.isInteger(credits.httpStatus)&&credits.httpStatus>=100&&credits.httpStatus<=599 && ['last','used','remaining'].every(k=>credits[k]===null||Number.isSafeInteger(credits[k])&&credits[k]>=0) && (credits.last===null||credits.last<=2147483647),'ODDS_CREDIT_SHAPE')
  const [prior]=await query(`SELECT * FROM ${TABLE} WHERE run_scope_key=$1 FOR UPDATE`,[run.scope_key])
  ensure(prior && run.odds_calls===1,'OPERATIONAL_RESERVATION_MISSING')
  if(prior.response_at!==null) {
    ensure(prior.http_status===credits.httpStatus && ['last','used','remaining'].every(k=>prior[`credits_${k}`]===null?credits[k]===null:Number(prior[`credits_${k}`])===credits[k]),'ODDS_CREDIT_CONFLICT')
    return {status:'REUSE_NO_OP'}
  }
  await query(`UPDATE ${TABLE} SET response_at=$2,http_status=$3,credits_last=$4,credits_used=$5,credits_remaining=$6 WHERE run_scope_key=$1 AND response_at IS NULL`,[run.scope_key,clock.at,credits.httpStatus,credits.last,credits.used,credits.remaining])
  return {status:'CREDITS_RECORDED'}
}
