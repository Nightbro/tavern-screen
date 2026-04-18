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
