"""Write results/runs.csv: one row of numbers per run, from results/<label>/<task>-<rep>/metrics.json.

The raw run folders (events, requests, the task repos) stay out of the repo: they hold local paths and tool output.
"""
import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIELDS = ["label", "task", "rep", "passed", "wall_s", "llm_calls", "tool_calls", "input", "output", "cache_read",
          "max_input", "http_requests", "side_requests", "llm_s", "ttft_s"]

rows = []
for p in sorted((HERE / "results").glob("*/*/metrics.json")):
    m = json.loads(p.read_text())
    rows.append({k: (round(m[k], 2) if isinstance(m.get(k), float) else m.get(k)) for k in FIELDS})
with open(HERE / "results" / "runs.csv", "w", newline="") as f:
    w = csv.DictWriter(f, FIELDS)
    w.writeheader()
    w.writerows(rows)
print(f"{len(rows)} runs -> results/runs.csv")
