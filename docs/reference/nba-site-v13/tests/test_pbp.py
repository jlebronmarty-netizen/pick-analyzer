"""Exercise the unmodified v13 compiler with generated, non-personal input."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

compiler = Path(__file__).resolve().parents[1] / 'maintenance/nba/reconcile.py'

class Reconciliation(unittest.TestCase):
    def compile(self, case):
        game = dict(period=5, status='Final', home_team_score=12, visitor_team_score=10,
                    datetime='2026-01-01T00:00:00Z', home_team_id=1, visitor_team_id=2)
        for quarter in ['q1', 'q2', 'q3', 'q4', 'ot1']:
            game['home_' + quarter] = 4 if quarter == 'ot1' else 2
            game['visitor_' + quarter] = 2
        box = dict(id=1, game=game, at=game['datetime'],
                   players=[[7,1,'15:00',2,0,1,0,0,0,0]])
        play = dict(id=1, at=box['at'], unique_order=True, ended=0,
                    terminal=['End Period',5,'0.0',12,10],
                    ends=[[1,2,2],[2,4,4],[3,6,6],[4,8,8],[5,12,10]],
                    rows=[[5,7,2,0,0,0,0,0,0,True]])
        case(play)
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            for name, value in [('nbab0',box),('nbap0',play)]:
                (folder / (name+'.json')).write_text(json.dumps([value]))
            out = folder/'output.json'
            subprocess.run([sys.executable,str(compiler),tmp,str(out)],check=True,capture_output=True)
            return json.loads(out.read_text())['games'][0]['periods']

    def test_overtime_attribution(self):
        p = self.compile(lambda _: None)['7']
        self.assertEqual(p['2H'], [2,0,None,0,0,0,0])
        self.assertNotIn('Q4', p)
        self.assertNotIn('1H', p)

    def test_incomplete_sequences(self):
        for change in [lambda p:p['ends'].pop(1),
                       lambda p:p['terminal'].__setitem__(2,'0:01'),
                       lambda p:p.update(unique_order=False),
                       lambda p:p['ends'][1].__setitem__(1,5)]:
            with self.subTest(change=change):
                self.assertEqual(self.compile(change), {})

if __name__ == '__main__':
    unittest.main()
