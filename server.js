const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { OAuth2Client } = require('google-auth-library');

const { client, ready } = require('./db');
const {
  SESSION_COOKIE, SESSION_MAX_AGE_MS, createSessionToken, verifySessionToken, isAdminEmail,
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---- helpers ----

function userRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    status: row.status,
    hasSeenTour: !!row.has_seen_tour,
    isAdmin: isAdminEmail(row.email),
  };
}

async function getSessionUser(req) {
  const userId = verifySessionToken(req.cookies && req.cookies[SESSION_COOKIE]);
  if (!userId) return null;
  const result = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
  return result.rows[0] || null;
}

async function attachUser(req, res, next) {
  try {
    req.sessionUser = await getSessionUser(req);
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ralat pelayan dalaman' });
  }
}

function requireUser(req, res, next) {
  if (!req.sessionUser) {
    return res.status(401).json({ error: 'Sila log masuk dengan Google untuk membuat perubahan.' });
  }
  if (req.sessionUser.status === 'banned') {
    return res.status(403).json({ error: 'Akaun anda telah disekat daripada membuat perubahan.' });
  }
  next();
}

function requireAdminUser(req, res, next) {
  if (!req.sessionUser || !isAdminEmail(req.sessionUser.email)) {
    return res.status(403).json({ error: 'Hanya admin boleh melakukan tindakan ini.' });
  }
  next();
}

app.use(attachUser);

function personRow(row, includePrivate) {
  const person = {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    nickname: row.nickname,
    gender: row.gender,
    birthDate: row.birth_date,
    deathDate: row.death_date,
    bio: row.bio,
    photoPath: row.photo_path,
    fatherId: row.father_id,
    motherId: row.mother_id,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
  };
  if (includePrivate) {
    person.address = row.address;
    person.phone = row.phone;
  }
  return person;
}

async function getAllSpousePairs() {
  const result = await client.execute('SELECT person_id, spouse_id FROM spouses');
  return result.rows.map((r) => ({ personId: r.person_id, spouseId: r.spouse_id }));
}

// Nominatim (OpenStreetMap) - free, no API key. Usage policy: max ~1 req/sec,
// identify the app via User-Agent. Only called when an address is added/changed.
async function geocodeAddress(address, state) {
  const query = [address, state, 'Malaysia'].filter(Boolean).join(', ').trim();
  if (!query) return { lat: null, lng: null };
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=my&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'family-tree-app (private family use)' } });
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    }
  } catch (err) {
    console.error('Geocoding failed:', err.message);
  }
  return { lat: null, lng: null };
}

function asyncRoute(handler) {
  return (req, res) => {
    handler(req, res).catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Ralat pelayan dalaman' });
    });
  };
}

// ---- read endpoints (public) ----

app.get('/api/people', asyncRoute(async (req, res) => {
  const includePrivate = !!req.sessionUser;
  const peopleResult = await client.execute('SELECT * FROM people ORDER BY id');
  const people = peopleResult.rows.map((row) => personRow(row, includePrivate));
  const spousePairs = await getAllSpousePairs();
  res.json({ people, spousePairs });
}));

// ---- Google login (per-person accounts, gates editing) ----

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.sessionUser ? userRow(req.sessionUser) : null });
});

app.post('/api/auth/google', asyncRoute(async (req, res) => {
  if (!googleClient) {
    return res.status(500).json({ error: 'Log masuk Google belum dikonfigurasikan di pelayan ini.' });
  }
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Tiada token Google diberikan.' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Token Google tidak sah.' });
  }

  const existing = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [payload.sub] });
  let row;
  if (existing.rows[0]) {
    await client.execute({
      sql: 'UPDATE users SET email = ?, name = ?, picture = ?, last_login = datetime(\'now\') WHERE id = ?',
      args: [payload.email, payload.name || '', payload.picture || null, payload.sub],
    });
    row = { ...existing.rows[0], email: payload.email, name: payload.name || '', picture: payload.picture || null };
  } else {
    await client.execute({
      sql: 'INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)',
      args: [payload.sub, payload.email, payload.name || '', payload.picture || null],
    });
    row = { id: payload.sub, email: payload.email, name: payload.name || '', picture: payload.picture || null, status: 'active', has_seen_tour: 0 };
  }

  if (row.status === 'banned') {
    return res.status(403).json({ error: 'Akaun ini telah disekat daripada log masuk.' });
  }

  const token = createSessionToken(payload.sub);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https',
    maxAge: SESSION_MAX_AGE_MS,
  });
  res.json({ user: userRow(row) });
}));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.post('/api/auth/seen-tour', requireUser, asyncRoute(async (req, res) => {
  await client.execute({ sql: 'UPDATE users SET has_seen_tour = 1 WHERE id = ?', args: [req.sessionUser.id] });
  res.json({ ok: true });
}));

// ---- admin user management (ban/unban, matched by Google email in ADMIN_EMAILS) ----

app.get('/api/admin/users', requireAdminUser, asyncRoute(async (req, res) => {
  const result = await client.execute('SELECT * FROM users ORDER BY created_at DESC');
  res.json({ users: result.rows.map(userRow) });
}));

app.post('/api/admin/users/:id/ban', requireAdminUser, asyncRoute(async (req, res) => {
  await client.execute({ sql: 'UPDATE users SET status = ? WHERE id = ?', args: ['banned', req.params.id] });
  res.json({ ok: true });
}));

app.post('/api/admin/users/:id/unban', requireAdminUser, asyncRoute(async (req, res) => {
  await client.execute({ sql: 'UPDATE users SET status = ? WHERE id = ?', args: ['active', req.params.id] });
  res.json({ ok: true });
}));

// ---- write endpoints (require Google login; open viewing stays public) ----

app.post('/api/people', requireUser, asyncRoute(async (req, res) => {
  const b = req.body || {};
  if (!b.firstName || !String(b.firstName).trim()) {
    return res.status(400).json({ error: 'Nama pertama diperlukan' });
  }
  const address = b.address ? String(b.address).trim() : null;
  const state = b.state || null;
  const { lat, lng } = await geocodeAddress(address, state);
  const result = await client.execute({
    sql: `INSERT INTO people (first_name, last_name, nickname, gender, birth_date, death_date, bio, photo_path, father_id, mother_id, state, address, phone, lat, lng)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      String(b.firstName).trim(),
      b.lastName ? String(b.lastName).trim() : '',
      b.nickname ? String(b.nickname).trim() : null,
      b.gender || 'unknown',
      b.birthDate || null,
      b.deathDate || null,
      b.bio || null,
      b.photoPath || null,
      b.fatherId || null,
      b.motherId || null,
      state,
      address,
      b.phone ? String(b.phone).trim() : null,
      lat,
      lng,
    ],
  });
  const row = await client.execute({
    sql: 'SELECT * FROM people WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });
  res.status(201).json(personRow(row.rows[0], true));
}));

app.put('/api/people/:id', requireUser, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [id] });
  if (!existing.rows[0]) return res.status(404).json({ error: 'Orang tidak dijumpai' });

  const b = req.body || {};
  if (!b.firstName || !String(b.firstName).trim()) {
    return res.status(400).json({ error: 'Nama pertama diperlukan' });
  }
  if ((b.fatherId && Number(b.fatherId) === id) || (b.motherId && Number(b.motherId) === id)) {
    return res.status(400).json({ error: 'Seseorang tidak boleh menjadi ibu bapa kepada dirinya sendiri' });
  }

  const address = b.address ? String(b.address).trim() : null;
  const state = b.state || null;
  const prev = existing.rows[0];
  let lat = prev.lat;
  let lng = prev.lng;
  if (address !== prev.address || state !== prev.state) {
    ({ lat, lng } = await geocodeAddress(address, state));
  }

  await client.execute({
    sql: `UPDATE people SET first_name = ?, last_name = ?, nickname = ?, gender = ?, birth_date = ?, death_date = ?,
          bio = ?, photo_path = ?, father_id = ?, mother_id = ?, state = ?, address = ?, phone = ?, lat = ?, lng = ? WHERE id = ?`,
    args: [
      String(b.firstName).trim(),
      b.lastName ? String(b.lastName).trim() : '',
      b.nickname ? String(b.nickname).trim() : null,
      b.gender || 'unknown',
      b.birthDate || null,
      b.deathDate || null,
      b.bio || null,
      b.photoPath || null,
      b.fatherId || null,
      b.motherId || null,
      state,
      address,
      b.phone ? String(b.phone).trim() : null,
      lat,
      lng,
      id,
    ],
  });
  const row = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [id] });
  res.json(personRow(row.rows[0], true));
}));

app.delete('/api/people/:id', requireUser, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [id] });
  if (!existing.rows[0]) return res.status(404).json({ error: 'Orang tidak dijumpai' });

  await client.batch([
    { sql: 'UPDATE people SET father_id = NULL WHERE father_id = ?', args: [id] },
    { sql: 'UPDATE people SET mother_id = NULL WHERE mother_id = ?', args: [id] },
    { sql: 'DELETE FROM spouses WHERE person_id = ? OR spouse_id = ?', args: [id, id] },
    { sql: 'DELETE FROM people WHERE id = ?', args: [id] },
  ], 'write');
  res.status(204).end();
}));

app.post('/api/spouses', requireUser, asyncRoute(async (req, res) => {
  const { personId, spouseId } = req.body || {};
  const a = Number(personId);
  const c = Number(spouseId);
  if (!a || !c || a === c) {
    return res.status(400).json({ error: 'Diperlukan dua ID orang yang berbeza dan sah' });
  }
  const [lo, hi] = a < c ? [a, c] : [c, a];
  await client.execute({ sql: 'INSERT OR IGNORE INTO spouses (person_id, spouse_id) VALUES (?, ?)', args: [lo, hi] });
  res.status(201).json({ personId: lo, spouseId: hi });
}));

app.delete('/api/spouses', requireUser, asyncRoute(async (req, res) => {
  const { personId, spouseId } = req.body || {};
  const a = Number(personId);
  const c = Number(spouseId);
  const [lo, hi] = a < c ? [a, c] : [c, a];
  await client.execute({ sql: 'DELETE FROM spouses WHERE person_id = ? AND spouse_id = ?', args: [lo, hi] });
  res.status(204).end();
}));

app.post('/api/photos', requireUser, upload.single('photo'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada imej sah dimuat naik' });
  const id = crypto.randomUUID();
  await client.execute({
    sql: 'INSERT INTO photos (id, content_type, data) VALUES (?, ?, ?)',
    args: [id, req.file.mimetype || 'image/jpeg', req.file.buffer],
  });
  res.status(201).json({ photoPath: `/api/photos/${id}` });
}));

app.get('/api/photos/:id', asyncRoute(async (req, res) => {
  const result = await client.execute({ sql: 'SELECT content_type, data FROM photos WHERE id = ?', args: [req.params.id] });
  const row = result.rows[0];
  if (!row) return res.status(404).end();
  res.setHeader('Content-Type', row.content_type);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(row.data));
}));

ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Family tree site running at http://localhost:${PORT}`);
      console.log(`Database: ${process.env.TURSO_DATABASE_URL ? 'Turso (remote)' : 'local SQLite file'}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize the database:', err);
    process.exit(1);
  });
