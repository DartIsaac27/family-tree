const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'family.db'));
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT 'unknown',
    birth_date TEXT,
    death_date TEXT,
    bio TEXT,
    photo_path TEXT,
    father_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
    mother_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS spouses (
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    spouse_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, spouse_id)
  );
`);

module.exports = db;
