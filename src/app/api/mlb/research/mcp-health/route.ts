import { POST as mcpPost } from '@/app/mcp/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const EXPECTED_TOOLS = [
  'mlb_find_player',
  'mlb_games_for_date',
  'mlb_statcast_coverage',
  'mlb_pitcher_profile',
  'mlb_batter_profile',
  'mlb_team_profile',
  'mlb_matchup',
  'mlb_project_pitcher_strikeouts',
  'mlb_project_pitcher_walks',
] as const

async function rpc(id: number, method: string, params: Record<string, unknown>) {
  const response = await mcpPost(new Request('http://localhost/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  }))

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: await response.text(),
  }
}

export async function GET() {
  const initialize = await rpc(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'pick-analyzer-mcp-health', version: '1.0.0' },
  })
  const toolsList = await rpc(2, 'tools/list', {})
  const coverage = await rpc(3, 'tools/call', {
    name: 'mlb_statcast_coverage',
    arguments: { season: 2026 },
  })

  const initializeOk = initialize.status === 200 && initialize.body.includes('protocolVersion')
  const missingTools = EXPECTED_TOOLS.filter((tool) => !toolsList.body.includes(tool))
  const toolsOk = toolsList.status === 200 && missingTools.length === 0
  const coverageOk = coverage.status === 200
    && coverage.body.includes('2026')
    && coverage.body.includes('pitches')
    && coverage.body.includes('games')

  const healthy = initializeOk && toolsOk && coverageOk

  return Response.json({
    status: healthy ? 'PASS' : 'FAIL',
    readOnly: true,
    protocol: {
      initialize: initializeOk ? 'PASS' : 'FAIL',
      toolsList: toolsOk ? 'PASS' : 'FAIL',
      coverageCall: coverageOk ? 'PASS' : 'FAIL',
    },
    expectedToolCount: EXPECTED_TOOLS.length,
    missingTools,
    checks: {
      initializeHttpStatus: initialize.status,
      toolsListHttpStatus: toolsList.status,
      coverageHttpStatus: coverage.status,
    },
  }, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
