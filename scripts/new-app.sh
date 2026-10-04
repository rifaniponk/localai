#!/usr/bin/env bash
# Scaffold a new app: scripts/new-app.sh <slug> [vanilla|vite]
set -euo pipefail

slug="${1:?usage: new-app.sh <slug> [vanilla|vite]}"
kind="${2:-vanilla}"
root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/apps/$slug"

[[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "slug must be lowercase alphanumeric/dash"; exit 1; }
[[ -e "$dir" ]] && { echo "apps/$slug already exists"; exit 1; }
mkdir -p "$dir"

today="$(date +%F)"
cat > "$dir/app.json" <<EOF
{
  "name": "$slug",
  "slug": "$slug",
  "description": "TODO: satu baris deskripsi",
  "stack": "$kind",
  "status": "draft",
  "created": "$today",
  "build": "",
  "dist": "."
}
EOF

if [[ "$kind" == "vanilla" ]]; then
  cat > "$dir/index.html" <<EOF
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$slug</title>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <main>
    <h1>$slug</h1>
    <p>App baru. Edit <code>apps/$slug/index.html</code>.</p>
  </main>
  <script src="./app.js"></script>
</body>
</html>
EOF
  echo "body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 720px; }" > "$dir/style.css"
  echo "console.log('$slug loaded');" > "$dir/app.js"
elif [[ "$kind" == "vite" ]]; then
  cat > "$dir/package.json" <<EOF
{
  "name": "$slug",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "devDependencies": { "vite": "^7.0.0" }
}
EOF
  cat > "$dir/vite.config.js" <<EOF
import { defineConfig } from "vite";
// WAJIB: base = /<slug>/ agar asset cocok dengan route GitHub Pages
export default defineConfig({ base: "/$slug/", build: { outDir: "dist" } });
EOF
  mkdir -p "$dir/src"
  cat > "$dir/index.html" <<EOF
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$slug</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
EOF
  echo "document.querySelector('#app').innerHTML = '<h1>$slug</h1>';" > "$dir/src/main.js"
  # patch app.json for vite
  node -e '
    const fs=require("fs");const p=process.argv[1];const m=JSON.parse(fs.readFileSync(p,"utf8"));
    m.build="npm ci && npm run build"; m.dist="dist";
    fs.writeFileSync(p, JSON.stringify(m,null,2)+"\n");
  ' "$dir/app.json"
  echo "node_modules/" > "$dir/.gitignore"
else
  echo "unknown kind: $kind (vanilla|vite)"; rm -rf "$dir"; exit 1
fi

node "$root/scripts/build-manifest.mjs" >/dev/null
echo "✔ apps/$slug dibuat ($kind). Set status 'live' di app.json saat siap, lalu push."
