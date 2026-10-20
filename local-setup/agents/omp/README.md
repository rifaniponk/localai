# omp (oh-my-pi) on a local model

Config for [omp](https://omp.sh) 18.12.3 talking to the local Strata server (Qwen3.8-Flash-Next IQ3_S, 256K
context; see [../../server](../../server/README.md)). Starting point: the files `strata connect omp` writes.
Every change below was measured with the [benchmark](../../benchmarks/omp/README.md) before it was kept.

## Result

Same machine, same server, same tasks; the original is the `strata connect omp` setup, run in the same batch
(interleaved) on 2026-10-20. The original's second session run was stopped from outside twice and is missing, so
the session row is 1 run against 2.

| | Original | Tuned |
|---|---|---|
| 15 short tasks x 2: passed | 30/30 | 29/30 |
| median time per task | 55.4 s | 7.7 s |
| total time | 1,824 s | 285 s (**6.4x faster**) |
| prompt tokens served from the server's cache | 31% | 98% |
| side requests per task | 4.4 | 0 |
| 8-prompt session (`s-library-session`): passed | 1/1 | 2/2 |
| 8-prompt session: time | 1,680 s (68 side requests) | 117 s and 141 s (**about 13x faster**) |

The one failure is a parser edge case (`h-calc-bugs`: a nested unary minus). It is the only task that ever failed:
with thinking off it passed 18 of 20 runs, with any thinking level 17 of 17. Over all short-task runs of the whole
tuning, thinking off passed 298/300 and thinking on 224/224.

On the newer engine 0.1.46.1 (Strata 0.2.1.1) the tuned setup passed 30/30 short tasks (median 9.2 s, total 322 s)
and the session in 124 s and 141 s: the same speed, within run-to-run noise (see
[the results](../../benchmarks/omp/results/SUMMARY.md#new-engine-0146)).

## Install

```sh
cp config.yml models.yml APPEND_SYSTEM.md ~/.omp/agent/
export STRATA_API_KEY='...'      # the server's key (models.yml names this variable)
omp models strata                # should list qwen3.8-flash-next-iq3_s, 262K context, 16K output
```

Edit `baseUrl` in `models.yml` when the server is on another machine.

## What changed, and why

The server decodes one request at a time and continues a conversation by reading only what is new since the last
request. So the biggest wins came from stopping omp from (a) sending extra requests in between, and (b) rewriting
messages it already sent. Measured step by step (each against the setup of its time):

| Change | Where | Measured |
|---|---|---|
| `compaction.asyncEnabled: false` | config.yml | omp sent 2 background summary requests after every step; each pushed the conversation out of the server's cache. Median per task 42.3 s -> 11.6 s, cache hit 32% -> 98% |
| `compat.qwenTemplateReasoningEffort: true` | models.yml | without it omp sends no thinking level at all and every request runs at the template default, xhigh. With it, omp's level reaches the model |
| thinking off (`minimal`) | both files | short tasks: 21.7 s -> 11.9 s per task (xhigh -> off); 8-prompt session: 604 s -> 304 s (medium -> off). Pass rate: see above |
| compaction at 64K, `supersedeReads`/`dropUseless` off | config.yml | the 15K threshold compacted 4 times per session (3 summary requests + a full re-read each); session 304 s -> 177 s |
| compaction at 128K | config.yml | a 10-prompt session over 32 modules grows to 92-100K: at 64K it compacted once (two summary requests and a re-read, 14-17 s), at 128K never. Whole session 189 s, 210 s (64K) against 208 s, 169 s (128K) and 140 s (192K): within the model's route-to-route variation; 5/5 passed |
| smaller prompt and tool set | config.yml | system prompt + tools 7,737 -> 5,004 tokens; no speed change on short tasks (more room in long ones) |
| `edit.mode: replace` | config.yml | 0 failed edits in 58 (hashline: 6-7 per 33 runs, and a wrong hashline edit can land in the file as text) |
| `maxTokens: 16384` | models.yml | no measured change; 4096 can cut off a large file write |
| `presencePenalty: 0` | config.yml | the model card's non-thinking set uses 1.5, which discourages repeating identifiers. -12% time on short tasks, -11% on the session |
| `APPEND_SYSTEM.md` (working-style rules) | APPEND_SYSTEM.md | -24% time on short tasks (fewer calls: 7.0 -> 5.7 per task), session 140 s -> 120 s |

Tried and not kept: turning off the todo tool (slower, one failure), the "precise coding" sampling set
(temperature 0.6, top_p 0.95: no better than presence penalty 0 alone).

## Notes

- When a problem needs careful reasoning (tricky edge cases, parsers, algorithms), raise the thinking level for that
  session in omp. `low`, `medium` and `high` all reach the model now. Changing the level mid-session re-reads the
  prompt once (the server puts the effort instruction at the start of the prompt for `low` and `high`).
- omp's `read` folds long files (`read.summarize`, on by default): docstrings and bodies are elided and the model
  re-reads ranges it needs. It keeps the context small; in the benchmark sessions it never passed 100K.
- Session titles still use omp's default "fork" generator. It shares the conversation's prefix, so the server's cache
  covers it, and it runs once per session.
- Measured on omp 18.12.3 and Strata 0.1.45.3 (engine build 0.1.44.1); the tuned setup again on Strata 0.2.1.1
  (engine 0.1.46.1). Other omp versions may name or default
  settings differently: check with `omp config list`.
