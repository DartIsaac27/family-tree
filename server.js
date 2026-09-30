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
const Names = require('./public/js/names.js');
const {
  SESSION_COOKIE, SESSION_MAX_AGE_MS, createSessionToken, verifySessionToken, isAdminEmail,
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const imageFileFilter = (req, file, cb) => {
  cb(null, IMAGE_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase()));
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });
// Memory photos are resized in the browser first (max 1600px), so 8MB is plenty.
const albumUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 2 }, fileFilter: imageFileFilter });

app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---- helpers ----

// Every error carries both languages; the site shows whichever one the
// visitor picked.
function sendError(res, status, ms, en, extra) {
  return res.status(status).json({ error: ms, errorEn: en, ...(extra || {}) });
}

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
    sendError(res, 500, 'Ralat pelayan dalaman', 'Internal server error');
  }
}

function requireUser(req, res, next) {
  if (!req.sessionUser) {
    return sendError(res, 401, 'Sila log masuk dengan Google untuk membuat perubahan.', 'Please sign in with Google to make changes.');
  }
  if (req.sessionUser.status === 'banned') {
    return sendError(res, 403, 'Akaun anda telah disekat daripada membuat perubahan.', 'Your account has been blocked from making changes.');
  }
  next();
}

function requireAdminUser(req, res, next) {
  if (!req.sessionUser || !isAdminEmail(req.sessionUser.email)) {
    return sendError(res, 403, 'Hanya admin boleh melakukan tindakan ini.', 'Only an admin can do this.');
  }
  next();
}

function canManage(user, ownerId) {
  return !!user && (isAdminEmail(user.email) || (!!ownerId && user.id === ownerId));
}

app.use(attachUser);

// Phone, address and the exact map location are private: only family
// members who are logged in can see them.
function personRow(row, includePrivate) {
  const person = {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    nickname: row.nickname,
    gender: row.gender,
    birthDate: row.birth_date,
    deathDate: row.death_date,
    isDeceased: !!row.is_deceased,
    bio: row.bio,
    photoPath: row.photo_path,
    fatherId: row.father_id,
    motherId: row.mother_id,
    state: row.state,
    birthState: row.birth_state,
  };
  if (includePrivate) {
    person.address = row.address;
    person.phone = row.phone;
    person.lat = row.lat;
    person.lng = row.lng;
  }
  return person;
}

async function getAllSpousePairs() {
  const result = await client.execute('SELECT person_id, spouse_id, sort_order FROM spouses');
  return result.rows.map((r) => ({ personId: r.person_id, spouseId: r.spouse_id, sortOrder: r.sort_order }));
}

// Nominatim (OpenStreetMap) - free, no API key. Usage policy: max ~1 req/sec,
// identify the app via User-Agent. Only called when an address is added/changed.
async function geocodeQuery(query) {
  if (!query) return null;
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
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Precise house-number-level addresses often aren't in OpenStreetMap's index
// for smaller Malaysian residential streets, so a full-address query can come
// back empty. Rather than silently falling back all the way to the state
// centre, retry with progressively shorter/more general versions of the same
// address (e.g. dropping down to just the postcode + town) before giving up.
async function geocodeAddress(address, state) {
  const attempts = [];
  if (address) {
    attempts.push(address);
    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 2) attempts.push(parts.slice(-2).join(', '));
    if (parts.length > 1) attempts.push(parts[parts.length - 1]);
  }
  if (!attempts.length && !state) return { lat: null, lng: null };

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) await sleep(350);
    const query = [attempts[i], state, 'Malaysia'].filter(Boolean).join(', ');
    const result = await geocodeQuery(query);
    if (result) return result;
  }
  return { lat: null, lng: null };
}

function asyncRoute(handler) {
  return (req, res) => {
    handler(req, res).catch((err) => {
      console.error(err);
      sendError(res, 500, 'Ralat pelayan dalaman', 'Internal server error');
    });
  };
}

function cleanText(value, maxLen) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, maxLen || 300) : null;
}

function cleanId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
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
    return sendError(res, 500, 'Log masuk Google belum dikonfigurasikan di pelayan ini.', 'Google sign-in is not set up on this server.');
  }
  const { credential } = req.body || {};
  if (!credential) return sendError(res, 400, 'Tiada token Google diberikan.', 'No Google token was given.');

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return sendError(res, 401, 'Token Google tidak sah.', 'Invalid Google token.');
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
    return sendError(res, 403, 'Akaun ini telah disekat daripada log masuk.', 'This account has been blocked from signing in.');
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

// ---- people (require Google login; open viewing stays public) ----

// Fields the client may send. On update, a field left out keeps its old
// value, so small changes (e.g. just setting a parent) can't wipe others.
function buildPersonValues(b, prev) {
  const pick = (field, column, clean) => (b[field] === undefined ? (prev ? prev[column] : null) : clean(b[field]));
  const firstName = pick('firstName', 'first_name', (v) => cleanText(v, 120));
  const deathDate = pick('deathDate', 'death_date', (v) => cleanText(v, 20));
  const isDeceased = pick('isDeceased', 'is_deceased', (v) => (v ? 1 : 0)) || (deathDate ? 1 : 0);
  let photoPath = pick('photoPath', 'photo_path', (v) => cleanText(v, 200));
  if (photoPath && !/^\/api\/photos\/[\w-]+$/.test(photoPath)) photoPath = null;
  return {
    first_name: firstName,
    last_name: pick('lastName', 'last_name', (v) => cleanText(v, 160)) || '',
    nickname: pick('nickname', 'nickname', (v) => cleanText(v, 60)),
    gender: pick('gender', 'gender', (v) => (['male', 'female'].includes(v) ? v : 'unknown')) || 'unknown',
    birth_date: pick('birthDate', 'birth_date', (v) => cleanText(v, 20)),
    death_date: deathDate,
    is_deceased: isDeceased,
    bio: pick('bio', 'bio', (v) => cleanText(v, 4000)),
    photo_path: photoPath,
    father_id: pick('fatherId', 'father_id', cleanId),
    mother_id: pick('motherId', 'mother_id', cleanId),
    state: pick('state', 'state', (v) => cleanText(v, 40)),
    birth_state: pick('birthState', 'birth_state', (v) => cleanText(v, 40)),
    address: pick('address', 'address', (v) => cleanText(v, 400)),
    phone: pick('phone', 'phone', (v) => cleanText(v, 40)),
  };
}

// Rejects impossible family links: being your own parent, a parent who
// doesn't exist, or a loop (someone becoming their own grandparent).
function validateParents(values, id, allRows) {
  const byId = new Map(allRows.map((r) => [r.id, r]));
  for (const pid of [values.father_id, values.mother_id]) {
    if (!pid) continue;
    if (pid === id) return ['Seseorang tidak boleh menjadi ibu bapa kepada dirinya sendiri.', 'A person cannot be their own parent.'];
    if (!byId.has(pid)) return ['Ibu/bapa yang dipilih tidak wujud.', 'The chosen parent does not exist.'];
    if (id) {
      const seen = new Set();
      const stack = [pid];
      while (stack.length) {
        const cur = stack.pop();
        if (cur === id) return ['Pautan ini akan menjadikan seseorang nenek moyang kepada dirinya sendiri.', 'This link would make someone their own ancestor.'];
        if (seen.has(cur)) continue;
        seen.add(cur);
        const r = byId.get(cur);
        if (r) [r.father_id, r.mother_id].forEach((x) => x && stack.push(x));
      }
    }
  }
  return null;
}

function duplicateMatches(values, id, allRows) {
  const people = allRows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, fatherId: r.father_id, motherId: r.mother_id }));
  return Names.findDuplicates(
    { firstName: values.first_name, lastName: values.last_name, fatherId: values.father_id, motherId: values.mother_id },
    people,
    id,
  ).filter((m) => m.reason === 'same');
}

// An exact same name is refused; only an admin may confirm it really is a
// different person (e.g. two cousins both named "Muhammad bin Ali").
function adminOverride(req, b) {
  return !!b.allowDuplicate && isAdminEmail(req.sessionUser.email);
}

function duplicateError(res, dupes) {
  return sendError(res, 409, 'Nama ini sudah wujud dalam salasilah. Hanya admin boleh menyimpan nama yang sama.',
    'This name already exists in the family tree. Only an admin can save the same name.', {
      code: 'duplicate', matchIds: dupes.map((d) => d.person.id),
    });
}

const PERSON_COLUMNS = ['first_name', 'last_name', 'nickname', 'gender', 'birth_date', 'death_date', 'is_deceased', 'bio',
  'photo_path', 'father_id', 'mother_id', 'state', 'birth_state', 'address', 'phone', 'lat', 'lng'];

app.post('/api/people', requireUser, asyncRoute(async (req, res) => {
  const b = req.body || {};
  const values = buildPersonValues(b, null);
  if (!values.first_name) return sendError(res, 400, 'Nama diperlukan.', 'Name is required.');

  const all = (await client.execute('SELECT id, first_name, last_name, father_id, mother_id FROM people')).rows;
  const parentErr = validateParents(values, null, all);
  if (parentErr) return sendError(res, 400, parentErr[0], parentErr[1]);
  const dupes = duplicateMatches(values, null, all);
  if (dupes.length && !adminOverride(req, b)) return duplicateError(res, dupes);

  Object.assign(values, await geocodeAddress(values.address, values.state));
  const result = await client.execute({
    sql: `INSERT INTO people (${PERSON_COLUMNS.join(', ')}) VALUES (${PERSON_COLUMNS.map(() => '?').join(', ')})`,
    args: PERSON_COLUMNS.map((c) => values[c] ?? null),
  });
  const row = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  res.status(201).json(personRow(row.rows[0], true));
}));

app.put('/api/people/:id', requireUser, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [id] });
  const prev = existing.rows[0];
  if (!prev) return sendError(res, 404, 'Orang tidak dijumpai.', 'Person not found.');

  const b = req.body || {};
  const values = buildPersonValues(b, prev);
  if (!values.first_name) return sendError(res, 400, 'Nama diperlukan.', 'Name is required.');

  const all = (await client.execute('SELECT id, first_name, last_name, father_id, mother_id FROM people')).rows;
  const parentErr = validateParents(values, id, all);
  if (parentErr) return sendError(res, 400, parentErr[0], parentErr[1]);
  const nameChanged = Names.nameKey(values.first_name, values.last_name) !== Names.nameKey(prev.first_name, prev.last_name);
  if (nameChanged && !adminOverride(req, b)) {
    const dupes = duplicateMatches(values, id, all);
    if (dupes.length) return duplicateError(res, dupes);
  }

  values.lat = prev.lat;
  values.lng = prev.lng;
  if (values.address !== prev.address || values.state !== prev.state) {
    Object.assign(values, await geocodeAddress(values.address, values.state));
  }

  await client.execute({
    sql: `UPDATE people SET ${PERSON_COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    args: [...PERSON_COLUMNS.map((c) => values[c] ?? null), id],
  });
  const row = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [id] });
  res.json(personRow(row.rows[0], true));
}));

app.delete('/api/people/:id', requireUser, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await client.execute({ sql: 'SELECT * FROM people WHERE id = ?', args: [id] });
  if (!existing.rows[0]) return sendError(res, 404, 'Orang tidak dijumpai.', 'Person not found.');

  await client.batch([
    { sql: 'UPDATE people SET father_id = NULL WHERE father_id = ?', args: [id] },
    { sql: 'UPDATE people SET mother_id = NULL WHERE mother_id = ?', args: [id] },
    { sql: 'DELETE FROM spouses WHERE person_id = ? OR spouse_id = ?', args: [id, id] },
    { sql: 'DELETE FROM album_people WHERE person_id = ?', args: [id] },
    { sql: 'DELETE FROM people WHERE id = ?', args: [id] },
  ], 'write');
  res.status(204).end();
}));

app.post('/api/spouses', requireUser, asyncRoute(async (req, res) => {
  const { personId, spouseId } = req.body || {};
  const a = Number(personId);
  const c = Number(spouseId);
  if (!a || !c || a === c) {
    return sendError(res, 400, 'Diperlukan dua orang yang berbeza.', 'Two different people are needed.');
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

// Saves the marriage order (1st, 2nd, 3rd...) of someone married more than once.
app.put('/api/spouses/order', requireUser, asyncRoute(async (req, res) => {
  const { personId, spouseIds } = req.body || {};
  const a = Number(personId);
  if (!a || !Array.isArray(spouseIds)) return sendError(res, 400, 'Data tidak sah.', 'Invalid data.');
  const stmts = spouseIds.map((sid, i) => {
    const c = Number(sid);
    const [lo, hi] = a < c ? [a, c] : [c, a];
    // Links that were only implied by a shared child get saved as real ones.
    return [
      { sql: 'INSERT OR IGNORE INTO spouses (person_id, spouse_id) VALUES (?, ?)', args: [lo, hi] },
      { sql: 'UPDATE spouses SET sort_order = ? WHERE person_id = ? AND spouse_id = ?', args: [i + 1, lo, hi] },
    ];
  }).flat();
  if (stmts.length) await client.batch(stmts, 'write');
  res.json({ ok: true });
}));

async function storePhoto(file) {
  const id = crypto.randomUUID();
  await client.execute({
    sql: 'INSERT INTO photos (id, content_type, data) VALUES (?, ?, ?)',
    args: [id, file.mimetype || 'image/jpeg', file.buffer],
  });
  return id;
}

app.post('/api/photos', requireUser, upload.single('photo'), asyncRoute(async (req, res) => {
  if (!req.file) return sendError(res, 400, 'Tiada imej sah dimuat naik.', 'No valid image was uploaded.');
  const id = await storePhoto(req.file);
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

// ---- memories (event albums) ----

function albumRow(row, personIds, user) {
  return {
    id: row.id,
    title: row.title,
    eventDate: row.event_date,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    photoCount: row.photo_count != null ? Number(row.photo_count) : undefined,
    coverUrl: row.cover_thumb ? `/api/photos/${row.cover_thumb}` : null,
    personIds: personIds || [],
    canManage: canManage(user, row.created_by),
  };
}

function albumPhotoRow(row, user, albumOwner) {
  return {
    id: row.id,
    url: `/api/photos/${row.photo_id}`,
    thumbUrl: `/api/photos/${row.thumb_id || row.photo_id}`,
    caption: row.caption,
    width: row.width,
    height: row.height,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    canManage: canManage(user, row.uploaded_by) || canManage(user, albumOwner),
  };
}

async function albumPeople(albumId) {
  const r = await client.execute({ sql: 'SELECT person_id FROM album_people WHERE album_id = ?', args: [albumId] });
  return r.rows.map((x) => x.person_id);
}

async function setAlbumPeople(albumId, personIds) {
  const ids = [...new Set((Array.isArray(personIds) ? personIds : []).map(cleanId).filter(Boolean))];
  await client.batch([
    { sql: 'DELETE FROM album_people WHERE album_id = ?', args: [albumId] },
    ...ids.map((pid) => ({ sql: 'INSERT OR IGNORE INTO album_people (album_id, person_id) VALUES (?, ?)', args: [albumId, pid] })),
  ], 'write');
}

async function getAlbum(id) {
  const r = await client.execute({ sql: 'SELECT * FROM albums WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}

app.get('/api/albums', asyncRoute(async (req, res) => {
  const albums = await client.execute(`
    SELECT a.*,
      (SELECT COUNT(*) FROM album_photos p WHERE p.album_id = a.id) AS photo_count,
      (SELECT COALESCE(p.thumb_id, p.photo_id) FROM album_photos p WHERE p.album_id = a.id ORDER BY p.id LIMIT 1) AS cover_thumb
    FROM albums a
    ORDER BY COALESCE(a.event_date, a.created_at) DESC, a.id DESC`);
  const links = await client.execute('SELECT album_id, person_id FROM album_people');
  const peopleByAlbum = new Map();
  links.rows.forEach((l) => {
    if (!peopleByAlbum.has(l.album_id)) peopleByAlbum.set(l.album_id, []);
    peopleByAlbum.get(l.album_id).push(l.person_id);
  });
  res.json({ albums: albums.rows.map((a) => albumRow(a, peopleByAlbum.get(a.id), req.sessionUser)) });
}));

app.get('/api/albums/:id', asyncRoute(async (req, res) => {
  const album = await getAlbum(Number(req.params.id));
  if (!album) return sendError(res, 404, 'Album tidak dijumpai.', 'Album not found.');
  const photos = await client.execute({ sql: 'SELECT * FROM album_photos WHERE album_id = ? ORDER BY id', args: [album.id] });
  res.json({
    album: albumRow(album, await albumPeople(album.id), req.sessionUser),
    photos: photos.rows.map((p) => albumPhotoRow(p, req.sessionUser, album.created_by)),
  });
}));

app.post('/api/albums', requireUser, asyncRoute(async (req, res) => {
  const b = req.body || {};
  const title = cleanText(b.title, 120);
  if (!title) return sendError(res, 400, 'Tajuk album diperlukan.', 'Album title is required.');
  const result = await client.execute({
    sql: 'INSERT INTO albums (title, event_date, description, created_by) VALUES (?, ?, ?, ?)',
    args: [title, cleanText(b.eventDate, 20), cleanText(b.description, 2000), req.sessionUser.id],
  });
  const id = Number(result.lastInsertRowid);
  await setAlbumPeople(id, b.personIds);
  res.status(201).json({ album: albumRow(await getAlbum(id), await albumPeople(id), req.sessionUser) });
}));

app.put('/api/albums/:id', requireUser, asyncRoute(async (req, res) => {
  const album = await getAlbum(Number(req.params.id));
  if (!album) return sendError(res, 404, 'Album tidak dijumpai.', 'Album not found.');
  const b = req.body || {};
  // Anyone logged in may tag people; only the creator/admin may rename or re-date.
  if (b.title !== undefined || b.eventDate !== undefined || b.description !== undefined) {
    if (!canManage(req.sessionUser, album.created_by)) {
      return sendError(res, 403, 'Hanya pencipta album atau admin boleh menyunting album ini.', 'Only the album creator or an admin can edit this album.');
    }
    const title = b.title !== undefined ? cleanText(b.title, 120) : album.title;
    if (!title) return sendError(res, 400, 'Tajuk album diperlukan.', 'Album title is required.');
    await client.execute({
      sql: 'UPDATE albums SET title = ?, event_date = ?, description = ? WHERE id = ?',
      args: [
        title,
        b.eventDate !== undefined ? cleanText(b.eventDate, 20) : album.event_date,
        b.description !== undefined ? cleanText(b.description, 2000) : album.description,
        album.id,
      ],
    });
  }
  if (b.personIds !== undefined) await setAlbumPeople(album.id, b.personIds);
  res.json({ album: albumRow(await getAlbum(album.id), await albumPeople(album.id), req.sessionUser) });
}));

app.delete('/api/albums/:id', requireUser, asyncRoute(async (req, res) => {
  const album = await getAlbum(Number(req.params.id));
  if (!album) return sendError(res, 404, 'Album tidak dijumpai.', 'Album not found.');
  if (!canManage(req.sessionUser, album.created_by)) {
    return sendError(res, 403, 'Hanya pencipta album atau admin boleh memadam album ini.', 'Only the album creator or an admin can delete this album.');
  }
  const photos = await client.execute({ sql: 'SELECT photo_id, thumb_id FROM album_photos WHERE album_id = ?', args: [album.id] });
  const blobIds = photos.rows.flatMap((p) => [p.photo_id, p.thumb_id]).filter(Boolean);
  await client.batch([
    ...blobIds.map((pid) => ({ sql: 'DELETE FROM photos WHERE id = ?', args: [pid] })),
    { sql: 'DELETE FROM album_photos WHERE album_id = ?', args: [album.id] },
    { sql: 'DELETE FROM album_people WHERE album_id = ?', args: [album.id] },
    { sql: 'DELETE FROM albums WHERE id = ?', args: [album.id] },
  ], 'write');
  res.status(204).end();
}));

app.post('/api/albums/:id/photos', requireUser, albumUpload.fields([{ name: 'photo', maxCount: 1 }, { name: 'thumb', maxCount: 1 }]), asyncRoute(async (req, res) => {
  const album = await getAlbum(Number(req.params.id));
  if (!album) return sendError(res, 404, 'Album tidak dijumpai.', 'Album not found.');
  const photo = req.files && req.files.photo && req.files.photo[0];
  const thumb = req.files && req.files.thumb && req.files.thumb[0];
  if (!photo) return sendError(res, 400, 'Tiada imej sah dimuat naik.', 'No valid image was uploaded.');
  const photoId = await storePhoto(photo);
  const thumbId = thumb ? await storePhoto(thumb) : null;
  const b = req.body || {};
  const result = await client.execute({
    sql: 'INSERT INTO album_photos (album_id, photo_id, thumb_id, caption, width, height, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [album.id, photoId, thumbId, cleanText(b.caption, 500), cleanId(b.width), cleanId(b.height), req.sessionUser.id],
  });
  const row = await client.execute({ sql: 'SELECT * FROM album_photos WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  res.status(201).json({ photo: albumPhotoRow(row.rows[0], req.sessionUser, album.created_by) });
}));

async function getAlbumPhoto(req) {
  const album = await getAlbum(Number(req.params.id));
  if (!album) return {};
  const r = await client.execute({ sql: 'SELECT * FROM album_photos WHERE id = ? AND album_id = ?', args: [Number(req.params.photoId), album.id] });
  return { album, photo: r.rows[0] || null };
}

app.patch('/api/albums/:id/photos/:photoId', requireUser, asyncRoute(async (req, res) => {
  const { album, photo } = await getAlbumPhoto(req);
  if (!photo) return sendError(res, 404, 'Gambar tidak dijumpai.', 'Photo not found.');
  if (!canManage(req.sessionUser, photo.uploaded_by) && !canManage(req.sessionUser, album.created_by)) {
    return sendError(res, 403, 'Anda tidak boleh menyunting gambar ini.', 'You cannot edit this photo.');
  }
  await client.execute({ sql: 'UPDATE album_photos SET caption = ? WHERE id = ?', args: [cleanText((req.body || {}).caption, 500), photo.id] });
  res.json({ ok: true });
}));

app.delete('/api/albums/:id/photos/:photoId', requireUser, asyncRoute(async (req, res) => {
  const { album, photo } = await getAlbumPhoto(req);
  if (!photo) return sendError(res, 404, 'Gambar tidak dijumpai.', 'Photo not found.');
  if (!canManage(req.sessionUser, photo.uploaded_by) && !canManage(req.sessionUser, album.created_by)) {
    return sendError(res, 403, 'Anda tidak boleh memadam gambar ini.', 'You cannot delete this photo.');
  }
  await client.batch([
    ...[photo.photo_id, photo.thumb_id].filter(Boolean).map((pid) => ({ sql: 'DELETE FROM photos WHERE id = ?', args: [pid] })),
    { sql: 'DELETE FROM album_photos WHERE id = ?', args: [photo.id] },
  ], 'write');
  res.status(204).end();
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
