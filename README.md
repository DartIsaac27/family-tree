# Family Tree

A small self-hosted family tree site: an interactive, pan/zoom tree diagram, search, and
in-browser add/edit forms. No account system — anyone with the link can view and search;
adding, editing, or deleting people requires a shared "edit passcode" so the page can't be
casually vandalized.

## Running it locally

```
npm install
npm start
```

Then open http://localhost:3000. On first run the server generates a random edit passcode
and prints it to the terminal, e.g.:

```
Edit passcode (share with family, keep away from strangers): 7b8641ef
```

Share that passcode with family members who should be able to add/edit people. It's saved to
`data/edit-passcode.txt` so it stays the same across restarts. You can set your own instead by
setting the `EDIT_PASSCODE` environment variable before starting the server.

All data lives in `data/family.db` (a SQLite database file) plus uploaded photos in
`data/uploads/`. That whole `data/` folder is what you'd back up.

## How it works

- **Backend:** `server.js` — a small Express API (`/api/people`, `/api/spouses`, `/api/photos`)
  backed by Node's built-in SQLite (`db.js`). Write endpoints require the `x-edit-passcode`
  header (see `auth.js`).
- **Frontend:** plain HTML/CSS/JS in `public/` — no build step. `app.js` computes a
  generation-based layout from parent/child and spouse relationships and renders it with D3
  (pan/zoom, search-to-focus, click-for-detail panel, add/edit modal).

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
Render, add a 1GB disk, set the `EDIT_PASSCODE` environment variable to a passcode you choose,
and deploy.

Let me know if you'd like help setting up the GitHub repo and walking through the Render (or
another host's) setup — happy to do that next.
