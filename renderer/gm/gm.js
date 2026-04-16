const monitorMap = document.getElementById('monitor-map');
const monitorList = document.getElementById('monitor-list');
const btnCloseScreen = document.getElementById('btn-close-screen');

let displays = [];
let activeDisplayId = null;

async function loadDisplays() {
  displays = await window.electronAPI.getDisplays();
  activeDisplayId = (displays.find((d) => d.active) || {}).id || null;
  renderMap();
  renderCards();
  btnCloseScreen.disabled = activeDisplayId === null;
}

// --- Visual monitor map ---
function renderMap() {
  monitorMap.innerHTML = '';

  const padding = 16;
  const mapW = monitorMap.clientWidth - padding * 2;
  const mapH = monitorMap.clientHeight - padding * 2;

  const allX = displays.map((d) => d.bounds.x);
  const allY = displays.map((d) => d.bounds.y);
  const allRight = displays.map((d) => d.bounds.x + d.bounds.width);
  const allBottom = displays.map((d) => d.bounds.y + d.bounds.height);

  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const totalW = Math.max(...allRight) - minX;
  const totalH = Math.max(...allBottom) - minY;

  const scale = Math.min(mapW / totalW, mapH / totalH);

  const offsetX = padding + (mapW - totalW * scale) / 2;
  const offsetY = padding + (mapH - totalH * scale) / 2;

  displays.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'map-monitor' + (d.id === activeDisplayId ? ' active' : '');

    el.style.left = offsetX + (d.bounds.x - minX) * scale + 'px';
    el.style.top = offsetY + (d.bounds.y - minY) * scale + 'px';
    el.style.width = d.bounds.width * scale + 'px';
    el.style.height = d.bounds.height * scale + 'px';

    el.innerHTML = `
      <span class="map-label">Monitor ${i + 1}</span>
      <span class="map-res">${d.bounds.width}×${d.bounds.height}</span>
      ${d.isPrimary ? '<span class="map-badge">Primary</span>' : ''}
    `;

    el.addEventListener('click', () => selectDisplay(d.id));
    monitorMap.appendChild(el);
  });
}

// --- Monitor cards ---
function renderCards() {
  monitorList.innerHTML = '';

  displays.forEach((d, i) => {
    const isActive = d.id === activeDisplayId;
    const card = document.createElement('div');
    card.className = 'monitor-card' + (isActive ? ' active' : '');

    card.innerHTML = `
      <div class="monitor-card-header">
        <h2>Monitor ${i + 1}</h2>
        ${d.isPrimary ? '<span class="badge-primary">Primary</span>' : ''}
        ${isActive ? '<span class="badge-active">Active</span>' : ''}
      </div>
      <div class="monitor-res">${d.bounds.width} × ${d.bounds.height}  |  ×${d.scaleFactor}</div>
      <button class="btn-select ${isActive ? 'active' : ''}" data-id="${d.id}">
        ${isActive ? 'Screen active on this monitor' : 'Send screen here'}
      </button>
    `;

    monitorList.appendChild(card);
  });

  monitorList.querySelectorAll('.btn-select').forEach((btn) => {
    btn.addEventListener('click', () => selectDisplay(Number(btn.dataset.id)));
  });
}

function selectDisplay(displayId) {
  if (displayId === activeDisplayId) return;
  window.electronAPI.selectDisplay(displayId);
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = false;
}

btnCloseScreen.addEventListener('click', () => {
  window.electronAPI.closeScreen();
  activeDisplayId = null;
  displays = displays.map((d) => ({ ...d, active: false }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = true;
});

window.electronAPI.onScreenClosed(() => {
  activeDisplayId = null;
  displays = displays.map((d) => ({ ...d, active: false }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = true;
});

window.electronAPI.onScreenOpened((displayId) => {
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = false;
});

loadDisplays();
