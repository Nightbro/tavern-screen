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
