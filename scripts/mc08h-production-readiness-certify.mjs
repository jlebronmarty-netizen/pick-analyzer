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
const pilotStartedOrReady =
  (status.productionPilotWeek?.state === 'READY' && status.productionPilotWeek?.started === false) ||
  (status.productionPilotWeek?.state === 'ACTIVE' && status.productionPilotWeek?.started === true && status.productionPilotWeek?.currentPilotDay >= 1)

check('MC-08H certification markdown exists', exists('docs/CERTIFICATION/MC_08H_PRODUCTION_READINESS_CERTIFICATION.md'))
check('MC-08H mission markdown exists', exists('docs/MISSION_CONTROL/MC_08H_PRODUCTION_READINESS_CERTIFICATION.md'))
check('MC-08H JSON exists', exists('docs/CERTIFICATION/mc-08h-production-readiness-certification.json'))
check('production readiness is certified', cert.status === 'PRODUCTION_READY' && cert.productionReady === true)
check('readiness percent is bounded', cert.productionReadinessPercent >= 0 && cert.productionReadinessPercent <= 100)
check('critical blockers cleared', cert.issueCounts.critical === 0 && cert.criticalIssues.length === 0)
check('operations evidence opens pilot', cert.productionEvidence.operationsHealthStatus === 'HEALTHY' && cert.pilotWeek.state === 'READY' && cert.pilotWeek.started === false)
check('settlement guarantee still passes', cert.productionEvidence.settlementGuarantee === 'PASS' && cert.productionEvidence.silentPendingRows === 0)
check('sample-gated prediction quality is explicit', cert.mediumIssues.includes('prediction_quality_sample_gated_limited_current_era_rows'))
check('Mission Control records MC-08H production readiness', status.mc08h?.status === 'PRODUCTION_READY')
check('Mission Control marks pilot ready or active', status.mc08h?.productionPilotWeekReady === true && pilotStartedOrReady)
check('MC-03 not started', cert.mc03Started === false && status.mc08h?.mc03Started === false)
check('Queue marks Production Pilot Week ready or active', queue.includes('| Production Pilot Week | Real-world validation before Multi-Sport Expansion | READY |') || queue.includes('| Production Pilot Week | Real-world validation before Multi-Sport Expansion | ACTIVE |'))
check('certification explains YES decision', certMd.includes('Production Ready: YES') && certMd.includes('Daily Use Recommendation'))
check('guardrails unchanged', Object.entries(cert.guardrails).filter(([key]) => !key.includes('CertificationReads')).every(([, value]) => value === false || value === 0))

let changed = ''
try {
  changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
} catch {}
const changedFiles = changed.split(/\r?\n/).filter(Boolean)
const forbiddenRuntime = ['src/app/api/', 'src/lib/providers/', 'supabase/migrations/', 'src/config/']
const allowedRuntime = new Set(['src/services/mission-control.service.ts'])
check('no runtime behavior files changed', !changedFiles.some((file) => !allowedRuntime.has(file) && forbiddenRuntime.some((prefix) => file.startsWith(prefix))), changedFiles.join(', '))
check('Mission Control API overlay is the only service change', changedFiles.filter((file) => file.startsWith('src/services/')).every((file) => allowedRuntime.has(file)), changedFiles.join(', '))

const failed = checks.filter((item) => !item.pass)
console.log(JSON.stringify({ validator: 'mc08h-production-readiness-certification', checks: checks.length, failures: failed.length, failed }, null, 2))
if (failed.length) process.exit(1)
