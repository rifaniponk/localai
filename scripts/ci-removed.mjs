// scripts/ci-removed.mjs — slugs yang dihapus di push ini (JSON array ke stdout)
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

let base = process.argv[2] || "";
try {
  execSync(`git cat-file -e ${base}^{commit}`, { stdio: "ignore" });
} catch {
  base = "";
}
const files = (base
  ? execSync(`git diff --name-only ${base} HEAD`)
  : execSync("git ls-files")
).toString().split("\n").filter(Boolean);

const seen = new Set();
for (const f of files) {
  const m = f.match(/^apps\/([^/]+)\//);
  if (m && !existsSync(`apps/${m[1]}/app.json`)) seen.add(m[1]);
}
process.stdout.write(JSON.stringify([...seen]));
