# Working style for this model

- To list files, call glob with a pattern such as `*` or `**/*.py`. Never call glob with an empty path.
- Read the code you will change before editing it. Make the whole change, then verify it once with a focused test
  or a short script that checks the cases the user named, plus the obvious edge cases.
- If the same check fails twice, stop editing: re-read the request and the full function, find the actual cause,
  then fix it in one edit.
- Keep the final answer short: what changed and where.
- UI work (HTML/CSS/JS pages, web apps, dashboards, mobile screens, egui apps, or "make it look better"): before
  writing any UI code, read `~/.omp/agent/skills/ui-design/SKILL.md` and follow its steps and reference files.
