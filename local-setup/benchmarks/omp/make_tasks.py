"""Create the benchmark tasks under tasks/<name>/: repo/ (copied fresh for every run), prompt.txt and check.py.

check.py runs in the finished work dir with the agent's final answer in ANSWER.txt next to it (outside the repo) and
exits 0 when the task is done right."""
import os
import shutil
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "tasks"


def task(name, prompt, files, check, prompts=None):
    d = ROOT / name
    if d.exists():
        shutil.rmtree(d)
    (d / "repo").mkdir(parents=True)
    for rel, body in files.items():
        p = d / "repo" / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(textwrap.dedent(body).lstrip("\n"))
    (d / "prompt.txt").write_text(textwrap.dedent(prompt).strip() + "\n")
    if prompts:                        # a multi-turn session: one omp call per prompt, continued with -c
        (d / "prompts.txt").write_text("\n---\n".join(textwrap.dedent(p).strip() for p in prompts) + "\n")
    (d / "check.py").write_text(textwrap.dedent(check).lstrip("\n"))


COMMON = '''
import hashlib, json, os, subprocess, sys
from pathlib import Path
REPO = Path(sys.argv[1]); ANSWER = Path(sys.argv[2]).read_text() if len(sys.argv) > 2 and Path(sys.argv[2]).exists() else ""
def run(*cmd, **kw):
    return subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=60, **kw)
def py(code):
    r = run(sys.executable, "-c", code)
    if r.returncode:
        print(r.stdout, r.stderr); sys.exit(1)
    return r.stdout
def changed():
    r = run("git", "status", "--porcelain")
    return [l[3:] for l in r.stdout.splitlines()]
'''

# 1. one-line bug in a small module
task("bugfix-median",
     "The median() function in stats.py gives wrong results for lists with an even number of items. Fix it.",
     {"stats.py": '''
        def mean(xs):
            return sum(xs) / len(xs)


        def median(xs):
            s = sorted(xs)
            n = len(s)
            return s[n // 2]


        def mode(xs):
            counts = {}
            for x in xs:
                counts[x] = counts.get(x, 0) + 1
            return max(counts, key=counts.get)
        '''},
     COMMON + '''
py("""
from stats import median, mean, mode
assert median([1, 2, 3, 4]) == 2.5, median([1, 2, 3, 4])
assert median([4, 1, 3, 2]) == 2.5
assert median([5, 1, 3]) == 3
assert median([7]) == 7
assert median([1, 2]) == 1.5
assert mean([1, 2, 3]) == 2 and mode([1, 1, 2]) == 1
""")
''')

# 2. run the tests, fix two bugs, leave the tests alone
task("fix-failing-tests",
     "Run the test suite with `python -m unittest` and fix the code in inventory.py so that all tests pass. Do not modify the tests.",
     {"inventory.py": '''
        class Inventory:
            def __init__(self):
                self.items = {}  # name -> (price, quantity)

            def add_item(self, name, price, quantity=1):
                if name in self.items:
                    old_price, old_qty = self.items[name]
                    self.items[name] = (price, old_qty + quantity)
                else:
                    self.items[name] = (price, quantity)

            def remove_item(self, name, quantity=1):
                price, qty = self.items[name]
                self.items[name] = (price, qty - quantity)

            def total_value(self):
                return sum(price for price, qty in self.items.values())

            def count(self, name):
                return self.items.get(name, (0, 0))[1]
        ''',
      "tests/__init__.py": "",
      "tests/test_inventory.py": '''
        import unittest
        from inventory import Inventory


        class InventoryTests(unittest.TestCase):
            def test_add_and_count(self):
                inv = Inventory()
                inv.add_item("apple", 0.5, 10)
                inv.add_item("apple", 0.5, 5)
                self.assertEqual(inv.count("apple"), 15)

            def test_total_value_uses_quantity(self):
                inv = Inventory()
                inv.add_item("apple", 0.5, 10)
                inv.add_item("pear", 2.0, 3)
                self.assertAlmostEqual(inv.total_value(), 11.0)

            def test_remove_more_than_stock_raises(self):
                inv = Inventory()
                inv.add_item("apple", 0.5, 2)
                with self.assertRaises(ValueError):
                    inv.remove_item("apple", 3)
                self.assertEqual(inv.count("apple"), 2)

            def test_remove_to_zero_deletes(self):
                inv = Inventory()
                inv.add_item("apple", 0.5, 2)
                inv.remove_item("apple", 2)
                self.assertNotIn("apple", inv.items)
                self.assertEqual(inv.count("apple"), 0)


        if __name__ == "__main__":
            unittest.main()
        '''},
     COMMON + '''
r = run(sys.executable, "-m", "unittest", "-q")
if r.returncode:
    print(r.stderr[-2000:]); sys.exit(1)
if any(c.startswith("tests/") for c in changed()):
    print("tests were modified", changed()); sys.exit(1)
''')

# 3. rename across files
task("rename-multifile",
     "Rename the function calc_total to compute_total everywhere in this project: the definition and every place that uses it. Behaviour must stay the same.",
     {"shop/__init__.py": "",
      "shop/pricing.py": '''
        TAX = 0.1


        def calc_total(prices, discount=0.0):
            subtotal = sum(prices) * (1 - discount)
            return round(subtotal * (1 + TAX), 2)
        ''',
      "shop/cart.py": '''
        from shop.pricing import calc_total


        class Cart:
            def __init__(self):
                self.prices = []

            def add(self, price):
                self.prices.append(price)

            def total(self):
                return calc_total(self.prices)
        ''',
      "shop/checkout.py": '''
        from shop import pricing
        from shop.cart import Cart


        def checkout(cart: Cart, coupon=None):
            discount = 0.2 if coupon == "SAVE20" else 0.0
            return pricing.calc_total(cart.prices, discount=discount)
        ''',
      "main.py": '''
        from shop.cart import Cart
        from shop.checkout import checkout

        c = Cart()
        for p in (10, 20, 30):
            c.add(p)
        print(c.total(), checkout(c, "SAVE20"))
        '''},
     COMMON + '''
for p in REPO.rglob("*.py"):
    if "calc_total" in p.read_text():
        print("still in", p); sys.exit(1)
out = run(sys.executable, "main.py").stdout.strip()
if out != "66.0 52.8":
    print("main.py printed", repr(out)); sys.exit(1)
py("from shop.pricing import compute_total; assert compute_total([100], 0.5) == 55.0")
''')

# 4. add a flag to a CLI
task("cli-json-flag",
     """
     Add a --json option to wordcount.py. With --json it prints one JSON object
     {"lines": ..., "words": ..., "chars": ...} instead of the normal output. Without --json the output must not change.
     """,
     {"wordcount.py": '''
        import argparse
        import sys


        def counts(text):
            return len(text.splitlines()), len(text.split()), len(text)


        def main(argv=None):
            ap = argparse.ArgumentParser(description="count lines, words and characters")
            ap.add_argument("file", nargs="?", help="file to read (default: stdin)")
            args = ap.parse_args(argv)
            text = open(args.file).read() if args.file else sys.stdin.read()
            lines, words, chars = counts(text)
            print(f"{lines} {words} {chars}")


        if __name__ == "__main__":
            main()
        ''',
      "sample.txt": "the quick brown fox\njumps over\nthe lazy dog\n"},
     COMMON + '''
r = run(sys.executable, "wordcount.py", "sample.txt")
if r.stdout.strip() != "3 9 44":
    print("plain output changed:", repr(r.stdout)); sys.exit(1)
r = run(sys.executable, "wordcount.py", "--json", "sample.txt")
try:
    d = json.loads(r.stdout)
except Exception:
    print("not json:", repr(r.stdout), r.stderr); sys.exit(1)
if d != {"lines": 3, "words": 9, "chars": 44}:
    print("wrong json", d); sys.exit(1)
r = run(sys.executable, "wordcount.py", "--json", input="a b\\nc\\n")
if json.loads(r.stdout) != {"lines": 2, "words": 3, "chars": 6}:
    print("stdin json wrong", r.stdout); sys.exit(1)
''')

# 5. answer a question about the code, change nothing
task("code-question",
     """
     In this project, what is the longest delay (in seconds) the client waits between two retries, and in which
     function is that limit applied? Do not change any files. End your answer with one line in the form:
     ANSWER: <seconds> <function name>
     """,
     {"README.md": "# weatherfetch\n\nFetches forecasts from a remote API.\n",
      "weatherfetch/__init__.py": "",
      "weatherfetch/config.py": '''
        BASE_URL = "https://api.example.com/v2"
        TIMEOUT = 10.0
        MAX_ATTEMPTS = 6
        BACKOFF_BASE = 0.5
        BACKOFF_CAP = 12.0
        ''',
      "weatherfetch/net.py": '''
        import random
        import time

        from weatherfetch import config


        def backoff_delay(attempt):
            """Seconds to sleep before retry number `attempt` (0-based), with jitter."""
            delay = config.BACKOFF_BASE * (2 ** attempt)
            delay = min(delay, config.BACKOFF_CAP)
            return delay * random.uniform(0.8, 1.0)


        def with_retries(fn):
            last = None
            for attempt in range(config.MAX_ATTEMPTS):
                try:
                    return fn()
                except OSError as e:
                    last = e
                    time.sleep(backoff_delay(attempt))
            raise last
        ''',
      "weatherfetch/client.py": '''
        import json
        import urllib.request

        from weatherfetch import config
        from weatherfetch.net import with_retries


        def get_forecast(city):
            url = f"{config.BASE_URL}/forecast?city={city}"

            def call():
                with urllib.request.urlopen(url, timeout=config.TIMEOUT) as r:
                    return json.load(r)

            return with_retries(call)
        '''},
     COMMON + '''
import re
if changed():
    print("files changed:", changed()); sys.exit(1)
m = re.findall(r"ANSWER:\\s*([0-9.]+)\\s*(?:seconds|secs|sec|s)?\\s*[`'\\"]?([A-Za-z_][A-Za-z0-9_.]*)", ANSWER)
if not m:
    print("no ANSWER line:", ANSWER[-300:]); sys.exit(1)
secs, fn = m[-1]
if float(secs) != 12.0 or not fn.endswith("backoff_delay"):
    print("wrong answer:", m[-1]); sys.exit(1)
''')

# 6. write a new function from a spec
task("new-function-spec",
     """
     Add a function slugify(text) to text_utils.py. It must: convert to lowercase; turn accented letters into plain
     ASCII (é -> e, ç -> c) and drop other non-ASCII characters; replace every run of characters that are not a-z or 0-9
     with a single hyphen; and strip hyphens from the start and end. Example: slugify("Héllo, World!") == "hello-world".
     """,
     {"text_utils.py": '''
        def word_count(text):
            return len(text.split())


        def truncate(text, n, suffix="..."):
            if len(text) <= n:
                return text
            return text[: max(0, n - len(suffix))] + suffix
        '''},
     COMMON + '''
py("""
from text_utils import slugify, truncate, word_count
cases = {
    "Héllo, World!": "hello-world",
    "  --Foo__Bar--  ": "foo-bar",
    "": "",
    "Ça va? 100%": "ca-va-100",
    "already-a-slug": "already-a-slug",
    "日本 Tokyo": "tokyo",
    "a   b\\tc": "a-b-c",
}
for k, v in cases.items():
    got = slugify(k)
    assert got == v, (k, got, v)
assert word_count("a b") == 2 and truncate("hello", 3) == "..."
""")
''')

# 7. a fix inside a long file
FUNCS = "\n\n".join(textwrap.dedent(f'''
    def metric_{i:02d}(rows):
        """Sum of column {i % 7} over the rows, ignoring None values."""
        return sum(r[{i % 7}] for r in rows if r[{i % 7}] is not None)
    ''').strip() for i in range(40))
task("long-file-fix",
     """
     In report.py, format_currency() should format amounts with a dollar sign, a thousands separator and exactly two
     decimals, e.g. format_currency(1234.5) == "$1,234.50" and format_currency(-0.456) == "-$0.46". Fix it.
     """,
     {"report.py": '"""Report helpers: column metrics and formatting."""\n\nimport math\n\n\n' + FUNCS + '''


def format_percent(x):
    return f"{x * 100:.1f}%"


def format_currency(amount):
    return "$" + str(round(amount, 1))


def summary(rows):
    total = metric_00(rows)
    return f"total {format_currency(total)} over {len(rows)} rows"


''' + "\n\n".join(textwrap.dedent(f'''
    def ratio_{i:02d}(a, b):
        """a / b, or 0.0 when b is zero ({i})."""
        return a / b if b else 0.0
    ''').strip() for i in range(40)) + "\n"},
     COMMON + '''
py("""
from report import format_currency, format_percent, summary, metric_03, ratio_10
assert format_currency(1234.5) == "$1,234.50", format_currency(1234.5)
assert format_currency(-0.456) == "-$0.46", format_currency(-0.456)
assert format_currency(0) == "$0.00"
assert format_currency(1000000) == "$1,000,000.00"
assert format_percent(0.123) == "12.3%" and ratio_10(1, 0) == 0.0
assert summary([[1, 0, 0, 0, 0, 0, 0]]) == "total $1.00 over 1 rows"
""")
''')

# ---------------------------------------------------------------- harder tasks (prefix h-)

# 8. implement a data structure from a spec
task("h-lru-cache",
     """
     Create lru.py with a class LRUCache(capacity). get(key) returns the value or None and marks the key as most
     recently used. put(key, value) inserts or updates the key (an update also makes it most recently used); when the
     cache holds more than `capacity` keys it evicts the least recently used one. capacity 0 means nothing is ever
     stored. len(cache) returns the number of keys, and `key in cache` works without changing the order. Add tests in
     test_lru.py and run them.
     """,
     {"README.md": "# lru\n\nA small LRU cache.\n"},
     COMMON + '''
py("""
from lru import LRUCache
c = LRUCache(2)
c.put("a", 1); c.put("b", 2)
assert c.get("a") == 1
c.put("c", 3)                 # evicts b (a was used)
assert c.get("b") is None and c.get("c") == 3 and len(c) == 2
c.put("a", 10)                # update makes a most recent
c.put("d", 4)                 # evicts c
assert "c" not in c and c.get("a") == 10 and c.get("d") == 4
assert "a" in c
c2 = LRUCache(2); c2.put("x", 1); c2.put("y", 2)
assert "x" in c2              # membership must not refresh x
c2.put("z", 3)
assert c2.get("x") is None and c2.get("y") == 2
z = LRUCache(0); z.put("k", 1)
assert len(z) == 0 and z.get("k") is None
c3 = LRUCache(1); c3.put("k", None)
assert "k" in c3 and len(c3) == 1
""")
if not (REPO / "test_lru.py").exists():
    print("no test_lru.py"); sys.exit(1)
''')

# 9. two bugs in a small expression evaluator split over three files
task("h-calc-bugs",
     """
     calc("10 - 2 - 3") returns 11 instead of 5, and calc("-4 + 2") raises an error instead of returning -2.
     Fix both bugs in the calculator package. Keep the existing behaviour for everything else.
     """,
     {"calculator/__init__.py": "from calculator.evaluate import calc\n",
      "calculator/tokens.py": '''
        import re

        TOKEN = re.compile(r"\\s*(?:(\\d+\\.?\\d*)|(.))")


        def tokenize(src):
            out = []
            for num, op in TOKEN.findall(src):
                if num:
                    out.append(("num", float(num)))
                elif op.strip():
                    out.append(("op", op))
            return out
        ''',
      "calculator/parser.py": '''
        """Recursive-descent parser: expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ;
        factor := NUMBER | '(' expr ')'"""


        class Parser:
            def __init__(self, tokens):
                self.toks = tokens
                self.i = 0

            def peek(self):
                return self.toks[self.i] if self.i < len(self.toks) else (None, None)

            def take(self):
                t = self.peek()
                self.i += 1
                return t

            def expr(self):
                left = self.term()
                if self.peek() in (("op", "+"), ("op", "-")):
                    op = self.take()[1]
                    right = self.expr()
                    return (op, left, right)
                return left

            def term(self):
                left = self.factor()
                while self.peek() in (("op", "*"), ("op", "/")):
                    op = self.take()[1]
                    left = (op, left, self.factor())
                return left

            def factor(self):
                kind, val = self.take()
                if kind == "num":
                    return val
                if (kind, val) == ("op", "("):
                    node = self.expr()
                    if self.take() != ("op", ")"):
                        raise SyntaxError("expected )")
                    return node
                raise SyntaxError(f"unexpected {val!r}")
        ''',
      "calculator/evaluate.py": '''
        from calculator.parser import Parser
        from calculator.tokens import tokenize

        OPS = {"+": lambda a, b: a + b, "-": lambda a, b: a - b, "*": lambda a, b: a * b, "/": lambda a, b: a / b}


        def evaluate(node):
            if isinstance(node, float):
                return node
            op, a, b = node
            return OPS[op](evaluate(a), evaluate(b))


        def calc(src):
            p = Parser(tokenize(src))
            node = p.expr()
            if p.peek() != (None, None):
                raise SyntaxError("trailing input")
            return evaluate(node)
        '''},
     COMMON + '''
py("""
from calculator import calc
cases = {"10 - 2 - 3": 5.0, "-4 + 2": -2.0, "2 * 3 + 4": 10.0, "2 + 3 * 4": 14.0, "(1 + 2) * 3": 9.0,
         "8 / 4 / 2": 1.0, "-(2 + 3)": -5.0, "3 - -2": 5.0, "2 * -3": -6.0, "1 - 2 + 3": 2.0, "7": 7.0, "--1": 1.0}
for k, v in cases.items():
    got = calc(k)
    assert got == v, (k, got, v)
for bad in ("1 +", "(1 + 2", "1 2"):
    try:
        calc(bad)
    except (SyntaxError, ValueError, TypeError, IndexError):
        pass
    else:
        raise AssertionError("no error for " + bad)
""")
''')

# 10. a crash whose cause is in another file
task("h-traceback-root-cause",
     """
     Running `python app.py` crashes. Find the root cause and fix it there (do not just catch the exception).
     Check the other settings for the same kind of problem. After the fix `python app.py` must print the report.
     """,
     {"app.py": '''
        from settings import load_settings
        from report import build_report

        if __name__ == "__main__":
            s = load_settings("settings.ini")
            print(build_report([12.5, 7.25, 30.0, 4.0], s))
        ''',
      "settings.ini": "[report]\ntitle = Weekly sales\ntop_n = 3\ncurrency = EUR\nshow_total = yes\n",
      "settings.py": '''
        import configparser


        def load_settings(path):
            cp = configparser.ConfigParser()
            cp.read(path)
            sec = cp["report"]
            return {
                "title": sec.get("title", "Report"),
                "top_n": sec.get("top_n", "5"),
                "currency": sec.get("currency", "USD"),
                "show_total": sec.get("show_total", "no"),
            }
        ''',
      "report.py": '''
        def build_report(values, settings):
            top = sorted(values, reverse=True)[: settings["top_n"]]
            lines = [settings["title"]]
            for v in top:
                lines.append(f"  {v:8.2f} {settings['currency']}")
            if settings["show_total"]:
                lines.append(f"  total {sum(values):.2f} {settings['currency']}")
            return "\\n".join(lines)
        '''},
     COMMON + '''
r = run(sys.executable, "app.py")
want = "Weekly sales\\n     30.00 EUR\\n     12.50 EUR\\n      7.25 EUR\\n  total 53.75 EUR"
if r.stdout.strip("\\n") != want:
    print("output:", repr(r.stdout), r.stderr[-300:]); sys.exit(1)
src = (REPO / "report.py").read_text() + (REPO / "app.py").read_text()
if "except" in src:
    print("exception swallowed"); sys.exit(1)
py("""
from settings import load_settings
from report import build_report
import pathlib
pathlib.Path("t.ini").write_text("[report]\\\\ntop_n = 2\\\\nshow_total = no\\\\n")
s = load_settings("t.ini")
assert s["top_n"] == 2, s
out = build_report([1.0, 2.0, 3.0], s)
assert "total" not in out and len(out.splitlines()) == 3, out
""")
''')

# 11. a feature that touches model, storage and CLI
task("h-todo-priority",
     """
     Add priorities to the todo app. `python todo.py add "text" --priority high` stores a priority (low, normal or high;
     default normal; any other value is an error with exit code 2). `python todo.py list` prints tasks sorted by
     priority (high first), keeping insertion order within the same priority, in the form `[high] text`. Existing
     todos.json files without a priority must still load (treat them as normal).
     """,
     {"todo.py": '''
        import argparse

        from todo_store import Store


        def main(argv=None):
            ap = argparse.ArgumentParser()
            sub = ap.add_subparsers(dest="cmd", required=True)
            a = sub.add_parser("add")
            a.add_argument("text")
            sub.add_parser("list")
            args = ap.parse_args(argv)
            store = Store("todos.json")
            if args.cmd == "add":
                store.add(args.text)
            else:
                for item in store.items():
                    print(f"- {item.text}")


        if __name__ == "__main__":
            main()
        ''',
      "todo_store.py": '''
        import json
        import os

        from todo_model import Todo


        class Store:
            def __init__(self, path):
                self.path = path

            def _load(self):
                if not os.path.exists(self.path):
                    return []
                with open(self.path) as f:
                    return [Todo(**d) for d in json.load(f)]

            def _save(self, todos):
                with open(self.path, "w") as f:
                    json.dump([t.to_dict() for t in todos], f, indent=1)

            def add(self, text):
                todos = self._load()
                todos.append(Todo(text=text))
                self._save(todos)

            def items(self):
                return self._load()
        ''',
      "todo_model.py": '''
        from dataclasses import dataclass, asdict


        @dataclass
        class Todo:
            text: str
            done: bool = False

            def to_dict(self):
                return asdict(self)
        '''},
     COMMON + '''
import json as _j
(REPO / "todos.json").write_text(_j.dumps([{"text": "old one", "done": False}]))
for args in (["add", "write report", "--priority", "low"], ["add", "fix bug", "--priority", "high"], ["add", "lunch"],
             ["add", "deploy", "--priority", "high"]):
    r = run(sys.executable, "todo.py", *args)
    if r.returncode:
        print("add failed", args, r.stderr[-300:]); sys.exit(1)
r = run(sys.executable, "todo.py", "add", "x", "--priority", "urgent")
if r.returncode != 2:
    print("bad priority exit", r.returncode); sys.exit(1)
r = run(sys.executable, "todo.py", "list")
want = ["[high] fix bug", "[high] deploy", "[normal] old one", "[normal] lunch", "[low] write report"]
got = [l.strip() for l in r.stdout.splitlines() if l.strip()]
if got != want:
    print("list:", got, r.stderr[-300:]); sys.exit(1)
''')

# ---------------------------------------------------------------- tricky tasks (prefix x-): edge cases decide them

# 12. edge cases in an algorithm the model thinks it knows
task("x-merge-intervals",
     """
     intervals.py has merge(intervals) which should merge overlapping intervals, but users report wrong results.
     Requirements: input is a list of (start, end) tuples in any order; intervals that overlap OR touch (end == next
     start) are merged; an interval with start > end is invalid and must raise ValueError; the result is sorted by
     start and the input list must not be modified. Fix merge() so it meets all of these.
     """,
     {"intervals.py": '''
        def merge(intervals):
            """Merge overlapping (start, end) intervals."""
            intervals.sort()
            out = []
            for s, e in intervals:
                if out and s < out[-1][1]:
                    out[-1] = (out[-1][0], e)
                else:
                    out.append((s, e))
            return out
        '''},
     COMMON + '''
py("""
from intervals import merge
data = [(5, 7), (1, 3), (2, 4)]
copy = list(data)
assert merge(data) == [(1, 4), (5, 7)], merge(data)
assert data == copy, "input modified"
assert merge([(1, 2), (2, 3)]) == [(1, 3)]
assert merge([(1, 10), (2, 3)]) == [(1, 10)], merge([(1, 10), (2, 3)])
assert merge([]) == []
assert merge([(3, 3)]) == [(3, 3)]
assert merge([(1, 5), (6, 8), (8, 9), (0, 0)]) == [(0, 0), (1, 5), (6, 9)]
assert merge([(-5, -1), (-2, 2)]) == [(-5, 2)]
try:
    merge([(1, 2), (5, 3)])
except ValueError:
    pass
else:
    raise AssertionError("no ValueError")
""")
''')

# 13. an algorithm from a spec with an ordering rule
task("x-toposort",
     """
     Create deps.py with a function build_order(deps) where deps maps a package name to the list of packages it depends
     on (a dependency may not appear as a key). Return a list of every package (keys and dependencies) such that each
     package comes after all its dependencies. When several packages are ready at the same time, take them in
     alphabetical order. If there is a cycle, raise ValueError with a message that contains the names in the cycle.
     """,
     {"README.md": "# deps\n"},
     COMMON + '''
py("""
from deps import build_order
assert build_order({}) == []
assert build_order({"app": ["lib", "log"], "lib": ["log"], "log": []}) == ["log", "lib", "app"]
assert build_order({"b": [], "a": [], "c": ["a"]}) == ["a", "b", "c"], build_order({"b": [], "a": [], "c": ["a"]})
assert build_order({"web": ["db", "auth"], "auth": ["db"]}) == ["db", "auth", "web"]
assert build_order({"z": ["y"], "x": []}) == ["x", "y", "z"], build_order({"z": ["y"], "x": []})
try:
    build_order({"a": ["b"], "b": ["c"], "c": ["a"], "d": []})
except ValueError as e:
    assert all(n in str(e) for n in "abc"), str(e)
else:
    raise AssertionError("no ValueError for cycle")
try:
    build_order({"self": ["self"]})
except ValueError:
    pass
else:
    raise AssertionError("no ValueError for self-cycle")
""")
''')

# 14. data processing with real-world CSV mess
task("x-csv-summary",
     """
     Write summary.py with a function summarize(path) that reads a CSV file with a header row containing at least the
     columns `region` and `amount` (other columns may exist, in any order). It returns a dict mapping each region to the
     total amount rounded to 2 decimals. Rows whose amount is empty or not a number are skipped. Region names are
     trimmed and compared case-insensitively, and reported in lowercase. Fields may be quoted and contain commas.
     Try it on sales.csv.
     """,
     {"sales.csv": 'id,amount,region,note\n1,10.50,North,ok\n2,"1000.00",south,"big, deal"\n3,,North,missing\n'
                   '4,abc,East,bad\n5,  4.25 , north ,spaces\n6,-2.5,East,refund\n7,3,"South",\n'},
     COMMON + '''
py("""
from summary import summarize
got = summarize("sales.csv")
want = {"north": 14.75, "south": 1003.0, "east": -2.5}
assert got == want, got
import pathlib
pathlib.Path("t.csv").write_text("region,amount\\\\nWest,1.005\\\\nwest,2\\\\n")
assert summarize("t.csv") in ({"west": 3.0}, {"west": 3.01}), summarize("t.csv")
pathlib.Path("e.csv").write_text("amount,region\\\\n")
assert summarize("e.csv") == {}
""")
''')

# 15. a stale-cache bug spread over several files
task("x-stale-cache",
     """
     In this app, after update_price() changes a product's price, get_product() keeps returning the old price until the
     process restarts. Find out why and fix it properly, without disabling the cache for reads.
     """,
     {"shop/__init__.py": "",
      "shop/db.py": '''
        _ROWS = {1: {"id": 1, "name": "pen", "price": 1.5}, 2: {"id": 2, "name": "ink", "price": 4.0}}
        reads = 0


        def fetch(pid):
            global reads
            reads += 1
            row = _ROWS.get(pid)
            return dict(row) if row else None


        def store(pid, **fields):
            _ROWS[pid].update(fields)
        ''',
      "shop/cache.py": '''
        class Cache:
            def __init__(self):
                self._data = {}

            def get(self, key):
                return self._data.get(key)

            def set(self, key, value):
                self._data[key] = value

            def delete(self, key):
                self._data.pop(key, None)


        cache = Cache()
        ''',
      "shop/products.py": '''
        from shop import db
        from shop.cache import cache


        def _key(pid):
            return f"product:{pid}"


        def get_product(pid):
            hit = cache.get(_key(pid))
            if hit is not None:
                return hit
            row = db.fetch(pid)
            if row is not None:
                cache.set(_key(pid), row)
            return row
        ''',
      "shop/admin.py": '''
        from shop import db
        from shop.cache import cache


        def update_price(pid, price):
            if price < 0:
                raise ValueError("price must be >= 0")
            db.store(pid, price=price)
            cache.delete(f"products:{pid}")
        '''},
     COMMON + '''
py("""
from shop import db
from shop.products import get_product
from shop.admin import update_price
assert get_product(1)["price"] == 1.5
before = db.reads
get_product(1); get_product(1)
assert db.reads == before, "reads are no longer cached"
update_price(1, 2.25)
assert get_product(1)["price"] == 2.25, get_product(1)
n = db.reads
get_product(1)
assert db.reads == n, "not cached after update"
assert get_product(2)["price"] == 4.0
""")
''')

# ---------------------------------------------------------------- a long session (prefix s-): 8 prompts in one session
S_PROMPTS = [
    """
    Create library.py with a dataclass Book(isbn: str, title: str, author: str, year: int) and a class Library that
    keeps books in memory: add(book) (adding an isbn that already exists raises ValueError), remove(isbn) (an unknown
    isbn raises KeyError) and find_by_author(name), which matches the author case-insensitively and returns a list.
    """,
    """
    Add JSON persistence to Library: save(path) writes every book to a JSON file, and a classmethod load(path) returns
    a Library with those books. load of a path that does not exist returns an empty Library.
    """,
    """
    Create cli.py, a command line interface that keeps its data in library.json in the current directory:
      python cli.py add ISBN TITLE AUTHOR YEAR
      python cli.py remove ISBN        (an unknown isbn prints an error to stderr and exits with code 1)
      python cli.py list               (sorted by year, then title)
      python cli.py search --author NAME
    list and search print one book per line in exactly this form:  YEAR TITLE by AUTHOR [ISBN]
    """,
    """
    Write unittest tests in test_library.py that cover add, the duplicate error, remove, find_by_author, save and load.
    Run them with python -m unittest and make sure they pass.
    """,
    """
    Add lending. Library.checkout(isbn, member) records who has the book; checking out a book that is already out
    raises ValueError. Library.checkin(isbn) returns it. Lending state must survive save/load. Add the CLI commands
      python cli.py checkout ISBN MEMBER
      python cli.py checkin ISBN
    (an error from either prints a message to stderr and exits with code 1). In list and search output a book that is
    out gets " (out: MEMBER)" appended to its line.
    """,
    """
    Add `python cli.py stats`, which prints exactly three lines:
      books: N
      checked out: M
      top author: NAME
    where NAME is the author with the most books (ties: the alphabetically first name; no books: top author: -).
    """,
    """
    Read the whole project and write README.md documenting every cli.py command with an example.
    """,
    """
    Add tests for lending and stats to test_library.py, run the whole test suite, and fix anything that fails.
    """,
]
task("s-library-session", "\n".join(S_PROMPTS), {"README.md": "# library\n"},
     COMMON + '''
import shutil
work = REPO / "_check"
if work.exists():
    shutil.rmtree(work)
work.mkdir()
for f in ("library.py", "cli.py"):
    shutil.copy(REPO / f, work / f)
def cli(*a):
    return subprocess.run([sys.executable, "cli.py", *a], cwd=work, capture_output=True, text=True, timeout=60)
def need(cond, msg):
    if not cond:
        print(msg); sys.exit(1)
for b in (("111", "Dune", "Frank Herbert", "1965"), ("222", "Emma", "Jane Austen", "1815"),
          ("333", "Children of Dune", "Frank Herbert", "1976"), ("444", "Persuasion", "Jane Austen", "1817"),
          ("555", "Anathem", "Neal Stephenson", "2008")):
    r = cli("add", *b); need(r.returncode == 0, f"add failed {b} {r.stderr[-200:]}")
r = cli("list")
want = ["1815 Emma by Jane Austen [222]", "1817 Persuasion by Jane Austen [444]", "1965 Dune by Frank Herbert [111]",
        "1976 Children of Dune by Frank Herbert [333]", "2008 Anathem by Neal Stephenson [555]"]
need([l.strip() for l in r.stdout.splitlines() if l.strip()] == want, "list: " + r.stdout)
r = cli("search", "--author", "frank herbert")
need([l.strip() for l in r.stdout.splitlines() if l.strip()] == want[2:4], "search: " + r.stdout)
r = cli("remove", "999"); need(r.returncode == 1 and r.stderr.strip(), f"remove unknown: {r.returncode} {r.stderr!r}")
r = cli("checkout", "111", "ann"); need(r.returncode == 0, "checkout " + r.stderr[-200:])
r = cli("checkout", "111", "bob"); need(r.returncode == 1, f"double checkout exit {r.returncode}")
r = cli("list"); need("1965 Dune by Frank Herbert [111] (out: ann)" in r.stdout, "out marker: " + r.stdout)
r = cli("stats"); need(r.stdout.split() == "books: 5 checked out: 1 top author: Frank Herbert".split(), "stats: " + r.stdout)
r = cli("checkin", "111"); need(r.returncode == 0, "checkin " + r.stderr[-200:])
r = cli("remove", "333"); need(r.returncode == 0, "remove " + r.stderr[-200:])
r = cli("stats"); need(r.stdout.split() == "books: 4 checked out: 0 top author: Jane Austen".split(), "stats2: " + r.stdout)
r = run(sys.executable, "-m", "unittest", "-q")
need(r.returncode == 0 and "Ran" in r.stderr, "tests: " + r.stderr[-400:])
readme = (REPO / "README.md").read_text()
need(all(c in readme for c in ("add", "remove", "list", "search", "checkout", "checkin", "stats")), "README incomplete")
''', prompts=S_PROMPTS)

# ---------------------------------------------------------------- a longer session: 10 prompts over 32 modules
import long_task  # noqa: E402

task("s-fleet-session", "\n".join(long_task.PROMPTS), long_task.files(), COMMON + long_task.check_code(),
     prompts=long_task.PROMPTS)

print("tasks:", sorted(p.name for p in ROOT.iterdir()))
