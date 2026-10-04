# localai — Monorepo Showcase AI-Generated Apps

Repo ini menyimpan semua web app yang di-generate oleh local AI agent (Hermes + Qwen lokal).
Semua app di-serve di bawah satu domain: **localai.ponkcoding.com** via GitHub Pages.

## Struktur

```
localai/
├── apps/<slug>/          # 1 folder per app, self-contained (stack bebas)
│   ├── app.json          # manifest metadata — WAJIB
│   └── ...
├── landing/              # showcase page (root domain)
├── scripts/
│   ├── new-app.sh        # scaffold app baru (konsisten)
│   └── build-manifest.mjs# scan apps/*/app.json → manifest.json
├── .github/workflows/ci-cd.yml
└── PLAN.md               # file ini
```

## Aturan main

1. **Slug = nama folder = nama route.** App di `apps/ayam-run/` live di `localai.ponkcoding.com/ayam-run/`.
2. **Setiap app self-contained** — `package.json` + lockfile sendiri, TIDAK ada shared workspace.
3. **Base path**: app dengan bundler wajib build dengan base `/<slug>/` (Vite: `base: '/<slug>/'`, Angular: `--base-href /<slug>/`). Vanilla JS: pakai path relatif (`./style.css`).
4. **app.json wajib** — format:
   ```json
   {
     "name": "Nama Tampil",
     "slug": "ayam-run",
     "description": "satu baris",
     "stack": "vanilla-js | react | angular | ...",
     "status": "live | draft",
     "created": "YYYY-MM-DD",
     "build": "npm run build",   // string kosong = static, langsung copy
     "dist": "dist"              // folder hasil build relatif terhadap folder app; "." untuk static
   }
   ```

## CI/CD (GitHub Actions, satu workflow)

`.github/workflows/ci-cd.yml`:
- Push ke `main` → deteksi `apps/<slug>/**` yang berubah (git diff).
- **Hanya app yang berubah yang di-build** (matrix per slug).
- Landing + manifest di-rebuild hanya jika `landing/**`, `apps/*/app.json`, atau `build-manifest.mjs` berubah.
- Deploy = update inkremental ke branch `gh-pages`: folder app yang berubah ditimpa, sisanya utuh. Satu deploy atomic, rollback via riwayat Pages.

## Cara menambah app baru

```bash
scripts/new-app.sh <slug> [vanilla|vite]
```
Lalu commit + push → CI build app itu saja → live di `localai.ponkcoding.com/<slug>/`.
Untuk Angular: scaffold sendiri (`ng new`), lalu buat `app.json` manual dengan
`"build": "npm run build -- --base-href /<slug>/"`, `"dist": "dist/<project>"`.

## Hosting

- GitHub Pages (branch `gh-pages`, hasil build gabungan).
- Custom domain: `localai.ponkcoding.com` (CNAME → `rifaniponk.github.io`).
- Landing page fetch `manifest.json` (statis) → kartu app otomatis, tanpa rebuild landing saat app baru ditambah (manifest ikut ter-update oleh deploy app).

## Progress log

- 2026-10-04: Init monorepo + CI/CD + landing + app contoh `hello-ai`.
