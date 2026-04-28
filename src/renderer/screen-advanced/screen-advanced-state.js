export const CANVAS_SIZE = 8192;

export const canvas  = document.getElementById('map-canvas');
export const ctx     = canvas.getContext('2d');
export const hudRoot = document.getElementById('hud-root');

export const mediaCache       = new Map();
export const weatherParticles = new Map();

const mediaHost = document.getElementById('media-host');

export const state = {
  settings: { gridVisible: true, cellSizeInches: 1.0, zoom: 1.0, dpi: 96, gridColor: '#ffffff', gridOpacity: 0.25 },
  scene:    { map: null, viewport: { cx: 4096, cy: 4096, zoom: 1.0 }, layers: [], huds: [] },
};

export function computeMapTransform(vp) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const { cx, cy, zoom } = vp;
  return { originX: cw / 2 - cx * zoom, originY: ch / 2 - cy * zoom, zoom };
}

export function getMedia(layer) {
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
    el.style.cssText = 'position:absolute;left:0;top:0;';
    mediaHost.appendChild(el);
    for (const [k, old] of mediaCache) {
      if (k.startsWith(layer.id + '::') && k !== key) { old.remove?.(); mediaCache.delete(k); }
    }
    mediaCache.set(key, el);
  }
  return mediaCache.get(key);
}
