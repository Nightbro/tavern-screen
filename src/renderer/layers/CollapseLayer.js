import { LayerBase } from './LayerBase.js';

const CRACK_DURATION = 0.45;
const FALL_DURATION  = 0.75;

function generateCracks(seed) {
  const cx = 0.3 + (seed * 0.37) % 0.4;
  const cy = 0.3 + (seed * 0.53) % 0.4;
  const count = 3 + (seed % 2);
  const cracks = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (seed * 0.1) % 1;
    const len   = 0.35 + ((seed * (i + 1) * 0.17) % 0.3);
    const endX  = cx + Math.cos(angle) * len;
    const endY  = cy + Math.sin(angle) * len;
    const midX  = (cx + endX) / 2 + ((seed * (i + 1) * 0.23) % 0.1) - 0.05;
    const midY  = (cy + endY) / 2 + ((seed * (i + 1) * 0.19) % 0.1) - 0.05;
    cracks.push({ cx, cy, midX, midY, endX, endY });
  }
  return cracks;
}

function calcGrid(layerW, layerH, settings) {
  const cellPx = (settings?.cellSizeInches ?? 1) * (settings?.dpi ?? 96);
  const cols   = Math.max(2, Math.min(30, Math.round((layerW ?? 200) / cellPx)));
  const rows   = Math.max(2, Math.min(30, Math.round((layerH ?? 200) / cellPx)));
  return { cols, rows };
}

function initCollapseAnimation(layer, timestamp, cols, rows) {
  const centerC  = (cols - 1) / 2;
  const centerR  = (rows - 1) / 2;
  const maxDist  = Math.sqrt(centerC * centerC + centerR * centerR) || 1;
  let maxDelay   = 0;
  const tiles    = [];
  const idSeed   = layer.id ? layer.id.charCodeAt(0) : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dist     = Math.sqrt((c - centerC) ** 2 + (r - centerR) ** 2);
      const jitter   = (Math.sin(c * 7.3 + r * 3.1) * 0.5 + 0.5) * 0.15;
      const delay    = (dist / maxDist) * 0.5 + jitter;
      maxDelay       = Math.max(maxDelay, delay);

      const seed  = c * 1000 + r * 37 + idSeed;
      const shade = 95 + Math.floor((Math.sin(seed * 0.031) * 0.5 + 0.5) * 40);
      tiles.push({
        col: c, row: r,
        delay,
        angleVel: (Math.sin(c * 5.1 + r * 2.7) - 0.5) * 0.18,
        cracks: generateCracks(seed),
        color: `rgb(${shade},${shade - 6},${shade - 12})`,
      });
    }
  }

  return { tiles, cols, rows, startTime: timestamp, totalDuration: maxDelay + CRACK_DURATION + FALL_DURATION };
}

function drawTileIntact(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const b = Math.max(1, Math.min(w, h) * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fillRect(x, y, w, b);
  ctx.fillRect(x, y, b, h);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x, y + h - b, w, b);
  ctx.fillRect(x + w - b, y, b, h);
}

function drawCracks(ctx, x, y, w, h, cracks, progress) {
  ctx.save();
  ctx.strokeStyle = '#140c08';
  ctx.lineWidth   = Math.max(0.8, Math.min(w, h) * 0.028);
  ctx.lineCap     = 'round';
  for (let i = 0; i < cracks.length; i++) {
    const crack = cracks[i];
    const cp    = Math.min(1, progress * 1.5 - (i / cracks.length) * 0.3);
    if (cp <= 0) continue;
    const cx1  = x + crack.cx   * w;
    const cy1  = y + crack.cy   * h;
    const ex   = x + crack.endX * w;
    const ey   = y + crack.endY * h;
    const endX = cx1 + (ex - cx1) * cp;
    const endY = cy1 + (ey - cy1) * cp;
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    if (Math.min(w, h) > 20) {
      const cpX = cx1 + (x + crack.midX * w - cx1) * cp;
      const cpY = cy1 + (y + crack.midY * h - cy1) * cp;
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    } else {
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawVoid(canvasCtx, sx, sy, sw, sh) {
  canvasCtx.fillStyle = '#080508';
  canvasCtx.fillRect(sx, sy, sw, sh);
  const g = canvasCtx.createRadialGradient(
    sx + sw / 2, sy + sh / 2, 0,
    sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.65,
  );
  g.addColorStop(0, 'rgba(40,10,20,0.65)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  canvasCtx.fillStyle = g;
  canvasCtx.fillRect(sx, sy, sw, sh);
}

export class CollapseLayer extends LayerBase {
  getType()     { return 'collapse'; }
  getBadge()    { return 'CF'; }
  getDefaults() {
    return { type: 'collapse', visible: true, collapseState: 'idle' };
  }

  renderEditorFields(layer, addField, ctx) {
    const stateEl = document.createElement('span');
    const cs = layer.collapseState ?? 'idle';
    stateEl.textContent = cs.charAt(0).toUpperCase() + cs.slice(1);
    stateEl.style.cssText = 'font-size:11px;color:#aaa;';
    addField('State', stateEl);

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:6px;';

    const triggerBtn = document.createElement('button');
    triggerBtn.className   = 'btn-primary-sm';
    triggerBtn.textContent = 'Collapse!';
    triggerBtn.disabled    = cs === 'collapsing';
    triggerBtn.addEventListener('click', async () => {
      const newLayers = await ctx.updateLayer(layer.id, { collapseState: 'collapsing' });
      if (newLayers) {
        const updated = newLayers.find(l => l.id === layer.id);
        if (updated) ctx.refreshDetail(updated);
      }
    });

    const resetBtn = document.createElement('button');
    resetBtn.className   = 'btn-ghost-sm';
    resetBtn.textContent = 'Reset';
    resetBtn.disabled    = cs === 'idle';
    resetBtn.addEventListener('click', async () => {
      const newLayers = await ctx.updateLayer(layer.id, { collapseState: 'idle' });
      if (newLayers) {
        const updated = newLayers.find(l => l.id === layer.id);
        if (updated) ctx.refreshDetail(updated);
      }
    });

    btnWrap.appendChild(triggerBtn);
    btnWrap.appendChild(resetBtn);
    addField('', btnWrap);
  }

  drawGMPreview(layer, overlayCtx, bounds, _gmCtx) {
    const { px, py, pw, ph } = bounds;
    const cs = layer.collapseState ?? 'idle';
    overlayCtx.save();

    overlayCtx.fillStyle = cs === 'collapsed'
      ? 'rgba(20,8,12,0.75)'
      : cs === 'collapsing'
        ? 'rgba(110,55,15,0.45)'
        : 'rgba(120,100,70,0.25)';
    overlayCtx.fillRect(px, py, pw, ph);

    const { cols, rows } = calcGrid(layer.w, layer.h, window.settings);
    const tw   = pw / cols;
    const th   = ph / rows;
    overlayCtx.strokeStyle = cs === 'idle' ? 'rgba(180,155,110,0.45)' : 'rgba(210,100,40,0.6)';
    overlayCtx.lineWidth   = 0.5;
    overlayCtx.beginPath();
    for (let c = 1; c < cols; c++) { overlayCtx.moveTo(px + c * tw, py); overlayCtx.lineTo(px + c * tw, py + ph); }
    for (let r = 1; r < rows; r++) { overlayCtx.moveTo(px, py + r * th); overlayCtx.lineTo(px + pw, py + r * th); }
    overlayCtx.stroke();

    overlayCtx.fillStyle    = cs === 'idle' ? 'rgba(210,185,140,0.75)' : 'rgba(255,150,50,0.95)';
    overlayCtx.font         = `bold ${Math.max(8, Math.min(13, ph * 0.2))}px monospace`;
    overlayCtx.textAlign    = 'center';
    overlayCtx.textBaseline = 'middle';
    overlayCtx.fillText(cs === 'idle' ? 'Collapse Floor' : cs.toUpperCase(), px + pw / 2, py + ph / 2);

    overlayCtx.restore();
  }

  // Called per-frame from screen-advanced-layers.js
  drawCollapseFrame(layer, canvasCtx, timestamp, collapseAnimations, deps) {
    const cs = layer.collapseState ?? 'idle';

    if (cs === 'idle') {
      collapseAnimations.delete(layer.id);
      return;
    }

    const tx = deps.computeMapTransform(deps.viewport);
    const sx = tx.originX + (layer.x ?? 0) * tx.zoom;
    const sy = tx.originY + (layer.y ?? 0) * tx.zoom;
    const sw = (layer.w ?? 200) * tx.zoom;
    const sh = (layer.h ?? 200) * tx.zoom;

    canvasCtx.save();
    drawVoid(canvasCtx, sx, sy, sw, sh);

    if (cs === 'collapsed') {
      canvasCtx.restore();
      return;
    }

    // 'collapsing' — init or advance animation
    if (!collapseAnimations.has(layer.id)) {
      const { cols, rows } = calcGrid(layer.w, layer.h, deps.settings);
      collapseAnimations.set(layer.id, initCollapseAnimation(layer, timestamp, cols, rows));
    }
    const anim    = collapseAnimations.get(layer.id);
    const elapsed = (timestamp - anim.startTime) / 1000;
    const tileW   = sw / anim.cols;
    const tileH   = sh / anim.rows;

    canvasCtx.beginPath();
    canvasCtx.rect(sx, sy, sw, sh);
    canvasCtx.clip();

    for (const tile of anim.tiles) {
      const t = elapsed - tile.delay;

      if (t < 0) {
        drawTileIntact(canvasCtx, sx + tile.col * tileW, sy + tile.row * tileH, tileW, tileH, tile.color);
        continue;
      }
      if (t >= CRACK_DURATION + FALL_DURATION) continue; // fully gone

      const tx2 = sx + tile.col * tileW;
      const ty2 = sy + tile.row * tileH;

      if (t < CRACK_DURATION) {
        drawTileIntact(canvasCtx, tx2, ty2, tileW, tileH, tile.color);
        drawCracks(canvasCtx, tx2, ty2, tileW, tileH, tile.cracks, t / CRACK_DURATION);
      } else {
        const fallT  = (t - CRACK_DURATION) / FALL_DURATION;
        const fallY  = fallT * fallT * sh * 1.4;
        const angle  = tile.angleVel * fallT * Math.PI * 2;
        const alpha  = Math.max(0, 1 - fallT * 1.15);

        canvasCtx.save();
        canvasCtx.globalAlpha = alpha;
        canvasCtx.translate(tx2 + tileW / 2, ty2 + tileH / 2 + fallY);
        canvasCtx.rotate(angle);
        drawTileIntact(canvasCtx, -tileW / 2, -tileH / 2, tileW, tileH, tile.color);
        drawCracks(canvasCtx, -tileW / 2, -tileH / 2, tileW, tileH, tile.cracks, 1.0);
        canvasCtx.restore();
      }
    }

    canvasCtx.restore();
  }
}
