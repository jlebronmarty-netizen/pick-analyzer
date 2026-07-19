#!/usr/bin/env node

const command = process.argv[2] || 'history'

const commands = {
  history: {
    mode: 'basketball_history_cli_v1',
    description: 'Plan BSN historical reconstruction through the Basketball Data Platform.',
    endpoint: '/api/basketball/bsn/historical-reconstruction?season=2026',
  },
  sync: {
    mode: 'basketball_sync_cli_v1',
    description: 'Plan incremental basketball sync using registered connectors and existing provider guardrails.',
    endpoint: '/api/basketball/platform',
  },
  validate: {
    mode: 'basketball_validate_cli_v1',
    description: 'Run deterministic basketball platform validation.',
    endpoint: '/api/basketball/platform?validate=true',
  },
  export: {
    mode: 'basketball_export_cli_v1',
    description: 'Describe CSV/JSON/Supabase export handoff through existing import/export architecture.',
    endpoint: '/api/basketball/platform',
  },
  import: {
    mode: 'basketball_import_cli_v1',
    description: 'Describe dry-run import handoff through the existing Historical Import Engine.',
    endpoint: '/api/basketball/platform',
  },
}

if (!commands[command]) {
  console.error(JSON.stringify({
    success: false,
    error: `Unknown basketball command: ${command}`,
    available: Object.keys(commands),
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  success: true,
  ...commands[command],
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  note: 'Run against a deployed or local Next.js server when execution is required. CLI contract is intentionally dry-run/read-only.',
}, null, 2))
