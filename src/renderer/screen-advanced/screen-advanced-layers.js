import { ctx, CANVAS_SIZE, state, getMedia, weatherParticles, collapseAnimations, computeMapTransform } from './screen-advanced-state.js';
import { LAYER_REGISTRY } from '../layers/index.js';

export function drawLayer(layer, tx) {
  if (layer.type === 'weather')  return;
  if (layer.type === 'gif')      return; // rendered via DOM gif-host overlay
  if (layer.type === 'collapse') return; // rendered via drawCollapseLayer
  LAYER_REGISTRY[layer.type]?.drawPlayerLayer(layer, ctx, tx, { CANVAS_SIZE, getMedia });
}

export function drawGrid(tx) {
  const scalesWithVp = state.settings.gridScaleWithViewport !== false;
  const cellPx = state.settings.cellSizeInches * state.settings.dpi * (scalesWithVp ? tx.zoom : 1.0);
  if (cellPx < 4) return;

  const cw  = window.innerWidth;
  const ch  = window.innerHeight;
  const hex = state.settings.gridColor.replace('#', '');
  const r   = parseInt(hex.slice(0, 2), 16);
  const g2  = parseInt(hex.slice(2, 4), 16);
  const b   = parseInt(hex.slice(4, 6), 16);

  ctx.save();
  ctx.strokeStyle = `rgba(${r},${g2},${b},${state.settings.gridOpacity})`;
  ctx.lineWidth   = 1;
  ctx.beginPath();

  const startX = scalesWithVp ? ((tx.originX % cellPx) + cellPx) % cellPx : 0;
  const startY = scalesWithVp ? ((tx.originY % cellPx) + cellPx) % cellPx : 0;

  for (let x = startX; x <= cw; x += cellPx) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
  for (let y = startY; y <= ch; y += cellPx) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }

  ctx.stroke();
  ctx.restore();
}

export function setLastWeatherTs(ts) {
  LAYER_REGISTRY.weather.setLastTs(ts);
}

export function drawWeatherLayer(layer, timestamp) {
  LAYER_REGISTRY.weather.drawWeatherFrame(layer, ctx, timestamp, weatherParticles, {
    computeMapTransform,
    viewport: state.scene.viewport,
  });
}

export function drawCollapseLayer(layer, timestamp) {
  LAYER_REGISTRY.collapse.drawCollapseFrame(layer, ctx, timestamp, collapseAnimations, {
    computeMapTransform,
    viewport:  state.scene.viewport,
    settings:  state.settings,
  });
}
