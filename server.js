const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const db = require('./db');
const { PASSCODE, requirePasscode, timingSafeEqual } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ---- helpers ----

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

function getAllSpousePairs() {
  return db.prepare('SELECT person_id, spouse_id FROM spouses').all()
    .map((r) => ({ personId: r.person_id, spouseId: r.spouse_id }));
}

// ---- read endpoints (public) ----

app.get('/api/people', (req, res) => {
  const people = db.prepare('SELECT * FROM people ORDER BY id').all().map(personRow);
  const spousePairs = getAllSpousePairs();
  res.json({ people, spousePairs });
});

app.get('/api/config', (req, res) => {
  res.json({ hasCustomPasscode: Boolean(process.env.EDIT_PASSCODE) });
});

app.post('/api/auth/verify', (req, res) => {
  const { passcode } = req.body || {};
  res.json({ ok: timingSafeEqual(passcode || '', PASSCODE) });
});

// ---- write endpoints (require passcode) ----

app.post('/api/people', requirePasscode, (req, res) => {
  const b = req.body || {};
  if (!b.firstName || !String(b.firstName).trim()) {
    return res.status(400).json({ error: 'Nama pertama diperlukan' });
  }
  const stmt = db.prepare(`
    INSERT INTO people (first_name, last_name, gender, birth_date, death_date, bio, photo_path, father_id, mother_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    String(b.firstName).trim(),
    b.lastName ? String(b.lastName).trim() : '',
    b.gender || 'unknown',
    b.birthDate || null,
    b.deathDate || null,
    b.bio || null,
    b.photoPath || null,
    b.fatherId || null,
    b.motherId || null
  );
  const row = db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(personRow(row));
});

app.put('/api/people/:id', requirePasscode, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Orang tidak dijumpai' });

  const b = req.body || {};
  if (!b.firstName || !String(b.firstName).trim()) {
    return res.status(400).json({ error: 'Nama pertama diperlukan' });
  }
  if ((b.fatherId && Number(b.fatherId) === id) || (b.motherId && Number(b.motherId) === id)) {
    return res.status(400).json({ error: 'Seseorang tidak boleh menjadi ibu bapa kepada dirinya sendiri' });
  }

  db.prepare(`
    UPDATE people SET first_name = ?, last_name = ?, gender = ?, birth_date = ?, death_date = ?,
      bio = ?, photo_path = ?, father_id = ?, mother_id = ?
    WHERE id = ?
  `).run(
    String(b.firstName).trim(),
    b.lastName ? String(b.lastName).trim() : '',
    b.gender || 'unknown',
    b.birthDate || null,
    b.deathDate || null,
    b.bio || null,
    b.photoPath || null,
    b.fatherId || null,
    b.motherId || null,
    id
  );
  const row = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
  res.json(personRow(row));
});

app.delete('/api/people/:id', requirePasscode, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Orang tidak dijumpai' });

  db.prepare('DELETE FROM people WHERE id = ?').run(id);
  res.status(204).end();
});

app.post('/api/spouses', requirePasscode, (req, res) => {
  const { personId, spouseId } = req.body || {};
  const a = Number(personId);
  const c = Number(spouseId);
  if (!a || !c || a === c) {
    return res.status(400).json({ error: 'Diperlukan dua ID orang yang berbeza dan sah' });
  }
  const [lo, hi] = a < c ? [a, c] : [c, a];
  db.prepare('INSERT OR IGNORE INTO spouses (person_id, spouse_id) VALUES (?, ?)').run(lo, hi);
  res.status(201).json({ personId: lo, spouseId: hi });
});

app.delete('/api/spouses', requirePasscode, (req, res) => {
  const { personId, spouseId } = req.body || {};
  const a = Number(personId);
  const c = Number(spouseId);
  const [lo, hi] = a < c ? [a, c] : [c, a];
  db.prepare('DELETE FROM spouses WHERE person_id = ? AND spouse_id = ?').run(lo, hi);
  res.status(204).end();
});

app.post('/api/photos', requirePasscode, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada imej sah dimuat naik' });
  res.status(201).json({ photoPath: `/uploads/${req.file.filename}` });
});

// ---- backup / restore (protected) ----

app.get('/api/backup/export', requirePasscode, (req, res) => {
  const people = db.prepare('SELECT * FROM people ORDER BY id').all().map(personRow);
  const spousePairs = getAllSpousePairs();
  res.setHeader('Content-Disposition', 'attachment; filename="family-tree-backup.json"');
  res.json({ exportedAt: new Date().toISOString(), people, spousePairs });
});

app.post('/api/backup/import', requirePasscode, (req, res) => {
  const { people, spousePairs } = req.body || {};
  if (!Array.isArray(people) || !Array.isArray(spousePairs)) {
    return res.status(400).json({ error: 'Fail sandaran mesti mengandungi array "people" dan "spousePairs"' });
  }

  db.exec('BEGIN TRANSACTION');
  try {
    db.exec('DELETE FROM spouses');
    db.exec('DELETE FROM people');
    const insertPerson = db.prepare(`
      INSERT INTO people (id, first_name, last_name, gender, birth_date, death_date, bio, photo_path, father_id, mother_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    people.forEach((p) => {
      insertPerson.run(
        p.id, p.firstName, p.lastName || '', p.gender || 'unknown',
        p.birthDate || null, p.deathDate || null, p.bio || null, p.photoPath || null,
        p.fatherId || null, p.motherId || null
      );
    });
    const insertSpouse = db.prepare('INSERT OR IGNORE INTO spouses (person_id, spouse_id) VALUES (?, ?)');
    spousePairs.forEach(({ personId, spouseId }) => {
      const [lo, hi] = personId < spouseId ? [personId, spouseId] : [spouseId, personId];
      insertSpouse.run(lo, hi);
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(400).json({ error: 'Import gagal: ' + err.message });
  }
  res.json({ ok: true, imported: people.length });
});

app.listen(PORT, () => {
  console.log(`Family tree site running at http://localhost:${PORT}`);
  if (!process.env.EDIT_PASSCODE) {
    console.log(`Edit passcode (share with family, keep away from strangers): ${PASSCODE}`);
  }
});
