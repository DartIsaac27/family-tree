// Name helpers shared by the browser (window.FTNames) and the server
// (require('./public/js/names.js')), so both sides agree on what counts as
// "the same name" when warning about duplicate family members.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FTNames = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Common Malaysian spelling variants collapse to one form, so
  // "Mohd Ali" and "Muhammad Ali" are treated as the same name.
  const WORD_VARIANTS = {
    mohd: 'muhammad', mohamad: 'muhammad', mohammad: 'muhammad', mohammed: 'muhammad',
    muhamad: 'muhammad', muhammed: 'muhammad', muhd: 'muhammad', mhd: 'muhammad', md: 'muhammad',
    abd: 'abdul', abdol: 'abdul',
    nor: 'nur', noor: 'nur',
    bt: 'bin', bte: 'bin', binte: 'bin', binti: 'bin', bn: 'bin', b: 'bin',
    'a/l': 'bin', 'a/p': 'bin', anak: 'bin',
  };

  // Words that join a person's own name to their father's name.
  const CONNECTOR_RE = /\s+(bin|binti|bt\.?|bte\.?|binte|b\.|a\/l|a\/p|anak)\s+/i;
  const FEMALE_CONNECTORS = ['binti', 'bt', 'bt.', 'bte', 'bte.', 'binte', 'a/p'];
  const MALE_CONNECTORS = ['bin', 'b.', 'a/l'];

  function tokens(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/\ba\/l\b/g, ' a/l ')
      .replace(/\ba\/p\b/g, ' a/p ')
      .replace(/['`’]/g, '')
      .replace(/[^a-z0-9/À-ɏ]+/g, ' ')
      .split(' ')
      .map((w) => w.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .map((w) => WORD_VARIANTS[w] || w);
  }

  function nameKey(firstName, lastName) {
    return tokens(`${firstName || ''} ${lastName || ''}`).join(' ');
  }

  // "Ali bin Abu Bakar" -> { firstName: 'Ali', lastName: 'bin Abu Bakar' }.
  // Names without bin/binti etc. are kept whole as the first name.
  function splitFullName(full) {
    const clean = String(full || '').replace(/\s+/g, ' ').trim();
    const m = clean.match(CONNECTOR_RE);
    if (!m) return { firstName: clean, lastName: '' };
    return {
      firstName: clean.slice(0, m.index).trim(),
      lastName: clean.slice(m.index).trim(),
    };
  }

  function fullName(p) {
    return `${(p && p.firstName) || ''} ${(p && p.lastName) || ''}`.replace(/\s+/g, ' ').trim();
  }

  // The father's name part of "bin Abu Bakar" -> "Abu Bakar".
  function fatherPart(lastName) {
    const m = String(lastName || '').trim().match(/^(bin|binti|bt\.?|bte\.?|binte|b\.|a\/l|a\/p|anak)\s+(.*)$/i);
    return m ? m[2].trim() : '';
  }

  function guessGender(full) {
    const m = String(full || '').match(CONNECTOR_RE);
    if (!m) return null;
    const c = m[1].toLowerCase();
    if (FEMALE_CONNECTORS.includes(c)) return 'female';
    if (MALE_CONNECTORS.includes(c)) return 'male';
    return null;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  }

  // Returns people who look like the same person as `candidate`, best match
  // first. reason: 'same' (identical after normalising spelling) or
  // 'similar' (very close spelling, e.g. a typo), or 'sibling' (same first
  // name and same parent — siblings almost never share a first name).
  function findDuplicates(candidate, people, excludeId) {
    const key = nameKey(candidate.firstName, candidate.lastName);
    const firstKey = nameKey(candidate.firstName, '');
    if (!firstKey) return [];
    const out = [];
    people.forEach((p) => {
      if (excludeId != null && p.id === excludeId) return;
      const pKey = nameKey(p.firstName, p.lastName);
      let score = 0;
      let reason = null;
      if (pKey === key) { score = 1; reason = 'same'; }
      else {
        const sameParent = (candidate.fatherId && candidate.fatherId === p.fatherId)
          || (candidate.motherId && candidate.motherId === p.motherId);
        if (sameParent && nameKey(p.firstName, '') === firstKey) { score = 0.95; reason = 'sibling'; }
        else {
          const sim = similarity(pKey, key);
          // Only compare full names when both have a father's-name part, or
          // single first names would match too eagerly ("Ali" vs "Alia").
          if (sim >= 0.88 && key.length >= 6) { score = sim; reason = 'similar'; }
        }
      }
      if (reason) out.push({ person: p, score, reason });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  return { tokens, nameKey, splitFullName, fullName, fatherPart, guessGender, similarity, findDuplicates };
});
