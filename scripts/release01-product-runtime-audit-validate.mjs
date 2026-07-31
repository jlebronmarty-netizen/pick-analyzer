import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredDocs = [
  'docs/PRODUCT/PRODUCT_INVENTORY_V2.md',
  'docs/ARCHITECTURE/RUNTIME_DEPENDENCY_GRAPH.md',
  'docs/PRODUCT/FEATURE_MATRIX_V2.md',
  'docs/PRODUCT/ROUTE_AUDIT_V2.md',
  'docs/ARCHITECTURE/DATABASE_AUDIT_V2.md',
  'docs/PRODUCT/PREDICTION_PIPELINE_AUDIT.md',
  'docs/CERTIFICATION/DOCUMENTATION_VALIDATION.md',
  'docs/CERTIFICATION/RUNTIME_HEALTH.md',
];
const ignoredDirs = new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'out', '.turbo', '.vercel']);
const sourceRoots = ['src', 'scripts', 'docs', 'supabase', '.github'];

const rel = (file) => path.relative(root, file).replaceAll(path.sep, '/');
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function routeFromAppFile(file) {
  const r = rel(file);
  if (!r.startsWith('src/app/')) return '';
  let route = r
    .replace(/^src\/app/, '')
    .replace(/\/(page|route|layout)\.(tsx|ts|jsx|js)$/, '')
    .replace(/\/route\.(tsx|ts|jsx|js)$/, '');
  route = route.replace(/\/\([^)]+\)/g, '');
  route = route || '/';
  return route.replace(/\/+/g, '/');
}

function parseImports(text) {
  const imports = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) imports.push(match[1]);
  }
  return imports;
}

function resolveImport(fromFile, specifier, allFiles) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ].map((candidate) => path.normalize(candidate));
  const fileSet = allFiles.fileSet;
  return candidates.find((candidate) => fileSet.has(candidate)) || null;
}

function markdownLinks(md) {
  const links = [];
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(md))) {
    const target = match[1].trim();
    if (!target || target.startsWith('http') || target.startsWith('#') || target.startsWith('mailto:')) continue;
    links.push(target.split('#')[0]);
  }
  return links;
}

const files = sourceRoots.flatMap((dir) => walk(path.join(root, dir)));
const fileSet = new Set(files.map((file) => path.normalize(file)));
files.fileSet = fileSet;

const failures = [];
const warnings = [];

for (const doc of requiredDocs) {
  if (!exists(doc)) failures.push(`Missing required Release 01 document: ${doc}`);
}

const markdownFiles = files.filter((file) => file.endsWith('.md'));
for (const mdFile of markdownFiles) {
  const text = fs.readFileSync(mdFile, 'utf8');
  for (const link of markdownLinks(text)) {
    const target = path.resolve(path.dirname(mdFile), link);
    if (!fs.existsSync(target)) warnings.push(`Broken or unresolved markdown link from ${rel(mdFile)} -> ${link}`);
  }
}

const routeFiles = files.filter((file) => /src[\\/]app[\\/].*[\\/](page|route|layout)\.(tsx|ts|jsx|js)$/.test(file));
const routeMap = new Map();
for (const file of routeFiles) {
  const type = path.basename(file).split('.')[0];
  const key = `${type}:${routeFromAppFile(file)}`;
  routeMap.set(key, [...(routeMap.get(key) || []), rel(file)]);
}
const duplicateRoutes = [...routeMap.entries()].filter(([, values]) => values.length > 1);
for (const [route, values] of duplicateRoutes) {
  warnings.push(`Duplicate normalized route ${route}: ${values.join(', ')}`);
}

const productInventory = exists(requiredDocs[0]) ? read(requiredDocs[0]) : '';
const routeAudit = exists(requiredDocs[3]) ? read(requiredDocs[3]) : '';
const apiRoutes = routeFiles.filter((file) => /src[\\/]app[\\/]api[\\/].*[\\/]route\.ts$/.test(file));
for (const api of apiRoutes) {
  const apiRel = rel(api);
  if (!productInventory.includes(apiRel) || !routeAudit.includes(apiRel)) {
    failures.push(`Undocumented API route in generated docs: ${apiRel}`);
  }
}

const workflows = files.filter((file) => /^\.github\/workflows\//.test(rel(file)));
for (const workflow of workflows) {
  const workflowRel = rel(workflow);
  if (!productInventory.includes(workflowRel)) {
    failures.push(`Undocumented cron/workflow in product inventory: ${workflowRel}`);
  }
}

const codeFiles = files.filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const graph = new Map();
for (const file of codeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const deps = parseImports(text)
    .map((specifier) => resolveImport(file, specifier, files))
    .filter(Boolean);
  graph.set(path.normalize(file), deps);
}

const cycles = [];
const visiting = new Set();
const visited = new Set();
const stack = [];
function visit(node) {
  if (visiting.has(node)) {
    const index = stack.indexOf(node);
    if (index >= 0) cycles.push(stack.slice(index).concat(node).map(rel));
    return;
  }
  if (visited.has(node)) return;
  visiting.add(node);
  stack.push(node);
  for (const dep of graph.get(node) || []) visit(dep);
  stack.pop();
  visiting.delete(node);
  visited.add(node);
}
for (const node of graph.keys()) visit(node);
for (const cycle of cycles.slice(0, 25)) {
  warnings.push(`Circular import candidate: ${cycle.join(' -> ')}`);
}

const serviceNames = new Map();
for (const file of files.filter((f) => /src[\\/]services[\\/].*\.(ts|tsx|js|jsx)$/.test(f))) {
  const name = path.basename(file).replace(/\.[^.]+$/, '').toLowerCase();
  serviceNames.set(name, [...(serviceNames.get(name) || []), rel(file)]);
}
for (const [name, values] of serviceNames.entries()) {
  if (values.length > 1) warnings.push(`Duplicate service filename signal ${name}: ${values.join(', ')}`);
}

const result = {
  checkedAt: new Date().toISOString(),
  requiredDocs: requiredDocs.length,
  markdownFiles: markdownFiles.length,
  routeFiles: routeFiles.length,
  apiRoutes: apiRoutes.length,
  workflows: workflows.length,
  duplicateRoutes: duplicateRoutes.length,
  circularImportCandidates: cycles.length,
  duplicateServiceSignals: [...serviceNames.values()].filter((values) => values.length > 1).length,
  warnings: warnings.length,
  failures: failures.length,
};

console.log(JSON.stringify(result, null, 2));
if (warnings.length) {
  console.log('\nWarnings:');
  for (const warning of warnings.slice(0, 100)) console.log(`- ${warning}`);
  if (warnings.length > 100) console.log(`- ... ${warnings.length - 100} more warnings omitted`);
}
if (failures.length) {
  console.error('\nFailures:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
process.exit(0);
