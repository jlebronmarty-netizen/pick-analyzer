# Day 1 Recommendation Readiness V1

Status: Completed as read-only audit and simulation.

Day 1 Recommendation Readiness audits whether Pick Analyzer can produce the best possible recommendation tomorrow using stored and approved data. The goal is recommendation quality, not more picks. If no bet qualifies, the correct answer is zero bets.

## Pipeline

The audited path is:

Current Board -> Market Intelligence -> Recommendation Policy -> Top Picks -> AI Bet Finder -> Bet Slip -> Dashboard

The readiness service uses Current Board as the shared candidate source, then checks that downstream official surfaces remain gate-protected.

## Current Result

- Current candidates: 3
- Pipeline aligned: true
- Official picks: 0
- Bet Slip: `no_ticket`
- Provider calls: 0
- Remote mutations: 0
- Fixture validation: 20/20
- Excellent-value simulation: `PLAY_OF_DAY_CANDIDATE`

The simulation is in-memory only. It proves that a future production-eligible, fresh, maturely calibrated, high-quality, positive edge/EV row would activate the policy path automatically. It creates no rows and does not promote current previews.

## Current Candidate Quality

All current candidates remain analyzed-only passes because the stored price does not provide positive modeled value and the rows are quarantined. The audit computes for each candidate:

- probability
- confidence
- reliability
- AI rating
- feature quality
- data sufficiency
- market stability
- edge
- EV
- recommendation status
- explanation and blockers

## Threshold Review

The official thresholds remain conservative and appropriate for Day 1:

- minimum official edge: 5 points
- minimum official EV: 5%
- minimum official confidence: 65%
- minimum model probability: 52%
- minimum feature quality: 60
- minimum data sufficiency: 60
- maximum odds age: 120 minutes

A tiny positive edge, such as +0.3%, is not enough to become recommended.

## Missing MLB Domains

- Starting pitcher: Critical, blocked without verified starter context.
- Confirmed lineup: Critical, blocked without verified lineup context.
- Weather: Important, blocked without verified run-environment context.
- Bullpen: Important, partially approximable from stored stats, but verified availability is still missing.
- Props: Critical, blocked without verified prop odds and player-level context.

Do not fabricate any missing domain.

## Tomorrow Checklist

1. Morning: verify no stale import runner, stale lock or duplicate process.
2. Import: capture tomorrow schedule, team stats, player stats and approved safe domains.
3. Odds: capture `GameOddsByDate` and persist quarantined pregame moneyline, run line and total rows.
4. Preview: generate or reuse immutable feature snapshots and analyzed preview predictions.
5. Refresh: rerun Current Board, Market Intelligence, Best Value, Most Likely and AI Bet Finder checks.
6. Final odds: run one bounded final pregame odds refresh before cutoff only.
7. Recommendation gate: let policy decide; zero qualified bets remains correct.
8. Dashboard: verify Top Picks, Play of the Day and Bet Slip reflect official status automatically.
9. Settlement: after final score, refresh results, team stats, player stats, settle previews and produce the technical report.
