// ── DOM refs ──────────────────────────────────────────────────────────────────
export const libSetup        = document.getElementById('lib-setup');
export const libRootPath     = document.getElementById('lib-root-path');
export const libContent      = document.getElementById('lib-content');
export const libFooter       = document.querySelector('.lib-footer');
export const btnRefreshLib   = document.getElementById('btn-refresh-lib');
export const btnSelectFolder = document.getElementById('btn-select-folder');
export const btnSetupFolder  = document.getElementById('btn-setup-folder');
export const btnNewProject   = document.getElementById('btn-new-project');
export const btnAddImages    = document.getElementById('btn-add-images');
export const dropOverlay     = document.getElementById('drop-overlay');

// ── Campaign tab ──────────────────────────────────────────────────────────────
export const tabBtns           = document.querySelectorAll('#left-panel-tabs .panel-tab');
export const tabPaneAssets     = document.getElementById('tab-pane-assets');
export const tabPaneCampaign   = document.getElementById('tab-pane-campaign');
export const campaignSelect    = document.getElementById('campaign-select');
export const btnNewCampaign    = document.getElementById('btn-new-campaign');
export const btnRenameCampaign = document.getElementById('btn-rename-campaign');
export const btnDeleteCampaign = document.getElementById('btn-delete-campaign');
export const sessionsContent   = document.getElementById('sessions-content');
export const notesTextarea     = document.getElementById('notes-textarea');
export const notesStatus       = document.getElementById('notes-status');
export const notesTitle        = document.getElementById('notes-title');
export const btnNewSession     = document.getElementById('btn-new-session');

export const monitorMap          = document.getElementById('monitor-map');
export const monitorList         = document.getElementById('monitor-list');
export const monitorSectionBody  = document.getElementById('monitor-section-body');
export const btnToggleMonitors   = document.getElementById('btn-toggle-monitors');
export const btnCloseScreen      = document.getElementById('btn-close-screen');
export const panelMaps           = document.getElementById('panel-maps');
export const panelSettings       = document.getElementById('panel-settings');
export const resizeHandleLeft    = document.getElementById('resize-left');
export const resizeHandleRight   = document.getElementById('resize-right');
export const previewImg          = document.getElementById('preview-img');
export const previewPlaceholder  = document.getElementById('preview-placeholder');
export const btnRefreshPreview   = document.getElementById('btn-refresh-preview');

export const elGridVisible   = document.getElementById('grid-visible');
export const elCellSize      = document.getElementById('cell-size');
export const elGridColor     = document.getElementById('grid-color');
export const elGridOpacity   = document.getElementById('grid-opacity');
export const elGridOpacityVal= document.getElementById('grid-opacity-val');
export const elDpi           = document.getElementById('dpi');
export const elZoomVal       = document.getElementById('zoom-val');
export const elZoomSlider    = document.getElementById('zoom-slider');
export const btnZoomIn       = document.getElementById('zoom-in');
export const btnZoomOut      = document.getElementById('zoom-out');
export const btnZoomReset    = document.getElementById('zoom-reset');

// ── State ─────────────────────────────────────────────────────────────────────
export const NOTES_DEBOUNCE_MS = 800;
export const settings = { gridVisible: true, cellSizeInches: 1.0, zoom: 1.0, dpi: 96, gridColor: '#ffffff', gridOpacity: 0.25 };

export const campaign = {
  list:       [],
  selectedId: null,
  sessionId:  null,
  notesTimer: null,
};

export const display = {
  list:       [],
  activeId:   null,
  screenW:    1920,
  screenH:    1080,
  previewUrl: null,
  advanced:   false,
};

export const mapLib = {
  activeId:    null,
  dragId:      null,
  dropCounter: 0,
};

// ── Advanced DOM refs ─────────────────────────────────────────────────────────
export const elScreenModeSimple   = document.getElementById('screen-mode-simple');
export const elAdvGridVisible     = document.getElementById('adv-grid-visible');
export const elGridScaleViewport  = document.getElementById('grid-scale-viewport');
export const vpZoomVal            = document.getElementById('vp-zoom-val');
export const vpZoomIn             = document.getElementById('vp-zoom-in');
export const vpZoomOut            = document.getElementById('vp-zoom-out');
export const vpZoomReset          = document.getElementById('vp-zoom-reset');
export const vpZoomSlider         = document.getElementById('vp-zoom-slider');
export const btnPingMode          = document.getElementById('btn-ping-mode');
export const layerListEl          = document.getElementById('layer-list');
export const layerDetail          = document.getElementById('layer-detail');
export const layerDetailTitle     = document.getElementById('layer-detail-title');
export const layerDetailFields    = document.getElementById('layer-detail-fields');
export const hudListEl            = document.getElementById('hud-list');
export const initiativeEditor     = document.getElementById('initiative-editor');
export const initiativeEntriesEl  = document.getElementById('initiative-entries');
export const btnCombatToggle      = document.getElementById('btn-combat-toggle');
export const btnCombatPrev        = document.getElementById('btn-combat-prev');
export const btnCombatNext        = document.getElementById('btn-combat-next');
export const btnAddEntry          = document.getElementById('btn-add-entry');
export const btnAddInitiative     = document.getElementById('btn-add-initiative');
export const btnAddStatusHud      = document.getElementById('btn-add-status-hud');
export const btnAddHandout        = document.getElementById('btn-add-handout');
export const statusesEditor       = document.getElementById('statuses-editor');
export const statusesEntriesEl    = document.getElementById('statuses-entries');
export const handoutEditor        = document.getElementById('handout-editor');
export const hudSimWrap           = document.getElementById('hud-sim-wrap');
export const hudSimViewport       = document.getElementById('hud-sim-viewport');
export const hudSimScreen         = document.getElementById('hud-sim-screen');
export const btnAddImageLayer     = document.getElementById('btn-add-image-layer');
export const btnAddLightLayer     = document.getElementById('btn-add-light-layer');
export const btnAddFogLayer       = document.getElementById('btn-add-fog-layer');
export const btnAddWeatherLayer   = document.getElementById('btn-add-weather-layer');
export const btnSaveScene         = document.getElementById('btn-save-scene');
export const btnLoadScene         = document.getElementById('btn-load-scene');
export const btnResetScene        = document.getElementById('btn-reset-scene');
export const sceneNameInput       = document.getElementById('scene-name-input');
export const sceneAutosaveBadge   = document.getElementById('scene-autosave-badge');
export const scenesContent        = document.getElementById('scenes-content');
export const btnRefreshScenes     = document.getElementById('btn-refresh-scenes');
export const hudConfigsContent    = document.getElementById('hud-configs-content');
export const btnSaveHudConfig     = document.getElementById('btn-save-hud-config');
export const btnRefreshHudConfigs = document.getElementById('btn-refresh-hud-configs');
export const elCanvasBg           = document.getElementById('canvas-bg');
export const btnFitView           = document.getElementById('btn-fit-view');
export const elSnapToGrid         = document.getElementById('snap-to-grid');
export const canvasCoordsEl       = document.getElementById('canvas-coords');

export const CANVAS_SIZE    = 8192;
export const MIN_LAYER_SIZE = 20;

// ── Advanced state ────────────────────────────────────────────────────────────
export const sceneState = {
  layers:           [],
  huds:             [],
  loadedId:         null,
  loadedHudConfigId: null,
  selectedLayerId:  null,
  selectedHudId:    null,
  dragSrcLayerId:   null,
  ready:            false,
  bg:               '#1a1a2e',
};

export const viewport = {
  cx:           4096,
  cy:           4096,
  zoom:         1.0,
  gmCamX:       4096,
  gmCamY:       4096,
  gmCamZoom:    0.05,
  gmCamPanDrag: null,
  snapToGrid:   false,
};

export const ui = {
  pingMode:    false,
  simDragging: false,
};

export let autosaveTimer = null;

export const gmImageCache   = new Map();

export let lastScreenPreviewUrl = null;

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Layer overlay canvas ──────────────────────────────────────────────────────
export const layerOverlay  = document.getElementById('layer-overlay');
export const overlayCtx    = layerOverlay.getContext('2d');

export const POSITIONABLE_TYPES = new Set(['image', 'gif', 'video', 'light', 'fog', 'weather']);
export const HANDLE_SIZE        = 8;

export let overlayDrag = null;
export let overlayThrottleTimer = null;

// ── Window bridge (for unconverted classic scripts) ───────────────────────────
Object.assign(window, {
  libSetup, libRootPath, libContent, libFooter,
  btnRefreshLib, btnSelectFolder, btnSetupFolder, btnNewProject, btnAddImages, dropOverlay,
  tabBtns, tabPaneAssets, tabPaneCampaign,
  campaignSelect, btnNewCampaign, btnRenameCampaign, btnDeleteCampaign,
  sessionsContent, notesTextarea, notesStatus, notesTitle, btnNewSession,
  monitorMap, monitorList, monitorSectionBody, btnToggleMonitors, btnCloseScreen,
  panelMaps, panelSettings, resizeHandleLeft, resizeHandleRight,
  previewImg, previewPlaceholder, btnRefreshPreview,
  elGridVisible, elCellSize, elGridColor, elGridOpacity, elGridOpacityVal,
  elDpi, elZoomVal, elZoomSlider, btnZoomIn, btnZoomOut, btnZoomReset,
  NOTES_DEBOUNCE_MS, settings, campaign, display, mapLib,
  elScreenModeSimple, elAdvGridVisible, elGridScaleViewport,
  vpZoomVal, vpZoomIn, vpZoomOut, vpZoomReset, vpZoomSlider,
  btnPingMode, layerListEl, layerDetail, layerDetailTitle, layerDetailFields,
  hudListEl, initiativeEditor, initiativeEntriesEl,
  btnCombatToggle, btnCombatPrev, btnCombatNext, btnAddEntry,
  btnAddInitiative, btnAddStatusHud, btnAddHandout,
  statusesEditor, statusesEntriesEl, handoutEditor,
  hudSimWrap, hudSimViewport, hudSimScreen,
  btnAddImageLayer, btnAddLightLayer, btnAddFogLayer, btnAddWeatherLayer,
  btnSaveScene, btnLoadScene, btnResetScene, sceneNameInput, sceneAutosaveBadge,
  scenesContent, btnRefreshScenes, hudConfigsContent, btnSaveHudConfig, btnRefreshHudConfigs,
  elCanvasBg, btnFitView, elSnapToGrid, canvasCoordsEl,
  CANVAS_SIZE, MIN_LAYER_SIZE,
  sceneState, viewport, ui, gmImageCache,
  genId,
  layerOverlay, overlayCtx, POSITIONABLE_TYPES, HANDLE_SIZE,
});

// Mutable lets need getter/setter so classic-script assignments update this module's binding.
for (const [key, get, set] of [
  ['autosaveTimer',        () => autosaveTimer,        v => { autosaveTimer = v; }],
  ['lastScreenPreviewUrl', () => lastScreenPreviewUrl, v => { lastScreenPreviewUrl = v; }],
  ['overlayDrag',          () => overlayDrag,          v => { overlayDrag = v; }],
  ['overlayThrottleTimer', () => overlayThrottleTimer, v => { overlayThrottleTimer = v; }],
]) {
  Object.defineProperty(window, key, { get, set, configurable: true });
}
