"""python3 trace.py results/LABEL/TASK-REP : one line per model call (thinking size, text, tool calls)."""
import json, sys
from pathlib import Path
d = Path(sys.argv[1])
ev = [json.loads(l) for l in (d / "events.jsonl").read_text().splitlines() if l.strip()]
end = [e for e in ev if e["type"] == "agent_end"][-1]
for m in end["messages"]:
    if m["role"] == "assistant":
        u = m["usage"]
        parts = []
        for c in m["content"]:
            if c["type"] == "thinking":
                parts.append(f"think({len(c['thinking'])}ch)")
            elif c["type"] == "text":
                parts.append("text:" + c["text"][:100].replace("\n", " "))
            else:
                parts.append(f"{c.get('name')}:" + json.dumps(c.get("arguments"))[:140])
        print(f"A out={u['output']:5d} dur={m['duration']/1000:5.1f}s", " | ".join(parts))
    elif m["role"] == "toolResult":
        t = json.dumps(m.get("content"))[:110]
        print(f"   <- {m.get('toolName')} {'ERR ' if m.get('isError') else ''}{t}")
