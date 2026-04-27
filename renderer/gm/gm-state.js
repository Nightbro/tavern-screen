// ── DOM refs ──────────────────────────────────────────────────────────────────
const libSetup        = document.getElementById('lib-setup');
const libRootPath     = document.getElementById('lib-root-path');
const libContent      = document.getElementById('lib-content');
const libFooter       = document.querySelector('.lib-footer');
const btnRefreshLib   = document.getElementById('btn-refresh-lib');
const btnSelectFolder = document.getElementById('btn-select-folder');
const btnSetupFolder  = document.getElementById('btn-setup-folder');
const btnNewProject   = document.getElementById('btn-new-project');
const btnAddImages    = document.getElementById('btn-add-images');
const dropOverlay     = document.getElementById('drop-overlay');

// ── Campaign tab ──────────────────────────────────────────────────────────────
const tabBtns           = document.querySelectorAll('#left-panel-tabs .panel-tab');
const tabPaneAssets     = document.getElementById('tab-pane-assets');
const tabPaneCampaign   = document.getElementById('tab-pane-campaign');
const campaignSelect    = document.getElementById('campaign-select');
const btnNewCampaign    = document.getElementById('btn-new-campaign');
const btnRenameCampaign = document.getElementById('btn-rename-campaign');
const btnDeleteCampaign = document.getElementById('btn-delete-campaign');
const sessionsContent   = document.getElementById('sessions-content');
const notesTextarea     = document.getElementById('notes-textarea');
const notesStatus       = document.getElementById('notes-status');
const notesTitle        = document.getElementById('notes-title');
const btnNewSession     = document.getElementById('btn-new-session');

const monitorMap          = document.getElementById('monitor-map');
const monitorList         = document.getElementById('monitor-list');
const monitorSectionBody  = document.getElementById('monitor-section-body');
const btnToggleMonitors   = document.getElementById('btn-toggle-monitors');
const btnCloseScreen      = document.getElementById('btn-close-screen');
const panelMaps           = document.getElementById('panel-maps');
const panelSettings       = document.getElementById('panel-settings');
const resizeHandleLeft    = document.getElementById('resize-left');
const resizeHandleRight   = document.getElementById('resize-right');
const previewImg          = document.getElementById('preview-img');
const previewPlaceholder  = document.getElementById('preview-placeholder');
const btnRefreshPreview   = document.getElementById('btn-refresh-preview');

const elGridVisible   = document.getElementById('grid-visible');
const elCellSize      = document.getElementById('cell-size');
const elGridColor     = document.getElementById('grid-color');
const elGridOpacity   = document.getElementById('grid-opacity');
const elGridOpacityVal= document.getElementById('grid-opacity-val');
const elDpi           = document.getElementById('dpi');
const elZoomVal       = document.getElementById('zoom-val');
const elZoomSlider    = document.getElementById('zoom-slider');
const btnZoomIn       = document.getElementById('zoom-in');
const btnZoomOut      = document.getElementById('zoom-out');
const btnZoomReset    = document.getElementById('zoom-reset');

// ── State ─────────────────────────────────────────────────────────────────────
const NOTES_DEBOUNCE_MS = 800;
const settings = { gridVisible: true, cellSizeInches: 1.0, zoom: 1.0, dpi: 96, gridColor: '#ffffff', gridOpacity: 0.25 };

const campaign = {
  list:       [],
  selectedId: null,
  sessionId:  null,
  notesTimer: null,
};

const display = {
  list:       [],
  activeId:   null,
  screenW:    1920,
  screenH:    1080,
  previewUrl: null,
  advanced:   false,
};

const mapLib = {
  activeId:    null,
  dragId:      null,
  dropCounter: 0,
};

// ── Advanced DOM refs ─────────────────────────────────────────────────────────
const elScreenModeSimple   = document.getElementById('screen-mode-simple');
const elAdvGridVisible     = document.getElementById('adv-grid-visible');
const elGridScaleViewport  = document.getElementById('grid-scale-viewport');
const vpZoomVal            = document.getElementById('vp-zoom-val');
const vpZoomIn             = document.getElementById('vp-zoom-in');
const vpZoomOut            = document.getElementById('vp-zoom-out');
const vpZoomReset          = document.getElementById('vp-zoom-reset');
const vpZoomSlider         = document.getElementById('vp-zoom-slider');
const btnPingMode          = document.getElementById('btn-ping-mode');
const layerListEl          = document.getElementById('layer-list');
const layerDetail          = document.getElementById('layer-detail');
const layerDetailTitle     = document.getElementById('layer-detail-title');
const layerDetailFields    = document.getElementById('layer-detail-fields');
const hudListEl            = document.getElementById('hud-list');
const initiativeEditor     = document.getElementById('initiative-editor');
const initiativeEntriesEl  = document.getElementById('initiative-entries');
const btnCombatToggle      = document.getElementById('btn-combat-toggle');
const btnCombatPrev        = document.getElementById('btn-combat-prev');
const btnCombatNext        = document.getElementById('btn-combat-next');
const btnAddEntry          = document.getElementById('btn-add-entry');
const btnAddInitiative     = document.getElementById('btn-add-initiative');
const btnAddStatusHud      = document.getElementById('btn-add-status-hud');
const btnAddHandout        = document.getElementById('btn-add-handout');
const statusesEditor       = document.getElementById('statuses-editor');
const statusesEntriesEl    = document.getElementById('statuses-entries');
const handoutEditor        = document.getElementById('handout-editor');
const hudSimWrap           = document.getElementById('hud-sim-wrap');
const hudSimViewport       = document.getElementById('hud-sim-viewport');
const hudSimScreen         = document.getElementById('hud-sim-screen');
const btnAddImageLayer     = document.getElementById('btn-add-image-layer');
const btnAddLightLayer     = document.getElementById('btn-add-light-layer');
const btnAddFogLayer       = document.getElementById('btn-add-fog-layer');
const btnAddWeatherLayer   = document.getElementById('btn-add-weather-layer');
const btnSaveScene         = document.getElementById('btn-save-scene');
const btnLoadScene         = document.getElementById('btn-load-scene');
const btnResetScene        = document.getElementById('btn-reset-scene');
const sceneNameInput       = document.getElementById('scene-name-input');
const sceneAutosaveBadge   = document.getElementById('scene-autosave-badge');
const scenesContent        = document.getElementById('scenes-content');
const btnRefreshScenes     = document.getElementById('btn-refresh-scenes');
const hudConfigsContent    = document.getElementById('hud-configs-content');
const btnSaveHudConfig     = document.getElementById('btn-save-hud-config');
const btnRefreshHudConfigs = document.getElementById('btn-refresh-hud-configs');
const elCanvasBg           = document.getElementById('canvas-bg');
const btnFitView           = document.getElementById('btn-fit-view');
const elSnapToGrid         = document.getElementById('snap-to-grid');
const canvasCoordsEl       = document.getElementById('canvas-coords');

const CANVAS_SIZE    = 8192;
const MIN_LAYER_SIZE = 20;

// ── Advanced state ────────────────────────────────────────────────────────────
const sceneState = {
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

const viewport = {
  cx:           4096,
  cy:           4096,
  zoom:         1.0,
  gmCamX:       4096,
  gmCamY:       4096,
  gmCamZoom:    0.05,
  gmCamPanDrag: null,
  snapToGrid:   false,
};

const ui = {
  pingMode:    false,
  simDragging: false,
};

let autosaveTimer = null;

const gmImageCache   = new Map();

let lastScreenPreviewUrl = null;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Layer overlay canvas ──────────────────────────────────────────────────────
const layerOverlay  = document.getElementById('layer-overlay');
const overlayCtx    = layerOverlay.getContext('2d');

const POSITIONABLE_TYPES = new Set(['image', 'gif', 'video', 'light', 'fog', 'weather']);
const HANDLE_SIZE        = 8;

let overlayDrag = null;
let overlayThrottleTimer = null;
