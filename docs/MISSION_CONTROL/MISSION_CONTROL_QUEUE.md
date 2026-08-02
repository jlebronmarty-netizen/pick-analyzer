# Mission Control Queue

Status: deterministic V2 queue.

No queued mission is ACTIVE in Mission Control V1.

| ID | Mission | Category | Priority | State | Mode | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| MC-00 | Mission Control Foundation | AUTOMATION | P0 | DEPLOYED | READ_ONLY | Production-certify Mission Control surfaces. |
| MC-01 | Operational Readiness Closure | OPERATIONAL_READINESS | P1 | READY | AGENT_ASSISTED | Run bounded operational-readiness certification. |
| MC-02 | Multi-Sport Data Readiness | MULTI_SPORT_DATA | P1 | READY | AGENT_ASSISTED | Certify sport-by-sport canonical data readiness. |
| MC-03 | Multi-Sport Prediction Activation | MULTI_SPORT_PREDICTION | P2 | PLANNED | MANUAL_ONLY | Wait for MC-02 and human approval. |
| MC-04 | Multi-Sport Settlement And Learning | SETTLEMENT_AND_LEARNING | P2 | PLANNED | AGENT_ASSISTED | Extend settlement only where canonical results exist. |
| MC-05 | Performance Intelligence | PERFORMANCE_INTELLIGENCE | P2 | PLANNED | AGENT_ASSISTED | Advance after eligible settled samples exist. |
| MC-06 | Decision Core Evolution | DECISION_CORE_EVOLUTION | P3 | PLANNED | MANUAL_ONLY | Use controlled experimentation only. |
| MC-07 | Market Expansion | MARKET_EXPANSION | P3 | PLANNED | AGENT_ASSISTED | Keep unsupported markets unavailable until all gates pass. |
| MC-08 | Daily Betting Product Completion | PRODUCT_EXPERIENCE | P2 | READY | AGENT_ASSISTED | Continue UX polish without model-policy changes. |
| MC-09 | Autonomous Operations | AUTOMATION | P2 | PLANNED | EXTERNAL_WAIT | Observe scheduler and provider evidence. |
| MC-10 | Final Certification | CERTIFICATION | P4 | PLANNED | MANUAL_ONLY | Certify after prior missions close. |

Next recommended mission after MC-00 certification: MC-01 Operational Readiness Closure.
