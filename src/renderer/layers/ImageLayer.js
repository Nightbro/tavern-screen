import { LayerBase } from './LayerBase.js';

export class ImageLayer extends LayerBase {
  getType()     { return 'image'; }
  getBadge()    { return 'Img'; }
  getDefaults() { return { type: 'image', visible: true, opacity: 1 }; }

  renderEditorFields(layer, addField, ctx) {
    this._buildSrcPicker(layer, addField, ctx);
    this._buildOpacityField(layer, addField, ctx, 1);
    this._buildSizeFields(layer, addField, ctx);
  }

  drawGMPreview(layer, overlayCtx, bounds, gmCtx) {
    if (!layer.src) { super.drawGMPreview(layer, overlayCtx, bounds, gmCtx); return; }
    const { px, py, pw, ph } = bounds;
    const { imageCache, onImageLoaded } = gmCtx;
    const key = layer.id + '::' + layer.src;
    if (!imageCache.has(key)) {
      const img = new Image();
      img.onload = () => { img.loaded = true; onImageLoaded?.(); };
      img.src = layer.src;
      imageCache.set(key, img);
    }
    const img = imageCache.get(key);
    if (img?.loaded) {
      overlayCtx.save();
      overlayCtx.globalAlpha = (layer.opacity ?? 1) * (gmCtx.ghostAlpha ?? 1);
      overlayCtx.drawImage(img, px, py, pw, ph);
      overlayCtx.restore();
    } else {
      super.drawGMPreview(layer, overlayCtx, bounds, gmCtx);
    }
  }

  drawPlayerLayer(layer, canvasCtx, tx, deps) {
    const img = deps.getMedia(layer);
    if (!img?.loaded) return;
    canvasCtx.save();
    canvasCtx.globalAlpha = layer.opacity ?? 1;
    if (layer.w != null && layer.h != null) {
      const x = tx.originX + (layer.x ?? 0) * tx.zoom;
      const y = tx.originY + (layer.y ?? 0) * tx.zoom;
      canvasCtx.drawImage(img, x, y, layer.w * tx.zoom, layer.h * tx.zoom);
    } else {
      // No explicit bounds: fit to screen and anchor to canvas centre so zoom/pan work.
      const cw   = window.innerWidth;
      const ch   = window.innerHeight;
      const s    = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const iw   = img.naturalWidth  * s * tx.zoom;
      const ih   = img.naturalHeight * s * tx.zoom;
      const half = (deps.CANVAS_SIZE ?? 8192) / 2;
      const px   = tx.originX + half * tx.zoom - iw / 2;
      const py   = tx.originY + half * tx.zoom - ih / 2;
      canvasCtx.drawImage(img, px, py, iw, ih);
    }
    canvasCtx.restore();
  }
}
