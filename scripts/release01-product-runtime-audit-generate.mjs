import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoots = ['src', 'scripts', 'docs', 'supabase', '.github'];
const ignoredDirs = new Set([
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
]);
const maxFiles = Number(process.env.RELEASE01_MAX_FILES || 8000);
const timeoutMs = Number(process.env.RELEASE01_TIMEOUT_MS || 120000);
const startedAt = Date.now();

const stat = (file) => fs.statSync(file);
const rel = (file) => path.relative(root, file).replaceAll(path.sep, '/');
const esc = (value) =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
    .trim();
const hasExt = (file, exts) => exts.includes(path.extname(file).toLowerCase());
const slug = (value) =>
  String(value || 'unknown')
    .replaceAll('\\', '/')
    .replace(/\.[^.]+$/, '')
    .split('/')
    .filter(Boolean)
    .slice(-3)
    .join(' / ');

function assertBudget(filesScanned) {
  if (Date.now() - startedAt > timeoutMs) {
    throw new Error(`Release 01 inventory timed out after ${timeoutMs}ms`);
  }
  if (filesScanned > maxFiles) {
    throw new Error(`Release 01 inventory exceeded max file guard (${maxFiles})`);
  }
}

function walk(dir, files = []) {
  assertBudget(files.length);
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      walk(full, files);
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(full);
    if (files.length % 250 === 0) {
      console.log(`[release01] scanned ${files.length} files...`);
    }
  }
  return files;
}

function readText(file) {
  try {
    const ext = path.extname(file).toLowerCase();
    if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.sql', '.yml', '.yaml', '.css'].includes(ext)) {
      return '';
    }
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function routeFromAppFile(file) {
  const r = rel(file);
  if (!r.startsWith('src/app/')) return '';
  let route = r
    .replace(/^src\/app/, '')
    .replace(/\/(page|route|layout)\.(tsx|ts|jsx|js)$/, '')
    .replace(/\/route\.(tsx|ts|jsx|js)$/, '');
  route = route.replace(/\/\([^)]+\)/g, '');
  route = route.replace(/\/page$/, '');
  route = route || '/';
  return route.replace(/\/+/g, '/');
}

function parseImports(text) {
  const imports = new Set();
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) imports.add(match[1]);
  }
  return [...imports].sort();
}

function parseDbRefs(text) {
  const refs = new Set();
  const patterns = [
    /\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /\.rpc\(\s*['"`]([^'"`]+)['"`]/g,
    /from\s+([a-zA-Z_][a-zA-Z0-9_."']+)/g,
    /join\s+([a-zA-Z_][a-zA-Z0-9_."']+)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) refs.add(match[1].replace(/["']/g, ''));
  }
  return [...refs].sort();
}

function parseExports(text) {
  const exports = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
    /export\s+class\s+([A-Za-z0-9_]+)/g,
    /export\s+const\s+([A-Za-z0-9_]+)/g,
    /export\s+type\s+([A-Za-z0-9_]+)/g,
    /export\s+interface\s+([A-Za-z0-9_]+)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) exports.add(match[1]);
  }
  return [...exports].sort();
}

function kindFor(file, text) {
  const r = rel(file);
  const lower = r.toLowerCase();
  if (lower.endsWith('/middleware.ts') || lower === 'middleware.ts' || lower === 'src/middleware.ts') return 'Middleware';
  if (lower.startsWith('src/app/api/') && /\/route\.(ts|js)$/.test(lower)) return 'API Route';
  if (lower.startsWith('src/app/') && /\/page\.(tsx|jsx)$/.test(lower)) return 'App Route';
  if (lower.startsWith('src/app/') && /\/layout\.(tsx|jsx)$/.test(lower)) return 'Layout';
  if (lower.startsWith('src/app/') && /\/route\.(ts|js)$/.test(lower)) return 'Route Handler';
  if (lower.includes('/dashboard')) return 'Dashboard';
  if (lower.includes('/admin')) return 'Admin Tool';
  if (lower.includes('/provider') || lower.includes('/providers/')) return 'Provider';
  if (lower.includes('/adapter') || lower.includes('/adapters/')) return 'Adapter';
  if (lower.includes('/repository') || lower.includes('/repositories/') || lower.includes('-repo')) return 'Repository';
  if (lower.includes('/hooks/') || /\/use[A-Z][^/]+\.tsx?$/.test(r)) return 'Hook';
  if (lower.startsWith('src/components/')) return 'Component';
  if (lower.startsWith('src/services/')) return 'Service';
  if (lower.startsWith('scripts/')) return /validate|audit|cert/i.test(r) ? 'Validation Module' : 'Script';
  if (lower.startsWith('.github/workflows/')) return 'Cron';
  if (lower.includes('worker')) return 'Worker';
  if (lower.includes('prediction') || /prediction/i.test(text)) return 'Prediction Module';
  if (lower.includes('learning') || lower.includes('calibration') || /learning|calibration/i.test(text)) return 'Learning Module';
  if (lower.includes('settlement') || lower.includes('settle') || /settlement|settle/i.test(text)) return 'Settlement Module';
  if (lower.includes('feature-store') || lower.includes('/features/') || /feature store/i.test(text)) return 'Feature Store';
  if (lower.includes('/ai') || lower.includes('ai-') || /openai|ai explanation|autonomous/i.test(text)) return 'AI Module';
  if (lower.startsWith('src/lib/') || lower.startsWith('src/utils/') || lower.startsWith('src/config/') || lower.startsWith('src/types/')) return 'Utility';
  return 'Utility';
}

function productionStatus(file, text, kind) {
  const r = rel(file).toLowerCase();
  if (/deprecated|legacy|obsolete/.test(r)) return 'Deprecated';
  if (kind === 'API Route' && /cron_secret|authorization|protected|requirecron|x-cron-secret/i.test(text)) return 'Protected';
  if (/experimental|shadow|preview|pilot|diagnostic/.test(r)) return 'Experimental';
  if (kind === 'Script' || kind === 'Validation Module') return 'Operational Tool';
  if (kind === 'Cron') return 'Scheduled';
  if (['App Route', 'API Route', 'Route Handler', 'Layout', 'Dashboard'].includes(kind)) return 'Production Surface';
  return 'Internal Dependency';
}

function responsibilityFor(file, kind, exports) {
  const route = routeFromAppFile(file);
  if (route && kind === 'API Route') return `Handles ${route} API requests.`;
  if (route && kind === 'App Route') return `Renders ${route} page experience.`;
  if (route && kind === 'Layout') return `Defines layout shell for ${route}.`;
  if (exports.length) return `Provides ${exports.slice(0, 5).join(', ')}.`;
  return `Provides ${slug(rel(file))} ${kind.toLowerCase()} behavior.`;
}

function objectRowsFromSql(files, inventory) {
  const objects = [];
  const patterns = [
    ['Table', /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."']+)/gi],
    ['Index', /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."']+)/gi],
    ['View', /create\s+(?:or\s+replace\s+)?view\s+([a-zA-Z0-9_."']+)/gi],
    ['Materialized View', /create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."']+)/gi],
    ['Trigger', /create\s+trigger\s+([a-zA-Z0-9_."']+)/gi],
    ['Policy', /create\s+policy\s+["']?([^"'\n]+)["']?/gi],
    ['RPC', /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_."]+)/gi],
  ];
  for (const file of files.filter((f) => rel(f).startsWith('supabase/') && f.endsWith('.sql'))) {
    const text = readText(file);
    for (const [type, pattern] of patterns) {
      let match;
      while ((match = pattern.exec(text))) {
        const name = match[1].replace(/["']/g, '');
        const usedBy = inventory
          .filter((item) => item.dbRefs.includes(name.split('.').pop()) || item.dbRefs.includes(name))
          .map((item) => item.file)
          .slice(0, 12);
        objects.push({
          type,
          name,
          file: rel(file),
          usage: usedBy.length ? usedBy.join('<br>') : 'No static reference found',
        });
      }
    }
  }
  return objects;
}

function writeDoc(target, content) {
  const full = path.join(root, target);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log(`[release01] wrote ${target}`);
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(esc).join(' | ')} |`),
  ].join('\n');
}

const files = sourceRoots.flatMap((dir) => walk(path.join(root, dir)));
const inventory = files
  .filter((file) => hasExt(file, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.sql', '.yml', '.yaml']))
  .map((file) => {
    const text = readText(file);
    const imports = parseImports(text);
    const dbRefs = parseDbRefs(text);
    const exports = parseExports(text);
    const kind = kindFor(file, text);
    return {
      file: rel(file),
      kind,
      route: routeFromAppFile(file),
      responsibility: responsibilityFor(file, kind, exports),
      dependencies: imports.slice(0, 10),
      dbRefs,
      exports,
      status: productionStatus(file, text, kind),
      modified: stat(file).mtime.toISOString().slice(0, 10),
      text,
    };
  })
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file));

const routeItems = inventory.filter((item) => item.route && ['API Route', 'App Route', 'Layout', 'Route Handler'].includes(item.kind));
const apiRoutes = routeItems.filter((item) => item.kind === 'API Route');
const cronItems = inventory.filter((item) => item.kind === 'Cron' || /cron|schedule|scheduler/i.test(item.file + item.text));
const dbObjects = objectRowsFromSql(files, inventory);

const importedTargets = new Set(inventory.flatMap((item) => item.dependencies));
const featureRows = inventory
  .filter((item) => ['App Route', 'API Route', 'Dashboard', 'Service', 'Provider', 'Adapter', 'Prediction Module', 'Learning Module', 'Settlement Module', 'AI Module', 'Cron'].includes(item.kind))
  .map((item) => {
    const feature = item.route || slug(item.file);
    const area = item.kind;
    const ui = item.kind === 'App Route' || item.file.includes('src/components/') ? 'Yes' : 'No';
    const api = item.kind === 'API Route' ? 'Yes' : 'No';
    const docs = inventory.some((doc) => doc.kind === 'Utility' && doc.file.startsWith('docs/') && doc.text.includes(path.basename(item.file).replace(/\.[^.]+$/, ''))) ? 'Yes' : 'No';
    return [
      feature,
      area,
      item.status,
      /Production Surface|Protected|Scheduled/.test(item.status) ? 'Yes' : 'No',
      /GET\s*\(/.test(item.text) && !/POST\s*\(|PUT\s*\(|PATCH\s*\(|DELETE\s*\(/.test(item.text) ? 'Yes' : 'No',
      /Experimental|preview|shadow|pilot/i.test(item.status + item.file) ? 'Yes' : 'No',
      /Deprecated/.test(item.status) ? 'Yes' : 'No',
      ui,
      api,
      docs,
      item.dependencies.slice(0, 5).join('<br>') || 'None detected',
      item.modified,
    ];
  });

const routeCounts = routeItems.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});

const duplicateRouteMap = new Map();
for (const item of routeItems) {
  const key = `${item.kind}:${item.route}`;
  duplicateRouteMap.set(key, [...(duplicateRouteMap.get(key) || []), item.file]);
}
const duplicateRoutes = [...duplicateRouteMap.entries()].filter(([, values]) => values.length > 1);

const orphanCandidates = inventory.filter(
  (item) =>
    item.file.startsWith('src/') &&
    !['App Route', 'API Route', 'Layout', 'Route Handler', 'Middleware'].includes(item.kind) &&
    ![...importedTargets].some((dep) => dep.includes(path.basename(item.file).replace(/\.[^.]+$/, '')))
);

writeDoc(
  'docs/PRODUCT/PRODUCT_INVENTORY_V2.md',
  `# Product Inventory V2\n\nGenerated from repository files on ${new Date().toISOString()}.\n\n## Scope\n\nScanned explicit repository roots: ${sourceRoots.map((dir) => `\`${dir}\``).join(', ')}. Excluded generated and dependency directories; symlinks were not followed.\n\n## Repository Statistics\n\n${table(['Metric', 'Count'], [
    ['Scanned files', files.length],
    ['Inventory rows', inventory.length],
    ['App/API/layout routes', routeItems.length],
    ['API routes', apiRoutes.length],
    ['Cron/workflow/scheduler references', cronItems.length],
    ['Database objects parsed', dbObjects.length],
  ])}\n\n## Inventory\n\n${table(['File', 'Type', 'Responsibility', 'Dependencies', 'Production Status'], inventory.map((item) => [
    item.file,
    item.kind,
    item.responsibility,
    item.dependencies.slice(0, 8).join('<br>') || 'None detected',
    item.status,
  ]))}\n`
);

writeDoc(
  'docs/ARCHITECTURE/RUNTIME_DEPENDENCY_GRAPH.md',
  `# Runtime Dependency Graph\n\nGenerated from static imports, route files, workflow files and database references.\n\n## Page To API To Service To Repository To Database\n\n${table(['Surface', 'Route', 'Imports / Services', 'Database References'], routeItems.map((item) => [
    item.file,
    item.route || 'n/a',
    item.dependencies.slice(0, 10).join('<br>') || 'None detected',
    item.dbRefs.slice(0, 10).join('<br>') || 'None detected',
  ]))}\n\n## Scheduler To Worker To Provider\n\n${table(['Scheduler / Worker', 'Dependencies', 'Provider Signals', 'Status'], cronItems.map((item) => [
    item.file,
    item.dependencies.slice(0, 10).join('<br>') || 'None detected',
    /provider|odds|sportsdata|supabase|api/i.test(item.text) ? 'Provider or protected endpoint reference detected' : 'No provider reference detected',
    item.status,
  ]))}\n\n## Prediction To Persistence To Dashboard To Settlement To Learning\n\n${table(['Pipeline Area', 'File', 'Dependencies', 'Database References'], inventory.filter((item) => /prediction|feature|dashboard|settlement|learning|calibration|performance/i.test(item.file + item.text)).map((item) => [
    item.kind,
    item.file,
    item.dependencies.slice(0, 8).join('<br>') || 'None detected',
    item.dbRefs.slice(0, 8).join('<br>') || 'None detected',
  ]))}\n`
);

writeDoc(
  'docs/PRODUCT/FEATURE_MATRIX_V2.md',
  `# Feature Matrix V2\n\nGenerated from discovered routes, services, providers, adapters and product modules.\n\n${table(['Feature', 'Area', 'Status', 'Production Ready', 'Read Only', 'Experimental', 'Deprecated', 'UI', 'API', 'Documentation', 'Depends On', 'Last Modified'], featureRows)}\n`
);

writeDoc(
  'docs/PRODUCT/ROUTE_AUDIT_V2.md',
  `# Route Audit V2\n\nGenerated from \`src/app\` route, page and layout files.\n\n## Summary\n\n${table(['Classification', 'Count'], Object.entries(routeCounts))}\n\n## Duplicate Route Findings\n\n${duplicateRoutes.length ? table(['Route', 'Files'], duplicateRoutes.map(([route, filesForRoute]) => [route, filesForRoute.join('<br>')])) : 'No duplicate route files detected by normalized route and type.'}\n\n## Route Inventory\n\n${table(['Route', 'Type', 'File', 'Classification', 'Notes'], routeItems.map((item) => [
    item.route || 'n/a',
    item.kind,
    item.file,
    item.status === 'Production Surface' ? 'Active' : item.status,
    item.responsibility,
  ]))}\n`
);

writeDoc(
  'docs/ARCHITECTURE/DATABASE_AUDIT_V2.md',
  `# Database Audit V2\n\nGenerated from Supabase SQL files and static repository references.\n\n## Database Objects\n\n${table(['Type', 'Name', 'Defined In', 'Static Repository Usage'], dbObjects.map((object) => [
    object.type,
    object.name,
    object.file,
    object.usage,
  ]))}\n\n## Highlights\n\n- Objects marked \`No static reference found\` may still be used dynamically, by Supabase policies, by SQL functions, or by production data workflows.\n- This audit does not mutate the database and does not query production.\n`
);

writeDoc(
  'docs/PRODUCT/PREDICTION_PIPELINE_AUDIT.md',
  `# Prediction Pipeline Audit\n\nGenerated from repository files containing prediction, feature-store, settlement, learning, calibration, performance and dashboard signals.\n\n## Flow\n\nData -> Normalization -> Feature Store -> Prediction Engine -> Persistence -> Dashboard -> Settlement -> Learning -> Calibration\n\n## Discovered Pipeline Files\n\n${table(['Stage Signal', 'File', 'Responsibility', 'Dependencies', 'Database References'], inventory.filter((item) => /data|normalization|feature|prediction|persist|dashboard|settlement|learning|calibration|performance/i.test(item.file + item.text)).map((item) => [
    item.kind,
    item.file,
    item.responsibility,
    item.dependencies.slice(0, 8).join('<br>') || 'None detected',
    item.dbRefs.slice(0, 8).join('<br>') || 'None detected',
  ]))}\n\n## Integrity Notes\n\n- The audit is static and repository-generated only.\n- No probabilities, model weights, recommendations, scheduler behavior, providers, settlement rows or learning state were changed.\n`
);

const docsRows = inventory
  .filter((item) => item.file.startsWith('docs/') && item.file.endsWith('.md'))
  .map((doc) => {
    const referenced = inventory.filter((item) => item.file !== doc.file && doc.text.includes(path.basename(item.file).replace(/\.[^.]+$/, ''))).length;
    const status = referenced > 0 ? 'Cross-referenced' : 'No direct file reference detected';
    return [doc.file, status, referenced, doc.modified];
  });
const undocumentedApiRows = apiRoutes.map((item) => [item.route, item.file, 'Included in PRODUCT_INVENTORY_V2 and ROUTE_AUDIT_V2']);

writeDoc(
  'docs/CERTIFICATION/DOCUMENTATION_VALIDATION.md',
  `# Documentation Validation\n\nGenerated from repository documentation and route inventory.\n\n## API Documentation Coverage\n\n${table(['API Route', 'File', 'Documentation Status'], undocumentedApiRows)}\n\n## Documentation Cross-Reference\n\n${table(['Document', 'Status', 'Direct File References', 'Last Modified'], docsRows)}\n\n## Findings\n\n- Orphan documentation candidates are documents with no direct file-name references; many roadmap and certification documents are narrative by design and may not reference code paths literally.\n- Undocumented production features should be triaged from API and feature rows whose \`Documentation\` column is \`No\` in [FEATURE_MATRIX_V2.md](../PRODUCT/FEATURE_MATRIX_V2.md).\n`
);

writeDoc(
  'docs/CERTIFICATION/RUNTIME_HEALTH.md',
  `# Runtime Health\n\nGenerated from static repository inspection.\n\n## Duplicate Routes\n\n${duplicateRoutes.length ? table(['Route', 'Files'], duplicateRoutes.map(([route, filesForRoute]) => [route, filesForRoute.join('<br>')])) : 'No duplicate route files detected by normalized route and type.'}\n\n## Potential Orphan / Dead Utility Candidates\n\n${table(['File', 'Type', 'Reason'], orphanCandidates.slice(0, 250).map((item) => [
    item.file,
    item.kind,
    'No static inbound import basename match found; verify before removal.',
  ]))}\n\n## TODO / FIXME\n\n${table(['File', 'Signal'], inventory.filter((item) => /TODO|FIXME/i.test(item.text)).map((item) => [
    item.file,
    [...item.text.matchAll(/(TODO|FIXME)[^\n\r]*/gi)].slice(0, 3).map((m) => m[0]).join('<br>'),
  ]))}\n\n## Duplicate Provider / Service Signals\n\n${table(['Signal', 'Files'], Object.entries(inventory.reduce((acc, item) => {
    if (!['Service', 'Provider', 'Adapter', 'Repository'].includes(item.kind)) return acc;
    const key = path.basename(item.file).replace(/\.[^.]+$/, '').toLowerCase();
    acc[key] = [...(acc[key] || []), item.file];
    return acc;
  }, {})).filter(([, values]) => values.length > 1).map(([key, values]) => [key, values.join('<br>')]))}\n\n## Circular Dependency Scope\n\nCircular import detection is provided by \`scripts/release01-product-runtime-audit-validate.mjs\` for repository TypeScript and JavaScript imports where static resolution is possible.\n`
);

console.log(`[release01] completed in ${Date.now() - startedAt}ms`);
