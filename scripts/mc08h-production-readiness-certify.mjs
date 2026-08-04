#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const checks = []

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail })
  if (!pass) console.error('FAIL', name, detail)
}

const cert = JSON.parse(read('docs/CERTIFICATION/mc-08h-production-readiness-certification.json'))
const status = JSON.parse(read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json'))
const queue = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')
const certMd = read('docs/CERTIFICATION/MC_08H_PRODUCTION_READINESS_CERTIFICATION.md')

check('MC-08H certification markdown exists', exists('docs/CERTIFICATION/MC_08H_PRODUCTION_READINESS_CERTIFICATION.md'))
check('MC-08H mission markdown exists', exists('docs/MISSION_CONTROL/MC_08H_PRODUCTION_READINESS_CERTIFICATION.md'))
check('MC-08H JSON exists', exists('docs/CERTIFICATION/mc-08h-production-readiness-certification.json'))
check('production readiness is blocked', cert.status === 'PRODUCTION_READINESS_BLOCKED' && cert.productionReady === false)
check('readiness percent is bounded', cert.productionReadinessPercent >= 0 && cert.productionReadinessPercent <= 100)
check('critical blockers recorded', cert.issueCounts.critical === 3 && cert.criticalIssues.includes('scheduler_execution_critical') && cert.criticalIssues.includes('market_freshness_critical'))
check('operations evidence blocks pilot', cert.productionEvidence.operationsHealthStatus === 'CRITICAL' && cert.pilotWeek.state === 'NOT_READY')
check('settlement guarantee still passes', cert.productionEvidence.settlementGuarantee === 'PASS' && cert.productionEvidence.silentPendingRows === 0)
check('sample-gated prediction quality is explicit', cert.productionEvidence.currentEraSettledRows === 24 && cert.mediumIssues.includes('prediction_quality_sample_gated_24_settled_current_era_rows'))
check('Mission Control records MC-08H block', status.mc08h?.status === 'PRODUCTION_READINESS_BLOCKED')
check('Mission Control marks pilot not ready', status.mc08h?.productionPilotWeekReady === false)
check('MC-03 not started', cert.mc03Started === false && status.mc08h?.mc03Started === false)
check('Queue marks MC-08H blocked', queue.includes('| MC-08H | Production Readiness Certification | BLOCKED |'))
check('certification explains NO decision', certMd.includes('Production Ready: NO') && certMd.includes('Daily Use Recommendation'))
check('guardrails unchanged', Object.entries(cert.guardrails).filter(([key]) => !key.includes('CertificationReads')).every(([, value]) => value === false || value === 0))

let changed = ''
try {
  changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
} catch {}
const changedFiles = changed.split(/\r?\n/).filter(Boolean)
const forbiddenRuntime = ['src/app/api/', 'src/services/', 'src/lib/providers/', 'supabase/migrations/', 'src/config/']
check('no runtime behavior files changed', !changedFiles.some((file) => forbiddenRuntime.some((prefix) => file.startsWith(prefix))), changedFiles.join(', '))

const failed = checks.filter((item) => !item.pass)
console.log(JSON.stringify({ validator: 'mc08h-production-readiness-certification', checks: checks.length, failures: failed.length, failed }, null, 2))
if (failed.length) process.exit(1)
