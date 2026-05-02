import { canvas, ctx, state, mediaCache, weatherParticles, collapseAnimations, gifHost, computeMapTransform } from './screen-advanced-state.js';
import { drawLayer, drawGrid, drawWeatherLayer, drawCollapseLayer, setLastWeatherTs } from './screen-advanced-layers.js';
import { renderHuds, showPing }                   from './screen-advanced-huds.js';

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resize() {
  const dpr     = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  weatherParticles.clear();
}

// ── GIF overlay ───────────────────────────────────────────────────────────────
function syncGifLayers(layers, tx) {
  const gifLayers = layers.filter(l => l.type === 'gif' && l.visible !== false);
  const activeIds = new Set(gifLayers.map(l => l.id));
  for (const el of [...gifHost.children]) {
    if (!activeIds.has(el.dataset.layerId)) el.remove();
  }
  for (const layer of gifLayers) {
    let el = gifHost.querySelector(`[data-layer-id="${layer.id}"]`);
    if (!el) {
      el = document.createElement('img');
      el.dataset.layerId = layer.id;
      el.draggable = false;
      el.style.position = 'absolute';
      gifHost.appendChild(el);
    }
    if (el.getAttribute('src') !== (layer.src || '')) el.src = layer.src || '';
    el.style.opacity = layer.opacity ?? 1;
    if (layer.w != null && layer.h != null) {
      const x = tx.originX + (layer.x ?? 0) * tx.zoom;
      const y = tx.originY + (layer.y ?? 0) * tx.zoom;
      el.style.left      = x + 'px';
      el.style.top       = y + 'px';
      el.style.width     = (layer.w * tx.zoom) + 'px';
      el.style.height    = (layer.h * tx.zoom) + 'px';
      el.style.objectFit = 'fill';
    } else {
      el.style.left      = '0';
      el.style.top       = '0';
      el.style.width     = '100vw';
      el.style.height    = '100vh';
      el.style.objectFit = 'contain';
    }
  }
}

// ── Render loop ───────────────────────────────────────────────────────────────
function render(timestamp) {
  requestAnimationFrame(render);

  const cw = window.innerWidth;
  const ch = window.innerHeight;

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = state.scene.background ?? '#0d0d1a';
  ctx.fillRect(0, 0, cw, ch);

  const tx = computeMapTransform(state.scene.viewport);

  for (const layer of state.scene.layers) {
    if (layer.visible === false) continue;
    drawLayer(layer, tx);
  }

  syncGifLayers(state.scene.layers, tx);

  const weatherLayers  = state.scene.layers.filter(l => l.type === 'weather'  && l.visible !== false);
  const collapseLayers = state.scene.layers.filter(l => l.type === 'collapse' && l.visible !== false);
  for (const wl of weatherLayers)  drawWeatherLayer(wl, timestamp);
  for (const cl of collapseLayers) drawCollapseLayer(cl, timestamp);
  if (weatherLayers.length) setLastWeatherTs(timestamp);

  if (state.settings.gridVisible) drawGrid(tx);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
window.electronAPI.onSceneUpdate((newScene) => {
  const layerIds = new Set(newScene.layers.map(l => l.id));
  for (const [k, el] of mediaCache) {
    if (!layerIds.has(k.split('::')[0])) { el.remove?.(); mediaCache.delete(k); }
  }
  const activeWeatherIds = new Set(newScene.layers.filter(l => l.type === 'weather').map(l => l.id));
  for (const [k] of weatherParticles) {
    if (!activeWeatherIds.has(k)) weatherParticles.delete(k);
  }
  for (const [k] of collapseAnimations) {
    if (!layerIds.has(k)) collapseAnimations.delete(k);
  }
  for (const layer of newScene.layers) {
    if (layer.type === 'collapse' && layer.collapseState === 'idle') collapseAnimations.delete(layer.id);
  }
  state.scene = newScene;
  renderHuds();
});

window.electronAPI.onLayersUpdate((layers) => {
  const activeWeatherIds = new Set(layers.filter(l => l.type === 'weather').map(l => l.id));
  for (const [k] of weatherParticles) {
    if (!activeWeatherIds.has(k)) weatherParticles.delete(k);
  }
  const activeLayerIds = new Set(layers.map(l => l.id));
  for (const [k] of collapseAnimations) {
    if (!activeLayerIds.has(k)) collapseAnimations.delete(k);
  }
  for (const layer of layers) {
    if (layer.type === 'collapse' && layer.collapseState === 'idle') collapseAnimations.delete(layer.id);
  }
  state.scene = { ...state.scene, layers };
});

window.electronAPI.onHudsUpdate((huds) => {
  state.scene = { ...state.scene, huds };
  renderHuds();
});

window.electronAPI.onViewportUpdate((viewport) => {
  state.scene = { ...state.scene, viewport };
});

window.electronAPI.onSettingsUpdate((incoming) => {
  state.settings = { ...state.settings, ...incoming };
});

window.electronAPI.onPing((x, y) => showPing(x, y));

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
