# AGENTS.md — working rules for this repo

## Refresh the token counter before EVERY commit

The landing page HUD shows a **static** "TOKENS USED" number, hardcoded in
`landing/index.html`:

```html
<div class="hud-item"><span>TOKENS USED</span><b>7,070,526</b></div>
```

Before committing any change, recompute the number from the local Hermes state DB
and update that `<b>` value (use `en-US` thousands separators):

```bash
node -e '
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/home/rifan/.hermes/profiles/localai/state.db", { readOnly: true });
const r = db.prepare(`SELECT COALESCE(SUM(u.input_tokens),0) i, COALESCE(SUM(u.output_tokens),0) o
  FROM session_model_usage u JOIN sessions s ON s.id=u.session_id WHERE s.profile_name=?`).get("localai");
console.log((r.i + r.o).toLocaleString("en-US"));
'
```

(If `node:sqlite` is unavailable, use `python3 -c` with the `sqlite3` module and the same query.)

Rules:
- Count ONLY the `localai` Hermes profile (`sessions.profile_name = 'localai'`), never the LLM server's global totals.
- No `tokens.json` file and no runtime fetch — the number is baked into the HTML at commit time.

## Other conventions

- All user-facing content (UI copy, descriptions, README) is in English.
- Commit messages are in English.
- `slug = folder name = URL route`; every app needs a valid `app.json` (see README).
