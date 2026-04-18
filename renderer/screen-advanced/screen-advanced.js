const CANVAS_SIZE = 8192;

const canvas  = document.getElementById('map-canvas');
const ctx     = canvas.getContext('2d');
const hudRoot = document.getElementById('hud-root');

// ── State ─────────────────────────────────────────────────────────────────────
let settings = {
  gridVisible: true, cellSizeInches: 1.0, zoom: 1.0,
  dpi: 96, gridColor: '#ffffff', gridOpacity: 0.25,
};
let scene = {
  map: null,
  viewport: { cx: 4096, cy: 4096, zoom: 1.0 },
  layers: [],
  huds: [],
};

// Media cache: layerId::src → HTMLImageElement | HTMLVideoElement
const mediaCache      = new Map();
// Weather particles: weatherType → Particle[]
const weatherParticles = new Map();

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resize() {
  const dpr     = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  weatherParticles.clear(); // regenerate at new screen size
}

// ── Viewport transform ────────────────────────────────────────────────────────
// In advanced mode there is no base map — use a fixed 8192×8192 virtual canvas.
// cx/cy are canvas pixel coordinates of the screen centre.
// zoom = screen pixels per canvas pixel.
function computeMapTransform(vp) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const { cx, cy, zoom } = vp;
  return {
    originX: cw / 2 - cx * zoom,
    originY: ch / 2 - cy * zoom,
    zoom,
  };
}

// ── Media loading ─────────────────────────────────────────────────────────────
function getMedia(layer) {
  if (!layer.src) return null;
  const key = layer.id + '::' + layer.src;
  if (!mediaCache.has(key)) {
    let el;
    if (layer.type === 'video') {
      el = document.createElement('video');
      el.loop     = true;
      el.muted    = true;
      el.autoplay = true;
      el.src      = layer.src;
      el.loaded   = false;
      el.addEventListener('loadeddata', () => { el.loaded = true; el.play().catch(() => {}); });
    } else {
      el = new Image();
      el.loaded = false;
      el.onload = () => { el.loaded = true; };
      el.src    = layer.src;
    }
    // Evict old entries for this layer (src changed)
    for (const [k] of mediaCache) {
      if (k.startsWith(layer.id + '::') && k !== key) mediaCache.delete(k);
    }
    mediaCache.set(key, el);
  }
  return mediaCache.get(key);
}

// ── Render loop ───────────────────────────────────────────────────────────────
function render(timestamp) {
  requestAnimationFrame(render);

  const cw = window.innerWidth;
  const ch = window.innerHeight;

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = scene.background ?? '#0d0d1a';
  ctx.fillRect(0, 0, cw, ch);

  const tx = computeMapTransform(scene.viewport);

  // Scene layers (bottom → top), skipping weather
  for (const layer of scene.layers) {
    if (layer.visible === false) continue;
    drawLayer(layer, tx);
  }

  // Weather layers (screen-space, above scene layers)
  const weatherLayers = scene.layers.filter(l => l.type === 'weather' && l.visible !== false);
  for (const wl of weatherLayers) drawWeatherLayer(wl, timestamp);
  if (weatherLayers.length) _lastTs = timestamp;

  // Grid on top
  if (settings.gridVisible) drawGrid(tx);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
window.electronAPI.onSceneUpdate((newScene) => {
  // Purge stale media entries
  const layerIds = new Set(newScene.layers.map(l => l.id));
  for (const [k] of mediaCache) {
    if (!layerIds.has(k.split('::')[0])) mediaCache.delete(k);
  }
  // Purge weather particles for removed types
  const newTypes = new Set(newScene.layers.filter(l => l.type === 'weather').map(l => l.weatherType));
  for (const [t] of weatherParticles) {
    if (!newTypes.has(t)) weatherParticles.delete(t);
  }
  scene = newScene;
  renderHuds();
});

window.electronAPI.onLayersUpdate((layers) => {
  const newTypes = new Set(layers.filter(l => l.type === 'weather').map(l => l.weatherType));
  for (const [t] of weatherParticles) {
    if (!newTypes.has(t)) weatherParticles.delete(t);
  }
  scene = { ...scene, layers };
});

window.electronAPI.onHudsUpdate((huds) => {
  scene = { ...scene, huds };
  renderHuds();
});

window.electronAPI.onViewportUpdate((viewport) => {
  scene = { ...scene, viewport };
});

window.electronAPI.onSettingsUpdate((incoming) => {
  settings = { ...settings, ...incoming };
});

window.electronAPI.onPing((x, y) => showPing(x, y));

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
