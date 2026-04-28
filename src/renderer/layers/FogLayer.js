import { LayerBase } from './LayerBase.js';

export class FogLayer extends LayerBase {
  getType()     { return 'fog'; }
  getBadge()    { return 'Fog'; }
  getDefaults() { return { type: 'fog', visible: true, revealed: [] }; }

  renderEditorFields(layer, addField, ctx) {
    const colorInput = document.createElement('input');
    colorInput.type  = 'color'; colorInput.value = layer.color ?? '#050508';
    addField('Color', colorInput);
    colorInput.addEventListener('input', async () => {
      await ctx.updateLayer(layer.id, { color: colorInput.value });
    });

    this._buildOpacityField(layer, addField, ctx, 0.9);
  }

  drawPlayerLayer(layer, canvasCtx, tx, deps) {
    const { CANVAS_SIZE } = deps;
    const fx = layer.x != null ? tx.originX + layer.x * tx.zoom : tx.originX;
    const fy = layer.y != null ? tx.originY + layer.y * tx.zoom : tx.originY;
    const fw = layer.w != null ? layer.w * tx.zoom : CANVAS_SIZE * tx.zoom;
    const fh = layer.h != null ? layer.h * tx.zoom : CANVAS_SIZE * tx.zoom;

    canvasCtx.save();
    canvasCtx.globalAlpha = layer.opacity ?? 0.9;
    canvasCtx.fillStyle   = layer.color ?? '#050508';
    canvasCtx.fillRect(fx, fy, fw, fh);

    if (layer.revealed?.length) {
      canvasCtx.globalCompositeOperation = 'destination-out';
      canvasCtx.globalAlpha = 1;
      for (const c of layer.revealed) {
        canvasCtx.beginPath();
        canvasCtx.arc(
          tx.originX + c.x * tx.zoom,
          tx.originY + c.y * tx.zoom,
          c.r * tx.zoom,
          0, Math.PI * 2
        );
        canvasCtx.fill();
      }
      canvasCtx.globalCompositeOperation = 'source-over';
    }

    canvasCtx.restore();
  }
}
