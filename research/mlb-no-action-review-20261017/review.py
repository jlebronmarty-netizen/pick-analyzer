"""Independent offline review. No provider requests and no database writes."""
import json, hashlib, pathlib, zipfile, collections
ROOT = pathlib.Path(__file__).resolve().parent
PRIOR = ROOT.parent / 'mlb-open-repair-20261017'
rows = json.loads((ROOT/'pending-before.json').read_text())
manifest = json.loads((PRIOR/'raw-manifest.json').read_text())
rules = json.loads((ROOT/'rule-sources.json').read_text())
assert len(rows) == 73 and len({r['id'] for r in rows}) == 73
decisions = []
with zipfile.ZipFile(PRIOR/'official-raw.zip') as archive:
    assert archive.testzip() is None
    def read(game, kind):
        path = f'raw/{game}-{kind}.json'
        data = archive.read(path)
        assert hashlib.sha256(data).hexdigest() == manifest[path]
        return json.loads(data)
    for row in rows:
        assert row['sportsbook'] in ('betmgm', 'draftkings')
        assert row['market'] in ('batter_doubles', 'batter_walks')
        assert row['direction'] == 'UNDER' and float(row['line']) == 0.5
        assert row['freeze_timestamp'][:10] <= row['target_date']
        game = row['game_pk']
        schedule, box = read(game,'schedule'), read(game,'boxscore')
        matches = [g for d in schedule['dates'] for g in d['games'] if g['gamePk'] == game]
        assert matches and all(str(g['season']) == '2026' for g in matches)
        finals = [g for g in matches if g['status']['statusCode'] == 'F' and g['status']['codedGameState'] == 'F']
        assert len(finals) <= 1
        g = finals[0] if finals else matches[0]
        for side in ('home','away'):
            assert g['teams'][side]['team']['id'] == box['teams'][side]['team']['id']
        proof = {'scheduleSha256':manifest[f'raw/{game}-schedule.json'], 'boxscoreSha256':manifest[f'raw/{game}-boxscore.json']}
        if finals:
            assert g['officialDate'] == row['target_date']
            starters=[]
            for side in ('home','away'):
                lineup=[p for p in box['teams'][side]['players'].values() if str(p.get('battingOrder','')).endswith('00')]
                assert len(lineup)==9
                starters += [p['person']['id'] for p in lineup]
            players=box['teams']['home']['players']|box['teams']['away']['players']
            player=players['ID'+str(row['player_mlbam_id'])]
            batting=player['stats'].get('batting',{})
            started=row['player_mlbam_id'] in starters
            pa=batting.get('plateAppearances')
            # Missing PA alone never means zero. Non-starting is independently
            # established from the complete 18-player official starting lineup.
            if not started:
                reason='DID_NOT_START'
            else:
                assert row['sportsbook']=='betmgm' and pa==0
                reason='STARTED_ZERO_PA'
            proof.update(started=started,battingOrder=player.get('battingOrder'),plateAppearances=pa,officialFinal=True)
        else:
            assert row['sportsbook']=='draftkings' and game==849817
            postponed=[g for g in matches if g['status']['statusCode']=='DR']
            assert len(postponed)==1
            original=postponed[0]['gameDate']
            # Midnight UTC is the preceding local Cleveland calendar day.
            from datetime import datetime
            from zoneinfo import ZoneInfo
            original_day=datetime.fromisoformat(original.replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).date().isoformat()
            assert original_day==row['target_date']
            scheduled=[g for g in matches if g.get('rescheduledFrom')==original]
            assert len(scheduled)==1 and scheduled[0].get('rescheduledFromDate')==row['target_date']
            assert scheduled[0]['gameDate'][:10]>row['target_date']
            reason='POSTPONED_BEFORE_START_DIFFERENT_LOCAL_DAY'
            proof.update(originalStart=original,originalLocalDate=original_day,rescheduledStart=scheduled[0]['gameDate'],officialStatus='Postponed',officialFinal=False)
        decisions.append({**row,'result':'VOID','reason':reason,'policy':rules['policy'],
            'scope':rules['scope'],'originalQuoteJurisdictionCertified':False,'actualBookSettlementCertified':False,'proof':proof})
(ROOT/'reviewed-decisions.json').write_text(json.dumps(decisions,indent=2)+'\n')
print(json.dumps({'status':'PASS','reviewed':len(decisions),'counts':dict(collections.Counter(d['reason'] for d in decisions)),
    'conditionalReferencePolicy':True,'certifiedExecutedBets':False,'providerCalls':0,'databaseWrites':0}))
