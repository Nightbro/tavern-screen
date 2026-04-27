import { HudBase } from './HudBase.js';
import { DEFAULT_HUD_FONT_SIZE } from './settings-huds.js';

export class InitiativeHud extends HudBase {
  // ── IHud identity ────────────────────────────────────────────────────────────

  getType()           { return 'initiative'; }
  getBadge()          { return 'IN'; }
  getDisplayName(hud) { return 'Initiative'; }

  getDefaults() {
    return {
      type: 'initiative', visible: true, combat: false,
      currentIndex: 0, entries: [],
      sides: [{ corner: 'top-left', facing: 'up' }],
      fontSize: DEFAULT_HUD_FONT_SIZE,
    };
  }

  // ── GM editor ────────────────────────────────────────────────────────────────

  // Called once at page load.
  mountEditor(ctx) {
    const { sceneState, api, scheduleAutosave, renderHudList, renderHudPreview, genId } = ctx;

    const getHud = () => sceneState.huds.find(h => h.id === sceneState.selectedHudId);

    document.getElementById('initiative-font-size')?.addEventListener('change', async () => {
      if (!sceneState.selectedHudId) return;
      const v = parseInt(document.getElementById('initiative-font-size').value);
      if (isNaN(v) || v < 8 || v > 48) return;
      const newHuds = await api.updateHud(sceneState.selectedHudId, { fontSize: v });
      if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); }
    });

    document.getElementById('initiative-show-labels')?.addEventListener('change', async () => {
      if (!sceneState.selectedHudId) return;
      const checked = document.getElementById('initiative-show-labels').checked;
      const newHuds = await api.updateHud(sceneState.selectedHudId, { showLabels: checked });
      if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); }
    });

    document.getElementById('btn-add-preset')?.addEventListener('click', () => {
      const nameEl  = document.getElementById('new-preset-name');
      const colorEl = document.getElementById('new-preset-color');
      const name    = nameEl?.value.trim();
      if (!name) return;
      const list = HudBase.getCustomPresets();
      list.push({ name, color: colorEl?.value ?? '#888' });
      HudBase.saveCustomPresets(list);
      if (nameEl) nameEl.value = '';
      this._renderCustomPresetsPanel();
    });

    document.getElementById('btn-combat-toggle')?.addEventListener('click', async () => {
      const hud = getHud();
      if (!hud) return;
      const inCombat = !(hud.combat ?? false);
      const newHuds = await api.updateHud(hud.id, { combat: inCombat, currentIndex: 0 });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    });

    document.getElementById('btn-combat-next')?.addEventListener('click', async () => {
      const hud = getHud();
      if (!hud || !hud.entries.length) return;
      const next = ((hud.currentIndex ?? 0) + 1) % hud.entries.length;
      const newHuds = await api.updateHud(hud.id, { currentIndex: next });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    });

    document.getElementById('btn-combat-prev')?.addEventListener('click', async () => {
      const hud = getHud();
      if (!hud || !hud.entries.length) return;
      const prev = ((hud.currentIndex ?? 0) - 1 + hud.entries.length) % hud.entries.length;
      const newHuds = await api.updateHud(hud.id, { currentIndex: prev });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    });

    document.getElementById('btn-add-entry')?.addEventListener('click', async () => {
      const hud = getHud();
      if (!hud) return;
      const newEntry = { id: genId(), name: '', initiative: 0, hidden: false, invisible: true, statuses: [] };
      const newHuds  = await api.updateHud(hud.id, { entries: [...(hud.entries ?? []), newEntry] });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    });

    document.getElementById('btn-sort-initiative')?.addEventListener('click', async () => {
      const hud = getHud();
      if (!hud || !hud.entries?.length) return;
      const activeEntry = hud.entries[hud.currentIndex ?? 0];
      const sorted = [...hud.entries].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
      const newIdx = activeEntry ? sorted.findIndex(e => e.id === activeEntry.id) : 0;
      const newHuds = await api.updateHud(hud.id, {
        entries: sorted,
        currentIndex: newIdx >= 0 ? newIdx : 0,
      });
      if (newHuds) {
        sceneState.huds = newHuds; scheduleAutosave();
        const upd = sceneState.huds.find(h => h.id === sceneState.selectedHudId);
        if (upd) this.renderEditor(upd, ctx);
      }
    });
  }

  // Called when this HUD is selected — populates the existing editor DOM.
  renderEditor(hud, ctx) {
    const editor = document.getElementById('initiative-editor');
    if (!editor) return;
    editor.style.display = '';

    const inCombat       = hud.combat ?? false;
    const btnToggle      = document.getElementById('btn-combat-toggle');
    const btnPrev        = document.getElementById('btn-combat-prev');
    const btnNext        = document.getElementById('btn-combat-next');
    if (btnToggle) btnToggle.textContent = inCombat ? '■ Stop' : '▶ Start';
    if (btnPrev)   btnPrev.disabled  = !inCombat;
    if (btnNext)   btnNext.disabled  = !inCombat;

    const posEl = document.getElementById('initiative-positions');
    if (posEl) this.buildPositionsEditor(posEl, hud, '#c9a84c', ctx);

    const fontSizeEl  = document.getElementById('initiative-font-size');
    if (fontSizeEl) fontSizeEl.value = hud.fontSize ?? DEFAULT_HUD_FONT_SIZE;

    const showLabelsEl = document.getElementById('initiative-show-labels');
    if (showLabelsEl) showLabelsEl.checked = hud.showLabels ?? false;

    this._renderCustomPresetsPanel();
    this._renderEntries(hud, ctx);
  }

  _renderCustomPresetsPanel() {
    const el = document.getElementById('initiative-custom-presets');
    if (!el) return;
    el.innerHTML = '';
    for (const [i, p] of HudBase.getCustomPresets().entries()) {
      const chip = document.createElement('span');
      chip.className = 'preset-chip';

      const dot = document.createElement('span');
      dot.className    = 'preset-chip-dot';
      dot.style.background = p.color;

      const lbl = document.createElement('span');
      lbl.textContent = p.name;

      const del = document.createElement('button');
      del.className   = 'init-status-del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        const list = HudBase.getCustomPresets();
        list.splice(i, 1);
        HudBase.saveCustomPresets(list);
        this._renderCustomPresetsPanel();
      });

      chip.appendChild(dot); chip.appendChild(lbl); chip.appendChild(del);
      el.appendChild(chip);
    }
  }

  _renderEntries(hud, ctx) {
    const { sceneState, api, scheduleAutosave } = ctx;
    const container = document.getElementById('initiative-entries');
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

      // ── Main row ────────────────────────────────────────────────────────────
      const row = document.createElement('div');
      row.className = 'initiative-entry-row';

      const turnInd = document.createElement('span');
      turnInd.className   = 'init-entry-active';
      turnInd.textContent = (hud.combat && idx === hud.currentIndex) ? '▶' : '';

      const nameInput = document.createElement('input');
      nameInput.className   = 'init-entry-name';
      nameInput.value       = entry.name;
      nameInput.placeholder = 'Name…';
      nameInput.addEventListener('change', () => updateEntry(hud, idx, { name: nameInput.value }));

      const rollInput = document.createElement('input');
      rollInput.className = 'init-entry-roll';
      rollInput.type      = 'number';
      rollInput.value     = entry.initiative ?? '';
      rollInput.placeholder = '—';
      rollInput.addEventListener('change', () =>
        updateEntry(hud, idx, { initiative: parseInt(rollInput.value) || 0 })
      );

      const hiddenChk = document.createElement('input');
      hiddenChk.type    = 'checkbox';
      hiddenChk.title   = 'Lurking – shows as ??? in player list';
      hiddenChk.checked = entry.hidden ?? false;
      hiddenChk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';
      hiddenChk.addEventListener('change', () => updateEntry(hud, idx, { hidden: hiddenChk.checked }));

      const invisibleChk = document.createElement('input');
      invisibleChk.type    = 'checkbox';
      invisibleChk.title   = 'Invisible – not shown in player list at all';
      invisibleChk.checked = entry.invisible ?? false;
      invisibleChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
      invisibleChk.addEventListener('change', () => updateEntry(hud, idx, { invisible: invisibleChk.checked }));

      const delBtn = document.createElement('button');
      delBtn.className   = 'btn-icon-xs danger';
      delBtn.textContent = '×';
      delBtn.title       = 'Remove entry';
      delBtn.addEventListener('click', () => removeEntry(hud, idx));

      const visGroup = document.createElement('div');
      visGroup.className = 'init-vis-group';
      const lbl1 = document.createElement('span');
      lbl1.className = 'init-vis-label'; lbl1.title = 'Lurking – shows as ???'; lbl1.textContent = '?';
      const lbl2 = document.createElement('span');
      lbl2.className = 'init-vis-label'; lbl2.title = 'Invisible – not shown to players';
      lbl2.textContent = '👁'; lbl2.style.fontSize = '10px';
      visGroup.appendChild(lbl1); visGroup.appendChild(hiddenChk);
      visGroup.appendChild(lbl2); visGroup.appendChild(invisibleChk);

      row.appendChild(turnInd); row.appendChild(nameInput); row.appendChild(rollInput);
      row.appendChild(visGroup); row.appendChild(delBtn);

      // ── Status row ──────────────────────────────────────────────────────────
      const statusRow = document.createElement('div');
      statusRow.className = 'init-extras-row';
      this.buildEntryStatusRow(statusRow, hud, idx, entry, updateEntry, (upd) => this._renderEntries(upd, ctx));

      // ── HP row ──────────────────────────────────────────────────────────────
      const hpRow = document.createElement('div');
      hpRow.className = 'init-extras-row';
      this._buildHpRow(hpRow, hud, idx, entry, updateEntry, ctx);

      wrap.appendChild(row); wrap.appendChild(statusRow); wrap.appendChild(hpRow);
      container.appendChild(wrap);
    });
  }

  _buildHpRow(container, hud, idx, entry, updateEntry, ctx) {
    const { sceneState } = ctx;
    container.innerHTML = '';

    const lbl = document.createElement('span');
    lbl.className = 'init-hp-label'; lbl.textContent = 'HP';

    const maxIn = document.createElement('input');
    maxIn.type = 'number'; maxIn.min = 0;
    maxIn.className   = 'init-hp-input';
    maxIn.value       = entry.hp ?? '';
    maxIn.placeholder = 'max'; maxIn.title = 'Max HP';
    maxIn.addEventListener('change', async () => {
      const v = parseInt(maxIn.value) || 0;
      await updateEntry(hud, idx, { hp: v });
      const updated = sceneState.huds.find(h => h.id === hud.id);
      if (updated) this._renderEntries(updated, ctx);
    });

    const hpMaxHiddenChk = document.createElement('input');
    hpMaxHiddenChk.type    = 'checkbox';
    hpMaxHiddenChk.checked = entry.hpMaxHidden ?? false;
    hpMaxHiddenChk.title   = 'Hide max HP from players (show current/???)';
    hpMaxHiddenChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
    hpMaxHiddenChk.addEventListener('change', () => updateEntry(hud, idx, { hpMaxHidden: hpMaxHiddenChk.checked }));

    const sep1 = document.createElement('span');
    sep1.className = 'init-hp-sep'; sep1.textContent = 'dmg';

    const dmgIn = document.createElement('input');
    dmgIn.type = 'number'; dmgIn.min = 0;
    dmgIn.className = 'init-hp-input';
    dmgIn.value     = entry.damage ?? 0;
    dmgIn.title     = 'Total damage dealt (editable)';
    dmgIn.addEventListener('change', async () => {
      const v = Math.max(0, parseInt(dmgIn.value) || 0);
      await updateEntry(hud, idx, { damage: v });
    });

    const sep2 = document.createElement('span');
    sep2.className = 'init-hp-sep'; sep2.textContent = '|';

    const dealIn = document.createElement('input');
    dealIn.type = 'number'; dealIn.min = 0;
    dealIn.className   = 'init-hp-input';
    dealIn.placeholder = '+dmg'; dealIn.title = 'New damage to deal';

    const applyBtn = document.createElement('button');
    applyBtn.className   = 'btn-apply-dmg';
    applyBtn.textContent = '↯'; applyBtn.title = 'Apply damage';
    applyBtn.addEventListener('click', async () => {
      const newDmg = parseInt(dealIn.value) || 0;
      if (!newDmg) return;
      const total = (entry.damage ?? 0) + newDmg;
      dealIn.value = '';
      await updateEntry(hud, idx, { damage: total });
      const updated = sceneState.huds.find(h => h.id === hud.id);
      if (updated) this._renderEntries(updated, ctx);
    });

    const curHpEl = document.createElement('span');
    curHpEl.className = 'init-hp-current';
    if (entry.hp > 0) {
      const cur = Math.max(0, entry.hp - (entry.damage ?? 0));
      curHpEl.textContent = `= ${cur}/${entry.hp}`;
    }

    container.appendChild(lbl); container.appendChild(maxIn);
    container.appendChild(hpMaxHiddenChk); container.appendChild(sep1);
    container.appendChild(dmgIn); container.appendChild(sep2);
    container.appendChild(dealIn); container.appendChild(applyBtn);
    container.appendChild(curHpEl);
  }

  // ── Player panel ─────────────────────────────────────────────────────────────

  buildPlayerPanel(hud) {
    const { panel } = this.buildPanelShell('Initiative');
    panel.style.fontSize = (hud.fontSize ?? 14) + 'px';
    if (hud.showLabels) panel.classList.add('statuses-expanded');

    const body = document.createElement('div');
    body.className = 'hud-body';

    const entries = hud.entries ?? [];
    entries.forEach((entry, i) => {
      if (entry.invisible) return;

      const isActive = hud.combat && i === (hud.currentIndex ?? 0);
      const row = document.createElement('div');
      row.className = 'initiative-entry' + (isActive ? ' active-turn' : '');

      const badge = document.createElement('span');
      badge.className   = 'initiative-badge';
      badge.textContent = entry.initiative ?? '';

      const name = document.createElement('span');
      name.className   = 'initiative-name';
      name.textContent = entry.hidden ? '???' : (entry.name || '—');

      row.appendChild(badge); row.appendChild(name);

      const damage = entry.damage ?? 0;
      if (entry.hp > 0 || damage > 0) {
        const hpEl = document.createElement('span');
        hpEl.className = 'initiative-hp';
        if (entry.hidden) {
          hpEl.textContent = `${damage}/???`;
        } else if (entry.hp > 0) {
          const cur = Math.max(0, entry.hp - damage);
          hpEl.textContent = entry.hpMaxHidden ? `${damage}/???` : `${cur}/${entry.hp}`;
        } else {
          hpEl.textContent = `${damage}/???`;
        }
        row.appendChild(hpEl);
      }

      const statuses = document.createElement('span');
      statuses.className = 'initiative-statuses';
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
        statuses.appendChild(wrap);
      }
      row.appendChild(statuses);
      body.appendChild(row);
    });

    if (entries.filter(e => !e.invisible).length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:0.8em;color:#3a3a5e;font-style:italic;padding:4px 0;';
      empty.textContent   = 'No entries';
      body.appendChild(empty);
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

      const roll = document.createElement('span');
      roll.className   = 'hud-sim-roll';
      roll.textContent = entry.initiative ?? '—';
      row.appendChild(roll);

      const name = document.createElement('span');
      name.className   = 'hud-sim-name';
      name.textContent = entry.hidden ? '???' : (entry.name || '—');
      row.appendChild(name);

      const pips = document.createElement('span');
      pips.className = 'hud-sim-pips';
      for (const s of (entry.statuses ?? []).slice(0, 6)) {
        const pip = document.createElement('span');
        pip.className    = 'hud-sim-pip';
        pip.style.background = s.color ?? '#888';
        pips.appendChild(pip);
      }
      row.appendChild(pips);
      container.appendChild(row);
    }
  }
}
