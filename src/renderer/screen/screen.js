const canvas = document.getElementById('map-canvas');
const ctx    = canvas.getContext('2d');

let settings = {
  gridVisible:    true,
  cellSizeInches: 1.0,
  zoom:           1.0,
  dpi:            96,
  gridColor:      '#ffffff',
  gridOpacity:    0.25,
};

let mapImage = null;

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
  draw();
}

// ── Map loading ───────────────────────────────────────────────────────────────
function loadMap(mapData) {
  if (!mapData) {
    mapImage = null;
    draw();
    return;
  }
  const img = new Image();
  img.onload  = () => { mapImage = img; draw(); };
  img.onerror = () => { mapImage = null; draw(); };
  img.src = 'file:///' + mapData.path.replace(/\\/g, '/');
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, w, h);

  if (mapImage) drawMap(w, h);
  if (settings.gridVisible) drawGrid(w, h);
}

function drawMap(w, h) {
  // Scale to contain the whole map at zoom=1, then apply zoom (centered)
  const fitScale   = Math.min(w / mapImage.width, h / mapImage.height);
  const drawW = mapImage.width  * fitScale * settings.zoom;
  const drawH = mapImage.height * fitScale * settings.zoom;
  const drawX = (w - drawW) / 2;
  const drawY = (h - drawH) / 2;
  ctx.drawImage(mapImage, drawX, drawY, drawW, drawH);
}

function drawGrid(w, h) {
  const cellPx = settings.cellSizeInches * settings.dpi * settings.zoom;
  if (cellPx < 4) return;

  const hex = settings.gridColor.replace('#', '');
  const r   = parseInt(hex.substring(0, 2), 16);
  const g   = parseInt(hex.substring(2, 4), 16);
  const b   = parseInt(hex.substring(4, 6), 16);

  ctx.save();
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${settings.gridOpacity})`;
  ctx.lineWidth   = 1;
  ctx.beginPath();

  for (let x = 0; x <= w; x += cellPx) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += cellPx) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }

  ctx.stroke();
  ctx.restore();
}

// ── IPC ───────────────────────────────────────────────────────────────────────
window.electronAPI.onSettingsUpdate((incoming) => {
  settings = { ...settings, ...incoming };
  draw();
});

window.electronAPI.onMapUpdate((mapData) => {
  loadMap(mapData);
});

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
resize();
