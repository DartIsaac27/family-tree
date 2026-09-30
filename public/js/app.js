// Core of the site: shared state, API calls, pop-up sheets (with phone back
// button support), page routing, Google login, search and the person picker.
// Page-specific code lives in person.js, tree.js, map.js, memories.js and
// pages.js, which all hang their pieces off window.FT.
(function () {
  'use strict';

  const { t } = window.FTI18n;
  const Family = window.FTFamily;
  const Names = window.FTNames;

  const FT = window.FT = {
    t,
    state: {
      people: [],
      spousePairs: [],
      idx: Family.buildIndex([], []),
      user: null,
      googleClientId: null,
      albums: null,
      loaded: false,
    },
    views: {},
  };

  // ---- tiny event bus ('data', 'user', 'lang', 'theme', 'albums') ----

  const listeners = {};
  FT.on = (ev, fn) => {
    (listeners[ev] = listeners[ev] || []).push(fn);
    return () => { listeners[ev] = listeners[ev].filter((f) => f !== fn); };
  };
  FT.emit = (ev, ...args) => (listeners[ev] || []).forEach((fn) => fn(...args));

  // ---- helpers ----

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  FT.esc = esc;

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    tree: '<rect x="9" y="2" width="6" height="5" rx="1.5"/><rect x="2" y="17" width="6" height="5" rx="1.5"/><rect x="16" y="17" width="6" height="5" rx="1.5"/><path d="M12 7v5M5 17v-2.5A2.5 2.5 0 0 1 7.5 12h9a2.5 2.5 0 0 1 2.5 2.5V17"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    chevronDown: '<path d="M5 9l7 7 7-7"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    whatsapp: '<path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12z"/><path d="M9 9c0 3.3 2.7 6 6 6l.8-1.6-2-1-.9.8a4 4 0 0 1-2.1-2.1l.8-.9-1-2L9 9z"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    cake: '<path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8z"/><path d="M4 16c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M12 11V7"/><path d="M12 3.5c.8.8.8 2 0 2.5-.8-.5-.8-1.7 0-2.5z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    ring: '<circle cx="12" cy="14" r="6"/><path d="M9 4h6l-1.5 3h-3z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    swap: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    dots: '<path d="M12 5v.01M12 12v.01M12 19v.01"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
  };
  FT.icon = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  FT.person = (id) => FT.state.idx.byId.get(Number(id)) || null;
  FT.fullName = (p) => Names.fullName(p);
  FT.displayName = (p) => (p ? (p.nickname || p.firstName || FT.fullName(p)) : '');
  FT.isDeceased = (p) => Family.isDeceased(p);

  function initials(p) {
    const words = String(p.nickname || p.firstName || '').trim().split(/\s+/).filter(Boolean);
    return ((words[0] || '?')[0] + (words[1] ? words[1][0] : '')).toUpperCase();
  }
  FT.initials = initials;

  // size: xs | sm | md | lg | xl
  FT.avatar = (p, size) => {
    if (!p) return `<span class="av av-${size || 'md'} g-unknown">?</span>`;
    const cls = `av av-${size || 'md'} g-${p.gender || 'unknown'}${FT.isDeceased(p) ? ' is-deceased' : ''}`;
    return p.photoPath
      ? `<span class="${cls}"><img src="${esc(p.photoPath)}" alt="" loading="lazy" /></span>`
      : `<span class="${cls}">${esc(initials(p))}</span>`;
  };

  FT.formatDate = (str) => {
    const d = Family.parseDate(str);
    if (!d) return str || '';
    const months = FTI18n.months();
    if (d.m && d.d) return `${d.d} ${months[d.m - 1]}${d.y ? ' ' + d.y : ''}`;
    if (d.m) return `${months[d.m - 1]} ${d.y || ''}`.trim();
    return String(d.y || '');
  };

  FT.age = (p) => {
    const b = Family.parseDate(p.birthDate);
    if (!b || !b.y) return null;
    const end = Family.parseDate(p.deathDate);
    const now = new Date();
    const ref = end && end.y ? end : { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    let age = ref.y - b.y;
    if (b.m && ref.m && (ref.m < b.m || (ref.m === b.m && b.d && ref.d && ref.d < b.d))) age -= 1;
    return age >= 0 && age < 130 ? age : null;
  };

  // "1950 – 2010", "b. 1950 · 76", or ''
  FT.yearsText = (p) => {
    const b = Family.parseDate(p.birthDate);
    const d = Family.parseDate(p.deathDate);
    if (d && d.y) return `${b && b.y ? b.y : '?'} – ${d.y}`;
    if (FT.isDeceased(p)) return b && b.y ? `${b.y} – ?` : t('person.deceased');
    if (b && b.y) {
      const age = FT.age(p);
      return age != null ? `${b.y} · ${t('person.age', { n: age })}` : String(b.y);
    }
    return '';
  };

  // Short line to tell apart people with similar names: "child of Ahmad".
  FT.personHint = (p) => {
    const parent = FT.person(p.fatherId) || FT.person(p.motherId);
    const bits = [];
    if (p.nickname && p.nickname !== p.firstName) bits.push(p.nickname);
    const b = Family.parseDate(p.birthDate);
    if (b && b.y) bits.push(String(b.y));
    if (parent) bits.push(t('dup.childOf', { name: FT.displayName(parent) }));
    return bits.join(' · ');
  };

  FT.personRow = (p, extra) => `
    <button type="button" class="prow" data-person="${p.id}">
      ${FT.avatar(p, 'md')}
      <span class="prow-main">
        <span class="prow-name">${esc(FT.fullName(p))}${FT.isDeceased(p) ? ` <span class="tag tag-muted">${esc(t('person.deceased'))}</span>` : ''}</span>
        <span class="prow-sub">${esc(extra != null ? extra : FT.personHint(p))}</span>
      </span>
      ${FT.icon('chevronRight', 'prow-chev')}
    </button>`;

  FT.personChip = (p, sub) => `
    <button type="button" class="pchip" data-person="${p.id}">
      ${FT.avatar(p, 'sm')}
      <span class="pchip-text"><span class="pchip-name">${esc(FT.displayName(p))}</span>${sub ? `<span class="pchip-sub">${esc(sub)}</span>` : ''}</span>
    </button>`;

  // Wires every [data-person] button inside root to open that person.
  FT.bindPeople = (root, handler) => {
    root.querySelectorAll('[data-person]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(el.getAttribute('data-person'));
        (handler || FT.openPerson)(id);
      });
    });
  };

  // Malaysian numbers: 012-345 6789 -> 60123456789 (for WhatsApp links).
  FT.phoneDigits = (phone) => {
    let d = String(phone || '').replace(/[^\d+]/g, '');
    if (d.startsWith('+')) return d.slice(1);
    if (d.startsWith('00')) return d.slice(2);
    if (d.startsWith('0')) return '6' + d;
    return d;
  };
  FT.telLink = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
  FT.waLink = (phone, text) => `https://wa.me/${FT.phoneDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  // ---- toast ----

  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  FT.toast = (msg, opts) => {
    const o = opts || {};
    toastEl.textContent = msg;
    toastEl.className = `toast show${o.kind ? ' toast-' + o.kind : ''}`;
    clearTimeout(toastTimer);
    if (!o.sticky) toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, o.duration || 2600);
    return { update: (m) => { toastEl.textContent = m; }, close: () => { toastEl.className = 'toast'; } };
  };
  FT.toastError = (err) => {
    const msg = err && err.message ? err.message : t('error.generic');
    FT.toast(msg, { kind: 'error', duration: 4200 });
  };

  // ---- API ----

  function pickError(data) {
    if (!data) return null;
    return FTI18n.getLang() === 'en' ? (data.errorEn || data.error) : (data.error || data.errorEn);
  }

  async function request(url, opts) {
    let res;
    try {
      res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts));
    } catch {
      throw new Error(t('error.network'));
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(pickError(data) || t('error.generic'));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  FT.api = {
    get: (url) => request(url),
    send: (url, method, body) => request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    form: (url, formData) => request(url, { method: 'POST', body: formData }),
  };

  FT.uploadAvatar = async (blob) => {
    const fd = new FormData();
    fd.append('photo', blob, 'avatar.jpg');
    const data = await FT.api.form('/api/photos', fd);
    return data.photoPath;
  };

  // ---- data ----

  FT.loadPeople = async () => {
    const data = await FT.api.get('/api/people');
    FT.state.people = data.people;
    FT.state.spousePairs = data.spousePairs;
    FT.state.idx = Family.buildIndex(data.people, data.spousePairs);
    FT.state.loaded = true;
    FT.emit('data');
  };

  FT.loadAlbums = async () => {
    const data = await FT.api.get('/api/albums');
    FT.state.albums = data.albums;
    FT.emit('albums');
    return data.albums;
  };

  // ---- overlays (sheets & dialogs) with back-button support ----
  //
  // Every open overlay owns one browser history entry, so the phone's back
  // button closes the top sheet instead of leaving the site.

  const overlayRoot = document.getElementById('overlayRoot');
  const stack = [];
  let pendingBack = 0;
  let backTimer = null;
  let ignorePops = 0;
  let pendingHash = null;

  function scheduleBack() {
    pendingBack += 1;
    if (backTimer) return;
    backTimer = setTimeout(() => {
      const n = pendingBack;
      pendingBack = 0;
      backTimer = null;
      if (n > 0) {
        ignorePops += 1;
        history.go(-n);
      } else if (pendingHash != null) {
        const h = pendingHash;
        pendingHash = null;
        location.hash = h;
      }
    }, 0);
  }

  function pushEntry() {
    // Re-use an entry that a just-closed overlay was about to give back.
    if (pendingBack > 0) { pendingBack -= 1; return; }
    history.pushState({ ftOverlay: true }, '');
  }

  function refreshCovered() {
    stack.forEach((o, i) => o.el.classList.toggle('ov-covered', i < stack.length - 1 && !!stack[i + 1].covers));
  }

  function removeOverlay(o, fromPop) {
    const i = stack.indexOf(o);
    if (i === -1) return;
    stack.splice(i, 1);
    o.el.classList.add('ov-leaving');
    setTimeout(() => o.el.remove(), 180);
    refreshCovered();
    if (!fromPop) scheduleBack();
    if (o.onClose) o.onClose();
  }

  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops -= 1;
      if (ignorePops === 0 && pendingHash != null) {
        const h = pendingHash;
        pendingHash = null;
        if (location.hash !== h) location.hash = h;
        else route();
      }
      return;
    }
    if (stack.length) removeOverlay(stack[stack.length - 1], true);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
      const top = stack[stack.length - 1];
      if (top.dismissible !== false) removeOverlay(top, false);
    }
  });

  FT.closeAllOverlays = () => { [...stack].reverse().forEach((o) => removeOverlay(o, false)); };

  // Go to a page, closing any open sheets first.
  FT.navigate = (hash) => {
    if (stack.length) {
      pendingHash = hash;
      FT.closeAllOverlays();
    } else if (location.hash !== hash) {
      location.hash = hash;
    } else {
      route();
    }
  };

  // Opens a sheet (bottom sheet on phones, centred panel on big screens).
  // opts: { title, body, foot, size: 'auto'|'full', cls, covers, onMount(api), onClose, dismissible }
  FT.sheet = (opts) => {
    const el = document.createElement('div');
    el.className = `ov ov-sheet${opts.size === 'full' ? ' ov-full' : ''}${opts.cls ? ' ' + opts.cls : ''}`;
    el.innerHTML = `
      <div class="ov-backdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-grip" aria-hidden="true"></div>
        <header class="sheet-head">
          <h2 class="sheet-title"></h2>
          <button type="button" class="icon-btn sheet-close" aria-label="${esc(t('common.close'))}">${FT.icon('close')}</button>
        </header>
        <div class="sheet-body"></div>
        <footer class="sheet-foot hidden"></footer>
      </div>`;
    const api = {
      el,
      body: el.querySelector('.sheet-body'),
      foot: el.querySelector('.sheet-foot'),
      setTitle: (s) => { el.querySelector('.sheet-title').textContent = s || ''; },
      setBody: (html) => { api.body.innerHTML = html; },
      setFoot: (html) => { api.foot.innerHTML = html || ''; api.foot.classList.toggle('hidden', !html); },
      close: () => removeOverlay(o, false),
      isOpen: () => stack.includes(o),
    };
    const o = { el, onClose: opts.onClose, covers: opts.covers, dismissible: opts.dismissible };
    api.setTitle(opts.title);
    if (opts.body != null) api.setBody(opts.body);
    if (opts.foot) api.setFoot(opts.foot);
    el.querySelector('.sheet-close').addEventListener('click', api.close);
    el.querySelector('.ov-backdrop').addEventListener('click', () => { if (opts.dismissible !== false) api.close(); });
    overlayRoot.appendChild(el);
    stack.push(o);
    pushEntry();
    refreshCovered();
    requestAnimationFrame(() => el.classList.add('ov-in'));
    if (opts.onMount) opts.onMount(api);
    return api;
  };

  // Simple yes/no question. Resolves true/false.
  FT.confirm = (message, opts) => new Promise((resolve) => {
    const o = opts || {};
    let answered = false;
    const s = FT.sheet({
      cls: 'ov-dialog',
      title: o.title || '',
      body: `<p class="dialog-msg">${esc(message)}</p>`,
      foot: `<button type="button" class="btn btn-ghost" data-no>${esc(o.cancelLabel || t('common.cancel'))}</button>
             <button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(o.okLabel || t('common.yes'))}</button>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    s.foot.querySelector('[data-no]').addEventListener('click', () => { answered = true; resolve(false); s.close(); });
    s.foot.querySelector('[data-yes]').addEventListener('click', () => { answered = true; resolve(true); s.close(); });
  });

  // ---- search ----

  // Matches every typed word against the person's name and nickname,
  // treating spelling variants alike (Mohd = Muhammad, binti = bin...).
  FT.searchPeople = (query, people) => {
    const q = Names.tokens(query);
    const list = people || FT.state.people;
    if (!q.length) return [];
    return list
      .map((p) => {
        const hay = Names.tokens(`${FT.fullName(p)} ${p.nickname || ''}`).join(' ');
        if (!q.every((w) => hay.includes(w))) return null;
        const starts = hay.startsWith(q[0]) || Names.tokens(p.nickname).join(' ').startsWith(q[0]);
        return { p, score: starts ? 0 : 1 };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || FT.fullName(a.p).localeCompare(FT.fullName(b.p)))
      .map((x) => x.p);
  };

  FT.openSearch = () => {
    FT.sheet({
      title: t('search.title'),
      size: 'full',
      body: `
        <div class="search-box">${FT.icon('search')}<input type="search" class="input" autocomplete="off" enterkeyhint="search" placeholder="${esc(t('search.placeholder'))}" /></div>
        <div class="search-results"><p class="muted center pad">${esc(t('search.hint'))}</p></div>`,
      onMount(s) {
        const input = s.body.querySelector('input');
        const results = s.body.querySelector('.search-results');
        input.addEventListener('input', () => {
          const q = input.value.trim();
          if (!q) { results.innerHTML = `<p class="muted center pad">${esc(t('search.hint'))}</p>`; return; }
          const found = FT.searchPeople(q).slice(0, 40);
          results.innerHTML = found.length
            ? `<div class="plist">${found.map((p) => FT.personRow(p)).join('')}</div>`
            : `<p class="muted center pad">${esc(t('search.noResults', { q }))}</p>`;
          FT.bindPeople(results, (id) => FT.openPerson(id));
        });
        setTimeout(() => input.focus(), 250);
      },
    });
  };

  // ---- person picker ----
  //
  // opts: { title, hint, filter(p), multi, selected: [ids], allowNew, onPick(p), onNew(), onDone(ids) }
  FT.pickPerson = (opts) => {
    const selected = new Set(opts.selected || []);
    const pool = FT.state.people.filter((p) => !opts.filter || opts.filter(p));
    const sorted = pool.slice().sort((a, b) => FT.fullName(a).localeCompare(FT.fullName(b)));
    const LIMIT = 80;
    FT.sheet({
      title: opts.title || t('pick.title'),
      size: 'full',
      covers: true,
      body: `
        ${opts.hint ? `<p class="muted small">${esc(opts.hint)}</p>` : ''}
        ${opts.allowNew ? `<button type="button" class="btn btn-soft btn-block" data-new>${FT.icon('plus')} ${esc(t('pick.addNew'))}</button>` : ''}
        <div class="search-box">${FT.icon('search')}<input type="search" class="input" autocomplete="off" placeholder="${esc(t('pick.search'))}" /></div>
        <div class="plist pick-list"></div>`,
      foot: opts.multi ? `<span class="muted" data-count></span><button type="button" class="btn btn-primary" data-done>${esc(t('common.done'))}</button>` : null,
      onMount(s) {
        const input = s.body.querySelector('input');
        const list = s.body.querySelector('.pick-list');
        function paint() {
          const q = input.value.trim();
          const items = q ? FT.searchPeople(q, pool) : sorted;
          const shown = items.slice(0, LIMIT);
          list.innerHTML = shown.length
            ? shown.map((p) => `
              <button type="button" class="prow${selected.has(p.id) ? ' is-selected' : ''}" data-pick="${p.id}">
                ${FT.avatar(p, 'md')}
                <span class="prow-main">
                  <span class="prow-name">${esc(FT.fullName(p))}</span>
                  <span class="prow-sub">${esc(FT.personHint(p))}</span>
                </span>
                ${opts.multi ? `<span class="checkbox">${FT.icon('check')}</span>` : ''}
              </button>`).join('') + (items.length > LIMIT ? `<p class="muted center small pad">${esc(t('pick.moreResults'))}</p>` : '')
            : `<p class="muted center pad">${esc(t('pick.none'))}</p>`;
          list.querySelectorAll('[data-pick]').forEach((el) => {
            el.addEventListener('click', () => {
              const id = Number(el.getAttribute('data-pick'));
              if (opts.multi) {
                if (selected.has(id)) selected.delete(id); else selected.add(id);
                el.classList.toggle('is-selected', selected.has(id));
                updateCount();
                return;
              }
              s.close();
              if (opts.onPick) opts.onPick(FT.person(id));
            });
          });
        }
        function updateCount() {
          const c = s.foot.querySelector('[data-count]');
          if (c) c.textContent = t('pick.selected', { n: selected.size });
        }
        input.addEventListener('input', paint);
        paint();
        updateCount();
        const newBtn = s.body.querySelector('[data-new]');
        if (newBtn) newBtn.addEventListener('click', () => { s.close(); if (opts.onNew) opts.onNew(); });
        const done = s.foot.querySelector('[data-done]');
        if (done) done.addEventListener('click', () => { s.close(); if (opts.onDone) opts.onDone([...selected]); });
      },
    });
  };

  // ---- login (Google) ----

  let googleReady = null;
  function waitForGoogle() {
    if (!googleReady) {
      googleReady = new Promise((resolve) => {
        const check = () => {
          if (window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.initialize({ client_id: FT.state.googleClientId, callback: handleCredential });
            resolve();
          } else setTimeout(check, 150);
        };
        check();
      });
    }
    return googleReady;
  }

  let afterLogin = null;
  let loginSheet = null;

  async function handleCredential(response) {
    try {
      const data = await FT.api.send('/api/auth/google', 'POST', { credential: response.credential });
      FT.state.user = data.user;
      if (loginSheet && loginSheet.isOpen()) loginSheet.close();
      FT.toast(t('login.welcome', { name: data.user.name || data.user.email }));
      await FT.loadPeople(); // reload to include phone numbers & addresses
      FT.emit('user');
      const next = afterLogin;
      afterLogin = null;
      if (!data.user.hasSeenTour) setTimeout(FT.openTour, 400);
      else if (next) setTimeout(next, 250);
    } catch (err) {
      FT.toastError(err.message ? err : new Error(t('login.failed')));
    }
  }

  FT.openLogin = (then) => {
    afterLogin = then || null;
    loginSheet = FT.sheet({
      title: t('login.title'),
      body: `
        <div class="login-box">
          <div class="login-icon">🌳</div>
          <p>${esc(t('login.body'))}</p>
          <div class="google-btn"></div>
          ${FT.state.googleClientId ? '' : `<p class="muted small">${esc(t('more.loginNotReady'))}</p>`}
        </div>`,
      onMount(s) {
        if (!FT.state.googleClientId) return;
        const holder = s.body.querySelector('.google-btn');
        holder.innerHTML = `<p class="muted small">${esc(t('common.loading'))}</p>`;
        waitForGoogle().then(() => {
          holder.innerHTML = '';
          window.google.accounts.id.renderButton(holder, {
            theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            locale: FTI18n.getLang() === 'en' ? 'en' : 'ms',
            width: Math.min(320, holder.clientWidth || 300),
          });
        });
      },
    });
  };

  // Runs `fn` now if signed in, otherwise asks to sign in first.
  FT.requireLogin = (fn) => {
    if (FT.state.user && FT.state.user.status !== 'banned') return fn();
    FT.openLogin(fn);
  };

  FT.logout = async () => {
    await FT.api.send('/api/auth/logout', 'POST');
    FT.state.user = null;
    await FT.loadPeople();
    FT.emit('user');
  };

  FT.openTour = () => {
    const steps = [1, 2, 3, 4];
    let i = 0;
    const s = FT.sheet({
      title: '',
      cls: 'ov-dialog',
      onClose: () => {
        if (FT.state.user && !FT.state.user.hasSeenTour) {
          FT.state.user.hasSeenTour = true;
          FT.api.send('/api/auth/seen-tour', 'POST').catch(() => {});
        }
      },
    });
    function paint() {
      const n = steps[i];
      s.setTitle(t(`tour.${n}.title`));
      s.setBody(`<p class="muted small">${esc(t('tour.step', { i: i + 1, n: steps.length }))}</p><p class="tour-body">${esc(t(`tour.${n}.body`))}</p>`);
      const last = i === steps.length - 1;
      s.setFoot(`${last ? '' : `<button type="button" class="btn btn-ghost" data-skip>${esc(t('tour.skip'))}</button>`}
        <button type="button" class="btn btn-primary" data-next>${esc(last ? t('common.done') : t('tour.next'))}</button>`);
      const skip = s.foot.querySelector('[data-skip]');
      if (skip) skip.addEventListener('click', s.close);
      s.foot.querySelector('[data-next]').addEventListener('click', () => {
        if (last) s.close(); else { i += 1; paint(); }
      });
    }
    paint();
  };

  FT.openUserAdmin = async () => {
    const s = FT.sheet({ title: t('admin.title'), body: `<p class="muted">${esc(t('common.loading'))}</p>` });
    async function paint() {
      try {
        const data = await FT.api.get('/api/admin/users');
        s.setBody(`<p class="muted small">${esc(t('admin.body'))}</p>
          <div class="plist">${data.users.map((u) => `
            <div class="prow prow-static">
              ${u.picture ? `<span class="av av-md"><img src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer" /></span>` : `<span class="av av-md g-unknown">${esc((u.name || u.email)[0].toUpperCase())}</span>`}
              <span class="prow-main">
                <span class="prow-name">${esc(u.name || u.email)} ${u.status === 'banned' ? `<span class="tag tag-danger">${esc(t('admin.blocked'))}</span>` : ''}</span>
                <span class="prow-sub">${esc(u.email)}</span>
              </span>
              ${u.isAdmin ? '' : `<button type="button" class="btn btn-small ${u.status === 'banned' ? 'btn-soft' : 'btn-ghost'}" data-toggle="${esc(u.id)}" data-status="${esc(u.status)}">${esc(u.status === 'banned' ? t('admin.unblock') : t('admin.block'))}</button>`}
            </div>`).join('') || `<p class="muted">${esc(t('admin.none'))}</p>`}</div>`);
        s.body.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
          const action = b.getAttribute('data-status') === 'banned' ? 'unban' : 'ban';
          try {
            await FT.api.send(`/api/admin/users/${encodeURIComponent(b.getAttribute('data-toggle'))}/${action}`, 'POST');
            paint();
          } catch (err) { FT.toastError(err); }
        }));
      } catch (err) {
        s.setBody(`<p class="error-text">${esc(err.message)}</p>`);
      }
    }
    paint();
  };

  // ---- theme & language ----

  FT.setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('familyTreeTheme', theme); } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1c1a17' : '#8a5a44');
    FT.emit('theme');
  };

  FT.setLang = (lang) => {
    FTI18n.setLang(lang);
    paintChrome();
    FT.emit('lang');
    route();
  };

  const langBtn = document.getElementById('langBtn');
  langBtn.addEventListener('click', () => FT.setLang(FTI18n.getLang() === 'en' ? 'ms' : 'en'));
  document.getElementById('searchBtn').addEventListener('click', FT.openSearch);
  document.getElementById('backBtn').addEventListener('click', () => {
    const v = FT.views[currentView];
    FT.navigate(v && v.parent ? v.parent : '#/');
  });

  function paintChrome() {
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = FT.icon(el.getAttribute('data-icon')); });
    document.getElementById('searchBtn').innerHTML = FT.icon('search');
    document.getElementById('backBtn').innerHTML = FT.icon('back');
    langBtn.innerHTML = `${FT.icon('globe')}<span>${FTI18n.getLang() === 'en' ? 'BM' : 'EN'}</span>`;
    FTI18n.applyStatic();
  }

  // ---- routing ----
  //
  // #/            home
  // #/tree        whole tree       #/tree/person/12   one person's descendants
  //                                #/tree/couple/3/1  one marriage's family
  // #/map         family map
  // #/memories    albums           #/memories/5       one album
  // #/relation    relationship finder (optionally /12/34)
  // #/more        settings & account

  let currentView = null;
  const pageTitle = document.getElementById('pageTitle');

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    let name = parts[0] || 'home';
    if (name === 'memories' && parts[1]) name = 'album';
    return { name, parts };
  }

  function route() {
    const r = parseRoute();
    const name = FT.views[r.name] ? r.name : 'home';
    const view = FT.views[name];
    if (currentView && currentView !== name && FT.views[currentView].leave) FT.views[currentView].leave();
    currentView = name;
    document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.getAttribute('data-view') === name));
    const tab = view.tab || name;
    document.querySelectorAll('#tabbar [data-tab]').forEach((a) => a.classList.toggle('active', a.getAttribute('data-tab') === tab));
    document.getElementById('backBtn').classList.toggle('hidden', !view.parent);
    document.body.setAttribute('data-page', name);
    view.render(r);
    pageTitle.textContent = view.title ? view.title(r) : t('app.name');
    document.title = name === 'home' ? t('app.name') : `${pageTitle.textContent} · ${t('app.name')}`;
  }
  FT.route = route;
  FT.currentView = () => currentView;
  FT.setPageTitle = (s) => { pageTitle.textContent = s; };

  // The page changed some other way (e.g. the browser's forward button)
  // while sheets were open: drop them so they don't cover the new page.
  window.addEventListener('hashchange', () => {
    [...stack].reverse().forEach((o) => removeOverlay(o, true));
    route();
  });

  // Re-draw the visible page when data, login or theme changes.
  ['data', 'user', 'theme', 'albums'].forEach((ev) => FT.on(ev, () => {
    const v = FT.views[currentView];
    if (v && v.refresh) v.refresh(ev); else if (v && ev !== 'theme') route();
  }));

  // ---- start ----

  FT.start = async () => {
    if (history.state && history.state.ftOverlay) history.replaceState(null, '');
    paintChrome();
    Object.values(FT.views).forEach((v) => v.init && v.init());
    route();
    try {
      const [config, me] = await Promise.all([FT.api.get('/api/config'), FT.api.get('/api/auth/me')]);
      FT.state.googleClientId = config.googleClientId;
      FT.state.user = me.user;
      if (config.googleClientId) waitForGoogle();
      await FT.loadPeople();
      FT.emit('user');
      FT.loadAlbums().catch(() => {});
    } catch (err) {
      FT.toastError(err);
    }
  };
})();
