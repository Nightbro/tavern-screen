// ── HUD rendering ─────────────────────────────────────────────────────────────
function renderHuds() {
  hudRoot.innerHTML = '';
  const pending = [];
  for (const hud of (scene.huds ?? [])) {
    if (hud.visible === false) continue;
    if (hud.type === 'initiative') {
      for (const item of buildInitiativeHudPanels(hud)) {
        hudRoot.appendChild(item.panel);
        pending.push(item);
      }
    } else if (hud.type === 'status') {
      for (const item of buildStatusHudPanels(hud)) {
        hudRoot.appendChild(item.panel);
        pending.push(item);
      }
    } else if (hud.type === 'handout') {
      for (const item of buildHandoutHudPanels(hud)) {
        hudRoot.appendChild(item.panel);
        pending.push(item);
      }
    }
  }
  // Position after layout so offsetWidth/offsetHeight are real
  requestAnimationFrame(() => {
    for (const { panel, corner, facing, x, y } of pending) positionPanel(panel, corner, facing, x, y);
  });
}

function applyHudSide(el, side) {
  el.style.left = el.style.right = el.style.top = el.style.bottom = '';
  switch (side) {
    case 'top-left':     el.style.left = '20px'; el.style.top    = '20px'; break;
    case 'top-right':    el.style.right = '20px'; el.style.top   = '20px'; break;
    case 'bottom-left':  el.style.left = '20px'; el.style.bottom = '20px'; break;
    case 'bottom-right': el.style.right = '20px'; el.style.bottom = '20px'; break;
    default:             el.style.left = '20px'; el.style.top    = '20px';
  }
}

function facingToDeg(facing) {
  switch (facing) {
    case 'down':  return 180;
    case 'right': return 90;
    case 'left':  return 270;
    default:      return 0;
  }
}

// Position a HUD panel. If x/y are provided they are used directly (pixel-
// accurate placement from the GM simulation). Otherwise falls back to
// corner-based positioning. Called after layout (needs real offsetWidth/H).
function positionPanel(el, corner, facing, x, y) {
  const deg = facingToDeg(facing);
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
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W  = el.offsetWidth;
  const H  = el.offsetHeight;
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

function buildInitiativeHudPanels(hud) {
  const sides = hud.sides?.length
    ? hud.sides
    : [{ corner: hud.side ?? 'top-left', facing: 'up' }];
  return sides.map(({ corner, facing, x, y }) => ({
    panel: buildInitiativeHudPanel(hud, corner, facing),
    corner, facing, x, y,
  }));
}

function buildInitiativeHudPanel(hud, corner, facing) {
  const fontSize = hud.fontSize ?? 14;

  const panel = document.createElement('div');
  panel.className = 'hud-panel';
  panel.style.fontSize   = fontSize + 'px';
  panel.style.visibility = 'hidden'; // shown by positionPanel after layout
  panel.style.left = '-9999px'; panel.style.top = '0';
  if (hud.showLabels) panel.classList.add('statuses-expanded');

  const header = document.createElement('div');
  header.className = 'hud-header';

  const title = document.createElement('div');
  title.className   = 'hud-title';
  title.textContent = 'Initiative';
  header.appendChild(title);

  panel.appendChild(header);

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

    row.appendChild(badge);
    row.appendChild(name);

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

      wrap.appendChild(pip);
      wrap.appendChild(lbl);
      statuses.appendChild(wrap);
    }
    row.appendChild(statuses);

    body.appendChild(row);
  });

  if (entries.filter(e => !e.invisible).length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:0.8em;color:#3a3a5e;font-style:italic;padding:4px 0;';
    empty.textContent = 'No entries';
    body.appendChild(empty);
  }

  panel.appendChild(body);

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

  return panel;
}

function buildStatusHudPanels(hud) {
  const sides = hud.sides?.length
    ? hud.sides
    : [{ corner: hud.side ?? 'top-right', facing: 'up' }];
  return sides.map(({ corner, facing, x, y }) => ({
    panel: buildStatusHudPanel(hud, corner, facing),
    corner, facing, x, y,
  }));
}

function buildStatusHudPanel(hud, corner, facing) {
  const fontSize = hud.fontSize ?? 14;

  const panel = document.createElement('div');
  panel.className = 'hud-panel';
  panel.style.fontSize = fontSize + 'px';
  panel.style.visibility = 'hidden';
  panel.style.left = '-9999px'; panel.style.top = '0';
  if (hud.showLabels) panel.classList.add('statuses-expanded');

  const header = document.createElement('div');
  header.className = 'hud-header';
  const title = document.createElement('div');
  title.className = 'hud-title';
  title.textContent = hud.label ?? 'Status';
  header.appendChild(title);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'hud-body';
  const entries = (hud.entries ?? []).filter(e => !e.invisible);

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:0.8em;color:#3a3a5e;font-style:italic;padding:4px 0;';
    empty.textContent = 'No entries';
    body.appendChild(empty);
  } else {
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'initiative-entry';

      const name = document.createElement('span');
      name.className = 'initiative-name';
      name.textContent = entry.hidden ? '???' : (entry.name || '—');
      row.appendChild(name);

      const statusesEl = document.createElement('span');
      statusesEl.className = 'initiative-statuses';
      for (const s of (entry.statuses ?? [])) {
        const wrap = document.createElement('span');
        wrap.className = 'status-pip-wrap';
        const pip = document.createElement('span');
        pip.className = 'status-pip';
        pip.style.background = s.color ?? '#888';
        const lbl = document.createElement('span');
        lbl.className = 'status-pip-lbl';
        lbl.textContent = s.label ?? '';
        wrap.appendChild(pip); wrap.appendChild(lbl);
        statusesEl.appendChild(wrap);
      }
      row.appendChild(statusesEl);
      body.appendChild(row);
    }
  }
  panel.appendChild(body);

  let dragX = 0, dragY = 0, startLeft = 0, startTop = 0;
  const onMove = (e) => {
    panel.style.left = Math.max(0, startLeft + e.clientX - dragX) + 'px';
    panel.style.top  = Math.max(0, startTop  + e.clientY - dragY) + 'px';
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    header.style.cursor = 'grab';
  };
  header.addEventListener('mousedown', (e) => {
    dragX = e.clientX; dragY = e.clientY;
    startLeft = parseInt(panel.style.left) || 0;
    startTop  = parseInt(panel.style.top)  || 0;
    header.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  return panel;
}

function buildHandoutHudPanels(hud) {
  const sides = hud.sides?.length
    ? hud.sides
    : [{ corner: hud.side ?? 'top-left', facing: 'up' }];
  return sides.map(({ corner, facing, x, y }) => ({
    panel: buildHandoutHudPanel(hud, corner, facing),
    corner, facing, x, y,
  }));
}

function buildHandoutHudPanel(hud, corner, facing) {
  const panel = document.createElement('div');
  panel.className = 'hud-panel hud-handout-panel';
  panel.style.visibility = 'hidden';
  panel.style.left = '-9999px'; panel.style.top = '0';
  if (hud.width) panel.style.width = hud.width + 'px';

  const header = document.createElement('div');
  header.className = 'hud-header';
  const title = document.createElement('div');
  title.className = 'hud-title';
  title.textContent = hud.name ?? 'Handout';
  header.appendChild(title);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'hud-body hud-handout-body';

  const activeSrc = hud.images?.length
    ? (hud.images[hud.activeImageIdx ?? 0]?.src ?? null)
    : (hud.src ?? null);
  if (activeSrc) {
    const img = document.createElement('img');
    img.src = activeSrc;
    img.className = 'hud-handout-img';
    body.appendChild(img);
  } else {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:11px;color:#3a3a5e;font-style:italic;padding:8px 0;text-align:center;';
    empty.textContent = 'No image selected';
    body.appendChild(empty);
  }
  panel.appendChild(body);

  let dragX = 0, dragY = 0, startLeft = 0, startTop = 0;
  const onMove = (e) => {
    panel.style.left = Math.max(0, startLeft + e.clientX - dragX) + 'px';
    panel.style.top  = Math.max(0, startTop  + e.clientY - dragY) + 'px';
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    header.style.cursor = 'grab';
  };
  header.addEventListener('mousedown', (e) => {
    dragX = e.clientX; dragY = e.clientY;
    startLeft = parseInt(panel.style.left) || 0;
    startTop  = parseInt(panel.style.top)  || 0;
    header.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  return panel;
}

// ── Ping ──────────────────────────────────────────────────────────────────────
function showPing(canvasX, canvasY) {
  const tx = computeMapTransform(scene.viewport);
  const px = tx.originX + canvasX * tx.zoom;
  const py = tx.originY + canvasY * tx.zoom;

  const ring = document.createElement('div');
  ring.className    = 'ping-ring';
  ring.style.left   = px + 'px';
  ring.style.top    = py + 'px';
  ring.style.width  = '40px';
  ring.style.height = '40px';

  const dot = document.createElement('div');
  dot.className  = 'ping-dot';
  dot.style.left = px + 'px';
  dot.style.top  = py + 'px';

  document.body.appendChild(ring);
  document.body.appendChild(dot);
  setTimeout(() => { ring.remove(); dot.remove(); }, 1500);
}
