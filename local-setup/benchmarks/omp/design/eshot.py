#!/usr/bin/env python3
"""Run an egui binary in a private Xvfb and save a cropped screenshot: eshot.py BIN OUT.png"""
import ctypes, os, subprocess, sys, time
from PIL import Image
binary, out = sys.argv[1], sys.argv[2]
disp = ":78"
xv = subprocess.Popen(["Xvfb", disp, "-screen", "0", "1600x1000x24", "-nolisten", "tcp"],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
env = dict(os.environ, DISPLAY=disp); env.pop("WAYLAND_DISPLAY", None)
app = subprocess.Popen([binary], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
x11 = ctypes.CDLL("libX11.so.6"); xt = ctypes.CDLL("libXtst.so.6")
x11.XOpenDisplay.restype = ctypes.c_void_p
d = ctypes.c_void_p(x11.XOpenDisplay(disp.encode()))
try:
    # egui only repaints on input under Xvfb: wiggle the pointer while data animates.
    for i in range(16):
        xt.XTestFakeMotionEvent(d, -1, 1500 + (i % 2) * 5, 950, 0); x11.XFlush(d); time.sleep(0.4)
    raw = out + ".raw.png"
    subprocess.run(["import", "-display", disp, "-window", "root", raw], check=True)
    im = Image.open(raw).convert("RGB"); bbox = im.getbbox()
    (im.crop(bbox) if bbox else im).save(out); os.remove(raw)
    print("alive" if app.poll() is None else f"exited {app.returncode}")
finally:
    app.terminate()
    try: app.wait(5)
    except Exception: app.kill()
    xv.terminate()
