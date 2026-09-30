// The family map: Malaysia's states shaded by how many family members were
// born (or now live) there. Tap a state to see who; their photos appear on
// the map. In "Lives in" mode, signed-in members also see home pins placed
// from each person's address.
(function () {
  'use strict';

  const FT = window.FT;
  const { t } = window.FTI18n;
  const esc = FT.esc;

  // Label spots that keep small neighbours (KL, Putrajaya, Selangor) apart.
  const LABEL_POS = {
    Selangor: [3.5, 101.25],
    'W.P. Kuala Lumpur': [3.15, 101.7],
    'W.P. Putrajaya': [2.93, 101.69],
    'W.P. Labuan': [5.3, 115.22],
    'Pulau Pinang': [5.38, 100.3],
    Perlis: [6.5, 100.2],
    Melaka: [2.27, 102.26],
  };
  const MALAYSIA_BOUNDS = [[0.85, 99.6], [7.4, 119.3]];

  let mode = 'born';
  let selected = null;
  let map = null;
  let tiles = null;
  let geoLayer = null;
  let geo = null;
  let labelLayer = null;
  let pinLayer = null;
  let el = {};

  let needsFit = true;

  FT.views.map = {
    tab: 'map',
    title: () => t('tab.map'),
    init,
    render() { needsFit = true; paint(); },
    refresh(ev) { if (ev !== 'albums') paint(); },
  };

  function init() {
    const root = document.getElementById('view-map');
    root.innerHTML = `
      <div class="map-bar"><div class="seg seg-sm">
        <button type="button" data-mm="born"></button>
        <button type="button" data-mm="lives"></button>
      </div></div>
      <div class="map-layout">
        <div class="map-wrap"><div class="map-canvas"></div></div>
        <div class="map-panel"></div>
      </div>`;
    el = { root, canvas: root.querySelector('.map-canvas'), panel: root.querySelector('.map-panel') };
    root.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => {
      mode = b.getAttribute('data-mm');
      selected = null;
      needsFit = true;
      paint();
    }));
  }

  function field(p) { return mode === 'born' ? p.birthState : p.state; }

  function groups() {
    const out = new Map();
    FT.state.people.forEach((p) => {
      const s = field(p);
      if (!s || s === FT.OUTSIDE_MALAYSIA) return;
      if (!out.has(s)) out.set(s, []);
      out.get(s).push(p);
    });
    return out;
  }

  // Free OpenStreetMap background, no API key needed. Dark mode darkens it
  // with a CSS filter (see .leaflet-tile-pane in style.css).
  function setTiles() {
    if (tiles) return;
    tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    tiles.bringToBack();
  }

  function ensureMap() {
    if (map) return;
    map = L.map(el.canvas, { zoomControl: false, zoomSnap: 0.25, minZoom: 4, maxBounds: [[-6, 92], [14, 128]], worldCopyJump: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.attributionControl.setPrefix(false);
    setTiles();
    map.fitBounds(MALAYSIA_BOUNDS);
    labelLayer = L.layerGroup().addTo(map);
    pinLayer = L.layerGroup().addTo(map);
    fetch('geo/malaysia-states.json')
      .then((r) => r.json())
      .then((data) => { geo = data; needsFit = true; paint(); })
      .catch(() => {});
  }

  function labelPos(name, layer) {
    if (LABEL_POS[name]) return LABEL_POS[name];
    if (layer) { const c = layer.getBounds().getCenter(); return [c.lat, c.lng]; }
    const s = FT.STATES.find((x) => x.name === name);
    return s ? [s.lat, s.lng] : null;
  }

  function paint() {
    if (!el.root) return;
    el.root.querySelector('[data-mm="born"]').innerHTML = `${FT.icon('cake')} ${esc(t('map.born'))}`;
    el.root.querySelector('[data-mm="lives"]').innerHTML = `${FT.icon('home')} ${esc(t('map.lives'))}`;
    el.root.querySelectorAll('[data-mm]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-mm') === mode));
    if (typeof L === 'undefined') return;
    ensureMap();

    const byState = groups();
    const max = Math.max(1, ...[...byState.values()].map((l) => l.length));
    const layersByName = new Map();

    // Leaflet writes colours as SVG attributes, which can't use CSS vars.
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim() || '#8a5a44';
    const border = css.getPropertyValue('--map-border').trim() || '#9a8f80';

    if (geoLayer) geoLayer.remove();
    if (geo) {
      geoLayer = L.geoJSON(geo, {
        style: (f) => {
          const n = (byState.get(f.properties.name) || []).length;
          const isSel = f.properties.name === selected;
          return {
            className: 'state-shape',
            color: isSel ? accent : border,
            weight: isSel ? 3 : 1,
            fillColor: accent,
            fillOpacity: n ? 0.18 + 0.55 * (n / max) : 0.03,
          };
        },
        onEachFeature: (f, layer) => {
          layersByName.set(f.properties.name, layer);
          layer.on('click', () => select(f.properties.name));
        },
      }).addTo(map);
    }

    labelLayer.clearLayers();
    byState.forEach((list, name) => {
      const pos = labelPos(name, layersByName.get(name));
      if (!pos) return;
      L.marker(pos, {
        icon: L.divIcon({ className: `state-count${name === selected ? ' is-selected' : ''}`, html: `<span>${list.length}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
        keyboard: false,
      }).on('click', () => select(name)).addTo(labelLayer);
    });

    paintPins(byState, layersByName);
    paintPanel(byState);

    // Zoom to the states where family members are (usually the Peninsula),
    // not all of Malaysia, so the shapes are big enough to tap on a phone.
    setTimeout(() => {
      map.invalidateSize();
      if (!needsFit || selected || !geo || !FT.state.loaded) return;
      needsFit = false;
      const bounds = L.latLngBounds([]);
      const withPeople = groups();
      if (geoLayer) geoLayer.getLayers().forEach((l) => { if (withPeople.has(l.feature.properties.name)) bounds.extend(l.getBounds()); });
      map.fitBounds(bounds.isValid() ? bounds : MALAYSIA_BOUNDS, { padding: [24, 24], maxZoom: 7 });
    }, 60);
  }

  function select(name) {
    selected = selected === name ? null : name;
    paint();
    if (selected) {
      const layer = geoLayer && geoLayer.getLayers().find((l) => l.feature.properties.name === selected);
      if (layer) map.flyToBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 10, duration: 0.6 });
    } else {
      map.flyToBounds(MALAYSIA_BOUNDS, { duration: 0.6 });
    }
  }

  function avatarIcon(p, dx, dy) {
    return L.divIcon({
      className: 'map-face',
      html: FT.avatar(p, 'sm'),
      iconSize: [36, 36],
      iconAnchor: [18 - dx, 18 - dy],
    });
  }

  // Photos of the people in the chosen state, in a neat grid under its
  // label; in "Lives in" mode people with a known address sit at their home.
  function paintPins(byState, layersByName) {
    pinLayer.clearLayers();
    if (!selected) return;
    const list = byState.get(selected) || [];
    const pos = labelPos(selected, layersByName.get(selected));
    const grid = [];
    list.forEach((p) => {
      if (mode === 'lives' && p.lat != null && p.lng != null) {
        L.marker([p.lat, p.lng], { icon: avatarIcon(p, 0, 0) }).on('click', () => FT.openPerson(p.id)).addTo(pinLayer);
      } else grid.push(p);
    });
    if (!pos) return;
    const cols = Math.min(5, grid.length);
    grid.forEach((p, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const dx = (col - (cols - 1) / 2) * 40;
      const dy = 36 + row * 40;
      L.marker(pos, { icon: avatarIcon(p, dx, dy) }).on('click', () => FT.openPerson(p.id)).addTo(pinLayer);
    });
  }

  function paintPanel(byState) {
    const missing = FT.state.people.filter((p) => !field(p)).length;
    const outside = FT.state.people.filter((p) => field(p) === FT.OUTSIDE_MALAYSIA);
    let html = '';
    if (!selected) {
      const rows = [...byState.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
      const max = Math.max(1, ...rows.map((r) => r[1].length));
      html += `<h2 class="panel-title">${esc(mode === 'born' ? t('map.bornTitle') : t('map.livesTitle'))}</h2>`;
      if (!rows.length && !outside.length) html += `<p class="muted">${esc(t('map.noneYet'))}</p>`;
      html += `<div class="state-rows">${rows.map(([name, list]) => `
        <button type="button" class="state-row" data-state="${esc(name)}">
          <span class="state-name">${esc(name)}</span>
          <span class="state-bar"><span style="width:${Math.round((list.length / max) * 100)}%"></span></span>
          <span class="state-n">${list.length}</span>
          <span class="state-faces">${list.slice(0, 3).map((p) => FT.avatar(p, 'xs')).join('')}</span>
        </button>`).join('')}
        ${outside.length ? `<button type="button" class="state-row" data-state="${esc(FT.OUTSIDE_MALAYSIA)}"><span class="state-name">${esc(t('form.outsideMalaysia'))}</span><span class="state-bar"><span style="width:${Math.round((outside.length / max) * 100)}%"></span></span><span class="state-n">${outside.length}</span><span class="state-faces"></span></button>` : ''}
      </div>`;
      if (missing) html += `<p class="muted small">${FT.icon('info')} ${esc(t('map.missing', { n: missing }))}</p>`;
    } else {
      const list = selected === FT.OUTSIDE_MALAYSIA ? outside : (byState.get(selected) || []);
      html += `<button type="button" class="link-btn" data-all>${FT.icon('back')} ${esc(t('map.allStates'))}</button>
        <h2 class="panel-title">${esc(t('map.stateCount', { state: FT.stateLabel(selected), n: list.length }))}</h2>`;
      html += list.length
        ? `<div class="plist">${list.sort((a, b) => FT.fullName(a).localeCompare(FT.fullName(b))).map((p) => FT.personRow(p)).join('')}</div>`
        : `<p class="muted">${esc(t('map.nobodyHere'))}</p>`;
      if (mode === 'lives' && !FT.state.user) html += `<button type="button" class="notice" data-login>${FT.icon('shield')}<span>${esc(t('map.loginForPins'))}</span>${FT.icon('chevronRight')}</button>`;
    }
    el.panel.innerHTML = html;
    FT.bindPeople(el.panel);
    el.panel.querySelectorAll('[data-state]').forEach((b) => b.addEventListener('click', () => {
      const name = b.getAttribute('data-state');
      if (name === FT.OUTSIDE_MALAYSIA) { selected = name; paint(); } else select(name);
    }));
    const all = el.panel.querySelector('[data-all]');
    if (all) all.addEventListener('click', () => select(selected));
    const login = el.panel.querySelector('[data-login]');
    if (login) login.addEventListener('click', () => FT.openLogin());
  }
})();
