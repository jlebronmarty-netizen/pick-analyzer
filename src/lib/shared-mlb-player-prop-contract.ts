import { createHash } from 'node:crypto'

export const SHARED_MLB_PROP_VERSION = 'SHARED_MLB_PLAYER_PROP_QUOTE_V1'
export type SharedMlbPropQuote = {
  canonicalGamePk: number; providerEventId: number; targetStart: string
  pitcherProviderId: number; pitcherMlbamId: number; pitcherName: string
  market: 'pitcher_strikeouts'; selection: 'OVER' | 'UNDER'; line: number
  sportsbookKey: string; sportsbookName: string; americanOdds: number
  providerLastUpdate: string; acquiredAt: string
  sourcePayloadDigest: string; sourceResponseDigest: string
  provenance: { provider: 'balldontlie'; providerObjectId: number; endpoint: string
    identityClassification: 'CROSS_SOURCE_CORROBORATED' | 'EXACT'; identityEvidenceDigest: string }
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stableJson(v)).join(',') + '}'
  return JSON.stringify(value)
}
export function quoteDigest(value: unknown) { return createHash('sha256').update(stableJson(value)).digest('hex') }
export function validateSharedQuote(value: unknown, now: number): value is SharedMlbPropQuote {
  if (!value || typeof value !== 'object') return false
  const q = value as SharedMlbPropQuote
  const integer = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x > 0
  const digest = (x: unknown) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)
  if (![q.canonicalGamePk,q.providerEventId,q.pitcherProviderId,q.pitcherMlbamId,q.provenance?.providerObjectId].every(integer)) return false
  if (q.market !== 'pitcher_strikeouts' || !['OVER','UNDER'].includes(q.selection)) return false
  if (typeof q.line !== 'number' || !Number.isFinite(q.line) || q.line < 0) return false
  if (!Number.isInteger(q.americanOdds) || Math.abs(q.americanOdds) < 100) return false
  if (![q.pitcherName,q.sportsbookKey,q.sportsbookName].every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=100)) return false
  if (!digest(q.sourcePayloadDigest)||!digest(q.sourceResponseDigest)||!digest(q.provenance?.identityEvidenceDigest)) return false
  if (q.provenance?.provider !== 'balldontlie'||q.provenance.endpoint!=='odds/player_props'||!['EXACT','CROSS_SOURCE_CORROBORATED'].includes(q.provenance.identityClassification)) return false
  if (![q.targetStart,q.providerLastUpdate,q.acquiredAt].every(x=>typeof x==='string'&&/T.*(Z|[+-]\d{2}:\d{2})$/.test(x))) return false
  const start=Date.parse(q.targetStart), updated=Date.parse(q.providerLastUpdate), acquired=Date.parse(q.acquiredAt)
  return [now,start,updated,acquired].every(Number.isFinite) && updated<=acquired && acquired<=now && updated<start && acquired<start && now<start && now-updated<=600000 && now-acquired<=600000
}
export function quoteRow(q: SharedMlbPropQuote) {
  if (!validateSharedQuote(q,Date.parse(q.acquiredAt))) throw new Error('INVALID_QUOTE_CONTRACT')
  return {id:'shared-mlb-prop:'+quoteDigest(q),sport_key:'baseball_mlb',league_key:'mlb',season:q.targetStart.slice(0,4),event_id:'mlb:game:'+q.canonicalGamePk,provider:'balldontlie',sportsbook:q.sportsbookKey,market:q.market,outcome:q.selection,price:q.americanOdds,line:q.line,snapshot_time:q.acquiredAt,provider_timestamp:q.providerLastUpdate,is_opening:false,is_closing:false,odds_classification:'shared_evidence_only',metadata:{contract:SHARED_MLB_PROP_VERSION,quote:q}}
}
export function classifyQuoteWrite(existing: unknown, proposed: ReturnType<typeof quoteRow>) {
  if (existing === null) return 'INSERT_ELIGIBLE'
  if (!existing || typeof existing !== 'object') return 'BLOCK_CONFLICT'
  const selected=Object.fromEntries(Object.keys(proposed).map(k=>[k,(existing as Record<string,unknown>)[k]]))
  for(const k of ['snapshot_time','provider_timestamp']) {
    const value=selected[k]
    if(typeof value==='string'&&Number.isFinite(Date.parse(value))) selected[k]=new Date(value).toISOString()
  }
  return stableJson(selected)===stableJson(proposed)?'REUSE_NO_OP':'BLOCK_CONFLICT'
}
export function readSharedQuote(row: Record<string,unknown>, now: number): SharedMlbPropQuote | null {
  const m=row.metadata as {contract?:unknown;quote?:unknown}|undefined
  if(m?.contract!==SHARED_MLB_PROP_VERSION||!validateSharedQuote(m.quote,now)) return null
  const q=m.quote
  if(classifyQuoteWrite(row,quoteRow(q))!=='REUSE_NO_OP') return null
  // Explicit public projection: no arbitrary metadata or model fields escape.
  return {canonicalGamePk:q.canonicalGamePk,providerEventId:q.providerEventId,targetStart:q.targetStart,pitcherProviderId:q.pitcherProviderId,pitcherMlbamId:q.pitcherMlbamId,pitcherName:q.pitcherName,market:q.market,selection:q.selection,line:q.line,sportsbookKey:q.sportsbookKey,sportsbookName:q.sportsbookName,americanOdds:q.americanOdds,providerLastUpdate:q.providerLastUpdate,acquiredAt:q.acquiredAt,sourcePayloadDigest:q.sourcePayloadDigest,sourceResponseDigest:q.sourceResponseDigest,provenance:{provider:q.provenance.provider,providerObjectId:q.provenance.providerObjectId,endpoint:q.provenance.endpoint,identityClassification:q.provenance.identityClassification,identityEvidenceDigest:q.provenance.identityEvidenceDigest}}
}
