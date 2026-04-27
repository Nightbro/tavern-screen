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
      // No explicit bounds: anchor to canvas centre so zoom/pan work.
      const cw   = window.innerWidth;
      const ch   = window.innerHeight;
      const iw   = cw * tx.zoom;
      const ih   = ch * tx.zoom;
      const half = (deps.CANVAS_SIZE ?? 8192) / 2;
      const px   = tx.originX + half * tx.zoom - iw / 2;
      const py   = tx.originY + half * tx.zoom - ih / 2;
      canvasCtx.drawImage(vid, px, py, iw, ih);
    }
    canvasCtx.restore();
  }
}
