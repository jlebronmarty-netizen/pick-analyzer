import { evaluateCertifiedPolicy } from '../../scripts/mlb-data-02r-r2t-policy-binding.mjs'
import { classifyMarketFreshness } from '../../scripts/mlb-data-02r-r2g-persistence-interfaces.mjs'
import type { Pick2MlbValueBoardSourceRow } from './pick2-mlb-value-board.service'

export const MLB_CHAMPION = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
export const MLB_POLICY = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
export type StoredRow = Record<string, unknown>
export type MlbGameStatus = 'READY' | 'WAITING_FOR_EVIDENCE' | 'BLOCKED' | 'STARTED' | 'FINAL'
export type MlbOpportunityStatus = 'OFFICIAL_PICK' | 'VALUE_CANDIDATE' | 'WATCHLIST' | 'BLOCKED' | 'NO_EDGE'
export type MlbReadInput = { games: StoredRow[]; predictions: StoredRow[]; values: StoredRow[]; picks: StoredRow[]; teams: StoredRow[]; observations?: StoredRow[]; mappings?: StoredRow[]; schedules?: StoredRow[]; evidenceUnavailable?: boolean; at: string }
const obj = (x: unknown): StoredRow => x && typeof x === 'object' ? x as StoredRow : {}
const strings = (x: unknown): string[] => Array.isArray(x) ? x.map(String) : []
const time = (x: unknown) => typeof x === 'string' ? Date.parse(x) : NaN
const same = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)
const before = (row: StoredRow, field: string, at: number) => time(row[field]) <= at && (row.created_at == null || time(row.created_at) <= at)
const ordered = (rows: StoredRow[], field: string, identity: string) => [...rows].sort((a, b) => time(b[field]) - time(a[field]) || String(a[identity] ?? a.id).localeCompare(String(b[identity] ?? b.id)))
export function mlbOperatingDate(at: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
}

// Projection only. The immutable policy and market engines remain authoritative.
// Native updated_at is deliberately not an evidence timestamp.
export function projectMlbOperations(input: MlbReadInput) {
  const now = time(input.at), teamNames = new Map(input.teams.map(t => [t.id, String(t.name)]))
  const sources: Pick2MlbValueBoardSourceRow[] = []
  const games = input.games.map(game => {
    const metadata = obj(game.metadata)
    const schedule = ordered((input.schedules ?? []).filter(s => same(s.game_pk, game.game_pk) && before(s, 'observed_at', now)), 'observed_at', 'game_pk')[0]
    const scheduledAt = String(schedule?.scheduled_at ?? game.scheduled_at)
    const officialStatus = String(schedule?.official_status ?? game.official_status)
    const final = ['Final', 'Game Over', 'Completed'].includes(officialStatus)
    const started = final || time(scheduledAt) <= now || ['In Progress', 'Live'].includes(officialStatus)
    const statusSafe = ['Preview', 'Scheduled', 'Pre-Game', 'Warmup'].includes(officialStatus)
    const latest = ordered(input.predictions.filter(p => same(p.game_pk, game.game_pk) && obj(p.metadata).model_version === MLB_CHAMPION && before(p, 'predicted_at', now)), 'predicted_at', 'deterministic_identity')[0]
    const pm = obj(latest?.metadata), starters = obj(pm.starters)
    const currentStarter = (side: string) => obj(schedule?.[side + 'Starter'] ?? metadata[side + 'ProbablePitcher'] ?? obj(metadata.starter_evidence)[side + 'ProbablePitcher'])
    const starterMissing = ['home', 'away'].some(side => !currentStarter(side).id)
    const starterChanged = latest && ['home', 'away'].some(side => !same(currentStarter(side).id, obj(starters[side]).mlbam_pitcher_id))
    const predictionValid = latest && Number.isFinite(latest.home_probability) && Number.isFinite(latest.away_probability) && Number(latest.home_probability) > 0 && Number(latest.home_probability) < 1 && Number(latest.away_probability) > 0 && Number(latest.away_probability) < 1 && time(latest.predicted_at) < time(scheduledAt) && time(pm.scheduled_at) === time(scheduledAt) && typeof pm.evidence_digest === 'string'
    const mappings = ordered((input.mappings ?? []).filter(m => same(m.game_pk, game.game_pk) && before(m, 'matched_at', now)), 'matched_at', 'id')
    const observations = (input.observations ?? []).filter(o => same(o.game_pk, game.game_pk) && o.market === 'MONEYLINE' && before(o, 'acquired_at', now) && time(o.provider_last_update) <= time(o.acquired_at) && time(o.acquired_at) < time(o.commence_time) && time(o.acquired_at) < time(scheduledAt) && (() => { const m = mappings.find(m => m.market_provider === o.provider); return m && same(m.id, o.market_event_mapping_id) && same(m.provider_event_id, o.provider_event_id) })())
    const latestAcquisition = Math.max(...(input.observations ?? []).filter(o => same(o.game_pk, game.game_pk) && o.market === 'MONEYLINE' && before(o, 'acquired_at', now)).map(o => time(o.acquired_at)))
    const currentObservations = observations.filter(o => time(o.acquired_at) === latestAcquisition)
    const latestValues = latest ? input.values.filter(v => same(v.prediction_id, latest.id) && same(v.game_pk, game.game_pk) && v.model_version === MLB_CHAMPION && before(v, 'evaluated_at', now)) : []
    // A new evaluation supersedes older rows per side, never just globally.
    const values = ['HOME', 'AWAY'].flatMap(side => {
      const rows = ordered(latestValues.filter(v => v.side === side), 'evaluated_at', 'value_identity')
      return rows.filter(v => time(v.evaluated_at) === time(rows[0]?.evaluated_at))
    })
    const linksValid = (v: StoredRow) => {
      const home = observations.find(o => same(o.id, v.home_market_observation_id) && o.side === 'HOME')
      const away = observations.find(o => same(o.id, v.away_market_observation_id) && o.side === 'AWAY')
      const selected = v.side === 'HOME' ? home : away
      return !!(home && away && selected && same(v.selected_side_market_observation_id, selected.id) && same(home.market_event_mapping_id, away.market_event_mapping_id) && same(home.bookmaker_key, away.bookmaker_key) && same(selected.bookmaker_key, v.bookmaker_key) && same(selected.provider_event_id, v.provider_event_id) && time(home.acquired_at) === time(v.market_acquired_at) && time(away.acquired_at) === time(v.market_acquired_at) && time(v.provider_last_update) <= time(v.market_acquired_at) && time(v.prediction_as_of) === time(latest?.predicted_at) && time(v.prediction_as_of) <= time(v.market_acquired_at) && time(v.market_acquired_at) <= time(v.evaluated_at) && time(v.evaluated_at) < time(scheduledAt) && time(v.evaluated_at) < time(home.commence_time) && time(v.evaluated_at) < time(away.commence_time))
    }
    // A persisted valid evaluation attests the certified pregame guard at its
    // evaluation timestamp, only with complete matching prediction/market links.
    const attestations = [
      ...(schedule ? [{ at: String(schedule.observed_at), source: 'VERIFIED_SCHEDULE_OBSERVED_AT' }] : []),
      ...(predictionValid && !starterChanged ? [{ at: String(latest.predicted_at), source: 'CERTIFIED_PREDICTION_AS_OF' }] : []),
      ...values.filter(v => predictionValid && !starterChanged && linksValid(v) && ['PREGAME_VALID', 'PREGAME_VALID_AT_MARKET_ACQUISITION'].includes(String(v.temporal_eligibility))).map(v => ({ at: String(v.evaluated_at), source: 'LINKED_PREGAME_VALUE_EVALUATED_AT' })),
    ].filter(a => time(a.at) <= now).sort((a, b) => time(b.at) - time(a.at) || a.source.localeCompare(b.source))
    const evidence = attestations[0], evidenceFresh = evidence && now - time(evidence.at) <= 15 * 60_000
    let reason = final ? 'FINAL_GAME' : started ? 'STARTED_GAME_BLOCKED' : input.evidenceUnavailable ? 'CANONICAL_EVIDENCE_READ_UNAVAILABLE' : !statusSafe || !Number.isFinite(time(scheduledAt)) ? 'STATUS_UNCONFIRMED' : starterMissing ? 'STARTER_EVIDENCE_UNKNOWN' : starterChanged ? 'STARTER_EVIDENCE_CHANGED' : !evidence ? 'NO_OBSERVED_GAME_EVIDENCE' : !evidenceFresh ? 'STALE_GAME_EVIDENCE' : !latest ? 'NO_CURRENT_PREDICTION' : !predictionValid ? 'PREDICTION_EVIDENCE_MISMATCH' : null
    const persistedPicks = ordered(input.picks.filter(p => same(p.game_pk, game.game_pk) && same(p.prediction_id, latest?.id) && p.policy_version === MLB_POLICY && p.decision_status === 'OFFICIAL_PICK' && before(p, 'decision_at', now) && time(p.decision_at) < time(scheduledAt)), 'decision_at', 'official_pick_identity')
    const policyValues = [...values].sort((a, b) => Number(persistedPicks.some(p => same(p.value_evaluation_id, b.id))) - Number(persistedPicks.some(p => same(p.value_evaluation_id, a.id))) || String(a.value_identity ?? a.id).localeCompare(String(b.value_identity ?? b.id))).map(v => ({ ...v, market_freshness: classifyMarketFreshness({ provider_last_update: v.provider_last_update, acquired_at: input.at }).state }))
    try {
      for (const decision of evaluateCertifiedPolicy({ values: policyValues, runAsOf: input.at }) as Array<{ candidate: StoredRow; status: string; risk_flags?: string[]; reason_codes?: string[]; blocker_codes?: string[] }>) {
        const value = decision.candidate
        const pick = persistedPicks.find(p => same(p.value_evaluation_id, value.id) && time(p.decision_at) >= time(value.evaluated_at))
        const blockers = [...strings(decision.blocker_codes), ...(reason ? [reason] : []), ...(!linksValid(value) ? ['VALUE_MARKET_LINKAGE_MISMATCH'] : []), ...(time(value.market_acquired_at) !== latestAcquisition ? ['NEW_MARKET_AWAITING_VALUE'] : []), ...(value.market_freshness !== 'FRESH' ? ['MARKET_NOT_FRESH'] : [])]
        const blocked = blockers.length > 0 || decision.status === 'BLOCKED'
        const status = blocked ? 'BLOCKED' : pick && decision.status === 'OFFICIAL_PICK_ELIGIBLE' ? 'OFFICIAL_PICK' : ['OFFICIAL_PICK_ELIGIBLE', 'VALUE_CANDIDATE'].includes(decision.status) ? 'VALUE_CANDIDATE' : Number(value.consensus_edge) <= 0 || Number(value.unit_ev) <= 0 ? 'NO_EDGE' : 'WATCHLIST'
        sources.push({ game_pk: Number(game.game_pk), game_date: String(game.game_date), start_time: scheduledAt, home_team: teamNames.get(game.home_team_id) ?? null, away_team: teamNames.get(game.away_team_id) ?? null,
          side: value.side as 'HOME' | 'AWAY', status: status === 'NO_EDGE' ? 'WATCHLIST' : status, opportunity_status: status, bookmaker_key: String(value.bookmaker_key), american_odds: Number(value.american_odds), model_probability: Number(value.model_probability), consensus_probability: value.consensus_probability == null ? null : Number(value.consensus_probability), consensus_edge: Number(value.consensus_edge), unit_ev: Number(value.unit_ev), book_count: Number(value.book_count), market_dispersion: Number(value.market_dispersion), market_freshness: String(value.market_freshness), starter_status: String(value.starter_status ?? 'UNKNOWN'),
          risk_flags: strings(decision.risk_flags), reason_codes: strings(decision.reason_codes), blocker_codes: [...new Set(blockers)], policy_version: MLB_POLICY,
          prediction_id: String(latest?.id), value_evaluation_id: String(value.id), official_pick_identity: pick ? String(pick.official_pick_identity) : null, prediction_as_of: String(value.prediction_as_of), market_acquired_at: String(value.market_acquired_at), evaluated_at: String(value.evaluated_at), decision_at: pick ? String(pick.decision_at) : null })
      }
    } catch { reason = 'INVALID_PERSISTED_VALUE_EVIDENCE'; for (let i = sources.length - 1; i >= 0; i--) if (sources[i].game_pk === Number(game.game_pk)) sources.splice(i, 1) }
    const starter = (side: string) => { const p = currentStarter(side); return typeof p.fullName === 'string' ? p.fullName : p.id ? 'MLB ' + p.id : 'Unknown' }
    const market = (side: string) => {
      const best = [...currentObservations].filter(o => o.side === side).sort((a, b) => Number(b.american_odds) - Number(a.american_odds) || String(a.observation_identity).localeCompare(String(b.observation_identity)))[0]
      return best ? { americanOdds: Number(best.american_odds), book: String(best.bookmaker_key), acquiredAt: String(best.acquired_at), freshness: started ? 'GAME_STARTED' : classifyMarketFreshness({ provider_last_update: best.provider_last_update, acquired_at: input.at }).state } : null
    }
    const gameStatus: MlbGameStatus = final ? 'FINAL' : started ? 'STARTED' : !reason ? 'READY' : ['NO_OBSERVED_GAME_EVIDENCE', 'STALE_GAME_EVIDENCE', 'NO_CURRENT_PREDICTION', 'STARTER_EVIDENCE_UNKNOWN'].includes(reason) ? 'WAITING_FOR_EVIDENCE' : 'BLOCKED'
    const opportunities = sources.filter(s => s.game_pk === Number(game.game_pk)).map(s => ({ side: s.side, status: s.opportunity_status ?? s.status, blockers: s.blocker_codes ?? [] }))
    return { gamePk: Number(game.game_pk), scheduledAt, status: officialStatus, gameStatus, opportunities, home: teamNames.get(game.home_team_id) ?? 'Unknown team', away: teamNames.get(game.away_team_id) ?? 'Unknown team', homeStarter: starter('home'), awayStarter: starter('away'), homeProbability: predictionValid ? Number(latest.home_probability) : null, awayProbability: predictionValid ? Number(latest.away_probability) : null, homeMarket: market('HOME'), awayMarket: market('AWAY'), predictionAt: latest ? String(latest.predicted_at) : null, evidenceAt: evidence?.at ?? null, evidenceSource: evidence?.source ?? null, reason }
  })
  return { date: mlbOperatingDate(input.at), asOf: input.at, games, sources }
}
