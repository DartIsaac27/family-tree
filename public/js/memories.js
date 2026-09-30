// Memories: one album per family event (Hari Raya, weddings, kenduri...).
// Anyone signed in can create albums, upload photos and tag who was there.
// Photos are shrunk in the browser before upload (max 1600px, plus a small
// thumbnail) so they load quickly on phones.
(function () {
  'use strict';

  const FT = window.FT;
  const { t } = window.FTI18n;
  const esc = FT.esc;

  let album = null; // { album, photos } for the open album page
  let albumId = null;

  FT.views.memories = {
    tab: 'memories',
    title: () => t('mem.title'),
    render: paintList,
    refresh(ev) { if (ev === 'albums' || ev === 'user' || ev === 'data') paintList(); },
  };

  FT.views.album = {
    tab: 'memories',
    parent: '#/memories',
    title: () => (album && album.album.id === albumId ? album.album.title : t('tab.memories')),
    render(r) {
      const id = Number(r.parts[1]);
      if (id !== albumId) album = null;
      albumId = id;
      paintAlbum();
      loadAlbum();
    },
    refresh(ev) { if (ev === 'user') loadAlbum(); else if (ev === 'data') paintAlbum(); },
  };

  function albumMeta(a) {
    return [a.eventDate ? FT.formatDate(a.eventDate) : null, t('common.photos', { n: a.photoCount || 0 })].filter(Boolean).join(' · ');
  }

  FT.albumCard = (a) => `
    <a class="album-card" href="#/memories/${a.id}">
      <span class="album-cover">${a.coverUrl ? `<img src="${esc(a.coverUrl)}" alt="" loading="lazy" />` : FT.icon('image')}</span>
      <span class="album-info"><span class="album-title">${esc(a.title)}</span><span class="album-meta">${esc(albumMeta(a))}</span></span>
    </a>`;

  function paintList() {
    const root = document.getElementById('view-memories');
    const albums = FT.state.albums;
    let html = `<div class="page">
      <div class="page-head"><h2>${esc(t('mem.title'))}</h2>
        <button type="button" class="btn btn-primary btn-small" data-new>${FT.icon('plus')} ${esc(t('mem.newAlbum'))}</button></div>`;
    if (!albums) html += `<p class="muted center pad">${esc(t('common.loading'))}</p>`;
    else if (!albums.length) {
      html += `<div class="empty"><div class="empty-art">📷</div><h2>${esc(t('mem.empty'))}</h2><p>${esc(t('mem.emptyBody'))}</p>
        <button type="button" class="btn btn-primary" data-new>${FT.icon('plus')} ${esc(t('mem.newAlbum'))}</button></div>`;
    } else {
      html += `<div class="album-grid">${albums.map(FT.albumCard).join('')}</div>`;
    }
    html += `</div>`;
    root.innerHTML = html;
    root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => FT.requireLogin(() => openAlbumForm(null))));
  }

  async function loadAlbum() {
    const id = albumId;
    try {
      const data = await FT.api.get(`/api/albums/${id}`);
      if (id !== albumId) return;
      album = data;
    } catch (err) {
      if (id !== albumId) return;
      album = { error: err.status === 404 ? t('mem.albumNotFound') : err.message };
    }
    if (FT.currentView() === 'album') {
      paintAlbum();
      FT.setPageTitle(FT.views.album.title());
    }
  }

  function paintAlbum() {
    const root = document.getElementById('view-album');
    if (!album) { root.innerHTML = `<p class="muted center pad">${esc(t('common.loading'))}</p>`; return; }
    if (album.error) { root.innerHTML = `<div class="empty"><p>${esc(album.error)}</p><a class="btn btn-soft" href="#/memories">${esc(t('mem.allAlbums'))}</a></div>`; return; }
    const a = album.album;
    const people = a.personIds.map((id) => FT.person(id)).filter(Boolean);
    const user = FT.state.user;
    root.innerHTML = `<div class="page">
      <div class="album-head">
        <h2>${esc(a.title)}</h2>
        <p class="muted">${esc([a.eventDate ? FT.formatDate(a.eventDate) : null, t('common.photos', { n: album.photos.length })].filter(Boolean).join(' · '))}</p>
        ${a.description ? `<p>${esc(a.description).replace(/\n/g, '<br>')}</p>` : ''}
        <div class="chips">${people.map((p) => FT.personChip(p)).join('')}
          ${user ? `<button type="button" class="chip-add" data-tag>${FT.icon('users')} ${esc(t('mem.tagPeople'))}</button>` : ''}</div>
        <div class="album-actions">
          <label class="btn btn-primary">${FT.icon('camera')} ${esc(t('mem.addPhotos'))}<input type="file" accept="image/*" multiple hidden data-upload /></label>
          ${a.canManage ? `<button type="button" class="btn btn-ghost btn-square" data-edit aria-label="${esc(t('mem.editAlbum'))}">${FT.icon('edit')}</button>
          <button type="button" class="btn btn-danger-ghost btn-square" data-delete aria-label="${esc(t('mem.deleteAlbum'))}">${FT.icon('trash')}</button>` : ''}
        </div>
      </div>
      ${album.photos.length
        ? `<div class="photo-grid">${album.photos.map((ph, i) => `<button type="button" class="ph" data-i="${i}"><img src="${esc(ph.thumbUrl)}" alt="${esc(ph.caption || '')}" loading="lazy" /></button>`).join('')}</div>`
        : `<div class="empty"><div class="empty-art">🖼️</div><p>${esc(t('mem.noPhotos'))}</p></div>`}
    </div>`;
    FT.bindPeople(root);
    root.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => openViewer(Number(b.getAttribute('data-i')))));
    const up = root.querySelector('[data-upload]');
    up.addEventListener('click', (e) => { if (!FT.state.user) { e.preventDefault(); FT.openLogin(); } });
    up.addEventListener('change', () => { const files = [...up.files]; up.value = ''; if (files.length) uploadPhotos(files); });
    const on = (sel, fn) => { const x = root.querySelector(sel); if (x) x.addEventListener('click', fn); };
    on('[data-edit]', () => openAlbumForm(a));
    on('[data-delete]', async () => {
      if (!(await FT.confirm(t('mem.deleteAlbumConfirm', { title: a.title }), { danger: true, okLabel: t('common.delete') }))) return;
      try {
        await FT.api.send(`/api/albums/${a.id}`, 'DELETE');
        FT.toast(t('common.deleted'));
        await FT.loadAlbums();
        FT.navigate('#/memories');
      } catch (err) { FT.toastError(err); }
    });
    on('[data-tag]', () => FT.pickPerson({
      title: t('mem.tagPeople'),
      multi: true,
      selected: a.personIds,
      onDone: async (ids) => {
        try {
          await FT.api.send(`/api/albums/${a.id}`, 'PUT', { personIds: ids });
          await Promise.all([loadAlbum(), FT.loadAlbums()]);
        } catch (err) { FT.toastError(err); }
      },
    }));
  }

  // ---- create / edit album ----

  function openAlbumForm(existing) {
    let personIds = existing ? existing.personIds.slice() : [];
    const s = FT.sheet({
      title: existing ? t('mem.editAlbum') : t('mem.newAlbum'),
      covers: true,
      body: `<form class="pform" novalidate>
        <label class="field"><span class="field-label">${esc(t('mem.albumTitle'))} *</span>
          <input class="input input-lg" name="title" value="${esc(existing ? existing.title : '')}" placeholder="${esc(t('mem.albumTitleHint'))}" /></label>
        <label class="field"><span class="field-label">${esc(t('mem.eventDate'))}</span>
          <input class="input" name="eventDate" type="date" value="${esc(existing && /^\d{4}-\d{2}-\d{2}$/.test(existing.eventDate || '') ? existing.eventDate : '')}" /></label>
        <label class="field"><span class="field-label">${esc(t('mem.description'))}</span>
          <textarea class="input" name="description" rows="3">${esc(existing ? existing.description || '' : '')}</textarea></label>
        <div class="field"><span class="field-label">${esc(t('mem.people'))}</span><div class="chips" data-people></div></div>
      </form>`,
      foot: `<button type="button" class="btn btn-ghost" data-cancel>${esc(t('common.cancel'))}</button><button type="button" class="btn btn-primary" data-save>${esc(t('common.save'))}</button>`,
    });
    const box = s.body.querySelector('[data-people]');
    function paintPeople() {
      box.innerHTML = personIds.map((id) => FT.person(id)).filter(Boolean).map((p) => FT.personChip(p)).join('')
        + `<button type="button" class="chip-add" data-tag>${FT.icon('users')} ${esc(t('mem.tagPeople'))}</button>`;
      box.querySelector('[data-tag]').addEventListener('click', () => FT.pickPerson({
        title: t('mem.tagPeople'), multi: true, selected: personIds, onDone: (ids) => { personIds = ids; paintPeople(); },
      }));
    }
    paintPeople();
    s.foot.querySelector('[data-cancel]').addEventListener('click', s.close);
    s.foot.querySelector('[data-save]').addEventListener('click', async () => {
      const title = s.body.querySelector('[name="title"]').value.trim();
      if (!title) { FT.toast(t('mem.albumTitle') + '?', { kind: 'error' }); return; }
      const body = {
        title,
        eventDate: s.body.querySelector('[name="eventDate"]').value || null,
        description: s.body.querySelector('[name="description"]').value.trim() || null,
        personIds,
      };
      try {
        const res = existing
          ? await FT.api.send(`/api/albums/${existing.id}`, 'PUT', body)
          : await FT.api.send('/api/albums', 'POST', body);
        s.close();
        await FT.loadAlbums();
        if (existing) loadAlbum(); else FT.navigate(`#/memories/${res.album.id}`);
      } catch (err) { FT.toastError(err); }
    });
  }

  // ---- upload ----

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  function shrink(img, maxSize, quality) {
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve({ blob, w, h }), 'image/jpeg', quality));
  }

  async function uploadPhotos(files) {
    const id = albumId;
    let ok = 0, failed = 0;
    const toast = FT.toast(t('mem.uploading', { i: 1, n: files.length }), { sticky: true });
    for (let i = 0; i < files.length; i++) {
      toast.update(t('mem.uploading', { i: i + 1, n: files.length }));
      try {
        const { img, url } = await loadImage(files[i]);
        const full = await shrink(img, 1600, 0.85);
        const thumb = await shrink(img, 480, 0.78);
        URL.revokeObjectURL(url);
        const fd = new FormData();
        fd.append('photo', full.blob, 'photo.jpg');
        fd.append('thumb', thumb.blob, 'thumb.jpg');
        fd.append('width', full.w);
        fd.append('height', full.h);
        await FT.api.form(`/api/albums/${id}/photos`, fd);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    toast.close();
    FT.toast(failed ? t('mem.uploadFailed', { n: failed }) : t('mem.uploaded', { n: ok }), { kind: failed ? 'error' : null });
    await Promise.all([loadAlbum(), FT.loadAlbums()]);
  }

  // ---- full-screen photo viewer (swipe left/right) ----

  function openViewer(start) {
    let i = start;
    const keys = (e) => {
      if (e.key === 'ArrowLeft' && i > 0) { i -= 1; paint(); }
      if (e.key === 'ArrowRight' && i < album.photos.length - 1) { i += 1; paint(); }
    };
    const s = FT.sheet({
      title: '', size: 'full', cls: 'ov-viewer', covers: true,
      onClose: () => document.removeEventListener('keydown', keys),
    });
    document.addEventListener('keydown', keys);
    s.el.querySelector('.sheet-head').classList.add('viewer-head');
    function paint() {
      const photos = album.photos;
      if (!photos.length) { s.close(); return; }
      i = Math.max(0, Math.min(i, photos.length - 1));
      const ph = photos[i];
      s.setTitle(`${i + 1} / ${photos.length}`);
      s.setBody(`<div class="viewer">
        <img src="${esc(ph.url)}" alt="${esc(ph.caption || '')}" />
        ${i > 0 ? `<button type="button" class="viewer-nav prev" data-prev aria-label="‹">${FT.icon('left')}</button>` : ''}
        ${i < photos.length - 1 ? `<button type="button" class="viewer-nav next" data-next aria-label="›">${FT.icon('right')}</button>` : ''}
      </div>
      <div class="viewer-bar">
        <p class="viewer-caption">${esc(ph.caption || '')}</p>
        <div class="viewer-actions">
          <a class="btn btn-ghost btn-small" href="${esc(ph.url)}" download="kenangan-${ph.id}.jpg">${FT.icon('download')} ${esc(t('mem.download'))}</a>
          ${ph.canManage ? `<button type="button" class="btn btn-ghost btn-small" data-caption>${FT.icon('edit')} ${esc(t('mem.caption'))}</button>
          <button type="button" class="btn btn-danger-ghost btn-small" data-del>${FT.icon('trash')}</button>` : ''}
        </div>
      </div>`);
      const on = (sel, fn) => { const x = s.body.querySelector(sel); if (x) x.addEventListener('click', fn); };
      on('[data-prev]', () => { i -= 1; paint(); });
      on('[data-next]', () => { i += 1; paint(); });
      on('[data-caption]', () => editCaption(ph, paint));
      on('[data-del]', async () => {
        if (!(await FT.confirm(t('mem.deletePhotoConfirm'), { danger: true, okLabel: t('common.delete') }))) return;
        try {
          await FT.api.send(`/api/albums/${albumId}/photos/${ph.id}`, 'DELETE');
          album.photos.splice(i, 1);
          paintAlbum();
          FT.loadAlbums().catch(() => {});
          paint();
        } catch (err) { FT.toastError(err); }
      });
    }
    let startX = null;
    s.body.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    s.body.addEventListener('touchend', (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) < 50) return;
      const n = i + (dx < 0 ? 1 : -1);
      if (n >= 0 && n < album.photos.length) { i = n; paint(); }
    });
    paint();
  }

  function editCaption(ph, after) {
    const s = FT.sheet({
      title: t('mem.caption'),
      cls: 'ov-dialog',
      body: `<label class="field"><span class="field-label">${esc(t('mem.captionPrompt'))}</span><textarea class="input" rows="3">${esc(ph.caption || '')}</textarea></label>`,
      foot: `<button type="button" class="btn btn-ghost" data-cancel>${esc(t('common.cancel'))}</button><button type="button" class="btn btn-primary" data-save>${esc(t('common.save'))}</button>`,
    });
    s.foot.querySelector('[data-cancel]').addEventListener('click', s.close);
    s.foot.querySelector('[data-save]').addEventListener('click', async () => {
      const caption = s.body.querySelector('textarea').value.trim();
      try {
        await FT.api.send(`/api/albums/${albumId}/photos/${ph.id}`, 'PATCH', { caption });
        ph.caption = caption || null;
        s.close();
        after();
      } catch (err) { FT.toastError(err); }
    });
  }
})();
