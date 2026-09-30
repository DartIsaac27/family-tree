// Everything about one person: the profile sheet, the add/edit form (with
// the duplicate-name check and photo cropping), and the "add child / spouse
// / parent" flows that first offer to pick someone already in the tree.
(function () {
  'use strict';

  const FT = window.FT;
  const { t } = window.FTI18n;
  const Family = window.FTFamily;
  const Names = window.FTNames;
  const esc = FT.esc;

  // State centre points: used on the map when someone has no exact address.
  FT.STATES = [
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
  FT.OUTSIDE_MALAYSIA = 'Luar Malaysia';
  FT.stateLabel = (s) => (s === FT.OUTSIDE_MALAYSIA ? t('form.outsideMalaysia') : s);

  // "Husband #2" / "Suami ke-2" for someone married more than once.
  FT.marriageLabel = (spouse, n) => {
    const key = spouse.gender === 'male' ? 'spouse.husbandN' : spouse.gender === 'female' ? 'spouse.wifeN' : 'spouse.spouseN';
    return t(key, { n });
  };

  FT.coupleName = (a, b) => t('person.familyOf', { a: FT.displayName(a), b: FT.displayName(b) });

  // ---- profile sheet ----

  const openSheets = new Set();

  FT.openPerson = (id) => {
    const p = FT.person(id);
    if (!p) { FT.toast(t('person.notFound')); return; }
    const entry = { id: p.id };
    entry.sheet = FT.sheet({
      title: '',
      cls: 'ov-person',
      covers: true,
      onClose: () => openSheets.delete(entry),
      onMount(s) { entry.sheet = s; paintPerson(entry); },
    });
    openSheets.add(entry);
  };

  FT.on('data', () => openSheets.forEach((e) => {
    if (FT.person(e.id)) paintPerson(e); else e.sheet.close();
  }));
  FT.on('albums', () => openSheets.forEach(paintPerson));
  FT.on('lang', () => openSheets.forEach(paintPerson));

  function infoRow(icon, label, valueHtml) {
    return `<div class="info-row">${FT.icon(icon)}<div><div class="info-label">${esc(label)}</div><div class="info-value">${valueHtml}</div></div></div>`;
  }

  function paintPerson(entry) {
    const s = entry.sheet;
    const p = FT.person(entry.id);
    if (!p) return;
    const idx = FT.state.idx;
    const user = FT.state.user;
    const canEdit = !!user;
    const spouses = Family.spousesOf(idx, p.id).map((id) => FT.person(id));
    const kids = Family.childrenOfPerson(idx, p.id);
    const sibs = Family.siblingsOf(idx, p.id);
    const father = FT.person(p.fatherId);
    const mother = FT.person(p.motherId);
    const age = FT.age(p);

    s.setTitle(FT.displayName(p));

    let html = `<div class="pp">
      <div class="pp-hero">
        ${FT.avatar(p, 'xl')}
        <h2 class="pp-name">${esc(FT.fullName(p))}</h2>
        <div class="pp-meta">
          ${p.nickname ? `<span class="tag">"${esc(p.nickname)}"</span>` : ''}
          ${FT.isDeceased(p) ? `<span class="tag tag-muted">${esc(t('person.deceased'))}</span>` : ''}
          ${FT.yearsText(p) ? `<span class="muted">${esc(FT.yearsText(p))}</span>` : ''}
        </div>
      </div>
      <div class="pp-actions">`;
    if (user && p.phone && !FT.isDeceased(p)) {
      html += `<a class="act" href="${esc(FT.telLink(p.phone))}">${FT.icon('phone')}<span>${esc(t('person.call'))}</span></a>`;
      html += `<a class="act act-wa" href="${esc(FT.waLink(p.phone))}" target="_blank" rel="noopener">${FT.icon('whatsapp')}<span>${esc(t('person.whatsapp'))}</span></a>`;
    }
    if (canEdit) html += `<button type="button" class="act" data-act="edit">${FT.icon('edit')}<span>${esc(t('person.edit'))}</span></button>`;
    html += `<button type="button" class="act" data-act="tree">${FT.icon('tree')}<span>${esc(t('person.inTree'))}</span></button>`;
    html += `<button type="button" class="act" data-act="relation">${FT.icon('link')}<span>${esc(t('person.findRelation'))}</span></button>`;
    html += `</div>`;

    // details
    let info = '';
    if (p.birthDate) info += infoRow('cake', t('person.birthDate'), esc(FT.formatDate(p.birthDate)) + (age != null && !FT.isDeceased(p) ? ` <span class="muted">(${esc(t('person.age', { n: age }))})</span>` : ''));
    if (p.deathDate) info += infoRow('calendar', t('person.deathDate'), esc(FT.formatDate(p.deathDate)));
    if (p.birthState) info += infoRow('pin', t('person.birthState'), esc(FT.stateLabel(p.birthState)));
    if (p.state) info += infoRow('home', t('person.livesIn'), esc(FT.stateLabel(p.state)));
    if (user) {
      if (p.phone) info += infoRow('phone', t('person.phone'), `<a href="${esc(FT.telLink(p.phone))}">${esc(p.phone)}</a>`);
      if (p.address) {
        const q = encodeURIComponent([p.address, p.state, 'Malaysia'].filter(Boolean).join(', '));
        info += infoRow('map', t('person.address'), `${esc(p.address)}<br><a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${esc(t('person.openMaps'))}</a>`);
      }
    }
    if (p.bio) info += infoRow('info', t('person.notes'), esc(p.bio).replace(/\n/g, '<br>'));
    if (info) html += `<section class="pp-sec">${info}</section>`;
    if (!user) {
      html += `<button type="button" class="notice" data-act="login">${FT.icon('shield')}<span>${esc(t('person.privateHidden'))}</span>${FT.icon('chevronRight')}</button>`;
    }

    // parents
    html += `<section class="pp-sec"><h3>${esc(t('person.parents'))}</h3><div class="chips">`;
    html += father ? FT.personChip(father, t('person.father')) : (canEdit ? `<button type="button" class="chip-add" data-add="father">${FT.icon('plus')} ${esc(t('person.addFather'))}</button>` : '');
    html += mother ? FT.personChip(mother, t('person.mother')) : (canEdit ? `<button type="button" class="chip-add" data-add="mother">${FT.icon('plus')} ${esc(t('person.addMother'))}</button>` : '');
    if (!father && !mother && !canEdit) html += `<span class="muted">${esc(t('common.unknown'))}</span>`;
    html += `</div></section>`;

    // spouses (+ children of each marriage)
    const multi = spouses.length > 1;
    if (spouses.length || canEdit) {
      html += `<section class="pp-sec"><h3>${esc(t('person.spouses'))}${spouses.length ? ` <span class="count">${spouses.length}</span>` : ''}</h3>`;
      spouses.forEach((sp, i) => {
        const withKids = Family.childrenWith(idx, p.id, sp.id);
        const spouseMulti = Family.spousesOf(idx, sp.id).length > 1;
        html += `<div class="marriage">
          <div class="marriage-head">
            ${FT.personChip(sp, multi ? FT.marriageLabel(sp, i + 1) : (sp.gender === 'male' ? t('spouse.husband') : sp.gender === 'female' ? t('spouse.wife') : t('spouse.spouse')))}
            ${(multi || spouseMulti) ? `<a class="btn btn-soft btn-small" href="#/tree/couple/${p.id}/${sp.id}" data-nav>${FT.icon('users')} ${esc(t('tree.viewFamily'))}</a>` : ''}
          </div>
          ${withKids.length ? `<div class="marriage-kids"><span class="muted small">${esc(multi ? t('person.childrenWith', { name: FT.displayName(sp) }) : t('person.children'))}</span><div class="chips">${withKids.map((c) => FT.personChip(c, FT.yearsText(c))).join('')}</div></div>` : ''}
        </div>`;
      });
      if (!spouses.length) html += `<p class="muted small">${esc(t('common.none'))}</p>`;
      if (canEdit) html += `<button type="button" class="chip-add" data-add="spouse">${FT.icon('plus')} ${esc(t('person.addSpouse'))}</button>`;
      html += `</section>`;
    }

    // children not covered by a marriage above
    const shown = new Set(spouses.flatMap((sp) => Family.childrenWith(idx, p.id, sp.id).map((c) => c.id)));
    const otherKids = kids.filter((c) => !shown.has(c.id));
    if (otherKids.length || canEdit) {
      html += `<section class="pp-sec"><h3>${esc(t('person.children'))} <span class="count">${kids.length}</span></h3>`;
      if (otherKids.length) {
        if (spouses.length) html += `<span class="muted small">${esc(t('person.childrenUnknownParent'))}</span>`;
        html += `<div class="chips">${otherKids.map((c) => FT.personChip(c, FT.yearsText(c))).join('')}</div>`;
      }
      if (canEdit) html += `<button type="button" class="chip-add" data-add="child">${FT.icon('plus')} ${esc(t('person.addChild'))}</button>`;
      html += `</section>`;
    }

    if (sibs.length) {
      html += `<section class="pp-sec"><h3>${esc(t('person.siblings'))} <span class="count">${sibs.length}</span></h3><div class="chips">
        ${sibs.map((x) => FT.personChip(x.person, x.half === 'mother' ? t('person.halfMother') : x.half === 'father' ? t('person.halfFather') : '')).join('')}
      </div></section>`;
    }

    const albums = (FT.state.albums || []).filter((a) => a.personIds.includes(p.id));
    if (albums.length) {
      html += `<section class="pp-sec"><h3>${esc(t('person.memories'))}</h3><div class="mini-albums">
        ${albums.map((a) => `<a class="mini-album" href="#/memories/${a.id}" data-nav>${a.coverUrl ? `<img src="${esc(a.coverUrl)}" alt="" loading="lazy" />` : `<span class="mini-album-empty">${FT.icon('image')}</span>`}<span>${esc(a.title)}</span></a>`).join('')}
      </div></section>`;
    }

    if (kids.length) {
      html += `<a class="btn btn-ghost btn-block" href="#/tree/person/${p.id}" data-nav>${FT.icon('tree')} ${esc(t('person.showDescendants'))}</a>`;
    }
    html += `</div>`;
    s.setBody(html);

    FT.bindPeople(s.body);
    s.body.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      FT.navigate(a.getAttribute('href'));
    }));
    const on = (sel, fn) => { const el = s.body.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('[data-act="edit"]', () => FT.editPerson({ id: p.id }));
    on('[data-act="tree"]', () => FT.navigate(`#/tree/focus/${p.id}`));
    on('[data-act="relation"]', () => FT.navigate(`#/relation/${p.id}`));
    on('[data-act="login"]', () => FT.openLogin());
    on('[data-add="father"]', () => FT.addParent(p.id, 'father'));
    on('[data-add="mother"]', () => FT.addParent(p.id, 'mother'));
    on('[data-add="spouse"]', () => FT.addSpouse(p.id));
    on('[data-add="child"]', () => FT.addChild(p.id));
  }

  // ---- add child / spouse / parent (pick existing first, avoid duplicates) ----

  function ancestorsOf(id) {
    const out = new Set();
    const stack = [id];
    while (stack.length) {
      const p = FT.person(stack.pop());
      if (!p) continue;
      [p.fatherId, p.motherId].forEach((x) => { if (x && !out.has(x)) { out.add(x); stack.push(x); } });
    }
    return out;
  }

  // The person and everyone descended from them (can't be their parent).
  function descendantsOf(id) {
    const out = new Set([id]);
    const queue = [id];
    while (queue.length) {
      (FT.state.idx.childrenOf.get(queue.shift()) || []).forEach((c) => { if (!out.has(c)) { out.add(c); queue.push(c); } });
    }
    return out;
  }

  async function saveAndReload(promise) {
    try {
      await promise;
      await FT.loadPeople();
      FT.toast(t('common.saved'));
    } catch (err) { FT.toastError(err); }
  }

  FT.addChild = (parentId) => FT.requireLogin(() => {
    const parent = FT.person(parentId);
    const spouses = Family.spousesOf(FT.state.idx, parentId).map((id) => FT.person(id));

    function proceed(other) {
      const preset = {};
      const parentIsMother = parent.gender === 'female' || (parent.gender !== 'male' && other && other.gender === 'male');
      if (parentIsMother) { preset.motherId = parent.id; if (other) preset.fatherId = other.id; }
      else { preset.fatherId = parent.id; if (other) preset.motherId = other.id; }
      const anc = ancestorsOf(parentId);
      FT.pickPerson({
        title: t('pick.addChildTitle', { name: FT.displayName(parent) }),
        hint: t('pick.existingHint'),
        allowNew: true,
        filter: (c) => c.id !== parentId && (!other || c.id !== other.id) && !anc.has(c.id)
          && c.fatherId !== parentId && c.motherId !== parentId,
        onNew: () => FT.editPerson({ preset }),
        onPick: (c) => saveAndReload(FT.api.send(`/api/people/${c.id}`, 'PUT', preset)),
      });
    }

    if (spouses.length > 1) {
      // Grandma with three husbands: first ask which marriage this child is from.
      const s = FT.sheet({
        title: t('pick.childWithTitle'),
        body: `<p class="muted">${esc(t('pick.childWithBody', { name: FT.displayName(parent) }))}</p>
          <div class="plist">${spouses.map((sp, i) => `
            <button type="button" class="prow" data-with="${sp.id}">${FT.avatar(sp, 'md')}
              <span class="prow-main"><span class="prow-name">${esc(FT.fullName(sp))}</span><span class="prow-sub">${esc(FT.marriageLabel(sp, i + 1))}</span></span>${FT.icon('chevronRight', 'prow-chev')}
            </button>`).join('')}
            <button type="button" class="prow" data-with="0"><span class="av av-md g-unknown">?</span><span class="prow-main"><span class="prow-name">${esc(t('pick.childWithUnknown'))}</span></span></button>
          </div>`,
        onMount(sh) {
          sh.body.querySelectorAll('[data-with]').forEach((b) => b.addEventListener('click', () => {
            const id = Number(b.getAttribute('data-with'));
            sh.close();
            proceed(id ? FT.person(id) : null);
          }));
        },
      });
      return s;
    }
    proceed(spouses[0] || null);
  });

  FT.addSpouse = (personId) => FT.requireLogin(() => {
    const p = FT.person(personId);
    const existing = new Set(Family.spousesOf(FT.state.idx, personId));
    const opposite = p.gender === 'male' ? 'female' : p.gender === 'female' ? 'male' : null;
    FT.pickPerson({
      title: t('pick.addSpouseTitle', { name: FT.displayName(p) }),
      hint: t('pick.existingHint'),
      allowNew: true,
      filter: (x) => x.id !== personId && !existing.has(x.id) && (!opposite || x.gender !== p.gender),
      onNew: () => FT.editPerson({ preset: opposite ? { gender: opposite } : {}, link: { type: 'spouse', personId } }),
      onPick: (x) => saveAndReload(FT.api.send('/api/spouses', 'POST', { personId, spouseId: x.id })),
    });
  });

  FT.addParent = (childId, role) => FT.requireLogin(() => {
    const gender = role === 'father' ? 'male' : 'female';
    const desc = descendantsOf(childId);
    FT.pickPerson({
      title: t(role === 'father' ? 'person.addFather' : 'person.addMother'),
      hint: t('pick.existingHint'),
      allowNew: true,
      filter: (x) => !desc.has(x.id) && x.gender !== (gender === 'male' ? 'female' : 'male'),
      onNew: () => FT.editPerson({ preset: { gender }, link: { type: 'parentOf', childId, role } }),
      onPick: (x) => saveAndReload(FT.api.send(`/api/people/${childId}`, 'PUT', { [role === 'father' ? 'fatherId' : 'motherId']: x.id })),
    });
  });

  // ---- photo crop ----

  FT.cropPhoto = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    let cropper = null;
    let result = null;
    FT.sheet({
      title: t('crop.title'),
      covers: true,
      body: `<div class="crop-box"><img alt="" /></div><p class="muted small center">${esc(t('crop.hint'))}</p>`,
      foot: `<button type="button" class="btn btn-ghost" data-cancel>${esc(t('common.cancel'))}</button><button type="button" class="btn btn-primary" data-use>${esc(t('crop.use'))}</button>`,
      onMount(s) {
        const img = s.body.querySelector('img');
        img.src = url;
        img.addEventListener('load', () => {
          cropper = new window.Cropper(img, {
            aspectRatio: 1, viewMode: 1, dragMode: 'move', background: false, autoCropArea: 1,
            cropBoxResizable: false, cropBoxMovable: false, guides: false, center: false, highlight: false,
          });
        }, { once: true });
        s.foot.querySelector('[data-cancel]').addEventListener('click', s.close);
        s.foot.querySelector('[data-use]').addEventListener('click', () => {
          if (!cropper) return;
          cropper.getCroppedCanvas({ width: 480, height: 480, imageSmoothingQuality: 'high' }).toBlob((blob) => {
            result = blob;
            s.close();
          }, 'image/jpeg', 0.88);
        });
      },
      onClose() {
        if (cropper) cropper.destroy();
        URL.revokeObjectURL(url);
        resolve(result);
      },
    });
  });

  // ---- duplicate warning ----

  // Resolves { action: 'existing', person } | { action: 'new' } | null (cancel)
  function duplicateDialog(matches, allowUseExisting) {
    return new Promise((resolve) => {
      let answer = null;
      const s = FT.sheet({
        title: t('dup.title'),
        covers: true,
        body: `<p>${esc(t('dup.body'))}</p>
          <div class="plist">${matches.map((m) => `
            <div class="dup-item">
              ${FT.personRow(m.person, `${t(`dup.${m.reason}`)}${FT.personHint(m.person) ? ' · ' + FT.personHint(m.person) : ''}`)}
              ${allowUseExisting ? `<button type="button" class="btn btn-primary btn-small" data-use="${m.person.id}">${esc(t('dup.useExisting'))}</button>` : ''}
            </div>`).join('')}</div>`,
        foot: `<button type="button" class="btn btn-ghost" data-cancel>${esc(t('common.cancel'))}</button>
               <button type="button" class="btn btn-soft" data-new>${esc(t('dup.createAnyway'))}</button>`,
        onClose: () => resolve(answer),
        onMount(sh) {
          FT.bindPeople(sh.body);
          sh.body.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
            answer = { action: 'existing', person: FT.person(Number(b.getAttribute('data-use'))) };
            sh.close();
          }));
          sh.foot.querySelector('[data-cancel]').addEventListener('click', sh.close);
          sh.foot.querySelector('[data-new]').addEventListener('click', () => { answer = { action: 'new' }; sh.close(); });
        },
      });
      return s;
    });
  }

  // ---- add / edit form ----

  function stateOptions(selected) {
    return `<option value="">${esc(t('form.chooseState'))}</option>`
      + FT.STATES.map((s) => `<option value="${esc(s.name)}"${s.name === selected ? ' selected' : ''}>${esc(s.name)}</option>`).join('')
      + `<option value="${esc(FT.OUTSIDE_MALAYSIA)}"${selected === FT.OUTSIDE_MALAYSIA ? ' selected' : ''}>${esc(t('form.outsideMalaysia'))}</option>`
      + (selected && selected !== FT.OUTSIDE_MALAYSIA && !FT.STATES.some((s) => s.name === selected) ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : '');
  }

  function dateField(name, value) {
    const d = Family.parseDate(value) || {};
    const months = FTI18n.months();
    return `<div class="date-field" data-date="${name}">
      <select class="input" data-part="d" aria-label="${esc(t('form.day'))}"><option value="">${esc(t('form.day'))}</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}"${d.d === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>
      <select class="input" data-part="m" aria-label="${esc(t('form.month'))}"><option value="">${esc(t('form.month'))}</option>${months.map((m, i) => `<option value="${i + 1}"${d.m === i + 1 ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>
      <input class="input" data-part="y" type="text" inputmode="numeric" maxlength="4" placeholder="${esc(t('form.year'))}" value="${d.y || ''}" aria-label="${esc(t('form.year'))}" />
    </div>`;
  }

  // Builds "1950", "1950-04", "1950-04-12", or "0000-04-12" (no year).
  function readDate(root, name) {
    const box = root.querySelector(`[data-date="${name}"]`);
    const y = box.querySelector('[data-part="y"]').value.trim();
    const m = box.querySelector('[data-part="m"]').value;
    const d = box.querySelector('[data-part="d"]').value;
    if (y && !/^\d{4}$/.test(y)) return { error: true };
    const pad = (n) => String(n).padStart(2, '0');
    if (!y && !(m && d)) return { value: null };
    const yy = y || '0000';
    if (m && d) return { value: `${yy}-${pad(m)}-${pad(d)}` };
    if (m && y) return { value: `${yy}-${pad(m)}` };
    return { value: y || null };
  }

  function parentPicker(role, id) {
    const p = FT.person(id);
    return `<div class="parent-pick" data-role="${role}">
      <button type="button" class="parent-btn" data-choose="${role}">
        ${p ? FT.avatar(p, 'sm') : `<span class="av av-sm g-${role === 'father' ? 'male' : 'female'}">${FT.icon('plus')}</span>`}
        <span>${p ? esc(FT.fullName(p)) : esc(t(role === 'father' ? 'form.chooseFather' : 'form.chooseMother'))}</span>
      </button>
      ${p ? `<button type="button" class="icon-btn" data-clear="${role}" aria-label="${esc(t('common.clear'))}">${FT.icon('close')}</button>` : ''}
    </div>`;
  }

  // opts: { id } to edit, or { preset, link: {type:'spouse', personId} | {type:'parentOf', childId, role}, onSaved }
  FT.editPerson = (opts) => FT.requireLogin(() => {
    const editing = opts.id ? FT.person(opts.id) : null;
    const preset = opts.preset || {};
    const src = editing || preset;
    const form = {
      fatherId: src.fatherId || null,
      motherId: src.motherId || null,
      gender: src.gender || 'unknown',
      photoPath: editing ? editing.photoPath : null,
      photoBlob: null,
      ackKey: null,
    };

    let cleanup = () => {};
    const s = FT.sheet({
      title: editing ? t('form.editTitle') : t('form.addTitle'),
      size: 'full',
      cls: 'ov-form',
      covers: true,
      dismissible: false,
      onClose: () => cleanup(),
      foot: `<button type="button" class="btn btn-ghost" data-cancel>${esc(t('common.cancel'))}</button>
             <button type="button" class="btn btn-primary" data-save>${esc(t('common.save'))}</button>`,
    });

    s.setBody(`<form class="pform" novalidate>
      <div class="photo-pick">
        <div class="photo-preview"></div>
        <div class="photo-btns">
          <label class="btn btn-soft btn-small">${FT.icon('camera')} <span data-photo-label></span><input type="file" accept="image/*" hidden /></label>
          <button type="button" class="btn btn-ghost btn-small hidden" data-photo-remove>${esc(t('form.photoRemove'))}</button>
        </div>
      </div>

      <label class="field"><span class="field-label">${esc(t('form.fullName'))} *</span>
        <input class="input input-lg" name="fullName" autocomplete="off" autocapitalize="words" value="${esc(editing ? FT.fullName(editing) : (preset.fullName || ''))}" placeholder="${esc(t('form.fullNameHint'))}" />
      </label>
      <div class="dup-inline hidden"></div>
      <div class="father-suggest hidden"></div>

      <label class="field"><span class="field-label">${esc(t('form.nickname'))}</span>
        <input class="input" name="nickname" autocomplete="off" value="${esc(src.nickname || '')}" placeholder="${esc(t('form.nicknameHint'))}" />
      </label>

      <div class="field"><span class="field-label">${esc(t('form.gender'))}</span>
        <div class="seg" data-gender>
          <button type="button" data-g="male">${esc(t('form.male'))}</button>
          <button type="button" data-g="female">${esc(t('form.female'))}</button>
        </div>
      </div>

      <div class="field"><span class="field-label">${esc(t('form.birthDate'))}</span>${dateField('birth', src.birthDate)}<span class="field-hint">${esc(t('form.birthDateHint'))}</span></div>

      <label class="field"><span class="field-label">${esc(t('form.birthState'))}</span>
        <select class="input" name="birthState">${stateOptions(src.birthState)}</select>
      </label>

      <label class="check"><input type="checkbox" name="deceased" ${editing && FT.isDeceased(editing) ? 'checked' : ''} /> <span>${esc(t('form.deceased'))}</span></label>
      <div class="field death-field ${editing && FT.isDeceased(editing) ? '' : 'hidden'}"><span class="field-label">${esc(t('form.deathDate'))}</span>${dateField('death', src.deathDate)}</div>

      <h3 class="form-sec">${esc(t('form.sectionFamily'))}</h3>
      <div class="field"><span class="field-label">${esc(t('form.father'))}</span><div data-slot="father"></div></div>
      <div class="field"><span class="field-label">${esc(t('form.mother'))}</span><div data-slot="mother"></div></div>
      ${editing ? `<div class="field spouse-editor"></div>` : ''}

      <h3 class="form-sec">${esc(t('form.sectionContact'))} <span class="muted small">🔒 ${esc(t('form.privateNote'))}</span></h3>
      <label class="field"><span class="field-label">${esc(t('form.phone'))}</span>
        <input class="input" name="phone" type="tel" inputmode="tel" autocomplete="off" value="${esc(src.phone || '')}" placeholder="${esc(t('form.phoneHint'))}" />
      </label>
      <label class="field"><span class="field-label">${esc(t('form.livesState'))}</span>
        <select class="input" name="state">${stateOptions(src.state)}</select>
      </label>
      <label class="field"><span class="field-label">${esc(t('form.address'))}</span>
        <textarea class="input" name="address" rows="2" placeholder="${esc(t('form.addressHint'))}">${esc(src.address || '')}</textarea>
      </label>

      <h3 class="form-sec">${esc(t('form.sectionOther'))}</h3>
      <label class="field"><span class="field-label">${esc(t('form.notes'))}</span>
        <textarea class="input" name="bio" rows="3" placeholder="${esc(t('form.notesHint'))}">${esc(src.bio || '')}</textarea>
      </label>

      ${editing ? `<button type="button" class="btn btn-danger-ghost btn-block" data-delete>${FT.icon('trash')} ${esc(t('form.deletePerson'))}</button>` : ''}
    </form>`);

    const root = s.body;
    const el = (sel) => root.querySelector(sel);
    const nameInput = el('[name="fullName"]');

    // photo
    function paintPhoto() {
      const box = el('.photo-preview');
      if (form.photoBlob) box.innerHTML = `<img src="${URL.createObjectURL(form.photoBlob)}" alt="" />`;
      else if (form.photoPath) box.innerHTML = `<img src="${esc(form.photoPath)}" alt="" />`;
      else box.innerHTML = `<span>${FT.icon('camera')}</span>`;
      el('[data-photo-label]').textContent = form.photoBlob || form.photoPath ? t('form.photoChange') : t('form.photoAdd');
      el('[data-photo-remove]').classList.toggle('hidden', !(form.photoBlob || form.photoPath));
    }
    el('input[type="file"]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const blob = await FT.cropPhoto(file);
      if (blob) { form.photoBlob = blob; paintPhoto(); }
    });
    el('[data-photo-remove]').addEventListener('click', () => { form.photoBlob = null; form.photoPath = null; paintPhoto(); });
    paintPhoto();

    // gender
    function paintGender() {
      root.querySelectorAll('[data-g]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-g') === form.gender));
    }
    root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
      form.gender = form.gender === b.getAttribute('data-g') ? 'unknown' : b.getAttribute('data-g');
      paintGender();
    }));
    paintGender();

    // deceased toggle
    el('[name="deceased"]').addEventListener('change', (e) => el('.death-field').classList.toggle('hidden', !e.target.checked));

    // parents
    function paintParents() {
      el('[data-slot="father"]').innerHTML = parentPicker('father', form.fatherId);
      el('[data-slot="mother"]').innerHTML = parentPicker('mother', form.motherId);
      root.querySelectorAll('[data-choose]').forEach((b) => b.addEventListener('click', () => {
        const role = b.getAttribute('data-choose');
        const blocked = editing ? descendantsOf(editing.id) : new Set();
        FT.pickPerson({
          title: t(role === 'father' ? 'form.chooseFather' : 'form.chooseMother'),
          filter: (p) => !blocked.has(p.id) && p.gender !== (role === 'father' ? 'female' : 'male'),
          onPick: (p) => {
            form[role === 'father' ? 'fatherId' : 'motherId'] = p.id;
            // Picking one parent fills in their only spouse as the other.
            const other = role === 'father' ? 'motherId' : 'fatherId';
            const sp = Family.spousesOf(FT.state.idx, p.id);
            if (!form[other] && sp.length === 1) form[other] = sp[0];
            paintParents();
            checkDuplicates();
          },
        });
      }));
      root.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => {
        form[b.getAttribute('data-clear') === 'father' ? 'fatherId' : 'motherId'] = null;
        paintParents();
      }));
      suggestFather();
    }

    // "Ali bin Abu": offer the one "Abu" in the tree as the father.
    function suggestFather() {
      const box = el('.father-suggest');
      const { lastName } = Names.splitFullName(nameInput.value);
      const fatherName = Names.fatherPart(lastName);
      if (form.fatherId || !fatherName) { box.classList.add('hidden'); return; }
      const key = Names.nameKey(fatherName, '');
      const matches = FT.state.people.filter((p) => p.gender !== 'female' && (!editing || p.id !== editing.id)
        && (Names.nameKey(p.firstName, '') === key || Names.nameKey(p.firstName, p.lastName) === key));
      if (!matches.length || matches.length > 3) { box.classList.add('hidden'); return; }
      box.innerHTML = matches.map((m) => `<div class="suggest">${FT.avatar(m, 'sm')}<span>${esc(t('form.fatherSuggest', { name: FT.fullName(m) }))}</span><button type="button" class="btn btn-soft btn-small" data-use-father="${m.id}">${esc(t('form.useThis'))}</button></div>`).join('');
      box.classList.remove('hidden');
      box.querySelectorAll('[data-use-father]').forEach((b) => b.addEventListener('click', () => {
        form.fatherId = Number(b.getAttribute('data-use-father'));
        const sp = Family.spousesOf(FT.state.idx, form.fatherId);
        if (!form.motherId && sp.length === 1) form.motherId = sp[0];
        paintParents();
        checkDuplicates();
      }));
    }

    // live duplicate warning under the name field
    function candidate() {
      const { firstName, lastName } = Names.splitFullName(nameInput.value);
      return { firstName, lastName, fatherId: form.fatherId, motherId: form.motherId };
    }
    function currentMatches() {
      const c = candidate();
      if (!c.firstName) return [];
      return Names.findDuplicates(c, FT.state.people, editing ? editing.id : null);
    }
    function checkDuplicates() {
      const box = el('.dup-inline');
      const matches = currentMatches();
      if (!matches.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
      const strong = matches.some((m) => m.reason !== 'similar');
      box.innerHTML = `<div class="dup-head">⚠️ ${esc(strong ? t('dup.inline') : t('dup.inlineSimilar'))}</div>
        <div class="chips">${matches.slice(0, 3).map((m) => FT.personChip(m.person, FT.personHint(m.person))).join('')}</div>`;
      box.classList.toggle('dup-strong', strong);
      box.classList.remove('hidden');
      FT.bindPeople(box);
    }
    let dupTimer = null;
    nameInput.addEventListener('input', () => {
      clearTimeout(dupTimer);
      dupTimer = setTimeout(() => { checkDuplicates(); suggestFather(); }, 250);
      // "binti" -> female, "bin" -> male, unless already chosen
      const g = Names.guessGender(nameInput.value);
      if (g && form.gender === 'unknown') { form.gender = g; paintGender(); }
    });

    paintParents();
    if (!editing) checkDuplicates();

    // spouses (edit mode): order for multiple marriages, remove
    function paintSpouses() {
      const box = el('.spouse-editor');
      if (!box) return;
      const ids = Family.spousesOf(FT.state.idx, editing.id);
      const info = FT.state.idx.spouseInfo.get(editing.id) || new Map();
      box.innerHTML = `<span class="field-label">${esc(t('form.sectionSpouses'))}</span>
        ${ids.length > 1 ? `<span class="field-hint">${esc(t('form.spouseOrderHint'))}</span>` : ''}
        <div class="plist">${ids.map((id, i) => {
          const sp = FT.person(id);
          return `<div class="prow prow-static">${FT.avatar(sp, 'sm')}
            <span class="prow-main"><span class="prow-name">${esc(FT.fullName(sp))}</span>${ids.length > 1 ? `<span class="prow-sub">${esc(FT.marriageLabel(sp, i + 1))}</span>` : ''}</span>
            ${ids.length > 1 ? `<button type="button" class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(t('form.moveUp'))}">${FT.icon('arrowUp')}</button>
            <button type="button" class="icon-btn" data-down="${i}" ${i === ids.length - 1 ? 'disabled' : ''} aria-label="${esc(t('form.moveDown'))}">${FT.icon('arrowDown')}</button>` : ''}
            ${info.get(id) && !info.get(id).inferred ? `<button type="button" class="icon-btn" data-remove="${id}" aria-label="${esc(t('form.remove'))}">${FT.icon('trash')}</button>` : ''}
          </div>`;
        }).join('')}</div>
        <button type="button" class="chip-add" data-add-spouse>${FT.icon('plus')} ${esc(t('person.addSpouse'))}</button>`;
      const move = async (i, dir) => {
        const next = ids.slice();
        [next[i], next[i + dir]] = [next[i + dir], next[i]];
        try {
          await FT.api.send('/api/spouses/order', 'PUT', { personId: editing.id, spouseIds: next });
          await FT.loadPeople();
          paintSpouses();
        } catch (err) { FT.toastError(err); }
      };
      box.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => move(Number(b.getAttribute('data-up')), -1)));
      box.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => move(Number(b.getAttribute('data-down')), 1)));
      box.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
        const sp = FT.person(Number(b.getAttribute('data-remove')));
        if (!(await FT.confirm(t('form.removeSpouseConfirm', { name: FT.fullName(sp) }), { danger: true, okLabel: t('form.remove') }))) return;
        try {
          await FT.api.send('/api/spouses', 'DELETE', { personId: editing.id, spouseId: sp.id });
          await FT.loadPeople();
          paintSpouses();
        } catch (err) { FT.toastError(err); }
      }));
      box.querySelector('[data-add-spouse]').addEventListener('click', () => FT.addSpouse(editing.id));
    }
    paintSpouses();
    cleanup = FT.on('data', paintSpouses);

    // delete
    const del = el('[data-delete]');
    if (del) {
      del.addEventListener('click', async () => {
        if (!(await FT.confirm(t('person.deleteConfirm', { name: FT.fullName(editing) }), { danger: true, okLabel: t('common.delete') }))) return;
        try {
          await FT.api.send(`/api/people/${editing.id}`, 'DELETE');
          s.close();
          await FT.loadPeople();
          FT.toast(t('common.deleted'));
        } catch (err) { FT.toastError(err); }
      });
    }

    // Link an existing person the way this form was going to link the new one.
    async function useExisting(person) {
      const link = opts.link;
      if (link && link.type === 'spouse') await FT.api.send('/api/spouses', 'POST', { personId: link.personId, spouseId: person.id });
      else if (link && link.type === 'parentOf') await FT.api.send(`/api/people/${link.childId}`, 'PUT', { [link.role === 'father' ? 'fatherId' : 'motherId']: person.id });
      else if (preset.fatherId || preset.motherId) {
        const patch = {};
        if (preset.fatherId) patch.fatherId = preset.fatherId;
        if (preset.motherId) patch.motherId = preset.motherId;
        await FT.api.send(`/api/people/${person.id}`, 'PUT', patch);
      } else {
        s.close();
        FT.openPerson(person.id);
        return;
      }
      s.close();
      await FT.loadPeople();
      FT.toast(t('common.saved'));
    }

    async function save() {
      const full = nameInput.value.replace(/\s+/g, ' ').trim();
      if (!full) { FT.toast(t('form.nameRequired'), { kind: 'error' }); nameInput.focus(); return; }
      const birth = readDate(root, 'birth');
      const death = readDate(root, 'death');
      if (birth.error || death.error) { FT.toast(t('form.yearInvalid'), { kind: 'error' }); return; }
      const { firstName, lastName } = Names.splitFullName(full);
      const key = Names.nameKey(firstName, lastName);

      // Warn before creating what looks like someone already in the tree.
      const nameChanged = !editing || key !== Names.nameKey(editing.firstName, editing.lastName);
      if (nameChanged && form.ackKey !== key) {
        const matches = currentMatches().filter((m) => m.score >= 0.88);
        if (matches.length) {
          const answer = await duplicateDialog(matches, !editing);
          if (!answer) return;
          if (answer.action === 'existing') {
            try { await useExisting(answer.person); } catch (err) { FT.toastError(err); }
            return;
          }
          form.ackKey = key;
        }
      }

      const deceased = el('[name="deceased"]').checked;
      const payload = {
        firstName,
        lastName,
        nickname: el('[name="nickname"]').value.trim() || null,
        gender: form.gender,
        birthDate: birth.value,
        deathDate: deceased ? death.value : null,
        isDeceased: deceased,
        birthState: el('[name="birthState"]').value || null,
        state: el('[name="state"]').value || null,
        address: el('[name="address"]').value.trim() || null,
        phone: el('[name="phone"]').value.trim() || null,
        bio: el('[name="bio"]').value.trim() || null,
        fatherId: form.fatherId,
        motherId: form.motherId,
        photoPath: form.photoPath,
        allowDuplicate: form.ackKey === key,
      };

      const btn = s.foot.querySelector('[data-save]');
      btn.disabled = true;
      btn.textContent = t('common.saving');
      try {
        if (form.photoBlob) {
          payload.photoPath = await FT.uploadAvatar(form.photoBlob);
          form.photoPath = payload.photoPath;
          form.photoBlob = null;
        }
        let saved;
        try {
          saved = editing
            ? await FT.api.send(`/api/people/${editing.id}`, 'PUT', payload)
            : await FT.api.send('/api/people', 'POST', payload);
        } catch (err) {
          if (err.status !== 409 || !err.data || err.data.code !== 'duplicate') throw err;
          // Someone else added the same name meanwhile.
          await FT.loadPeople();
          const matches = (err.data.matchIds || []).map((id) => ({ person: FT.person(id), reason: 'same', score: 1 })).filter((m) => m.person);
          const answer = await duplicateDialog(matches, !editing);
          if (!answer) return;
          if (answer.action === 'existing') { await useExisting(answer.person); return; }
          form.ackKey = key;
          payload.allowDuplicate = true;
          saved = editing
            ? await FT.api.send(`/api/people/${editing.id}`, 'PUT', payload)
            : await FT.api.send('/api/people', 'POST', payload);
        }
        const link = opts.link;
        if (!editing && link && link.type === 'spouse') {
          await FT.api.send('/api/spouses', 'POST', { personId: link.personId, spouseId: saved.id });
        }
        if (!editing && link && link.type === 'parentOf') {
          await FT.api.send(`/api/people/${link.childId}`, 'PUT', { [link.role === 'father' ? 'fatherId' : 'motherId']: saved.id });
        }
        s.close();
        await FT.loadPeople();
        FT.toast(t('common.saved'));
        if (opts.onSaved) opts.onSaved(saved);
        else if (!editing) FT.openPerson(saved.id);
      } catch (err) {
        FT.toastError(err);
      } finally {
        btn.disabled = false;
        btn.textContent = t('common.save');
      }
    }

    s.foot.querySelector('[data-cancel]').addEventListener('click', s.close);
    s.foot.querySelector('[data-save]').addEventListener('click', save);
    root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); save(); });
  });
})();
