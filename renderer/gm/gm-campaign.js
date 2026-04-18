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
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ════════════════════════════════════════════════════════════════════════════

async function initCampaigns() {
  const { campaigns: list } = await window.electronAPI.scanCampaigns();
  campaigns = list;
  renderCampaignSelect();
  if (campaigns.length > 0) {
    selectedCampaignId = campaigns[0].id;
    campaignSelect.value = selectedCampaignId;
    renderSessions();
  }
  await loadCurrentNotes();
  renderHudConfigList();
}

async function refreshCampaigns() {
  const { campaigns: list } = await window.electronAPI.scanCampaigns();
  campaigns = list;
  renderCampaignSelect();
  renderSessions();
}

function renderCampaignSelect() {
  campaignSelect.innerHTML = '';
  if (campaigns.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = 'No campaigns yet';
    campaignSelect.appendChild(opt);
    return;
  }
  for (const c of campaigns) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    campaignSelect.appendChild(opt);
  }
  if (selectedCampaignId && campaigns.find(c => c.id === selectedCampaignId)) {
    campaignSelect.value = selectedCampaignId;
  } else {
    selectedCampaignId = campaigns[0]?.id ?? null;
    campaignSelect.value = selectedCampaignId ?? '';
  }
}

function renderSessions() {
  sessionsContent.innerHTML = '';
  const campaign = campaigns.find(c => c.id === selectedCampaignId);
  if (!campaign || campaign.sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sessions-empty';
    empty.textContent = campaign ? 'No sessions yet' : '';
    sessionsContent.appendChild(empty);
    return;
  }
  for (const session of campaign.sessions) {
    sessionsContent.appendChild(buildSessionRow(session));
  }
}

// ── Inline confirmation helper ────────────────────────────────────────────────

function confirmInline(deleteBtn, onConfirm) {
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
  clearTimeout(notesDebounceTimer);
  if (!notesStatus.classList.contains('unsaved')) return;
  if (selectedSessionId) {
    await window.electronAPI.writeNotes(selectedCampaignId, selectedSessionId, notesTextarea.value);
  } else if (selectedCampaignId) {
    await window.electronAPI.writeCampaignNotes(selectedCampaignId, notesTextarea.value);
  }
  setNotesStatus('');
}

async function loadCurrentNotes() {
  if (!selectedCampaignId) {
    notesTextarea.disabled = true;
    notesTextarea.value = '';
    notesTextarea.placeholder = 'Select a campaign to edit notes…';
    notesTitle.textContent = 'Notes';
    setNotesStatus('');
    return;
  }
  notesTextarea.disabled = false;
  if (selectedSessionId) {
    notesTitle.textContent = selectedSessionId;
    notesTextarea.placeholder = 'Session notes…';
    notesTextarea.value = await window.electronAPI.readNotes(selectedCampaignId, selectedSessionId);
  } else {
    notesTitle.textContent = 'Campaign Notes';
    notesTextarea.placeholder = 'Campaign notes…';
    notesTextarea.value = await window.electronAPI.readCampaignNotes(selectedCampaignId);
  }
  setNotesStatus('');
}

notesTextarea.addEventListener('input', () => {
  setNotesStatus('unsaved');
  clearTimeout(notesDebounceTimer);
  notesDebounceTimer = setTimeout(async () => {
    if (selectedSessionId) {
      await window.electronAPI.writeNotes(selectedCampaignId, selectedSessionId, notesTextarea.value);
    } else if (selectedCampaignId) {
      await window.electronAPI.writeCampaignNotes(selectedCampaignId, notesTextarea.value);
    }
    setNotesStatus('saved');
    setTimeout(() => { if (notesStatus.classList.contains('saved')) setNotesStatus(''); }, 2000);
  }, NOTES_DEBOUNCE_MS);
});

// ── Session rows ──────────────────────────────────────────────────────────────

function buildSessionRow(session) {
  const row = document.createElement('div');
  row.className = 'session-row' + (session.id === selectedSessionId ? ' active' : '');
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
      if (session.id === selectedSessionId) selectedSessionId = null;
      await window.electronAPI.deleteSession(selectedCampaignId, session.id);
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

  row.addEventListener('click', () => selectSession(selectedCampaignId, session.id));
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
      await window.electronAPI.renameSession(selectedCampaignId, sessionId, newName);
      if (selectedSessionId === sessionId) selectedSessionId = newName;
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
  if (selectedCampaignId === campaignId && selectedSessionId === sessionId) {
    selectedSessionId = null;
  } else {
    selectedCampaignId = campaignId;
    selectedSessionId  = sessionId;
  }
  document.querySelectorAll('.session-row').forEach(r => {
    r.classList.toggle('active', r.dataset.sessionId === selectedSessionId);
  });
  await loadCurrentNotes();
  await loadMostRecentScene();
  renderHudConfigList();
}

// ── Campaign toolbar ──────────────────────────────────────────────────────────

campaignSelect.addEventListener('change', async () => {
  await flushNotes();
  selectedCampaignId = campaignSelect.value;
  selectedSessionId  = null;
  renderSessions();
  await loadCurrentNotes();
  await loadMostRecentScene();
  renderHudConfigList();
});

btnNewCampaign.addEventListener('click', () => {
  const input = document.createElement('input');
  input.className = 'campaign-name-input';
  input.placeholder = 'Campaign name…';
  input.maxLength = 64;
  const toolbar = campaignSelect.parentElement;
  campaignSelect.replaceWith(input);
  input.focus();

  async function commit() {
    const name = input.value.trim();
    input.replaceWith(campaignSelect);
    if (name) {
      await window.electronAPI.createCampaign(name);
      selectedCampaignId = name;
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
  if (!selectedCampaignId) return;
  const input = document.createElement('input');
  input.className = 'campaign-name-input';
  input.value = selectedCampaignId;
  input.maxLength = 64;
  const toolbar = campaignSelect.parentElement;
  campaignSelect.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    input.replaceWith(campaignSelect);
    if (newName && newName !== selectedCampaignId) {
      await window.electronAPI.renameCampaign(selectedCampaignId, newName);
      selectedCampaignId = newName;
      await refreshCampaigns();
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = selectedCampaignId; input.blur(); }
  });
});

btnDeleteCampaign.addEventListener('click', () => {
  if (!selectedCampaignId) return;
  confirmInline(btnDeleteCampaign, async () => {
    await flushNotes();
    selectedSessionId = null;
    await window.electronAPI.deleteCampaign(selectedCampaignId);
    selectedCampaignId = null;
    await refreshCampaigns();
    if (campaigns.length > 0) {
      selectedCampaignId = campaigns[0].id;
      campaignSelect.value = selectedCampaignId;
      renderSessions();
    }
    await loadCurrentNotes();
  });
});

btnNewSession.addEventListener('click', () => {
  if (!selectedCampaignId) return;
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
      await window.electronAPI.createSession(selectedCampaignId, name);
      await refreshCampaigns();
      selectSession(selectedCampaignId, name);
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
});
