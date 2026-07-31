import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const checks = []

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, predicate, out)
    else if (predicate(full)) out.push(full)
  }
  return out
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/')
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

function isExternal(link) {
  return /^(https?:|mailto:|tel:|#)/i.test(link)
}

function isRuntimeRoute(link) {
  return /^\/(api|dashboard|performance|data-coverage|most-likely|best-value|sports-center|model|login|register|$)/.test(link)
}

const required = [
  'README.md',
  'START_HERE.md',
  'docs/README.md',
  'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md',
  'docs/MASTER_PROGRAM/SPRINT_0_DOCUMENTATION_FOUNDATION.md',
  'docs/RELEASES/README.md',
  'docs/PRODUCT/README.md',
  'docs/ARCHITECTURE/README.md',
  'docs/CERTIFICATION/README.md',
  'docs/HISTORY/README.md',
]

for (const file of required) check(`required file exists: ${file}`, fs.existsSync(path.join(ROOT, file)))
const docsDirNames = fs.readdirSync(path.join(ROOT, 'docs'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
check('release folder normalized to docs/RELEASES', docsDirNames.includes('RELEASES') && !docsDirNames.includes('releases'))

const jsonFiles = walk(ROOT, (file) => file.endsWith('.json') && !rel(file).startsWith('node_modules/'))
const jsonErrors = []
for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    jsonErrors.push(`${rel(file)}: ${error instanceof Error ? error.message : 'invalid JSON'}`)
  }
}
check('JSON artifacts parse', jsonErrors.length === 0, jsonErrors.slice(0, 10).join('; '))

const markdownFiles = walk(ROOT, (file) => /\.(md|mdx)$/i.test(file))
const brokenLinks = []
const linkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g
for (const file of markdownFiles) {
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(linkPattern)) {
    const raw = match[1].trim()
    const target = raw.split('#')[0]
    if (!target || isExternal(target) || isRuntimeRoute(target)) continue
    if (/^[a-z]+:/i.test(target)) continue
    const withoutQuery = target.split('?')[0]
    const decoded = decodeURIComponent(withoutQuery)
    const resolved = decoded.startsWith('/')
      ? path.join(ROOT, decoded.slice(1))
      : path.resolve(path.dirname(file), decoded)
    if (!resolved.startsWith(ROOT)) {
      brokenLinks.push(`${rel(file)} -> ${raw} escapes repository`)
      continue
    }
    if (!fs.existsSync(resolved)) brokenLinks.push(`${rel(file)} -> ${raw}`)
  }
}
check('internal Markdown links resolve', brokenLinks.length === 0, brokenLinks.slice(0, 25).join('; '))

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
check('README links START_HERE and Master Program', readme.includes('(START_HERE.md)') && readme.includes('docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md'))
check('README names Decision Core', readme.includes('Decision Core'))

const report = {
  generatedAt: new Date().toISOString(),
  verdict: checks.every((item) => item.passed) ? 'SPRINT_0_DOCUMENTATION_FOUNDATION_PASS' : 'SPRINT_0_DOCUMENTATION_FOUNDATION_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  documentationInventory: {
    markdownFiles: markdownFiles.length,
    jsonFiles: jsonFiles.length,
  },
}

console.log(JSON.stringify(report, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)
