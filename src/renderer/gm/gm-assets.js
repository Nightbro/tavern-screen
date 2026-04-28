import { campaign } from './gm-state.js';
import { confirmInline } from './gm-campaign.js';

// ── State ─────────────────────────────────────────────────────────────────────

const assetState = { assets: [], types: [] };

// ── DOM refs ──────────────────────────────────────────────────────────────────

const assetList       = document.getElementById('asset-list');
const assetTypeFilter = document.getElementById('asset-type-filter');
const btnAddAsset     = document.getElementById('btn-add-asset');
const btnManageTypes  = document.getElementById('btn-manage-types');
const btnRefreshAssets = document.getElementById('btn-refresh-assets');

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initAssets() {
  await refreshAssets();

  // Refresh when the Assets tab is clicked
  document.querySelector('[data-tab="asset-manager"]')
    ?.addEventListener('click', refreshAssets);

  btnRefreshAssets.addEventListener('click', refreshAssets);
  assetTypeFilter.addEventListener('change', renderAssets);
  btnAddAsset.addEventListener('click', startAddAsset);
  btnManageTypes.addEventListener('click', toggleTypesManager);
}

// Called externally when the active campaign changes
export async function onCampaignChange() {
  await refreshAssets();
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function refreshAssets() {
  const { types, assets } = await window.electronAPI.listAssets(campaign.selectedId ?? null);
  assetState.types  = types;
  assetState.assets = assets;
  renderTypeFilter();
  renderAssets();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderTypeFilter() {
  const prev = assetTypeFilter.value;
  assetTypeFilter.innerHTML = '<option value="">All types</option>';
  for (const t of assetState.types) {
    const opt = document.createElement('option');
    opt.value       = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    assetTypeFilter.appendChild(opt);
  }
  if (assetState.types.includes(prev)) assetTypeFilter.value = prev;
}

function renderAssets() {
  assetList.innerHTML = '';
  const filter   = assetTypeFilter.value;
  const filtered = assetState.assets.filter(a => !filter || a.type === filter);

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'asset-empty';
    empty.textContent = 'No assets yet';
    assetList.appendChild(empty);
    return;
  }

  for (const asset of filtered) {
    assetList.appendChild(buildAssetRow(asset));
  }
}

function buildAssetRow(asset) {
  const row = document.createElement('div');
  row.className       = 'asset-row';
  row.dataset.assetId = asset.id;

  // Info: name + badges
  const info   = document.createElement('div');
  info.className = 'asset-info';

  const nameEl = document.createElement('span');
  nameEl.className   = 'asset-name';
  nameEl.textContent = asset.name;

  const badges = document.createElement('div');
  badges.className = 'asset-badges';

  const typeBadge = document.createElement('span');
  typeBadge.className   = 'asset-badge asset-type';
  typeBadge.textContent = asset.type;

  const scopeBadge = document.createElement('span');
  scopeBadge.className   = `asset-badge asset-scope-${asset.scope}`;
  scopeBadge.textContent = asset.scope;

  badges.appendChild(typeBadge);
  badges.appendChild(scopeBadge);
  info.appendChild(nameEl);
  info.appendChild(badges);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'asset-actions';

  const canMove = asset.scope === 'global'
    ? !!campaign.selectedId
    : true;

  if (canMove) {
    const btnMove = document.createElement('button');
    btnMove.className = 'btn-icon-xs';
    btnMove.title     = asset.scope === 'global' ? 'Move to campaign' : 'Move to global';
    btnMove.textContent = '⇄';
    btnMove.addEventListener('click', (e) => { e.stopPropagation(); handleMove(asset); });
    actions.appendChild(btnMove);
  }

  const btnRename = document.createElement('button');
  btnRename.className   = 'btn-icon-xs';
  btnRename.title       = 'Rename';
  btnRename.textContent = '✏';
  btnRename.addEventListener('click', (e) => {
    e.stopPropagation();
    startRename(nameEl, asset);
  });

  const btnDel = document.createElement('button');
  btnDel.className   = 'btn-icon-xs danger';
  btnDel.title       = 'Delete';
  btnDel.textContent = '×';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmInline(btnDel, async () => {
      const campaignId = asset.scope === 'campaign' ? campaign.selectedId : null;
      await window.electronAPI.deleteAsset(asset.id, campaignId);
      await refreshAssets();
    });
  });

  actions.appendChild(btnRename);
  actions.appendChild(btnDel);

  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

// ── Move ──────────────────────────────────────────────────────────────────────

async function handleMove(asset) {
  const fromCampaignId = asset.scope === 'campaign' ? campaign.selectedId : null;
  const toCampaignId   = asset.scope === 'global'   ? campaign.selectedId : null;
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

  // Remove any existing form first
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
  // Default: filename without extension
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

  const btnRow   = document.createElement('div');
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

  // Insert after asset list, before footer
  assetList.after(manager);
}

// ── Window bridge ─────────────────────────────────────────────────────────────
Object.assign(window, { initAssets, onCampaignChange });
