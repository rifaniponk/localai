# Variants

A variant is `LABEL.yml` (an omp settings overlay, passed with `--config` on top of `agent/config.yml`), optionally
with `LABEL.args` (extra omp flags), `LABEL.system.md` (appended system prompt), `LABEL.models.yml` or
`LABEL.config.yml` (a whole replacement for that file). `{configs}` in an args file is this folder.

The base moved as winners were adopted, so each step was measured against the base of its time:

| Label | Change | Base at the time |
|---|---|---|
| `00-original` | the setup `strata connect omp` writes (whole files: thinking "medium", compaction at 15K, 4K output) | none |
| `00-baseline` | the same as an overlay, used for the first runs | original |
| `01-noasync` | `compaction.asyncEnabled: false` | original |
| `02-lean` | smaller prompt and tool set (see the omp config's comments) | + 01 |
| `03-replace` | `edit.mode: replace` | + 01, 02 |
| `05-xhigh` / `05-medium` / `05-low` / `05-off` | thinking level, now actually sent (`qwenTemplateReasoningEffort`) | + 01-03 |
| `06-compact` | compaction at 64K, no read superseding or result dropping | + 05-off |
| `06-maxtok` | 16K output limit | + 05-off |
| `07-pp0` / `07-code` | presence penalty 0 / the "precise coding" sampling set | + 06 |
| `08-guide` / `08-notodo` | the appended working-style prompt / no todo tool | + 07-pp0 |
| `99-final` | everything adopted (equals `../../agents/omp`) | + 08-guide |
| `99-final-e146` | the same files as `99-final`, run on engine 0.1.46.1 | 99-final |
