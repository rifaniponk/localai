"""Compare variants: python3 compare.py LABEL [LABEL ...] (default: every label in results/)."""
import json
import statistics
import sys
from pathlib import Path

RESULTS = Path(__file__).resolve().parent / "results"


def load(label):
    return [json.loads(p.read_text()) for p in sorted((RESULTS / label).glob("*/metrics.json"))]


labels = sys.argv[1:] or sorted(p.name for p in RESULTS.iterdir() if p.is_dir())
rows = {l: load(l) for l in labels}
common = set.intersection(*[{r["task"] for r in rs} for rs in rows.values() if rs])
print(f"(totals over the {len(common)} tasks every variant ran)")
totals = {l: [r for r in rs if r["task"] in common] for l, rs in rows.items()}
print(f"{'variant':24s} {'runs':>4s} {'pass':>7s} {'wall med':>8s} {'wall sum':>8s} {'calls':>6s} {'tools':>6s} "
      f"{'in/run':>8s} {'out/run':>8s} {'cache%':>6s} {'side':>5s}")
for l, rs in totals.items():
    if not rs:
        continue
    n = len(rs)
    walls = [r["wall_s"] for r in rs]
    inp = sum(r["input"] for r in rs)
    cache = sum(r["cache_read"] for r in rs)
    print(f"{l:24s} {n:4d} {sum(r['passed'] for r in rs):3d}/{n:<3d} {statistics.median(walls):8.1f} {sum(walls):8.0f} "
          f"{sum(r['llm_calls'] for r in rs) / n:6.1f} {sum(r['tool_calls'] for r in rs) / n:6.1f} {inp / n:8.0f} "
          f"{sum(r['output'] for r in rs) / n:8.0f} {100 * cache / max(1, inp + cache):6.1f} "
          f"{sum(r.get('side_requests', 0) for r in rs) / n:5.1f}")

tasks = sorted({r["task"] for rs in rows.values() for r in rs})
print()
print(f"{'task':20s} " + " ".join(f"{l[:22]:>22s}" for l in labels))
for t in tasks:
    cells = []
    for l in labels:
        rs = [r for r in rows[l] if r["task"] == t]
        if not rs:
            cells.append(f"{'-':>22s}")
            continue
        p = sum(r["passed"] for r in rs)
        w = statistics.median(r["wall_s"] for r in rs)
        cells.append(f"{p}/{len(rs)} {w:6.1f}s {sum(r['llm_calls'] for r in rs) / len(rs):4.1f}c".rjust(22))
    print(f"{t:20s} " + " ".join(cells))
