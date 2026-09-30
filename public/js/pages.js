// Home (search, stats, birthdays, shortcuts), the relationship finder and
// the "More" page (account, language, theme). Starts the app at the end.
(function () {
  'use strict';

  const FT = window.FT;
  const { t } = window.FTI18n;
  const Family = window.FTFamily;
  const esc = FT.esc;

  // ---- home ----

  FT.views.home = {
    title: () => t('app.name'),
    render: paintHome,
    refresh: paintHome,
  };

  function paintHome() {
    const root = document.getElementById('view-home');
    const user = FT.state.user;
    const people = FT.state.people;
    const idx = FT.state.idx;
    const now = new Date();
    const month = now.getMonth() + 1;
    const births = Family.birthdaysInMonth(people, month, now.getFullYear());
    const states = new Set(people.map((p) => p.birthState).filter((s) => s && s !== FT.OUTSIDE_MALAYSIA));
    const albums = FT.state.albums || [];
    const firstName = user ? String(user.name || user.email).split(' ')[0] : '';

    const stat = (n, label, href) => `<a class="stat" href="${href}"><span class="stat-n">${n}</span><span class="stat-l">${esc(label)}</span></a>`;

    let html = `<div class="page home">
      <div class="hero">
        <p class="hero-hello">${esc(user ? t('home.helloUser', { name: firstName }) : t('home.hello'))}</p>
        <h2 class="hero-title">${esc(t('app.tagline'))}</h2>
        <button type="button" class="search-fake" data-search>${FT.icon('search')}<span>${esc(t('search.short'))}</span></button>
      </div>
      <div class="stats">
        ${stat(people.length, t('home.statMembers'), '#/tree')}
        ${stat(Family.generationCount(idx), t('home.statGenerations'), '#/tree')}
        ${stat(states.size, t('home.statStates'), '#/map')}
        ${stat(albums.length, t('home.statAlbums'), '#/memories')}
      </div>`;

    html += `<section class="card"><h3 class="card-title">${FT.icon('cake')} ${esc(t('home.birthdays', { month: FTI18n.months()[month - 1] }))}</h3>`;
    if (!births.length) html += `<p class="muted">${esc(t('home.noBirthdays'))}</p>`;
    else {
      html += `<div class="plist">${births.map((b) => {
        const today = b.day === now.getDate();
        const when = today ? t('home.birthdayToday') : `${b.day} ${FTI18n.months()[month - 1]}`;
        const sub = [when, b.age != null ? t('home.turns', { age: b.age }) : null].filter(Boolean).join(' · ');
        const wa = user && b.person.phone
          ? `<a class="btn btn-soft btn-small" href="${esc(FT.waLink(b.person.phone, t('home.wishMessage', { name: FT.displayName(b.person) })))}" target="_blank" rel="noopener">${FT.icon('whatsapp')} ${esc(t('home.wish'))}</a>`
          : '';
        return `<div class="bday${today ? ' is-today' : ''}">${FT.personRow(b.person, sub)}${wa}</div>`;
      }).join('')}</div>`;
    }
    html += `</section>`;

    html += `<section><h3 class="section-title">${esc(t('home.quick'))}</h3><div class="quick">
      <a class="quick-btn" href="#/tree">${FT.icon('tree')}<span>${esc(t('home.quickTree'))}</span></a>
      <a class="quick-btn" href="#/map">${FT.icon('map')}<span>${esc(t('home.quickMap'))}</span></a>
      <a class="quick-btn" href="#/relation">${FT.icon('link')}<span>${esc(t('home.quickRelation'))}</span></a>
      <button type="button" class="quick-btn" data-add>${FT.icon('plus')}<span>${esc(t('home.quickAdd'))}</span></button>
    </div></section>`;

    if (albums.length) {
      html += `<section><div class="section-head"><h3 class="section-title">${esc(t('home.recentMemories'))}</h3><a href="#/memories" class="link-btn">${esc(t('common.seeAll'))}</a></div>
        <div class="album-strip">${albums.slice(0, 8).map(FT.albumCard).join('')}</div></section>`;
    }

    if (!user) {
      html += `<button type="button" class="card login-card" data-login>
        <span class="login-card-icon">${FT.icon('shield')}</span>
        <span><b>${esc(t('home.loginCardTitle'))}</b><span class="muted">${esc(t('home.loginCardBody'))}</span></span>
        ${FT.icon('chevronRight')}
      </button>`;
    }
    html += `</div>`;
    root.innerHTML = html;
    FT.bindPeople(root);
    root.querySelector('[data-search]').addEventListener('click', FT.openSearch);
    root.querySelector('[data-add]').addEventListener('click', () => FT.editPerson({}));
    const login = root.querySelector('[data-login]');
    if (login) login.addEventListener('click', () => FT.openLogin());
  }

  // ---- relationship finder ----

  let relA = null;
  let relB = null;

  FT.views.relation = {
    tab: 'more',
    parent: '#/more',
    title: () => t('rel.title'),
    render(r) {
      if (r.parts[1]) relA = Number(r.parts[1]) || null;
      if (r.parts[2]) relB = Number(r.parts[2]) || null;
      paintRelation();
    },
    refresh: () => paintRelation(),
  };

  function relPickBtn(which, id, label) {
    const p = FT.person(id);
    return `<button type="button" class="rel-pick" data-which="${which}">
      ${p ? FT.avatar(p, 'md') : `<span class="av av-md g-unknown">?</span>`}
      <span class="rel-pick-text"><span class="muted small">${esc(label)}</span><b>${esc(p ? FT.fullName(p) : t('rel.choose'))}</b></span>
    </button>`;
  }

  function paintRelation() {
    const root = document.getElementById('view-relation');
    const a = FT.person(relA), b = FT.person(relB);
    let html = `<div class="page">
      <p class="muted">${esc(t('rel.intro'))}</p>
      <div class="rel-pickers">
        ${relPickBtn('a', relA, t('rel.first'))}
        <button type="button" class="icon-btn rel-swap" data-swap aria-label="${esc(t('rel.swap'))}">${FT.icon('swap')}</button>
        ${relPickBtn('b', relB, t('rel.second'))}
      </div>`;
    if (a && b) {
      const rel = Family.relationship(FT.state.idx, a.id, b.id);
      const spouse = rel.spouseId ? FT.person(rel.spouseId) : null;
      const d = FTI18n.describeRelation(rel, a, b, spouse, (p) => FT.displayName(p));
      let sentence = esc(d.sentence);
      if (d.label) sentence = sentence.replace(esc(d.label), `<b class="rel-label">${esc(d.label)}</b>`);
      html += `<div class="card rel-result"><p class="rel-sentence">${sentence}</p>`;
      const blood = rel.type === 'blood' ? rel : rel.rel;
      if (blood && blood.lcas && blood.kind !== 'self') {
        // A shared ancestor only makes sense for side branches (siblings, cousins...).
        if (blood.up > 0 && blood.down > 0) {
          html += `<h4>${esc(t('rel.commonAncestor'))}</h4><div class="chips">${blood.lcas.map((id) => FT.personChip(FT.person(id))).join('')}</div>`;
        }
        // a (or their spouse) up to the shared ancestor, then down to b (or their spouse)
        const up = blood.pathA;
        const down = blood.pathB.slice(0, -1).reverse();
        const chain = [];
        if (rel.type === 'spouseOfRel') chain.push(a.id);
        chain.push(...up, ...down);
        if (rel.type === 'relOfSpouse') chain.push(b.id);
        html += `<h4>${esc(t('rel.path'))}</h4><div class="rel-path">${chain.map((id) => FT.personChip(FT.person(id))).join(`<span class="rel-arrow">${FT.icon('chevronRight')}</span>`)}</div>`;
      } else if (spouse) {
        html += `<div class="chips">${FT.personChip(spouse)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    root.innerHTML = html;
    FT.bindPeople(root.querySelector('.rel-result') || document.createElement('div'));
    root.querySelectorAll('[data-which]').forEach((btn) => btn.addEventListener('click', () => {
      const which = btn.getAttribute('data-which');
      FT.pickPerson({
        title: which === 'a' ? t('rel.first') : t('rel.second'),
        onPick: (p) => { if (which === 'a') relA = p.id; else relB = p.id; paintRelation(); },
      });
    }));
    root.querySelector('[data-swap]').addEventListener('click', () => { [relA, relB] = [relB, relA]; paintRelation(); });
  }

  // ---- more ----

  FT.views.more = {
    title: () => t('more.title'),
    render: paintMore,
    refresh: paintMore,
  };

  function paintMore() {
    const root = document.getElementById('view-more');
    const user = FT.state.user;
    const lang = FTI18n.getLang();
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    let html = `<div class="page">
      <section class="card"><h3 class="card-title">${FT.icon('users')} ${esc(t('more.account'))}</h3>`;
    if (user) {
      html += `<div class="account">
        ${user.picture ? `<span class="av av-lg"><img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer" /></span>` : `<span class="av av-lg g-unknown">${esc((user.name || user.email)[0].toUpperCase())}</span>`}
        <div><b>${esc(user.name || user.email)}</b><div class="muted small">${esc(user.email)}</div></div>
      </div>
      <button type="button" class="btn btn-ghost btn-block" data-logout>${FT.icon('logout')} ${esc(t('more.logout'))}</button>`;
    } else {
      html += `<p class="muted">${esc(t('login.body'))}</p>
        <button type="button" class="btn btn-primary btn-block" data-login>${esc(t('more.login'))}</button>`;
    }
    html += `</section>
      <section class="card">
        <h3 class="card-title">${FT.icon('globe')} ${esc(t('more.language'))}</h3>
        <div class="seg seg-block"><button type="button" data-lang="ms" class="${lang === 'ms' ? 'active' : ''}">Bahasa Malaysia</button><button type="button" data-lang="en" class="${lang === 'en' ? 'active' : ''}">English</button></div>
        <h3 class="card-title">${FT.icon(theme === 'dark' ? 'moon' : 'sun')} ${esc(t('more.theme'))}</h3>
        <div class="seg seg-block"><button type="button" data-theme-set="light" class="${theme === 'light' ? 'active' : ''}">${FT.icon('sun')} ${esc(t('more.light'))}</button><button type="button" data-theme-set="dark" class="${theme === 'dark' ? 'active' : ''}">${FT.icon('moon')} ${esc(t('more.dark'))}</button></div>
      </section>
      <section class="card menu-list">
        <a href="#/relation" class="menu-item">${FT.icon('link')}<span>${esc(t('rel.title'))}</span>${FT.icon('chevronRight')}</a>
        <button type="button" class="menu-item" data-tour>${FT.icon('help')}<span>${esc(t('more.tour'))}</span>${FT.icon('chevronRight')}</button>
        ${user && user.isAdmin ? `<button type="button" class="menu-item" data-admin>${FT.icon('shield')}<span>${esc(t('more.manageUsers'))}</span>${FT.icon('chevronRight')}</button>` : ''}
      </section>
      <p class="muted small center">🔒 ${esc(t('more.privacy'))}</p>
    </div>`;
    root.innerHTML = html;
    const on = (sel, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('[data-login]', () => FT.openLogin());
    on('[data-logout]', () => FT.logout());
    on('[data-tour]', () => FT.openTour());
    on('[data-admin]', () => FT.openUserAdmin());
    root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => FT.setLang(b.getAttribute('data-lang'))));
    root.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => { FT.setTheme(b.getAttribute('data-theme-set')); paintMore(); }));
  }

  FT.start();
})();
