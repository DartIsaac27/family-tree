const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---- Google login sessions ----
// Per-person login (via Google) used to gate who may add/edit/delete family
// members, and to let an admin (matched by email, see ADMIN_EMAILS) ban a
// misbehaving account.

const sessionSecretFile = path.join(__dirname, 'data', 'session-secret.txt');
const SESSION_COOKIE = 'fte_session';
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function loadOrCreateSessionSecret() {
  const envValue = process.env.SESSION_SECRET;
  if (envValue) return envValue;

  fs.mkdirSync(path.dirname(sessionSecretFile), { recursive: true });
  if (fs.existsSync(sessionSecretFile)) {
    const saved = fs.readFileSync(sessionSecretFile, 'utf8').trim();
    if (saved) return saved;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(sessionSecretFile, generated, 'utf8');
  return generated;
}

const SESSION_SECRET = loadOrCreateSessionSecret();

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function createSessionToken(userId) {
  const payload = `${userId}.${Date.now() + SESSION_MAX_AGE_MS}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, signature] = parts;
  const payload = `${userId}.${expiresAtStr}`;
  if (!timingSafeEqual(signature, sign(payload))) return null;
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || Date.now() > expiresAt) return null;
  return userId;
}

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
}

module.exports = {
  SESSION_COOKIE, SESSION_MAX_AGE_MS, createSessionToken, verifySessionToken, isAdminEmail,
};
