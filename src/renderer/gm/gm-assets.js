import { campaign } from './gm-state.js';
import { confirmInline } from './gm-campaign.js';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);

// ── State ─────────────────────────────────────────────────────────────────────

const assetState = {
  assets:      [],
  types:       [],
  rootFolder:  null,
  selectedId:  null,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

const assetList        = document.getElementById('asset-list');
const assetNoFolder    = document.getElementById('asset-no-folder');
const assetPreview     = document.getElementById('asset-preview');
const assetPreviewImg  = document.getElementById('asset-preview-img');
const assetPreviewName = document.getElementById('asset-preview-name');
const btnAssetUse      = document.getElementById('btn-asset-use');
const btnAddAsset      = document.getElementById('btn-add-asset');
const btnManageTypes   = document.getElementById('btn-manage-types');
const btnRefreshAssets = document.getElementById('btn-refresh-assets');
const btnSelectFolder  = document.getElementById('btn-select-folder');
const btnSetupFolder   = document.getElementById('btn-setup-folder');

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initAssets() {
  assetState.rootFolder = await window.electronAPI.getLibraryRoot();
  await refreshAssets();

  document.querySelector('[data-tab="asset-manager"]')
    ?.addEventListener('click', refreshAssets);

  btnRefreshAssets.addEventListener('click', refreshAssets);
  btnAddAsset.addEventListener('click', startAddAsset);
  btnManageTypes.addEventListener('click', toggleTypesManager);

  async function pickFolder() {
    const result = await window.electronAPI.selectRootFolder();
    if (result) { assetState.rootFolder = result; await refreshAssets(); }
  }
  btnSelectFolder.addEventListener('click', pickFolder);
  btnSetupFolder.addEventListener('click',  pickFolder);
}

export async function onCampaignChange() {
  await refreshAssets();
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function refreshAssets() {
  if (!assetState.rootFolder) {
    showNoFolder();
    return;
  }
  hideNoFolder();
  const { types, assets } = await window.electronAPI.listAssets(campaign.selectedId ?? null);
  assetState.types  = types;
  assetState.assets = assets;
  renderAssets();
}

function showNoFolder() {
  assetNoFolder.style.display = '';
  assetList.innerHTML = '';
  assetPreview.style.display = 'none';
}

function hideNoFolder() {
  assetNoFolder.style.display = 'none';
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAssets() {
  assetList.innerHTML = '';

  // Group: scope → type
  const scopes = [
    { key: 'global',   label: 'Global' },
    { key: 'campaign', label: campaign.selectedId ? `Campaign: ${campaign.selectedId}` : null },
  ];

  let anyAsset = false;

  for (const scope of scopes) {
    if (!scope.label) continue;
    const scopeAssets = assetState.assets.filter(a => a.scope === scope.key);
    if (scopeAssets.length === 0) continue;
    anyAsset = true;

    // Scope header
    const scopeHeader = document.createElement('div');
    scopeHeader.className = `asset-scope-header asset-scope-header-${scope.key}`;
    scopeHeader.textContent = scope.label;
    assetList.appendChild(scopeHeader);

    // Group within scope by type (preserve types order)
    const typeOrder = assetState.types.length
      ? assetState.types
      : [...new Set(scopeAssets.map(a => a.type))];

    const byType = new Map();
    for (const asset of scopeAssets) {
      if (!byType.has(asset.type)) byType.set(asset.type, []);
      byType.get(asset.type).push(asset);
    }
    // Also catch any type not in the types list
    for (const asset of scopeAssets) {
      if (!byType.has(asset.type)) byType.set(asset.type, [asset]);
    }

    const orderedTypes = [
      ...typeOrder.filter(t => byType.has(t)),
      ...[...byType.keys()].filter(t => !typeOrder.includes(t)),
    ];

    for (const type of orderedTypes) {
      const typeAssets = byType.get(type);
      if (!typeAssets?.length) continue;

      const typeHeader = document.createElement('div');
      typeHeader.className = 'asset-type-header';
      typeHeader.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      assetList.appendChild(typeHeader);

      for (const asset of typeAssets) {
        assetList.appendChild(buildAssetCard(asset));
      }
    }
  }

  if (!anyAsset) {
    const empty = document.createElement('div');
    empty.className   = 'asset-empty';
    empty.textContent = 'No assets yet';
    assetList.appendChild(empty);
  }
}

// ── Asset card ────────────────────────────────────────────────────────────────

function buildAssetCard(asset) {
  const card = document.createElement('div');
  card.className = 'asset-card' + (asset.id === assetState.selectedId ? ' active' : '');
  card.dataset.assetId = asset.id;

  // Thumbnail
  const thumb = document.createElement('div');
  thumb.className = 'asset-thumb';
  if (asset.fileName && isImage(asset.fileName)) {
    const img = document.createElement('img');
    img.src = assetFileUrl(asset);
    img.alt = asset.name;
    img.draggable = false;
    thumb.appendChild(img);
  } else {
    thumb.classList.add('asset-thumb-placeholder');
    thumb.textContent = fileIcon(asset.fileName);
  }

  // Info
  const info = document.createElement('div');
  info.className = 'asset-card-info';

  const nameEl = document.createElement('span');
  nameEl.className   = 'asset-name';
  nameEl.textContent = asset.name;
  info.appendChild(nameEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'asset-actions';

  const canMove = asset.scope === 'global' ? !!campaign.selectedId : true;
  if (canMove) {
    const btnMove = document.createElement('button');
    btnMove.className   = 'btn-icon-xs';
    btnMove.title       = asset.scope === 'global' ? 'Move to campaign' : 'Move to global';
    btnMove.textContent = '⇄';
    btnMove.addEventListener('click', (e) => { e.stopPropagation(); handleMove(asset); });
    actions.appendChild(btnMove);
  }

  const btnRename = document.createElement('button');
  btnRename.className   = 'btn-icon-xs';
  btnRename.title       = 'Rename';
  btnRename.textContent = '✏';
  btnRename.addEventListener('click', (e) => { e.stopPropagation(); startRename(nameEl, asset); });
  actions.appendChild(btnRename);

  const btnDel = document.createElement('button');
  btnDel.className   = 'btn-icon-xs danger';
  btnDel.title       = 'Delete';
  btnDel.textContent = '×';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmInline(btnDel, async () => {
      const campaignId = asset.scope === 'campaign' ? campaign.selectedId : null;
      await window.electronAPI.deleteAsset(asset.id, campaignId);
      if (assetState.selectedId === asset.id) clearPreview();
      await refreshAssets();
    });
  });
  actions.appendChild(btnDel);

  card.appendChild(thumb);
  card.appendChild(info);
  card.appendChild(actions);

  card.addEventListener('click', () => selectAsset(asset, card));
  return card;
}

// ── Preview ───────────────────────────────────────────────────────────────────

function selectAsset(asset, card) {
  // Deselect previous
  document.querySelectorAll('.asset-card.active')
    .forEach(c => c.classList.remove('active'));

  if (assetState.selectedId === asset.id) {
    assetState.selectedId = null;
    clearPreview();
    return;
  }

  assetState.selectedId = asset.id;
  card.classList.add('active');
  showPreview(asset);
}

function showPreview(asset) {
  assetPreviewName.textContent = asset.name;
  const url = asset.fileName && isImage(asset.fileName) ? assetFileUrl(asset) : null;
  if (url) {
    assetPreviewImg.src = url;
    assetPreviewImg.style.display = '';
  } else {
    assetPreviewImg.style.display = 'none';
  }
  assetPreview.style.display = '';
  assetPreview.dataset.assetUrl  = url ?? '';
  assetPreview.dataset.assetName = asset.name;
}

function clearPreview() {
  assetState.selectedId = null;
  assetPreview.style.display = 'none';
  assetPreviewImg.src = '';
  delete assetPreview.dataset.assetUrl;
  delete assetPreview.dataset.assetName;
}

btnAssetUse?.addEventListener('click', async () => {
  const src  = assetPreview.dataset.assetUrl;
  const name = assetPreview.dataset.assetName;
  if (!src) return;

  function imageBounds(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { resolve({}); return; }
        resolve({ x: Math.round((8192 - w) / 2), y: Math.round((8192 - h) / 2), w, h });
      };
      img.onerror = () => resolve({});
      img.src = src;
    });
  }

  const bounds    = await imageBounds(src);
  const newLayers = await window.electronAPI.addLayer({ type: 'image', src, name, visible: true, opacity: 1, ...bounds });
  if (newLayers) {
    window.sceneState.layers = newLayers;
    window.renderLayerList();
    const layersTab = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
    if (layersTab && !layersTab.classList.contains('active')) layersTab.click();
    setTimeout(() => window.electronAPI.requestPreview(), 400);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function assetFileUrl(asset) {
  if (!assetState.rootFolder || !asset.fileName) return '';
  const base = assetState.rootFolder.replace(/\\/g, '/');
  if (asset.scope === 'campaign' && campaign.selectedId) {
    return `file:///${base}/userdata/campaigns/${campaign.selectedId}/assets/${asset.type}/${asset.id}/${asset.fileName}`;
  }
  return `file:///${base}/userdata/assets/${asset.type}/${asset.id}/${asset.fileName}`;
}

function isImage(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTS.has(ext);
}

function fileIcon(fileName) {
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return '📄';
  if (ext === 'svg') return '🖼';
  return '📁';
}

// ── Move ──────────────────────────────────────────────────────────────────────

async function handleMove(asset) {
  const fromCampaignId = asset.scope === 'campaign' ? campaign.selectedId : null;
  const toCampaignId   = asset.scope === 'global'   ? campaign.selectedId : null;
  if (assetState.selectedId === asset.id) clearPreview();
  await window.electronAPI.moveAsset(asset.id, fromCampaignId, toCampaignId);
  await refreshAssets();
}

// ── Rename ────────────────────────────────────────────────────────────────────

function startRename(nameEl, asset) {
  const input = document.createElement('input');
  input.className = 'asset-name-input';
  input.value     = asset.name;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName && newName !== asset.name) {
      const campaignId = asset.scope === 'campaign' ? campaign.selectedId : null;
      await window.electronAPI.updateAsset(asset.id, { name: newName }, campaignId);
      asset.name = newName;
      if (assetState.selectedId === asset.id) assetPreviewName.textContent = newName;
    }
    input.replaceWith(nameEl);
    nameEl.textContent = asset.name;
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = asset.name; input.blur(); }
  });
}

// ── Add asset ─────────────────────────────────────────────────────────────────

async function startAddAsset() {
  const filePaths = await window.electronAPI.openAssetDialog();
  if (!filePaths.length) return;

  document.getElementById('asset-add-form')?.remove();
  const form = buildAddForm(filePaths);
  assetList.insertBefore(form, assetList.firstChild);
  form.querySelector('.asset-name-input').focus();
}

function buildAddForm(filePaths) {
  const form   = document.createElement('div');
  form.id        = 'asset-add-form';
  form.className = 'asset-add-form';

  const nameInput = document.createElement('input');
  nameInput.type        = 'text';
  nameInput.className   = 'asset-name-input';
  nameInput.placeholder = 'Asset name…';
  nameInput.maxLength   = 64;
  nameInput.value = filePaths[0].replace(/\\/g, '/').split('/').pop().replace(/\.[^.]+$/, '');

  const typeSelect = document.createElement('select');
  typeSelect.className = 'asset-type-select';
  for (const t of assetState.types) {
    const opt = document.createElement('option');
    opt.value       = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    typeSelect.appendChild(opt);
  }

  const scopeSelect = document.createElement('select');
  scopeSelect.className = 'asset-scope-select';
  const optGlobal = document.createElement('option');
  optGlobal.value       = 'global';
  optGlobal.textContent = 'Global';
  scopeSelect.appendChild(optGlobal);
  if (campaign.selectedId) {
    const optCampaign = document.createElement('option');
    optCampaign.value       = 'campaign';
    optCampaign.textContent = `Campaign: ${campaign.selectedId}`;
    scopeSelect.appendChild(optCampaign);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'asset-add-actions';

  const btnAdd = document.createElement('button');
  btnAdd.className   = 'btn-primary-sm';
  btnAdd.textContent = filePaths.length > 1 ? `Add ${filePaths.length} files` : 'Add';

  const btnCancel = document.createElement('button');
  btnCancel.className   = 'btn-ghost-sm';
  btnCancel.textContent = 'Cancel';

  btnCancel.addEventListener('click', () => form.remove());

  btnAdd.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const type       = typeSelect.value;
    const campaignId = scopeSelect.value === 'campaign' ? campaign.selectedId : null;
    for (let i = 0; i < filePaths.length; i++) {
      const assetName = i === 0
        ? name
        : filePaths[i].replace(/\\/g, '/').split('/').pop().replace(/\.[^.]+$/, '');
      await window.electronAPI.createAsset(assetName, type, filePaths[i], campaignId);
    }
    form.remove();
    await refreshAssets();
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  btnAdd.click();
    if (e.key === 'Escape') form.remove();
  });

  btnRow.appendChild(btnAdd);
  btnRow.appendChild(btnCancel);
  form.appendChild(nameInput);
  form.appendChild(typeSelect);
  form.appendChild(scopeSelect);
  form.appendChild(btnRow);
  return form;
}

// ── Types manager ─────────────────────────────────────────────────────────────

function toggleTypesManager() {
  const existing = document.getElementById('asset-types-manager');
  if (existing) { existing.remove(); return; }

  const manager = document.createElement('div');
  manager.id        = 'asset-types-manager';
  manager.className = 'asset-types-manager';

  const title = document.createElement('div');
  title.className   = 'asset-types-title';
  title.textContent = 'Asset Types';

  const typesList = document.createElement('div');
  typesList.className = 'asset-types-list';

  function renderTypesList() {
    typesList.innerHTML = '';
    for (const t of assetState.types) {
      const item = document.createElement('div');
      item.className = 'asset-type-item';
      const label = document.createElement('span');
      label.textContent = t;
      const btnDel = document.createElement('button');
      btnDel.className   = 'btn-icon-xs danger';
      btnDel.title       = 'Remove type';
      btnDel.textContent = '×';
      btnDel.addEventListener('click', async () => {
        await window.electronAPI.removeAssetType(t);
        await refreshAssets();
        renderTypesList();
      });
      item.appendChild(label);
      item.appendChild(btnDel);
      typesList.appendChild(item);
    }
  }
  renderTypesList();

  const addRow   = document.createElement('div');
  addRow.className = 'asset-type-add-row';
  const addInput = document.createElement('input');
  addInput.type        = 'text';
  addInput.className   = 'asset-name-input';
  addInput.placeholder = 'New type…';
  addInput.maxLength   = 32;
  const addBtn = document.createElement('button');
  addBtn.className   = 'btn-ghost-sm';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', async () => {
    const name = addInput.value.trim().toLowerCase();
    if (!name) return;
    await window.electronAPI.addAssetType(name);
    addInput.value = '';
    await refreshAssets();
    renderTypesList();
  });
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  addBtn.click();
    if (e.key === 'Escape') addInput.value = '';
  });
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  manager.appendChild(title);
  manager.appendChild(typesList);
  manager.appendChild(addRow);

  assetList.after(manager);
}

// ── Window bridge ─────────────────────────────────────────────────────────────
Object.assign(window, { initAssets, onCampaignChange });
