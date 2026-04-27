import { LayerBase } from './LayerBase.js';

export class LightLayer extends LayerBase {
  getType()     { return 'light'; }
  getBadge()    { return 'Lgt'; }
  getDefaults() { return { type: 'light', visible: true, color: '#000033', opacity: 0.6 }; }

  renderEditorFields(layer, addField, ctx) {
    const colorInput = document.createElement('input');
    colorInput.type  = 'color'; colorInput.value = layer.color ?? '#000033';
    addField('Color', colorInput);
    colorInput.addEventListener('input', async () => {
      await ctx.updateLayer(layer.id, { color: colorInput.value });
    });

    this._buildOpacityField(layer, addField, ctx, 0.6);
  }

  drawPlayerLayer(layer, canvasCtx, tx, deps) {
    const x = layer.x != null ? tx.originX + layer.x * tx.zoom : 0;
    const y = layer.y != null ? tx.originY + layer.y * tx.zoom : 0;
    const w = layer.w != null ? layer.w * tx.zoom : window.innerWidth;
    const h = layer.h != null ? layer.h * tx.zoom : window.innerHeight;
    canvasCtx.save();
    canvasCtx.globalAlpha = layer.opacity ?? 0.5;
    canvasCtx.fillStyle   = layer.color   ?? '#1a2a4a';
    canvasCtx.fillRect(x, y, w, h);
    canvasCtx.restore();
  }
}
