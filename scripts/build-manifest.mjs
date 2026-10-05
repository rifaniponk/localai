#!/usr/bin/env node
// Scan apps/*/app.json → manifest.json (root of publish dir)
// Usage: node scripts/build-manifest.mjs [outPath]
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appsDir = join(root, "apps");
const outPath = process.argv[2] || join(root, "manifest.json");

const apps = [];
const errors = [];

for (const slug of existsSync(appsDir) ? readdirSync(appsDir) : []) {
  const p = join(appsDir, slug, "app.json");
  if (!existsSync(p)) {
    errors.push(`apps/${slug}: missing app.json`);
    continue;
  }
  let m;
  try {
    m = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    errors.push(`apps/${slug}/app.json: invalid JSON — ${e.message}`);
    continue;
  }
  for (const k of ["name", "slug", "description", "stack", "status"]) {
    if (!m[k]) errors.push(`apps/${slug}/app.json: missing field "${k}"`);
  }
  if (m.slug !== slug) errors.push(`apps/${slug}/app.json: slug "${m.slug}" != folder name "${slug}"`);
  apps.push({ ...m, path: `/${m.slug}/` });
}

if (errors.length) {
  console.error("manifest errors:\n" + errors.join("\n"));
  process.exit(1);
}

apps.sort((a, b) => (b.created || "").localeCompare(a.created || "") || a.slug.localeCompare(b.slug));
writeFileSync(outPath, JSON.stringify({ generated: new Date().toISOString(), apps }, null, 2) + "\n");
console.log(`manifest.json: ${apps.length} app(s) → ${outPath}`);
