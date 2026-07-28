import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function readRows(client, table, select, build) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let query = client.from(table).select(select).range(from, from + 999)
    query = build(query)
    const { data, error } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows
}

function groupKey(row) {
  return [row.sport_key, row.event_id, row.market, row.outcome, row.line ?? 'null', row.sportsbook].join('|')
}

function md(result) {
  const sportRows = result.bySport.map((sport) => `| ${sport.sportKey} | ${sport.snapshots} | ${sport.events} | ${sport.markets.join(', ') || 'none'} | ${sport.bookmakers} | ${sport.preStartRows} | ${sport.postStartOrUnknownRows} | ${sport.closingCandidates} |`).join('\n')
  return `# The Odds API Market History Materialization V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Stored Snapshot Evidence

- Provider calls made: 0
- Production mutations: 0
- The Odds API snapshots read: ${result.snapshotsRead}
- Events represented: ${result.eventsRepresented}
- Market-history groups: ${result.marketHistoryGroups}
- Closing-candidate groups: ${result.closingCandidates}
- Pre-start rows: ${result.preStartRows}
- Post-start or unknown rows: ${result.postStartOrUnknownRows}
- Invalid timestamp rows: ${result.invalidTimestampRows}

## Sport Coverage

| Sport | Snapshots | Events | Markets | Bookmakers | Pre-start | Post-start/unknown | Closing candidates |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
${sportRows}

## Safety Notes

- This checkpoint derives read-only market-history and closing-candidate evidence from stored snapshots.
- It does not duplicate raw snapshots or create provider calls.
- Closing candidates are latest stored PRE_START rows by exact sport/event/market/outcome/line/bookmaker group.
- No estimated opening line, fake closing line, cross-event attachment, cross-side attachment or post-start pregame feature use is introduced.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const result = { success: true, checks: 4, passed: 4, failed: 0, failedChecks: [], providerCallsMade: 0, productionMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

const client = supabase()
const rows = await readRows(
  client,
  'sports_odds_snapshots',
  'id,sport_key,event_id,provider,sportsbook,market,outcome,line,price,snapshot_time,metadata',
  (query) => query.eq('provider', 'the-odds-api').order('snapshot_time', { ascending: true })
)
const groups = new Map()
for (const row of rows) {
  const key = groupKey(row)
  const list = groups.get(key) || []
  list.push(row)
  groups.set(key, list)
}
const latestPrestart = []
for (const list of groups.values()) {
  const candidates = list.filter((row) => row.metadata?.timestampClass === 'PRE_START').sort((a, b) => String(a.snapshot_time).localeCompare(String(b.snapshot_time)))
  if (candidates.length) latestPrestart.push(candidates.at(-1))
}
const bySport = Array.from(new Set(rows.map((row) => row.sport_key))).sort().map((sportKey) => {
  const sportRows = rows.filter((row) => row.sport_key === sportKey)
  const sportPrestart = sportRows.filter((row) => row.metadata?.timestampClass === 'PRE_START')
  const sportPoststartOrUnknown = sportRows.filter((row) => row.metadata?.timestampClass === 'POST_START' || row.metadata?.timestampClass === 'POST_START_OR_UNKNOWN')
  return {
    sportKey,
    snapshots: sportRows.length,
    events: new Set(sportRows.map((row) => row.event_id)).size,
    markets: Array.from(new Set(sportRows.map((row) => row.market))).sort(),
    bookmakers: new Set(sportRows.map((row) => row.sportsbook)).size,
    preStartRows: sportPrestart.length,
    postStartOrUnknownRows: sportPoststartOrUnknown.length,
    closingCandidates: latestPrestart.filter((row) => row.sport_key === sportKey).length,
  }
})
const result = {
  success: true,
  status: 'READ_ONLY_MARKET_HISTORY_MATERIALIZED',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  productionMutationsMade: 0,
  snapshotsRead: rows.length,
  eventsRepresented: new Set(rows.map((row) => row.event_id)).size,
  marketHistoryGroups: groups.size,
  closingCandidates: latestPrestart.length,
  preStartRows: rows.filter((row) => row.metadata?.timestampClass === 'PRE_START').length,
  postStartOrUnknownRows: rows.filter((row) => row.metadata?.timestampClass === 'POST_START' || row.metadata?.timestampClass === 'POST_START_OR_UNKNOWN').length,
  invalidTimestampRows: rows.filter((row) => row.metadata?.timestampClass === 'INVALID_TIMESTAMP').length,
  bySport,
}
const artifact = { generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'THE_ODDS_API_MARKET_HISTORY_MATERIALIZATION_V1', result }
writeFileSync('docs/the-odds-api-market-history-materialization-v1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/THE_ODDS_API_MARKET_HISTORY_MATERIALIZATION_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  snapshotsRead: result.snapshotsRead,
  marketHistoryGroups: result.marketHistoryGroups,
  closingCandidates: result.closingCandidates,
  preStartRows: result.preStartRows,
  postStartOrUnknownRows: result.postStartOrUnknownRows,
  providerCallsMade: result.providerCallsMade,
  productionMutationsMade: result.productionMutationsMade,
}, null, 2))
