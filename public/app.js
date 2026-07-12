(function () {
  'use strict';

  const NODE_W = 170, NODE_H = 64, H_GAP = 40, V_GAP = 130;
  const SPACING = NODE_W + H_GAP;
  const TEXT_X = 66;
  const TEXT_RIGHT_PAD = 10;
  const NAME_MAX_WIDTH = NODE_W - TEXT_X - TEXT_RIGHT_PAD;

  // Fallback centre point (state capital) used to place a person's pin on the
  // family map when their address couldn't be geocoded, or has none yet.
  const MALAYSIA_STATES = [
    { name: 'Johor', lat: 1.4927, lng: 103.7414 },
    { name: 'Kedah', lat: 6.1184, lng: 100.3685 },
    { name: 'Kelantan', lat: 6.1254, lng: 102.2381 },
    { name: 'Melaka', lat: 2.1896, lng: 102.2501 },
    { name: 'Negeri Sembilan', lat: 2.7297, lng: 101.9381 },
    { name: 'Pahang', lat: 3.8168, lng: 103.3317 },
    { name: 'Perak', lat: 4.5975, lng: 101.0901 },
    { name: 'Perlis', lat: 6.4414, lng: 100.1986 },
    { name: 'Pulau Pinang', lat: 5.4141, lng: 100.3288 },
    { name: 'Sabah', lat: 5.9804, lng: 116.0735 },
    { name: 'Sarawak', lat: 1.5535, lng: 110.3593 },
    { name: 'Selangor', lat: 3.0733, lng: 101.5185 },
    { name: 'Terengganu', lat: 5.3117, lng: 103.1324 },
    { name: 'W.P. Kuala Lumpur', lat: 3.1390, lng: 101.6869 },
    { name: 'W.P. Labuan', lat: 5.2831, lng: 115.2308 },
    { name: 'W.P. Putrajaya', lat: 2.9264, lng: 101.6964 },
  ];
  const MALAYSIA_STATES_BY_NAME = new Map(MALAYSIA_STATES.map((s) => [s.name, s]));

  let measureCanvasCtx = null;
  function measureTextWidth(text, font) {
    if (!measureCanvasCtx) measureCanvasCtx = document.createElement('canvas').getContext('2d');
    measureCanvasCtx.font = font;
    return measureCanvasCtx.measureText(text).width;
  }

  function truncateToWidth(text, maxWidth, font) {
    if (measureTextWidth(text, font) <= maxWidth) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = text.slice(0, mid).trimEnd() + '…';
      if (measureTextWidth(candidate, font) <= maxWidth) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo).trimEnd() + '…';
  }

  const state = {
    people: [],
    spousePairs: [],
    peopleById: new Map(),
    nodesById: new Map(),
  };

  const formState = { editingId: null, existingPhotoPath: null, pendingSpouseOf: null, pendingParentOf: null, pendingPhotoBlob: null };

  // ---- DOM refs ----
  const svg = d3.select('#treeSvg');
  const viewport = svg.append('g').attr('class', 'viewport');
  const linksLayer = viewport.append('g').attr('class', 'links-layer');
  const nodesLayer = viewport.append('g').attr('class', 'nodes-layer');
  const emptyState = document.getElementById('emptyState');
  const branchFilterSelect = document.getElementById('branchFilterSelect');
  const branchFilterClearBtn = document.getElementById('branchFilterClearBtn');

  const detailPanel = document.getElementById('detailPanel');
  const detailContent = document.getElementById('detailContent');

  const personModal = document.getElementById('personModal');
  const personForm = document.getElementById('personForm');
  const personModalTitle = document.getElementById('personModalTitle');
  const fatherSelect = document.getElementById('fatherId');
  const motherSelect = document.getElementById('motherId');
  const spouseSection = document.getElementById('spouseSection');
  const spouseList = document.getElementById('spouseList');
  const addSpouseSelect = document.getElementById('addSpouseSelect');
  const deletePersonBtn = document.getElementById('deletePersonBtn');
  const genderSelect = document.getElementById('gender');
  const binBintiSelect = document.getElementById('binBinti');
  const fatherNameInput = document.getElementById('fatherNameText');
  const fatherMatchHint = document.getElementById('fatherMatchHint');
  const nicknameInput = document.getElementById('nickname');
  const stateSelect = document.getElementById('stateSelect');
  const addressInput = document.getElementById('address');
  const phoneInput = document.getElementById('phone');
  MALAYSIA_STATES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    stateSelect.appendChild(opt);
  });

  const linkPersonModal = document.getElementById('linkPersonModal');
  const linkPersonTitle = document.getElementById('linkPersonTitle');
  const linkPersonDesc = document.getElementById('linkPersonDesc');
  const linkPersonSelect = document.getElementById('linkPersonSelect');
  const linkPersonError = document.getElementById('linkPersonError');
  const linkPersonSubmitBtn = document.getElementById('linkPersonSubmitBtn');
  const linkPersonCreateNewBtn = document.getElementById('linkPersonCreateNewBtn');
  const linkPersonCancelBtn = document.getElementById('linkPersonCancelBtn');

  const authArea = document.getElementById('authArea');
  const googleSignInBtnContainer = document.getElementById('googleSignInBtn');
  const googleNotConfiguredNote = document.getElementById('googleNotConfiguredNote');
  const userInfoEl = document.getElementById('userInfo');
  const userAvatarImg = document.getElementById('userAvatar');
  const userNameSpan = document.getElementById('userName');
  const userLogoutBtn = document.getElementById('userLogoutBtn');
  const manageUsersBtn = document.getElementById('manageUsersBtn');
  const userAdminModal = document.getElementById('userAdminModal');
  const userAdminList = document.getElementById('userAdminList');
  const userAdminCloseBtn = document.getElementById('userAdminCloseBtn');
  const tourModal = document.getElementById('tourModal');
  const tourStepContent = document.getElementById('tourStepContent');
  const tourNextBtn = document.getElementById('tourNextBtn');
  const tourSkipBtn = document.getElementById('tourSkipBtn');
  const addPersonBtn = document.getElementById('addPersonBtn');
  const addFirstPersonBtn = document.getElementById('addFirstPersonBtn');

  const photoFileInput = document.getElementById('photoFile');
  const photoPreview = document.getElementById('photoPreview');
  const cropModal = document.getElementById('cropModal');
  const cropImage = document.getElementById('cropImage');
  const cropCancelBtn = document.getElementById('cropCancelBtn');
  const cropConfirmBtn = document.getElementById('cropConfirmBtn');

  const zoomBehavior = d3.zoom().scaleExtent([0.2, 2.5]).on('zoom', (event) => {
    viewport.attr('transform', event.transform);
  });
  svg.call(zoomBehavior);

  // ---- overlay stack (so the Android/mobile back button closes panels/modals instead of the page) ----

  const openOverlays = new Set();
  const overlayCloseHandlers = {};
  let suppressPopstate = false;

  function openOverlay(name) {
    if (openOverlays.has(name)) return;
    openOverlays.add(name);
    history.pushState({ fteOverlay: name }, '');
  }

  function hideOverlayDom(name) {
    if (name === 'detailPanel') { detailPanel.classList.add('hidden'); currentDetailId = null; }
    else if (name === 'personModal') { personModal.classList.add('hidden'); }
    else if (name === 'cropModal') { cropModal.classList.add('hidden'); }
    else if (name === 'linkPersonModal') { linkPersonModal.classList.add('hidden'); }
    else if (name === 'userAdminModal') { userAdminModal.classList.add('hidden'); }
    else if (name === 'tourModal') { tourModal.classList.add('hidden'); }
  }

  function closeOverlay(name, fromPopstate) {
    if (!openOverlays.has(name)) return;
    openOverlays.delete(name);
    hideOverlayDom(name);
    const handler = overlayCloseHandlers[name];
    if (handler) {
      delete overlayCloseHandlers[name];
      handler();
    }
    if (!fromPopstate) {
      suppressPopstate = true;
      history.back();
    }
  }

  window.addEventListener('popstate', () => {
    if (suppressPopstate) { suppressPopstate = false; return; }
    const openList = [...openOverlays];
    const last = openList[openList.length - 1];
    if (last) closeOverlay(last, true);
  });

  function closeDetailPanel() { closeOverlay('detailPanel', false); }
  function closePersonModal() { closeOverlay('personModal', false); }

  // ---- Google login (per-person accounts; gates add/edit/delete, not viewing) ----

  let currentUser = null;
  let googleConfigured = false;

  function updateAuthUI() {
    const loggedIn = !!currentUser;
    userInfoEl.classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
      googleSignInBtnContainer.classList.add('hidden');
      googleNotConfiguredNote.classList.add('hidden');
    } else if (googleConfigured) {
      googleSignInBtnContainer.classList.remove('hidden');
    }
    manageUsersBtn.classList.toggle('hidden', !(loggedIn && currentUser.isAdmin));
    addPersonBtn.classList.toggle('hidden', !loggedIn);
    addFirstPersonBtn.classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
      userNameSpan.textContent = currentUser.name || currentUser.email;
      if (currentUser.picture) {
        userAvatarImg.src = currentUser.picture;
        userAvatarImg.classList.remove('hidden');
      } else {
        userAvatarImg.classList.add('hidden');
      }
    }
    if (currentDetailId) showDetail(currentDetailId);
  }

  async function refreshCurrentUser() {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;
    updateAuthUI();
    return currentUser;
  }

  async function handleGoogleCredential(response) {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Log masuk gagal.'); return; }
      currentUser = data.user;
      updateAuthUI();
      maybeShowTour();
    } catch {
      alert('Log masuk gagal. Sila cuba lagi.');
    }
  }
  window.__familyTreeGoogleCallback = handleGoogleCredential;

  function renderGoogleButton() {
    if (!window.google || !window.google.accounts) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    googleSignInBtnContainer.innerHTML = '';
    window.google.accounts.id.renderButton(googleSignInBtnContainer, {
      theme: isDark ? 'filled_black' : 'outline',
      size: 'medium',
    });
  }

  async function initGoogleSignIn() {
    const res = await fetch('/api/config');
    const { googleClientId } = await res.json();
    if (!googleClientId) {
      googleNotConfiguredNote.classList.remove('hidden');
      return;
    }
    const waitForGoogle = () => new Promise((resolve) => {
      if (window.google && window.google.accounts) return resolve();
      const interval = setInterval(() => {
        if (window.google && window.google.accounts) { clearInterval(interval); resolve(); }
      }, 100);
    });
    await waitForGoogle();
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
    renderGoogleButton();
    googleConfigured = true;
    if (!currentUser) googleSignInBtnContainer.classList.remove('hidden');
  }

  userLogoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateAuthUI();
  });

  function requireLoginPrompt() {
    alert('Sila log masuk dengan Google (di bahagian atas laman) untuk membuat perubahan.');
  }

  // ---- first-time user tour ----

  const tourSteps = [
    { title: 'Selamat datang!', body: 'Ini salasilah keluarga kami. Anda boleh cari, lihat, dan bantu kemas kini pokok keluarga ini.' },
    { title: 'Meneroka pokok keluarga', body: 'Seret untuk gerakkan pandangan, gulung atau cubit untuk zum. Klik mana-mana kad untuk lihat butiran seseorang.' },
    { title: 'Mencari seseorang', body: 'Gunakan kotak carian di bahagian atas untuk terus pergi kepada seseorang.' },
    { title: 'Menambah ahli keluarga', body: 'Guna "+ Tambah Orang" untuk ahli baru, atau butang "+ Tambah pasangan"/"+ Tambah anak" pada panel butiran seseorang — sistem akan cadangkan orang sedia ada dahulu supaya rekod tidak bertindih.' },
  ];
  let tourIndex = 0;

  function renderTourStep() {
    const step = tourSteps[tourIndex];
    const isLast = tourIndex === tourSteps.length - 1;
    tourStepContent.innerHTML = `<div class="tour-step"><p class="tour-progress">Langkah ${tourIndex + 1} / ${tourSteps.length}</p><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.body)}</p></div>`;
    tourNextBtn.textContent = isLast ? 'Selesai' : 'Seterusnya';
    tourSkipBtn.classList.toggle('hidden', isLast);
  }

  async function finishTour() {
    closeOverlay('tourModal', false);
    try { await fetch('/api/auth/seen-tour', { method: 'POST' }); } catch { /* best-effort */ }
    if (currentUser) currentUser.hasSeenTour = true;
  }

  function openTour() {
    tourIndex = 0;
    renderTourStep();
    tourModal.classList.remove('hidden');
    openOverlay('tourModal');
    overlayCloseHandlers.tourModal = () => { finishTour(); };
  }

  function maybeShowTour() {
    if (currentUser && !currentUser.hasSeenTour) openTour();
  }

  tourNextBtn.addEventListener('click', () => {
    if (tourIndex === tourSteps.length - 1) {
      finishTour();
    } else {
      tourIndex += 1;
      renderTourStep();
    }
  });
  tourSkipBtn.addEventListener('click', finishTour);

  // ---- admin: manage users (ban/unban by Google account) ----

  async function loadUserAdminList() {
    const res = await fetch('/api/admin/users');
    if (!res.ok) { alert('Hanya admin boleh mengurus pengguna.'); return; }
    const data = await res.json();
    userAdminList.innerHTML = data.users.map((u) => `
      <li>
        ${u.picture ? `<img src="${escapeHtml(u.picture)}" alt="" />` : ''}
        <div class="user-admin-info">
          <div class="user-admin-name">${escapeHtml(u.name || u.email)}</div>
          <div class="user-admin-email">${escapeHtml(u.email)}</div>
          ${u.status === 'banned' ? '<div class="user-admin-status">Disekat</div>' : ''}
        </div>
        <button type="button" class="btn btn-secondary" data-user-toggle="${u.id}" data-user-status="${u.status}">${u.status === 'banned' ? 'Nyahsekat' : 'Sekat'}</button>
      </li>
    `).join('') || '<p class="muted-text">Tiada pengguna log masuk lagi.</p>';
    userAdminList.querySelectorAll('[data-user-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-user-toggle');
        const action = btn.getAttribute('data-user-status') === 'banned' ? 'unban' : 'ban';
        await fetch(`/api/admin/users/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
        await loadUserAdminList();
      });
    });
  }

  manageUsersBtn.addEventListener('click', async () => {
    await loadUserAdminList();
    userAdminModal.classList.remove('hidden');
    openOverlay('userAdminModal');
  });
  userAdminCloseBtn.addEventListener('click', () => closeOverlay('userAdminModal', false));

  // ---- API helpers (viewing is public; adding/editing requires a Google login) ----

  async function apiWrite(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && res.status !== 204) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Permintaan gagal (${res.status})`);
    }
    return res.status === 204 ? null : res.json();
  }

  async function uploadPhoto(fileOrBlob, filename) {
    const fd = new FormData();
    fd.append('photo', fileOrBlob, filename || fileOrBlob.name || 'photo.jpg');
    const res = await fetch('/api/photos', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Muat naik gambar gagal');
    const data = await res.json();
    return data.photoPath;
  }

  // ---- photo crop/resize ----

  let cropperInstance = null;
  let cropObjectUrl = null;

  function destroyCropper() {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    if (cropObjectUrl) { URL.revokeObjectURL(cropObjectUrl); cropObjectUrl = null; }
    cropImage.removeAttribute('src');
  }

  photoFileInput.addEventListener('change', () => {
    const file = photoFileInput.files[0];
    if (!file) return;
    cropObjectUrl = URL.createObjectURL(file);
    cropImage.src = cropObjectUrl;
    cropModal.classList.remove('hidden');
    openOverlay('cropModal');
    overlayCloseHandlers.cropModal = () => destroyCropper();
    cropperInstance = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      background: false,
      autoCropArea: 1,
      cropBoxResizable: false,
      cropBoxMovable: false,
      guides: false,
      center: false,
      highlight: false,
    });
  });

  cropCancelBtn.addEventListener('click', () => {
    photoFileInput.value = '';
    closeOverlay('cropModal', false);
  });

  cropConfirmBtn.addEventListener('click', () => {
    if (!cropperInstance) return;
    cropperInstance.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: 'high' }).toBlob((blob) => {
      formState.pendingPhotoBlob = blob;
      const previewUrl = URL.createObjectURL(blob);
      photoPreview.src = previewUrl;
      photoPreview.classList.remove('hidden');
      photoFileInput.value = '';
      closeOverlay('cropModal', false);
    }, 'image/jpeg', 0.9);
  });

  // ---- data loading ----

  async function loadData() {
    const res = await fetch('/api/people');
    const data = await res.json();
    state.people = data.people;
    state.spousePairs = data.spousePairs;
    state.peopleById = new Map(state.people.map((p) => [p.id, p]));
    populateBranchFilterSelect();
    render();
    refreshFamilyMapIfActive();
  }

  // ---- layout computation ----

  // People are grouped into "units" — a single person, or a married couple
  // placed side by side — and each unit's horizontal footprint is computed
  // bottom-up from its full subtree before any x-coordinates are assigned.
  // This guarantees a family's own children always render directly beneath
  // them: an in-law marrying into one family can only ever widen that
  // family's own footprint, never push a *different* family's row out from
  // under its own parents (which is what used to make connecting lines cut
  // across unrelated cards — e.g. an unrelated couple's kids visually
  // appearing to be another family's children just because of row packing).
  function buildLayoutUnits(people) {
    const byId = state.peopleById;

    // When rendering a filtered branch (see collectFamilyBranch), `people` is
    // only a subset of state.people. Parent/spouse relationships that point
    // outside this subset must be ignored — otherwise a person just outside
    // the chosen branch would still get pulled in as a rendered node.
    const presentIds = new Set(people.map((p) => p.id));
    const hasParentInSet = (p) => (p.fatherId && presentIds.has(p.fatherId)) || (p.motherId && presentIds.has(p.motherId));

    // How many spouses each person actually has recorded. A normal marriage
    // (both sides have exactly one spouse) renders side by side. Someone
    // with multiple marriages (e.g. remarried) instead becomes a standalone
    // "hub" on its own row, with every spouse rendered one row below them —
    // like an extra generation — and that marriage's children below that
    // spouse. This keeps the common ancestor visually on top instead of
    // squeezed sideways next to whichever marriage happened to be recorded first.
    const spouseIdsOf = new Map();
    state.spousePairs.forEach(({ personId, spouseId }) => {
      if (!presentIds.has(personId) || !presentIds.has(spouseId)) return;
      if (!spouseIdsOf.has(personId)) spouseIdsOf.set(personId, []);
      if (!spouseIdsOf.has(spouseId)) spouseIdsOf.set(spouseId, []);
      spouseIdsOf.get(personId).push(spouseId);
      spouseIdsOf.get(spouseId).push(personId);
    });
    const degreeOf = (id) => (spouseIdsOf.get(id) || []).length;

    // Each person gets at most one "primary" spouse for side-by-side
    // placement — only when *both* sides have exactly one marriage.
    const primaryPartner = new Map();
    const claimed = new Set();
    state.spousePairs.forEach(({ personId, spouseId }) => {
      if (!presentIds.has(personId) || !presentIds.has(spouseId)) return;
      if (degreeOf(personId) !== 1 || degreeOf(spouseId) !== 1) return;
      if (claimed.has(personId) || claimed.has(spouseId)) return;
      primaryPartner.set(personId, spouseId);
      primaryPartner.set(spouseId, personId);
      claimed.add(personId);
      claimed.add(spouseId);
    });

    // Remaining (non side-by-side) marriages are "stacked": the person with
    // more marriages is the hub that stays on top (tie broken by smaller id),
    // every other spouse renders as a row below the hub.
    const stackedChildrenOf = new Map(); // hub personId -> [spouseId, ...]
    const stackedAsChild = new Set(); // spouse ids rendered under a hub
    state.spousePairs.forEach(({ personId, spouseId }) => {
      if (!presentIds.has(personId) || !presentIds.has(spouseId)) return;
      if (primaryPartner.get(personId) === spouseId) return; // already side-by-side
      const dP = degreeOf(personId), dS = degreeOf(spouseId);
      let hub = personId, sub = spouseId;
      if (dS > dP || (dS === dP && spouseId < personId)) { hub = spouseId; sub = personId; }
      if (!stackedChildrenOf.has(hub)) stackedChildrenOf.set(hub, []);
      stackedChildrenOf.get(hub).push(sub);
      stackedAsChild.add(sub);
    });

    // Sibling groups keyed by exact father+mother pair, each anchored to one
    // parent (father preferred) — so a parent who remarried only "owns" the
    // children from that specific marriage, instead of every unit they
    // belong to competing to claim them. Only parents present in this subset
    // count — a filtered-out parent is treated the same as "unknown".
    const childrenByParentKey = new Map();
    people.forEach((p) => {
      if (!hasParentInSet(p)) return;
      const fid = p.fatherId && presentIds.has(p.fatherId) ? p.fatherId : null;
      const mid = p.motherId && presentIds.has(p.motherId) ? p.motherId : null;
      const key = `${fid || '_'}-${mid || '_'}`;
      if (!childrenByParentKey.has(key)) childrenByParentKey.set(key, []);
      childrenByParentKey.get(key).push(p);
    });
    const keysByAnchor = new Map();
    childrenByParentKey.forEach((kids, key) => {
      const [fid, mid] = key.split('-').map((s) => (s === '_' ? null : Number(s)));
      const anchorId = fid != null ? fid : mid;
      if (!keysByAnchor.has(anchorId)) keysByAnchor.set(anchorId, []);
      keysByAnchor.get(anchorId).push(kids);
    });

    const unitCache = new Map();
    function unitFor(personId) {
      if (unitCache.has(personId)) return unitCache.get(personId);
      const partnerId = primaryPartner.get(personId);
      const members = partnerId != null ? [personId, partnerId].sort((a, b) => a - b) : [personId];
      const unit = { members, children: [], width: 1 };
      unitCache.set(personId, unit);
      if (partnerId != null) unitCache.set(partnerId, unit);
      return unit;
    }

    // A unit is attached under exactly one parent unit — whichever is
    // discovered first in this deterministic top-down walk — so a couple
    // whose *both* sides have recorded parents doesn't get placed twice.
    const attachedUnits = new Set();
    function attach(unit) {
      const childGroups = [];
      unit.members.forEach((id) => (keysByAnchor.get(id) || []).forEach((kids) => childGroups.push(...kids)));
      const seen = new Set();
      const childUnits = [];
      childGroups
        .slice()
        .sort((a, b) => a.id - b.id)
        .forEach((child) => {
          if (seen.has(child.id)) return;
          const cu = unitFor(child.id);
          cu.members.forEach((m) => seen.add(m));
          if (attachedUnits.has(cu)) return;
          attachedUnits.add(cu);
          childUnits.push(cu);
        });
      unit.members.forEach((id) => {
        (stackedChildrenOf.get(id) || [])
          .slice()
          .sort((a, b) => a - b)
          .forEach((subId) => {
            const su = unitFor(subId);
            if (attachedUnits.has(su)) return;
            attachedUnits.add(su);
            su.isStackedSpouse = true;
            childUnits.push(su);
          });
      });
      childUnits.forEach(attach);
      unit.children = childUnits;
    }

    const roots = [];
    people
      .filter((p) => !hasParentInSet(p))
      .sort((a, b) => a.id - b.id)
      .forEach((p) => {
        if (stackedAsChild.has(p.id)) return; // rendered under their hub spouse instead
        const unit = unitFor(p.id);
        const allMembersParentless = unit.members.every((id) => {
          const person = byId.get(id);
          return person && !hasParentInSet(person);
        });
        if (!allMembersParentless || attachedUnits.has(unit)) return;
        attachedUnits.add(unit);
        roots.push(unit);
      });
    roots.forEach(attach);

    // Safety net: anyone unreachable from a root (broken/circular parent
    // reference) still renders as its own root instead of silently vanishing.
    people.forEach((p) => {
      if (unitCache.has(p.id)) return;
      roots.push(unitFor(p.id));
    });

    function computeWidth(unit) {
      unit.children.forEach(computeWidth);
      const childrenWidth = unit.children.reduce((sum, c) => sum + c.width, 0);
      unit.width = Math.max(unit.members.length, childrenWidth, 1);
    }
    roots.forEach(computeWidth);

    return { roots, stackedChildrenOf };
  }

  function computeLayout(peopleOverride) {
    const people = peopleOverride || state.people;
    const peopleById = state.peopleById;
    const { roots, stackedChildrenOf } = buildLayoutUnits(people);
    const nodes = [];

    function place(unit, leftX, depth) {
      const span = unit.width * SPACING;
      const membersWidth = unit.members.length * SPACING;
      const membersLeft = leftX + (span - membersWidth) / 2;
      unit.members.forEach((id, i) => {
        const person = peopleById.get(id);
        if (!person) return;
        nodes.push({ id, x: membersLeft + i * SPACING, y: depth * V_GAP, person, generation: depth });
      });

      let childCursor = leftX;
      unit.children.forEach((child) => {
        place(child, childCursor, depth + 1);
        childCursor += child.width * SPACING;
      });
    }

    let cursor = 0;
    const ROOT_GAP_COLUMNS = 1; // extra empty column between unrelated root families
    roots.forEach((unit) => {
      place(unit, cursor, 0);
      cursor += unit.width * SPACING + SPACING * ROOT_GAP_COLUMNS;
    });

    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    // spouse links: a primary couple sits in adjacent columns and gets a
    // simple straight connector; a remarriage (a spouse who isn't the
    // person's adjacent partner in the layout) can sit anywhere else in the
    // same row, so its connector arcs up and over the top of any cards in
    // between instead of drawing a straight line through them.
    const spouseLinks = [];
    state.spousePairs.forEach(({ personId, spouseId }) => {
      const a = nodesById.get(personId), b = nodesById.get(spouseId);
      if (!a || !b || a.y !== b.y) return;
      const left = a.x <= b.x ? a : b;
      const right = a.x <= b.x ? b : a;
      const gap = right.x - (left.x + NODE_W);
      const midY = left.y + NODE_H / 2;
      if (gap <= H_GAP + 1) {
        spouseLinks.push({ path: `M ${left.x + NODE_W} ${midY} H ${right.x}`, arced: false });
      } else {
        const archY = left.y - 18;
        const leftTopX = left.x + NODE_W / 2;
        const rightTopX = right.x + NODE_W / 2;
        spouseLinks.push({
          path: `M ${leftTopX} ${left.y} V ${archY} H ${rightTopX} V ${right.y}`,
          arced: true,
        });
      }
    });

    // parent-child links, grouped by parent pair
    const groups = new Map();
    people.forEach((p) => {
      if (!p.fatherId && !p.motherId) return;
      const key = `${p.fatherId || '_'}-${p.motherId || '_'}`;
      if (!groups.has(key)) groups.set(key, { fatherId: p.fatherId, motherId: p.motherId, children: [] });
      groups.get(key).children.push(p);
    });

    const parentLinks = [];
    groups.forEach(({ fatherId, motherId, children }) => {
      const parentNodesAll = [fatherId, motherId].filter(Boolean).map((id) => nodesById.get(id)).filter(Boolean);
      const childNodes = children.map((c) => nodesById.get(c.id)).filter(Boolean);
      if (!parentNodesAll.length || !childNodes.length) return;
      // If one parent is a stacked hub sitting a row above the other (e.g.
      // Fatima above Hashim), only the parent on the row actually adjacent
      // to the children anchors the bus line — the hub is already linked
      // down to that parent by its own stack connector.
      const deepestY = Math.max(...parentNodesAll.map((n) => n.y));
      const parentNodes = parentNodesAll.filter((n) => n.y === deepestY);
      const parentMidX = parentNodes.reduce((s, n) => s + n.x + NODE_W / 2, 0) / parentNodes.length;
      const parentBottomY = deepestY + NODE_H;
      const childTopY = Math.min(...childNodes.map((n) => n.y));
      const busY = parentBottomY + (childTopY - parentBottomY) / 2;
      const childXs = childNodes.map((n) => n.x + NODE_W / 2);
      const busMinX = Math.min(parentMidX, ...childXs);
      const busMaxX = Math.max(parentMidX, ...childXs);

      let path = `M ${parentMidX} ${parentBottomY} V ${busY}`;
      path += ` M ${busMinX} ${busY} H ${busMaxX}`;
      childNodes.forEach((n) => {
        const cx = n.x + NODE_W / 2;
        path += ` M ${cx} ${busY} V ${n.y}`;
      });
      parentLinks.push({ path });
    });

    // Vertical marriage connectors for stacked spouses (hub on top, each
    // spouse rendered as a row below them).
    stackedChildrenOf.forEach((subIds, hubId) => {
      const hubNode = nodesById.get(hubId);
      if (!hubNode) return;
      subIds.forEach((subId) => {
        const subNode = nodesById.get(subId);
        if (!subNode) return;
        const hubCx = hubNode.x + NODE_W / 2;
        const subCx = subNode.x + NODE_W / 2;
        const midY = hubNode.y + NODE_H + (subNode.y - (hubNode.y + NODE_H)) / 2;
        spouseLinks.push({
          path: `M ${hubCx} ${hubNode.y + NODE_H} V ${midY} H ${subCx} V ${subNode.y}`,
          arced: false,
        });
      });
    });

    state.nodesById = nodesById;
    return { nodes, spouseLinks, parentLinks };
  }

  // ---- rendering ----

  function initials(p) {
    const a = (p.firstName || '').trim()[0] || '';
    const b = (p.lastName || '').trim()[0] || '';
    return (a + b).toUpperCase();
  }

  function years(p) {
    const b = p.birthDate ? String(p.birthDate).slice(0, 4) : '?';
    if (p.deathDate) return `${b} – ${String(p.deathDate).slice(0, 4)}`;
    if (p.birthDate) return `l. ${b}`;
    return '';
  }

  let highlightedId = null;
  let currentDetailId = null;
  let focusPersonId = null;

  // ---- family branch filter (show only one person's own section of the tree) ----

  // A person's "branch" is themself, their spouse(s), and every descendant
  // (plus those descendants' spouses) reached by following fatherId/motherId
  // down from there. This lets someone pick e.g. their father/grandfather and
  // see just that slice instead of the whole (wide, hard-to-scan-on-mobile) tree.
  function collectFamilyBranch(rootId) {
    const included = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      state.spousePairs.forEach(({ personId, spouseId }) => {
        if (included.has(personId) && !included.has(spouseId)) { included.add(spouseId); changed = true; }
        if (included.has(spouseId) && !included.has(personId)) { included.add(personId); changed = true; }
      });
      state.people.forEach((p) => {
        if (included.has(p.id)) return;
        if ((p.fatherId && included.has(p.fatherId)) || (p.motherId && included.has(p.motherId))) {
          included.add(p.id);
          changed = true;
        }
      });
    }
    return included;
  }

  function getVisiblePeople() {
    if (!focusPersonId || !state.peopleById.has(focusPersonId)) return state.people;
    const included = collectFamilyBranch(focusPersonId);
    return state.people.filter((p) => included.has(p.id));
  }

  function populateBranchFilterSelect() {
    const current = branchFilterSelect.value;
    branchFilterSelect.innerHTML = '<option value="">Semua pokok keluarga</option>';
    state.people
      .slice()
      .sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName))
      .forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.firstName} ${p.lastName}`;
        branchFilterSelect.appendChild(opt);
      });
    branchFilterSelect.value = focusPersonId && state.peopleById.has(focusPersonId) ? String(focusPersonId) : (current || '');
    if (branchFilterSelect.value !== String(focusPersonId || '')) {
      // the previously-selected person no longer exists (e.g. deleted) — reset
      focusPersonId = null;
      branchFilterSelect.value = '';
    }
    branchFilterClearBtn.classList.toggle('hidden', !focusPersonId);
  }

  function setFocusPerson(id) {
    focusPersonId = id || null;
    branchFilterSelect.value = focusPersonId ? String(focusPersonId) : '';
    branchFilterClearBtn.classList.toggle('hidden', !focusPersonId);
    render();
    fitView();
  }

  branchFilterSelect.addEventListener('change', () => {
    setFocusPerson(branchFilterSelect.value ? Number(branchFilterSelect.value) : null);
  });
  branchFilterClearBtn.addEventListener('click', () => setFocusPerson(null));

  function render() {
    emptyState.classList.toggle('hidden', state.people.length > 0);
    if (!state.people.length) {
      linksLayer.selectAll('*').remove();
      nodesLayer.selectAll('*').remove();
      return;
    }

    const { nodes, spouseLinks, parentLinks } = computeLayout(getVisiblePeople());

    linksLayer.selectAll('path.link-line')
      .data(parentLinks)
      .join('path')
      .attr('class', 'link-line')
      .attr('d', (d) => d.path);

    linksLayer.selectAll('path.spouse-line')
      .data(spouseLinks)
      .join('path')
      .attr('class', (d) => `spouse-line${d.arced ? ' spouse-line-arced' : ''}`)
      .attr('d', (d) => d.path);

    const nodeSel = nodesLayer.selectAll('g.node-card')
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'node-card');
        g.append('rect').attr('width', NODE_W).attr('height', NODE_H);
        g.append('circle').attr('class', 'avatar-ring').attr('cx', 32).attr('cy', 32).attr('r', 22);
        g.append('clipPath').attr('id', (d) => `clip-${d.id}`)
          .append('circle').attr('cx', 32).attr('cy', 32).attr('r', 20);
        g.append('image').attr('class', 'avatar-img').attr('x', 12).attr('y', 12)
          .attr('width', 40).attr('height', 40).attr('clip-path', (d) => `url(#clip-${d.id})`);
        g.append('text').attr('class', 'avatar-initials').attr('x', 32).attr('y', 33);
        g.append('text').attr('class', 'name-text').attr('x', TEXT_X).attr('y', 27);
        g.append('text').attr('class', 'years-text').attr('x', TEXT_X).attr('y', 44);
        g.append('title');
        g.on('click', (event, d) => showDetail(d.id));
        return g;
      });

    nodeSel
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('class', (d) => `node-card gender-${d.person.gender || 'unknown'}${d.id === highlightedId ? ' highlighted' : ''}`);

    nodeSel.select('image.avatar-img')
      .attr('href', (d) => d.person.photoPath || null)
      .style('display', (d) => (d.person.photoPath ? null : 'none'));
    nodeSel.select('text.avatar-initials')
      .text((d) => (d.person.photoPath ? '' : initials(d.person)));
    nodeSel.select('text.name-text')
      .text((d) => {
        const full = `${d.person.firstName} ${d.person.lastName}`.trim();
        const display = d.person.nickname || full;
        return truncateToWidth(display, NAME_MAX_WIDTH, '600 13px "Segoe UI", system-ui, sans-serif');
      });
    nodeSel.select('text.years-text')
      .text((d) => truncateToWidth(years(d.person), NAME_MAX_WIDTH, '11px "Segoe UI", system-ui, sans-serif'));
    nodeSel.select('title')
      .text((d) => {
        const full = `${d.person.firstName} ${d.person.lastName}`.trim();
        return d.person.nickname ? `${full} (${d.person.nickname})` : full;
      });
  }

  function contentBounds() {
    const nodes = [...state.nodesById.values()];
    if (!nodes.length) return null;
    return {
      minX: Math.min(...nodes.map((n) => n.x)),
      maxX: Math.max(...nodes.map((n) => n.x)) + NODE_W,
      minY: Math.min(...nodes.map((n) => n.y)),
      maxY: Math.max(...nodes.map((n) => n.y)) + NODE_H,
    };
  }

  function fitView() {
    const b = contentBounds();
    if (!b) return;
    const rect = document.getElementById('treeContainer').getBoundingClientRect();
    const contentW = b.maxX - b.minX + 80;
    const contentH = b.maxY - b.minY + 80;
    const scale = Math.min(rect.width / contentW, rect.height / contentH, 1);
    const tx = rect.width / 2 - scale * (b.minX + (b.maxX - b.minX) / 2);
    const ty = rect.height / 2 - scale * (b.minY + (b.maxY - b.minY) / 2);
    svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function focusOnPerson(id) {
    const node = state.nodesById.get(id);
    if (!node) return;
    const rect = document.getElementById('treeContainer').getBoundingClientRect();
    const currentTransform = d3.zoomTransform(svg.node());
    const scale = Math.max(currentTransform.k, 0.8);
    const tx = rect.width / 2 - scale * (node.x + NODE_W / 2);
    const ty = rect.height / 2 - scale * (node.y + NODE_H / 2);
    svg.transition().duration(450).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    highlightedId = id;
    render();
    setTimeout(() => { highlightedId = null; render(); }, 2200);
  }

  // ---- detail panel ----

  // ---- link to an existing person (add spouse / add child without duplicating records) ----

  function openLinkPersonModal(type, personId) {
    const p = state.peopleById.get(personId);
    linkPersonError.classList.add('hidden');
    linkPersonSelect.innerHTML = '<option value="">— Pilih orang —</option>';

    let eligible;
    if (type === 'spouse') {
      linkPersonTitle.textContent = 'Tambah Pasangan';
      linkPersonDesc.textContent = `Pilih pasangan sedia ada untuk ${p.firstName}, atau cipta orang baru jika belum wujud.`;
      const spouseIds = state.spousePairs
        .filter((s) => s.personId === personId || s.spouseId === personId)
        .map((s) => (s.personId === personId ? s.spouseId : s.personId));
      eligible = state.people.filter((person) => person.id !== personId && !spouseIds.includes(person.id));
    } else {
      linkPersonTitle.textContent = 'Tambah Anak';
      linkPersonDesc.textContent = `Pilih anak sedia ada untuk dikaitkan dengan ${p.firstName}, atau cipta orang baru jika belum wujud.`;
      const ancestors = new Set();
      (function collectAncestors(id) {
        const person = state.peopleById.get(id);
        if (!person) return;
        [person.fatherId, person.motherId].forEach((pid) => {
          if (pid && !ancestors.has(pid)) { ancestors.add(pid); collectAncestors(pid); }
        });
      })(personId);
      eligible = state.people.filter((person) => (
        person.id !== personId && !ancestors.has(person.id)
        && person.fatherId !== personId && person.motherId !== personId
      ));
    }

    eligible
      .sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName))
      .forEach((person) => {
        const opt = document.createElement('option');
        opt.value = person.id;
        opt.textContent = `${person.firstName} ${person.lastName}`;
        linkPersonSelect.appendChild(opt);
      });

    linkPersonModal.classList.remove('hidden');
    openOverlay('linkPersonModal');

    function cleanup() {
      linkPersonSubmitBtn.removeEventListener('click', onSubmit);
      linkPersonCreateNewBtn.removeEventListener('click', onCreateNew);
      linkPersonCancelBtn.removeEventListener('click', onCancel);
    }

    async function onSubmit() {
      const sid = Number(linkPersonSelect.value);
      if (!sid) { linkPersonError.classList.remove('hidden'); return; }
      delete overlayCloseHandlers.linkPersonModal;
      cleanup();
      closeOverlay('linkPersonModal', false);
      try {
        if (type === 'spouse') {
          await apiWrite('/api/spouses', 'POST', { personId, spouseId: sid });
        } else {
          const child = state.peopleById.get(sid);
          const role = p.gender === 'female' ? 'motherId' : 'fatherId';
          const childPayload = {
            firstName: child.firstName, lastName: child.lastName, nickname: child.nickname, gender: child.gender,
            birthDate: child.birthDate, deathDate: child.deathDate, bio: child.bio, photoPath: child.photoPath,
            fatherId: child.fatherId, motherId: child.motherId,
            state: child.state, address: child.address, phone: child.phone,
          };
          childPayload[role] = personId;
          await apiWrite(`/api/people/${sid}`, 'PUT', childPayload);
        }
        await loadData();
        if (currentDetailId) showDetail(currentDetailId);
      } catch (err) {
        alert(err.message || 'Ralat berlaku.');
      }
    }

    function onCreateNew() {
      delete overlayCloseHandlers.linkPersonModal;
      cleanup();
      closeOverlay('linkPersonModal', false);
      if (type === 'spouse') {
        openPersonModal({ mode: 'create', pendingSpouseOf: personId });
      } else {
        const preset = {};
        if (p.gender === 'male') preset.fatherId = personId;
        else if (p.gender === 'female') preset.motherId = personId;
        else preset.fatherId = personId;
        openPersonModal({ mode: 'create', preset });
      }
    }

    function onCancel() {
      closeOverlay('linkPersonModal', false);
    }

    overlayCloseHandlers.linkPersonModal = () => { cleanup(); };

    linkPersonSubmitBtn.addEventListener('click', onSubmit);
    linkPersonCreateNewBtn.addEventListener('click', onCreateNew);
    linkPersonCancelBtn.addEventListener('click', onCancel);
  }

  function showDetail(id) {
    const p = state.peopleById.get(id);
    if (!p) return;
    currentDetailId = id;
    highlightedId = id;
    render();

    const father = p.fatherId ? state.peopleById.get(p.fatherId) : null;
    const mother = p.motherId ? state.peopleById.get(p.motherId) : null;
    const spouseIds = state.spousePairs
      .filter((s) => s.personId === id || s.spouseId === id)
      .map((s) => (s.personId === id ? s.spouseId : s.personId));
    const children = state.people.filter((c) => c.fatherId === id || c.motherId === id);

    const relLink = (person) => `<span class="detail-link" data-goto="${person.id}">${escapeHtml(person.firstName + ' ' + person.lastName)}</span>`;
    const canEdit = !!currentUser;

    let html = '';
    html += p.photoPath
      ? `<img class="detail-photo" src="${escapeHtml(p.photoPath)}" alt="" />`
      : `<div class="detail-photo detail-photo-placeholder">${initials(p)}</div>`;
    const nameWithNickname = p.nickname ? `${p.firstName} ${p.lastName} (${p.nickname})` : `${p.firstName} ${p.lastName}`;
    html += `<h2 class="detail-name">${escapeHtml(nameWithNickname)}</h2>`;
    html += `<p class="detail-years">${escapeHtml(years(p))}</p>`;
    html += focusPersonId === id
      ? `<button type="button" class="btn btn-secondary" data-clear-branch style="margin-bottom:8px;">✕ Papar pokok penuh semula</button>`
      : `<button type="button" class="btn btn-secondary" data-focus-branch style="margin-bottom:8px;">🔎 Papar cabang keluarga ini sahaja</button>`;
    if (p.bio) html += `<p>${escapeHtml(p.bio)}</p>`;

    if (p.state) html += `<div class="detail-section"><h4>Negeri</h4>${escapeHtml(p.state)}</div>`;
    if (canEdit) {
      html += `<div class="detail-section"><h4>Alamat</h4>${p.address ? escapeHtml(p.address) : '<span class="muted-text">Tiada</span>'}</div>`;
      html += `<div class="detail-section"><h4>No. telefon</h4>${p.phone ? escapeHtml(p.phone) : '<span class="muted-text">Tiada</span>'}</div>`;
    }

    html += `<div class="detail-section"><h4>Bapa</h4>${father ? relLink(father) : '<span class="muted-text">Tidak diketahui</span>'}${!father && canEdit ? ' <button type="button" class="btn btn-secondary" data-add-parent="father" style="margin-top:4px;">+ Tambah bapa</button>' : ''}</div>`;
    html += `<div class="detail-section"><h4>Ibu</h4>${mother ? relLink(mother) : '<span class="muted-text">Tidak diketahui</span>'}${!mother && canEdit ? ' <button type="button" class="btn btn-secondary" data-add-parent="mother" style="margin-top:4px;">+ Tambah ibu</button>' : ''}</div>`;

    html += `<div class="detail-section"><h4>Pasangan</h4>`;
    html += spouseIds.length
      ? spouseIds.map((sid) => state.peopleById.get(sid)).filter(Boolean).map(relLink).join('')
      : '<span class="muted-text">Tiada</span>';
    if (canEdit) html += `<div><button type="button" class="btn btn-secondary" data-add-spouse style="margin-top:6px;">+ Tambah pasangan</button></div>`;
    html += `</div>`;

    html += `<div class="detail-section"><h4>Anak-anak</h4>`;
    html += children.length ? children.map(relLink).join('') : '<span class="muted-text">Tiada</span>';
    if (canEdit) html += `<div><button type="button" class="btn btn-secondary" data-add-child style="margin-top:6px;">+ Tambah anak</button></div>`;
    html += `</div>`;

    if (canEdit) {
      html += `<div class="detail-actions">
        <button type="button" class="btn btn-primary" data-edit>Sunting</button>
        <button type="button" class="btn btn-danger" data-delete>Padam</button>
      </div>`;
    } else {
      html += `<p class="muted-text" style="margin-top:16px;">Log masuk dengan Google untuk menyunting.</p>`;
    }

    detailContent.innerHTML = html;
    detailPanel.classList.remove('hidden');
    openOverlay('detailPanel');

    detailContent.querySelectorAll('[data-goto]').forEach((el) => {
      el.addEventListener('click', () => {
        const targetId = Number(el.getAttribute('data-goto'));
        showDetail(targetId);
        focusOnPerson(targetId);
      });
    });
    detailContent.querySelector('[data-focus-branch]')?.addEventListener('click', () => {
      if (currentView !== 'tree') switchView('tree');
      setFocusPerson(id);
      showDetail(id);
    });
    detailContent.querySelector('[data-clear-branch]')?.addEventListener('click', () => {
      setFocusPerson(null);
      showDetail(id);
    });
    detailContent.querySelector('[data-edit]')?.addEventListener('click', () => openPersonModal({ mode: 'edit', personId: id }));
    detailContent.querySelector('[data-delete]')?.addEventListener('click', () => deletePerson(id));
    detailContent.querySelector('[data-add-child]')?.addEventListener('click', () => {
      openLinkPersonModal('child', id);
    });
    detailContent.querySelector('[data-add-spouse]')?.addEventListener('click', () => {
      openLinkPersonModal('spouse', id);
    });
    detailContent.querySelectorAll('[data-add-parent]').forEach((el) => {
      el.addEventListener('click', () => {
        const role = el.getAttribute('data-add-parent');
        openPersonModal({
          mode: 'create',
          preset: { gender: role === 'father' ? 'male' : 'female' },
          pendingParentOf: { childId: id, role },
        });
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  async function deletePerson(id) {
    const p = state.peopleById.get(id);
    if (!confirm(`Padam ${p.firstName} ${p.lastName}? Tindakan ini tidak boleh dibuat asal.`)) return;
    await apiWrite(`/api/people/${id}`, 'DELETE');
    if (currentDetailId === id) closeDetailPanel();
    await loadData();
    fitView();
  }

  // ---- person add/edit modal ----

  function populateParentSelects(excludeId) {
    const options = state.people
      .filter((p) => p.id !== excludeId)
      .sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName));
    [fatherSelect, motherSelect].forEach((sel) => {
      const current = sel.value;
      sel.innerHTML = '<option value="">— Tiada —</option>';
      options.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.firstName} ${p.lastName}`;
        sel.appendChild(opt);
      });
      sel.value = current;
    });
  }

  function renderSpouseSection(personId) {
    const pairs = state.spousePairs.filter((s) => s.personId === personId || s.spouseId === personId);
    const spouseIds = pairs.map((s) => (s.personId === personId ? s.spouseId : s.personId));
    spouseList.innerHTML = '';
    spouseIds.forEach((sid) => {
      const sp = state.peopleById.get(sid);
      if (!sp) return;
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(sp.firstName + ' ' + sp.lastName)}</span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Buang';
      btn.addEventListener('click', async () => {
        await apiWrite('/api/spouses', 'DELETE', { personId, spouseId: sid });
        state.spousePairs = state.spousePairs.filter((s) => !((s.personId === personId && s.spouseId === sid) || (s.personId === sid && s.spouseId === personId)));
        renderSpouseSection(personId);
        render();
      });
      li.appendChild(btn);
      spouseList.appendChild(li);
    });

    addSpouseSelect.innerHTML = '<option value="">— Pilih orang —</option>';
    state.people
      .filter((p) => p.id !== personId && !spouseIds.includes(p.id))
      .sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName))
      .forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.firstName} ${p.lastName}`;
        addSpouseSelect.appendChild(opt);
      });
  }

  // ---- bin/binti naming (name bin/binti father's name) ----

  function parseBinBinti(lastName, gender) {
    const trimmed = (lastName || '').trim();
    const match = trimmed.match(/^(bin|binti)\s+(.*)$/i);
    if (match) {
      const label = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
      return { binBinti: label, fatherName: match[2].trim() };
    }
    return { binBinti: gender === 'female' ? 'Binti' : 'Bin', fatherName: trimmed };
  }

  function buildLastName() {
    const fatherName = fatherNameInput.value.trim();
    return fatherName ? `${binBintiSelect.value} ${fatherName}` : '';
  }

  function hideFatherMatchHint() {
    fatherMatchHint.classList.add('hidden');
    fatherMatchHint.innerHTML = '';
  }

  function showFatherMatchHint(html) {
    fatherMatchHint.innerHTML = html;
    fatherMatchHint.classList.remove('hidden');
  }

  function selectFatherCandidate(person) {
    fatherSelect.value = person.id;
    showFatherMatchHint(`✓ Dipadankan secara automatik dengan <strong>${escapeHtml(person.firstName + ' ' + person.lastName)}</strong>. Tukar di bahagian "Bapa" di bawah jika tidak tepat.`);
  }

  function checkFatherNameMatch() {
    const query = fatherNameInput.value.trim().toLowerCase();
    if (!query) { hideFatherMatchHint(); return; }
    const candidates = state.people.filter((p) => (
      p.id !== formState.editingId &&
      p.gender !== 'female' &&
      p.firstName.trim().toLowerCase() === query
    ));
    if (candidates.length === 1) {
      selectFatherCandidate(candidates[0]);
    } else if (candidates.length > 1) {
      const buttons = candidates
        .map((p) => `<button type="button" data-candidate-id="${p.id}">${escapeHtml(p.firstName + ' ' + p.lastName)}</button>`)
        .join('');
      showFatherMatchHint(`Beberapa padanan ditemui untuk "${escapeHtml(fatherNameInput.value.trim())}" — pilih yang betul:<div class="match-candidates">${buttons}</div>`);
      fatherMatchHint.querySelectorAll('[data-candidate-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const person = state.peopleById.get(Number(btn.getAttribute('data-candidate-id')));
          if (person) selectFatherCandidate(person);
        });
      });
    } else {
      hideFatherMatchHint();
    }
  }

  fatherNameInput.addEventListener('blur', checkFatherNameMatch);
  genderSelect.addEventListener('change', () => {
    binBintiSelect.value = genderSelect.value === 'female' ? 'Binti' : 'Bin';
  });

  function openPersonModal({ mode, personId, preset, pendingSpouseOf, pendingParentOf }) {
    personForm.reset();
    formState.editingId = mode === 'edit' ? personId : null;
    formState.existingPhotoPath = null;
    formState.pendingSpouseOf = pendingSpouseOf || null;
    formState.pendingParentOf = pendingParentOf || null;
    formState.pendingPhotoBlob = null;
    photoPreview.classList.add('hidden');
    photoPreview.removeAttribute('src');
    hideFatherMatchHint();
    binBintiSelect.value = 'Bin';
    fatherNameInput.value = '';

    populateParentSelects(mode === 'edit' ? personId : null);

    if (mode === 'edit') {
      const p = state.peopleById.get(personId);
      personModalTitle.textContent = 'Sunting Orang';
      document.getElementById('firstName').value = p.firstName || '';
      document.getElementById('gender').value = p.gender || 'unknown';
      const { binBinti, fatherName } = parseBinBinti(p.lastName, p.gender);
      binBintiSelect.value = binBinti;
      fatherNameInput.value = fatherName;
      document.getElementById('birthDate').value = p.birthDate || '';
      document.getElementById('deathDate').value = p.deathDate || '';
      document.getElementById('bio').value = p.bio || '';
      fatherSelect.value = p.fatherId || '';
      motherSelect.value = p.motherId || '';
      nicknameInput.value = p.nickname || '';
      stateSelect.value = p.state || '';
      addressInput.value = p.address || '';
      phoneInput.value = p.phone || '';
      formState.existingPhotoPath = p.photoPath || null;
      if (p.photoPath) {
        photoPreview.src = p.photoPath;
        photoPreview.classList.remove('hidden');
      }
      deletePersonBtn.classList.remove('hidden');
      spouseSection.classList.remove('hidden');
      renderSpouseSection(personId);
      if (!p.fatherId && fatherName) checkFatherNameMatch();
    } else {
      personModalTitle.textContent = 'Tambah Orang';
      deletePersonBtn.classList.add('hidden');
      spouseSection.classList.add('hidden');
      if (preset) {
        if (preset.fatherId) fatherSelect.value = preset.fatherId;
        if (preset.motherId) motherSelect.value = preset.motherId;
        if (preset.gender) {
          document.getElementById('gender').value = preset.gender;
          binBintiSelect.value = preset.gender === 'female' ? 'Binti' : 'Bin';
        }
      }
    }

    personModal.classList.remove('hidden');
    openOverlay('personModal');
  }

  addPersonBtn.addEventListener('click', () => {
    if (!currentUser) return requireLoginPrompt();
    openPersonModal({ mode: 'create' });
  });
  addFirstPersonBtn.addEventListener('click', () => {
    if (!currentUser) return requireLoginPrompt();
    openPersonModal({ mode: 'create' });
  });
  document.getElementById('personModalCloseBtn').addEventListener('click', closePersonModal);
  document.getElementById('cancelPersonBtn').addEventListener('click', closePersonModal);
  document.getElementById('detailCloseBtn').addEventListener('click', closeDetailPanel);
  document.getElementById('deletePersonBtn').addEventListener('click', () => {
    if (formState.editingId) { closePersonModal(); deletePerson(formState.editingId); }
  });
  document.getElementById('addSpouseBtn').addEventListener('click', async () => {
    const sid = Number(addSpouseSelect.value);
    if (!sid || !formState.editingId) return;
    await apiWrite('/api/spouses', 'POST', { personId: formState.editingId, spouseId: sid });
    await loadData();
    renderSpouseSection(formState.editingId);
  });

  personForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let photoPath = formState.existingPhotoPath;
    try {
      if (formState.pendingPhotoBlob) {
        photoPath = await uploadPhoto(formState.pendingPhotoBlob, 'avatar.jpg');
      }
      const payload = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: buildLastName(),
        nickname: nicknameInput.value.trim() || null,
        gender: document.getElementById('gender').value,
        birthDate: document.getElementById('birthDate').value.trim() || null,
        deathDate: document.getElementById('deathDate').value.trim() || null,
        bio: document.getElementById('bio').value.trim() || null,
        photoPath,
        fatherId: fatherSelect.value ? Number(fatherSelect.value) : null,
        motherId: motherSelect.value ? Number(motherSelect.value) : null,
        state: stateSelect.value || null,
        address: addressInput.value.trim() || null,
        phone: phoneInput.value.trim() || null,
      };

      let saved;
      if (formState.editingId) {
        saved = await apiWrite(`/api/people/${formState.editingId}`, 'PUT', payload);
      } else {
        saved = await apiWrite('/api/people', 'POST', payload);
      }

      if (formState.pendingSpouseOf) {
        await apiWrite('/api/spouses', 'POST', { personId: formState.pendingSpouseOf, spouseId: saved.id });
      }
      if (formState.pendingParentOf) {
        const child = state.peopleById.get(formState.pendingParentOf.childId);
        const childPayload = {
          firstName: child.firstName, lastName: child.lastName, nickname: child.nickname, gender: child.gender,
          birthDate: child.birthDate, deathDate: child.deathDate, bio: child.bio, photoPath: child.photoPath,
          fatherId: child.fatherId, motherId: child.motherId,
          state: child.state, address: child.address, phone: child.phone,
        };
        childPayload[formState.pendingParentOf.role === 'father' ? 'fatherId' : 'motherId'] = saved.id;
        await apiWrite(`/api/people/${child.id}`, 'PUT', childPayload);
      }

      closePersonModal();
      await loadData();
      if (currentDetailId) showDetail(currentDetailId);
    } catch (err) {
      alert(err.message || 'Ralat berlaku.');
    }
  });

  // ---- search ----

  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.classList.add('hidden'); searchResults.innerHTML = ''; return; }
    const matches = state.people
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
    if (!matches.length) { searchResults.classList.add('hidden'); searchResults.innerHTML = ''; return; }
    searchResults.innerHTML = matches
      .map((p) => `<div class="search-result-item" data-id="${p.id}">${escapeHtml(p.firstName + ' ' + p.lastName)} <span style="color:#999">${escapeHtml(years(p))}</span></div>`)
      .join('');
    searchResults.classList.remove('hidden');
    searchResults.querySelectorAll('.search-result-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = Number(el.getAttribute('data-id'));
        searchResults.classList.add('hidden');
        searchInput.value = '';
        showDetail(id);
        focusOnPerson(id);
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) searchResults.classList.add('hidden');
  });

  document.getElementById('zoomFitBtn').addEventListener('click', fitView);

  // ---- theme (dark / light) ----

  const themeToggleBtn = document.getElementById('themeToggleBtn');

  function updateThemeToggleIcon(theme) {
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('familyTreeTheme', theme);
    updateThemeToggleIcon(theme);
    renderGoogleButton();
  }

  updateThemeToggleIcon(document.documentElement.getAttribute('data-theme') || 'light');

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // ---- family map (state filter + Leaflet pins) ----

  const viewTreeBtn = document.getElementById('viewTreeBtn');
  const viewMapBtn = document.getElementById('viewMapBtn');
  const treeContainerEl = document.getElementById('treeContainer');
  const mapContainerEl = document.getElementById('mapContainer');
  const mapStateFilterEl = document.getElementById('mapStateFilter');

  let leafletMap = null;
  let markersLayer = null;
  let activeStateFilter = null;
  let currentView = 'tree';

  function personBaseLatLng(p) {
    if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng };
    const fallback = p.state && MALAYSIA_STATES_BY_NAME.get(p.state);
    if (!fallback) return null;
    return { lat: fallback.lat, lng: fallback.lng };
  }

  // People who land on (nearly) the same point - same address, or same state
  // fallback - get nudged apart in a small ring so pins don't stack exactly on
  // top of each other. This runs on the final set of points every render, so
  // it applies regardless of whether the point came from real geocoding or a
  // state fallback.
  function spreadOverlappingPoints(entries) {
    const GRID_DEG = 0.0015; // ~165m grouping bucket
    const groups = new Map();
    entries.forEach((e) => {
      const key = `${Math.round(e.lat / GRID_DEG)}_${Math.round(e.lng / GRID_DEG)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });
    groups.forEach((group) => {
      if (group.length <= 1) return;
      const centerLat = group.reduce((sum, e) => sum + e.lat, 0) / group.length;
      const metersToDegLat = 1 / 111320;
      const metersToDegLng = 1 / (111320 * Math.cos((centerLat * Math.PI) / 180));
      const radiusMeters = 60 + group.length * 15; // roughly a 100m-ish spread
      group.forEach((e, i) => {
        const angle = (2 * Math.PI * i) / group.length;
        e.lat += Math.sin(angle) * radiusMeters * metersToDegLat;
        e.lng += Math.cos(angle) * radiusMeters * metersToDegLng;
      });
    });
    return entries;
  }

  function personMarkerIcon(p) {
    const inner = p.photoPath
      ? `<img src="${escapeHtml(p.photoPath)}" alt="" />`
      : `<div class="map-avatar-fallback">${escapeHtml(initials(p))}</div>`;
    return L.divIcon({
      className: `map-avatar-marker gender-${p.gender || 'unknown'}`,
      html: `<div class="map-avatar-inner">${inner}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }

  function ensureLeafletMap() {
    if (leafletMap) return;
    leafletMap = L.map('familyMap').setView([4.2105, 108.9758], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(leafletMap);
    markersLayer = L.layerGroup().addTo(leafletMap);
  }

  function renderStateFilterChips() {
    const counts = new Map();
    state.people.forEach((p) => {
      if (!p.state) return;
      counts.set(p.state, (counts.get(p.state) || 0) + 1);
    });
    const totalWithState = [...counts.values()].reduce((a, b) => a + b, 0);
    let html = `<button type="button" class="state-chip${activeStateFilter ? '' : ' active'}" data-state="">Semua<span class="count">${totalWithState}</span></button>`;
    html += MALAYSIA_STATES
      .filter((s) => counts.get(s.name))
      .map((s) => `<button type="button" class="state-chip${activeStateFilter === s.name ? ' active' : ''}" data-state="${escapeHtml(s.name)}">${escapeHtml(s.name)}<span class="count">${counts.get(s.name)}</span></button>`)
      .join('');
    mapStateFilterEl.innerHTML = html;
    mapStateFilterEl.querySelectorAll('[data-state]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeStateFilter = btn.getAttribute('data-state') || null;
        renderFamilyMap();
      });
    });
  }

  function renderFamilyMap() {
    ensureLeafletMap();
    renderStateFilterChips();
    markersLayer.clearLayers();

    const people = state.people.filter((p) => !activeStateFilter || p.state === activeStateFilter);
    const entries = people
      .map((p) => ({ p, ...personBaseLatLng(p) }))
      .filter((e) => e.lat != null && e.lng != null);
    spreadOverlappingPoints(entries);

    entries.forEach(({ p, lat, lng }) => {
      const marker = L.marker([lat, lng], { icon: personMarkerIcon(p) });
      marker.on('click', () => {
        leafletMap.flyTo([lat, lng], Math.max(leafletMap.getZoom(), 14), { duration: 0.6 });
        showDetail(p.id);
      });
      markersLayer.addLayer(marker);
    });

    const points = entries.map((e) => [e.lat, e.lng]);
    if (activeStateFilter) {
      const fallback = MALAYSIA_STATES_BY_NAME.get(activeStateFilter);
      if (points.length) leafletMap.fitBounds(points, { padding: [40, 40], maxZoom: 11 });
      else if (fallback) leafletMap.setView([fallback.lat, fallback.lng], 10);
    } else if (points.length) {
      leafletMap.fitBounds(points, { padding: [40, 40], maxZoom: 8 });
    } else {
      leafletMap.setView([4.2105, 108.9758], 6);
    }
  }

  function refreshFamilyMapIfActive() {
    if (currentView === 'map') renderFamilyMap();
  }

  function switchView(view) {
    currentView = view;
    viewTreeBtn.classList.toggle('active', view === 'tree');
    viewMapBtn.classList.toggle('active', view === 'map');
    treeContainerEl.classList.toggle('hidden', view !== 'tree');
    mapContainerEl.classList.toggle('hidden', view !== 'map');
    if (view === 'map') {
      renderFamilyMap();
      setTimeout(() => leafletMap && leafletMap.invalidateSize(), 50);
    }
  }

  viewTreeBtn.addEventListener('click', () => switchView('tree'));
  viewMapBtn.addEventListener('click', () => switchView('map'));

  // ---- init ----
  loadData().then(fitView);
  initGoogleSignIn();
  refreshCurrentUser().then(maybeShowTour);
})();
