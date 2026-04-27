import { LayerBase } from './LayerBase.js';

export class VideoLayer extends LayerBase {
  getType()     { return 'video'; }
  getBadge()    { return 'Vid'; }
  getDefaults() { return { type: 'video', visible: true, opacity: 1 }; }

  renderEditorFields(layer, addField, ctx) {
    this._buildSrcPicker(layer, addField, ctx);
    this._buildOpacityField(layer, addField, ctx, 1);
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
      canvasCtx.drawImage(vid, 0, 0, window.innerWidth, window.innerHeight);
    }
    canvasCtx.restore();
  }
}
