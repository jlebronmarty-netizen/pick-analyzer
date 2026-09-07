import { POST as mcpPost } from '@/app/mcp/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

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
    contentType: response.headers.get('content-type'),
    body: await response.text(),
  }
}

export async function GET() {
  const initialize = await rpc(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'pick-analyzer-mcp-smoke', version: '1.0.0' },
  })
  const toolsList = await rpc(2, 'tools/list', {})
  const coverage = await rpc(3, 'tools/call', {
    name: 'mlb_statcast_coverage',
    arguments: { season: 2026 },
  })

  return Response.json({ initialize, toolsList, coverage }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
