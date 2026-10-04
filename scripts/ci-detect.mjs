// scripts/ci-detect.mjs — daftar slug app yang berubah (JSON array ke stdout)
// arg1: base commit ref; kosong = semua app (initial push / force push)
import { execSync } from "node:child_process";

let base = process.argv[2] || "";
// base commit tidak ada (initial push / force push / shallow) → deploy semua app
try {
  execSync(`git cat-file -e ${base}^{commit}`, { stdio: "ignore" });
} catch {
  base = "";
}
const files = (base
  ? execSync(`git diff --name-only ${base} HEAD`)
  : execSync("git ls-files")
).toString().split("\n").filter(Boolean);

const slugs = new Set();
for (const f of files) {
  const m = f.match(/^apps\/([^/]+)\//);
  if (m) slugs.add(m[1]);
}
process.stdout.write(JSON.stringify([...slugs]));
