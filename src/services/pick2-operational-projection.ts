import { evaluateCertifiedPolicy } from '../../scripts/mlb-data-02r-r2t-policy-binding.mjs'
import { classifyMarketFreshness } from '../../scripts/mlb-data-02r-r2g-persistence-interfaces.mjs'
import type { Pick2MlbValueBoardSourceRow } from './pick2-mlb-value-board.service'

export const MLB_CHAMPION = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
export const MLB_POLICY = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
export type StoredRow = Record<string, unknown>
const obj = (x: unknown): StoredRow => x && typeof x === 'object' ? x as StoredRow : {}
const strings = (x: unknown): string[] => Array.isArray(x) ? x.map(String) : []
export function mlbOperatingDate(at: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
}

// Projection only: probabilities, prices, edge and EV come from persisted rows.
// Policy classification and freshness reuse the certified engines.
export function projectMlbOperations(input: { games: StoredRow[]; predictions: StoredRow[]; values: StoredRow[]; picks: StoredRow[]; teams: StoredRow[]; observations?: StoredRow[]; at: string }) {
  const teamNames = new Map(input.teams.map(t => [t.id, String(t.name)]))
  const sources: Pick2MlbValueBoardSourceRow[] = []
  const games = input.games.map(game => {
    const metadata = obj(game.metadata)
    const latest = input.predictions.filter(p => p.game_pk === game.game_pk && obj(p.metadata).model_version === MLB_CHAMPION && Date.parse(String(p.predicted_at)) <= Date.parse(input.at))
      .sort((a, b) => Date.parse(String(b.predicted_at)) - Date.parse(String(a.predicted_at)))[0]
    const started = !(Date.parse(String(game.scheduled_at)) > Date.parse(input.at))
    const statusSafe = ['Preview', 'Scheduled', 'Pre-Game', 'Warmup'].includes(String(game.official_status))
    const latestValues = latest ? input.values.filter(v => v.prediction_id === latest.id && v.game_pk === game.game_pk && v.model_version === MLB_CHAMPION && Date.parse(String(v.evaluated_at)) <= Date.parse(input.at)) : []
    const newest = Math.max(...latestValues.map(v => Date.parse(String(v.evaluated_at))))
    const values = latestValues.filter(v => Date.parse(String(v.evaluated_at)) === newest).map(v => ({ ...v, market_freshness: classifyMarketFreshness({ provider_last_update: v.provider_last_update, acquired_at: input.at }).state }))
    const age = Date.parse(input.at) - Date.parse(String(game.updated_at))
    const evidenceFresh = Number.isFinite(age) && age >= 0 && age <= 15 * 60_000
    const starters = obj(obj(latest?.metadata).starters)
    const starterChanged = latest && ['home', 'away'].some(side => {
      const current = obj(metadata[`${side}ProbablePitcher`] ?? obj(metadata.starter_evidence)[`${side}ProbablePitcher`]).id
      return !current || current !== obj(starters[side]).mlbam_pitcher_id
    })
    let reason = started ? 'STARTED_GAME_BLOCKED' : !statusSafe ? 'STATUS_UNCONFIRMED' : !evidenceFresh ? 'STALE_GAME_EVIDENCE' : !latest ? 'NO_CURRENT_PREDICTION' : starterChanged ? 'STARTER_EVIDENCE_CHANGED_OR_UNKNOWN' : !values.length ? 'NO_CURRENT_MARKET_VALUE' : null
    try {
      for (const decision of evaluateCertifiedPolicy({ values, runAsOf: input.at }) as Array<{ candidate: StoredRow; status: string; risk_flags?: string[]; reason_codes?: string[]; blocker_codes?: string[] }>) {
        const value = decision.candidate as StoredRow
        const pick = input.picks.find(p => p.value_evaluation_id === value.id && p.prediction_id === latest?.id && p.game_pk === game.game_pk && p.policy_version === MLB_POLICY && p.decision_status === 'OFFICIAL_PICK' && Date.parse(String(p.decision_at)) < Date.parse(String(game.scheduled_at)))
        const blocked = reason !== null || value.market_freshness !== 'FRESH' || decision.status === 'BLOCKED'
        sources.push({ game_pk: Number(game.game_pk), game_date: String(game.game_date), start_time: String(game.scheduled_at), home_team: teamNames.get(game.home_team_id) ?? null, away_team: teamNames.get(game.away_team_id) ?? null,
          side: value.side as 'HOME' | 'AWAY', status: blocked ? 'BLOCKED' : pick ? 'OFFICIAL_PICK' : decision.status === 'OFFICIAL_PICK_ELIGIBLE' ? 'VALUE_CANDIDATE' : decision.status === 'VALUE_CANDIDATE' ? 'VALUE_CANDIDATE' : 'WATCHLIST',
          bookmaker_key: String(value.bookmaker_key), american_odds: Number(value.american_odds), model_probability: Number(value.model_probability), consensus_probability: value.consensus_probability == null ? null : Number(value.consensus_probability), consensus_edge: Number(value.consensus_edge), unit_ev: Number(value.unit_ev), book_count: Number(value.book_count), market_dispersion: Number(value.market_dispersion), market_freshness: String(value.market_freshness), starter_status: String(value.starter_status ?? 'UNKNOWN'),
          risk_flags: strings(decision.risk_flags), reason_codes: strings(decision.reason_codes), blocker_codes: [...strings(decision.blocker_codes), ...(reason ? [reason] : []), ...(value.market_freshness !== 'FRESH' ? ['MARKET_NOT_FRESH'] : [])], policy_version: MLB_POLICY,
          prediction_id: String(latest?.id), value_evaluation_id: String(value.id), official_pick_identity: pick ? String(pick.official_pick_identity) : null, prediction_as_of: String(value.prediction_as_of), market_acquired_at: String(value.market_acquired_at), evaluated_at: String(value.evaluated_at), decision_at: pick ? String(pick.decision_at) : null })
      }
    } catch { reason = 'INVALID_PERSISTED_VALUE_EVIDENCE'; for (let i = sources.length - 1; i >= 0; i--) if (sources[i].game_pk === Number(game.game_pk)) sources.splice(i, 1) }
    const starter = (side: string) => { const p = obj(metadata[`${side}ProbablePitcher`] ?? obj(metadata.starter_evidence)[`${side}ProbablePitcher`]); return typeof p.fullName === 'string' ? p.fullName : p.id ? `MLB ${p.id}` : 'Unknown' }
    const market = (side: string) => {
      const stored = (input.observations ?? []).filter(r => r.game_pk === game.game_pk && r.side === side && r.market === 'MONEYLINE' && Date.parse(String(r.acquired_at)) <= Date.parse(input.at) && Date.parse(String(r.provider_last_update)) <= Date.parse(String(r.acquired_at)))
      const acquired = Math.max(...stored.map(r => Date.parse(String(r.acquired_at))))
      const best = stored.filter(r => Date.parse(String(r.acquired_at)) === acquired).sort((a, b) => Number(b.american_odds) - Number(a.american_odds))[0]
      return best ? { americanOdds: Number(best.american_odds), book: String(best.bookmaker_key), acquiredAt: String(best.acquired_at), freshness: started ? 'GAME_STARTED' : classifyMarketFreshness({ provider_last_update: best.provider_last_update, acquired_at: input.at }).state } : null
    }
    return { gamePk: Number(game.game_pk), scheduledAt: String(game.scheduled_at), status: String(game.official_status), home: teamNames.get(game.home_team_id) ?? 'Unknown team', away: teamNames.get(game.away_team_id) ?? 'Unknown team', homeStarter: starter('home'), awayStarter: starter('away'), homeProbability: latest?.home_probability == null ? null : Number(latest.home_probability), awayProbability: latest?.away_probability == null ? null : Number(latest.away_probability), homeMarket: market('HOME'), awayMarket: market('AWAY'), predictionAt: latest ? String(latest.predicted_at) : null, evidenceAt: String(game.updated_at), reason }
  })
  return { date: mlbOperatingDate(input.at), asOf: input.at, games, sources }
}
