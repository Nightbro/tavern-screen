const canvas = document.getElementById('map-canvas');
const ctx    = canvas.getContext('2d');

// Current settings (kept in sync via IPC)
let settings = {
  gridVisible:    true,
  cellSizeInches: 1.0,
  zoom:           1.0,
  dpi:            96,
  gridColor:      '#ffffff',
  gridOpacity:    0.25,
};

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
  draw();
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, w, h);

  // Map image will be drawn here (future feature)

  // Grid overlay on top
  if (settings.gridVisible) drawGrid(w, h);
}

function drawGrid(w, h) {
  const cellPx = settings.cellSizeInches * settings.dpi * settings.zoom;
  if (cellPx < 4) return; // Don't draw if cells are too tiny

  // Parse hex color to rgba
  const hex = settings.gridColor.replace('#', '');
  const r   = parseInt(hex.substring(0, 2), 16);
  const g   = parseInt(hex.substring(2, 4), 16);
  const b   = parseInt(hex.substring(4, 6), 16);

  ctx.save();
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${settings.gridOpacity})`;
  ctx.lineWidth   = 1;

  ctx.beginPath();

  // Vertical lines
  for (let x = 0; x <= w; x += cellPx) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }

  // Horizontal lines
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

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
resize();
