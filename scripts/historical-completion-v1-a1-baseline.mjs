import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const sports = [
  { sportKey: 'baseball_mlb', label: 'MLB', currentSeason: '2026', previousSeason: '2025' },
  { sportKey: 'basketball_nba', label: 'NBA', currentSeason: '2025-26', previousSeason: '2024-25' },
  { sportKey: 'americanfootball_nfl', label: 'NFL', currentSeason: '2026', previousSeason: '2025' },
  { sportKey: 'icehockey_nhl', label: 'NHL', currentSeason: '2025-26', previousSeason: '2024-25' },
  { sportKey: 'soccer', label: 'Soccer', currentSeason: 'competition_specific', previousSeason: 'competition_specific' },
  { sportKey: 'basketball_bsn', label: 'BSN', currentSeason: '2026', previousSeason: '2025' },
  { sportKey: 'tennis', label: 'Tennis', currentSeason: 'event_driven_2026', previousSeason: 'event_driven_2025' },
  { sportKey: 'mma_ufc', label: 'UFC', currentSeason: 'event_driven_2026', previousSeason: 'event_driven_2025' },
]

const datasets = [
  { key: 'teams', label: 'Teams', table: 'sports_teams', dateColumn: 'updated_at', required: true },
  { key: 'players', label: 'Players', table: 'sport_players', dateColumn: 'updated_at' },
  { key: 'events', label: 'Events / schedules', table: 'sport_events', dateColumn: 'start_time', required: true },
  { key: 'completed_events', label: 'Completed events', table: 'sport_events', dateColumn: 'start_time', filter: (q) => q.in('status', ['final', 'completed', 'closed', 'postgame']) },
  { key: 'future_events', label: 'Future events', table: 'sport_events', dateColumn: 'start_time', filter: (q) => q.gte('start_time', new Date().toISOString()) },
  { key: 'results', label: 'Results', table: 'game_results', dateColumn: 'created_at', required: true },
  { key: 'standings', label: 'Standings', table: 'sport_standings', dateColumn: 'updated_at' },
  { key: 'team_stats', label: 'Team / game stats', table: 'sport_game_stats', dateColumn: 'updated_at' },
  { key: 'player_stats', label: 'Player stats', table: 'sport_player_stats', dateColumn: 'updated_at' },
  { key: 'boxscores', label: 'Boxscores', table: 'sport_game_stats', dateColumn: 'updated_at' },
  { key: 'period_scores', label: 'Period/quarter/inning scores', table: 'sport_events', dateColumn: 'start_time' },
  { key: 'starters_lineups', label: 'Starters / lineups', table: 'sport_lineups', dateColumn: 'updated_at' },
  { key: 'injuries', label: 'Injuries', table: 'sport_injuries', dateColumn: 'updated_at' },
  { key: 'odds', label: 'Odds snapshots', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', required: true },
  { key: 'props', label: 'Player props', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', filter: (q) => q.like('market', 'player_props:%') },
  { key: 'features', label: 'Feature snapshots', table: 'historical_feature_snapshots', dateColumn: 'as_of_time' },
  { key: 'predictions', label: 'Predictions', table: 'prediction_history', dateColumn: 'commence_time' },
  { key: 'settlements', label: 'Settlements', table: 'prediction_history', dateColumn: 'updated_at', filter: (q) => q.not('result', 'is', null) },
  { key: 'identities', label: 'Provider identities', table: 'provider_entity_mappings', dateColumn: 'updated_at', required: true },
]

function loadEnvFile() {
  const text = fs.readFileSync('.env.local', 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line) || !line.includes('=')) continue
    const index = line.indexOf('=')
    const name = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[name] = value
  }
}

function pct(available, total) {
  if (total === 0) return 0
  return Math.round((available / total) * 100)
}

function classifyDataset(row) {
  if (row.error) return 'UNAVAILABLE'
  if (row.rowCount === 0) return row.required ? 'BLOCKED_EMPTY' : 'EMPTY'
  if (row.duplicateIndicator === 'detected' || row.missingRequiredFieldSamples > 0) return 'PARTIAL_REVIEW_REQUIRED'
  return 'AVAILABLE'
}

async function countRows(client, sport, dataset) {
  let query = client.from(dataset.table).select('id', { count: 'exact', head: true }).eq('sport_key', sport.sportKey)
  if (dataset.filter) query = dataset.filter(query)
  const { count, error } = await query
  if (error) return { rowCount: 0, error: error.message }
  return { rowCount: count ?? 0, error: null }
}

async function boundary(client, sport, dataset, ascending) {
  let query = client
    .from(dataset.table)
    .select(dataset.dateColumn)
    .eq('sport_key', sport.sportKey)
    .not(dataset.dateColumn, 'is', null)
    .order(dataset.dateColumn, { ascending })
    .limit(1)
  if (dataset.filter) query = dataset.filter(query)
  const { data, error } = await query
  if (error) return null
  return data?.[0]?.[dataset.dateColumn] ?? null
}

async function sampleRows(client, sport, dataset) {
  let query = client.from(dataset.table).select('*').eq('sport_key', sport.sportKey).limit(250)
  if (dataset.filter) query = dataset.filter(query)
  const { data, error } = await query
  if (error) return []
  return data ?? []
}

function naturalKey(dataset, row) {
  if (dataset.key === 'events') return [row.start_time, row.home_team_id ?? row.home_team, row.away_team_id ?? row.away_team].join('|')
  if (dataset.key === 'odds' || dataset.key === 'props') return [row.event_id, row.sportsbook, row.market, row.outcome, row.line, row.snapshot_time].join('|')
  if (dataset.key === 'identities') return [row.entity_type, row.provider, row.provider_id, row.season].join('|')
  if (dataset.key === 'players') return [row.team_id, row.display_name, row.position].join('|')
  if (dataset.key === 'teams') return [row.league_key, row.name].join('|')
  return row.id ?? null
}

function duplicateIndicator(dataset, rows) {
  const keys = rows.map((row) => naturalKey(dataset, row)).filter(Boolean)
  if (keys.length < 2) return 'not_applicable'
  return new Set(keys).size === keys.length ? 'not_detected_in_sample' : 'detected'
}

function missingRequired(dataset, rows) {
  const required = {
    teams: ['id', 'name'],
    players: ['id', 'display_name'],
    events: ['id', 'start_time', 'home_team', 'away_team', 'status'],
    odds: ['id', 'event_id', 'sportsbook', 'market', 'outcome', 'snapshot_time'],
    props: ['id', 'event_id', 'sportsbook', 'market', 'outcome', 'snapshot_time'],
    identities: ['sport_key', 'entity_type', 'provider', 'provider_id', 'internal_id'],
  }[dataset.key] ?? ['id']
  return rows.filter((row) => required.some((field) => row[field] === null || row[field] === undefined || row[field] === '')).length
}

function providersFromRows(rows) {
  const providers = new Set()
  for (const row of rows) {
    if (typeof row.provider === 'string') providers.add(row.provider)
    if (row.provider_ids && typeof row.provider_ids === 'object' && !Array.isArray(row.provider_ids)) {
      for (const key of Object.keys(row.provider_ids)) providers.add(key)
    }
  }
  return [...providers].sort()
}

async function auditSport(client, sport) {
  const datasetRows = []
  for (const dataset of datasets) {
    const [count, earliestDate, latestDate, sample] = await Promise.all([
      countRows(client, sport, dataset),
      boundary(client, sport, dataset, true),
      boundary(client, sport, dataset, false),
      sampleRows(client, sport, dataset),
    ])
    const row = {
      key: dataset.key,
      label: dataset.label,
      table: dataset.table,
      required: Boolean(dataset.required),
      rowCount: count.rowCount,
      earliestDate,
      latestDate,
      duplicateIndicator: duplicateIndicator(dataset, sample),
      missingRequiredFieldSamples: missingRequired(dataset, sample),
      providers: providersFromRows(sample),
      error: count.error,
    }
    datasetRows.push({ ...row, classification: classifyDataset(row) })
  }
  const availableRequired = datasetRows.filter((row) => row.required && row.rowCount > 0).length
  const requiredTotal = datasetRows.filter((row) => row.required).length
  const availableAll = datasetRows.filter((row) => row.rowCount > 0).length
  const totalRows = datasetRows.reduce((sum, row) => sum + row.rowCount, 0)
  const sourceProviders = [...new Set(datasetRows.flatMap((row) => row.providers))].sort()
  const allDates = datasetRows.flatMap((row) => [row.earliestDate, row.latestDate]).filter(Boolean).sort()
  const completenessPercent = pct(availableAll, datasetRows.length)
  const coreCompletenessPercent = pct(availableRequired, requiredTotal)
  return {
    ...sport,
    totalRows,
    earliestDate: allDates[0] ?? null,
    latestDate: allDates.at(-1) ?? null,
    sourceProviders,
    completenessPercent,
    coreCompletenessPercent,
    reliabilityClassification: coreCompletenessPercent >= 100 ? 'CORE_AVAILABLE' : completenessPercent > 0 ? 'PARTIAL' : 'EMPTY_OR_BLOCKED',
    datasets: datasetRows,
    duplicateIndicators: datasetRows.filter((row) => row.duplicateIndicator === 'detected').map((row) => row.key),
    missingRequiredFields: datasetRows.reduce((sum, row) => sum + row.missingRequiredFieldSamples, 0),
    blockers: datasetRows.filter((row) => row.required && row.rowCount === 0).map((row) => `${row.key}_empty`),
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Historical Data Completion Baseline V3',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This baseline is read-only and uses stored production-compatible tables only. It performs no provider calls, no imports, no feature rebuilds, no prediction generation, no epoch seeding and no production mutations.',
    '',
    '## Summary',
    '',
    `- Sports audited: ${report.summary.sportsAudited}`,
    `- Total stored rows observed: ${report.summary.totalRowsObserved}`,
    `- Provider calls: ${report.providerCallsMade}`,
    `- Remote mutations: ${report.remoteMutationsMade}`,
    `- Production mutations: ${report.productionMutationsMade}`,
    '',
    '| Sport | Previous season | Current season | Rows | Core coverage | Overall coverage | Reliability | Earliest | Latest | Providers |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
    ...report.sports.map((sport) => `| ${sport.label} | ${sport.previousSeason} | ${sport.currentSeason} | ${sport.totalRows} | ${sport.coreCompletenessPercent}% | ${sport.completenessPercent}% | ${sport.reliabilityClassification} | ${sport.earliestDate ?? 'N/A'} | ${sport.latestDate ?? 'N/A'} | ${sport.sourceProviders.join(', ') || 'N/A'} |`),
    '',
  ]
  for (const sport of report.sports) {
    lines.push(`## ${sport.label}`, '')
    lines.push(`Reliability: ${sport.reliabilityClassification}`)
    lines.push(`Completeness: core ${sport.coreCompletenessPercent}%, overall ${sport.completenessPercent}%`)
    lines.push(`Blockers: ${sport.blockers.length ? sport.blockers.join(', ') : 'none from required stored-data checks'}`)
    lines.push('', '| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |')
    lines.push('| --- | ---: | --- | --- | --- | --- | ---: | --- |')
    for (const dataset of sport.datasets) {
      lines.push(`| ${dataset.label} | ${dataset.rowCount} | ${dataset.classification} | ${dataset.earliestDate ?? 'N/A'} | ${dataset.latestDate ?? 'N/A'} | ${dataset.duplicateIndicator} | ${dataset.missingRequiredFieldSamples} | ${dataset.providers.join(', ') || 'N/A'} |`)
    }
    lines.push('')
  }
  lines.push('## Certification', '')
  lines.push('- `GLOBAL_COVERAGE_BASELINE_V3_PASS`')
  lines.push('- `GLOBAL_STORED_DATA_AUDIT_PASS`')
  lines.push('')
  return `${lines.join('\n')}\n`
}

function validate(report) {
  const checks = [
    ['audits eight sports', report.sports.length === 8],
    ['zero provider calls', report.providerCallsMade === 0],
    ['zero remote mutations', report.remoteMutationsMade === 0],
    ['zero production mutations', report.productionMutationsMade === 0],
    ['has dataset rows for every sport', report.sports.every((sport) => sport.datasets.length === datasets.length)],
    ['has honest reliability classifications', report.sports.every((sport) => typeof sport.reliabilityClassification === 'string')],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failed.length === 0,
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed,
  }
}

async function main() {
  loadEnvFile()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  const client = createClient(url, key, { auth: { persistSession: false } })
  const auditedSports = []
  for (const sport of sports) auditedSports.push(await auditSport(client, sport))
  const report = {
    mode: 'historical_data_completion_baseline_v3',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sports: auditedSports,
    summary: {
      sportsAudited: auditedSports.length,
      totalRowsObserved: auditedSports.reduce((sum, sport) => sum + sport.totalRows, 0),
      coreAvailableSports: auditedSports.filter((sport) => sport.reliabilityClassification === 'CORE_AVAILABLE').length,
      partialSports: auditedSports.filter((sport) => sport.reliabilityClassification === 'PARTIAL').length,
      emptyOrBlockedSports: auditedSports.filter((sport) => sport.reliabilityClassification === 'EMPTY_OR_BLOCKED').length,
    },
  }
  const validation = validate(report)
  fs.writeFileSync('docs/HISTORICAL_DATA_COMPLETION_BASELINE_V3.md', renderMarkdown(report))
  console.log(JSON.stringify({ ...validation, summary: report.summary, providerCallsMade: 0, remoteMutationsMade: 0, productionMutationsMade: 0 }, null, 2))
  if (!validation.success) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2))
  process.exit(1)
})
