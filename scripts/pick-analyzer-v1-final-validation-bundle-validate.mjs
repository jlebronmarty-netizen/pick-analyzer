import fs from 'node:fs'

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'))
const read = (path) => fs.readFileSync(path, 'utf8')

const phases = readJson('docs/PICK_ANALYZER_V1_PHASES.json')
const scope = readJson('docs/PICK_ANALYZER_V1_SCOPE.json')
const matrix = readJson('docs/PICK_ANALYZER_V1_FINAL_VALIDATION_MATRIX.json')
const dod = readJson('docs/PICK_ANALYZER_V1_DEFINITION_OF_DONE_MATRIX.json')
const production = readJson('docs/PICK_ANALYZER_V1_PRODUCTION_CERTIFICATION.json')
const accounting = readJson('docs/PICK_ANALYZER_V1_PROVIDER_MUTATION_ACCOUNTING.json')
const bundle = read('docs/PICK_ANALYZER_V1_FINAL_VALIDATION_BUNDLE.md')

const phase = (number) => phases.phases.find((item) => item.phase === number)
const validatorFailures = matrix.validators.filter((item) => item.result === 'FAIL')
const nonSupersededFailures = validatorFailures.filter((item) => item.result !== 'SUPERSEDED')

const checks = [
  ['phases 1 through 5 pass', [1, 2, 3, 4, 5].every((number) => ['complete', 'complete_with_this_artifact'].includes(phase(number)?.status))],
  ['phase 6 remains pending', phase(6)?.status === 'remaining'],
  ['completion is 96 before final declaration', scope.currentCompletionPercent === 96],
  ['validation matrix pass', matrix.success === true && matrix.status === 'PASS'],
  ['no non-superseded validator failures', nonSupersededFailures.length === 0],
  ['definition of done matrix pass', dod.success === true && dod.status === 'PASS' && dod.requirements.length >= 26],
  ['production certification pass', production.success === true && production.productionRuntimeCommit === '901811db17cbbc6a693b1021c070ec1f52ea0911'],
  ['provider accounting zero', accounting.providerCallsMade === 0 && accounting.productionMutationsMade === 0 && accounting.predictionWrites === 0 && accounting.settlementWrites === 0 && accounting.learningWrites === 0],
  ['local smoke not run', matrix.localServerSmokeRun === false && bundle.includes('LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS')],
  ['phase 5 marker present', phases.certificationMarkers.includes('V1_PHASE_5_PASS')],
]

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const failed = checks.filter(([, passed]) => !passed)
if (failed.length) {
  console.error(`Final validation bundle validation failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}

console.log(`Final validation bundle validation passed: ${checks.length}/${checks.length}`)
