const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const passcodeFile = path.join(__dirname, 'data', 'edit-passcode.txt');

function loadOrCreatePasscode() {
  if (process.env.EDIT_PASSCODE) return process.env.EDIT_PASSCODE;

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

function requirePasscode(req, res, next) {
  const provided = req.get('x-edit-passcode') || '';
  if (!timingSafeEqual(provided, PASSCODE)) {
    return res.status(401).json({ error: 'Invalid or missing edit passcode.' });
  }
  next();
}

module.exports = { PASSCODE, requirePasscode, timingSafeEqual };
