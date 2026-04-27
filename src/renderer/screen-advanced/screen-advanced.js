import { canvas, ctx, state, mediaCache, weatherParticles, computeMapTransform } from './screen-advanced-state.js';
import { drawLayer, drawGrid, drawWeatherLayer, setLastWeatherTs } from './screen-advanced-layers.js';
import { renderHuds, showPing }                   from './screen-advanced-huds.js';

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resize() {
  const dpr     = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  weatherParticles.clear();
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

  const weatherLayers = state.scene.layers.filter(l => l.type === 'weather' && l.visible !== false);
  for (const wl of weatherLayers) drawWeatherLayer(wl, timestamp);
  if (weatherLayers.length) setLastWeatherTs(timestamp);

  if (state.settings.gridVisible) drawGrid(tx);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
window.electronAPI.onSceneUpdate((newScene) => {
  const layerIds = new Set(newScene.layers.map(l => l.id));
  for (const [k] of mediaCache) {
    if (!layerIds.has(k.split('::')[0])) mediaCache.delete(k);
  }
  const newTypes = new Set(newScene.layers.filter(l => l.type === 'weather').map(l => l.weatherType));
  for (const [t] of weatherParticles) {
    if (!newTypes.has(t)) weatherParticles.delete(t);
  }
  state.scene = newScene;
  renderHuds();
});

window.electronAPI.onLayersUpdate((layers) => {
  const newTypes = new Set(layers.filter(l => l.type === 'weather').map(l => l.weatherType));
  for (const [t] of weatherParticles) {
    if (!newTypes.has(t)) weatherParticles.delete(t);
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
