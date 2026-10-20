"""Each check must fail on the untouched repo and pass on a hand-written reference fix."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from run import prepare

TASKS = Path(__file__).resolve().parent / "tasks"


def sub(p, old, new):
    s = p.read_text()
    assert old in s, (p, old)
    p.write_text(s.replace(old, new))


REF = {
    "bugfix-median": lambda r: sub(r / "stats.py", "    return s[n // 2]",
                                   "    if n % 2:\n        return s[n // 2]\n    return (s[n // 2 - 1] + s[n // 2]) / 2"),
    "fix-failing-tests": lambda r: (
        sub(r / "inventory.py", "        price, qty = self.items[name]\n        self.items[name] = (price, qty - quantity)",
            "        price, qty = self.items[name]\n        if quantity > qty:\n            raise ValueError(name)\n"
            "        if qty == quantity:\n            del self.items[name]\n        else:\n            self.items[name] = (price, qty - quantity)"),
        sub(r / "inventory.py", "sum(price for price, qty", "sum(price * qty for price, qty")),
    "rename-multifile": lambda r: [sub(p, "calc_total", "compute_total") for p in r.rglob("*.py") if "calc_total" in p.read_text()],
    "cli-json-flag": lambda r: (
        sub(r / "wordcount.py", '    args = ap.parse_args(argv)', '    ap.add_argument("--json", action="store_true")\n    args = ap.parse_args(argv)'),
        sub(r / "wordcount.py", '    print(f"{lines} {words} {chars}")',
            '    if args.json:\n        import json\n        print(json.dumps({"lines": lines, "words": words, "chars": chars}))\n'
            '    else:\n        print(f"{lines} {words} {chars}")')),
    "code-question": lambda r: None,
    "new-function-spec": lambda r: (r / "text_utils.py").write_text((r / "text_utils.py").read_text() + '''

def slugify(text):
    import re, unicodedata
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")
'''),
    "long-file-fix": lambda r: sub(r / "report.py", '    return "$" + str(round(amount, 1))',
                                   '    sign = "-" if amount < 0 else ""\n    return f"{sign}${abs(amount):,.2f}"'),
    "h-lru-cache": lambda r: ((r / "lru.py").write_text('''
from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.d = OrderedDict()

    def get(self, key):
        if key not in self.d:
            return None
        self.d.move_to_end(key)
        return self.d[key]

    def put(self, key, value):
        if self.capacity <= 0:
            return
        self.d[key] = value
        self.d.move_to_end(key)
        while len(self.d) > self.capacity:
            self.d.popitem(last=False)

    def __len__(self):
        return len(self.d)

    def __contains__(self, key):
        return key in self.d
'''), (r / "test_lru.py").write_text("from lru import LRUCache\n")),
    "h-calc-bugs": lambda r: (
        sub(r / "calculator/parser.py", '''        if self.peek() in (("op", "+"), ("op", "-")):
            op = self.take()[1]
            right = self.expr()
            return (op, left, right)
        return left''', '''        while self.peek() in (("op", "+"), ("op", "-")):
            op = self.take()[1]
            left = (op, left, self.term())
        return left'''),
        sub(r / "calculator/parser.py", '''        if kind == "num":
            return val''', '''        if kind == "num":
            return val
        if (kind, val) == ("op", "-"):
            return ("-", 0.0, self.factor())''')),
    "h-traceback-root-cause": lambda r: (
        sub(r / "settings.py", 'sec.get("top_n", "5")', 'sec.getint("top_n", 5)'),
        sub(r / "settings.py", 'sec.get("show_total", "no")', 'sec.getboolean("show_total", False)')),
    "h-todo-priority": lambda r: (
        sub(r / "todo_model.py", "    done: bool = False\n", '    done: bool = False\n    priority: str = "normal"\n'),
        sub(r / "todo_store.py", "    def add(self, text):\n        todos = self._load()\n        todos.append(Todo(text=text))",
            '    def add(self, text, priority="normal"):\n        todos = self._load()\n        todos.append(Todo(text=text, priority=priority))'),
        sub(r / "todo.py", '    a.add_argument("text")\n', '    a.add_argument("text")\n    a.add_argument("--priority", choices=["low", "normal", "high"], default="normal")\n'),
        sub(r / "todo.py", "        store.add(args.text)", "        store.add(args.text, args.priority)"),
        sub(r / "todo.py", '''        for item in store.items():
            print(f"- {item.text}")''', '''        rank = {"high": 0, "normal": 1, "low": 2}
        for item in sorted(store.items(), key=lambda t: rank[t.priority]):
            print(f"[{item.priority}] {item.text}")''')),
    "x-merge-intervals": lambda r: (r / "intervals.py").write_text('''
def merge(intervals):
    for s, e in intervals:
        if s > e:
            raise ValueError((s, e))
    out = []
    for s, e in sorted(intervals):
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out
'''),
    "x-toposort": lambda r: (r / "deps.py").write_text('''
import heapq


def build_order(deps):
    nodes = set(deps) | {d for ds in deps.values() for d in ds}
    need = {n: set(deps.get(n, [])) for n in nodes}
    users = {n: set() for n in nodes}
    for n, ds in need.items():
        for d in ds:
            users[d].add(n)
    ready = [n for n in nodes if not need[n]]
    heapq.heapify(ready)
    out = []
    while ready:
        n = heapq.heappop(ready)
        out.append(n)
        for u in users[n]:
            need[u].discard(n)
            if not need[u]:
                heapq.heappush(ready, u)
    if len(out) != len(nodes):
        raise ValueError("cycle: " + ", ".join(sorted(nodes - set(out))))
    return out
'''),
    "x-csv-summary": lambda r: (r / "summary.py").write_text('''
import csv


def summarize(path):
    tot = {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            try:
                a = float((row.get("amount") or "").strip())
            except ValueError:
                continue
            k = (row.get("region") or "").strip().lower()
            tot[k] = tot.get(k, 0.0) + a
    return {k: round(v, 2) for k, v in tot.items()}
'''),
    "x-stale-cache": lambda r: sub(r / "shop/admin.py", 'cache.delete(f"products:{pid}")', 'cache.delete(f"product:{pid}")'),
    "s-library-session": lambda r: (
        (r / "library.py").write_text('''
import json, os
from dataclasses import dataclass, asdict, field


@dataclass
class Book:
    isbn: str
    title: str
    author: str
    year: int
    out: str = None


class Library:
    def __init__(self):
        self.books = {}

    def add(self, book):
        if book.isbn in self.books:
            raise ValueError(book.isbn)
        self.books[book.isbn] = book

    def remove(self, isbn):
        del self.books[isbn]

    def find_by_author(self, name):
        return [b for b in self.books.values() if b.author.lower() == name.lower()]

    def checkout(self, isbn, member):
        b = self.books[isbn]
        if b.out:
            raise ValueError("already out")
        b.out = member

    def checkin(self, isbn):
        self.books[isbn].out = None

    def save(self, path):
        json.dump([asdict(b) for b in self.books.values()], open(path, "w"))

    @classmethod
    def load(cls, path):
        lib = cls()
        if os.path.exists(path):
            for d in json.load(open(path)):
                lib.add(Book(**d))
        return lib
'''),
        (r / "cli.py").write_text('''
import sys
from collections import Counter
from library import Library, Book
P = "library.json"


def line(b):
    return f"{b.year} {b.title} by {b.author} [{b.isbn}]" + (f" (out: {b.out})" if b.out else "")


def main(a):
    lib = Library.load(P)
    try:
        if a[0] == "add":
            lib.add(Book(a[1], a[2], a[3], int(a[4])))
        elif a[0] == "remove":
            lib.remove(a[1])
        elif a[0] == "list":
            for b in sorted(lib.books.values(), key=lambda b: (b.year, b.title)):
                print(line(b))
        elif a[0] == "search":
            for b in sorted(lib.find_by_author(a[2]), key=lambda b: (b.year, b.title)):
                print(line(b))
        elif a[0] == "checkout":
            lib.checkout(a[1], a[2])
        elif a[0] == "checkin":
            lib.checkin(a[1])
        elif a[0] == "stats":
            c = Counter(b.author for b in lib.books.values())
            top = sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))
            print(f"books: {len(lib.books)}")
            print(f"checked out: {sum(1 for b in lib.books.values() if b.out)}")
            print(f"top author: {top[0][0] if top else '-'}")
    except (KeyError, ValueError) as e:
        print("error:", e, file=sys.stderr)
        sys.exit(1)
    lib.save(P)


main(sys.argv[1:])
'''),
        (r / "test_library.py").write_text("import unittest\nclass T(unittest.TestCase):\n    def test_x(self):\n        import library\n"),
        (r / "README.md").write_text("add remove list search checkout checkin stats\n")),
}
ANS = {"code-question": ("I looked around.\nANSWER: 3 with_retries", "It is capped by BACKOFF_CAP.\nANSWER: 12 seconds `backoff_delay`")}

ok = True
for t in sorted(p.name for p in TASKS.iterdir()):
    for phase in ("before", "after"):
        with tempfile.TemporaryDirectory() as d:
            repo = prepare(t, Path(d))
            if phase == "after":
                REF[t](repo)
            ans = Path(d) / "ANSWER.txt"
            ans.write_text(ANS.get(t, ("", ""))[phase == "after"])
            r = subprocess.run([sys.executable, str(TASKS / t / "check.py"), str(repo), str(ans)], capture_output=True, text=True)
            want = 0 if phase == "after" else 1
            good = (r.returncode == 0) == (want == 0)
            ok &= good
            print(f"{t:20s} {phase:6s} exit={r.returncode} {'ok' if good else 'WRONG ' + r.stdout[-300:] + r.stderr[-300:]}")
sys.exit(0 if ok else 1)
