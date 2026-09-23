#!/usr/bin/env python3
import concurrent.futures
import importlib.util
import json
from collections import defaultdict
from pathlib import Path

BASE_PATH = Path("scripts/research/mlb_hrrbi_2026_frozen_gate_v1.py")
UNIVERSE_PATH = Path("artifacts/research/mlb_hrrbi_2026_frozen_gate_name_universe_v1.json")

spec = importlib.util.spec_from_file_location("hrrbi_gate", BASE_PATH)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

EXPECTED = {
    "players":516,
    "raw_rows":30889,
    "eligible_rows":25729,
    "runs":{"n":1036,"wins":779},
    "rbi":{"n":1367,"wins":1133},
    "hrrbi":{"n":1255,"wins":1073},
}

def resolve_current():
    source=json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
    official_people,directory=base.official_directory()
    resolved=[]
    unresolved=[]
    for item in source["players"]:
        key=base.normalize_person(item["player_name"])
        matches=directory.get(key,[])
        if len(matches)==1:
            resolved.append({
                "source_player_id":item["player_id"],
                "source_name":item["player_name"],
                "source_team_ids":item.get("team_ids") or [],
                **matches[0],
            })
        else:
            unresolved.append({**item,"matches":matches})
    return resolved,unresolved,len(official_people)

def fetch(players):
    all_rows=[]
    failures=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures={ex.submit(base.batter_game_log,p):p for p in players}
        for fut in concurrent.futures.as_completed(futures):
            p=futures[fut]
            try:
                all_rows.extend(fut.result())
            except Exception as e:
                failures.append({"id":p["id"],"name":p["name"],"error":str(e)[:200]})
    if failures:
        print(json.dumps({"status":"FAIL","failures":failures},indent=2,ensure_ascii=False))
        raise SystemExit(2)
    return all_rows

def player_eligible(rows):
    rows=sorted(rows,key=lambda x:(x["date"],x["gamePk"]))
    out=[]
    for target in rows:
        history=[r for r in rows if r["date"] < target["date"]]
        p=base.project(history)
        if p is None:
            continue
        projection,components=p
        out.append({
            **target,
            "proj_hits":components["hits"],
            "proj_runs":components["runs"],
            "proj_rbi":components["rbi"],
            "projection":projection,
            "actual":target["hits"]+target["runs"]+target["rbi"],
        })
    return out

def stats(rows):
    defs={
        "runs":("proj_runs","runs",0.14,0.5),
        "rbi":("proj_rbi","rbi",0.10,0.5),
        "hrrbi":("projection","actual",0.70,2.5),
    }
    out={"eligible_rows":len(rows)}
    for name,(proj,outcome,threshold,line) in defs.items():
        selected=[r for r in rows if r[proj] <= threshold + 1e-12]
        out[name]={
            "n":len(selected),
            "wins":sum(1 for r in selected if r[outcome] < line),
        }
    return out

def main():
    players,unresolved,official_count=resolve_current()
    if len(players)!=518:
        print(json.dumps({
            "status":"FAIL_CURRENT_EXACT_COUNT",
            "resolved":len(players),"unresolved":unresolved,
        },indent=2,ensure_ascii=False))
        raise SystemExit(2)
    all_rows=fetch(players)
    by=defaultdict(list)
    for r in all_rows:
        by[r["player_id"]].append(r)

    per={}
    all_eligible=[]
    for p in players:
        erows=player_eligible(by[p["id"]])
        all_eligible.extend(erows)
        st=stats(erows)
        per[p["id"]]={
            "player":p,
            "raw_rows":len(by[p["id"]]),
            **st,
        }

    obs={"raw_rows":len(all_rows),**stats(all_eligible)}
    diff={
        "raw_rows":obs["raw_rows"]-EXPECTED["raw_rows"],
        "eligible_rows":obs["eligible_rows"]-EXPECTED["eligible_rows"],
        "runs_n":obs["runs"]["n"]-EXPECTED["runs"]["n"],
        "runs_wins":obs["runs"]["wins"]-EXPECTED["runs"]["wins"],
        "rbi_n":obs["rbi"]["n"]-EXPECTED["rbi"]["n"],
        "rbi_wins":obs["rbi"]["wins"]-EXPECTED["rbi"]["wins"],
        "hrrbi_n":obs["hrrbi"]["n"]-EXPECTED["hrrbi"]["n"],
        "hrrbi_wins":obs["hrrbi"]["wins"]-EXPECTED["hrrbi"]["wins"],
    }
    ids=sorted(per)
    pairs=[]
    for i,a in enumerate(ids):
        A=per[a]
        Avec={
            "raw_rows":A["raw_rows"],"eligible_rows":A["eligible_rows"],
            "runs_n":A["runs"]["n"],"runs_wins":A["runs"]["wins"],
            "rbi_n":A["rbi"]["n"],"rbi_wins":A["rbi"]["wins"],
            "hrrbi_n":A["hrrbi"]["n"],"hrrbi_wins":A["hrrbi"]["wins"],
        }
        for b in ids[i+1:]:
            B=per[b]
            Bvec={
                "raw_rows":B["raw_rows"],"eligible_rows":B["eligible_rows"],
                "runs_n":B["runs"]["n"],"runs_wins":B["runs"]["wins"],
                "rbi_n":B["rbi"]["n"],"rbi_wins":B["rbi"]["wins"],
                "hrrbi_n":B["hrrbi"]["n"],"hrrbi_wins":B["hrrbi"]["wins"],
            }
            if all(Avec[k]+Bvec[k]==diff[k] for k in diff):
                pairs.append({
                    "ids":[a,b],
                    "players":[A["player"],B["player"]],
                    "contributions":[Avec,Bvec],
                })

    result={
        "status":"LINEAGE_PAIR_UNIQUE" if len(pairs)==1 else "LINEAGE_PAIR_NOT_UNIQUE",
        "current_exact_resolved":len(players),
        "unresolved_source_entries":len(unresolved),
        "official_directory_rows":official_count,
        "observed_518":obs,
        "expected_516":EXPECTED,
        "required_removed_contribution":diff,
        "candidate_pair_count":len(pairs),
        "candidate_pairs":pairs[:20],
    }
    print(json.dumps(result,indent=2,sort_keys=True,ensure_ascii=False))
    Path("/tmp/mlb_hrrbi_2026_lineage_recovery_v1.json").write_text(
        json.dumps(result,indent=2,sort_keys=True,ensure_ascii=False)+"\n",
        encoding="utf-8",
    )
    if len(pairs)!=1:
        raise SystemExit(2)

if __name__=="__main__":
    main()
