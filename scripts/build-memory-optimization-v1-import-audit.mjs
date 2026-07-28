import fs from 'node:fs'
import path from 'node:path'

const outFile = process.argv[2] ?? null
const root = process.cwd()
const targets = ['src/app', 'src/components']
const importPattern = /from\s+['"](@\/services\/[^'"]+|@\/lib\/supabase-admin|server-only)['"]/g

function walk(dir, rows = []) {
  if (!fs.existsSync(dir)) return rows
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, rows)
    else if (/\.(ts|tsx)$/.test(entry.name)) rows.push(full)
  }
  return rows
}

const rows = []
const importCounts = new Map()
for (const target of targets) {
  for (const file of walk(path.join(root, target))) {
    const text = fs.readFileSync(file, 'utf8')
    const imports = []
    for (const match of text.matchAll(importPattern)) {
      imports.push(match[1])
      importCounts.set(match[1], (importCounts.get(match[1]) ?? 0) + 1)
    }
    if (imports.length) {
      rows.push({
        file: path.relative(root, file).replaceAll('\\', '/'),
        imports,
        count: imports.length,
      })
    }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  mode: 'build_memory_optimization_v1_import_pressure_audit',
  filesWithServerImports: rows.length,
  totalServerImports: rows.reduce((sum, row) => sum + row.count, 0),
  topImportedServices: Array.from(importCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 25)
    .map(([importPath, count]) => ({ importPath, count })),
  largestImportingFiles: rows
    .sort((left, right) => right.count - left.count)
    .slice(0, 25),
}

const json = `${JSON.stringify(result, null, 2)}\n`
if (outFile) fs.writeFileSync(path.join(root, outFile), json)
console.log(json)
