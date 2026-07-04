# Family Tree

A small self-hosted family tree site: an interactive, pan/zoom tree diagram, search, and
in-browser add/edit forms. No account system — anyone with the link can view, search, add,
and edit people (it's meant for a private family link, not the open internet). Downloading or
restoring a full backup of the data are the two actions gated behind an admin passcode.

Backups are self-contained: uploaded photos are embedded in the backup JSON as base64 (not
just referenced by path), so restoring a backup brings the photos back too, not just the names
and relationships.

## Running it locally

```
npm install
npm start
```

Then open http://localhost:3000. With no further setup, it uses a plain local SQLite file
(`data/family.db`) — nothing else to configure for local development.

On first run the server also generates a random admin passcode and prints it to the terminal:

```
Admin passcode (only needed to download/restore backups): aabd0ff7
```

That passcode is only needed if you click "Log Masuk Admin" (Admin Login) to download
(Sandaran) or restore (Muat Naik Sandaran) a backup — it's saved to `data/admin-passcode.txt`
so it stays the same across restarts. You can set your own instead via the `ADMIN_PASSCODE`
environment variable (the older `EDIT_PASSCODE` name still works too, for compatibility).

**Restoring a backup replaces all current data** — it intentionally overwrites whatever's
currently there rather than merging, since the point is to recover a full known-good state.

## How it works

- **Database:** [Turso](https://turso.tech) — a free hosted, SQLite-compatible database — via
  `@libsql/client` (`db.js`). In production this means family data and photos live independently
  of the app server's disk, so they survive redeploys and restarts on *any* host, including a
  free tier with no persistent disk. Locally, with no `TURSO_DATABASE_URL` env var set, it
  transparently falls back to a plain SQLite file at `data/family.db` — no Turso account needed
  for local development.
- **Photos:** stored as BLOBs in the database itself (a `photos` table), served via
  `GET /api/photos/:id` — not written to local disk — so they persist the same way the rest of
  the data does. Picking a photo in the add/edit form opens a crop/zoom step (via
  [Cropper.js](https://github.com/fengyuanchen/cropperjs), loaded from a CDN) so every photo is
  resized to a consistent 400×400 square before upload, keeping file sizes small.
- **Backend:** `server.js` — a small Express API (`/api/people`, `/api/spouses`, `/api/photos`).
  Only `/api/backup/export` and `/api/backup/import` require the admin passcode
  (`x-admin-passcode` header, see `auth.js`) — everything else is open so any family member can
  add/edit without a login.
- **Frontend:** plain HTML/CSS/JS in `public/` — no build step. `app.js` computes a
  generation-based layout from parent/child and spouse relationships and renders it with D3
  (pan/zoom, search-to-focus, click-for-detail panel, add/edit modal). It also supports
  light/dark mode, a mobile-responsive layout, and uses the History API so the Android/mobile
  back button closes an open panel or modal instead of leaving the page.

## Deploying it online

Because data and photos now live in Turso rather than on local disk, **any** host works fine,
including free tiers that don't offer persistent disk storage (e.g. Render's free web service
plan) — there's no more risk of losing data on redeploy or restart.

To deploy:

1. Set these two environment variables on your host (same values as your local `.env`, which is
   never committed to git):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
2. Also set `ADMIN_PASSCODE` to a passcode of your choosing.
3. Build command: `npm install`. Start command: `npm start`.

That's it — no disk, no volume, no paid plan required for data persistence.

Let me know if you'd like help setting up hosting or walking through any of this — happy to do
that next.
