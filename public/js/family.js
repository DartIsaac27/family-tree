// Pure family-data logic with no DOM access, used by the browser
// (window.FTFamily) and loadable in Node for testing.
//
//  - buildIndex:     quick lookups (children, spouses) from the raw API data
//  - buildUnits:     groups people into the tree structure the chart and
//                    list views draw (see the long comment above it)
//  - layoutChart:    x/y positions + connector lines for the chart view
//  - branchOf*:      "show only this family" filters
//  - relationship:   how two people are related (for the finder page)
//  - birthdays:      who has a birthday in a given month
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FTFamily = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- dates ----

  // Stored dates may be "1950", "1950-04" or "1950-04-12" (older relatives
  // often only have a known year). Older free-text "12/04/1950" also parses.
  function parseDate(str) {
    if (!str) return null;
    const s = String(str).trim();
    let m = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
    // "0000-04-12" = birthday known but not the year.
    if (m) return { y: Number(m[1]) || null, m: m[2] ? Number(m[2]) : null, d: m[3] ? Number(m[3]) : null };
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) };
    m = s.match(/(\d{4})/);
    return m ? { y: Number(m[1]), m: null, d: null } : null;
  }

  function dateSortValue(str) {
    const d = parseDate(str);
    if (!d || !d.y) return Infinity;
    return d.y * 10000 + (d.m || 0) * 100 + (d.d || 0);
  }

  function isDeceased(p) {
    return !!(p && (p.isDeceased || p.deathDate));
  }

  // ---- index ----

  function buildIndex(people, spousePairs) {
    const byId = new Map(people.map((p) => [p.id, p]));
    const childrenOf = new Map();
    people.forEach((p) => {
      [p.fatherId, p.motherId].forEach((pid) => {
        if (!pid || !byId.has(pid)) return;
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid).push(p.id);
      });
    });
    childrenOf.forEach((kids) => kids.sort((a, b) => dateSortValue(byId.get(a).birthDate) - dateSortValue(byId.get(b).birthDate) || a - b));

    // spouseInfo: id -> Map(spouseId -> { order, inferred })
    const spouseInfo = new Map();
    function addPair(a, b, order, inferred) {
      if (!byId.has(a) || !byId.has(b) || a === b) return;
      [[a, b], [b, a]].forEach(([x, y]) => {
        if (!spouseInfo.has(x)) spouseInfo.set(x, new Map());
        const existing = spouseInfo.get(x).get(y);
        if (existing && !existing.inferred) return;
        spouseInfo.get(x).set(y, { order: order == null ? null : Number(order), inferred });
      });
    }
    (spousePairs || []).forEach((s) => addPair(s.personId, s.spouseId, s.sortOrder, false));
    // Two people who share a child are treated as a couple even if nobody
    // linked them as spouses, so their children never get "lost" in the tree.
    people.forEach((p) => {
      if (p.fatherId && p.motherId && !(spouseInfo.get(p.fatherId) || new Map()).has(p.motherId)) {
        addPair(p.fatherId, p.motherId, null, true);
      }
    });

    return { people, byId, childrenOf, spouseInfo };
  }

  function childrenOfPerson(idx, id) {
    return (idx.childrenOf.get(id) || []).map((cid) => idx.byId.get(cid));
  }

  function childrenWith(idx, a, b) {
    return childrenOfPerson(idx, a).filter((c) => (c.fatherId === b || c.motherId === b));
  }

  // A person's spouses in marriage order: an explicit order (set in the edit
  // form) wins, otherwise the marriage whose eldest child was born first,
  // otherwise the order they were added.
  function spousesOf(idx, id) {
    const m = idx.spouseInfo.get(id);
    if (!m) return [];
    return [...m.entries()]
      .map(([sid, info]) => {
        const firstChild = Math.min(Infinity, ...childrenWith(idx, id, sid).map((c) => dateSortValue(c.birthDate)));
        return { sid, order: info.order, firstChild };
      })
      .sort((a, b) => {
        const oa = a.order == null ? Infinity : a.order;
        const ob = b.order == null ? Infinity : b.order;
        if (oa !== ob) return oa - ob;
        if (a.firstChild !== b.firstChild) return a.firstChild - b.firstChild;
        return a.sid - b.sid;
      })
      .map((x) => x.sid);
  }

  // Siblings who share only their mother -> 'mother' (e.g. Grandma's
  // children from different husbands), only their father -> 'father'.
  // Unknown parents are not assumed to be different.
  function halfSide(a, b) {
    if (a.fatherId && b.fatherId && a.fatherId !== b.fatherId) return 'mother';
    if (a.motherId && b.motherId && a.motherId !== b.motherId) return 'father';
    return null;
  }

  function siblingsOf(idx, id) {
    const p = idx.byId.get(id);
    if (!p) return [];
    const seen = new Set();
    const out = [];
    [p.fatherId, p.motherId].forEach((pid) => {
      if (!pid) return;
      childrenOfPerson(idx, pid).forEach((c) => {
        if (c.id === id || seen.has(c.id)) return;
        seen.add(c.id);
        out.push({ person: c, half: halfSide(p, c) });
      });
    });
    return out.sort((a, b) => dateSortValue(a.person.birthDate) - dateSortValue(b.person.birthDate));
  }

  // ---- tree structure ----
  //
  // People are grouped into "units" and units into a tree:
  //  - A normal couple (each has exactly one spouse) is ONE unit, drawn side
  //    by side, with their children below.
  //  - Someone married more than once (e.g. a grandmother widowed and
  //    remarried, or a man with two wives) becomes a "hub": they sit alone
  //    on top, each spouse is drawn one row BELOW them (numbered by marriage
  //    order), and the children of each marriage grow under that spouse.
  //    This is decided automatically from the data for everyone, not just
  //    one hard-coded person.
  //  - Each unit's width is measured from its whole subtree before placing
  //    anything, so a family's children always sit directly under them.
  function buildUnits(idx, visibleIds) {
    const vis = visibleIds || new Set(idx.people.map((p) => p.id));
    const people = idx.people.filter((p) => vis.has(p.id));
    const inVis = (id) => id != null && vis.has(id);
    const hasParents = (id) => {
      const p = idx.byId.get(id);
      return !!p && (inVis(p.fatherId) || inVis(p.motherId));
    };

    const spouseCache = new Map();
    const sp = (id) => {
      if (!spouseCache.has(id)) spouseCache.set(id, spousesOf(idx, id).filter(inVis));
      return spouseCache.get(id);
    };
    const degree = (id) => sp(id).length;

    const partner = new Map();
    people.forEach((p) => {
      const s = sp(p.id);
      if (s.length === 1 && degree(s[0]) === 1) partner.set(p.id, s[0]);
    });

    function pickHub(a, b) {
      const da = degree(a), db = degree(b);
      if (da !== db) return da > db ? a : b;
      const pa = hasParents(a), pb = hasParents(b);
      if (pa !== pb) return pa ? a : b;
      return a < b ? a : b;
    }

    const stackedUnder = new Map(); // hubId -> [spouse ids in marriage order]
    const stackedPair = new Set(); // "hub>sub"
    const stackedSubs = new Set();
    people.forEach((p) => {
      sp(p.id).forEach((s) => {
        if (partner.get(p.id) === s) return;
        if (pickHub(p.id, s) !== p.id) return;
        if (!stackedUnder.has(p.id)) stackedUnder.set(p.id, []);
        stackedUnder.get(p.id).push(s);
        stackedPair.add(`${p.id}>${s}`);
        stackedSubs.add(s);
      });
    });

    // Children hang under one "anchor" parent: for a hub's marriage that is
    // the spouse row below the hub, otherwise the father (or whichever
    // parent is known).
    function anchorOf(fid, mid) {
      if (fid && mid) {
        if (stackedPair.has(`${fid}>${mid}`)) return mid;
        if (stackedPair.has(`${mid}>${fid}`)) return fid;
        return fid;
      }
      return fid || mid;
    }
    const kidsByAnchor = new Map();
    people.forEach((p) => {
      const fid = inVis(p.fatherId) ? p.fatherId : null;
      const mid = inVis(p.motherId) ? p.motherId : null;
      if (!fid && !mid) return;
      const a = anchorOf(fid, mid);
      if (!kidsByAnchor.has(a)) kidsByAnchor.set(a, []);
      kidsByAnchor.get(a).push(p.id);
    });
    kidsByAnchor.forEach((kids) => kids.sort((a, b) => dateSortValue(idx.byId.get(a).birthDate) - dateSortValue(idx.byId.get(b).birthDate) || a - b));

    const unitCache = new Map();
    function unitFor(id) {
      if (unitCache.has(id)) return unitCache.get(id);
      const pid = partner.get(id);
      let members = [id];
      if (pid != null) {
        // husband on the left, wife on the right (the usual way it's drawn)
        const a = idx.byId.get(id), b = idx.byId.get(pid);
        const aFirst = a.gender === 'male' || (a.gender !== 'female' && b.gender === 'female') || (a.gender === b.gender && id < pid);
        members = aFirst ? [id, pid] : [pid, id];
      }
      const unit = { key: members.join('+'), members, children: [], width: 1, stackedOf: null, marriageNo: null };
      members.forEach((m) => unitCache.set(m, unit));
      return unit;
    }

    const attached = new Set();
    function attach(unit) {
      const childUnits = [];
      unit.members.forEach((m) => {
        const subs = stackedUnder.get(m) || [];
        const allSpouses = sp(m);
        subs.forEach((sub) => {
          const su = unitFor(sub);
          if (attached.has(su)) return;
          attached.add(su);
          su.stackedOf = m;
          su.marriageNo = allSpouses.indexOf(sub) + 1;
          childUnits.push(su);
        });
      });
      unit.members.forEach((m) => {
        (kidsByAnchor.get(m) || []).forEach((kid) => {
          const cu = unitFor(kid);
          if (attached.has(cu)) return;
          attached.add(cu);
          childUnits.push(cu);
        });
      });
      unit.children = childUnits;
      childUnits.forEach(attach);
    }

    // Biggest family first, so when two families are joined by a marriage
    // the couple is drawn inside the larger (usually "our") family.
    const descCache = new Map();
    function descCount(id) {
      if (descCache.has(id)) return descCache.get(id);
      descCache.set(id, 0);
      const n = (idx.childrenOf.get(id) || []).filter(inVis).reduce((s, c) => s + 1 + descCount(c), 0)
        + (stackedUnder.get(id) || []).reduce((s, sub) => s + 1 + descCount(sub), 0);
      descCache.set(id, n);
      return n;
    }

    const rootCandidates = people
      .filter((p) => !hasParents(p.id) && !stackedSubs.has(p.id))
      .map((p) => unitFor(p.id))
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .filter((u) => u.members.every((m) => !hasParents(m)))
      .map((u) => ({ u, size: u.members.reduce((s, m) => s + descCount(m), 0) }))
      .sort((a, b) => b.size - a.size || a.u.members[0] - b.u.members[0]);

    const roots = [];
    rootCandidates.forEach(({ u }) => {
      if (attached.has(u)) return;
      attached.add(u);
      roots.push(u);
      attach(u);
    });
    // Safety net: anyone unreachable (e.g. circular data) still shows up.
    people.forEach((p) => {
      const u = unitFor(p.id);
      if (attached.has(u)) return;
      attached.add(u);
      roots.push(u);
      attach(u);
    });

    (function computeWidths(units) {
      units.forEach((u) => {
        computeWidths(u.children);
        const cw = u.children.reduce((s, c) => s + c.width, 0);
        u.width = Math.max(u.members.length, cw, 1);
      });
    })(roots);

    return roots;
  }

  // ---- chart layout ----

  function layoutChart(idx, roots, opt) {
    const W = opt.cardW, H = opt.cardH, GAP = opt.gapX, ROW = opt.rowH;
    const COL = W + GAP;
    const nodes = [];
    const byId = new Map();

    function place(unit, left, depth) {
      const span = unit.width * COL;
      const membersLeft = left + (span - unit.members.length * COL) / 2;
      unit.members.forEach((id, i) => {
        const n = {
          id, person: idx.byId.get(id), x: membersLeft + i * COL + GAP / 2, y: depth * ROW, depth,
          stackedOf: unit.stackedOf, marriageNo: unit.marriageNo, isHub: false,
        };
        nodes.push(n);
        byId.set(id, n);
      });
      let cursor = left;
      unit.children.forEach((c) => {
        place(c, cursor, depth + 1);
        cursor += c.width * COL;
      });
    }
    let cursor = 0;
    roots.forEach((u) => {
      place(u, cursor, 0);
      cursor += (u.width + 0.5) * COL;
    });

    const coupleLines = [];
    const stackLines = [];
    const labels = [];
    const cx = (n) => n.x + W / 2;

    // couple connector (side-by-side partners)
    const seenCouple = new Set();
    nodes.forEach((n) => {
      (idx.spouseInfo.get(n.id) || new Map()).forEach((_, sid) => {
        const m = byId.get(sid);
        if (!m || m.y !== n.y || Math.abs(m.x - n.x) > COL + 1) return;
        const k = [n.id, sid].sort((a, b) => a - b).join('-');
        if (seenCouple.has(k)) return;
        seenCouple.add(k);
        const l = n.x < m.x ? n : m, r = n.x < m.x ? m : n;
        coupleLines.push({ x1: l.x + W, x2: r.x, y: l.y + H * 0.42 });
      });
    });

    // hub -> each spouse below
    nodes.forEach((n) => {
      if (n.stackedOf == null) return;
      const hub = byId.get(n.stackedOf);
      if (!hub) return;
      hub.isHub = true;
      const midY = hub.y + H + (n.y - hub.y - H) / 2;
      stackLines.push({ d: `M ${cx(hub)} ${hub.y + H} V ${midY} H ${cx(n)} V ${n.y}` });
      labels.push({ x: cx(n), y: n.y - 14, marriageNo: n.marriageNo, hubId: hub.id, spouseId: n.id });
    });

    // parent -> children bus lines, grouped by the exact parent pair
    const groups = new Map();
    nodes.forEach((n) => {
      const p = n.person;
      const f = byId.get(p.fatherId), m = byId.get(p.motherId);
      if (!f && !m) return;
      const k = `${f ? f.id : '_'}-${m ? m.id : '_'}`;
      if (!groups.has(k)) groups.set(k, { parents: [f, m].filter(Boolean), kids: [] });
      groups.get(k).kids.push(n);
    });
    const parentLines = [];
    groups.forEach(({ parents, kids }) => {
      const deepest = Math.max(...parents.map((p) => p.y));
      const ps = parents.filter((p) => p.y === deepest);
      let sx, sy;
      if (ps.length === 2 && Math.abs(ps[0].x - ps[1].x) <= COL + 1) {
        sx = (cx(ps[0]) + cx(ps[1])) / 2;
        sy = ps[0].y + H * 0.42;
      } else {
        sx = cx(ps[0]);
        sy = ps[0].y + H;
      }
      const topKid = Math.min(...kids.map((k) => k.y));
      const busY = topKid - Math.min(26, (topKid - (deepest + H)) / 2);
      const xs = kids.map(cx);
      let d = `M ${sx} ${sy} V ${busY} M ${Math.min(sx, ...xs)} ${busY} H ${Math.max(sx, ...xs)}`;
      kids.forEach((k) => { d += ` M ${cx(k)} ${busY} V ${k.y}`; });
      parentLines.push({ d });
    });

    const bounds = nodes.length ? {
      minX: Math.min(...nodes.map((n) => n.x)),
      maxX: Math.max(...nodes.map((n) => n.x)) + W,
      minY: Math.min(...nodes.map((n) => n.y)) - 30,
      maxY: Math.max(...nodes.map((n) => n.y)) + H,
    } : null;

    return { nodes, byId, coupleLines, stackLines, parentLines, labels, bounds };
  }

  // ---- "show only this family" filters ----

  function descendants(idx, startIds) {
    const out = new Set(startIds);
    const queue = [...startIds];
    while (queue.length) {
      const id = queue.shift();
      (idx.childrenOf.get(id) || []).forEach((c) => {
        if (!out.has(c)) { out.add(c); queue.push(c); }
      });
    }
    return out;
  }

  function withSpouses(idx, ids) {
    const out = new Set(ids);
    ids.forEach((id) => (idx.spouseInfo.get(id) || new Map()).forEach((_, s) => out.add(s)));
    return out;
  }

  // A person, their spouse(s), and all their descendants (plus each
  // descendant's own spouse) — but not a spouse's children from another
  // marriage.
  function branchOfPerson(idx, id) {
    return withSpouses(idx, descendants(idx, [id]));
  }

  // One specific marriage: the two parents, the children they had
  // together, and those children's families. E.g. tapping Grandma's 2nd
  // husband shows him, Grandma, and only their children.
  function branchOfCouple(idx, a, b) {
    const kids = childrenWith(idx, a, b).map((c) => c.id);
    const blood = descendants(idx, kids);
    const out = withSpouses(idx, blood);
    out.add(a);
    out.add(b);
    return out;
  }

  // ---- relationship finder ----

  function ancestorMap(idx, id) {
    const out = new Map([[id, { depth: 0, child: null }]]);
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      const p = idx.byId.get(cur);
      if (!p) continue;
      [p.fatherId, p.motherId].forEach((pid) => {
        if (!pid || !idx.byId.has(pid) || out.has(pid)) return;
        out.set(pid, { depth: out.get(cur).depth + 1, child: cur });
        queue.push(pid);
      });
    }
    return out;
  }

  function pathUp(map, fromAncestor) {
    const path = [];
    let cur = fromAncestor;
    while (cur != null) {
      path.unshift(cur);
      cur = map.get(cur).child;
    }
    return path; // [self, parent, ..., ancestor]
  }

  // How `a` is related to `b` by blood, from a's point of view
  // (e.g. kind 'uncle' means "a is b's uncle/aunt").
  function bloodRelation(idx, a, b) {
    if (a === b) return { kind: 'self' };
    const A = ancestorMap(idx, a), B = ancestorMap(idx, b);
    let best = Infinity;
    const lcas = [];
    A.forEach((info, id) => {
      if (!B.has(id)) return;
      const sum = info.depth + B.get(id).depth;
      if (sum < best) { best = sum; lcas.length = 0; }
      if (sum === best) lcas.push(id);
    });
    if (!lcas.length) return null;
    const up = A.get(lcas[0]).depth, down = B.get(lcas[0]).depth;
    const res = { up, down, lcas, pathA: pathUp(A, lcas[0]), pathB: pathUp(B, lcas[0]) };
    if (up === 0) return Object.assign(res, { kind: down === 1 ? 'parent' : 'grandparent', n: down - 1 });
    if (down === 0) return Object.assign(res, { kind: up === 1 ? 'child' : 'grandchild', n: up - 1 });
    if (up === 1 && down === 1) {
      const pa = idx.byId.get(a), pb = idx.byId.get(b);
      const da = dateSortValue(pa.birthDate), db = dateSortValue(pb.birthDate);
      return Object.assign(res, {
        kind: 'sibling',
        half: halfSide(pa, pb),
        older: da === Infinity || db === Infinity || da === db ? null : da < db,
      });
    }
    if (up === 1) return Object.assign(res, { kind: 'uncle', n: down - 1 });
    if (down === 1) return Object.assign(res, { kind: 'nephew', n: up - 1 });
    return Object.assign(res, { kind: 'cousin', n: Math.min(up, down) - 1, removed: Math.abs(up - down) });
  }

  function relationship(idx, a, b) {
    const blood = bloodRelation(idx, a, b);
    if (blood) return Object.assign({ type: 'blood' }, blood);
    const spA = [...(idx.spouseInfo.get(a) || new Map()).keys()];
    const spB = [...(idx.spouseInfo.get(b) || new Map()).keys()];
    if (spA.includes(b)) return { type: 'spouse' };
    // a is a blood relative of b's spouse (e.g. b's mother-in-law)
    for (const s of spB) {
      const r = bloodRelation(idx, a, s);
      if (r) return { type: 'relOfSpouse', spouseId: s, rel: r };
    }
    // a is married to one of b's blood relatives (e.g. b's step-father)
    for (const s of spA) {
      const r = bloodRelation(idx, s, b);
      if (r) return { type: 'spouseOfRel', spouseId: s, rel: r };
    }
    return { type: 'none' };
  }

  // ---- birthdays & stats ----

  function birthdaysInMonth(people, month, year) {
    return people
      .filter((p) => !isDeceased(p))
      .map((p) => ({ p, d: parseDate(p.birthDate) }))
      .filter(({ d }) => d && d.m === month && d.d)
      .map(({ p, d }) => ({ person: p, day: d.d, age: d.y ? year - d.y : null }))
      .sort((a, b) => a.day - b.day);
  }

  function generationCount(idx) {
    const memo = new Map();
    function depth(id, guard) {
      if (memo.has(id)) return memo.get(id);
      if (guard.has(id)) return 1;
      guard.add(id);
      const p = idx.byId.get(id);
      const ps = [p.fatherId, p.motherId].filter((x) => x && idx.byId.has(x));
      const d = 1 + (ps.length ? Math.max(...ps.map((x) => depth(x, guard))) : 0);
      memo.set(id, d);
      return d;
    }
    return idx.people.reduce((m, p) => Math.max(m, depth(p.id, new Set())), 0);
  }

  return {
    parseDate, dateSortValue, isDeceased, buildIndex, childrenOfPerson, childrenWith, spousesOf, siblingsOf,
    buildUnits, layoutChart, branchOfPerson, branchOfCouple, bloodRelation, relationship,
    birthdaysInMonth, generationCount,
  };
});
