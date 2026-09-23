#!/usr/bin/env python3
import concurrent.futures
import itertools
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

UNIVERSE_PATH=Path("artifacts/research/mlb_hrrbi_2026_frozen_gate_name_universe_v1.json")
OUT=Path("/tmp/mlb_hrrbi_2026_lineage_recovery_v2.json")
WINDOW_START="2026-03-26"
WINDOW_END="2026-07-19"
EXPECTED={
 "players":516,"raw_rows":30889,"eligible_rows":25729,
 "runs_n":1036,"runs_wins":779,
 "rbi_n":1367,"rbi_wins":1133,
 "hrrbi_n":1255,"hrrbi_wins":1073,
}
DIMS=("raw_rows","eligible_rows","runs_n","runs_wins","rbi_n","rbi_wins","hrrbi_n","hrrbi_wins")

def emit(x):
 s=json.dumps(x,indent=2,sort_keys=True,ensure_ascii=False)
 print(s); OUT.write_text(s+"\n",encoding="utf-8")

def fail(error,**kw):
 emit({"status":"FAIL_CLOSED","error":error,**kw}); raise SystemExit(2)

def get_json(url,timeout=30):
 req=urllib.request.Request(url,headers={"User-Agent":"PickAnalyzerResearch/1.0"})
 with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)

def norm(v):
 s=str(v or "").strip()
 if "," in s:
  p=s.split(",");s=",".join(p[1:]).strip()+" "+p[0].strip()
 s=unicodedata.normalize("NFKD",s)
 s="".join(ch for ch in s if not unicodedata.combining(ch)).lower()
 s=re.sub(r"\b(jr|sr|ii|iii|iv)\b","",s)
 return re.sub(r"[^a-z0-9]+","",s)

def official_directory():
 people=get_json("https://statsapi.mlb.com/api/v1/sports/1/players?season=2026&gameType=R").get("people") or []
 d=defaultdict(list)
 for p in people:
  pid=int(p.get("id") or 0); name=str(p.get("fullName") or "").strip(); k=norm(name)
  if pid and name and k and all(x["id"]!=pid for x in d[k]):d[k].append({"id":pid,"name":name})
 teams=get_json("https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026").get("teams") or []
 team_abbr={int(t["id"]):str(t.get("abbreviation") or "").upper() for t in teams if t.get("id")}
 return people,d,team_abbr

def person_team(pid,team_abbr):
 p=(get_json(f"https://statsapi.mlb.com/api/v1/people/{pid}?hydrate=currentTeam").get("people") or [{}])[0]
 tid=int((p.get("currentTeam") or {}).get("id") or 0)
 return team_abbr.get(tid,"")

def resolve_all522():
 src=json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
 people,directory,team_abbr=official_directory()
 resolved=[]; unresolved=[]
 for item in src["players"]:
  k=norm(item["player_name"]); matches=directory.get(k,[])
  if len(matches)==1:
   resolved.append({**matches[0],"source":item,"identity_method":"UNIQUE_EXACT_NORMALIZED_NAME"})
   continue
  raw_exact=[m for m in matches if str(m["name"]).strip()==str(item["player_name"]).strip()]
  if len(raw_exact)==1:
   resolved.append({**raw_exact[0],"source":item,"identity_method":"EXACT_RAW_FULL_NAME_WITHIN_NORMALIZED_BUCKET"})
   continue
  source_teams=set(str(x).upper() for x in (item.get("team_abbreviations") or []))
  team_matches=[]
  for m in matches:
   abbr=person_team(m["id"],team_abbr)
   if abbr and abbr in source_teams: team_matches.append({**m,"official_team":abbr})
  if len(team_matches)==1:
   resolved.append({**team_matches[0],"source":item,"identity_method":"EXACT_NORMALIZED_NAME_PLUS_EXACT_TEAM"})
  else:
   unresolved.append({"source":item,"normalized":k,"matches":matches,"raw_exact":raw_exact,"team_matches":team_matches})
 if unresolved or len(resolved)!=522 or len({x["id"] for x in resolved})!=522:
  fail("ALL_522_EXACT_IDENTITY_RECOVERY_FAIL",resolved=len(resolved),unique_ids=len({x["id"] for x in resolved}),unresolved=unresolved)
 return resolved,len(people)

def game_log(player):
 pid=player["id"]
 qs=urllib.parse.urlencode({"stats":"gameLog","group":"hitting","season":"2026"})
 payload=get_json(f"https://statsapi.mlb.com/api/v1/people/{pid}/stats?{qs}")
 splits=[]
 for b in payload.get("stats") or []:splits.extend(b.get("splits") or [])
 rows=[]
 for s in splits:
  g=s.get("game") or {};st=s.get("stat") or {}
  pk=int(g.get("gamePk") or 0);date=str(s.get("date") or "")[:10]
  if not pk or not date or date<WINDOW_START or date>WINDOW_END:continue
  def n(k):
   try:return float(st.get(k) or 0)
   except:return 0.0
  rows.append({"player_id":pid,"date":date,"gamePk":pk,"pa":n("plateAppearances"),"hits":n("hits"),"runs":n("runs"),"rbi":n("rbi")})
 rows.sort(key=lambda r:(r["date"],r["gamePk"]))
 return rows

def fetch(players):
 out=[];failures=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  fm={ex.submit(game_log,p):p for p in players}
  for f in concurrent.futures.as_completed(fm):
   p=fm[f]
   try:out.extend(f.result())
   except Exception as e:failures.append({"id":p["id"],"name":p["name"],"error":str(e)[:200]})
 if failures:fail("GAMELOG_FETCH_FAIL",failures=failures)
 return out

def eligible_for(rows):
 rows=sorted(rows,key=lambda r:(r["date"],r["gamePk"]));out=[]
 for t in rows:
  h=[r for r in rows if r["date"]<t["date"]]
  if len(h)<10:continue
  pa=sum(r["pa"] for r in h)
  if pa<=0:continue
  l10=h[-10:];lpa=sum(r["pa"] for r in l10)/len(l10)
  comps={}
  for k in ("hits","runs","rbi"):
   prior=sum(r[k] for r in h);recent=sum(r[k] for r in l10)/len(l10)
   comps[k]=.5*((prior/pa)*lpa)+.5*recent
  out.append({**t,"proj_hits":comps["hits"],"proj_runs":comps["runs"],"proj_rbi":comps["rbi"],"proj_hrrbi":sum(comps.values()),"actual_hrrbi":t["hits"]+t["runs"]+t["rbi"]})
 return out

def vector(raw,eligible):
 def sw(proj,outcome,thr,line):
  s=[r for r in eligible if r[proj]<=thr+1e-12];return len(s),sum(1 for r in s if r[outcome]<line)
 rn,rw=sw("proj_runs","runs",.14,.5);in_,iw=sw("proj_rbi","rbi",.10,.5);hn,hw=sw("proj_hrrbi","actual_hrrbi",.70,2.5)
 return {"raw_rows":len(raw),"eligible_rows":len(eligible),"runs_n":rn,"runs_wins":rw,"rbi_n":in_,"rbi_wins":iw,"hrrbi_n":hn,"hrrbi_wins":hw}

def tup(v):return tuple(v[k] for k in DIMS)

def main():
 players,official_count=resolve_all522();by={p["id"]:p for p in players}
 allraw=fetch(players);raw_by=defaultdict(list)
 for r in allraw:raw_by[r["player_id"]].append(r)
 per={};all_el=[]
 for p in players:
  el=eligible_for(raw_by[p["id"]]);all_el.extend(el);per[p["id"]]=vector(raw_by[p["id"]],el)
 observed=vector(allraw,all_el)
 target={k:observed[k]-EXPECTED[k] for k in DIMS}
 if any(v<0 for v in target.values()):
  fail("CURRENT_522_BELOW_FROZEN_CHECKSUM",observed=observed,expected=EXPECTED,target_removed=target)
 candidates=[pid for pid,v in per.items() if all(v[k]<=target[k] for k in DIMS)]
 triples={}
 for comb in itertools.combinations(candidates,3):
  sv=tuple(sum(per[x][k] for x in comb) for k in DIMS)
  if all(sv[i]<=target[DIMS[i]] for i in range(len(DIMS))):
   triples.setdefault(sv,[]).append(comb)
 target_t=tup(target);solutions=[]
 seen=set()
 for sv,cs in triples.items():
  comp=tuple(target_t[i]-sv[i] for i in range(len(DIMS)))
  if comp not in triples:continue
  for a in cs:
   sa=set(a)
   for b in triples[comp]:
    if sa.isdisjoint(b):
     sol=tuple(sorted(a+b))
     if sol not in seen:
      seen.add(sol);solutions.append(sol)
 if len(solutions)!=1:
  fail("FROZEN_516_EXCLUSION_SET_NOT_UNIQUE",observed_522=observed,target_removed=target,candidate_players=len(candidates),triple_vectors=len(triples),solution_count=len(solutions),solutions=[list(x) for x in solutions[:20]])
 excluded=set(solutions[0]);fplayers=[p for p in players if p["id"] not in excluded];fraw=[r for r in allraw if r["player_id"] not in excluded];fel=[r for r in all_el if r["player_id"] not in excluded];final=vector(fraw,fel)
 if len(fplayers)!=516 or any(final[k]!=EXPECTED[k] for k in DIMS):
  fail("FROZEN_516_FINAL_PARITY_FAIL",players=len(fplayers),final=final,expected=EXPECTED)
 emit({"status":"EXACT_FROZEN_516_LINEAGE_RECOVERED","official_directory_rows":official_count,"all_522":observed,"target_removed":target,"excluded":[{"id":pid,"name":by[pid]["name"],"source":by[pid]["source"],"contribution":per[pid]} for pid in sorted(excluded)],"frozen_516":final,"frozen_player_ids":[p["id"] for p in fplayers],"identity_methods":{m:sum(1 for p in players if p["identity_method"]==m) for m in set(p["identity_method"] for p in players)}})

if __name__=="__main__":main()
