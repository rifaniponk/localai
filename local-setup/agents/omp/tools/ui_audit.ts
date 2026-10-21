// ui_audit: let the model check a page it built without needing a shell.
// Runs the ui-design skill's audit script (headless Chrome) on one HTML file
// inside the working directory and returns its text report.
import type { CustomToolFactory } from "@oh-my-pi/pi-coding-agent";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const SCRIPT = join(homedir(), ".omp/agent/skills/ui-design/scripts/ui-audit.mjs");

const factory: CustomToolFactory = (pi) => ({
  name: "ui_audit",
  label: "UI audit",
  description:
    "Render an HTML page in headless Chrome at desktop (1440px) and phone (390px) widths and report visual defects as text: " +
    "sideways overflow, overlapping/clipped/squeezed text, low contrast with ratios, content hidden under fixed bars, " +
    "duplicated navigation, repeated chart labels, small tap targets, default browser styling, broken images, JS errors. " +
    "Also saves screen-sized screenshots (desktop-N.png, mobile-N.png) in .ui-audit/ - open them with the read tool and review them. " +
    "Run it after building or changing a web page, fix every [high] and [med] item and what you see, and run it again.",
  loadMode: "essential",
  parameters: pi.zod.object({
    path: pi.zod.string().describe("HTML file to audit, relative to the working directory, e.g. index.html"),
  }),
  async execute(_id, params, _onUpdate, _ctx, signal) {
    const file = resolve(pi.cwd, params.path);
    const rel = relative(pi.cwd, file);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("path must be inside the working directory");
    if (!/\.html?$/i.test(file)) throw new Error("path must be an .html file");
    if (!existsSync(file)) throw new Error(`no such file: ${params.path}`);
    if (!existsSync(SCRIPT)) throw new Error(`audit script missing: ${SCRIPT}`);
    const r = await pi.exec("node", [SCRIPT, file, "--views", join(pi.cwd, ".ui-audit")], { signal, cwd: pi.cwd });
    if (r.code !== 0) throw new Error(r.stderr || r.stdout || "ui-audit failed");
    return { content: [{ type: "text", text: r.stdout.trim() }] };
  },
});

export default factory;
