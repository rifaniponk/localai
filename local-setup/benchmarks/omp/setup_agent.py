"""Build agent/, the isolated omp settings dir the benchmark runs with (PI_CODING_AGENT_DIR), from the published
config in ../../agents/omp. Its models.yml points at the logging proxy (port 9192) instead of the server.

    python3 setup_agent.py [--proxy http://127.0.0.1:9192/v1]

The server key is not stored here: models.yml names the environment variable STRATA_API_KEY, so export it first.
"""
import argparse
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / "agents" / "omp"

ap = argparse.ArgumentParser()
ap.add_argument("--proxy", default="http://127.0.0.1:9192/v1")
a = ap.parse_args()

agent = HERE / "agent"
agent.mkdir(exist_ok=True)
shutil.copy(SRC / "config.yml", agent / "config.yml")
models = re.sub(r"baseUrl: \S+", f"baseUrl: {a.proxy}", (SRC / "models.yml").read_text())
(agent / "models.yml").write_text(models)
print(f"wrote {agent}/config.yml and models.yml (baseUrl {a.proxy})")
