import copy
import sqlite3
import unittest

from replay import archive, evaluate


class ReplayTest(unittest.TestCase):
    def setUp(self):
        self.f = dict(league="NCAAB", forecast_id="forecast1", event_id="pick1", model="test",
                      home="Test Home", away="Indiana State Sycamores", margin=5, total=141,
                      scheduled_at="2026-11-20T20:00Z", frozen_at="2026-11-19T12:00Z")
        self.market = dict(key="spreads", last_update="2026-11-20T19:00Z", outcomes=[
            dict(name="Test Home", price=-112, point=1.5),
            dict(name="Indiana St Sycamores", price=-108, point=-1.5)])
        self.event = dict(sport_key="basketball_ncaab", id="provider1",
                          home_team="Test Home", away_team="Indiana St Sycamores",
                          commence_time="2026-11-20T20:10Z",
                          bookmakers=[dict(key="fanduel", markets=[self.market])])
        self.cap = dict(sport_key="basketball_ncaab", captured_at="2026-11-20T19:20Z",
                        events=[self.event])

    def rows(self):
        return evaluate(self.cap, [self.f])[0]

    def test_archive(self):
        with sqlite3.connect(":memory:") as db:
            for _ in range(2):
                self.assertEqual(archive(db, self.cap, [self.f]), {"accepted_groups": 1})
            self.assertEqual(self.rows()[0]["distance"], 6.5)
            self.market["outcomes"][0]["price"] = -110
            with self.assertRaises(ValueError):
                archive(db, self.cap, [self.f])
            self.assertEqual(db.execute("select count(*) from captures").fetchone()[0], 1)

    def test_start_boundary(self):
        self.cap["captured_at"] = self.f["scheduled_at"]
        self.assertFalse(self.rows())

    def test_asof(self):
        self.f["frozen_at"] = "2026-11-20T19:21Z"
        self.assertFalse(self.rows())

    def test_ambiguous(self):
        self.assertFalse(evaluate(self.cap, [self.f, copy.copy(self.f)])[0])

    def test_reversed(self):
        self.f["home"], self.f["away"] = self.f["away"], self.f["home"]
        self.assertFalse(self.rows())

    def test_future_update(self):
        self.market["last_update"] = "2026-11-20T19:21Z"
        self.assertFalse(self.rows())

    def test_bad_spread(self):
        self.market["outcomes"][1]["point"] = 1.5
        self.assertFalse(self.rows())

    def test_total(self):
        self.market.update(key="totals", outcomes=[
            dict(name="Over", point=142.5, price=-110), dict(name="Under", point=142.5, price=-110)])
        self.assertEqual(self.rows()[0]["distance"], -1.5)
        self.market["outcomes"][1]["point"] = 141.5
        self.assertFalse(self.rows())
