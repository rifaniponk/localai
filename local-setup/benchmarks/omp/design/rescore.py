#!/usr/bin/env python3
"""rescore.py COND... -- re-audit every web run with the current ui-audit and print a comparison table."""
import json, os, subprocess, sys
from collections import defaultdict
B = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(B))), "agents", "omp", "skills", "ui-design", "scripts", "ui-audit.mjs")
conds = sys.argv[1:]
rows = defaultdict(dict)
for c in conds:
    meta = {}
    for line in open(f"{B}/results/{c}.jsonl"):
        r = json.loads(line); meta[(r["task"], r["sample"])] = r
    for run in sorted(os.listdir(f"{B}/runs/{c}")):
        task, k = run.rsplit("-", 1); k = int(k)
        d = f"{B}/runs/{c}/{run}"; m = meta.get((task, k), {})
        r = {"seconds": m.get("seconds"), "timed_out": m.get("timed_out", False)}
        if task == "egui":
            r.update(compiles=m.get("compiles"), compile_errors=m.get("compile_errors"))
        elif os.path.exists(f"{d}/index.html"):
            a = subprocess.run(["node", AUDIT, f"{d}/index.html", "--shots", f"{d}/shots", "--json"],
                               capture_output=True, text=True, timeout=120)
            rep = json.loads(a.stdout)
            iss = [i for v in rep["views"] for i in v["issues"]]
            r.update(high=sum(i["sev"] == "high" for i in iss), med=sum(i["sev"] == "med" for i in iss),
                     low=sum(i["sev"] == "low" for i in iss), js_errors=len(set(rep["consoleErrors"])),
                     sizes=len(rep["views"][0]["stats"].get("fontSizes", [])),
                     svg=rep["views"][0]["stats"].get("svgIcons", 0),
                     kinds=sorted({i["kind"] for i in iss if i["sev"] != "low"}))
        else:
            r.update(missing=True)
        rows[(task, k)][c] = r
json.dump({f"{t}-{k}": v for (t, k), v in rows.items()}, open(f"{B}/results/rescore-{'-'.join(conds)}.json", "w"), indent=1)
def agg(c, key, tasks=None):
    vals = [v[c].get(key) for (t, k), v in rows.items() if c in v and (tasks is None or t in tasks) and v[c].get(key) is not None]
    return vals
web = {"landing", "dashboard", "settings", "mobile"}
print(f"{'run':<14}" + "".join(f"{c:>34}" for c in conds))
for (t, k) in sorted(rows):
    cells = []
    for c in conds:
        r = rows[(t, k)].get(c, {})
        if t == "egui":
            s = f"{'builds' if r.get('compiles') else 'FAILS'} ({r.get('compile_errors')} err) {r.get('seconds')}s"
        elif r.get("missing"):
            s = "no page"
        else:
            s = f"H{r.get('high')} M{r.get('med')} L{r.get('low')} sz{r.get('sizes')} {r.get('seconds')}s"
        if r.get("timed_out"): s += " TIMEOUT"
        cells.append(f"{s:>34}")
    print(f"{t+'-'+str(k):<14}" + "".join(cells))
print()
for c in conds:
    h, m, l = (sum(agg(c, x, web)) for x in ("high", "med", "low"))
    n = len(agg(c, "high", web))
    secs = agg(c, "seconds")
    print(f"{c}: web pages {n} | high {h} | med {m} | low {l} | avg font sizes {sum(agg(c,'sizes',web))/max(n,1):.1f} | "
          f"timeouts {sum(1 for x in agg(c,'timed_out') if x)} | egui builds {sum(1 for x in agg(c,'compiles') if x)}/{len(agg(c,'compiles'))} | "
          f"avg time {sum(secs)/max(len(secs),1):.0f}s")
