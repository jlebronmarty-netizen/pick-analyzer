import { createHash } from 'node:crypto'

export const SHARED_RESULTS_VERSION = 'SHARED_MLB_RESULTS_V1'
export type ResultAuthority = {gamePk:number;reference:string;digest:string;scheduledAt:string|null;officialDigest:string;classification:string;reasons:string[]}
export function historicalResultProjection(row: Record<string, unknown>) {
  return Object.fromEntries(['source_game_id','game_date','canonical_home_team','canonical_away_team','final_score','checksum_sha256','validation_status','errors','source_lineage'].map(k=>[k,row[k]??null]))
}
function stable(value: unknown): string {
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']'
  if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}'
  return JSON.stringify(value)
}
export function resultDigest(row:Record<string,unknown>){return createHash('sha256').update(stable(historicalResultProjection(row))).digest('hex')}
export function readSharedResult(row:Record<string,unknown>,authority:ResultAuthority){
  if(row.source_game_id!==authority.reference||resultDigest(row)!==authority.digest)return null
  const scores=row.final_score as {home?:unknown;away?:unknown}|null
  const eligible=authority.classification==='TRAINING_ELIGIBLE'
  if(eligible&&(!Number.isInteger(scores?.home)||!Number.isInteger(scores?.away)||Number(scores?.home)<0||Number(scores?.away)<0||scores?.home===scores?.away))return null
  return {gamePk:authority.gamePk,game_date:row.game_date,scheduled_at:authority.scheduledAt,home_team:row.canonical_home_team,away_team:row.canonical_away_team,final_home_score:eligible?scores?.home:null,final_away_score:eligible?scores?.away:null,official_final_status:'Final',source:'stored_mlb_official+retrosheet+canonical_savant',source_lineage:{officialDigest:authority.officialDigest,retrosheetDigest:row.checksum_sha256,certifiedProjectionDigest:authority.digest},training_eligible:eligible,training_eligibility_reason:authority.classification,blockers:authority.reasons,eligibilityScope:'OUTCOME_LABEL_ONLY_NOT_PREGAME_FEATURE_ADMISSION'}
}
