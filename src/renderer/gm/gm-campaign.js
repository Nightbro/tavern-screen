import {
  campaign, NOTES_DEBOUNCE_MS,
  tabBtns, tabPaneAssets, tabPaneCampaign, tabPaneHuds,
  campaignSelect, btnNewCampaign, btnRenameCampaign, btnDeleteCampaign,
  sessionsContent, notesTextarea, notesStatus, notesTitle, btnNewSession,
} from './gm-state.js';

// ════════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════════

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    tabPaneAssets.style.display   = tab === 'assets'   ? '' : 'none';
    tabPaneCampaign.style.display = tab === 'campaign' ? '' : 'none';
    tabPaneHuds.style.display     = tab === 'huds'     ? '' : 'none';
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ════════════════════════════════════════════════════════════════════════════

export async function initCampaigns() {
  const { campaigns: list } = await window.electronAPI.scanCampaigns();
  campaign.list = list;
  renderCampaignSelect();
  if (campaign.list.length > 0) {
    campaign.selectedId = campaign.list[0].id;
    campaignSelect.value = campaign.selectedId;
    renderSessions();
  }
  await loadCurrentNotes();
}

async function refreshCampaigns() {
  const { campaigns: list } = await window.electronAPI.scanCampaigns();
  campaign.list = list;
  renderCampaignSelect();
  renderSessions();
}

function renderCampaignSelect() {
  campaignSelect.innerHTML = '';
  if (campaign.list.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = 'No campaigns yet';
    campaignSelect.appendChild(opt);
    return;
  }
  for (const c of campaign.list) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    campaignSelect.appendChild(opt);
  }
  if (campaign.selectedId && campaign.list.find(c => c.id === campaign.selectedId)) {
    campaignSelect.value = campaign.selectedId;
  } else {
    campaign.selectedId = campaign.list[0]?.id ?? null;
    campaignSelect.value = campaign.selectedId ?? '';
  }
}

function renderSessions() {
  sessionsContent.innerHTML = '';
  const selectedCampaign = campaign.list.find(c => c.id === campaign.selectedId);
  if (!selectedCampaign || selectedCampaign.sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sessions-empty';
    empty.textContent = selectedCampaign ? 'No sessions yet' : '';
    sessionsContent.appendChild(empty);
    return;
  }
  for (const session of selectedCampaign.sessions) {
    sessionsContent.appendChild(buildSessionRow(session));
  }
}

// ── Inline confirmation helper ────────────────────────────────────────────────

export function confirmInline(deleteBtn, onConfirm) {
  const wrapper = document.createElement('span');
  wrapper.style.cssText = 'display:inline-flex;gap:3px;align-items:center;';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:10px;color:#e05555;';
  label.textContent = 'Sure?';

  const btnYes = document.createElement('button');
  btnYes.className = 'btn-icon-xs danger';
  btnYes.title = 'Yes, delete';
  btnYes.textContent = '✓';

  const btnNo = document.createElement('button');
  btnNo.className = 'btn-icon-xs';
  btnNo.title = 'Cancel';
  btnNo.textContent = '✕';

  wrapper.appendChild(label);
  wrapper.appendChild(btnYes);
  wrapper.appendChild(btnNo);
  deleteBtn.replaceWith(wrapper);

  btnYes.addEventListener('click', (e) => { e.stopPropagation(); onConfirm(); });
  btnNo.addEventListener('click',  (e) => { e.stopPropagation(); wrapper.replaceWith(deleteBtn); });
}

// ── Notes helpers ─────────────────────────────────────────────────────────────

function setNotesStatus(state) {
  notesStatus.classList.remove('saved', 'unsaved');
  if (state === 'saved')   { notesStatus.textContent = 'Saved';   notesStatus.classList.add('saved'); }
  if (state === 'unsaved') { notesStatus.textContent = 'Unsaved'; notesStatus.classList.add('unsaved'); }
  if (!state)              { notesStatus.textContent = ''; }
}

async function flushNotes() {
  clearTimeout(campaign.notesTimer);
  if (!notesStatus.classList.contains('unsaved')) return;
  if (campaign.sessionId) {
    await window.electronAPI.writeNotes(campaign.selectedId, campaign.sessionId, notesTextarea.value);
  } else if (campaign.selectedId) {
    await window.electronAPI.writeCampaignNotes(campaign.selectedId, notesTextarea.value);
  }
  setNotesStatus('');
}

async function loadCurrentNotes() {
  if (!campaign.selectedId) {
    notesTextarea.disabled = true;
    notesTextarea.value = '';
    notesTextarea.placeholder = 'Select a campaign to edit notes…';
    notesTitle.textContent = 'Notes';
    setNotesStatus('');
    return;
  }
  notesTextarea.disabled = false;
  if (campaign.sessionId) {
    notesTitle.textContent = campaign.sessionId;
    notesTextarea.placeholder = 'Session notes…';
    notesTextarea.value = await window.electronAPI.readNotes(campaign.selectedId, campaign.sessionId);
  } else {
    notesTitle.textContent = 'Campaign Notes';
    notesTextarea.placeholder = 'Campaign notes…';
    notesTextarea.value = await window.electronAPI.readCampaignNotes(campaign.selectedId);
  }
  setNotesStatus('');
}

notesTextarea.addEventListener('input', () => {
  setNotesStatus('unsaved');
  clearTimeout(campaign.notesTimer);
  campaign.notesTimer = setTimeout(async () => {
    if (campaign.sessionId) {
      await window.electronAPI.writeNotes(campaign.selectedId, campaign.sessionId, notesTextarea.value);
    } else if (campaign.selectedId) {
      await window.electronAPI.writeCampaignNotes(campaign.selectedId, notesTextarea.value);
    }
    setNotesStatus('saved');
    setTimeout(() => { if (notesStatus.classList.contains('saved')) setNotesStatus(''); }, 2000);
  }, NOTES_DEBOUNCE_MS);
});

// ── Session rows ──────────────────────────────────────────────────────────────

function buildSessionRow(session) {
  const row = document.createElement('div');
  row.className = 'session-row' + (session.id === campaign.sessionId ? ' active' : '');
  row.dataset.sessionId = session.id;

  const nameEl = document.createElement('span');
  nameEl.className = 'session-name';
  nameEl.textContent = session.name;

  const actions = document.createElement('div');
  actions.className = 'session-actions';

  const btnRename = document.createElement('button');
  btnRename.className = 'btn-icon-xs';
  btnRename.title = 'Rename session';
  btnRename.textContent = '✏';
  btnRename.addEventListener('click', (e) => {
    e.stopPropagation();
    startSessionRename(row, nameEl, session.id);
  });

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-icon-xs danger';
  btnDel.title = 'Delete session';
  btnDel.textContent = '×';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmInline(btnDel, async () => {
      await flushNotes();
      if (session.id === campaign.sessionId) campaign.sessionId = null;
      await window.electronAPI.deleteSession(campaign.selectedId, session.id);
      await refreshCampaigns();
      await loadCurrentNotes();
    });
  });

  actions.appendChild(btnRename);
  actions.appendChild(btnDel);
  const badge = document.createElement('span');
  badge.className = 'session-badge';
  badge.textContent = 'SES';
  row.appendChild(badge);
  row.appendChild(nameEl);
  row.appendChild(actions);

  row.addEventListener('click', () => selectSession(campaign.selectedId, session.id));
  return row;
}

function startSessionRename(row, nameEl, sessionId) {
  const input = document.createElement('input');
  input.className = 'session-name-input';
  input.value = sessionId;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName && newName !== sessionId) {
      await window.electronAPI.renameSession(campaign.selectedId, sessionId, newName);
      if (campaign.sessionId === sessionId) campaign.sessionId = newName;
    }
    await refreshCampaigns();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = sessionId; input.blur(); }
  });
}

async function selectSession(campaignId, sessionId) {
  await flushNotes();
  // Clicking the active session deselects it
  if (campaign.selectedId === campaignId && campaign.sessionId === sessionId) {
    campaign.sessionId = null;
  } else {
    campaign.selectedId = campaignId;
    campaign.sessionId  = sessionId;
  }
  document.querySelectorAll('.session-row').forEach(r => {
    r.classList.toggle('active', r.dataset.sessionId === campaign.sessionId);
  });
  await loadCurrentNotes();
  await window.loadMostRecentScene();
}

// ── Campaign toolbar ──────────────────────────────────────────────────────────

campaignSelect.addEventListener('change', async () => {
  await flushNotes();
  campaign.selectedId = campaignSelect.value;
  campaign.sessionId  = null;
  renderSessions();
  await loadCurrentNotes();
  await window.loadMostRecentScene();
});

btnNewCampaign.addEventListener('click', () => {
  const input = document.createElement('input');
  input.className = 'campaign-name-input';
  input.placeholder = 'Campaign name…';
  input.maxLength = 64;
  campaignSelect.replaceWith(input);
  input.focus();

  async function commit() {
    const name = input.value.trim();
    input.replaceWith(campaignSelect);
    if (name) {
      await window.electronAPI.createCampaign(name);
      campaign.selectedId = name;
      await refreshCampaigns();
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
});

btnRenameCampaign.addEventListener('click', () => {
  if (!campaign.selectedId) return;
  const input = document.createElement('input');
  input.className = 'campaign-name-input';
  input.value = campaign.selectedId;
  input.maxLength = 64;
  campaignSelect.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    input.replaceWith(campaignSelect);
    if (newName && newName !== campaign.selectedId) {
      await window.electronAPI.renameCampaign(campaign.selectedId, newName);
      campaign.selectedId = newName;
      await refreshCampaigns();
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = campaign.selectedId; input.blur(); }
  });
});

btnDeleteCampaign.addEventListener('click', () => {
  if (!campaign.selectedId) return;
  confirmInline(btnDeleteCampaign, async () => {
    await flushNotes();
    campaign.sessionId = null;
    await window.electronAPI.deleteCampaign(campaign.selectedId);
    campaign.selectedId = null;
    await refreshCampaigns();
    if (campaign.list.length > 0) {
      campaign.selectedId = campaign.list[0].id;
      campaignSelect.value = campaign.selectedId;
      renderSessions();
    }
    await loadCurrentNotes();
  });
});

btnNewSession.addEventListener('click', () => {
  if (!campaign.selectedId) return;
  const input = document.createElement('input');
  input.className = 'session-name-input';
  input.placeholder = 'Session name…';
  input.maxLength = 64;
  input.style.margin = '2px 8px';
  sessionsContent.appendChild(input);
  input.focus();

  async function commit() {
    const name = input.value.trim();
    input.remove();
    if (name) {
      await window.electronAPI.createSession(campaign.selectedId, name);
      await refreshCampaigns();
      selectSession(campaign.selectedId, name);
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
});

// ── Window bridge (for unconverted classic scripts) ───────────────────────────
Object.assign(window, { initCampaigns });
