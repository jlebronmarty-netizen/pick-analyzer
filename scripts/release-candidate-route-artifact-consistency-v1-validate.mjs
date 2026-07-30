import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/RELEASE_CANDIDATE_ROUTE_ARTIFACT_CONSISTENCY_V1.json', 'utf8'))
const route = fs.readFileSync('src/app/api/data-coverage/final-certification/route.ts', 'utf8')
const service = fs.readFileSync('src/services/multi-sport-data-expansion-final.service.ts', 'utf8')
const phases = JSON.parse(fs.readFileSync('docs/PICK_ANALYZER_V1_PHASES.json', 'utf8'))

const phase2 = phases.phases.find((phase) => phase.phase === 2)
const phase3 = phases.phases.find((phase) => phase.phase === 3)

const checks = [
  ['phase 2 reconciled complete', phase2?.status === 'complete'],
  ['phase 3 remains partial pending production verification', phase3?.status === 'partial_local_repair_pending_production_verification'],
  ['production evidence commit recorded', artifact.productionCommitAtAudit === '021845d40139c73acfe838839abdda97783a9ab4'],
  ['provider calls stayed zero', artifact.providerCallsMade === 0],
  ['production mutations stayed zero', artifact.productionMutationsMade === 0],
  ['all non-data-coverage route groups certified', ['dashboard', 'currentBoard', 'probabilityPicks', 'performance', 'aiOperations', 'operations', 'providers'].every((key) => artifact.routeEvidence[key].certified === true)],
  ['data coverage blocker recorded truthfully', artifact.phaseExitCriteria.data_coverage_certified === false && artifact.blockers.length > 0],
  ['json artifacts certified', artifact.phaseExitCriteria.json_artifacts_valid === true],
  ['compact default route implemented', route.includes('getMultiSportDataExpansionFinalCertificationSummaryV1') && route.includes("request.nextUrl.searchParams.get('diagnostics') === 'full'")],
  ['full diagnostics preserved behind query', route.indexOf('diagnostics') < route.indexOf('getMultiSportDataExpansionFinalCertificationV1()')],
  ['summary service preserves zero-call contract', service.includes('providerCallsMade: certification.providerCallsMade') && service.includes('productionMutationsMade: certification.productionMutationsMade')],
]

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const failed = checks.filter(([, passed]) => !passed)
if (failed.length) {
  console.error(`Release-candidate route/artifact consistency validation failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}

console.log(`Release-candidate route/artifact consistency validation passed: ${checks.length}/${checks.length}`)
