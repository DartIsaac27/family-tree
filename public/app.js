(function () {
  'use strict';

  const NODE_W = 140, NODE_H = 64, H_GAP = 40, V_GAP = 130;
  const SPACING = NODE_W + H_GAP;

  const state = {
    people: [],
    spousePairs: [],
    peopleById: new Map(),
    nodesById: new Map(),
  };

  const formState = { editingId: null, existingPhotoPath: null, pendingSpouseOf: null, pendingParentOf: null };

  // ---- DOM refs ----
  const svg = d3.select('#treeSvg');
  const viewport = svg.append('g').attr('class', 'viewport');
  const linksLayer = viewport.append('g').attr('class', 'links-layer');
  const nodesLayer = viewport.append('g').attr('class', 'nodes-layer');
  const emptyState = document.getElementById('emptyState');

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

  const passcodeModal = document.getElementById('passcodeModal');
  const passcodeInput = document.getElementById('passcodeInput');
  const passcodeError = document.getElementById('passcodeError');
  const passcodeSubmitBtn = document.getElementById('passcodeSubmitBtn');
  const passcodeCancelBtn = document.getElementById('passcodeCancelBtn');

  const zoomBehavior = d3.zoom().scaleExtent([0.2, 2.5]).on('zoom', (event) => {
    viewport.attr('transform', event.transform);
  });
  svg.call(zoomBehavior);

  // ---- passcode-protected API helpers ----

  function getPasscode() { return localStorage.getItem('familyTreeEditPasscode') || ''; }
  function setPasscode(pc) { localStorage.setItem('familyTreeEditPasscode', pc); }

  function promptForPasscode() {
    return new Promise((resolve, reject) => {
      passcodeModal.classList.remove('hidden');
      passcodeError.classList.add('hidden');
      passcodeInput.value = '';
      passcodeInput.focus();

      function cleanup() {
        passcodeModal.classList.add('hidden');
        passcodeSubmitBtn.removeEventListener('click', submit);
        passcodeCancelBtn.removeEventListener('click', cancel);
        passcodeInput.removeEventListener('keydown', onKeydown);
      }
      async function submit() {
        const code = passcodeInput.value.trim();
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: code }),
        });
        const data = await res.json();
        if (data.ok) {
          setPasscode(code);
          cleanup();
          resolve();
        } else {
          passcodeError.classList.remove('hidden');
        }
      }
      function cancel() { cleanup(); reject(new Error('cancelled')); }
      function onKeydown(e) { if (e.key === 'Enter') submit(); }

      passcodeSubmitBtn.addEventListener('click', submit);
      passcodeCancelBtn.addEventListener('click', cancel);
      passcodeInput.addEventListener('keydown', onKeydown);
    });
  }

  async function apiWrite(url, method, body) {
    const doFetch = () => fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-edit-passcode': getPasscode() },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let res = await doFetch();
    if (res.status === 401) {
      await promptForPasscode();
      res = await doFetch();
    }
    if (!res.ok && res.status !== 204) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }
    return res.status === 204 ? null : res.json();
  }

  async function uploadPhoto(file) {
    const doFetch = () => {
      const fd = new FormData();
      fd.append('photo', file);
      return fetch('/api/photos', { method: 'POST', headers: { 'x-edit-passcode': getPasscode() }, body: fd });
    };
    let res = await doFetch();
    if (res.status === 401) {
      await promptForPasscode();
      res = await doFetch();
    }
    if (!res.ok) throw new Error('Photo upload failed');
    const data = await res.json();
    return data.photoPath;
  }

  // ---- data loading ----

  async function loadData() {
    const res = await fetch('/api/people');
    const data = await res.json();
    state.people = data.people;
    state.spousePairs = data.spousePairs;
    state.peopleById = new Map(state.people.map((p) => [p.id, p]));
    render();
  }

  // ---- layout computation ----

  function computeGenerations(people) {
    const byId = state.peopleById;
    const gen = new Map();
    function computeGen(id, stack) {
      if (gen.has(id)) return gen.get(id);
      if (stack.has(id)) { gen.set(id, 0); return 0; }
      stack.add(id);
      const p = byId.get(id);
      const parentGens = [];
      if (p.fatherId && byId.has(p.fatherId)) parentGens.push(computeGen(p.fatherId, stack));
      if (p.motherId && byId.has(p.motherId)) parentGens.push(computeGen(p.motherId, stack));
      const g = parentGens.length ? Math.max(...parentGens) + 1 : 0;
      stack.delete(id);
      gen.set(id, g);
      return g;
    }
    people.forEach((p) => computeGen(p.id, new Set()));

    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      state.spousePairs.forEach(({ personId, spouseId }) => {
        if (!gen.has(personId) || !gen.has(spouseId)) return;
        const a = gen.get(personId), b = gen.get(spouseId);
        if (a !== b) {
          const m = Math.max(a, b);
          gen.set(personId, m);
          gen.set(spouseId, m);
          changed = true;
        }
      });
      if (!changed) break;
    }
    return gen;
  }

  function groupSpousesAdjacent(list, spousePairs) {
    const idToSpouseIds = new Map();
    spousePairs.forEach(({ personId, spouseId }) => {
      if (!idToSpouseIds.has(personId)) idToSpouseIds.set(personId, []);
      if (!idToSpouseIds.has(spouseId)) idToSpouseIds.set(spouseId, []);
      idToSpouseIds.get(personId).push(spouseId);
      idToSpouseIds.get(spouseId).push(personId);
    });
    const arr = list.slice();
    const idxOf = (id) => arr.findIndex((p) => p.id === id);
    const placed = new Set();
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (placed.has(p.id)) continue;
      placed.add(p.id);
      const spouseIds = (idToSpouseIds.get(p.id) || []).filter((sid) => arr.some((x) => x.id === sid));
      for (const sid of spouseIds) {
        if (placed.has(sid)) continue;
        const curIdx = idxOf(sid);
        if (curIdx !== i + 1) {
          const [item] = arr.splice(curIdx, 1);
          arr.splice(i + 1, 0, item);
        }
        placed.add(sid);
        break;
      }
    }
    return arr;
  }

  function computeLayout() {
    const people = state.people;
    const gen = computeGenerations(people);
    const generationsMap = new Map();
    people.forEach((p) => {
      const g = gen.get(p.id);
      if (!generationsMap.has(g)) generationsMap.set(g, []);
      generationsMap.get(g).push(p);
    });
    const sortedGenKeys = [...generationsMap.keys()].sort((a, b) => a - b);

    const xPos = new Map();
    const nodes = [];

    sortedGenKeys.forEach((g, genIdx) => {
      let list = generationsMap.get(g);
      if (genIdx === 0) {
        list = list.slice().sort((a, b) => a.id - b.id);
      } else {
        const keyFor = (p) => {
          const parentXs = [];
          if (p.fatherId && xPos.has(p.fatherId)) parentXs.push(xPos.get(p.fatherId));
          if (p.motherId && xPos.has(p.motherId)) parentXs.push(xPos.get(p.motherId));
          if (parentXs.length) return parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
          return Infinity;
        };
        list = list.map((p) => ({ p, key: keyFor(p) }))
          .sort((a, b) => a.key - b.key || a.p.id - b.p.id)
          .map((o) => o.p);
      }
      list = groupSpousesAdjacent(list, state.spousePairs);
      list.forEach((p, i) => {
        const x = i * SPACING;
        xPos.set(p.id, x);
        nodes.push({ id: p.id, x, y: genIdx * V_GAP, person: p, generation: g });
      });
    });

    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    // spouse links
    const spouseLinks = [];
    state.spousePairs.forEach(({ personId, spouseId }) => {
      const a = nodesById.get(personId), b = nodesById.get(spouseId);
      if (a && b && a.y === b.y) {
        spouseLinks.push({ x1: a.x + NODE_W, y1: a.y + NODE_H / 2, x2: b.x, y2: b.y + NODE_H / 2 });
        if (a.x > b.x) { spouseLinks[spouseLinks.length - 1] = { x1: b.x + NODE_W, y1: b.y + NODE_H / 2, x2: a.x, y2: a.y + NODE_H / 2 }; }
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
      const parentNodes = [fatherId, motherId].filter(Boolean).map((id) => nodesById.get(id)).filter(Boolean);
      const childNodes = children.map((c) => nodesById.get(c.id)).filter(Boolean);
      if (!parentNodes.length || !childNodes.length) return;
      const parentMidX = parentNodes.reduce((s, n) => s + n.x + NODE_W / 2, 0) / parentNodes.length;
      const parentBottomY = Math.min(...parentNodes.map((n) => n.y)) + NODE_H;
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

  function render() {
    emptyState.classList.toggle('hidden', state.people.length > 0);
    if (!state.people.length) {
      linksLayer.selectAll('*').remove();
      nodesLayer.selectAll('*').remove();
      return;
    }

    const { nodes, spouseLinks, parentLinks } = computeLayout();

    linksLayer.selectAll('path.link-line')
      .data(parentLinks)
      .join('path')
      .attr('class', 'link-line')
      .attr('d', (d) => d.path);

    linksLayer.selectAll('line.spouse-line')
      .data(spouseLinks)
      .join('line')
      .attr('class', 'spouse-line')
      .attr('x1', (d) => d.x1).attr('y1', (d) => d.y1)
      .attr('x2', (d) => d.x2).attr('y2', (d) => d.y2);

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
        g.append('text').attr('class', 'name-text').attr('x', 66).attr('y', 27);
        g.append('text').attr('class', 'years-text').attr('x', 66).attr('y', 44);
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
      .text((d) => `${d.person.firstName} ${d.person.lastName}`.trim());
    nodeSel.select('text.years-text')
      .text((d) => years(d.person));
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

    let html = '';
    html += p.photoPath
      ? `<img class="detail-photo" src="${escapeHtml(p.photoPath)}" alt="" />`
      : `<div class="detail-photo" style="display:flex;align-items:center;justify-content:center;background:#eee;font-size:28px;color:#999;">${initials(p)}</div>`;
    html += `<h2 class="detail-name">${escapeHtml(p.firstName + ' ' + p.lastName)}</h2>`;
    html += `<p class="detail-years">${escapeHtml(years(p))}</p>`;
    if (p.bio) html += `<p>${escapeHtml(p.bio)}</p>`;

    html += `<div class="detail-section"><h4>Bapa</h4>${father ? relLink(father) : '<span style="color:#aaa">Tidak diketahui</span> <button type="button" class="btn btn-secondary" data-add-parent="father" style="margin-top:4px;">+ Tambah bapa</button>'}</div>`;
    html += `<div class="detail-section"><h4>Ibu</h4>${mother ? relLink(mother) : '<span style="color:#aaa">Tidak diketahui</span> <button type="button" class="btn btn-secondary" data-add-parent="mother" style="margin-top:4px;">+ Tambah ibu</button>'}</div>`;

    html += `<div class="detail-section"><h4>Pasangan</h4>`;
    html += spouseIds.length
      ? spouseIds.map((sid) => state.peopleById.get(sid)).filter(Boolean).map(relLink).join('')
      : '<span style="color:#aaa">Tiada</span>';
    html += `<div><button type="button" class="btn btn-secondary" data-add-spouse style="margin-top:6px;">+ Tambah pasangan</button></div></div>`;

    html += `<div class="detail-section"><h4>Anak-anak</h4>`;
    html += children.length ? children.map(relLink).join('') : '<span style="color:#aaa">Tiada</span>';
    html += `<div><button type="button" class="btn btn-secondary" data-add-child style="margin-top:6px;">+ Tambah anak</button></div></div>`;

    html += `<div class="detail-actions">
      <button type="button" class="btn btn-primary" data-edit>Sunting</button>
      <button type="button" class="btn btn-danger" data-delete>Padam</button>
    </div>`;

    detailContent.innerHTML = html;
    detailPanel.classList.remove('hidden');

    detailContent.querySelectorAll('[data-goto]').forEach((el) => {
      el.addEventListener('click', () => {
        const targetId = Number(el.getAttribute('data-goto'));
        showDetail(targetId);
        focusOnPerson(targetId);
      });
    });
    detailContent.querySelector('[data-edit]').addEventListener('click', () => openPersonModal({ mode: 'edit', personId: id }));
    detailContent.querySelector('[data-delete]').addEventListener('click', () => deletePerson(id));
    detailContent.querySelector('[data-add-child]').addEventListener('click', () => {
      const preset = {};
      if (p.gender === 'male') preset.fatherId = id;
      else if (p.gender === 'female') preset.motherId = id;
      else preset.fatherId = id;
      openPersonModal({ mode: 'create', preset });
    });
    detailContent.querySelector('[data-add-spouse]').addEventListener('click', () => {
      openPersonModal({ mode: 'create', pendingSpouseOf: id });
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
    detailPanel.classList.add('hidden');
    if (currentDetailId === id) currentDetailId = null;
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

  function openPersonModal({ mode, personId, preset, pendingSpouseOf, pendingParentOf }) {
    personForm.reset();
    formState.editingId = mode === 'edit' ? personId : null;
    formState.existingPhotoPath = null;
    formState.pendingSpouseOf = pendingSpouseOf || null;
    formState.pendingParentOf = pendingParentOf || null;

    populateParentSelects(mode === 'edit' ? personId : null);

    if (mode === 'edit') {
      const p = state.peopleById.get(personId);
      personModalTitle.textContent = 'Sunting Orang';
      document.getElementById('firstName').value = p.firstName || '';
      document.getElementById('lastName').value = p.lastName || '';
      document.getElementById('gender').value = p.gender || 'unknown';
      document.getElementById('birthDate').value = p.birthDate || '';
      document.getElementById('deathDate').value = p.deathDate || '';
      document.getElementById('bio').value = p.bio || '';
      fatherSelect.value = p.fatherId || '';
      motherSelect.value = p.motherId || '';
      formState.existingPhotoPath = p.photoPath || null;
      deletePersonBtn.classList.remove('hidden');
      spouseSection.classList.remove('hidden');
      renderSpouseSection(personId);
    } else {
      personModalTitle.textContent = 'Tambah Orang';
      deletePersonBtn.classList.add('hidden');
      spouseSection.classList.add('hidden');
      if (preset) {
        if (preset.fatherId) fatherSelect.value = preset.fatherId;
        if (preset.motherId) motherSelect.value = preset.motherId;
        if (preset.gender) document.getElementById('gender').value = preset.gender;
      }
    }

    personModal.classList.remove('hidden');
  }

  function closePersonModal() {
    personModal.classList.add('hidden');
  }

  document.getElementById('addPersonBtn').addEventListener('click', () => openPersonModal({ mode: 'create' }));
  document.getElementById('addFirstPersonBtn').addEventListener('click', () => openPersonModal({ mode: 'create' }));
  document.getElementById('personModalCloseBtn').addEventListener('click', closePersonModal);
  document.getElementById('cancelPersonBtn').addEventListener('click', closePersonModal);
  document.getElementById('detailCloseBtn').addEventListener('click', () => {
    detailPanel.classList.add('hidden');
    currentDetailId = null;
  });
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
    const fileInput = document.getElementById('photoFile');
    let photoPath = formState.existingPhotoPath;
    try {
      if (fileInput.files && fileInput.files[0]) {
        photoPath = await uploadPhoto(fileInput.files[0]);
      }
      const payload = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        gender: document.getElementById('gender').value,
        birthDate: document.getElementById('birthDate').value.trim() || null,
        deathDate: document.getElementById('deathDate').value.trim() || null,
        bio: document.getElementById('bio').value.trim() || null,
        photoPath,
        fatherId: fatherSelect.value ? Number(fatherSelect.value) : null,
        motherId: motherSelect.value ? Number(motherSelect.value) : null,
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
          firstName: child.firstName, lastName: child.lastName, gender: child.gender,
          birthDate: child.birthDate, deathDate: child.deathDate, bio: child.bio, photoPath: child.photoPath,
          fatherId: child.fatherId, motherId: child.motherId,
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

  document.getElementById('exportBackupBtn').addEventListener('click', async () => {
    const doFetch = () => fetch('/api/backup/export', { headers: { 'x-edit-passcode': getPasscode() } });
    try {
      let res = await doFetch();
      if (res.status === 401) {
        await promptForPasscode();
        res = await doFetch();
      }
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tree-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err.message !== 'cancelled') alert(err.message || 'Sandaran gagal');
    }
  });

  // ---- init ----
  loadData().then(fitView);
})();
