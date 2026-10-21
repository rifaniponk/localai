#!/usr/bin/env python3
"""Screenshot a native (egui/eframe, X11-capable) app in a private Xvfb display.

    python3 egui-shot.py path/to/binary out.png [--size 1600x1000] [--wait 6]

Needs Xvfb and ImageMagick `import`. egui only repaints on input under Xvfb, so the
pointer is wiggled while the app warms up. Crops the black margin if Pillow is installed.
"""
import ctypes, os, random, subprocess, sys, time

args = sys.argv[1:]
if len(args) < 2:
    sys.exit(__doc__)
binary, out = args[0], args[1]
size = args[args.index("--size") + 1] if "--size" in args else "1600x1000"
wait = float(args[args.index("--wait") + 1]) if "--wait" in args else 6.0
disp = f":{random.randint(120, 199)}"
xv = subprocess.Popen(["Xvfb", disp, "-screen", "0", f"{size}x24", "-nolisten", "tcp"],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
env = dict(os.environ, DISPLAY=disp)
env.pop("WAYLAND_DISPLAY", None)
app = subprocess.Popen([os.path.abspath(binary)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    x11 = ctypes.CDLL("libX11.so.6"); xt = ctypes.CDLL("libXtst.so.6")
    x11.XOpenDisplay.restype = ctypes.c_void_p
    d = ctypes.c_void_p(x11.XOpenDisplay(disp.encode()))
    w, h = (int(v) for v in size.split("x"))
    for i in range(int(wait / 0.4)):
        xt.XTestFakeMotionEvent(d, -1, w - 60 + (i % 2) * 5, h - 40, 0); x11.XFlush(d); time.sleep(0.4)
    if app.poll() is not None:
        sys.exit(f"app exited early with code {app.returncode}")
    subprocess.run(["import", "-display", disp, "-window", "root", out], check=True)
    try:
        from PIL import Image
        im = Image.open(out).convert("RGB"); box = im.getbbox()
        if box: im.crop(box).save(out)
    except ImportError:
        pass
    print(out)
finally:
    app.terminate()
    try: app.wait(5)
    except Exception: app.kill()
    xv.terminate()
