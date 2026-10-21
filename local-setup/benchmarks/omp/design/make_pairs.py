#!/usr/bin/env python3
"""make_pairs.py COND_A COND_B OUTDIR -- blind A/B pairs of screenshots per task/sample.
Writes OUTDIR/pair-NN/{A,B}-{desktop,mobile}.png and a private key file."""
import json, os, random, shutil, subprocess, sys
from PIL import Image
B = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(B))), "agents", "omp", "skills", "ui-design", "scripts", "ui-audit.mjs")
ca, cb, out = sys.argv[1], sys.argv[2], sys.argv[3]
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
rng = random.Random(7)
key, n = {}, 0
def shots(cond, run):
    d = f"{B}/runs/{cond}/{run}"
    if run.startswith("egui"):
        return {"app": f"{d}/shot.png"} if os.path.exists(f"{d}/shot.png") else {}
    s = {}
    f = f"{d}/shots/1440.png"
    if os.path.exists(f): s["desktop"] = f
    # Phone: real 390x844 viewport screens (scrolled), stitched side by side. Full-page
    # captures misplace fixed bars, which made a judge flag overlaps that don't exist.
    if os.path.exists(f"{d}/index.html"):
        vd = f"{d}/judge-views"
        if not os.path.exists(f"{vd}/mobile-1.png"):
            subprocess.run(["node", AUDIT, f"{d}/index.html", "--widths", "390", "--views", vd],
                           capture_output=True, timeout=120)
        screens = [Image.open(f"{vd}/mobile-{i}.png") for i in (1, 2, 3) if os.path.exists(f"{vd}/mobile-{i}.png")]
        if screens:
            strip = Image.new("RGB", (sum(i.width for i in screens) + 24 * (len(screens) - 1), max(i.height for i in screens)), (40, 40, 40))
            x = 0
            for im in screens:
                strip.paste(im.convert("RGB"), (x, 0)); x += im.width + 24
            out_f = f"{vd}/strip.png"; strip.save(out_f); s["mobile"] = out_f
    return s
runs = sorted(set(os.listdir(f"{B}/runs/{ca}")) & set(os.listdir(f"{B}/runs/{cb}")))
for run in runs:
    n += 1
    p = f"{out}/pair-{n:02d}"; os.makedirs(p)
    flip = rng.random() < 0.5
    sides = {"A": cb if flip else ca, "B": ca if flip else cb}
    key[f"pair-{n:02d}"] = {"run": run, **sides}
    for side, cond in sides.items():
        s = shots(cond, run)
        if not s:
            open(f"{p}/{side}-MISSING.txt", "w").write("no output / did not build\n")
        for tag, f in s.items():
            im = Image.open(f).convert("RGB")
            if tag == "desktop" and im.height > 2600:   # first ~2.5 screens is what a judge sees first
                im = im.crop((0, 0, im.width, 2600))
            im.save(f"{p}/{side}-{tag}.png")
json.dump(key, open(f"{B}/results/key-{ca}-vs-{cb}.json", "w"), indent=1)
print(f"{n} pairs in {out}")
