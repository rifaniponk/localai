# omp design benchmark

Measures how good omp's user interfaces look and how many visual defects they ship. Each task is a request a
person would type, with no design hints. Every result is scored two ways: an automated audit, and a blind judge
that compares screenshots side by side. Results: [results/SUMMARY.md](results/SUMMARY.md).

The changes it measured are in [../../../agents/omp](../../../agents/omp/README.md#ui-design).

## Tasks

`tasks.json`, one omp run per task in a fresh folder:

| Task | Request (short) | Output |
|---|---|---|
| `landing` | landing page for "Tidepool", a feedback tool | `index.html` |
| `dashboard` | analytics dashboard for a small online store, fake data | `index.html` |
| `settings` | settings page: profile, notifications, security, billing | `index.html` |
| `mobile` | mobile habit tracker screen with check-offs and streaks | `index.html` |
| `egui` | egui/eframe 0.33 desktop app "Pulse" for monitoring web services | `src/main.rs` in `egui-template/` |

## Scoring

- **Audit**: `rescore.py` runs the skill's `ui-audit.mjs` on every page at 1440 px and 390 px. It reports high,
  medium and low issues (contrast, overflow, overlapping or squeezed text, duplicated navigation, open overlays,
  fixed bars covering content, repeated chart labels, frozen pages, tap targets, and more) plus the number of font
  sizes. All variants are rescored with the same audit version.
- **Blind judge**: `make_pairs.py A B OUT` puts each task's two screenshots side by side as anonymous A/B pairs
  (random order, key kept separately): the desktop page and three real 390x844 phone screens. A separate agent
  scores both sides 1-10 on hierarchy, typography, color, layout, polish and overall, and picks a winner.
- **egui**: the template is built with `cargo build --release`; a build that succeeds is screenshotted in a private
  Xvfb display with `eshot.py`. The benchmark gives omp no shell, so it can never compile its own code here.

## Running

```sh
export STRATA_API_KEY='...'
python3 bench.py baseline 2                                   # omp as installed, file tools only
BENCH_TOOLS=read,write,edit,glob,ui_audit BENCH_LIMIT=900 \
  python3 bench.py tuned 2                                    # with the ui_audit tool
python3 rescore.py baseline tuned                             # audit table for both, same audit version
python3 make_pairs.py baseline tuned judge-tuned              # blind A/B pairs for a judge
```

- Install the variant under test into `~/.omp/agent` first (skill, tool, `APPEND_SYSTEM.md`, `models.yml`): omp
  reads them from there.
- Runs use `--tools=read,write,edit,glob` (plus `ui_audit` when tested): no shell, so an unattended run can only
  write files in its own folder.
- A run that passes `BENCH_LIMIT` is stopped and its page is still scored; the timeout is recorded.
- Needs Node 22+, Chrome, Python 3 with Pillow, and for `egui`: Rust, Xvfb, ImageMagick.
- `runs/` (pages, screenshots, logs) and `judge-*/` stay out of git: they contain local paths.
