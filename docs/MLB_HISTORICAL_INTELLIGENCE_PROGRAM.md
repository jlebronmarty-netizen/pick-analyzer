PICK ANALYZER

MLB HISTORICAL INTELLIGENCE PROGRAM

MASTER PROGRAM

==================================================

VISION

Pick Analyzer has completed its first generation.

Infrastructure is considered production-ready.

The next objective is no longer building systems.

The objective is building knowledge.

Historical baseball data becomes one of the project's most valuable long-term assets.

Every future model, prediction, simulation, player prop and AI explanation will depend on the quality of this historical intelligence layer.

Therefore:

Correctness is more important than speed.

Historical fidelity is more important than parser performance.

Traceability is more important than convenience.

Nothing should be derived without provenance.

==================================================

CURRENT PROJECT STATUS

Production systems considered stable:

✓ Market Pipeline

✓ Current Board

✓ Most Likely

✓ Best Value

✓ AI Feed

✓ Projected Scores

✓ Learning Brain

✓ Performance V2

✓ Settlement

✓ Prediction Engine

✓ Feature Store

✓ Historical Import Engine

These systems are now considered baseline.

Historical Intelligence must integrate with them.

It must NOT redesign them.

==================================================

PROGRAM STRUCTURE

PHASE 1

Historical Data Lake Core

Goal

Create the complete Retrosheet ingestion foundation.

Deliverables

Source inventory

Parser

Raw Data Lake

Canonical Teams

Canonical Players

Canonical Events

Game Metadata

Lineups

Starters

Substitutions

Play-by-play

Pitcher Appearances

Batter Appearances

Import Jobs

Checkpoint Engine

Import Registry

Idempotency

Validation

Parser Fixtures

Historical APIs

Admin Diagnostics

Documentation

End of phase.

STOP.

Return engineering report.

Wait for approval.

--------------------------------------------------

PHASE 1.5

Historical Coverage Audit

Analyze imported data.

Produce:

Coverage

Missing data

Derivable features

Non-derivable features

Historical quality

Future opportunities

Top 25 historical features now possible.

STOP.

Return report.

Wait for approval.

--------------------------------------------------

PHASE 2

Historical Intelligence

Goal

Transform historical data into baseball intelligence.

Deliverables

Bullpen Engine

Pitcher History

Batter History

Matchup Engine

Team History

Rolling Features

Historical Feature Store

Historical APIs

Historical Dashboards

Historical Diagnostics

Historical Quality

STOP.

Return report.

Wait for approval.

--------------------------------------------------

PHASE 3

Learning Brain Integration

Goal

Connect Historical Intelligence to Learning Brain.

Deliverables

Historical Feature Integration

Historical Pitcher Dataset

Historical Batter Dataset

Historical Bullpen Dataset

Replay Engine

Historical Backtesting

Historical Calibration

Historical Training Dataset

Leakage Validation

Learning Diagnostics

STOP.

Return report.

Wait for approval.

--------------------------------------------------

PHASE 4

Statcast Intelligence

Goal

Create second historical source.

Deliverables

Statcast Importer

Pitch Metrics

Exit Velocity

Launch Angle

Barrel%

Whiff%

Pitch Mix

Stuff Metrics

Pitch Feature Store

Statcast APIs

Learning Integration

Historical Diagnostics

STOP.

Return report.

Wait for approval.

==================================================

GLOBAL PRINCIPLES

Historical data is one of the project's strategic assets.

Optimization priorities

1.

Data Quality

2.

Historical Completeness

3.

Identity Correctness

4.

Feature Richness

5.

Import Speed

Parser speed is NOT the objective.

Historical correctness IS.

==================================================

DATA PHILOSOPHY

Always determine:

What data exists.

What data can be derived.

What data cannot be derived.

Never derive unsupported baseball statistics.

Every derived feature must preserve lineage.

Every feature must include:

Source

Version

Import

Confidence

Cutoff semantics

Historical availability

==================================================

RAW DATA POLICY

Never destroy source semantics.

Store separately:

Raw Records

↓

Normalized Records

↓

Derived Statistics

↓

Features

Future parsers:

Retrosheet

Statcast

Lahman

FanGraphs (if legally available)

MLB Official

must reuse the same raw architecture.

==================================================

MULTI-SPORT POLICY

Historical schemas must be reusable.

Do not hardcode MLB into shared infrastructure.

MLB logic belongs only in MLB adapters.

==================================================

PHASE REPORT

Every phase must return

Coverage Score

Data Quality Score

Import Completeness

Learning Readiness

Remaining Risks

Top 25 new feature opportunities

Engineering report

Certification

Then STOP.

Never continue automatically.

==================================================

SUCCESS METRIC

The objective is NOT to finish four phases quickly.

The objective is to create the highest-quality historical baseball dataset possible.

This dataset will become the foundation of Pick Analyzer for years.