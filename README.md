# Family Tree

A small self-hosted family tree site: an interactive, pan/zoom tree diagram, search, and
in-browser add/edit forms. Anyone with the link can view and search without logging in, but
adding, editing, or deleting people requires signing in with Google — this is what lets an
admin ban a misbehaving account (see "Urus Pengguna" for whoever's email is in `ADMIN_EMAILS`).
First-time visitors who log in see a short one-time walkthrough of how the site works.

Since data (and photos, as BLOBs) live in Turso rather than on local disk, backups are just a
matter of exporting from Turso directly (`turso db shell <db-name> .dump`, or the SQL Console
in the [Turso dashboard](https://app.turso.tech)) — there's no separate backup/restore feature
built into the website itself.

## Running it locally

```
npm install
npm start
```

Then open http://localhost:3000. With no further setup, it uses a plain local SQLite file
(`data/family.db`) — nothing else to configure for local development.

Without `GOOGLE_CLIENT_ID` set, local dev still runs, but nobody can log in or add/edit — see
"Setting up Google Sign-In" below to enable that. Once you have a Client ID, set it in `.env`
along with (optionally, for testing the admin ban panel) `ADMIN_EMAILS=you@example.com`.

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
  Viewing (`GET` routes) is public. Adding/editing/deleting people requires a Google login
  (session cookie, checked by `requireUser` in `server.js`) — a banned account keeps its login
  but gets a 403 on any write.
- **Accounts:** Google Sign-In (via Google Identity Services, loaded from a CDN) — the ID token
  is verified server-side with `google-auth-library`, then a signed session cookie is issued
  (`auth.js`, no external session store needed). A `users` table (`db.js`) tracks each Google
  account's status (`active`/`banned`) and whether they've completed the first-time tour.
  Whoever's email is listed in `ADMIN_EMAILS` gets access to a "Urus Pengguna" panel to ban/unban
  accounts.
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

1. Set these environment variables on your host (same values as your local `.env`, which is
   never committed to git):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `GOOGLE_CLIENT_ID` — see below
   - `ADMIN_EMAILS` — comma-separated Google account emails allowed to ban/unban users
2. Build command: `npm install`. Start command: `npm start`.

That's it — no disk, no volume, no paid plan required for data persistence.

### Setting up Google Sign-In

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project (or
   use an existing one).
2. Go to **APIs & Services → OAuth consent screen** and set it up (External user type is fine
   for a family site — you can leave it in "Testing" mode and just add family members' emails
   as test users, or publish it since it only requests basic profile info).
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**, type
   **Web application**.
4. Under **Authorized JavaScript origins**, add every URL the site is served from, e.g.
   `http://localhost:3000` for local dev and your Render URL (e.g.
   `https://family-tree-mpiv.onrender.com`) for production. No redirect URI is needed — this
   uses Google's newer Sign-In-with-a-button flow, not a redirect-based OAuth flow.
5. Copy the **Client ID** it gives you (looks like `xxxx.apps.googleusercontent.com`) — no
   client secret is needed. Set it as `GOOGLE_CLIENT_ID` in `.env` locally and in your host's
   environment variables for production.

Until `GOOGLE_CLIENT_ID` is set, the site still works for viewing, but the sign-in button shows
a "log masuk belum disediakan" (login not yet configured) note instead, and nobody can add/edit.

Let me know if you'd like help setting up hosting or walking through any of this — happy to do
that next.
