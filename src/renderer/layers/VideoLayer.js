import { LayerBase } from './LayerBase.js';

export class VideoLayer extends LayerBase {
  getType()     { return 'video'; }
  getBadge()    { return 'Vid'; }
  getDefaults() { return { type: 'video', visible: true, opacity: 1 }; }

  renderEditorFields(layer, addField, ctx) {
    this._buildSrcPicker(layer, addField, ctx);
    this._buildOpacityField(layer, addField, ctx, 1);
  }

  drawGMPreview(layer, overlayCtx, bounds, gmCtx) {
    if (!layer.src) { super.drawGMPreview(layer, overlayCtx, bounds, gmCtx); return; }
    const { px, py, pw, ph } = bounds;
    const { imageCache, onImageLoaded } = gmCtx;
    const key = layer.id + '::' + layer.src;
    if (!imageCache.has(key)) {
      const vid = document.createElement('video');
      vid.muted    = true;
      vid.preload  = 'auto';
      vid.src      = layer.src;
      vid.loaded   = false;
      vid.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;width:0;height:0;';
      document.body.appendChild(vid);
      vid.addEventListener('loadeddata', () => { vid.loaded = true; onImageLoaded?.(); });
      imageCache.set(key, vid);
    }
    const vid = imageCache.get(key);
    if (vid?.loaded) {
      overlayCtx.save();
      overlayCtx.globalAlpha = (layer.opacity ?? 1) * (gmCtx.ghostAlpha ?? 1);
      overlayCtx.drawImage(vid, px, py, pw, ph);
      overlayCtx.restore();
    } else {
      super.drawGMPreview(layer, overlayCtx, bounds, gmCtx);
    }
  }

  drawPlayerLayer(layer, canvasCtx, tx, deps) {
    const vid = deps.getMedia(layer);
    if (!vid?.loaded) return;
    canvasCtx.save();
    canvasCtx.globalAlpha = layer.opacity ?? 1;
    if (layer.w != null && layer.h != null) {
      const x = tx.originX + (layer.x ?? 0) * tx.zoom;
      const y = tx.originY + (layer.y ?? 0) * tx.zoom;
      canvasCtx.drawImage(vid, x, y, layer.w * tx.zoom, layer.h * tx.zoom);
    } else {
      // No explicit bounds: cover the viewport in screen space, ignoring scene transform.
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      const vw = vid.videoWidth  || cw;
      const vh = vid.videoHeight || ch;
      const s  = Math.max(cw / vw, ch / vh);
      const dw = vw * s;
      const dh = vh * s;
      canvasCtx.drawImage(vid, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
    canvasCtx.restore();
  }
}
