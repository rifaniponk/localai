"""A logging pass-through proxy in front of Strata: python3 proxy.py [listen_port] [upstream] [log]

Every POST body is summarised into the log (one JSON line): message count, max_tokens, sampling, tool count, the
first characters of the system prompt and of the last message, and how many leading messages are identical to the
previous request's (a changed early message forces the server to re-read the prompt from that point)."""
import hashlib
import http.client
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9192
UP = urlsplit(sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:9191")
LOG = sys.argv[3] if len(sys.argv) > 3 else "proxy.jsonl"
lock = threading.Lock()
prev = {}                              # system prompt hash -> message hashes of the last such request


def h(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True).encode()).hexdigest()[:10]


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in content)
    return str(content)


def summarise(body):
    try:
        d = json.loads(body)
    except ValueError:
        return {"bad_json": True}
    msgs = d.get("messages") or []
    hashes = [h(m) for m in msgs]
    sysmsg = next((text_of(m.get("content")) for m in msgs if m.get("role") in ("system", "developer")), "")
    before = prev.get(h(sysmsg), [])
    same = 0
    for a, b in zip(hashes, before):
        if a != b:
            break
        same += 1
    first_diff = None
    if same < min(len(hashes), len(before)):
        first_diff = {"index": same, "role": msgs[same].get("role"), "head": text_of(msgs[same].get("content"))[:160]}
    prev[h(sysmsg)] = hashes
    last = msgs[-1] if msgs else {}
    return {"n_msgs": len(msgs), "same_prefix_msgs": same, "first_diff": first_diff,
            "max_tokens": d.get("max_tokens") or d.get("max_completion_tokens"), "temperature": d.get("temperature"),
            "top_p": d.get("top_p"), "reasoning_effort": d.get("reasoning_effort"), "tools": len(d.get("tools") or []),
            "tool_names": [t.get("function", {}).get("name") for t in d.get("tools") or []],
            "chars": len(body), "system_chars": len(sysmsg), "system_head": sysmsg[:200], "system_hash": h(sysmsg),
            "last_role": last.get("role"), "last_head": text_of(last.get("content"))[:200],
            "last_tail": text_of(last.get("content"))[-700:] if len(msgs) <= 3 else "",
            "extra_keys": sorted(k for k in d if k not in ("messages", "model", "tools", "stream", "max_tokens",
                                                           "max_completion_tokens", "temperature", "top_p"))}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _forward(self, method):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else b""
        t0 = time.time()
        rec = {"t": round(t0, 3), "method": method, "path": self.path}
        if method == "POST":
            with lock:
                rec.update(summarise(body))
        r = None
        conn = None
        tail = b""
        try:
            conn = http.client.HTTPConnection(UP.hostname, UP.port, timeout=900)
            headers = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "connection", "accept-encoding")}
            conn.request(method, self.path, body=body, headers=headers)
            r = conn.getresponse()
            self.send_response(r.status)
            chunked = r.getheader("Content-Length") is None
            for k, v in r.getheaders():
                if k.lower() not in ("transfer-encoding", "connection", "content-length"):
                    self.send_header(k, v)
            if chunked:
                self.send_header("Transfer-Encoding", "chunked")
            else:
                self.send_header("Content-Length", r.getheader("Content-Length"))
            self.end_headers()
            while True:
                chunk = r.read1(65536) if hasattr(r, "read1") else r.read(65536)
                if not chunk:
                    break
                tail = (tail + chunk)[-4000:]
                if chunked:
                    self.wfile.write(b"%x\r\n%s\r\n" % (len(chunk), chunk))
                else:
                    self.wfile.write(chunk)
                self.wfile.flush()
            if chunked:
                self.wfile.write(b"0\r\n\r\n")
            conn.close()
        except (BrokenPipeError, ConnectionResetError, TimeoutError) as e:
            rec["client_aborted"] = type(e).__name__
            if conn:
                conn.close()                   # so the server sees the disconnect and stops generating
        rec["status"] = r.status if r else None
        rec["secs"] = round(time.time() - t0, 2)
        i = tail.rfind(b'"usage"')
        if i >= 0:
            rec["usage_tail"] = tail[i:i + 300].decode(errors="replace")
        with lock, open(LOG, "a") as f:
            f.write(json.dumps(rec) + "\n")

    def do_POST(self):
        self._forward("POST")

    def do_GET(self):
        self._forward("GET")


ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
