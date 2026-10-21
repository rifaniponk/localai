# Design benchmark results

omp 18.12.3, Strata with Qwen3.8-Flash-Next IQ3_S, thinking `minimal`, the tuned speed config from
[agents/omp](../../../../agents/omp/README.md). 2026-10-21, 5 tasks x 2 runs per variant, file tools only (no shell).
Per-run data: `baseline.jsonl`, `v1.jsonl`, `v3.jsonl`, `v4.jsonl`, `v5.jsonl` in this folder.

## Variants

| Variant | What omp had | Time limit |
|---|---|---|
| baseline | the speed-tuned setup, no UI guidance | 600 s (the first 5 runs: 1500 s) |
| v1 | + `ui-design` skill (rules, themes, CSS starter, icons, page recipes, egui starter) + the trigger line in `APPEND_SYSTEM.md` | 600 s |
| v3 | + `ui_audit` tool (text report and screenshots) + vision on (`input: [text, image]`) + "look at the screenshots" review step | 900 s |
| v4 | v3 with the audit made hang-safe (stopped after 3 runs, see below) | 900 s |
| v5 | v4 + review budget (at most 2 audits, one screenshot review, small `edit`s instead of rewrites, stop when clean) | 900 s |

v2 (audit tool without vision) was stopped before its first run finished, when vision became available.

## Totals (8 web pages per variant, all rescored with the final audit)

| | baseline | v1 | v3 | v5 |
|---|---|---|---|---|
| high issues | 13 | 9 | 0 | **2** |
| medium issues | 22 | 15 | 0 | **1** |
| low issues | 27 | 3 | 2 | **3** |
| font sizes per page | 10.0 | 7.2 | 7.1 | 7.4 |
| average time per run | 147 s | 225 s | 702 s | **220 s** |
| runs that hit the time limit (of 10) | 1 | 2 | 7 | **1** |
| egui: builds / compile errors | 0/2 (11, 33) | 0/2 (7, 19) | 0/2 (3, 3) | 0/2 (9, 1) |

## Blind judge (8 web pairs per round, one judge)

| Round | Pairs won | Average overall score (1-10) |
|---|---|---|
| baseline vs v1 | 4 - 4 | 5.9 vs 6.4 |
| baseline vs v3 | 2 - **6** | 6.1 vs 6.9 |
| baseline vs v5 | 3 - **5** | 6.0 vs **7.0** |

- v5 won both settings pages, both habit trackers and dashboard 1 (several 8 vs 5); it lost both landing pages
  (one shipped its phone menu open on desktop, one had step badges overlapping headings) and dashboard 2 (6 vs 6).
- The v1 and v3 rounds showed the judge a full-page phone capture. That capture draws fixed bars in the wrong
  place: the judge marked both v3 habit trackers down for an "Add habit" bar covering content that, on a real
  390x844 screen scrolled to the end, covers nothing. From v5 on, the pairs use real phone screens.

## Per run (audit: high / medium / low, font sizes, seconds)

| Run | baseline | v1 | v3 | v5 |
|---|---|---|---|---|
| landing-1 | 0/5/4, 17, 61 s | 1/2/0, 7, 121 s | 0/0/0, 8, 305 s | 2/1/0, 8, 124 s |
| landing-2 | 2/3/6, 17, 51 s | 1/3/0, 8, 121 s | 0/0/0, 8, 900 s (limit) | 0/0/0, 9, 123 s |
| dashboard-1 | 6/3/2, 7, 106 s | 1/4/1, 7, 120 s | 0/0/1, 6, 900 s (limit) | 0/0/1, 6, 113 s |
| dashboard-2 | 0/4/2, 9, 148 s | 0/4/1, 7, 110 s | 0/0/0, 6, 900 s (limit) | 0/0/1, 6, 125 s |
| settings-1 | 4/1/5, 10, 37 s | 1/1/1, 7, 113 s | 0/0/1, 7, 191 s | 0/0/1, 8, 130 s |
| settings-2 | 1/2/4, 8, 61 s | 3/1/0, 7, 144 s | 0/0/0, 8, 900 s (limit) | 0/0/0, 8, 129 s |
| mobile-1 | 0/2/2, 6, 86 s | 2/0/0, 9, 140 s | 0/0/0, 7, 900 s (limit) | 0/0/0, 7, 900 s (limit) |
| mobile-2 | 0/2/2, 6, 204 s | 0/0/0, 6, 180 s | 0/0/0, 7, 900 s (limit) | 0/0/0, 7, 279 s |

## What the runs showed

- **The skill alone mostly moved numbers, not looks.** v1 cut low issues and font sizes, but the judge called it a
  tie: with more ambition and no way to see the page, omp shipped new visual bugs (a phone menu open on desktop, a
  bottom sheet open on load, tables squeezed into one word per line, repeated chart labels).
- **Seeing the page is what helped.** With the audit tool and vision (v3), every page came out with 0 high and 0
  medium issues and the judge picked it 6 times out of 8. Asked to review a screenshot with a checklist, the model
  found an unreadable header button, colliding text and empty areas in about 15 s.
- **v3's time limits had two causes.** (1) A page whose JavaScript never finished (date math producing `NaN` keys
  in a `while` loop) froze the audit, so omp waited on the tool; the audit now reports `page-hang` within ~20 s.
  (2) omp rewrote the whole 40 KB page on each review round and re-read 5 screenshots: about 290 tool calls, 130K
  context and a mid-run compaction, after which it lost track (omp logged `cross-turn tool-call loop detected`).
  The review budget in v5 brought the average back to 220 s.
- **v5's one time limit**: the page was finished and clean at minute 1.5; omp then wrote seven `smoke-check*.cjs`
  test scripts it had no shell to run. The skill now says the audit is the verification for a page.
- **egui** never builds without a compiler in the loop; errors went from 11/33 to between 1 and 9, mostly borrow
  checker and type mismatches. In a normal session omp has `cargo` and the skill's screenshot script.

Not benchmarked: two rules added after v5 (no test scripts for pages; never finish with a high issue open).
