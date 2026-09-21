import fs from 'node:fs'
const src=fs.readFileSync('src/services/mlb-approved-prop-market-capture.service.ts','utf8')
const checks=[
  ['official game stores MLB team ids', /homeMlbTeamId:\s*Number\(game\?\.teams\?\.home\?\.team\?\.id\)/.test(src) && /awayMlbTeamId:\s*Number\(game\?\.teams\?\.away\?\.team\?\.id\)/.test(src)],
  ['active roster endpoint used', /roster\?rosterType=active&season=2026/.test(src)],
  ['roster mapping exact normalized name only', /MLB_PLAYER_DIRECTORY_OR_ACTIVE_ROSTER_UNIQUE_EXACT_NORMALIZED_NAME/.test(src)],
  ['fuzzy identity remains disabled', /fuzzyMatchingUsed:\s*false/.test(src)],
  ['ambiguous player matches remain unresolved', /playerMatches\.length === 1/.test(src) && /UNRESOLVED_EXACT_IDENTITY/.test(src)],
]
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name)
console.log(JSON.stringify({success:!failed.length,checks:checks.length,passed:checks.length-failed.length,failed},null,2))
if(failed.length)process.exitCode=1
