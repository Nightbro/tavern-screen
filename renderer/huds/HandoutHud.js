import { HudBase } from './HudBase.js';

export class HandoutHud extends HudBase {
  // ── IHud identity ────────────────────────────────────────────────────────────

  getType()           { return 'handout'; }
  getBadge()          { return 'HO'; }
  getDisplayName(hud) { return hud.name || 'Handout'; }

  getDefaults() {
    return {
      type: 'handout', visible: true, name: 'Handout',
      src: null, width: 300,
      sides: [{ corner: 'top-left', facing: 'up' }],
    };
  }

  // ── Image helpers ─────────────────────────────────────────────────────────────

  getImages(hud) {
    if (hud.images?.length) return hud.images;
    if (hud.src) return [{ id: 'legacy', name: 'Image', src: hud.src }];
    return [];
  }

  getActiveSrc(hud) {
    const imgs = this.getImages(hud);
    return imgs[hud.activeImageIdx ?? 0]?.src ?? null;
  }

  // ── GM editor ────────────────────────────────────────────────────────────────

  mountEditor(ctx) {
    const { sceneState, api, scheduleAutosave, renderHudList, genId } = ctx;

    document.getElementById('handout-name')?.addEventListener('change', async () => {
      if (!sceneState.selectedHudId) return;
      const v = document.getElementById('handout-name').value;
      const newHuds = await api.updateHud(sceneState.selectedHudId, { name: v });
      if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); renderHudList(); }
    });

    document.getElementById('handout-width')?.addEventListener('change', async () => {
      if (!sceneState.selectedHudId) return;
      const v = parseInt(document.getElementById('handout-width').value) || 300;
      const newHuds = await api.updateHud(sceneState.selectedHudId, { width: v });
      if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); }
    });

    document.getElementById('btn-handout-add-images')?.addEventListener('click', async () => {
      if (!sceneState.selectedHudId) return;
      const paths = await api.openMapDialog();
      if (!paths?.length) return;
      const hud = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
      if (!hud) return;
      const existing  = this.getImages(hud);
      const newImages  = [
        ...existing,
        ...paths.map((src, i) => ({ id: genId(), name: `Image ${existing.length + i + 1}`, src })),
      ];
      const newHuds = await api.updateHud(sceneState.selectedHudId, { images: newImages });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    });
  }

  renderEditor(hud, ctx) {
    const editor = document.getElementById('handout-editor');
    if (!editor) return;
    editor.style.display = '';

    const nameEl = document.getElementById('handout-name');
    if (nameEl) nameEl.value = hud.name ?? '';

    const widthEl = document.getElementById('handout-width');
    if (widthEl) widthEl.value = hud.width ?? 300;

    this._renderImageCards(hud, ctx);

    const posEl = document.getElementById('handout-positions');
    if (posEl) this.buildPositionsEditor(posEl, hud, '#4caf7d', ctx);
  }

  _renderImageCards(hud, ctx) {
    const { sceneState, api, scheduleAutosave } = ctx;
    const el = document.getElementById('handout-image-cards');
    if (!el) return;
    el.innerHTML = '';

    const images    = this.getImages(hud);
    const activeIdx = hud.activeImageIdx ?? 0;

    if (images.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#3a3a5e;font-style:italic;padding:4px 0;';
      empty.textContent   = 'No images — click + Add';
      el.appendChild(empty);
      return;
    }

    images.forEach((img, idx) => {
      const card = document.createElement('div');
      card.className = 'handout-card' + (idx === activeIdx ? ' active' : '');
      card.title     = 'Click to show this image to players';

      const thumb = document.createElement('img');
      thumb.src       = img.src;
      thumb.className = 'handout-card-thumb';
      thumb.draggable = false;

      const label = document.createElement('div');
      label.className       = 'handout-card-label';
      label.textContent     = img.name || `Image ${idx + 1}`;
      label.contentEditable = 'true';
      label.spellcheck      = false;
      label.addEventListener('click', e => e.stopPropagation());
      label.addEventListener('blur', async () => {
        const newName  = label.textContent.trim() || `Image ${idx + 1}`;
        const fresh    = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (!fresh) return;
        const newImages = this.getImages(fresh).map((im, i) => i === idx ? { ...im, name: newName } : im);
        const newHuds   = await api.updateHud(sceneState.selectedHudId, { images: newImages });
        if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); }
      });

      const delBtn = document.createElement('button');
      delBtn.className   = 'handout-card-del';
      delBtn.textContent = '×'; delBtn.title = 'Remove image';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fresh    = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (!fresh) return;
        const newImages = this.getImages(fresh).filter((_, i) => i !== idx);
        const newActive = Math.min(activeIdx, Math.max(0, newImages.length - 1));
        const newHuds   = await api.updateHud(sceneState.selectedHudId, { images: newImages, activeImageIdx: newActive });
        if (newHuds) {
          sceneState.huds = newHuds; scheduleAutosave();
          const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
          if (upd) this.renderEditor(upd, ctx);
        }
      });

      card.appendChild(thumb); card.appendChild(label); card.appendChild(delBtn);
      card.addEventListener('click', async () => {
        if (idx === activeIdx) return;
        const newHuds = await api.updateHud(sceneState.selectedHudId, { activeImageIdx: idx });
        if (newHuds) {
          sceneState.huds = newHuds; scheduleAutosave();
          const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
          if (upd) this.renderEditor(upd, ctx);
        }
      });

      el.appendChild(card);
    });
  }

  // ── Player panel ─────────────────────────────────────────────────────────────

  buildPlayerPanel(hud) {
    const { panel } = this.buildPanelShell(hud.name ?? 'Handout', 'hud-handout-panel');
    if (hud.width) panel.style.width = hud.width + 'px';

    const body = document.createElement('div');
    body.className = 'hud-body hud-handout-body';

    const activeSrc = hud.images?.length
      ? (hud.images[hud.activeImageIdx ?? 0]?.src ?? null)
      : (hud.src ?? null);

    if (activeSrc) {
      const img = document.createElement('img');
      img.src       = activeSrc;
      img.className = 'hud-handout-img';
      body.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#3a3a5e;font-style:italic;padding:8px 0;text-align:center;';
      empty.textContent   = 'No image selected';
      body.appendChild(empty);
    }

    panel.appendChild(body);
    return panel;
  }

  // ── GM simulation ─────────────────────────────────────────────────────────────

  estimateSimSize(hud) {
    const w    = hud.width ?? 300;
    const src  = this.getActiveSrc(hud);
    const imgH = src ? Math.round(w * 0.56) : 32;
    return { w, h: 38 + imgH };
  }

  buildSimBody(container, hud) {
    const src = this.getActiveSrc(hud);
    if (src) {
      const img = document.createElement('img');
      img.src   = src;
      img.style.cssText = 'width:100%;display:block;border-radius:0 0 7px 7px;';
      container.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.className   = 'hud-sim-empty';
      empty.textContent = 'No image';
      container.appendChild(empty);
    }
  }
}
