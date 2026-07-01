# Family Tree

A small self-hosted family tree site: an interactive, pan/zoom tree diagram, search, and
in-browser add/edit forms. No account system — anyone with the link can view, search, add,
and edit people (it's meant for a private family link, not the open internet). Downloading or
restoring a full backup of the data are the two actions gated behind an admin passcode.

Backups are self-contained: uploaded photos are embedded in the backup JSON as base64 (not
just referenced by path), so restoring a backup on a fresh/wiped deployment brings the photos
back too, not just the names and relationships.

## Running it locally

```
npm install
npm start
```

Then open http://localhost:3000. On first run the server generates a random admin passcode
and prints it to the terminal, e.g.:

```
Admin passcode (only needed to download backups): aabd0ff7
```

That passcode is only needed if you click "Log Masuk Admin" (Admin Login) to download
(Sandaran) or restore (Muat Naik Sandaran) a backup — it's saved to `data/admin-passcode.txt`
so it stays the same across restarts. You can set your own instead by setting the
`ADMIN_PASSCODE` environment variable before starting the server (the older `EDIT_PASSCODE`
name still works too, for compatibility).

**Restoring a backup replaces all current data** — the whole point is to recover after a
redeploy wipes the free-tier disk, so it intentionally overwrites whatever's currently there
rather than merging.

All data lives in `data/family.db` (a SQLite database file) plus uploaded photos in
`data/uploads/`. That whole `data/` folder is what you'd back up.

## How it works

- **Backend:** `server.js` — a small Express API (`/api/people`, `/api/spouses`, `/api/photos`)
  backed by Node's built-in SQLite (`db.js`). Only `/api/backup/export` and
  `/api/backup/import` require the admin passcode (`x-admin-passcode` header, see `auth.js`) —
  everything else is open so any family member can add/edit without a login.
- **Frontend:** plain HTML/CSS/JS in `public/` — no build step. `app.js` computes a
  generation-based layout from parent/child and spouse relationships and renders it with D3
  (pan/zoom, search-to-focus, click-for-detail panel, add/edit modal). It also supports
  light/dark mode, a mobile-responsive layout, and uses the History API so the Android/mobile
  back button closes an open panel or modal instead of leaving the page.
- **Photo upload:** picking a photo opens a crop/zoom step (via [Cropper.js](https://github.com/fengyuanchen/cropperjs),
  loaded from a CDN) so every profile photo gets resized down to a consistent 400×400 square
  before upload, keeping file sizes small and avatars consistently framed.

## Deploying it online

Because this app keeps its data in a local SQLite file, it needs a host that gives the app
**persistent disk storage** — not a "serverless"/static host like Vercel or Netlify, where
written files disappear.

Reasonable options:

| Host | Cost | Notes |
|---|---|---|
| **Render** (Starter plan + 1GB disk) | ~$7/month | Simplest: deploy straight from a GitHub repo, attach a persistent disk mounted at `/opt/render/project/src/data`, done. Render's *free* web service tier does **not** support persistent disks, so data could be lost on redeploys — not recommended for real family data. |
| **Railway** | Free trial credit, then usage-based (often a few $/month for a small app) | Supports persistent volumes; deploy via CLI or GitHub. |
| **Fly.io** | Small free allowance, then usage-based | Supports persistent volumes; deploy via `flyctl`. |

I'd recommend Render's Starter plan — it's the cheapest option that reliably won't lose your
family's data, and deployment is just: push this folder to a GitHub repo, connect it on
Render, add a 1GB disk, set the `ADMIN_PASSCODE` environment variable to a passcode you choose,
and deploy.

Let me know if you'd like help setting up the GitHub repo and walking through the Render (or
another host's) setup — happy to do that next.
