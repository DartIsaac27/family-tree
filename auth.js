const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const passcodeFile = path.join(__dirname, 'data', 'admin-passcode.txt');

function loadOrCreatePasscode() {
  const envValue = process.env.ADMIN_PASSCODE || process.env.EDIT_PASSCODE;
  if (envValue) return envValue;

  fs.mkdirSync(path.dirname(passcodeFile), { recursive: true });
  if (fs.existsSync(passcodeFile)) {
    const saved = fs.readFileSync(passcodeFile, 'utf8').trim();
    if (saved) return saved;
  }

  const generated = crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(passcodeFile, generated, 'utf8');
  return generated;
}

const PASSCODE = loadOrCreatePasscode();

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAdmin(req, res, next) {
  const provided = req.get('x-admin-passcode') || '';
  if (!timingSafeEqual(provided, PASSCODE)) {
    return res.status(401).json({ error: 'Kod laluan admin tidak sah atau tiada.' });
  }
  next();
}

module.exports = { PASSCODE, requireAdmin, timingSafeEqual };
