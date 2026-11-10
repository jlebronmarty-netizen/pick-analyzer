import unittest
import evaluate as e
class ReplayTests(unittest.TestCase):
 def game(self,i,date,home='a',away='b',hs=90,vs=80):
  return dict(id=str(i),date=date,season='2026',home_team_id=home,away_team_id=away,home_team=home,away_team=away,home_score=hs,away_score=vs)
 def test_future_and_same_day_dont_change_prior_forecasts(self):
  games=[self.game(1,'2026-01-01'),self.game(2,'2026-01-02'),self.game(3,'2026-01-03'),self.game(4,'2026-01-04'),self.game(5,'2026-01-04'),self.game(6,'2026-01-05')]
  before=e.evaluate(games)
  changed=[dict(g,home_score=10,away_score=99) if g['date']>='2026-01-04' else g for g in games]
  after=e.evaluate(changed)
  for x,y in zip(before,after):
   if x['date']<='2026-01-04':
    for key in ['selectedId','probabilityHome','projectedHome','projectedAway','inputsHome','inputsAway']:
     self.assertEqual(x[key],y[key])
  self.assertTrue(all(r['latestFeatureDate'] is None or r['latestFeatureDate']<r['date'] for r in before))
 def test_warmup_ties_and_new_season(self):
  games=[self.game(i,'2026-01-0'+str(i)) for i in [1,2,3,4]]
  rows=e.evaluate(games)
  self.assertEqual(sum(r['selectedId'] is not None for r in rows if r['policy']=='ELO32_MIN3'),1)
  new=dict(games[-1],id='5',season='2027',date='2027-01-01')
  self.assertEqual([r for r in e.evaluate(games+[new]) if r['eventId']=='5' and r['policy']=='ELO32_MIN3'][0]['reason'],'WARMUP_MIN3')
if __name__=='__main__':unittest.main()
