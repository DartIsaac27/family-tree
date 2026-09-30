// The family tree page: a pinch-zoom "Chart" and a phone-friendly
// collapsible "List". Both draw the same structure from
// FTFamily.buildUnits, so a grandmother married three times sits on top
// with each husband (and his children) below her in either view.
(function () {
  'use strict';

  const FT = window.FT;
  const { t } = window.FTI18n;
  const Family = window.FTFamily;
  const esc = FT.esc;

  const DIM = { cardW: 116, cardH: 150, gapX: 16, rowH: 214 };
  const PAD = 48;

  let mode = 'chart';
  try { mode = localStorage.getItem('familyTreeMode') === 'list' ? 'list' : 'chart'; } catch { /* ignore */ }

  let filter = null; // { type: 'person', id } | { type: 'couple', a, b } | { type: 'focus', id }
  let filterKey = '';
  let needsFit = true;
  const listOpen = new Map(); // unit key -> expanded?

  let el = {};
  let zoom = null;

  const view = FT.views.tree = {
    tab: 'tree',
    title() {
      if (filter && filter.type === 'couple') {
        const a = FT.person(filter.a), b = FT.person(filter.b);
        if (a && b) return t('tree.showingFamily', { a: FT.displayName(a), b: FT.displayName(b) });
      }
      if (filter && filter.type === 'person' && FT.person(filter.id)) return t('tree.showingBranch', { name: FT.displayName(FT.person(filter.id)) });
      return t('tab.tree');
    },
    init,
    render(r) {
      const [, kind, x, y] = r.parts;
      let next = null;
      if (kind === 'person' && Number(x)) next = { type: 'person', id: Number(x) };
      else if (kind === 'couple' && Number(x) && Number(y)) next = { type: 'couple', a: Number(x), b: Number(y) };
      else if (kind === 'focus' && Number(x)) next = { type: 'focus', id: Number(x) };
      const key = JSON.stringify(next);
      if (key !== filterKey) needsFit = true;
      filter = next;
      filterKey = key;
      paint();
    },
    refresh(ev) { if (ev !== 'albums') paint(); },
  };

  function init() {
    const root = document.getElementById('view-tree');
    root.innerHTML = `
      <div class="tree-bar">
        <div class="seg seg-sm" data-mode>
          <button type="button" data-m="chart"></button>
          <button type="button" data-m="list"></button>
        </div>
        <div class="tree-filter hidden"><span class="tree-filter-text"></span><button type="button" class="btn btn-small btn-soft" data-show-all></button></div>
      </div>
      <div class="tree-hint hidden"><span></span><button type="button" class="icon-btn" data-hint-close></button></div>
      <div class="tree-chart">
        <div class="tree-stage"><svg class="tree-lines" xmlns="http://www.w3.org/2000/svg"></svg><div class="tree-cards"></div></div>
        <div class="zoom-ctrls">
          <button type="button" class="icon-btn" data-z="in"></button>
          <button type="button" class="icon-btn" data-z="out"></button>
          <button type="button" class="icon-btn" data-z="fit"></button>
        </div>
      </div>
      <div class="tree-list hidden"></div>
      <div class="empty tree-empty hidden"></div>
      <button type="button" class="fab" data-add></button>`;
    el = {
      root,
      chart: root.querySelector('.tree-chart'),
      stage: root.querySelector('.tree-stage'),
      svg: root.querySelector('.tree-lines'),
      cards: root.querySelector('.tree-cards'),
      list: root.querySelector('.tree-list'),
      empty: root.querySelector('.tree-empty'),
      filterBox: root.querySelector('.tree-filter'),
      hint: root.querySelector('.tree-hint'),
    };

    zoom = d3.zoom().scaleExtent([0.12, 2.5]).on('zoom', (e) => {
      const tr = e.transform;
      el.stage.style.transform = `translate(${tr.x}px, ${tr.y}px) scale(${tr.k})`;
    });
    d3.select(el.chart).call(zoom).on('dblclick.zoom', null);

    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      mode = b.getAttribute('data-m');
      try { localStorage.setItem('familyTreeMode', mode); } catch { /* ignore */ }
      needsFit = true;
      paint();
    }));
    root.querySelector('[data-show-all]').addEventListener('click', () => FT.navigate('#/tree'));
    root.querySelector('[data-add]').addEventListener('click', () => FT.editPerson({}));
    root.querySelector('[data-hint-close]').addEventListener('click', () => {
      try { localStorage.setItem('familyTreeHintSeen', '1'); } catch { /* ignore */ }
      el.hint.classList.add('hidden');
    });
    root.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
      const z = b.getAttribute('data-z');
      const sel = d3.select(el.chart).transition().duration(250);
      if (z === 'in') zoom.scaleBy(sel, 1.35);
      else if (z === 'out') zoom.scaleBy(sel, 1 / 1.35);
      else fit(true);
    }));
    window.addEventListener('resize', () => { if (FT.currentView() === 'tree' && mode === 'chart') fit(false); });
  }

  function visibleSet() {
    const idx = FT.state.idx;
    if (filter && filter.type === 'person' && FT.person(filter.id)) return Family.branchOfPerson(idx, filter.id);
    if (filter && filter.type === 'couple' && FT.person(filter.a) && FT.person(filter.b)) return Family.branchOfCouple(idx, filter.a, filter.b);
    return null;
  }

  function paintChrome() {
    el.root.querySelector('[data-m="chart"]').innerHTML = `${FT.icon('tree')} ${esc(t('tree.chart'))}`;
    el.root.querySelector('[data-m="list"]').innerHTML = `${FT.icon('list')} ${esc(t('tree.list'))}`;
    el.root.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-m') === mode));
    el.root.querySelector('[data-z="in"]').innerHTML = FT.icon('zoomIn');
    el.root.querySelector('[data-z="out"]').innerHTML = FT.icon('zoomOut');
    el.root.querySelector('[data-z="fit"]').innerHTML = FT.icon('fit');
    el.root.querySelector('[data-z="in"]').setAttribute('aria-label', t('tree.zoomIn'));
    el.root.querySelector('[data-z="out"]').setAttribute('aria-label', t('tree.zoomOut'));
    el.root.querySelector('[data-z="fit"]').setAttribute('aria-label', t('tree.fit'));
    el.root.querySelector('[data-add]').innerHTML = FT.icon('plus');
    el.root.querySelector('[data-add]').setAttribute('aria-label', t('home.quickAdd'));
    el.root.querySelector('[data-hint-close]').innerHTML = FT.icon('close');
    const showFilter = filter && filter.type !== 'focus' && visibleSet();
    el.filterBox.classList.toggle('hidden', !showFilter);
    if (showFilter) {
      el.filterBox.querySelector('.tree-filter-text').textContent = view.title();
      el.filterBox.querySelector('[data-show-all]').textContent = `✕ ${t('tree.showAll')}`;
    }
  }

  function paint() {
    if (!el.root) return;
    paintChrome();
    FT.setPageTitle(view.title());
    const people = FT.state.people;
    const loaded = FT.state.loaded;
    el.empty.classList.toggle('hidden', !loaded || people.length > 0);
    el.chart.classList.toggle('hidden', mode !== 'chart' || !people.length);
    el.list.classList.toggle('hidden', mode !== 'list' || !people.length);
    if (loaded && !people.length) {
      el.empty.innerHTML = `<div class="empty-art">🌱</div><h2>${esc(t('tree.empty'))}</h2><p>${esc(t('tree.emptyBody'))}</p>
        <button type="button" class="btn btn-primary">${FT.icon('plus')} ${esc(t('tree.addFirst'))}</button>`;
      el.empty.querySelector('button').addEventListener('click', () => FT.editPerson({}));
      return;
    }
    if (!people.length) return;
    const roots = Family.buildUnits(FT.state.idx, visibleSet());
    const hasHub = (function anyHub(units) { return units.some((u) => u.marriageNo || anyHub(u.children)); })(roots);
    let hintSeen = false;
    try { hintSeen = !!localStorage.getItem('familyTreeHintSeen'); } catch { /* ignore */ }
    el.hint.classList.toggle('hidden', hintSeen || !hasHub || mode !== 'chart');
    el.hint.querySelector('span').textContent = `💡 ${t('tree.hint')}`;
    if (mode === 'chart') paintChart(roots); else paintList(roots);
  }

  // ---- chart ----

  function shortYears(p) {
    const b = Family.parseDate(p.birthDate), d = Family.parseDate(p.deathDate);
    if (d && d.y) return `${b && b.y ? b.y : '?'}–${d.y}`;
    if (FT.isDeceased(p)) return b && b.y ? `${b.y}– · ${t('person.deceased')}` : t('person.deceased');
    return b && b.y ? String(b.y) : '';
  }

  let layout = null;

  function paintChart(roots) {
    const L = Family.layoutChart(FT.state.idx, roots, DIM);
    layout = L;
    if (!L.bounds) return;
    const ox = PAD - L.bounds.minX, oy = PAD - L.bounds.minY;
    const w = L.bounds.maxX - L.bounds.minX + PAD * 2;
    const h = L.bounds.maxY - L.bounds.minY + PAD * 2;
    L.offset = { ox, oy, w, h };

    el.stage.style.width = `${w}px`;
    el.stage.style.height = `${h}px`;
    el.svg.setAttribute('width', w);
    el.svg.setAttribute('height', h);
    el.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    el.svg.innerHTML = `<g transform="translate(${ox},${oy})">
      ${L.parentLines.map((l) => `<path class="ln-parent" d="${l.d}"/>`).join('')}
      ${L.stackLines.map((l) => `<path class="ln-stack" d="${l.d}"/>`).join('')}
      ${L.coupleLines.map((l) => `<path class="ln-couple" d="M ${l.x1} ${l.y} H ${l.x2}"/><circle class="ln-heart" cx="${(l.x1 + l.x2) / 2}" cy="${l.y}" r="4"/>`).join('')}
    </g>`;

    const focusId = filter && filter.type === 'focus' ? filter.id : null;
    const cards = L.nodes.map((n) => {
      const p = n.person;
      const hubCount = n.isHub ? Family.spousesOf(FT.state.idx, p.id).length : 0;
      return `<button type="button" class="tc g-${p.gender || 'unknown'}${FT.isDeceased(p) ? ' is-deceased' : ''}${n.isHub ? ' is-hub' : ''}${n.id === focusId ? ' is-focus' : ''}"
        data-person="${p.id}" style="left:${n.x + ox}px;top:${n.y + oy}px;width:${DIM.cardW}px;height:${DIM.cardH}px">
        ${FT.avatar(p, 'lg')}
        <span class="tc-name">${esc(FT.displayName(p))}</span>
        <span class="tc-sub">${esc(shortYears(p))}</span>
        ${hubCount > 1 ? `<span class="tc-badge" title="${esc(t('tree.marriages', { n: hubCount }))}">${FT.icon('ring')}${hubCount}</span>` : ''}
      </button>`;
    }).join('');
    const labels = L.labels.map((lb) => {
      const sp = FT.person(lb.spouseId);
      return `<button type="button" class="tc-label" data-couple="${lb.hubId},${lb.spouseId}" style="left:${lb.x + ox}px;top:${lb.y + oy}px">
        ${FT.icon('ring')}<span>${esc(FT.marriageLabel(sp, lb.marriageNo))}</span>${FT.icon('chevronRight')}
      </button>`;
    }).join('');
    el.cards.innerHTML = cards + labels;
    FT.bindPeople(el.cards);
    el.cards.querySelectorAll('[data-couple]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const [a, c] = b.getAttribute('data-couple').split(',');
      FT.navigate(`#/tree/couple/${a}/${c}`);
    }));

    if (needsFit) {
      needsFit = false;
      requestAnimationFrame(() => {
        if (focusId && L.byId.get(focusId)) centerOn(focusId);
        else fit(false);
      });
    }
  }

  // Whole tree if it fits at a readable size; otherwise start at the top
  // (the eldest generation) at a readable zoom so people can pan down.
  function fit(animate) {
    if (!layout || !layout.offset) return;
    const rect = el.chart.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { w, h } = layout.offset;
    const fitScale = Math.min(rect.width / w, rect.height / h, 1.1);
    const minReadable = rect.width < 600 ? 0.42 : 0.3;
    let k, x, y;
    if (fitScale >= minReadable) {
      k = fitScale;
      x = (rect.width - w * k) / 2;
      y = (rect.height - h * k) / 2;
    } else {
      k = Math.max(minReadable, Math.min(rect.width / w, 1));
      const top = layout.nodes.filter((n) => n.depth === 0).sort((a, b) => a.x - b.x)[0];
      const cx = top ? top.x + layout.offset.ox + DIM.cardW / 2 : w / 2;
      x = rect.width / 2 - cx * k;
      y = 12;
    }
    const tr = d3.zoomIdentity.translate(x, y).scale(k);
    const sel = d3.select(el.chart);
    (animate ? sel.transition().duration(350) : sel).call(zoom.transform, tr);
  }

  function centerOn(id) {
    const n = layout && layout.byId.get(id);
    if (!n) return;
    const rect = el.chart.getBoundingClientRect();
    const k = 0.95;
    const cx = n.x + layout.offset.ox + DIM.cardW / 2;
    const cy = n.y + layout.offset.oy + DIM.cardH / 2;
    d3.select(el.chart).call(zoom.transform, d3.zoomIdentity.translate(rect.width / 2 - cx * k, rect.height / 2.4 - cy * k).scale(k));
  }

  // ---- list ----

  function paintList(roots) {
    // "Show in tree" for someone deep down: open every branch above them.
    if (needsFit && filter && filter.type === 'focus') {
      (function openPath(units, trail) {
        return units.some((u) => {
          if (u.members.includes(filter.id)) { trail.forEach((k) => listOpen.set(k, true)); return true; }
          return openPath(u.children, trail.concat(u.key));
        });
      })(roots, []);
    }
    function isOpen(u, depth) {
      if (listOpen.has(u.key)) return listOpen.get(u.key);
      return depth < 3;
    }
    function personBtn(p) {
      return `<button type="button" class="ln-person" data-person="${p.id}">
        ${FT.avatar(p, 'sm')}
        <span class="ln-text"><span class="ln-name">${esc(FT.displayName(p))}${FT.isDeceased(p) ? ` <span class="tag tag-muted">${esc(t('person.deceased'))}</span>` : ''}</span>
        <span class="ln-sub">${esc([p.nickname ? FT.fullName(p) : '', shortYears(p)].filter(Boolean).join(' · '))}</span></span>
      </button>`;
    }
    function unitHtml(u, depth) {
      const people = u.members.map((id) => FT.person(id));
      const open = isOpen(u, depth);
      const kidsCount = u.children.length;
      const hubCount = people.length === 1 ? Family.spousesOf(FT.state.idx, people[0].id).length : 0;
      let head = '';
      if (u.marriageNo) {
        const hub = FT.person(u.stackedOf);
        head = `<div class="ln-marriage">${FT.icon('ring')}<span>${esc(FT.marriageLabel(people[0], u.marriageNo))}</span>
          <a href="#/tree/couple/${hub.id}/${people[0].id}" class="ln-family" data-nav>${esc(t('tree.viewFamily'))} ${FT.icon('chevronRight')}</a></div>`;
      }
      return `<div class="ln${u.marriageNo ? ' ln-stacked' : ''}" data-key="${esc(u.key)}">
        ${head}
        <div class="ln-row">
          <button type="button" class="ln-toggle${kidsCount ? '' : ' is-leaf'}" data-toggle="${esc(u.key)}" aria-expanded="${open}" ${kidsCount ? '' : 'disabled'}>${kidsCount ? FT.icon(open ? 'chevronDown' : 'chevronRight') : ''}</button>
          <div class="ln-people">${people.map(personBtn).join(`<span class="ln-amp">${FT.icon('heart')}</span>`)}</div>
          ${hubCount > 1 ? `<span class="tag">${FT.icon('ring')} ${hubCount}</span>` : ''}
          ${kidsCount && !open ? `<span class="ln-count">${kidsCount}</span>` : ''}
        </div>
        ${kidsCount && open ? `<div class="ln-kids">${u.children.map((c) => unitHtml(c, depth + 1)).join('')}</div>` : ''}
      </div>`;
    }
    el.list.innerHTML = `<div class="ln-root">${roots.map((u) => unitHtml(u, 0)).join('')}</div>`;
    FT.bindPeople(el.list);
    el.list.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const key = b.getAttribute('data-toggle');
      listOpen.set(key, b.getAttribute('aria-expanded') !== 'true');
      const scroll = el.list.scrollTop;
      paint();
      el.list.scrollTop = scroll;
    }));
    el.list.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      FT.navigate(a.getAttribute('href'));
    }));
    if (needsFit) {
      needsFit = false;
      el.list.scrollTop = 0;
      if (filter && filter.type === 'focus') {
        const target = el.list.querySelector(`[data-person="${filter.id}"]`);
        if (target) { target.scrollIntoView({ block: 'center' }); target.classList.add('is-focus'); }
      }
    }
  }
})();
