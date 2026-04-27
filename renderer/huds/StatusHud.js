class StatusHud extends HudBase {
  // ── IHud identity ────────────────────────────────────────────────────────────

  getType()           { return 'status'; }
  getBadge()          { return 'ST'; }
  getDisplayName(hud) { return hud.label || 'Statuses'; }

  getDefaults() {
    return {
      type: 'status', visible: true, label: 'Status',
      entries: [], sides: [{ corner: 'top-right', facing: 'up' }],
      fontSize: (typeof DEFAULT_HUD_FONT_SIZE !== 'undefined' ? DEFAULT_HUD_FONT_SIZE : 24),
      showLabels: false,
    };
  }

  // ── GM editor ────────────────────────────────────────────────────────────────

  mountEditor(ctx) {
    const { sceneState, api, scheduleAutosave, renderHudList, genId } = ctx;
    const getHud = () => sceneState.huds.find(h => h.id === sceneState.selectedHudId);

    document.getElementById('statuses-label')?.addEventListener('change', async () => {
      if (!sceneState.selectedHudId) return;
      const v = document.getElementById('statuses-label').value;
      const newHuds = await api.updateHud(sceneState.selectedHudId, { label: v });
      if (newHuds) { sceneState.huds = newHuds; renderHudList(); }
    });

    document.getElementById('statuses-font-size')?.addEventListener('change', async () => {
      if (!sceneState.selectedHudId) return;
      const v = parseInt(document.getElementById('statuses-font-size').value);
      if (isNaN(v) || v < 8 || v > 48) return;
      const newHuds = await api.updateHud(sceneState.selectedHudId, { fontSize: v });
      if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); }
    });

    document.getElementById('statuses-show-labels')?.addEventListener('change', async () => {
      if (!sceneState.selectedHudId) return;
      const checked = document.getElementById('statuses-show-labels').checked;
      const newHuds = await api.updateHud(sceneState.selectedHudId, { showLabels: checked });
      if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); }
    });

    document.getElementById('btn-add-status-entry')?.addEventListener('click', async () => {
      const hud = getHud();
      if (!hud) return;
      const newEntry = { id: genId(), name: '', hidden: false, invisible: true, statuses: [] };
      const newHuds  = await api.updateHud(hud.id, { entries: [...(hud.entries ?? []), newEntry] });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    });
  }

  renderEditor(hud, ctx) {
    const editor = document.getElementById('statuses-editor');
    if (!editor) return;
    editor.style.display = '';

    const labelEl = document.getElementById('statuses-label');
    if (labelEl) labelEl.value = hud.label ?? 'Status';

    const fontSizeEl = document.getElementById('statuses-font-size');
    if (fontSizeEl) fontSizeEl.value = hud.fontSize ?? (typeof DEFAULT_HUD_FONT_SIZE !== 'undefined' ? DEFAULT_HUD_FONT_SIZE : 24);

    const showLabelsEl = document.getElementById('statuses-show-labels');
    if (showLabelsEl) showLabelsEl.checked = hud.showLabels ?? false;

    const posEl = document.getElementById('statuses-positions');
    if (posEl) this.buildPositionsEditor(posEl, hud, '#4a90d9', ctx);

    this._renderEntries(hud, ctx);
  }

  _renderEntries(hud, ctx) {
    const { sceneState, api, scheduleAutosave } = ctx;
    const container = document.getElementById('statuses-entries');
    if (!container) return;
    container.innerHTML = '';

    if (!hud.entries || hud.entries.length === 0) {
      const empty = document.createElement('div');
      empty.className   = 'layer-empty';
      empty.textContent = 'No entries';
      container.appendChild(empty);
      return;
    }

    const updateEntry = async (h, idx, patch) => {
      const newEntries = h.entries.map((e, i) => i === idx ? { ...e, ...patch } : e);
      const newHuds    = await api.updateHud(h.id, { entries: newEntries });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const updated = sceneState.huds.find(x => x.id === h.id);
        if (updated) Object.assign(h, updated);
      }
    };

    const removeEntry = async (h, idx) => {
      const newEntries = h.entries.filter((_, i) => i !== idx);
      const newHuds    = await api.updateHud(h.id, { entries: newEntries });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(x => x.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    };

    hud.entries.forEach((entry, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'initiative-entry-wrap';

      const row = document.createElement('div');
      row.className = 'initiative-entry-row';

      const nameInput = document.createElement('input');
      nameInput.className   = 'init-entry-name';
      nameInput.value       = entry.name;
      nameInput.placeholder = 'Name…';
      nameInput.addEventListener('change', () => updateEntry(hud, idx, { name: nameInput.value }));

      const hiddenChk = document.createElement('input');
      hiddenChk.type    = 'checkbox'; hiddenChk.title = 'Show as ???';
      hiddenChk.checked = entry.hidden ?? false;
      hiddenChk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';
      hiddenChk.addEventListener('change', () => updateEntry(hud, idx, { hidden: hiddenChk.checked }));

      const invisibleChk = document.createElement('input');
      invisibleChk.type    = 'checkbox'; invisibleChk.title = 'Hide from players';
      invisibleChk.checked = entry.invisible ?? false;
      invisibleChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
      invisibleChk.addEventListener('change', () => updateEntry(hud, idx, { invisible: invisibleChk.checked }));

      const delBtn = document.createElement('button');
      delBtn.className   = 'btn-icon-xs danger'; delBtn.textContent = '×'; delBtn.title = 'Remove entry';
      delBtn.addEventListener('click', () => removeEntry(hud, idx));

      const visGroup = document.createElement('div');
      visGroup.className = 'init-vis-group';
      const lbl1 = document.createElement('span'); lbl1.className = 'init-vis-label'; lbl1.title = 'Lurking'; lbl1.textContent = '?';
      const lbl2 = document.createElement('span'); lbl2.className = 'init-vis-label'; lbl2.title = 'Invisible'; lbl2.textContent = '👁'; lbl2.style.fontSize = '10px';
      visGroup.appendChild(lbl1); visGroup.appendChild(hiddenChk);
      visGroup.appendChild(lbl2); visGroup.appendChild(invisibleChk);

      row.appendChild(nameInput); row.appendChild(visGroup); row.appendChild(delBtn);

      const statusRow = document.createElement('div');
      statusRow.className = 'init-extras-row';
      this.buildEntryStatusRow(statusRow, hud, idx, entry, updateEntry, (upd) => this._renderEntries(upd, ctx));

      wrap.appendChild(row); wrap.appendChild(statusRow);
      container.appendChild(wrap);
    });
  }

  // ── Player panel ─────────────────────────────────────────────────────────────

  buildPlayerPanel(hud) {
    const { panel } = this.buildPanelShell(hud.label ?? 'Status');
    panel.style.fontSize = (hud.fontSize ?? 14) + 'px';
    if (hud.showLabels) panel.classList.add('statuses-expanded');

    const body    = document.createElement('div');
    body.className = 'hud-body';
    const entries = (hud.entries ?? []).filter(e => !e.invisible);

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:0.8em;color:#3a3a5e;font-style:italic;padding:4px 0;';
      empty.textContent   = 'No entries';
      body.appendChild(empty);
    } else {
      for (const entry of entries) {
        const row = document.createElement('div');
        row.className = 'initiative-entry';

        const name = document.createElement('span');
        name.className   = 'initiative-name';
        name.textContent = entry.hidden ? '???' : (entry.name || '—');
        row.appendChild(name);

        const statusesEl = document.createElement('span');
        statusesEl.className = 'initiative-statuses';
        for (const s of (entry.statuses ?? [])) {
          const wrap = document.createElement('span');
          wrap.className = 'status-pip-wrap';
          const pip = document.createElement('span');
          pip.className        = 'status-pip';
          pip.style.background = s.color ?? '#888';
          const lbl = document.createElement('span');
          lbl.className   = 'status-pip-lbl';
          lbl.textContent = s.label ?? '';
          wrap.appendChild(pip); wrap.appendChild(lbl);
          statusesEl.appendChild(wrap);
        }
        row.appendChild(statusesEl);
        body.appendChild(row);
      }
    }

    panel.appendChild(body);
    return panel;
  }

  // ── GM simulation ─────────────────────────────────────────────────────────────

  estimateSimSize(hud) {
    const fontSize = hud.fontSize ?? 24;
    const entryH   = fontSize * 1.6 + 10;
    const entries  = (hud.entries ?? []).filter(e => !e.invisible).length;
    const bodyH    = Math.max(entries, 1) * entryH + 12;
    return { w: 280, h: 38 + bodyH };
  }

  buildSimBody(container, hud) {
    const entries = (hud.entries ?? []).filter(e => !e.invisible);
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className   = 'hud-sim-empty';
      empty.textContent = 'Empty';
      container.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'hud-sim-entry';

      const name = document.createElement('span');
      name.className   = 'hud-sim-name';
      name.textContent = entry.hidden ? '???' : (entry.name || '—');
      row.appendChild(name);

      const pips = document.createElement('span');
      pips.className = 'hud-sim-pips';
      for (const s of (entry.statuses ?? []).slice(0, 6)) {
        const pip = document.createElement('span');
        pip.className        = 'hud-sim-pip';
        pip.style.background = s.color ?? '#888';
        pips.appendChild(pip);
      }
      row.appendChild(pips);
      container.appendChild(row);
    }
  }
}
