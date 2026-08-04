#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const checks = []
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8') }
function exists(file) { return fs.existsSync(path.join(root, file)) }
function check(name, pass, detail = '') { checks.push({ name, pass: Boolean(pass), detail }); if (!pass) console.error('FAIL', name, detail) }

const context = read('src/context/PersonalizationContext.tsx')
const home = read('src/components/home/HomeBettingPlan.tsx')
const performance = read('src/components/performance/PerformanceProductClient.tsx')
const settings = read('src/components/settings/PersonalizationSettingsClient.tsx')
const layout = read('src/app/layout.tsx')
const globals = read('src/app/globals.css')
const cert = JSON.parse(read('docs/CERTIFICATION/mc-08f-personalization-experience.json'))

check('contract version exists', context.includes("contractVersion: 'personalization_v1'") && cert.contractVersion === 'personalization_v1')
check('local storage key exists', context.includes('pick-analyzer.personalization.v1'))
check('language supports EN ES', context.includes("'EN' | 'ES'") && context.includes('translations') && context.includes('ES:'))
check('appearance supports system light dark', context.includes("'SYSTEM' | 'LIGHT' | 'DARK'") && globals.includes('html.pa-light') && globals.includes('html.pa-dark'))
check('layout provider installed', layout.includes('PersonalizationProvider') && layout.includes('suppressHydrationWarning'))
check('canonical timezone default', context.includes('America/Puerto_Rico') && cert.features.defaultTimezone === 'America/Puerto_Rico')
check('display timezone formatter used', home.includes('formatDateTimeValue') && performance.includes('formatDateTimeValue'))
check('odds formatter used', home.includes('formatOddsValue') && settings.includes('formatOdds'))
check('preferred sports teams bounded', context.includes('SUPPORTED_SPORTS') && context.includes('SUPPORTED_TEAMS') && settings.includes('data-mc08f-preferred-teams'))
check('homepage density and advanced evidence', context.includes('homepageDensity') && context.includes('showAdvancedEvidence') && home.includes('preferences.homepageDensity') && home.includes('showAdvancedEvidence'))
check('homepage personalized marker', home.includes('data-mc08f-homepage-personalized'))
check('settings route exists', exists('src/app/settings/page.tsx') && settings.includes('data-mc08f-settings'))
check('performance personalized marker', performance.includes('data-mc08f-performance-personalized'))
check('settings says local profile limitation', settings.includes('anonymousOnly') && cert.persistence.localStorage === 'ACTIVE')
check('provider calls documented zero', cert.certificationReads.providerCallsMade === 0)
check('remote mutations documented zero', cert.certificationReads.remoteMutationsMade === 0)
check('prediction behavior unchanged certified', Object.entries(cert.behaviorChanges).every(([, value]) => value === false))
check('mc08g not started', cert.mc08gStarted === false)
check('mc03 not started', cert.mc03Started === false)

const forbiddenRuntime = ['src/services/', 'src/app/api/', 'supabase/migrations/', 'src/lib/providers/', 'src/services/prediction', 'src/services/settlement', 'src/services/learning']
let changed = ''
try { changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }) } catch {}
const changedFiles = changed.split(/\r?\n/).filter(Boolean)
check('no forbidden runtime paths changed', !changedFiles.some((file) => forbiddenRuntime.some((prefix) => file.startsWith(prefix))), changedFiles.join(', '))

const failed = checks.filter((item) => !item.pass)
console.log(JSON.stringify({ validator: 'mc08f-personalization-experience', checks: checks.length, failures: failed.length, failed }, null, 2))
if (failed.length) process.exit(1)
