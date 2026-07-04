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
  PASSCODE, requireAdmin, timingSafeEqual,
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

function personRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    birthDate: row.birth_date,
    deathDate: row.death_date,
    bio: row.bio,
    photoPath: row.photo_path,
    fatherId: row.father_id,
    motherId: row.mother_id,
  };
}

async function getAllSpousePairs() {
  const result = await client.execute('SELECT person_id, spouse_id FROM spouses');
  return result.rows.map((r) => ({ personId: r.person_id, spouseId: r.spouse_id }));
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
  const peopleResult = await client.execute('SELECT * FROM people ORDER BY id');
  const people = peopleResult.rows.map(personRow);
  const spousePairs = await getAllSpousePairs();
  res.json({ people, spousePairs });
}));

app.post('/api/auth/verify', (req, res) => {
  const { passcode } = req.body || {};
  res.json({ ok: timingSafeEqual(passcode || '', PASSCODE) });
});

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
  const result = await client.execute({
    sql: `INSERT INTO people (first_name, last_name, gender, birth_date, death_date, bio, photo_path, father_id, mother_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      String(b.firstName).trim(),
      b.lastName ? String(b.lastName).trim() : '',
      b.gender || 'unknown',
      b.birthDate || null,
      b.deathDate || null,
      b.bio || null,
      b.photoPath || null,
      b.fatherId || null,
      b.motherId || null,
    ],
  });
  const row = await client.execute({
    sql: 'SELECT * FROM people WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });
  res.status(201).json(personRow(row.rows[0]));
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

  await client.execute({
    sql: `UPDATE people SET first_name = ?, last_name = ?, gender = ?, birth_date = ?, death_date = ?,
          bio = ?, photo_path = ?, father_id = ?, mother_id = ? WHERE id = ?`,
    args: [
      String(b.firstName).trim(),
      b.lastName ? String(b.lastName).trim() : '',
      b.gender || 'unknown',
      b.birthDate || null,
      b.deathDate || null,
      b.bio || null,
      b.photoPath || null,
      b.fatherId || null,
      b.motherId || null,
      id,
    ],
  });
  const row = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [id] });
  res.json(personRow(row.rows[0]));
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

// ---- backup / restore (admin-only) ----

app.get('/api/backup/export', requireAdmin, asyncRoute(async (req, res) => {
  const peopleResult = await client.execute('SELECT * FROM people ORDER BY id');
  const people = peopleResult.rows.map(personRow);
  const spousePairs = await getAllSpousePairs();

  const photos = {};
  for (const p of people) {
    if (p.photoPath && !photos[p.photoPath]) {
      const photoId = p.photoPath.split('/').pop();
      const photoResult = await client.execute({ sql: 'SELECT content_type, data FROM photos WHERE id = ?', args: [photoId] });
      const row = photoResult.rows[0];
      if (row) {
        photos[p.photoPath] = { contentType: row.content_type, data: Buffer.from(row.data).toString('base64') };
      }
    }
  }

  res.setHeader('Content-Disposition', 'attachment; filename="family-tree-backup.json"');
  res.json({ exportedAt: new Date().toISOString(), people, spousePairs, photos });
}));

app.post('/api/backup/import', requireAdmin, asyncRoute(async (req, res) => {
  const { people, spousePairs, photos } = req.body || {};
  if (!Array.isArray(people) || !Array.isArray(spousePairs)) {
    return res.status(400).json({ error: 'Fail sandaran mesti mengandungi array "people" dan "spousePairs"' });
  }

  const statements = [
    { sql: 'DELETE FROM spouses', args: [] },
    { sql: 'DELETE FROM people', args: [] },
    { sql: 'DELETE FROM photos', args: [] },
  ];
  people.forEach((p) => {
    statements.push({
      sql: `INSERT INTO people (id, first_name, last_name, gender, birth_date, death_date, bio, photo_path, father_id, mother_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.id, p.firstName, p.lastName || '', p.gender || 'unknown',
        p.birthDate || null, p.deathDate || null, p.bio || null, p.photoPath || null,
        p.fatherId || null, p.motherId || null,
      ],
    });
  });
  spousePairs.forEach(({ personId, spouseId }) => {
    const [lo, hi] = personId < spouseId ? [personId, spouseId] : [spouseId, personId];
    statements.push({ sql: 'INSERT OR IGNORE INTO spouses (person_id, spouse_id) VALUES (?, ?)', args: [lo, hi] });
  });
  if (photos && typeof photos === 'object') {
    Object.entries(photos).forEach(([photoPath, photoData]) => {
      const id = photoPath.split('/').pop();
      const contentType = (photoData && photoData.contentType) || 'image/jpeg';
      const base64 = (photoData && photoData.data) || photoData;
      if (typeof base64 !== 'string') return;
      statements.push({
        sql: 'INSERT INTO photos (id, content_type, data) VALUES (?, ?, ?)',
        args: [id, contentType, Buffer.from(base64, 'base64')],
      });
    });
  }

  try {
    await client.batch(statements, 'write');
  } catch (err) {
    return res.status(400).json({ error: 'Import gagal: ' + err.message });
  }
  res.json({ ok: true, imported: people.length });
}));

ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Family tree site running at http://localhost:${PORT}`);
      console.log(`Database: ${process.env.TURSO_DATABASE_URL ? 'Turso (remote)' : 'local SQLite file'}`);
      if (!process.env.ADMIN_PASSCODE && !process.env.EDIT_PASSCODE) {
        console.log(`Admin passcode (only needed to download/restore backups): ${PASSCODE}`);
      }
    });
  })
  .catch((err) => {
    console.error('Failed to initialize the database:', err);
    process.exit(1);
  });
