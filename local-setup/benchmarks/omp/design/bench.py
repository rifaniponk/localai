#!/usr/bin/env python3
"""bench.py LABEL SAMPLES [task,...] -- run omp on each design task, then audit/screenshot the result.

Env: BENCH_TOOLS (omp --tools list, default read,write,edit,glob), BENCH_LIMIT (seconds per run, default 600),
BENCH_START (first sample number), OMP (omp binary, default from PATH), OMP_EXTRA (JSON list of extra omp args).
Writes runs/LABEL/TASK-N/ (page, screenshots, audit.json, omp.log) and results/LABEL.jsonl.
"""
import json, os, shutil, subprocess, sys, time
B = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(B))), "agents", "omp", "skills", "ui-design", "scripts", "ui-audit.mjs")
cond, samples = sys.argv[1], int(sys.argv[2])
tasks = json.load(open(f"{B}/tasks.json"))
only = sys.argv[3].split(",") if len(sys.argv) > 3 else list(tasks)
extra = json.loads(os.environ.get("OMP_EXTRA", "[]"))
OMP = os.environ.get("OMP") or shutil.which("omp") or "omp"
LIMIT = int(os.environ.get("BENCH_LIMIT", "600"))  # seconds per run
env = dict(os.environ, PATH=os.path.expanduser("~/.cargo/bin") + ":" + os.environ["PATH"],
           CARGO_TARGET_DIR=f"{B}/egui-target")
results = []
for name in only:
    for k in range(int(os.environ.get("BENCH_START", "1")), samples + 1):
        d = f"{B}/runs/{cond}/{name}-{k}"
        shutil.rmtree(d, ignore_errors=True)
        if name == "egui":
            shutil.copytree(f"{B}/egui-template", d)
        else:
            os.makedirs(d)
        t0 = time.time()
        timed_out = False
        with open(f"{d}/omp.log", "w") as log:
            proc = subprocess.Popen([OMP, "-p", "--no-session", "--no-title", "--tools=" + os.environ.get("BENCH_TOOLS", "read,write,edit,glob"), *extra,
                                     tasks[name]], cwd=d, stdin=subprocess.DEVNULL, stdout=log,
                                    stderr=subprocess.STDOUT)
            try:
                rc = proc.wait(timeout=LIMIT)
            except subprocess.TimeoutExpired:
                # A looping agent is a result, not a crash: stop it and score what it wrote.
                proc.kill(); proc.wait(); rc = None; timed_out = True
        r = {"cond": cond, "task": name, "sample": k, "seconds": round(time.time() - t0), "rc": rc,
             "timed_out": timed_out}
        if name == "egui":
            b = subprocess.run(["cargo", "build", "--release", "--quiet"], cwd=d, env=env,
                               capture_output=True, text=True)
            open(f"{d}/build.log", "w").write(b.stderr)
            r["compiles"] = b.returncode == 0
            r["compile_errors"] = b.stderr.count("error[") + b.stderr.count("error:") - (1 if b.returncode else 0)
            if r["compiles"]:
                shutil.copy(f"{B}/egui-target/release/pulse", f"{d}/pulse")
                o = subprocess.run(["python3", "-I", f"{B}/eshot.py", f"{d}/pulse", f"{d}/shot.png"],
                                   capture_output=True, text=True, timeout=120)
                r["runs"] = o.stdout.strip()
        else:
            page = f"{d}/index.html"
            r["has_page"] = os.path.exists(page)
            if r["has_page"]:
                a = subprocess.run(["node", AUDIT, page, "--shots", f"{d}/shots", "--json"],
                                   capture_output=True, text=True, timeout=120)
                rep = json.loads(a.stdout)
                json.dump(rep, open(f"{d}/audit.json", "w"), indent=1)
                iss = [i for v in rep["views"] for i in v["issues"]]
                r["high"] = sum(i["sev"] == "high" for i in iss)
                r["med"] = sum(i["sev"] == "med" for i in iss)
                r["low"] = sum(i["sev"] == "low" for i in iss)
                r["console_errors"] = len(set(rep["consoleErrors"]))
                r["kinds"] = sorted({f'{i["sev"]}:{i["kind"]}' for i in iss})
                r["font_sizes"] = len(rep["views"][0]["stats"].get("fontSizes", []))
        print(json.dumps(r), flush=True)
        os.makedirs(f"{B}/results", exist_ok=True)
        with open(f"{B}/results/{cond}.jsonl", "a") as f:
            f.write(json.dumps(r) + "\n")
