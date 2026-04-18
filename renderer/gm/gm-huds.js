// ════════════════════════════════════════════════════════════════════════════
// HUD MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

function renderHudList() {
  hudListEl.innerHTML = '';
  if (huds.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No HUDs';
    hudListEl.appendChild(empty);
    renderHudPreview();
    return;
  }
  for (const hud of huds) {
    hudListEl.appendChild(buildHudRow(hud));
  }
  renderHudPreview();
}

function buildHudRow(hud) {
  const row = document.createElement('div');
  row.className = 'layer-row' + (hud.id === selectedHudId ? ' active' : '');
  row.dataset.hudId = hud.id;

  const eye = document.createElement('button');
  eye.className = 'btn-icon-xs';
  eye.textContent = hud.visible !== false ? '●' : '○';
  eye.title = hud.visible !== false ? 'Hide' : 'Show';
  eye.addEventListener('click', async (e) => {
    e.stopPropagation();
    const newHuds = await window.electronAPI.updateHud(hud.id, { visible: !(hud.visible !== false) });
    if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudList(); }
  });

  const badge = document.createElement('span');
  badge.className = 'layer-type-badge';
  badge.textContent = hud.type === 'status' ? 'ST' : hud.type === 'handout' ? 'HO' : 'IN';

  const name = document.createElement('span');
  name.className = 'layer-name';
  name.textContent = hud.type === 'status' ? (hud.label || 'Statuses') : hud.type === 'handout' ? (hud.name || 'Handout') : 'Initiative';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon-xs danger';
  delBtn.textContent = '×';
  delBtn.title = 'Remove HUD';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (selectedHudId === hud.id) { selectedHudId = null; initiativeEditor.style.display = 'none'; }
    const newHuds = await window.electronAPI.removeHud(hud.id);
    if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudList(); }
  });

  row.appendChild(eye);
  row.appendChild(badge);
  row.appendChild(name);
  row.appendChild(delBtn);
  row.addEventListener('click', () => selectHud(hud.id));
  return row;
}

function applyHudSelection(id) {
  selectedHudId = id ?? null;
  renderHudList();
  const hud = selectedHudId ? huds.find(h => h.id === selectedHudId) : null;
  initiativeEditor.style.display = 'none';
  if (statusesEditor) statusesEditor.style.display = 'none';
  if (handoutEditor)  handoutEditor.style.display  = 'none';
  if (hud?.type === 'initiative') renderInitiativeEditor(hud);
  else if (hud?.type === 'status')  renderStatusesEditor(hud);
  else if (hud?.type === 'handout') renderHandoutEditor(hud);
}

function selectHud(id) {
  applyHudSelection(id === selectedHudId ? null : id);
}

btnAddInitiative.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud({
    type: 'initiative', visible: true, combat: false, currentIndex: 0, entries: [],
    sides: [{ corner: 'top-left', facing: 'up' }], fontSize: DEFAULT_HUD_FONT_SIZE,
  });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

btnAddStatusHud?.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud({
    type: 'status', visible: true, label: 'Status',
    entries: [], sides: [{ corner: 'top-right', facing: 'up' }],
    fontSize: DEFAULT_HUD_FONT_SIZE, showLabels: false,
  });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

btnAddHandout?.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud({
    type: 'handout', visible: true, name: 'Handout',
    src: null, width: 300, sides: [{ corner: 'top-left', facing: 'up' }],
  });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

document.getElementById('initiative-font-size')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = parseInt(document.getElementById('initiative-font-size').value);
  if (isNaN(v) || v < 8 || v > 48) return;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { fontSize: v });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); }
});

// ════════════════════════════════════════════════════════════════════════════
// STATUS PRESETS
// ════════════════════════════════════════════════════════════════════════════

// PF1E_CONDITIONS is defined in settings.js (loaded before this file)

function getCustomPresets() {
  try { return JSON.parse(localStorage.getItem('customStatusPresets') ?? '[]'); }
  catch { return []; }
}
function saveCustomPresets(presets) {
  localStorage.setItem('customStatusPresets', JSON.stringify(presets));
}

function renderCustomPresetsPanel() {
  const el = document.getElementById('initiative-custom-presets');
  if (!el) return;
  el.innerHTML = '';
  for (const [i, p] of getCustomPresets().entries()) {
    const chip = document.createElement('span');
    chip.className = 'preset-chip';

    const dot = document.createElement('span');
    dot.className = 'preset-chip-dot';
    dot.style.background = p.color;

    const lbl = document.createElement('span');
    lbl.textContent = p.name;

    const del = document.createElement('button');
    del.className = 'init-status-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      const list = getCustomPresets();
      list.splice(i, 1);
      saveCustomPresets(list);
      renderCustomPresetsPanel();
    });

    chip.appendChild(dot);
    chip.appendChild(lbl);
    chip.appendChild(del);
    el.appendChild(chip);
  }
}

document.getElementById('btn-add-preset')?.addEventListener('click', () => {
  const nameEl  = document.getElementById('new-preset-name');
  const colorEl = document.getElementById('new-preset-color');
  const name = nameEl?.value.trim();
  if (!name) return;
  const list = getCustomPresets();
  list.push({ name, color: colorEl?.value ?? '#888' });
  saveCustomPresets(list);
  if (nameEl) nameEl.value = '';
  renderCustomPresetsPanel();
});

// ════════════════════════════════════════════════════════════════════════════
// INITIATIVE TRACKER EDITOR
// ════════════════════════════════════════════════════════════════════════════

const CORNERS = [
  { id: 'top-left',     label: 'Top Left' },
  { id: 'top-right',    label: 'Top Right' },
  { id: 'bottom-left',  label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

function normalizeSides(hud) {
  if (hud.sides?.length) return hud.sides;
  return [{ corner: hud.side ?? 'top-left', facing: 'up' }];
}

function renderInitiativePositions(hud) {
  const posEl = document.getElementById('initiative-positions');
  if (!posEl) return;
  posEl.innerHTML = '';
  const sides = normalizeSides(hud);

  const getSides = () => {
    const current = normalizeSides(huds.find(h => h.id === selectedHudId) ?? hud);
    return CORNERS
      .map(({ id: corner }) => {
        const row = posEl.querySelector(`[data-corner="${corner}"]`);
        if (!row) return null;
        const chk = row.querySelector('input[type="checkbox"]');
        const sel = row.querySelector('select');
        if (!chk?.checked) return null;
        const existing = current.find(s => s.corner === corner);
        return { corner, facing: sel?.value ?? 'up', x: existing?.x, y: existing?.y };
      })
      .filter(Boolean);
  };

  for (const { id: corner, label } of CORNERS) {
    const existing = sides.find(s => s.corner === corner);

    const row = document.createElement('div');
    row.dataset.corner = corner;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!existing;
    chk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';

    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'flex:1;font-size:11px;color:#aaa;';

    const facingSelect = document.createElement('select');
    facingSelect.className = 'field-select';
    facingSelect.disabled = !existing;
    for (const [val, text] of [['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      facingSelect.appendChild(opt);
    }
    facingSelect.value = existing?.facing ?? 'up';

    const save = async () => {
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { sides: getSides() });
      if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudPreview(); }
    };

    chk.addEventListener('change', () => { facingSelect.disabled = !chk.checked; save(); });
    facingSelect.addEventListener('change', save);

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(facingSelect);
    posEl.appendChild(row);
  }
}

function renderInitiativeEditor(hud) {
  initiativeEditor.style.display = '';
  const inCombat = hud.combat ?? false;
  btnCombatToggle.textContent = inCombat ? '■ Stop' : '▶ Start';
  btnCombatPrev.disabled = !inCombat;
  btnCombatNext.disabled = !inCombat;
  renderInitiativePositions(hud);
  const fontSizeEl = document.getElementById('initiative-font-size');
  if (fontSizeEl) fontSizeEl.value = hud.fontSize ?? DEFAULT_HUD_FONT_SIZE;
  const showLabelsEl = document.getElementById('initiative-show-labels');
  if (showLabelsEl) showLabelsEl.checked = hud.showLabels ?? false;
  renderCustomPresetsPanel();
  renderInitiativeEntries(hud);
}

document.getElementById('initiative-show-labels')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const checked = document.getElementById('initiative-show-labels').checked;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { showLabels: checked });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); }
});

function renderInitiativeEntries(hud) {
  initiativeEntriesEl.innerHTML = '';
  if (!hud.entries || hud.entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No entries';
    initiativeEntriesEl.appendChild(empty);
    return;
  }
  hud.entries.forEach((entry, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'initiative-entry-wrap';

    // ── Main row ─────────────────────────────────────────────────────────────
    const row = document.createElement('div');
    row.className = 'initiative-entry-row';

    const turnInd = document.createElement('span');
    turnInd.className = 'init-entry-active';
    turnInd.textContent = (hud.combat && idx === hud.currentIndex) ? '▶' : '';

    const nameInput = document.createElement('input');
    nameInput.className = 'init-entry-name';
    nameInput.value = entry.name;
    nameInput.placeholder = 'Name…';
    nameInput.addEventListener('change', () => updateEntryField(hud, idx, { name: nameInput.value }));

    const rollInput = document.createElement('input');
    rollInput.className = 'init-entry-roll';
    rollInput.type = 'number';
    rollInput.value = entry.initiative ?? '';
    rollInput.placeholder = '—';
    rollInput.addEventListener('change', () =>
      updateEntryField(hud, idx, { initiative: parseInt(rollInput.value) || 0 })
    );

    const hiddenChk = document.createElement('input');
    hiddenChk.type = 'checkbox';
    hiddenChk.title = 'Lurking – shows as ??? in player list';
    hiddenChk.checked = entry.hidden ?? false;
    hiddenChk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';
    hiddenChk.addEventListener('change', () => updateEntryField(hud, idx, { hidden: hiddenChk.checked }));

    const invisibleChk = document.createElement('input');
    invisibleChk.type = 'checkbox';
    invisibleChk.title = 'Invisible – not shown in player list at all';
    invisibleChk.checked = entry.invisible ?? false;
    invisibleChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
    invisibleChk.addEventListener('change', () => updateEntryField(hud, idx, { invisible: invisibleChk.checked }));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon-xs danger';
    delBtn.textContent = '×';
    delBtn.title = 'Remove entry';
    delBtn.addEventListener('click', () => removeEntry(hud, idx));

    const visGroup = document.createElement('div');
    visGroup.className = 'init-vis-group';

    const lbl1 = document.createElement('span');
    lbl1.className = 'init-vis-label';
    lbl1.title = 'Lurking – shows as ???';
    lbl1.textContent = '?';

    const lbl2 = document.createElement('span');
    lbl2.className = 'init-vis-label';
    lbl2.title = 'Invisible – not shown to players';
    lbl2.textContent = '👁';
    lbl2.style.fontSize = '10px';

    visGroup.appendChild(lbl1);
    visGroup.appendChild(hiddenChk);
    visGroup.appendChild(lbl2);
    visGroup.appendChild(invisibleChk);

    row.appendChild(turnInd);
    row.appendChild(nameInput);
    row.appendChild(rollInput);
    row.appendChild(visGroup);
    row.appendChild(delBtn);

    // ── Status row ────────────────────────────────────────────────────────────
    const statusRow = document.createElement('div');
    statusRow.className = 'init-extras-row';
    buildEntryStatusRow(statusRow, hud, idx, entry);

    // ── HP row ────────────────────────────────────────────────────────────────
    const hpRow = document.createElement('div');
    hpRow.className = 'init-extras-row';
    buildEntryHpRow(hpRow, hud, idx, entry);

    wrap.appendChild(row);
    wrap.appendChild(statusRow);
    wrap.appendChild(hpRow);
    initiativeEntriesEl.appendChild(wrap);
  });
}

function buildEntryStatusRow(container, hud, idx, entry, updateFn, refreshFn) {
  updateFn  = updateFn  ?? updateEntryField;
  refreshFn = refreshFn ?? ((upd) => renderInitiativeEntries(upd));
  container.innerHTML = '';
  const statuses = entry.statuses ?? [];

  // ── Active status chips (with × remove) ──────────────────────────────────
  const chipsRow = document.createElement('div');
  chipsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';

  statuses.forEach((s, si) => {
    const chip = document.createElement('span');
    chip.className = 'init-status-chip';

    const dot = document.createElement('span');
    dot.className = 'init-status-dot';
    dot.style.background = s.color ?? '#888';

    const lbl = document.createElement('span');
    lbl.className = 'init-status-lbl';
    lbl.textContent = s.label ?? '';

    const del = document.createElement('button');
    del.className = 'init-status-del';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      await updateFn(hud, idx, { statuses: statuses.filter((_, i) => i !== si) });
      const updated = huds.find(h => h.id === hud.id);
      if (updated) refreshFn(updated);
    });

    chip.appendChild(dot); chip.appendChild(lbl); chip.appendChild(del);
    chipsRow.appendChild(chip);
  });

  container.appendChild(chipsRow);

  // ── Toggle preset picker ──────────────────────────────────────────────────
  let pickerOpen = false;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn-icon-xs';
  toggleBtn.textContent = '+ status';
  toggleBtn.style.fontSize = '9px';

  const picker = document.createElement('div');
  picker.className = 'status-preset-picker';
  picker.style.display = 'none';

  // Quick-add helper
  const quickAdd = async (name, color) => {
    await updateFn(hud, idx, { statuses: [...statuses, { color, label: name }] });
    const updated = huds.find(h => h.id === hud.id);
    if (updated) refreshFn(updated);
  };

  // PF1e section
  const pf1eTitle = document.createElement('div');
  pf1eTitle.className = 'preset-section-title';
  pf1eTitle.textContent = 'Pathfinder 1e';
  picker.appendChild(pf1eTitle);

  const pf1eGrid = document.createElement('div');
  pf1eGrid.className = 'preset-grid';
  for (const { name, color } of PF1E_CONDITIONS) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.title = name;

    const dot = document.createElement('span');
    dot.className = 'preset-btn-dot';
    dot.style.background = color;

    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(name));
    btn.addEventListener('click', () => quickAdd(name, color));
    pf1eGrid.appendChild(btn);
  }
  picker.appendChild(pf1eGrid);

  // Custom presets section
  const customTitle = document.createElement('div');
  customTitle.className = 'preset-section-title';
  customTitle.textContent = 'Saved Presets';
  picker.appendChild(customTitle);

  const customGrid = document.createElement('div');
  customGrid.className = 'preset-grid';
  for (const { name, color } of getCustomPresets()) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.title = name;

    const dot = document.createElement('span');
    dot.className = 'preset-btn-dot';
    dot.style.background = color;

    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(name));
    btn.addEventListener('click', () => quickAdd(name, color));
    customGrid.appendChild(btn);
  }
  if (customGrid.childElementCount === 0) {
    const none = document.createElement('span');
    none.style.cssText = 'font-size:10px;color:#3a3a5e;font-style:italic;';
    none.textContent = 'No custom presets yet';
    customGrid.appendChild(none);
  }
  picker.appendChild(customGrid);

  // Manual custom entry
  const manualRow = document.createElement('div');
  manualRow.className = 'init-status-form';
  manualRow.style.marginTop = '4px';

  const colorIn = document.createElement('input');
  colorIn.type = 'color'; colorIn.value = '#c9a84c';
  colorIn.className = 'init-status-color-pick';

  const labelIn = document.createElement('input');
  labelIn.className = 'init-entry-name';
  labelIn.placeholder = 'Custom label…';
  labelIn.style.cssText = 'flex:1;font-size:10px;min-width:0;';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn-icon-xs';
  confirmBtn.textContent = '✓';
  confirmBtn.addEventListener('click', () => {
    const n = labelIn.value.trim();
    if (n) quickAdd(n, colorIn.value);
  });

  manualRow.appendChild(colorIn);
  manualRow.appendChild(labelIn);
  manualRow.appendChild(confirmBtn);
  picker.appendChild(manualRow);

  toggleBtn.addEventListener('click', () => {
    pickerOpen = !pickerOpen;
    picker.style.display = pickerOpen ? '' : 'none';
    toggleBtn.textContent = pickerOpen ? '− status' : '+ status';
  });

  container.appendChild(toggleBtn);
  container.appendChild(picker);
}

function buildEntryHpRow(container, hud, idx, entry) {
  container.innerHTML = '';

  const lbl = document.createElement('span');
  lbl.className = 'init-hp-label';
  lbl.textContent = 'HP';

  const maxIn = document.createElement('input');
  maxIn.type = 'number'; maxIn.min = 0;
  maxIn.className = 'init-hp-input';
  maxIn.value = entry.hp ?? '';
  maxIn.placeholder = 'max';
  maxIn.title = 'Max HP';
  maxIn.addEventListener('change', async () => {
    const v = parseInt(maxIn.value) || 0;
    await updateEntryField(hud, idx, { hp: v });
    const updated = huds.find(h => h.id === hud.id);
    if (updated) renderInitiativeEntries(updated);
  });

  const hpMaxHiddenChk = document.createElement('input');
  hpMaxHiddenChk.type = 'checkbox';
  hpMaxHiddenChk.checked = entry.hpMaxHidden ?? false;
  hpMaxHiddenChk.title = 'Hide max HP from players (show current/???)';
  hpMaxHiddenChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
  hpMaxHiddenChk.addEventListener('change', () => updateEntryField(hud, idx, { hpMaxHidden: hpMaxHiddenChk.checked }));

  const sep1 = document.createElement('span');
  sep1.className = 'init-hp-sep';
  sep1.textContent = 'dmg';

  const dmgIn = document.createElement('input');
  dmgIn.type = 'number'; dmgIn.min = 0;
  dmgIn.className = 'init-hp-input';
  dmgIn.value = entry.damage ?? 0;
  dmgIn.title = 'Total damage dealt (editable)';
  dmgIn.addEventListener('change', async () => {
    const v = Math.max(0, parseInt(dmgIn.value) || 0);
    await updateEntryField(hud, idx, { damage: v });
  });

  const sep2 = document.createElement('span');
  sep2.className = 'init-hp-sep';
  sep2.textContent = '|';

  const dealIn = document.createElement('input');
  dealIn.type = 'number'; dealIn.min = 0;
  dealIn.className = 'init-hp-input';
  dealIn.placeholder = '+dmg';
  dealIn.title = 'New damage to deal';

  const applyBtn = document.createElement('button');
  applyBtn.className = 'btn-apply-dmg';
  applyBtn.textContent = '↯';
  applyBtn.title = 'Apply damage';
  applyBtn.addEventListener('click', async () => {
    const newDmg = parseInt(dealIn.value) || 0;
    if (!newDmg) return;
    const total = (entry.damage ?? 0) + newDmg;
    dealIn.value = '';
    await updateEntryField(hud, idx, { damage: total });
    const updated = huds.find(h => h.id === hud.id);
    if (updated) renderInitiativeEntries(updated);
  });

  // Current HP display
  const curHpEl = document.createElement('span');
  curHpEl.className = 'init-hp-current';
  if (entry.hp > 0) {
    const cur = Math.max(0, entry.hp - (entry.damage ?? 0));
    curHpEl.textContent = `= ${cur}/${entry.hp}`;
  }

  container.appendChild(lbl);
  container.appendChild(maxIn);
  container.appendChild(hpMaxHiddenChk);
  container.appendChild(sep1);
  container.appendChild(dmgIn);
  container.appendChild(sep2);
  container.appendChild(dealIn);
  container.appendChild(applyBtn);
  container.appendChild(curHpEl);
}

async function updateEntryField(hud, idx, patch) {
  const newEntries = hud.entries.map((e, i) => i === idx ? { ...e, ...patch } : e);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    scheduleHudAutosave();
    const updated = huds.find(h => h.id === hud.id);
    if (updated) Object.assign(hud, updated);
  }
}

async function removeEntry(hud, idx) {
  const newEntries = hud.entries.filter((_, i) => i !== idx);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    scheduleHudAutosave();
    const updated = huds.find(h => h.id === selectedHudId);
    if (updated) renderInitiativeEditor(updated);
  }
}

btnCombatToggle.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud) return;
  const inCombat = !(hud.combat ?? false);
  const newHuds = await window.electronAPI.updateHud(hud.id, { combat: inCombat, currentIndex: 0 });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

btnCombatNext.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud || !hud.entries.length) return;
  const next = ((hud.currentIndex ?? 0) + 1) % hud.entries.length;
  const newHuds = await window.electronAPI.updateHud(hud.id, { currentIndex: next });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

btnCombatPrev.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud || !hud.entries.length) return;
  const prev = ((hud.currentIndex ?? 0) - 1 + hud.entries.length) % hud.entries.length;
  const newHuds = await window.electronAPI.updateHud(hud.id, { currentIndex: prev });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

btnAddEntry.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud) return;
  const newEntry = { id: genId(), name: '', initiative: 0, hidden: false, invisible: true, statuses: [] };
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: [...(hud.entries ?? []), newEntry] });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

document.getElementById('btn-sort-initiative')?.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud || !hud.entries?.length) return;
  const activeEntry = hud.entries[hud.currentIndex ?? 0];
  const sorted = [...hud.entries].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
  const newIdx = activeEntry ? sorted.findIndex(e => e.id === activeEntry.id) : 0;
  const newHuds = await window.electronAPI.updateHud(hud.id, {
    entries: sorted,
    currentIndex: newIdx >= 0 ? newIdx : 0,
  });
  if (newHuds) {
    huds = newHuds;
    scheduleHudAutosave();
    const upd = huds.find(h => h.id === selectedHudId);
    if (upd) renderInitiativeEditor(upd);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// STATUSES HUD EDITOR
// ════════════════════════════════════════════════════════════════════════════

function renderStatusesEditor(hud) {
  if (!statusesEditor) return;
  statusesEditor.style.display = '';
  const labelEl = document.getElementById('statuses-label');
  if (labelEl) labelEl.value = hud.label ?? 'Status';
  const fontSizeEl = document.getElementById('statuses-font-size');
  if (fontSizeEl) fontSizeEl.value = hud.fontSize ?? DEFAULT_HUD_FONT_SIZE;
  const showLabelsEl = document.getElementById('statuses-show-labels');
  if (showLabelsEl) showLabelsEl.checked = hud.showLabels ?? false;
  renderStatusesPositions(hud);
  renderStatusesEntries(hud);
}

function renderStatusesPositions(hud) {
  const posEl = document.getElementById('statuses-positions');
  if (!posEl) return;
  posEl.innerHTML = '';
  const sides = normalizeSides(hud);

  const getSides = () => {
    const current = normalizeSides(huds.find(h => h.id === selectedHudId) ?? hud);
    return CORNERS
      .map(({ id: corner }) => {
        const row = posEl.querySelector(`[data-corner="${corner}"]`);
        if (!row) return null;
        const chk = row.querySelector('input[type="checkbox"]');
        const sel = row.querySelector('select');
        if (!chk?.checked) return null;
        const existing = current.find(s => s.corner === corner);
        return { corner, facing: sel?.value ?? 'up', x: existing?.x, y: existing?.y };
      })
      .filter(Boolean);
  };

  for (const { id: corner, label } of CORNERS) {
    const existing = sides.find(s => s.corner === corner);
    const row = document.createElement('div');
    row.dataset.corner = corner;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = !!existing;
    chk.style.cssText = 'accent-color:#4a90d9;cursor:pointer;flex-shrink:0;';

    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'flex:1;font-size:11px;color:#aaa;';

    const facingSelect = document.createElement('select');
    facingSelect.className = 'field-select';
    facingSelect.disabled = !existing;
    for (const [val, text] of [['up','Up'],['down','Down'],['left','Left'],['right','Right']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      facingSelect.appendChild(opt);
    }
    facingSelect.value = existing?.facing ?? 'up';

    const save = async () => {
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { sides: getSides() });
      if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudPreview(); }
    };
    chk.addEventListener('change', () => { facingSelect.disabled = !chk.checked; save(); });
    facingSelect.addEventListener('change', save);

    row.appendChild(chk); row.appendChild(lbl); row.appendChild(facingSelect);
    posEl.appendChild(row);
  }
}

function renderStatusesEntries(hud) {
  if (!statusesEntriesEl) return;
  statusesEntriesEl.innerHTML = '';
  if (!hud.entries || hud.entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No entries';
    statusesEntriesEl.appendChild(empty);
    return;
  }
  hud.entries.forEach((entry, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'initiative-entry-wrap';

    const row = document.createElement('div');
    row.className = 'initiative-entry-row';

    const nameInput = document.createElement('input');
    nameInput.className = 'init-entry-name';
    nameInput.value = entry.name;
    nameInput.placeholder = 'Name…';
    nameInput.addEventListener('change', () => updateStatusesEntryField(hud, idx, { name: nameInput.value }));

    const hiddenChk = document.createElement('input');
    hiddenChk.type = 'checkbox'; hiddenChk.title = 'Show as ???';
    hiddenChk.checked = entry.hidden ?? false;
    hiddenChk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';
    hiddenChk.addEventListener('change', () => updateStatusesEntryField(hud, idx, { hidden: hiddenChk.checked }));

    const invisibleChk = document.createElement('input');
    invisibleChk.type = 'checkbox'; invisibleChk.title = 'Hide from players';
    invisibleChk.checked = entry.invisible ?? false;
    invisibleChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
    invisibleChk.addEventListener('change', () => updateStatusesEntryField(hud, idx, { invisible: invisibleChk.checked }));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon-xs danger'; delBtn.textContent = '×'; delBtn.title = 'Remove entry';
    delBtn.addEventListener('click', () => removeStatusesEntry(hud, idx));

    const visGroup = document.createElement('div');
    visGroup.className = 'init-vis-group';
    const lbl1 = document.createElement('span'); lbl1.className = 'init-vis-label'; lbl1.title = 'Lurking'; lbl1.textContent = '?';
    const lbl2 = document.createElement('span'); lbl2.className = 'init-vis-label'; lbl2.title = 'Invisible'; lbl2.textContent = '👁'; lbl2.style.fontSize = '10px';
    visGroup.appendChild(lbl1); visGroup.appendChild(hiddenChk);
    visGroup.appendChild(lbl2); visGroup.appendChild(invisibleChk);

    row.appendChild(nameInput); row.appendChild(visGroup); row.appendChild(delBtn);

    const statusRow = document.createElement('div');
    statusRow.className = 'init-extras-row';
    buildEntryStatusRow(statusRow, hud, idx, entry, updateStatusesEntryField, renderStatusesEntries);

    wrap.appendChild(row); wrap.appendChild(statusRow);
    statusesEntriesEl.appendChild(wrap);
  });
}

async function updateStatusesEntryField(hud, idx, patch) {
  const newEntries = hud.entries.map((e, i) => i === idx ? { ...e, ...patch } : e);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    scheduleHudAutosave();
    const updated = huds.find(h => h.id === hud.id);
    if (updated) Object.assign(hud, updated);
  }
}

async function removeStatusesEntry(hud, idx) {
  const newEntries = hud.entries.filter((_, i) => i !== idx);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    scheduleHudAutosave();
    const updated = huds.find(h => h.id === selectedHudId);
    if (updated) renderStatusesEditor(updated);
  }
}

document.getElementById('statuses-label')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = document.getElementById('statuses-label').value;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { label: v });
  if (newHuds) { huds = newHuds; renderHudList(); }
});

document.getElementById('statuses-font-size')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = parseInt(document.getElementById('statuses-font-size').value);
  if (isNaN(v) || v < 8 || v > 48) return;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { fontSize: v });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); }
});

document.getElementById('statuses-show-labels')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const checked = document.getElementById('statuses-show-labels').checked;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { showLabels: checked });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); }
});

document.getElementById('btn-add-status-entry')?.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud) return;
  const newEntry = { id: genId(), name: '', hidden: false, invisible: true, statuses: [] };
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: [...(hud.entries ?? []), newEntry] });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); const upd = huds.find(h => h.id === selectedHudId); if (upd) renderStatusesEditor(upd); }
});

// ════════════════════════════════════════════════════════════════════════════
// HANDOUT HUD EDITOR
// ════════════════════════════════════════════════════════════════════════════

function getHandoutImages(hud) {
  if (hud.images?.length) return hud.images;
  if (hud.src) return [{ id: genId(), name: 'Image', src: hud.src }];
  return [];
}

function getHandoutActiveSrc(hud) {
  const imgs = getHandoutImages(hud);
  return imgs[hud.activeImageIdx ?? 0]?.src ?? null;
}

function renderHandoutEditor(hud) {
  if (!handoutEditor) return;
  handoutEditor.style.display = '';
  const nameEl = document.getElementById('handout-name');
  if (nameEl) nameEl.value = hud.name ?? '';
  const widthEl = document.getElementById('handout-width');
  if (widthEl) widthEl.value = hud.width ?? 300;
  renderHandoutImageCards(hud);
  renderHandoutPositions(hud);
}

function renderHandoutImageCards(hud) {
  const el = document.getElementById('handout-image-cards');
  if (!el) return;
  el.innerHTML = '';
  const images = getHandoutImages(hud);
  const activeIdx = hud.activeImageIdx ?? 0;

  if (images.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:11px;color:#3a3a5e;font-style:italic;padding:4px 0;';
    empty.textContent = 'No images — click + Add';
    el.appendChild(empty);
    return;
  }

  images.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'handout-card' + (idx === activeIdx ? ' active' : '');
    card.title = 'Click to show this image to players';

    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.className = 'handout-card-thumb';
    thumb.draggable = false;

    const label = document.createElement('div');
    label.className = 'handout-card-label';
    label.textContent = img.name || `Image ${idx + 1}`;
    label.contentEditable = 'true';
    label.spellcheck = false;
    label.addEventListener('click', e => e.stopPropagation());
    label.addEventListener('blur', async () => {
      const newName = label.textContent.trim() || `Image ${idx + 1}`;
      const fresh = huds.find(h => h.id === selectedHudId);
      if (!fresh) return;
      const newImages = getHandoutImages(fresh).map((im, i) => i === idx ? { ...im, name: newName } : im);
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { images: newImages });
      if (newHuds) { huds = newHuds; scheduleHudAutosave(); }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'handout-card-del';
    delBtn.textContent = '×';
    delBtn.title = 'Remove image';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fresh = huds.find(h => h.id === selectedHudId);
      if (!fresh) return;
      const newImages = getHandoutImages(fresh).filter((_, i) => i !== idx);
      const newActive = Math.min(activeIdx, Math.max(0, newImages.length - 1));
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { images: newImages, activeImageIdx: newActive });
      if (newHuds) {
        huds = newHuds; scheduleHudAutosave();
        const upd = huds.find(h => h.id === selectedHudId);
        if (upd) renderHandoutEditor(upd);
      }
    });

    card.appendChild(thumb);
    card.appendChild(label);
    card.appendChild(delBtn);
    card.addEventListener('click', async () => {
      if (idx === activeIdx) return;
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { activeImageIdx: idx });
      if (newHuds) {
        huds = newHuds; scheduleHudAutosave();
        const upd = huds.find(h => h.id === selectedHudId);
        if (upd) renderHandoutEditor(upd);
      }
    });

    el.appendChild(card);
  });
}

function renderHandoutPositions(hud) {
  const posEl = document.getElementById('handout-positions');
  if (!posEl) return;
  posEl.innerHTML = '';
  const sides = normalizeSides(hud);

  const getSides = () => {
    const current = normalizeSides(huds.find(h => h.id === selectedHudId) ?? hud);
    return CORNERS
      .map(({ id: corner }) => {
        const row = posEl.querySelector(`[data-corner="${corner}"]`);
        if (!row) return null;
        const chk = row.querySelector('input[type="checkbox"]');
        const sel = row.querySelector('select');
        if (!chk?.checked) return null;
        const existing = current.find(s => s.corner === corner);
        return { corner, facing: sel?.value ?? 'up', x: existing?.x, y: existing?.y };
      })
      .filter(Boolean);
  };

  for (const { id: corner, label } of CORNERS) {
    const existing = sides.find(s => s.corner === corner);
    const row = document.createElement('div');
    row.dataset.corner = corner;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = !!existing;
    chk.style.cssText = 'accent-color:#4caf7d;cursor:pointer;flex-shrink:0;';

    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'flex:1;font-size:11px;color:#aaa;';

    const facingSelect = document.createElement('select');
    facingSelect.className = 'field-select';
    facingSelect.disabled = !existing;
    for (const [val, text] of [['up','Up'],['down','Down'],['left','Left'],['right','Right']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      facingSelect.appendChild(opt);
    }
    facingSelect.value = existing?.facing ?? 'up';

    const save = async () => {
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { sides: getSides() });
      if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudPreview(); }
    };
    chk.addEventListener('change', () => { facingSelect.disabled = !chk.checked; save(); });
    facingSelect.addEventListener('change', save);

    row.appendChild(chk); row.appendChild(lbl); row.appendChild(facingSelect);
    posEl.appendChild(row);
  }
}

document.getElementById('handout-name')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = document.getElementById('handout-name').value;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { name: v });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); renderHudList(); }
});

document.getElementById('handout-width')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = parseInt(document.getElementById('handout-width').value) || 300;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { width: v });
  if (newHuds) { huds = newHuds; scheduleHudAutosave(); }
});

document.getElementById('btn-handout-add-images')?.addEventListener('click', async () => {
  if (!selectedHudId) return;
  const paths = await window.electronAPI.openMapDialog();
  if (!paths?.length) return;
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud) return;
  const existing = getHandoutImages(hud);
  const newImages = [
    ...existing,
    ...paths.map((src, i) => ({ id: genId(), name: `Image ${existing.length + i + 1}`, src })),
  ];
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { images: newImages });
  if (newHuds) {
    huds = newHuds; scheduleHudAutosave();
    const upd = huds.find(h => h.id === selectedHudId);
    if (upd) renderHandoutEditor(upd);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// HUD SIMULATION
// ════════════════════════════════════════════════════════════════════════════

const HUD_TYPE_COLOR = { initiative: '#c9a84c', status: '#4a90d9', handout: '#4caf7d' };

let simScale = 1;

// renderHudPreview is the public alias so every existing call site works
function renderHudPreview() { if (!simDragging) updateHudSimulation(); }

function updateHudSimulation() {
  if (!hudSimScreen || !hudSimWrap || !hudSimViewport) return;

  const sw = playerScreenW || 1920;
  const sh = playerScreenH || 1080;

  // Fit simulation into the available wrapper space
  const ww = hudSimWrap.clientWidth  - 16;
  const wh = hudSimWrap.clientHeight - 16;
  simScale = Math.min(ww / sw, wh / sh, 1);
  if (simScale <= 0) simScale = 0.1;

  hudSimViewport.style.width  = Math.round(sw * simScale) + 'px';
  hudSimViewport.style.height = Math.round(sh * simScale) + 'px';

  hudSimScreen.style.width          = sw + 'px';
  hudSimScreen.style.height         = sh + 'px';
  hudSimScreen.style.transform      = `scale(${simScale})`;
  hudSimScreen.style.transformOrigin = 'top left';

  // Background: show the player screen composition if a preview is available
  hudSimScreen.style.backgroundImage    = lastScreenPreviewUrl ? `url('${lastScreenPreviewUrl}')` : 'none';
  hudSimScreen.style.backgroundSize     = '100% 100%';
  hudSimScreen.style.backgroundPosition = 'top left';
  hudSimScreen.style.backgroundRepeat   = 'no-repeat';

  // Clear and rebuild panels
  hudSimScreen.innerHTML = '';

  for (const hud of huds) {
    if (hud.visible === false) continue;
    const sides = normalizeSides(hud);
    sides.forEach((side, sideIdx) => {
      const panel = buildSimHudPanel(hud, side, sideIdx, sw, sh);
      hudSimScreen.appendChild(panel);
    });
  }
}

function cornerToXY(corner, panelW, panelH, screenW, screenH) {
  const m = 20;
  switch (corner) {
    case 'top-right':    return { x: screenW - panelW - m, y: m };
    case 'bottom-left':  return { x: m, y: screenH - panelH - m };
    case 'bottom-right': return { x: screenW - panelW - m, y: screenH - panelH - m };
    default:             return { x: m, y: m }; // top-left
  }
}

function estimateSimPanelSize(hud) {
  const fontSize = hud.fontSize ?? 24;
  const entryH   = fontSize * 1.6 + 10;
  const entries  = (hud.entries ?? []).filter(e => !e.invisible).length;
  const bodyH    = Math.max(entries, 1) * entryH + 12;
  const headerH  = 38;
  if (hud.type === 'handout') {
    const w = hud.width ?? 300;
    const imgH = getHandoutActiveSrc(hud) ? Math.round(w * 0.56) : 32;
    return { w, h: headerH + imgH };
  }
  return { w: 280, h: headerH + bodyH };
}

function buildSimHudPanel(hud, side, sideIdx, screenW, screenH) {
  const { w: panelW, h: panelH } = estimateSimPanelSize(hud);

  // Resolve position: stored x,y override corner-based default
  let px = side.x, py = side.y;
  if (px == null || py == null) {
    const pos = cornerToXY(side.corner, panelW, panelH, screenW, screenH);
    px = pos.x; py = pos.y;
  }

  const panel = document.createElement('div');
  panel.className = 'hud-sim-panel' + (hud.id === selectedHudId ? ' selected' : '');
  panel.dataset.hudId   = hud.id;
  panel.dataset.sideIdx = sideIdx;
  panel.style.left  = Math.round(px) + 'px';
  panel.style.top   = Math.round(py) + 'px';
  panel.style.width = panelW + 'px';
  panel.style.fontSize = (hud.fontSize ?? 24) + 'px';

  const color = HUD_TYPE_COLOR[hud.type] ?? '#888';

  // Header — drag handle
  const header = document.createElement('div');
  header.className = 'hud-sim-header';

  const badge = document.createElement('span');
  badge.className = 'hud-sim-badge';
  badge.textContent = hud.type === 'status' ? 'ST' : hud.type === 'handout' ? 'HO' : 'IN';
  badge.style.cssText = `color:${color};border-color:${color}55;`;

  const titleEl = document.createElement('span');
  titleEl.className = 'hud-sim-title-text';
  titleEl.textContent = hud.type === 'status' ? (hud.label || 'Statuses')
    : hud.type === 'handout' ? (hud.name || 'Handout') : 'Initiative';

  header.appendChild(badge);
  header.appendChild(titleEl);
  panel.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'hud-sim-body';
  buildSimBody(body, hud);
  panel.appendChild(body);

  // Interaction
  panel.addEventListener('click', (e) => { e.stopPropagation(); selectHud(hud.id); });
  makeSimPanelDraggable(panel, header, hud, sideIdx, screenW, screenH);

  return panel;
}

function buildSimBody(container, hud) {
  if (hud.type === 'handout') {
    const src = getHandoutActiveSrc(hud);
    if (src) {
      const img = document.createElement('img');
      img.src   = src;
      img.style.cssText = 'width:100%;display:block;border-radius:0 0 7px 7px;';
      container.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.className = 'hud-sim-empty';
      empty.textContent = 'No image';
      container.appendChild(empty);
    }
    return;
  }

  const entries = (hud.entries ?? []).filter(e => !e.invisible);
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'hud-sim-empty';
    empty.textContent = 'Empty';
    container.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'hud-sim-entry';

    if (hud.type === 'initiative') {
      const roll = document.createElement('span');
      roll.className = 'hud-sim-roll';
      roll.textContent = entry.initiative ?? '—';
      row.appendChild(roll);
    }

    const name = document.createElement('span');
    name.className = 'hud-sim-name';
    name.textContent = entry.hidden ? '???' : (entry.name || '—');
    row.appendChild(name);

    const pips = document.createElement('span');
    pips.className = 'hud-sim-pips';
    for (const s of (entry.statuses ?? []).slice(0, 6)) {
      const pip = document.createElement('span');
      pip.className = 'hud-sim-pip';
      pip.style.background = s.color ?? '#888';
      pips.appendChild(pip);
    }
    row.appendChild(pips);
    container.appendChild(row);
  }
}

function makeSimPanelDraggable(panel, handle, hud, sideIdx, screenW, screenH) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Read position BEFORE any re-render can touch the DOM
    const startPx  = parseInt(panel.style.left) || 0;
    const startPy  = parseInt(panel.style.top)  || 0;
    const startMx  = e.clientX;
    const startMy  = e.clientY;
    const panelW   = panel.offsetWidth  || 280;
    const panelH   = panel.offsetHeight || 60;
    let   moved    = false;

    simDragging = true;
    handle.style.cursor = 'grabbing';

    const coordsEl = document.getElementById('hud-sim-coords');

    const onMove = (ev) => {
      moved = true;
      const dx = (ev.clientX - startMx) / simScale;
      const dy = (ev.clientY - startMy) / simScale;
      const nx = Math.max(0, Math.min(screenW - panelW, Math.round(startPx + dx)));
      const ny = Math.max(0, Math.min(screenH - panelH, Math.round(startPy + dy)));
      panel.style.left = nx + 'px';
      panel.style.top  = ny + 'px';
      if (coordsEl) coordsEl.textContent = `x: ${nx}  y: ${ny}`;
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      handle.style.cursor = 'grab';
      simDragging = false;

      if (!moved) {
        // Treat as a click — select the HUD
        selectHud(hud.id);
        return;
      }

      const nx = parseInt(panel.style.left) || 0;
      const ny = parseInt(panel.style.top)  || 0;
      if (coordsEl) coordsEl.textContent = `x: ${nx}  y: ${ny}`;

      // Persist x,y into the side entry
      const currentHud = huds.find(h => h.id === hud.id);
      if (!currentHud) return;
      const newSides = normalizeSides(currentHud).map((s, i) =>
        i === sideIdx ? { ...s, x: nx, y: ny } : s
      );
      const newHuds = await window.electronAPI.updateHud(hud.id, { sides: newSides });
      if (newHuds) {
        huds = newHuds;
        scheduleHudAutosave();
        applyHudSelection(hud.id);
        updateHudSimulation();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

document.getElementById('btn-refresh-hud-sim')?.addEventListener('click', () => updateHudSimulation());

// Re-render simulation when the wrapper resizes (skip during active drags)
if (hudSimWrap) {
  new ResizeObserver(() => { if (!simDragging) updateHudSimulation(); }).observe(hudSimWrap);
}
