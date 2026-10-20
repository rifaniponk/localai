"""Run the benchmark tasks through omp with one config variant.

  python3 run.py LABEL [--reps N] [--tasks a,b] [--timeout S]

A variant is configs/LABEL.yml (an omp settings overlay passed with --config, layered over ~/.omp/agent/config.yml)
plus, optionally, configs/LABEL.args (extra omp flags, one line) and configs/LABEL.system.md (appended system prompt).
Every run gets a fresh copy of the task's repo (a git repo with one commit). Results: results/LABEL/<task>-<rep>/.
"""
import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
TASKS = HERE / "tasks"
CONFIGS = HERE / "configs"
RESULTS = HERE / "results"
AGENT = HERE / "agent"          # isolated omp settings dir (PI_CODING_AGENT_DIR); models.yml points at the proxy
PROXY_LOG = HERE / "proxy.jsonl"
BASE_ARGS = ["-p", "--mode", "json", "--no-session", "--no-title", "--approval-mode", "yolo"]


def prepare(task: str, base: Path) -> Path:
    repo = base / "repo"
    shutil.copytree(TASKS / task / "repo", repo)
    (repo / ".gitignore").write_text("__pycache__/\n*.pyc\n")
    git = ["git", "-c", "user.name=bench", "-c", "user.email=bench@localhost"]
    subprocess.run(git[:1] + ["init", "-q"], cwd=repo, check=True)
    subprocess.run(git + ["add", "-A"], cwd=repo, check=True)
    subprocess.run(git + ["commit", "-q", "-m", "start"], cwd=repo, check=True)
    return repo


def metrics(events: list[dict]) -> dict:
    # message_end events, not agent_end: a multi-prompt session has one agent_end per prompt
    end = next((e for e in reversed(events) if e.get("type") == "agent_end"), None)
    msgs = [e["message"] for e in events if e.get("type") == "message_end"]
    m = {"llm_calls": 0, "tool_calls": 0, "input": 0, "output": 0, "cache_read": 0, "llm_s": 0.0, "ttft_s": 0.0,
         "max_input": 0, "tools": {}, "errors": 0, "answer": "", "finished": end is not None}
    for msg in msgs:
        if msg.get("role") == "assistant":
            m["llm_calls"] += 1
            u = msg.get("usage") or {}
            m["input"] += u.get("input", 0)
            m["output"] += u.get("output", 0)
            m["cache_read"] += u.get("cacheRead", 0)
            m["max_input"] = max(m["max_input"], u.get("input", 0) + u.get("cacheRead", 0))
            m["llm_s"] += (msg.get("duration") or 0) / 1000
            m["ttft_s"] += (msg.get("ttft") or 0) / 1000
            if msg.get("stopReason") in ("error", "aborted"):
                m["errors"] += 1
            text = []
            for c in msg.get("content") or []:
                if c.get("type") == "text":
                    text.append(c.get("text", ""))
                elif "tool" in str(c.get("type", "")).lower():
                    m["tool_calls"] += 1
                    name = c.get("name") or c.get("toolName") or "?"
                    m["tools"][name] = m["tools"].get(name, 0) + 1
            if text:
                m["answer"] = "\n".join(text)
        elif msg.get("role") in ("toolResult", "tool") and msg.get("isError"):
            m["errors"] += 1
    return m


def run_one(label: str, task: str, rep: int, timeout: int) -> dict:
    out = RESULTS / label / f"{task}-{rep}"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    repo = prepare(task, out)
    cmd = ["omp"] + BASE_ARGS
    overlay = CONFIGS / f"{label}.yml"
    if overlay.exists():
        cmd += ["--config", str(overlay)]
    args = CONFIGS / f"{label}.args"
    if args.exists():
        cmd += shlex.split(args.read_text().replace("{configs}", str(CONFIGS)))
    system = CONFIGS / f"{label}.system.md"
    if system.exists():
        cmd += ["--append-system-prompt", str(system)]
    multi = TASKS / task / "prompts.txt"
    prompts = ([p.strip() for p in multi.read_text().split("\n---\n")] if multi.exists()
               else [(TASKS / task / "prompt.txt").read_text().strip()])
    agent = agent_dir(label)
    env = dict(os.environ, PI_CODING_AGENT_DIR=str(agent))
    t0 = time.time()
    code = 0
    with open(out / "events.jsonl", "w") as ev, open(out / "stderr.txt", "w") as er:
        for i, prompt in enumerate(prompts):
            c = cmd + [prompt] if len(prompts) == 1 else \
                [x for x in cmd if x != "--no-session"] + ["--session-dir", str(out / "sessions")] + \
                (["-c"] if i else []) + [prompt]
            left = timeout - (time.time() - t0)
            if left <= 0:
                code = "timeout"
                break
            try:
                p = subprocess.run(c, cwd=repo, stdin=subprocess.DEVNULL, stdout=ev, stderr=er, timeout=left, env=env)
                code = p.returncode if code == 0 else code
            except subprocess.TimeoutExpired:
                code = "timeout"
                break
    wall = time.time() - t0
    time.sleep(0.3)
    reqs = []
    if PROXY_LOG.exists():
        for line in PROXY_LOG.read_text().splitlines():
            r = json.loads(line)
            if r.get("method") == "POST" and t0 <= r["t"] <= t0 + wall:
                reqs.append(r)
    (out / "requests.jsonl").write_text("".join(json.dumps(r) + "\n" for r in reqs))
    events = []
    for line in (out / "events.jsonl").read_text().splitlines():
        try:
            events.append(json.loads(line))
        except ValueError:
            pass
    m = metrics(events)
    (out / "ANSWER.txt").write_text(m["answer"])
    chk = subprocess.run([sys.executable, str(TASKS / task / "check.py"), str(repo), str(out / "ANSWER.txt")],
                         capture_output=True, text=True, timeout=120)
    m.update(label=label, task=task, rep=rep, wall_s=round(wall, 1), http_requests=len(reqs),
             side_requests=max(0, len(reqs) - m["llm_calls"]), exit=code, passed=chk.returncode == 0,
             check_out=(chk.stdout + chk.stderr)[-500:], cmd=cmd, prompts=len(prompts))
    (out / "metrics.json").write_text(json.dumps(m, indent=1))
    return m


def agent_dir(label: str) -> Path:
    """The omp settings dir for a variant: the shared base, or - when the variant brings its own whole models.yml
    (configs/LABEL.models.yml) or config.yml (configs/LABEL.config.yml) - a private copy next to its results."""
    models, config = CONFIGS / f"{label}.models.yml", CONFIGS / f"{label}.config.yml"
    if not models.exists() and not config.exists():
        return AGENT
    agent = RESULTS / label / "_agent"
    agent.mkdir(parents=True, exist_ok=True)
    shutil.copy(config if config.exists() else AGENT / "config.yml", agent / "config.yml")
    shutil.copy(models if models.exists() else AGENT / "models.yml", agent / "models.yml")
    return agent


def warm_up(label: str):
    """One untimed request so the variant's system prompt is in the server's cache before the first timed task
    (a new variant changes the prompt; without this its first task alone pays the full prompt read)."""
    cmd = ["omp"] + BASE_ARGS
    for suffix, flag in ((".yml", "--config"), (".system.md", "--append-system-prompt")):
        f = CONFIGS / f"{label}{suffix}"
        if f.exists():
            cmd += [flag, str(f)]
    args = CONFIGS / f"{label}.args"
    if args.exists():
        cmd += shlex.split(args.read_text().replace("{configs}", str(CONFIGS)))
    agent = agent_dir(label)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(cmd + ["Reply with only OK."], cwd=d, stdin=subprocess.DEVNULL, capture_output=True,
                       timeout=300, env=dict(os.environ, PI_CODING_AGENT_DIR=str(agent)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("label")
    ap.add_argument("--reps", type=int, default=1)
    ap.add_argument("--rep-start", type=int, default=1)
    ap.add_argument("--tasks", default="")
    ap.add_argument("--timeout", type=int, default=600)
    a = ap.parse_args()
    # the long s- sessions run only when named (--tasks s-...), so a default run stays a few minutes per variant
    tasks = a.tasks.split(",") if a.tasks else sorted(p.name for p in TASKS.iterdir() if not p.name.startswith("s-"))
    warm_up(a.label)
    for rep in range(a.rep_start, a.rep_start + a.reps):
        for t in tasks:
            m = run_one(a.label, t, rep, a.timeout)
            print(f"{a.label} {t:20s} rep{rep} {'PASS' if m['passed'] else 'FAIL'} {m['wall_s']:6.1f}s "
                  f"calls={m['llm_calls']:2d} tools={m['tool_calls']:2d} in={m['input']:6d} out={m['output']:5d} "
                  f"cache={m['cache_read']:6d} exit={m['exit']}", flush=True)


if __name__ == "__main__":
    main()
