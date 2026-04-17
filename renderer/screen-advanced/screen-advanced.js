const CANVAS_SIZE = 8192;

const canvas  = document.getElementById('map-canvas');
const ctx     = canvas.getContext('2d');
const hudRoot = document.getElementById('hud-root');

// ── State ─────────────────────────────────────────────────────────────────────
let settings = {
  gridVisible: true, cellSizeInches: 1.0, zoom: 1.0,
  dpi: 96, gridColor: '#ffffff', gridOpacity: 0.25,
};
let scene = {
  map: null,
  viewport: { cx: 4096, cy: 4096, zoom: 1.0 },
  layers: [],
  huds: [],
};

// Media cache: layerId::src → HTMLImageElement | HTMLVideoElement
const mediaCache      = new Map();
// Weather particles: weatherType → Particle[]
const weatherParticles = new Map();

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resize() {
  const dpr     = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  weatherParticles.clear(); // regenerate at new screen size
}

// ── Viewport transform ────────────────────────────────────────────────────────
// In advanced mode there is no base map — use a fixed 8192×8192 virtual canvas.
// cx/cy are canvas pixel coordinates of the screen centre.
// zoom = screen pixels per canvas pixel.
function computeMapTransform(vp) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const { cx, cy, zoom } = vp;
  return {
    originX: cw / 2 - cx * zoom,
    originY: ch / 2 - cy * zoom,
    zoom,
  };
}

// ── Media loading ─────────────────────────────────────────────────────────────
function getMedia(layer) {
  if (!layer.src) return null;
  const key = layer.id + '::' + layer.src;
  if (!mediaCache.has(key)) {
    let el;
    if (layer.type === 'video') {
      el = document.createElement('video');
      el.loop     = true;
      el.muted    = true;
      el.autoplay = true;
      el.src      = layer.src;
      el.loaded   = false;
      el.addEventListener('loadeddata', () => { el.loaded = true; el.play().catch(() => {}); });
    } else {
      el = new Image();
      el.loaded = false;
      el.onload = () => { el.loaded = true; };
      el.src    = layer.src;
    }
    // Evict old entries for this layer (src changed)
    for (const [k] of mediaCache) {
      if (k.startsWith(layer.id + '::') && k !== key) mediaCache.delete(k);
    }
    mediaCache.set(key, el);
  }
  return mediaCache.get(key);
}

// ── Weather particle system ───────────────────────────────────────────────────

const WEATHER_CFG = {
  rain: {
    count: 180, speed: 14, spreadX: 1.2, size: [1, 2],
    color: () => `rgba(140,185,220,${0.4 + Math.random() * 0.4})`,
    draw(ctx, p) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth   = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
      ctx.stroke();
    },
  },
  snow: {
    count: 120, speed: 1.8, spreadX: 0.4, size: [2, 5],
    color: () => `rgba(220,235,255,${0.5 + Math.random() * 0.4})`,
    draw(ctx, p) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  embers: {
    count: 90, speed: -2.5, spreadX: 0.8, size: [2, 4],
    color: () => `rgba(${200 + Math.random() * 55},${60 + Math.random() * 80},20,${0.6 + Math.random() * 0.4})`,
    draw(ctx, p) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  fog: {
    count: 28, speed: 0.25, spreadX: 0.06, size: [90, 220],
    color: () => `rgba(130,145,165,${0.14 + Math.random() * 0.14})`,
    draw(ctx, p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(130,145,165,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  fireflies: {
    count: 45, speed: 0, spreadX: 0, size: [3, 6],
    color: () => `rgba(160,255,140,${0.6 + Math.random() * 0.4})`,
    draw(ctx, p) {
      const brightness = 0.5 + 0.5 * Math.sin(p.phase);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
      g.addColorStop(0, `rgba(160,255,140,${brightness * 0.9})`);
      g.addColorStop(1, 'rgba(160,255,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

function spawnParticle(type, cw, ch, randomY = false) {
  const cfg  = WEATHER_CFG[type] || WEATHER_CFG.rain;
  const vy   = cfg.speed + (Math.random() - 0.5) * Math.abs(cfg.speed) * 0.4;
  const vx   = (Math.random() - 0.5) * cfg.spreadX * Math.abs(vy);
  const size = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
  return {
    x:     Math.random() * cw,
    y:     randomY
      ? Math.random() * ch
      : (cfg.speed >= 0 ? -size - Math.random() * ch * 0.2 : ch + size),
    vx, vy, size,
    color: cfg.color(),
    phase: Math.random() * Math.PI * 2,
    px: 0, py: 0,
  };
}

function getWeatherParticles(type) {
  if (!weatherParticles.has(type)) {
    const cfg = WEATHER_CFG[type] || WEATHER_CFG.rain;
    const cw  = window.innerWidth;
    const ch  = window.innerHeight;
    weatherParticles.set(type,
      Array.from({ length: cfg.count }, () => spawnParticle(type, cw, ch, true))
    );
  }
  return weatherParticles.get(type);
}

let _lastTs = 0;
function drawWeatherLayer(layer, timestamp) {
  const type      = layer.weatherType || 'rain';
  const intensity = Math.max(0, Math.min(3, layer.intensity ?? 1));
  const cfg       = WEATHER_CFG[type] || WEATHER_CFG.rain;
  const ps        = getWeatherParticles(type);
  const cw        = window.innerWidth;
  const ch        = window.innerHeight;
  const dt        = Math.min((_lastTs ? timestamp - _lastTs : 16) / 16, 4);
  const visible   = Math.min(ps.length, Math.max(0, Math.floor(ps.length * intensity)));

  ctx.save();
  if (layer.x != null && layer.y != null && layer.w != null && layer.h != null) {
    const tx = computeMapTransform(scene.viewport);
    ctx.beginPath();
    ctx.rect(
      tx.originX + layer.x * tx.zoom,
      tx.originY + layer.y * tx.zoom,
      layer.w * tx.zoom,
      layer.h * tx.zoom,
    );
    ctx.clip();
  }
  for (let i = 0; i < visible; i++) {
    const p = ps[i];
    if (type === 'fireflies') {
      p.phase += 0.025 * dt;
      p.x += Math.sin(p.phase * 1.1) * 0.7 * dt;
      p.y += Math.cos(p.phase * 0.8) * 0.5 * dt;
      if (p.x < -20)     p.x = cw + 20;
      if (p.x > cw + 20) p.x = -20;
      if (p.y < -20)     p.y = ch + 20;
      if (p.y > ch + 20) p.y = -20;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const gone = cfg.speed >= 0 ? p.y > ch + p.size * 4 : p.y < -p.size * 4;
      if (gone || p.x < -p.size * 4 || p.x > cw + p.size * 4) {
        Object.assign(p, spawnParticle(type, cw, ch, false));
      }
    }
    cfg.draw(ctx, p);
  }
  ctx.restore();
}

// ── Layer rendering ───────────────────────────────────────────────────────────
function drawLayer(layer, tx) {
  if (layer.type === 'weather') return; // drawn separately

  ctx.save();

  switch (layer.type) {
    case 'image':
    case 'gif': {
      const img = getMedia(layer);
      if (!img?.loaded) break;
      ctx.globalAlpha = layer.opacity ?? 1;
      if (layer.w != null && layer.h != null) {
        // Explicitly positioned in canvas pixel coordinates
        const x = tx.originX + (layer.x ?? 0) * tx.zoom;
        const y = tx.originY + (layer.y ?? 0) * tx.zoom;
        ctx.drawImage(img, x, y, layer.w * tx.zoom, layer.h * tx.zoom);
      } else {
        // No explicit size → contain-fit to screen, centered
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        const s  = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
        const iw = img.naturalWidth  * s;
        const ih = img.naturalHeight * s;
        ctx.drawImage(img, (cw - iw) / 2, (ch - ih) / 2, iw, ih);
      }
      break;
    }
    case 'video': {
      const vid = getMedia(layer);
      if (!vid?.loaded) break;
      ctx.globalAlpha = layer.opacity ?? 1;
      if (layer.w != null && layer.h != null) {
        const x = tx.originX + (layer.x ?? 0) * tx.zoom;
        const y = tx.originY + (layer.y ?? 0) * tx.zoom;
        ctx.drawImage(vid, x, y, layer.w * tx.zoom, layer.h * tx.zoom);
      } else {
        ctx.drawImage(vid, 0, 0, window.innerWidth, window.innerHeight);
      }
      break;
    }
    case 'light': {
      const x = layer.x != null ? tx.originX + layer.x * tx.zoom : 0;
      const y = layer.y != null ? tx.originY + layer.y * tx.zoom : 0;
      const w = layer.w != null ? layer.w * tx.zoom : window.innerWidth;
      const h = layer.h != null ? layer.h * tx.zoom : window.innerHeight;
      ctx.globalAlpha = layer.opacity ?? 0.5;
      ctx.fillStyle   = layer.color ?? '#1a2a4a';
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'fog': {
      const fx = layer.x != null ? tx.originX + layer.x * tx.zoom : tx.originX + 0 * tx.zoom;
      const fy = layer.y != null ? tx.originY + layer.y * tx.zoom : tx.originY + 0 * tx.zoom;
      const fw = layer.w != null ? layer.w * tx.zoom : CANVAS_SIZE * tx.zoom;
      const fh = layer.h != null ? layer.h * tx.zoom : CANVAS_SIZE * tx.zoom;
      ctx.globalAlpha = layer.opacity ?? 0.9;
      ctx.fillStyle   = '#050508';
      ctx.fillRect(fx, fy, fw, fh);
      if (layer.revealed?.length) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        for (const c of layer.revealed) {
          ctx.beginPath();
          ctx.arc(
            tx.originX + c.x * tx.zoom,
            tx.originY + c.y * tx.zoom,
            c.r * tx.zoom,
            0, Math.PI * 2
          );
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    }
  }

  ctx.restore();
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function drawGrid(tx) {
  // When gridScaleWithViewport is false the grid is a fixed screen-space overlay
  // (useful for placing minis at a consistent physical size regardless of zoom).
  // When true (default) the grid scales and pans with the viewport.
  const scalesWithVp = settings.gridScaleWithViewport !== false;
  const cellPx = settings.cellSizeInches * settings.dpi * (scalesWithVp ? tx.zoom : 1.0);
  if (cellPx < 4) return;

  const cw  = window.innerWidth;
  const ch  = window.innerHeight;
  const hex = settings.gridColor.replace('#', '');
  const r   = parseInt(hex.slice(0, 2), 16);
  const g2  = parseInt(hex.slice(2, 4), 16);
  const b   = parseInt(hex.slice(4, 6), 16);

  ctx.save();
  ctx.strokeStyle = `rgba(${r},${g2},${b},${settings.gridOpacity})`;
  ctx.lineWidth   = 1;
  ctx.beginPath();

  // Fixed grid starts from (0,0); viewport-linked grid shifts with the origin
  const startX = scalesWithVp ? ((tx.originX % cellPx) + cellPx) % cellPx : 0;
  const startY = scalesWithVp ? ((tx.originY % cellPx) + cellPx) % cellPx : 0;

  for (let x = startX; x <= cw; x += cellPx) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
  for (let y = startY; y <= ch; y += cellPx) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }

  ctx.stroke();
  ctx.restore();
}

// ── Render loop ───────────────────────────────────────────────────────────────
function render(timestamp) {
  requestAnimationFrame(render);

  const cw = window.innerWidth;
  const ch = window.innerHeight;

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = scene.background ?? '#0d0d1a';
  ctx.fillRect(0, 0, cw, ch);

  const tx = computeMapTransform(scene.viewport);

  // Scene layers (bottom → top), skipping weather
  for (const layer of scene.layers) {
    if (layer.visible === false) continue;
    drawLayer(layer, tx);
  }

  // Weather layers (screen-space, above scene layers)
  const weatherLayers = scene.layers.filter(l => l.type === 'weather' && l.visible !== false);
  for (const wl of weatherLayers) drawWeatherLayer(wl, timestamp);
  if (weatherLayers.length) _lastTs = timestamp;

  // Grid on top
  if (settings.gridVisible) drawGrid(tx);
}

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
      hudRoot.appendChild(buildStatusHud(hud));
    }
  }
  // Position after layout so offsetWidth/offsetHeight are real
  requestAnimationFrame(() => {
    for (const { panel, corner, facing } of pending) positionPanel(panel, corner, facing);
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

// Position a HUD panel at a corner with optional rotation.
// Must be called after the element is in the DOM (needs real offsetWidth/Height).
function positionPanel(el, corner, facing) {
  const deg = facingToDeg(facing);
  const margin = 20;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W  = el.offsetWidth;
  const H  = el.offsetHeight;

  el.style.transformOrigin = 'center center';
  el.style.transform = deg ? `rotate(${deg}deg)` : '';
  el.style.right = el.style.bottom = '';

  // For 90°/270° the visual footprint swaps W and H
  const visW = (deg === 90 || deg === 270) ? H : W;
  const visH = (deg === 90 || deg === 270) ? W : H;

  let cx, cy;
  switch (corner) {
    case 'top-right':    cx = vw - margin - visW / 2; cy = margin + visH / 2;      break;
    case 'bottom-left':  cx = margin + visW / 2;      cy = vh - margin - visH / 2; break;
    case 'bottom-right': cx = vw - margin - visW / 2; cy = vh - margin - visH / 2; break;
    default:             cx = margin + visW / 2;      cy = margin + visH / 2;      break; // top-left
  }

  el.style.left = (cx - W / 2) + 'px';
  el.style.top  = (cy - H / 2) + 'px';
  el.style.visibility = '';
}

function buildInitiativeHudPanels(hud) {
  const sides = hud.sides?.length
    ? hud.sides
    : [{ corner: hud.side ?? 'top-left', facing: 'up' }];
  return sides.map(({ corner, facing }) => ({
    panel: buildInitiativeHudPanel(hud, corner, facing),
    corner, facing,
  }));
}

function buildInitiativeHudPanel(hud, corner, facing) {
  const fontSize = hud.fontSize ?? 14;

  const panel = document.createElement('div');
  panel.className = 'hud-panel';
  panel.style.fontSize   = fontSize + 'px';
  panel.style.visibility = 'hidden'; // shown by positionPanel after layout
  panel.style.left = '-9999px'; panel.style.top = '0';

  // ── Header row (title + collapse toggle) ──────────────────────────────────
  const header = document.createElement('div');
  header.className = 'hud-header';

  const title = document.createElement('div');
  title.className   = 'hud-title';
  title.textContent = 'Initiative';
  header.appendChild(title);

  const collapseBtn = document.createElement('button');
  collapseBtn.className   = 'hud-collapse-btn';
  collapseBtn.textContent = '−';
  collapseBtn.title       = 'Collapse / Expand';
  header.appendChild(collapseBtn);

  panel.appendChild(header);

  // ── Entry list (collapsible) ──────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'hud-body';

  const entries = hud.entries ?? [];
  entries.forEach((entry, i) => {
    const isActive = hud.combat && i === (hud.currentIndex ?? 0);

    const row = document.createElement('div');
    row.className = 'initiative-entry' + (isActive ? ' active-turn' : '');

    const badge = document.createElement('span');
    badge.className   = 'initiative-badge';
    badge.textContent = entry.initiative ?? '';

    const name = document.createElement('span');
    name.className   = 'initiative-name';
    // hidden = true → show as ??? (the GM is hiding their identity but players know someone is there)
    name.textContent = entry.hidden ? '???' : (entry.name || '—');

    row.appendChild(badge);
    row.appendChild(name);

    if (entry.hp > 0) {
      const currentHp = Math.max(0, entry.hp - (entry.damage ?? 0));
      const hpEl = document.createElement('span');
      hpEl.className   = 'initiative-hp';
      hpEl.textContent = `${currentHp}/${entry.hp}`;
      row.appendChild(hpEl);
    }

    const statuses = document.createElement('span');
    statuses.className = 'initiative-statuses';
    for (const s of (entry.statuses ?? [])) {
      const pip = document.createElement('span');
      pip.className        = 'status-pip';
      pip.style.background = s.color ?? '#888';
      pip.title            = s.label ?? '';
      statuses.appendChild(pip);
    }
    row.appendChild(statuses);

    body.appendChild(row);
  });

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:0.8em;color:#3a3a5e;font-style:italic;padding:4px 0;';
    empty.textContent = 'No entries';
    body.appendChild(empty);
  }

  panel.appendChild(body);

  // ── Collapse toggle ───────────────────────────────────────────────────────
  let collapsed = false;
  collapseBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    body.style.display      = collapsed ? 'none' : '';
    collapseBtn.textContent = collapsed ? '+' : '−';
  });

  // ── Drag by header (always uses left/top since positionPanel sets those) ──
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
    if (e.target === collapseBtn) return;
    dragX     = e.clientX;
    dragY     = e.clientY;
    startLeft = parseInt(panel.style.left) || 0;
    startTop  = parseInt(panel.style.top)  || 0;
    header.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    e.preventDefault();
  });
  header.style.cursor = 'grab';

  return panel;
}

function buildStatusHud(hud) {
  const panel = document.createElement('div');
  panel.className = 'hud-panel';
  applyHudSide(panel, hud.side ?? 'top-right');

  const header = document.createElement('div');
  header.className = 'hud-header';
  const title = document.createElement('div');
  title.className = 'hud-title';
  title.textContent = hud.label ?? 'Status';
  header.appendChild(title);

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'hud-collapse-btn';
  collapseBtn.textContent = '−';
  header.appendChild(collapseBtn);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'hud-body';
  const entries = hud.entries ?? [];
  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'status-entry';
    const name = document.createElement('span');
    name.className = 'status-name';
    name.textContent = entry.name || '—';
    row.appendChild(name);
    if (entry.hp != null) {
      const hp = document.createElement('span');
      hp.className = 'status-hp';
      hp.textContent = entry.hp;
      row.appendChild(hp);
    }
    body.appendChild(row);
  });
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:11px;color:#3a3a5e;font-style:italic;padding:4px 0;';
    empty.textContent = 'No entries';
    body.appendChild(empty);
  }
  panel.appendChild(body);

  let collapsed = false;
  collapseBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? 'none' : '';
    collapseBtn.textContent = collapsed ? '+' : '−';
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

// ── IPC ───────────────────────────────────────────────────────────────────────
window.electronAPI.onSceneUpdate((newScene) => {
  // Purge stale media entries
  const layerIds = new Set(newScene.layers.map(l => l.id));
  for (const [k] of mediaCache) {
    if (!layerIds.has(k.split('::')[0])) mediaCache.delete(k);
  }
  // Purge weather particles for removed types
  const newTypes = new Set(newScene.layers.filter(l => l.type === 'weather').map(l => l.weatherType));
  for (const [t] of weatherParticles) {
    if (!newTypes.has(t)) weatherParticles.delete(t);
  }
  scene = newScene;
  renderHuds();
});

window.electronAPI.onLayersUpdate((layers) => {
  const newTypes = new Set(layers.filter(l => l.type === 'weather').map(l => l.weatherType));
  for (const [t] of weatherParticles) {
    if (!newTypes.has(t)) weatherParticles.delete(t);
  }
  scene = { ...scene, layers };
});

window.electronAPI.onHudsUpdate((huds) => {
  scene = { ...scene, huds };
  renderHuds();
});

window.electronAPI.onViewportUpdate((viewport) => {
  scene = { ...scene, viewport };
});

window.electronAPI.onSettingsUpdate((incoming) => {
  settings = { ...settings, ...incoming };
});

window.electronAPI.onPing((x, y) => showPing(x, y));

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
