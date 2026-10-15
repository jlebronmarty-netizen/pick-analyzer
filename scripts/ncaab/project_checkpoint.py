"""Reproduce the read-only display projection from exact published source bytes.
Usage: python scripts/ncaab/project_checkpoint.py PRESEASON_JSON V11_JSON OUTPUT_JSON
The source files must match the frozen delivery manifest; never rewrites the source.
"""
import hashlib
import json
import sys
from pathlib import Path

EXPECTED = [
    '7cbfce2daa127fe7d6f5cec16ff88e1faec0b6b24a8e693a66b6904af3e937a7',
    '4d0e6ff6ad933b2f8420f6736ff8a85cbf9096d8f89da4ce250cbd85107d1fbe',
]

def project(paths):
    sources = []
    for filename, expected in zip(paths, EXPECTED):
        raw = Path(filename).read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('Source SHA256 mismatch: ' + filename)
        sources.append(json.loads(raw))
    s, v = sources
    fields = ['event_id', 'home_id', 'away_id', 'home_name', 'away_name',
              'scheduled_at', 'state', 'reason', 'home_score', 'away_score',
              'home_win_probability', 'away_win_probability', 'predicted_winner',
              'projected_total', 'projected_margin']
    rows = [{k: r.get(k) for k in fields} for r in s['attempts']]
    forecasts = {r['event_id']: r for r in s['forecasts']}
    for r in rows:
        f = forecasts.get(r['event_id'])
        r['created_at'] = f['created_at'] if f else None
        r['settlement'] = f['settlement'] if f else None
        r['review_required'] = f['review_required'] if f else False
    def metrics(source, abstentions):
        m = source['metrics']
        return {'id': source['version'], 'forecasts': source['forecast_count'],
                'abstentions': abstentions, 'settled': m['settled'],
                'wins': m['correct_winners'], 'winnerDenominator': m['winner_denominator'],
                'accuracy': m['winner_accuracy']}
    return {'schemaVersion': 1, 'sport': 'NCAAB',
            'sourceCommit': 'c451d9fc9767bbeff751e26e631fe0b48579fe75',
            'sourceRepository': 'jlebronmarty-netizen/sports-edge-hub',
            'sourceHashes': {'preseason': EXPECTED[0], 'inSeason': EXPECTED[1]},
            'generatedAt': s['generated_at'], 'connection': 'PUBLISHED_CHECKPOINT',
            'continuousSync': False, 'modelValidated': False,
            'hostedPipelineReady': False, 'oddsRoiClv': 'DEFERRED',
            'models': [metrics(s, s['abstentions']), metrics(v, v['daily_abstentions'])],
            'observations': rows}

if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    output = Path(sys.argv[3])
    if output.resolve() in {Path(p).resolve() for p in sys.argv[1:3]}:
        raise ValueError('Output must not overwrite either source')
    output.write_text(json.dumps(project(sys.argv[1:3]), ensure_ascii=False, indent=2) + '\n')
