'use client'

import { useTeamStats } from '@/hooks/useTeamStats'

function formatWinPercentage(value: number | null) {
  if (value === null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

export default function TeamStatsPanel() {
  const { teamStats, loading, error } = useTeamStats('baseball_mlb')

  if (loading) {
    return <p className="text-slate-400">Loading team stats...</p>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/40 p-4">
        <p className="font-bold text-red-400">Could not load team stats.</p>
        <p className="mt-2 text-sm text-red-200">{error}</p>
      </div>
    )
  }

  if (teamStats.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <p className="text-slate-300">No team stats yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          Run POST /api/team-stats to insert sample data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {teamStats.slice(0, 6).map((team) => (
        <div
          key={team.id}
          className="rounded-xl bg-slate-800 p-4 transition hover:bg-slate-700"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{team.team_name}</p>
              <p className="text-sm text-slate-400">
                {team.wins}-{team.losses}
                {team.ties > 0 ? `-${team.ties}` : ''} · Win%{' '}
                {formatWinPercentage(team.win_percentage)}
              </p>
            </div>

            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-green-400">
              {team.streak ?? 'N/A'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 md:grid-cols-4">
            <div className="rounded-lg bg-slate-900 p-2">
              <p>Home</p>
              <p className="font-bold text-white">
                {team.home_wins}-{team.home_losses}
              </p>
            </div>

            <div className="rounded-lg bg-slate-900 p-2">
              <p>Away</p>
              <p className="font-bold text-white">
                {team.away_wins}-{team.away_losses}
              </p>
            </div>

            <div className="rounded-lg bg-slate-900 p-2">
              <p>Last 5</p>
              <p className="font-bold text-white">
                {team.last_5_wins}-{team.last_5_losses}
              </p>
            </div>

            <div className="rounded-lg bg-slate-900 p-2">
              <p>Last 10</p>
              <p className="font-bold text-white">
                {team.last_10_wins}-{team.last_10_losses}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}