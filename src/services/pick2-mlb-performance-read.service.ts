import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MLB_SETTLEMENT_VERSION, summarizeMlbPerformance, type PickSettlement } from './pick2-mlb-settlement'

type OfficialPickRow = {
  official_pick_identity: string
  prediction_id: string
  game_pk: number
  side: 'HOME' | 'AWAY'
  bookmaker_key: string | null
  bookmaker_name: string | null
  american_odds: number
  model_version: string
  model_probability: number
  consensus_probability: number | null
  consensus_edge: number
  unit_ev: number
  policy_version: string
  decision_status: string
  risk_flags: string[] | null
  reason_codes: string[] | null
  blocker_codes: string[] | null
  decision_at: string
  market_acquired_at: string
}

type GameRow = {
  game_pk: number
  scheduled_at: string
  home_team_id: string
  away_team_id: string
  official_status: string | null
}

type TeamRow = { id: string; name: string | null; abbreviation: string | null }

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

function chunks<T>(values: T[], size = 100) {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

async function readGames(gamePks: number[]) {
  const out: GameRow[] = []
  for (const group of chunks(unique(gamePks), 100)) {
    if (!group.length) continue
    const { data, error } = await supabaseAdmin
      .from('pick2_mlb_games')
      .select('game_pk,scheduled_at,home_team_id,away_team_id,official_status')
      .in('game_pk', group)
    if (error) throw new Error(`PERFORMANCE_GAME_READ_FAILED:${error.message}`)
    out.push(...((data ?? []) as GameRow[]))
  }
  return out
}

async function readTeams(teamIds: string[]) {
  const out: TeamRow[] = []
  for (const group of chunks(unique(teamIds), 100)) {
    if (!group.length) continue
    const { data, error } = await supabaseAdmin
      .from('sports_teams')
      .select('id,name,abbreviation')
      .in('id', group)
    if (error) throw new Error(`PERFORMANCE_TEAM_READ_FAILED:${error.message}`)
    out.push(...((data ?? []) as TeamRow[]))
  }
  return out
}

function outcomeMap(settlements: PickSettlement[]) {
  return new Map(settlements.map((settlement) => [settlement.official_pick_identity, settlement.outcome]))
}

export async function getMlbOfficialPerformance() {
  const [resultRead, pickRead] = await Promise.all([
    supabaseAdmin
      .from('pick2_prediction_results')
      .select('actual_result')
      .eq('evaluator_version', MLB_SETTLEMENT_VERSION)
      .order('evaluated_at', { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from('pick2_mlb_official_picks')
      .select('official_pick_identity,prediction_id,game_pk,side,bookmaker_key,bookmaker_name,american_odds,model_version,model_probability,consensus_probability,consensus_edge,unit_ev,policy_version,decision_status,risk_flags,reason_codes,blocker_codes,decision_at,market_acquired_at')
      .eq('decision_status', 'OFFICIAL_PICK')
      .order('decision_at', { ascending: false })
      .limit(1000),
  ])

  if (resultRead.error || pickRead.error || !resultRead.data || !pickRead.data || resultRead.data.length >= 1000 || pickRead.data.length >= 1000) {
    return {
      status: 'UNAVAILABLE',
      summary: summarizeMlbPerformance([]),
      warning: 'Official Pick or settlement evidence is unavailable or exceeds the bounded report limit.',
      ledger: {
        storedDecisionRows: 0,
        uniqueSelections: 0,
        uniqueGames: 0,
        settledDecisionRows: 0,
        pendingDecisionRows: 0,
        settledUniqueSelections: 0,
        pendingUniqueSelections: 0,
        recentSelections: [],
      },
    }
  }

  try {
    const settlements = resultRead.data.flatMap((r) => r.actual_result?.settlements ?? []) as PickSettlement[]
    const picks = pickRead.data as OfficialPickRow[]
    const settled = outcomeMap(settlements)
    const settlementByIdentity = new Map(settlements.map((settlement) => [settlement.official_pick_identity, settlement]))
    const games = await readGames(picks.map((pick) => pick.game_pk))
    const gameByPk = new Map(games.map((game) => [game.game_pk, game]))
    const teams = await readTeams(games.flatMap((game) => [game.home_team_id, game.away_team_id]))
    const teamById = new Map(teams.map((team) => [team.id, team.abbreviation || team.name || team.id]))

    const groups = new Map<string, OfficialPickRow[]>()
    for (const pick of picks) {
      const key = `${pick.game_pk}:${pick.side}`
      groups.set(key, [...(groups.get(key) ?? []), pick])
    }

    const now = Date.now()
    const selections = [...groups.values()].map((rows) => {
      const ordered = [...rows].sort((a, b) => Date.parse(a.decision_at) - Date.parse(b.decision_at))
      const first = ordered[0]
      const latest = ordered.at(-1)!
      const game = gameByPk.get(first.game_pk)
      const groupOutcomes = ordered
        .map((pick) => settled.get(pick.official_pick_identity))
        .filter((value): value is PickSettlement['outcome'] => Boolean(value))
      const uniqueOutcomes = unique(groupOutcomes)
      const fullySettled = groupOutcomes.length === ordered.length && ordered.length > 0
      const partiallySettled = groupOutcomes.length > 0 && !fullySettled
      const scheduledAt = game?.scheduled_at ?? null
      const future = scheduledAt ? Date.parse(scheduledAt) > now : false
      const state = fullySettled && uniqueOutcomes.length === 1
        ? 'SETTLED'
        : partiallySettled
          ? 'PARTIAL_SETTLEMENT'
          : future
            ? 'PREGAME'
            : 'AWAITING_CERTIFIED_SETTLEMENT'
      return {
        gamePk: first.game_pk,
        side: first.side,
        matchup: game ? `${teamById.get(game.away_team_id) ?? game.away_team_id} at ${teamById.get(game.home_team_id) ?? game.home_team_id}` : `Game ${first.game_pk}`,
        selection: game
          ? first.side === 'HOME'
            ? teamById.get(game.home_team_id) ?? 'HOME'
            : teamById.get(game.away_team_id) ?? 'AWAY'
          : first.side,
        scheduledAt,
        storedGameStatus: game?.official_status ?? null,
        state,
        settledOutcome: fullySettled && uniqueOutcomes.length === 1 ? uniqueOutcomes[0] : null,
        decisionSnapshots: ordered.length,
        settledSnapshots: groupOutcomes.length,
        firstDecisionAt: first.decision_at,
        latestDecisionAt: latest.decision_at,
        originalBook: first.bookmaker_name ?? first.bookmaker_key ?? 'Unknown book',
        originalOdds: first.american_odds,
        modelProbability: Number(first.model_probability),
        consensusProbability: first.consensus_probability == null ? null : Number(first.consensus_probability),
        consensusEdge: Number(first.consensus_edge),
        unitEv: Number(first.unit_ev),
        reasonCodes: first.reason_codes ?? [],
        riskFlags: first.risk_flags ?? [],
        blockerCodes: first.blocker_codes ?? [],
        modelVersion: first.model_version,
        policyVersion: first.policy_version,
      }
    }).sort((a, b) => Date.parse(b.firstDecisionAt) - Date.parse(a.firstDecisionAt))

    // Public performance is one unit per unique game/side selection. All
    // immutable decision snapshots remain stored/auditable, but repeated
    // scheduler snapshots must not multiply the result sample.
    const uniqueSettlements: PickSettlement[] = []
    for (const rows of groups.values()) {
      const ordered = [...rows].sort((a, b) => Date.parse(a.decision_at) - Date.parse(b.decision_at))
      const found = ordered.map((pick) => settlementByIdentity.get(pick.official_pick_identity))
      if (found.some((row) => !row)) continue
      const concrete = found as PickSettlement[]
      if (new Set(concrete.map((row) => row.outcome)).size !== 1) continue
      uniqueSettlements.push(concrete[0])
    }
    const summary = summarizeMlbPerformance(uniqueSettlements)
    const settledDecisionRows = picks.filter((pick) => settled.has(pick.official_pick_identity)).length
    const settledUniqueSelections = selections.filter((row) => row.state === 'SETTLED').length
    const status = settlements.length
      ? 'STORED_SETTLEMENTS'
      : picks.length
        ? 'PICKS_AWAITING_SETTLEMENT'
        : 'NO_SETTLED_SAMPLE'

    return {
      status,
      summary,
      warning: settlements.length
        ? null
        : picks.length
          ? `${selections.length} unique Official Pick selections are stored, but no certified settlement rows are stored yet. Results metrics remain settlement-only.`
          : 'No certified Official Pick settlements are stored yet.',
      ledger: {
        storedDecisionRows: picks.length,
        uniqueSelections: selections.length,
        uniqueGames: new Set(picks.map((pick) => pick.game_pk)).size,
        settledDecisionRows,
        pendingDecisionRows: picks.length - settledDecisionRows,
        settledUniqueSelections,
        pendingUniqueSelections: selections.length - settledUniqueSelections,
        recentSelections: selections.slice(0, 30),
      },
    }
  } catch {
    return {
      status: 'INVALID_SETTLEMENT_EVIDENCE',
      summary: summarizeMlbPerformance([]),
      warning: 'Settlement or Official Pick ledger integrity check failed.',
      ledger: {
        storedDecisionRows: 0,
        uniqueSelections: 0,
        uniqueGames: 0,
        settledDecisionRows: 0,
        pendingDecisionRows: 0,
        settledUniqueSelections: 0,
        pendingUniqueSelections: 0,
        recentSelections: [],
      },
    }
  }
}
