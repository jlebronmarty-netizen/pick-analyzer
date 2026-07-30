import fs from 'node:fs'

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'))
const read = (path) => fs.readFileSync(path, 'utf8')

const phases = readJson('docs/PICK_ANALYZER_V1_PHASES.json')
const scope = readJson('docs/PICK_ANALYZER_V1_SCOPE.json')
const finalJson = readJson('docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.json')
const phase5 = readJson('docs/PICK_ANALYZER_V1_FINAL_VALIDATION_MATRIX.json')
const accounting = readJson('docs/PICK_ANALYZER_V1_PROVIDER_MUTATION_ACCOUNTING.json')
const finalMd = read('docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.md')
const evidence = read('docs/PICK_ANALYZER_V1_EVIDENCE_INDEX.md')
const releaseNotes = read('docs/PICK_ANALYZER_V1_RELEASE_NOTES.md')
const limitations = read('docs/PICK_ANALYZER_V1_LIMITATIONS.md')
const operations = read('docs/PICK_ANALYZER_V1_POST_RELEASE_OPERATIONS.md')

const phase = (number) => phases.phases.find((item) => item.phase === number)
const requiredFinalFiles = [
  'docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.md',
  'docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.json',
  'docs/PICK_ANALYZER_V1_EVIDENCE_INDEX.md',
  'docs/PICK_ANALYZER_V1_RELEASE_NOTES.md',
  'docs/PICK_ANALYZER_V1_LIMITATIONS.md',
  'docs/PICK_ANALYZER_V1_POST_RELEASE_OPERATIONS.md',
]

const checks = [
  ['verdict is ready', finalJson.verdict === 'PICK_ANALYZER_V1_READY' && finalMd.includes('PICK_ANALYZER_V1_READY')],
  ['all six phases pass', [1, 2, 3, 4, 5, 6].every((number) => ['complete', 'complete_with_this_artifact'].includes(phase(number)?.status))],
  ['post v1 remains deferred', phase(7)?.status === 'deferred'],
  ['completion is 100', scope.currentCompletionPercent === 100 && finalJson.completionPercent === 100],
  ['phase 5 already passed', phase5.success === true && phase5.status === 'PASS'],
  ['provider and mutation accounting zero', accounting.providerCallsMade === 0 && accounting.providerCreditsUsed === 0 && accounting.productionMutationsMade === 0 && accounting.modelWeightChanges === 0 && accounting.epochChanges === 0],
  ['production runtime commit recorded', finalJson.productionRuntimeCommit === '901811db17cbbc6a693b1021c070ec1f52ea0911'],
  ['no final tag created', finalJson.tagAction.includes('NO_TAG_CREATED') && finalMd.includes('No tag operation was performed')],
  ['required final files indexed', requiredFinalFiles.every((file) => evidence.includes(file))],
  ['limitations preserve V1 boundaries', limitations.includes('All available Odds API data has not been downloaded') && limitations.includes('Automatic model training is disabled') && limitations.includes('Flat all-sport 5-minute polling is not certified')],
  ['release notes preserve exclusions', releaseNotes.includes('Non-MLB production recommendations') && releaseNotes.includes('Automatic model training')],
  ['post release operations require change control', operations.includes('require separate approval')],
  ['phase 6 markers present', phases.certificationMarkers.includes('V1_PHASE_6_PASS') && phases.certificationMarkers.includes('PICK_ANALYZER_V1_READY')],
]

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const failed = checks.filter(([, passed]) => !passed)
if (failed.length) {
  console.error(`Final certification validation failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}

console.log(`Final certification validation passed: ${checks.length}/${checks.length}`)
