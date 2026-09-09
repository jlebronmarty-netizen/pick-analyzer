import { createHash } from 'node:crypto'
import { settleMoneyline, type SettlementOutcome } from './settlement-core.service'
import { MLB_CHAMPION, MLB_POLICY, type StoredRow } from './pick2-operational-projection'

export const MLB_SETTLEMENT_VERSION = 'PICK2_MLB_OFFICIAL_SETTLEMENT_V1'
const ensure = (ok: unknown, message: string) => { if (!ok) throw new Error(`SETTLEMENT_BLOCK:${message}`) }
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value
export const digestSettlementEvidence = (value: unknown): string => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
export type FinalEvidence = { gamePk: number; source: 'MLB_OFFICIAL'; acquiredAt: string; status: 'Final' | 'Cancelled'; homeScore: number | null; awayScore: number | null; sourcePayload: unknown; sourceDigest: string }
export type PickSettlement = { official_pick_identity: string; outcome: SettlementOutcome; settled_at: string; units: number; stake_units: number; american_odds: number; decision_digest: string; model_version: string; policy_version: string; decision_at: string }

// Authoritative game results are separate from immutable recommendation rows.
// One result per prediction contains each original Official Pick identity.
export function planMlbSettlement(picks: StoredRow[], evidence: FinalEvidence, at: string) {
  ensure(evidence.source === 'MLB_OFFICIAL' && evidence.sourceDigest === digestSettlementEvidence(evidence.sourcePayload), 'PROVENANCE_DIGEST')
  const payload = evidence.sourcePayload as { gamePk?: number; gameData?: { status?: { detailedState?: string } }; liveData?: { linescore?: { teams?: { home?: { runs?: number }; away?: { runs?: number } } } } }
  ensure(payload?.gamePk === evidence.gamePk && payload.gameData?.status?.detailedState === evidence.status, 'AUTHORITATIVE_IDENTITY_STATUS')
  ensure(Number.isFinite(Date.parse(at)) && Number.isFinite(Date.parse(evidence.acquiredAt)) && Date.parse(evidence.acquiredAt) <= Date.parse(at), 'ACQUISITION_TIME')
  ensure(evidence.status === 'Final' || evidence.status === 'Cancelled', 'NOT_TERMINAL')
  if (evidence.status === 'Final') {
    ensure(Number.isInteger(evidence.homeScore) && Number(evidence.homeScore) >= 0 && Number.isInteger(evidence.awayScore) && Number(evidence.awayScore) >= 0, 'SCORES_REQUIRED')
    ensure(payload.liveData?.linescore?.teams?.home?.runs === evidence.homeScore && payload.liveData?.linescore?.teams?.away?.runs === evidence.awayScore, 'SCORE_PROVENANCE')
  }
  ensure(new Set(picks.map(p => p.official_pick_identity)).size === picks.length, 'DUPLICATE_PICK')
  const groups = new Map<string, PickSettlement[]>()
  for (const pick of picks) {
    ensure(typeof pick.prediction_id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(pick.prediction_id) && typeof pick.official_pick_identity === 'string' && pick.official_pick_identity.length > 0, 'PICK_IDENTITY')
    ensure(pick.game_pk === evidence.gamePk && pick.market === 'MONEYLINE' && pick.decision_status === 'OFFICIAL_PICK' && ['HOME', 'AWAY'].includes(String(pick.side)), 'PICK_SCOPE')
    ensure(pick.model_version === MLB_CHAMPION && pick.policy_version === MLB_POLICY && typeof pick.decision_payload_digest === 'string' && /^[a-f0-9]{64}$/.test(pick.decision_payload_digest), 'PICK_CONTRACT')
    ensure(Date.parse(String(pick.decision_at)) < Date.parse(evidence.acquiredAt), 'DECISION_TIME')
    const odds = Number(pick.american_odds)
    ensure(Number.isInteger(odds) && Math.abs(odds) >= 100, 'ODDS')
    const decision = settleMoneyline({ market: 'moneyline', selection: String(pick.side), eventStatus: evidence.status === 'Cancelled' ? 'cancelled' : 'final', selectedScore: pick.side === 'HOME' ? evidence.homeScore : evidence.awayScore, opponentScore: pick.side === 'HOME' ? evidence.awayScore : evidence.homeScore })
    ensure(decision.outcome !== 'pending', 'UNSETTLED')
    const settlement: PickSettlement = { official_pick_identity: String(pick.official_pick_identity), outcome: decision.outcome, settled_at: at, units: decision.outcome === 'win' ? odds > 0 ? odds / 100 : 100 / -odds : decision.outcome === 'loss' ? -1 : 0, stake_units: decision.outcome === 'void' ? 0 : 1, american_odds: odds, decision_digest: String(pick.decision_payload_digest), model_version: MLB_CHAMPION, policy_version: MLB_POLICY, decision_at: String(pick.decision_at) }
    const key = String(pick.prediction_id); groups.set(key, [...groups.get(key) ?? [], settlement])
  }
  return [...groups].map(([prediction_id, settlements]) => ({ prediction_id, game_pk: evidence.gamePk, evaluated_at: at, evaluator_version: MLB_SETTLEMENT_VERSION, result_source: 'MLB_OFFICIAL', source_payload_digest: evidence.sourceDigest,
    actual_result: { status: evidence.status, home_score: evidence.homeScore, away_score: evidence.awayScore, acquired_at: evidence.acquiredAt, settlements: settlements.sort((a, b) => a.official_pick_identity.localeCompare(b.official_pick_identity)) }, metadata: { unit_basis: 'ONE_UNIT_PER_OFFICIAL_PICK_NOT_ACTUAL_WAGERS', settlement_version: MLB_SETTLEMENT_VERSION } }))
}

export function summarizeMlbPerformance(settlements: PickSettlement[]) {
  ensure(settlements.every(s => ['win', 'loss', 'push', 'void'].includes(s.outcome) && Number.isFinite(s.units) && Number.isFinite(s.stake_units) && s.stake_units >= 0 && s.model_version === MLB_CHAMPION && s.policy_version === MLB_POLICY && Number.isFinite(Date.parse(s.decision_at)) && Number.isFinite(Date.parse(s.settled_at))), 'INVALID_PERFORMANCE_EVIDENCE')
  ensure(new Set(settlements.map(s => s.official_pick_identity)).size === settlements.length, 'DUPLICATE_PERFORMANCE_IDENTITY')
  const wins = settlements.filter(s => s.outcome === 'win').length, losses = settlements.filter(s => s.outcome === 'loss').length
  const stakes = settlements.reduce((s, r) => s + r.stake_units, 0), units = settlements.reduce((s, r) => s + r.units, 0)
  const dates = settlements.map(s => s.decision_at.slice(0, 10)).sort()
  return { sampleSize: settlements.length, pickCount: settlements.length, wins, losses, pushes: settlements.filter(s => s.outcome === 'push').length, voids: settlements.filter(s => s.outcome === 'void').length, winRate: wins + losses ? wins / (wins + losses) : null, units: settlements.length ? units : null, roi: stakes > 0 ? units / stakes : null, roiBasis: 'ONE_UNIT_PER_OFFICIAL_PICK_NOT_ACTUAL_WAGERS', clv: null, clvReason: 'No certified closing-line evidence is bound to these settlements.', dateFrom: dates[0] ?? null, dateTo: dates.at(-1) ?? null, modelVersions: [...new Set(settlements.map(s => s.model_version))], policyVersions: [...new Set(settlements.map(s => s.policy_version))] }
}

export type SettlementRow = ReturnType<typeof planMlbSettlement>[number]
export async function persistMlbSettlements(plan: SettlementRow[], repository: { read(ids: string[]): Promise<StoredRow[]>; insert(rows: SettlementRow[]): Promise<void> }, cap: number) {
  ensure(Number.isInteger(cap) && cap >= 0 && plan.length <= cap && new Set(plan.map(r => r.prediction_id)).size === plan.length, 'CAP_IDENTITY')
  const ids = plan.map(r => r.prediction_id)
  const existing = await repository.read(ids)
  // Retried settlement timestamps do not replace the first valid settlement.
  const comparable = (row: StoredRow) => { const actual = row.actual_result as SettlementRow['actual_result']; return digestSettlementEvidence({ prediction_id: row.prediction_id, game_pk: row.game_pk, evaluator_version: row.evaluator_version, result_source: row.result_source, source_payload_digest: row.source_payload_digest, actual_result: { ...actual, settlements: actual?.settlements?.map(s => Object.fromEntries(Object.entries(s).filter(([key]) => key !== 'settled_at'))) } }) }
  const missing = plan.filter(row => {
    const found = existing.filter(e => e.prediction_id === row.prediction_id)
    ensure(found.length <= 1, 'DUPLICATE_STORED_IDENTITY')
    if (!found.length) return true
    ensure(comparable(found[0]) === comparable(row), 'BLOCK_CONFLICT')
    return false
  })
  if (missing.length) await repository.insert(missing)
  const readback = await repository.read(ids)
  ensure(readback.length === plan.length && plan.every(row => readback.some(r => r.prediction_id === row.prediction_id && comparable(r) === comparable(row))), 'READBACK')
  return { status: missing.length ? 'INSERT_ELIGIBLE_PERSISTED' : 'REUSE_NO_OP', planned: plan.length, cap, inserted: missing.length, reused: plan.length - missing.length, conflicts: 0, readback: 'PASS', rows: readback }
}
