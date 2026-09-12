import type { getMlbOperationalView } from '@/services/pick2-operational-read.service'
import type { Pick2MlbValueBoardRow } from '@/types/pick2-value-board'

export type MlbView = Awaited<ReturnType<typeof getMlbOperationalView>>
export type MlbGame = MlbView['games'][number]
export const displayStatuses = ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'NO_EDGE', 'BLOCKED'] as const
export type DisplayStatus = typeof displayStatuses[number]
export const labels: Record<DisplayStatus, string> = { OFFICIAL_PICK: 'Official Pick', VALUE_CANDIDATE: 'Value Candidate', WATCHLIST: 'Watchlist', NO_EDGE: 'No Edge', BLOCKED: 'Waiting / Blocked' }
export const presentationStatus = (row: Pick2MlbValueBoardRow): DisplayStatus => row.opportunity_status ?? row.status
export const percent = (v: number | null | undefined, signed = false) => v == null || !Number.isFinite(v) ? '—' : `${signed && v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
export const price = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v}`
export function prTime(value: string | null | undefined, date = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time unavailable'
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Puerto_Rico', ...(date ? { month: 'short', day: 'numeric' } as const : {}), hour: 'numeric', minute: '2-digit' }).format(new Date(value)) + ' PR'
}
export function friendlyReason(code: string | null | undefined): string {
  if (!code) return 'Analysis pending'
  if (/FINAL|GAME_COMPLETE/i.test(code)) return 'Final'
  if (/STARTED|NOT_PREGAME|IN_PROGRESS/i.test(code)) return 'Game started — pregame recommendations locked'
  if (/STARTER.*MISSING|MISSING.*STARTER|STARTER.*UNKNOWN|UNKNOWN.*STARTER/i.test(code)) return 'Waiting for confirmed starter'
  if (/STARTER.*CHANG|CHANG.*STARTER/i.test(code)) return 'Starter changed — waiting for updated analysis'
  if (/STALE.*MARKET|MARKET.*STALE|STALE.*ODDS|ODDS.*STALE|MARKET_TOO_OLD/i.test(code)) return 'Waiting for fresh odds'
  if (/STALE|EVIDENCE|FREEZE/i.test(code)) return 'Waiting for fresh game data'
  if (/NO_EDGE|NEGATIVE_EV|NON_POSITIVE/i.test(code)) return 'No positive edge at this price'
  if (/IDENTITY|MAPPING/i.test(code)) return 'Waiting for verified game and market details'
  return 'Analysis unavailable — see Data Health for details'
}
export function gameMessage(game: MlbGame) {
  if (/final|completed/i.test(game.status)) return 'Final'
  if (game.reason) return friendlyReason(game.reason)
  if (/live|progress|warmup|delayed/i.test(game.status)) return game.status
  return game.status || 'Scheduled'
}
export function freshness(code: string | null | undefined) {
  if (code === 'FRESH') return 'Odds current'
  if (!code) return 'Odds unavailable'
  if (/STARTED/.test(code)) return 'Pregame odds locked'
  return 'Waiting for fresh odds'
}
export function rowExplanation(row: Pick2MlbValueBoardRow) {
  const status = presentationStatus(row)
  if (status === 'BLOCKED') return row.blocker_codes.length ? [...new Set(row.blocker_codes.map(friendlyReason))].join(' · ') : 'Waiting for complete analysis'
  if (status === 'NO_EDGE') return 'No positive edge at this price.'
  if (status === 'OFFICIAL_PICK') return 'Meets the recommendation criteria. Outcomes are uncertain.'
  if (status === 'VALUE_CANDIDATE') return 'Potential value; does not qualify as an Official Pick.'
  return 'For monitoring only; not an Official Pick.'
}
