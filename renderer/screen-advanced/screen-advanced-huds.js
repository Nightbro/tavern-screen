// ── HUD registry (player-side, same classes as GM but only player methods used) ──
const HUD_REGISTRY = {
  initiative: new InitiativeHud(),
  status:     new StatusHud(),
  handout:    new HandoutHud(),
};

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderHuds() {
  hudRoot.innerHTML = '';
  const pending = [];

  for (const hud of (scene.huds ?? [])) {
    if (hud.visible === false) continue;
    const reg = HUD_REGISTRY[hud.type];
    if (!reg) continue;
    for (const item of reg.buildPlayerPanels(hud)) {
      hudRoot.appendChild(item.panel);
      pending.push(item);
    }
  }

  // Position after layout so offsetWidth/offsetHeight are real.
  requestAnimationFrame(() => {
    for (const { panel, corner, facing, x, y } of pending) {
      HudBase.positionPanel(panel, corner, facing, x, y);
    }
  });
}

// ── Ping ──────────────────────────────────────────────────────────────────────

function showPing(canvasX, canvasY) {
  const tx = computeMapTransform(scene.viewport);
  const px = tx.originX + canvasX * tx.zoom;
  const py = tx.originY + canvasY * tx.zoom;

  const ring = document.createElement('div');
  ring.className    = 'ping-ring';
  ring.style.left   = px + 'px';
  ring.style.top    = py + 'px';
  ring.style.width  = '40px';
  ring.style.height = '40px';

  const dot = document.createElement('div');
  dot.className  = 'ping-dot';
  dot.style.left = px + 'px';
  dot.style.top  = py + 'px';

  document.body.appendChild(ring);
  document.body.appendChild(dot);
  setTimeout(() => { ring.remove(); dot.remove(); }, 1500);
}
