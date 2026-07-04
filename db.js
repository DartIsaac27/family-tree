const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

// In production, TURSO_DATABASE_URL/TURSO_AUTH_TOKEN point at a hosted Turso
// database, so data survives redeploys even on hosts with no persistent disk.
// Locally, with no env vars set, this falls back to a plain SQLite file.
const url = process.env.TURSO_DATABASE_URL || `file:${path.join(dataDir, 'family.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

const PEOPLE_COLUMNS_TO_ADD = [
  'nickname TEXT',
  'state TEXT',
  'address TEXT',
  'phone TEXT',
  'lat REAL',
  'lng REAL',
];

async function addColumnIfMissing(table, columnDef) {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) throw err;
  }
}

const ready = client.batch([
  `CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT 'unknown',
    birth_date TEXT,
    death_date TEXT,
    bio TEXT,
    photo_path TEXT,
    father_id INTEGER REFERENCES people(id),
    mother_id INTEGER REFERENCES people(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS spouses (
    person_id INTEGER NOT NULL REFERENCES people(id),
    spouse_id INTEGER NOT NULL REFERENCES people(id),
    PRIMARY KEY (person_id, spouse_id)
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL DEFAULT 'image/jpeg',
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    picture TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    has_seen_tour INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
], 'write').then(async () => {
  for (const columnDef of PEOPLE_COLUMNS_TO_ADD) {
    await addColumnIfMissing('people', columnDef);
  }
});

module.exports = { client, ready };
