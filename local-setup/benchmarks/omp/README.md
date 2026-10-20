# omp benchmark

Runs real coding tasks through `omp -p` against the local Strata server and checks each result with a script, so
every omp setting is measured before it is adopted: pass rate, wall time, model calls, tokens, cache hits and side
requests. Results: [results/SUMMARY.md](results/SUMMARY.md).

## Tasks

`make_tasks.py` writes `tasks/<name>/`: a small git repo, a prompt, and `check.py`, which exits 0 only when the task
is done right (hidden edge cases included). `validate_checks.py` proves every check fails on the untouched repo and
passes on a hand-written fix.

| Group | Tasks | What they test |
|---|---|---|
| plain | `bugfix-median`, `cli-json-flag`, `code-question`, `fix-failing-tests`, `long-file-fix`, `new-function-spec`, `rename-multifile` | small fixes, a feature, a question about code, a 300-line file |
| `h-` | `h-calc-bugs`, `h-lru-cache`, `h-todo-priority`, `h-traceback-root-cause` | multi-file bugs and features |
| `x-` | `x-csv-summary`, `x-merge-intervals`, `x-stale-cache`, `x-toposort` | specs whose edge cases decide the result |
| `s-` | `s-library-session` | 8 prompts in one continued session; grows the context past compaction |

`s-` tasks run only when named (`--tasks s-library-session`): one takes 2-15 minutes.

## Running

```sh
export STRATA_API_KEY='...'                          # the server's key
python3 setup_agent.py                               # agent/ from ../../agents/omp, pointed at the proxy
python3 make_tasks.py && python3 validate_checks.py
python3 proxy.py 9192 http://127.0.0.1:9191 proxy.jsonl &   # logs every request; keep it running
python3 run.py LABEL [--reps N] [--tasks a,b]        # one variant (see configs/README.md)
./batch.sh "LABEL1 LABEL2" 1 2                       # interleaved reps: drift hits every variant alike
./batch-s.sh "LABEL1 LABEL2" 1 2                     # the same for the long session
python3 compare.py LABEL1 LABEL2                     # pass rate, time, calls, tokens, cache hit %, side requests
python3 trace.py results/LABEL/TASK-REP              # what the agent did, call by call
```

- The server decodes one request at a time: run nothing else against it while measuring.
- omp reads user-level files (skills, `APPEND_SYSTEM.md`) from `~/.omp/agent` even with `PI_CODING_AGENT_DIR` set,
  so they apply to every variant alike. Variants that test the appended prompt pass it with
  `--append-system-prompt` (a `LABEL.system.md`), which takes precedence over the file.
- Each variant starts with one untimed request so its system prompt is cached before the first timed task.
- `proxy.py` shows what omp actually sends: request size, `max_tokens`, sampling, thinking fields, and how many
  leading messages are unchanged from the previous request with the same system prompt (a changed early message
  makes the server re-read the prompt from that point).
