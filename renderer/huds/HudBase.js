class HudBase extends IHud {
  static CORNERS = [
    { id: 'top-left',     label: 'Top Left'     },
    { id: 'top-right',    label: 'Top Right'    },
    { id: 'bottom-left',  label: 'Bottom Left'  },
    { id: 'bottom-right', label: 'Bottom Right' },
  ];

  // ── Sides ───────────────────────────────────────────────────────────────────

  normalizeSides(hud) {
    if (hud.sides?.length) return hud.sides;
    return [{ corner: hud.side ?? 'top-left', facing: 'up' }];
  }

  // ── Custom status presets (localStorage) ────────────────────────────────────

  static getCustomPresets() {
    try { return JSON.parse(localStorage.getItem('customStatusPresets') ?? '[]'); }
    catch { return []; }
  }

  static saveCustomPresets(presets) {
    localStorage.setItem('customStatusPresets', JSON.stringify(presets));
  }

  // ── Shared player-panel helpers ──────────────────────────────────────────────

  // Attaches grab-to-drag on the player screen (shared across all three panel types).
  makeDraggable(panel, header) {
    let dragX = 0, dragY = 0, startLeft = 0, startTop = 0;
    const onMove = (e) => {
      panel.style.left = Math.max(0, startLeft + e.clientX - dragX) + 'px';
      panel.style.top  = Math.max(0, startTop  + e.clientY - dragY) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      header.style.cursor = 'grab';
    };
    header.addEventListener('mousedown', (e) => {
      dragX     = e.clientX;
      dragY     = e.clientY;
      startLeft = parseInt(panel.style.left) || 0;
      startTop  = parseInt(panel.style.top)  || 0;
      header.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
      e.preventDefault();
    });
  }

  // Creates the outer panel shell (div.hud-panel + div.hud-header with title).
  // Returns { panel, header } so callers can append a body.
  buildPanelShell(titleText, extraClass = '') {
    const panel = document.createElement('div');
    panel.className = 'hud-panel' + (extraClass ? ' ' + extraClass : '');
    panel.style.visibility = 'hidden';
    panel.style.left = '-9999px';
    panel.style.top  = '0';

    const header = document.createElement('div');
    header.className = 'hud-header';

    const title = document.createElement('div');
    title.className   = 'hud-title';
    title.textContent = titleText;
    header.appendChild(title);
    panel.appendChild(header);

    this.makeDraggable(panel, header);
    return { panel, header };
  }

  // Maps hud.sides → array of { panel, corner, facing, x, y } for renderHuds().
  buildPlayerPanels(hud) {
    const sides = this.normalizeSides(hud);
    return sides.map(({ corner, facing, x, y }) => ({
      panel: this.buildPlayerPanel(hud),
      corner, facing, x, y,
    }));
  }

  // ── Screen-side positioning (static — called from screen-advanced-huds.js) ──

  static facingToDeg(facing) {
    switch (facing) {
      case 'down':  return 180;
      case 'right': return 90;
      case 'left':  return 270;
      default:      return 0;
    }
  }

  static positionPanel(el, corner, facing, x, y) {
    const deg = HudBase.facingToDeg(facing);
    el.style.transformOrigin = 'center center';
    el.style.transform = deg ? `rotate(${deg}deg)` : '';
    el.style.right = el.style.bottom = '';

    if (x != null && y != null) {
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.visibility = '';
      return;
    }

    const margin = 20;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const W   = el.offsetWidth;
    const H   = el.offsetHeight;
    const visW = (deg === 90 || deg === 270) ? H : W;
    const visH = (deg === 90 || deg === 270) ? W : H;

    let cx, cy;
    switch (corner) {
      case 'top-right':    cx = vw - margin - visW / 2; cy = margin + visH / 2;      break;
      case 'bottom-left':  cx = margin + visW / 2;      cy = vh - margin - visH / 2; break;
      case 'bottom-right': cx = vw - margin - visW / 2; cy = vh - margin - visH / 2; break;
      default:             cx = margin + visW / 2;      cy = margin + visH / 2;      break;
    }

    el.style.left = (cx - W / 2) + 'px';
    el.style.top  = (cy - H / 2) + 'px';
    el.style.visibility = '';
  }

  // ── GM simulation helpers (static) ──────────────────────────────────────────

  static cornerToXY(corner, panelW, panelH, screenW, screenH) {
    const m = 20;
    switch (corner) {
      case 'top-right':    return { x: screenW - panelW - m, y: m };
      case 'bottom-left':  return { x: m, y: screenH - panelH - m };
      case 'bottom-right': return { x: screenW - panelW - m, y: screenH - panelH - m };
      default:             return { x: m, y: m };
    }
  }

  // ── GM editor shared helpers ─────────────────────────────────────────────────

  // Builds the corner/facing checkbox grid (was duplicated 3× in gm-huds.js).
  buildPositionsEditor(posEl, hud, accentColor, ctx) {
    posEl.innerHTML = '';
    const sides = this.normalizeSides(hud);
    const { sceneState, api, scheduleAutosave, renderHudPreview } = ctx;

    const getSides = () => {
      const current = this.normalizeSides(
        sceneState.huds.find(h => h.id === sceneState.selectedHudId) ?? hud
      );
      return HudBase.CORNERS
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

    for (const { id: corner, label } of HudBase.CORNERS) {
      const existing = sides.find(s => s.corner === corner);

      const row = document.createElement('div');
      row.dataset.corner = corner;
      row.style.cssText  = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

      const chk = document.createElement('input');
      chk.type     = 'checkbox';
      chk.checked  = !!existing;
      chk.style.cssText = `accent-color:${accentColor};cursor:pointer;flex-shrink:0;`;

      const lbl = document.createElement('span');
      lbl.textContent  = label;
      lbl.style.cssText = 'flex:1;font-size:11px;color:#aaa;';

      const facingSelect = document.createElement('select');
      facingSelect.className = 'field-select';
      facingSelect.disabled  = !existing;
      for (const [val, text] of [['up','Up'],['down','Down'],['left','Left'],['right','Right']]) {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = text;
        facingSelect.appendChild(opt);
      }
      facingSelect.value = existing?.facing ?? 'up';

      const save = async () => {
        const newHuds = await api.updateHud(sceneState.selectedHudId, { sides: getSides() });
        if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); renderHudPreview(); }
      };
      chk.addEventListener('change', () => { facingSelect.disabled = !chk.checked; save(); });
      facingSelect.addEventListener('change', save);

      row.appendChild(chk);
      row.appendChild(lbl);
      row.appendChild(facingSelect);
      posEl.appendChild(row);
    }
  }

  // Builds the status-chip row + preset picker for an entry (used by Initiative and Status editors).
  buildEntryStatusRow(container, hud, idx, entry, updateFn, refreshFn) {
    container.innerHTML = '';
    const statuses = entry.statuses ?? [];

    const chipsRow = document.createElement('div');
    chipsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';

    statuses.forEach((s, si) => {
      const chip = document.createElement('span');
      chip.className = 'init-status-chip';

      const dot = document.createElement('span');
      dot.className    = 'init-status-dot';
      dot.style.background = s.color ?? '#888';

      const lbl = document.createElement('span');
      lbl.className   = 'init-status-lbl';
      lbl.textContent = s.label ?? '';

      const del = document.createElement('button');
      del.className   = 'init-status-del';
      del.textContent = '×';
      del.addEventListener('click', async () => {
        await updateFn(hud, idx, { statuses: statuses.filter((_, i) => i !== si) });
        const updated = window._gmSceneState?.huds.find(h => h.id === hud.id);
        if (updated) refreshFn(updated);
      });

      chip.appendChild(dot); chip.appendChild(lbl); chip.appendChild(del);
      chipsRow.appendChild(chip);
    });

    container.appendChild(chipsRow);

    let pickerOpen = false;
    const toggleBtn = document.createElement('button');
    toggleBtn.className   = 'btn-icon-xs';
    toggleBtn.textContent = '+ status';
    toggleBtn.style.fontSize = '9px';

    const picker = document.createElement('div');
    picker.className    = 'status-preset-picker';
    picker.style.display = 'none';

    const quickAdd = async (name, color) => {
      await updateFn(hud, idx, { statuses: [...statuses, { color, label: name }] });
      const updated = window._gmSceneState?.huds.find(h => h.id === hud.id);
      if (updated) refreshFn(updated);
    };

    const pf1eTitle = document.createElement('div');
    pf1eTitle.className   = 'preset-section-title';
    pf1eTitle.textContent = 'Pathfinder 1e';
    picker.appendChild(pf1eTitle);

    const pf1eGrid = document.createElement('div');
    pf1eGrid.className = 'preset-grid';
    for (const { name, color } of (typeof PF1E_CONDITIONS !== 'undefined' ? PF1E_CONDITIONS : [])) {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.title     = name;
      const dot = document.createElement('span');
      dot.className    = 'preset-btn-dot';
      dot.style.background = color;
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(name));
      btn.addEventListener('click', () => quickAdd(name, color));
      pf1eGrid.appendChild(btn);
    }
    picker.appendChild(pf1eGrid);

    const customTitle = document.createElement('div');
    customTitle.className   = 'preset-section-title';
    customTitle.textContent = 'Saved Presets';
    picker.appendChild(customTitle);

    const customGrid = document.createElement('div');
    customGrid.className = 'preset-grid';
    for (const { name, color } of HudBase.getCustomPresets()) {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.title     = name;
      const dot = document.createElement('span');
      dot.className    = 'preset-btn-dot';
      dot.style.background = color;
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(name));
      btn.addEventListener('click', () => quickAdd(name, color));
      customGrid.appendChild(btn);
    }
    if (customGrid.childElementCount === 0) {
      const none = document.createElement('span');
      none.style.cssText  = 'font-size:10px;color:#3a3a5e;font-style:italic;';
      none.textContent = 'No custom presets yet';
      customGrid.appendChild(none);
    }
    picker.appendChild(customGrid);

    const manualRow = document.createElement('div');
    manualRow.className    = 'init-status-form';
    manualRow.style.marginTop = '4px';

    const colorIn = document.createElement('input');
    colorIn.type  = 'color'; colorIn.value = '#c9a84c';
    colorIn.className = 'init-status-color-pick';

    const labelIn = document.createElement('input');
    labelIn.className   = 'init-entry-name';
    labelIn.placeholder = 'Custom label…';
    labelIn.style.cssText = 'flex:1;font-size:10px;min-width:0;';

    const confirmBtn = document.createElement('button');
    confirmBtn.className   = 'btn-icon-xs';
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
      picker.style.display  = pickerOpen ? '' : 'none';
      toggleBtn.textContent = pickerOpen ? '− status' : '+ status';
    });

    container.appendChild(toggleBtn);
    container.appendChild(picker);
  }
}
