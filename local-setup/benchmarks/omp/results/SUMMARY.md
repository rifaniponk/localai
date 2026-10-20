# Results

Measured on 2026-10-20: RTX 5080 16 GB, Ryzen 9 9950X, 96 GB RAM, Linux; Strata 0.1.45.3 (engine build 0.1.44.1)
serving Qwen3.8-Flash-Next IQ3_S at 262,144 context; omp 18.12.3. Every run's numbers are in
[runs.csv](runs.csv) (546 runs; `label` is the variant, see [../configs/README.md](../configs/README.md)). The rerun
on engine 0.1.46.1 is in [New engine](#new-engine-0146).

## Original vs tuned

Interleaved in one batch. Original = the files `strata connect omp` writes; tuned = [../../../agents/omp](../../../agents/omp).

| | Original | Tuned |
|---|---|---|
| 15 short tasks x 2: passed | 30/30 | 29/30 |
| median per task | 55.4 s | 7.7 s |
| total | 1,824 s | 285 s |
| model calls per task | 6.7 | 5.7 |
| uncached prompt tokens per task | 43,754 | 818 |
| prompt tokens from the cache | 31% | 98% |
| side requests per task | 4.4 | 0 |
| 8-prompt session: passed | 1/1 | 2/2 |
| 8-prompt session: time | 1,680 s | 117 s, 141 s |
| 8-prompt session: side requests | 68 | 0 |

The original's second session run was stopped from outside twice (not a task failure) and is not included.

Per task (median of 2, short tasks):

| Task | Original | Tuned |
|---|---:|---:|
| bugfix-median | 42.8 s | 4.4 s |
| cli-json-flag | 63.5 s | 5.8 s |
| code-question | 44.1 s | 5.5 s |
| fix-failing-tests | 44.0 s | 7.1 s |
| h-calc-bugs | 68.0 s | 24.1 s (1 of 2 failed) |
| h-lru-cache | 62.5 s | 11.1 s |
| h-todo-priority | 115.8 s | 16.9 s |
| h-traceback-root-cause | 58.8 s | 8.7 s |
| long-file-fix | 47.6 s | 9.2 s |
| new-function-spec | 64.5 s | 6.8 s |
| rename-multifile | 51.2 s | 8.0 s |
| x-csv-summary | 51.2 s | 5.5 s |
| x-merge-intervals | 49.2 s | 7.5 s |
| x-stale-cache | 61.9 s | 11.4 s |
| x-toposort | 87.0 s | 10.8 s |

## New engine (0.1.46)

The tuned setup again, later the same day, on Strata 0.2.1.1 (engine 0.1.46.1, compiled on this PC), label
`99-final-e146`. Same tasks, same machine, same server settings.

| | engine 0.1.44.1 | engine 0.1.46.1 |
|---|---|---|
| 15 short tasks x 2: passed | 29/30 | 30/30 |
| median per task | 7.7 s | 9.2 s |
| total | 285 s | 322 s |
| output tokens per second of model time | 103.0 | 109.5 |
| 8-prompt session: passed | 2/2 | 2/2 |
| 8-prompt session: time | 117 s, 141 s | 124 s, 141 s |

The new engine is not slower. One task makes the difference: `x-toposort` took 33 s and 20 s (20 model calls,
6,511 output tokens) against 10 s and 12 s (7 calls, 2,509 tokens), because the model took a longer route. That is
31 of the 37 extra seconds; the other 14 tasks total within 6 s of each other. `h-calc-bugs` passed both runs.

## Compaction threshold on a longer session

Engine 0.1.46.1, the tuned setup with only `compaction.thresholdTokens` changed, on `s-fleet-session` (10 prompts
over 32 modules). Interleaved; the 192K run was the pilot, run just before.

| Threshold | Passed | Time | Compactions | Peak context | Uncached prompt tokens |
|---|---|---|---|---|---|
| 64K | 2/2 | 189 s, 210 s | 1 each (after prompt 1: 66K -> 26-33K) | 51K, 64K | 96,661, 107,123 |
| 128K | 2/2 | 208 s, 169 s | none | 100K, 92K | 77,068, 72,718 |
| 192K | 1/1 | 140 s | none | 92K | 74,460 |

One compaction cost two summary requests (7.7-8.2 s and 2.2-2.3 s) and 3.9-6.4 s of re-reading on the next step:
14-17 s. The whole-session times overlap because the model's route varies (56-97 model calls per run), so they do
not show a difference on their own. Time per model call was the same with and without compaction (2.1-2.8 s), so a
92-100K context did not slow the steps. The setup now compacts at 128K.

Why the sessions stay small: omp's `read` folds files over 100 lines (`read.summarize`, on by default), so a
270-line module costs about 1.9K tokens in context instead of 3.2K, and on a 72-module build of the same task the
model switched to grep and scripts (39 shell calls, 14 reads) and peaked at 58K. That run is not in runs.csv (it is
a different build of the task). Above 128K, 128K and 192K would differ; no session here got there.

## Step by step

Each step against the base of its time (n = runs per variant; short-task totals over the tasks both ran).

| Step | Before | After | Pass |
|---|---|---|---|
| no background compaction (7 tasks) | median 42.3 s, cache 32% | median 12.6 s, cache 98% | 9/9 -> 21/21 |
| lean prompt + tools (11 tasks x 3) | 689 s total | 678 s | 33/33 -> 33/33 |
| replace edits (11 tasks x 3) | 678 s, 7 failed edits | 647 s, 0 failed edits | 33/33 -> 33/33 |
| thinking xhigh -> medium -> low -> off (15 tasks x 2) | 21.7 s per task | 17.9 / 17.4 / 11.9 s | 26/26, 30/30, 30/30, 30/30 |
| thinking medium -> off, 8-prompt session x 2 | 412 s, 797 s | 235 s, 375 s | 2/2 -> 2/2 |
| compaction at 64K, no rewrites, session x 2 | 235 s, 375 s | 212 s, 142 s | 2/2 -> 2/2 |
| presence penalty 1.5 -> 0 (15 tasks x 2; session x 1) | 359 s; 151 s | 315 s; 135 s | 30/30 -> 30/30 |
| appended working-style prompt (15 tasks x 2; session x 1) | 366 s; 140 s | 279 s; 120 s | 30/30 -> 30/30 |
| todo tool off (not kept) | 366 s; 140 s | 404 s; 262 s | 30/30 -> 29/30 |

Run-to-run noise: the same config measured 315 s and 366 s in two batches (about 15%), so only the larger steps
above are clearly real; the small ones were kept because they cost nothing and did not hurt.

## Accuracy and thinking

Over every short-task run, thinking off passed 298/300 and thinking on (xhigh, medium or low) 224/224. Both
failures are the same task, `h-calc-bugs` (a nested unary minus in a parser). Thinking off is the faster default;
raise the level in omp for intricate logic.
