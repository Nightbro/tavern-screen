import { ILayer }         from './ILayer.js';
import { LAYER_GM_COLORS } from './settings-layers.js';

export class LayerBase extends ILayer {
  // Default GM preview: colored fill rectangle keyed by type.
  drawGMPreview(layer, overlayCtx, bounds, gmCtx) {
    const { px, py, pw, ph } = bounds;
    overlayCtx.save();
    overlayCtx.fillStyle = LAYER_GM_COLORS[layer.type] ?? 'rgba(74,144,217,0.15)';
    overlayCtx.fillRect(px, py, pw, ph);
    overlayCtx.restore();
  }

  // Default: no-op (weather skips standard layer drawing).
  drawPlayerLayer(layer, canvasCtx, tx, deps) {}

  // ── Shared GM editor helpers ──────────────────────────────────────────────────

  // Source-file picker row (used by image, gif, video).
  _buildSrcPicker(layer, addField, ctx) {
    const srcWrap = document.createElement('div');
    srcWrap.style.cssText = 'display:flex;gap:4px;flex:1;min-width:0;align-items:center;';

    const srcSpan = document.createElement('span');
    srcSpan.style.cssText = 'font-size:10px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
    srcSpan.title       = layer.src ?? '';
    srcSpan.textContent = layer.src ? layer.src.split(/[/\\]/).at(-1) : '(none)';

    const pickBtn = document.createElement('button');
    pickBtn.className   = 'btn-ghost-sm';
    pickBtn.textContent = '📁';
    pickBtn.title       = 'Pick file';
    pickBtn.addEventListener('click', async () => {
      const files = await window.electronAPI.openMapDialog();
      if (!files.length) return;
      const src       = 'file:///' + files[0].replace(/\\/g, '/');
      const hasBounds = layer.w != null && layer.h != null;
      const sizeBounds = hasBounds ? {} : await ctx.imageBoundsFromSrc(src);
      const newLayers = await ctx.updateLayer(layer.id, { src, ...sizeBounds });
      if (newLayers) {
        const updated = newLayers.find(l => l.id === layer.id);
        if (updated) ctx.refreshDetail(updated);
      }
    });

    srcWrap.appendChild(srcSpan);
    srcWrap.appendChild(pickBtn);
    addField('Src', srcWrap);
  }

  // W/H in grid cells + lock aspect ratio toggle.
  _buildSizeFields(layer, addField, ctx) {
    const { settings } = ctx;
    const cellInch = settings?.cellSizeInches || 0;
    const dpi      = settings?.dpi || 0;
    const cellPx   = cellInch && dpi ? cellInch * dpi : 0;

    const aspect = (layer.w && layer.h) ? layer.w / layer.h : null;

    const buildLockBtn = () => {
      const btn = document.createElement('button');
      btn.className   = 'btn-ghost-sm';
      btn.title       = layer.lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio';
      btn.textContent = layer.lockAspect ? '🔒' : '🔓';
      btn.addEventListener('click', async () => {
        const newLayers = await ctx.updateLayer(layer.id, { lockAspect: !layer.lockAspect });
        if (newLayers) {
          const updated = newLayers.find(l => l.id === layer.id);
          if (updated) ctx.refreshDetail(updated);
        }
      });
      return btn;
    };

    if (cellPx) {
      const toCell = px => +(px / cellPx).toFixed(2);
      const toPx   = c  => Math.max(1, Math.round(c * cellPx));

      // W row: input + lock button
      const wWrap = document.createElement('div');
      wWrap.style.cssText = 'display:flex;gap:4px;align-items:center;flex:1;min-width:0;';
      const wInput = document.createElement('input');
      wInput.type = 'number'; wInput.min = '0.25'; wInput.step = '0.5';
      wInput.value = toCell(layer.w ?? 0);
      wInput.style.cssText = 'flex:1;min-width:0;';
      wWrap.appendChild(wInput);
      wWrap.appendChild(buildLockBtn());
      addField('W (cells)', wWrap);

      wInput.addEventListener('change', async () => {
        const newW = toPx(parseFloat(wInput.value) || 1);
        const patch = layer.lockAspect && aspect ? { w: newW, h: Math.round(newW / aspect) } : { w: newW };
        const newLayers = await ctx.updateLayer(layer.id, patch);
        if (newLayers) {
          const updated = newLayers.find(l => l.id === layer.id);
          if (updated) ctx.refreshDetail(updated);
        }
      });

      // H row
      const hInput = document.createElement('input');
      hInput.type = 'number'; hInput.min = '0.25'; hInput.step = '0.5';
      hInput.value = toCell(layer.h ?? 0);
      addField('H (cells)', hInput);

      hInput.addEventListener('change', async () => {
        const newH = toPx(parseFloat(hInput.value) || 1);
        const patch = layer.lockAspect && aspect ? { h: newH, w: Math.round(newH * aspect) } : { h: newH };
        const newLayers = await ctx.updateLayer(layer.id, patch);
        if (newLayers) {
          const updated = newLayers.find(l => l.id === layer.id);
          if (updated) ctx.refreshDetail(updated);
        }
      });
    } else {
      // Grid not configured — show lock-only row
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:4px;align-items:center;flex:1;';
      wrap.appendChild(buildLockBtn());
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:10px;color:#444;';
      hint.textContent = 'Set grid DPI to edit in cells';
      wrap.appendChild(hint);
      addField('Aspect', wrap);
    }
  }

  // Opacity number input (0–1) with a configurable default.
  _buildOpacityField(layer, addField, ctx, defaultVal = 1) {
    const opInput = document.createElement('input');
    opInput.type  = 'number'; opInput.min = 0; opInput.max = 1; opInput.step = 0.05;
    opInput.value = layer.opacity ?? defaultVal;
    addField('Opacity', opInput);
    opInput.addEventListener('change', async () => {
      await ctx.updateLayer(layer.id, { opacity: parseFloat(opInput.value) || defaultVal });
    });
  }
}
