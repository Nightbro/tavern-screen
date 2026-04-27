import { LayerBase } from './LayerBase.js';

export class ImageLayer extends LayerBase {
  getType()     { return 'image'; }
  getBadge()    { return 'Img'; }
  getDefaults() { return { type: 'image', visible: true, opacity: 1 }; }

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
      const img = new Image();
      img.onload = () => { img.loaded = true; onImageLoaded?.(); };
      img.src = layer.src;
      imageCache.set(key, img);
    }
    const img = imageCache.get(key);
    if (img?.loaded) {
      overlayCtx.save();
      overlayCtx.globalAlpha = layer.opacity ?? 1;
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
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      const s  = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const iw = img.naturalWidth  * s;
      const ih = img.naturalHeight * s;
      canvasCtx.drawImage(img, (cw - iw) / 2, (ch - ih) / 2, iw, ih);
    }
    canvasCtx.restore();
  }
}
