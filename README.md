# Tavern Screen

An Electron app for sharing a map on a second screen as a fullscreen display. Designed for tabletop RPG sessions.

## Tech Stack

- **Framework:** Electron (Node.js)
- **Renderer:** HTML/CSS/JS in Electron windows
- **Map & Grid:** Canvas API

## Project Structure

```
tavern-screen/
├── main.js                      # Electron main process, IPC wiring
├── preload.js                   # IPC bridge (contextIsolation)
├── windowManager.js             # Window lifecycle, active map, preview capture
├── library.js                   # File-system map library (projects, copy, move, delete)
├── campaignLibrary.js           # File-system campaign library (campaigns, sessions, notes)
├── config.js                    # Key-value config backed by JSON (settings + folder persistence)
├── renderer/
│   ├── gm/                      # GM screen (tabbed left panel + center + settings/layers)
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── settings.js          # Static config: PF1e conditions, HUD defaults (loaded before gm.js)
│   │   └── gm.js
│   ├── screen/                  # Player screen — Simple mode (fullscreen map + grid)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── screen.js
│   └── screen-advanced/         # Player screen — Advanced mode (layer system + HUDs)
│       ├── index.html
│       ├── style.css
│       └── screen-advanced.js
├── test/
│   ├── config.test.js
│   ├── library.test.js
│   ├── campaignLibrary.test.js
│   └── windowManager.test.js
├── run.bat                      # Double-click to start the app
├── build.bat                    # Double-click to build the Windows installer + portable exe
└── package.json
```

## Running the App

### Development (double-click or terminal)

```
run.bat
```
or
```bash
npm start
```

### Build Windows Executable

```
build.bat
```
or
```bash
npm run build
```

Output is in the `dist/` folder:
- `Tavern Screen Setup x.x.x.exe` — NSIS installer (lets user choose install directory)
- `Tavern Screen x.x.x.exe` — portable, no installation needed

> **Note:** An `assets/icon.ico` file can be added to give the app a custom icon.
> electron-builder uses a default icon if none is provided.

## GM Screen Layout

| Panel | Contents |
|-------|----------|
| **Left — Assets tab** | Persistent folder-based image library with projects (subfolders), drag & drop, refresh |
| **Left — Campaign tab** | Campaign selector, sessions list, notes editor |
| **Center** | Collapsible monitor selector; **Preview** tab (map + layer overlay) and **HUD Sim** tab (pixel-accurate HUD simulation, advanced mode only) |
| **Right — Screen tab** | DPI calibration, zoom |
| **Right — Layers tab** | Grid (collapsible), screen mode toggle, viewport zoom, layer stack, layer detail editor, HUD management |

All three panels are resizable: drag the thin divider between any two panels. Side panels show scrollbars when their content exceeds the panel height.

### Layers Tab (Advanced Mode)

Advanced (Layer) Mode is the default. Toggle **Simple Mode** in the Layers tab to switch to the basic renderer (no layers, just a map image + grid). Switching reloads the player screen.

The **Grid** section at the top of the Layers tab is collapsible — click the title or the ▾ button to collapse/expand it.

| Section | Controls |
|---------|----------|
| **Viewport** | Zoom in/out/reset slider; drag the gold viewport rectangle on the preview to pan; 🎯 Ping button — click then click the preview to send a pulsing marker to the player screen |
| **Layers** | Add Image / Light / Fog / Weather layers; eye icon to show/hide; ⠿ grip to drag-and-drop reorder; click row to expand detail editor; × to delete (with confirmation) |
| **Layer detail** | Type-specific fields: source file (image/gif/video), color + opacity (light), weather type + intensity |
| **HUDs** | Add **Initiative** (In), **Statuses** (St), or **Handout** (Ho); eye icon to show/hide; click row to expand editor |
| **Scene** | Named scenes auto-saved to the active campaign/session; scene list with load/delete; ⬆ Export to JSON file; ⬇ Import from JSON file; ↺ New (reset to empty) |

---

## HUD System

All HUD types share the same positioning model: each HUD can be assigned to one or more screen corners via a **Positions** checklist, each with its own **Facing** direction for rotated display. Positions can also be set to exact pixel coordinates by dragging in the **HUD Simulation** (see below).

---

### Initiative Tracker

#### GM Controls

| Control | Description |
|---------|-------------|
| **Positions** | Any combination of the four screen corners; each with its own **Facing** (Up / Down / Left / Right) |
| **Font size** | Scales all text in the HUD proportionally |
| **Status labels** | Toggle to show full condition names next to coloured dots on the player screen |
| **Custom Presets** | Add named colour presets that appear as quick-add buttons alongside the built-in Pathfinder 1e conditions |
| **Combat** | ▶ Start / ■ Stop combat mode; ◀ ▶ step through turns |
| **↓ Sort** | Sort entries by initiative roll, highest first; active turn index follows the moved entry |

#### Initiative Entries

Each entry has a main row and two sub-rows:

**Main row:** Name, initiative roll, **?** (lurking — shows `???` to players), **👁** (invisible — hidden from player list entirely), delete button. New entries default to lurking.

**Status sub-row:** Active conditions as coloured chips with `×` to remove. Click `+ status` to open the picker:
- **Pathfinder 1e** — all 30 standard conditions with preset colours
- **Custom** — presets added via the Custom Presets section
- **Manual** — colour picker + free-text label

**HP sub-row:** Max HP field; red checkbox hides max from players (`current/???`); damage accumulator; `+dmg ↯` to apply new damage.

#### Player Screen Display

- Rows show: **initiative badge · name · HP · condition pips**
- HP display logic: lurking → `dmg/???`; revealed + max hidden → `cur/???`; revealed + max shown → `cur/max`
- HUD panels are **draggable** by their title bar on the player screen

---

### Statuses Panel

A simpler HUD showing a list of characters/creatures with their active conditions — no initiative rolls or HP.

#### GM Controls

| Control | Description |
|---------|-------------|
| **Title** | Custom panel label shown as the HUD header |
| **Positions** | Same corner + facing system as Initiative |
| **Font size** | Scales all text proportionally |
| **Status labels** | Toggle full condition names next to pips |
| **Entries** | Name, **?** lurking, **👁** invisible; status sub-row with the same condition picker as Initiative |

#### Player Screen Display

- Rows show: **name · condition pips**
- Useful for party status tracking (buffs, poisons, ongoing effects) without cluttering the initiative order

---

### Handout

Displays an image on the player screen — portraits, letters, item art, map fragments, clues.

#### GM Controls

| Control | Description |
|---------|-------------|
| **Name** | Label shown in the HUD title bar |
| **Images** | Card library of images; click **+ Add** to add one or more from disk at once |
| **Width (px)** | Display width of the image panel on the player screen |
| **Positions** | Same corner + facing system as other HUDs |

Each image appears as a card showing a thumbnail and an editable name label. Clicking a card makes it the **active image** shown to players (highlighted in gold). The `×` button removes an image from the library. Multiple images can be stored and switched on the fly without closing the handout.

#### Player Screen Display

- Renders as a titled image panel showing the currently active image; draggable by title bar
- Multiple handouts can be active simultaneously, each independently positioned

---

### Rotation (all HUD types)

When a position is set to a facing other than Up, the panel is rotated so text reads toward that side of the table:

| Facing | Readable from |
|--------|---------------|
| Up (default) | Bottom of screen |
| Down | Top of screen |
| Right | Right side of screen |
| Left | Left side of screen |

Multiple positions can be active simultaneously — useful for four-sided tables. Each position is independent (different facing, different pixel placement).

---

## HUD Simulation

The **HUD Sim** tab in the center panel (advanced mode only) shows a scaled-down but proportionally accurate replica of the player screen with all HUD panels rendered at their actual visual sizes. Switch to it via the **HUD Sim** tab next to the **Preview** tab. A **↺** refresh button in the tab header forces a redraw at any time.

### What it shows

- A 16:9 rectangle representing the player screen, scaled to fit the available space
- **Live background** — the current player screen composition (map, layers, weather) is captured and shown behind the HUD panels so you can see exactly what the players see; the background refreshes automatically when switching to the HUD Sim tab or after every scene change
- Each HUD panel rendered with its real content — entry names, initiative badges, condition pips, or image
- The panel sizes are accurate relative to the screen: a 24 px font initiative tracker with 5 entries looks proportionally the same in the simulation as it does on the player display

### Dragging panels

Drag any HUD panel by its header inside the simulation:
- The panel moves freely to any pixel position within the screen bounds
- Live coordinates (`x: NNN  y: NNN`) are shown in the section title while dragging
- On release the position is saved; the simulation rebuilds at the new position and the **player screen updates immediately** to match
- The moved panel remains selected (highlighted) after the drag

Saved positions are stored as `{x, y}` pixel offsets from the top-left of the player screen. HUDs without a saved position fall back to corner-based placement.

### Simulation scale

The simulation rescales automatically when the GM panel is resized. The scale factor is `preview_width / player_screen_width` — no manual adjustment needed.

---

## Persistence

All settings are saved automatically to Electron's `userData` directory (`config.json`):

| Key | What is saved |
|-----|--------------|
| `rootFolder` | Path to the maps root folder |
| `settings` | Grid visibility, cell size, color, opacity, DPI, zoom |

Settings are restored when the app next starts.

---

## Map Library

- **Select Folder** — pick any folder; `maps/` and `campaigns/` subdirectories are created inside it
- **Projects** — subfolders inside `maps/`; create, rename, delete (maps moved to Unsorted on delete)
- **Add Images** — file dialog (multi-select) or drag & drop from the OS
- **Switch Maps** — click any thumbnail to send it to the player screen instantly
- **Move between projects** — drag a map card onto another project section
- **Refresh** — re-scans the folder without restarting

## Campaign Library

Campaigns and sessions are stored alongside the map library under the same root folder:

```
<root>/
├── maps/
└── campaigns/
    └── My Campaign/
        ├── notes.md             # campaign-level notes
        └── sessions/
            └── Session 1/
                ├── notes.md     # session notes
                ├── huds.json    # HUD panels for this session (separate from scenes)
                └── scenes/
                    └── <uuid>.json  # auto-saved scenes (layers, viewport — no HUDs)
```

- **Campaigns** — create, rename, delete (with confirmation); switch via dropdown
- **Sessions** — create, rename, delete (with confirmation) within a campaign
- **Notes** — freeform text editor; auto-saves 800 ms after the last keystroke
  - When no session is selected: editing campaign-level notes
  - When a session is selected: editing that session's notes; click again to deselect
- Notes are plain `.md` files readable outside the app

### Persistence model

| What | File | Saved when |
|------|------|-----------|
| Scene (layers, viewport, background) | `sessions/{s}/scenes/{id}.json` | Any layer or scene change |
| HUDs | `sessions/{s}/huds.json` | Any HUD change (add, remove, edit, position) |
| Settings | `userData/config.json` | Any settings change |

HUDs are **session-scoped**, not scene-scoped. Switching between scenes within a session keeps the same HUD panels active. HUDs are loaded from `huds.json` when a session is opened and saved independently whenever HUD data changes — scene saves never touch HUDs, and HUD saves never touch scene files.

---

## Player Screen — Simple Mode

- Fullscreen Canvas on the selected monitor
- Map image displayed behind the grid (contain-fit, centered)
- Grid overlay with configurable size, color, opacity
- Zoom applies to both map and grid

## Player Screen — Advanced Mode (Layer System)

Switched to via the Layers tab in the GM panel. Fully separate renderer (`screen-advanced`).

### Virtual Canvas

Advanced Mode uses a fixed **8192 × 8192 pixel virtual canvas**. All layer positions and sizes are stored as canvas pixels. The viewport maps a window into this canvas onto the physical player screen.

| Concept | Unit |
|---------|------|
| Layer `x`, `y`, `w`, `h` | Canvas pixels (0 – 8192) |
| Viewport `cx`, `cy` | Canvas pixel coordinates of the screen centre |
| Viewport `zoom` | Screen pixels per canvas pixel (`1.0` = 1:1) |

Rendering transform: `screenX = (canvasX − cx) × zoom + screenW/2`

### Features

- **Layer stack** — image, GIF, video, light/shadow, fog of war, weather particle layers; drag ⠿ grip to reorder
- **Layer move/resize** — drag any layer on the GM preview to move it; resize via 8-point handles; snap-to-grid toggle; images placed at their natural pixel size, centred on the canvas
- **GM camera** — scroll-wheel to zoom, middle/right-click drag to pan; ⊞ Fit View to auto-fit all layers
- **Canvas coordinates** — live pixel readout (bottom-left of preview) as the cursor moves
- **Viewport zoom & pan** — drag the gold rectangle to pan what the player sees
- **Background color** — configurable solid fill behind all layers
- **HUD overlays** — Initiative (with sort-by-initiative), Statuses, and Handout (multi-image card library) panels; pixel-accurate positioning via HUD Simulation with live player-screen background; draggable by title bar on the player screen; multi-corner with per-corner facing direction; all changes auto-saved immediately
- **Ping** — GM clicks preview → pulsing ring + dot appears on the player screen
- **Scene persistence** — named scenes auto-saved to the active campaign/session; export/import as JSON

---

## Roadmap


### Advanced Screen — Remaining enhancements

- **Per-layer delayed reveal** — countdown shown on the player screen before an object appears
- **Fog of War reveal tool** — GM draws on the preview to erase fog; currently fog is a static full-screen layer
- **Default assets** — bundled quick-insert objects (fire GIF, fireflies, etc.)

---

### Tokens & Character Roster

A dedicated **Tokens** section (separate from but linked to the layer system).

- **Character / NPC cards** — name, portrait image, type (PC / NPC / monster), notes
- **Token layer** — drag a character card onto the map to place a circular token; token shows the portrait; GM can move and resize it
- **Initiative integration** — drag a character card into the initiative tracker to add them with portrait attached
- **Persistence** — character roster saved as part of the scene JSON or as a reusable roster file
- Token cards can be arranged in corners so players can see who is playing who

---

### Fade / Transition

- Fade to black (or custom color) on GM command
- Configurable duration; optional hold until GM releases
- Player screen shows the fade while GM reorganises the scene behind it

---

### Spotlight

- GM places circular light cones on the canvas via the preview
- Everything outside the lit area dims to a configurable darkness level
- Moveable in real time; lives as a special layer type

---

### Drawing & Annotations

- Freehand paint tool on the GM preview; strokes appear live on the player screen
- Tools: freehand brush, straight line, arrow, circle, rectangle
- Modes: **Temporary** (auto-clears) or **Persistent** (saved as a drawing layer)
- Eraser tool and clear-all button

---

### Weather & Atmosphere Effects

Canvas particle / overlay effects (already partially implemented as layer types):

| Effect | Notes |
|--------|-------|
| Rain | light / heavy variants |
| Snow | light / blizzard variants |
| Falling embers / ash | for fire scenes |
| Drifting fog / mist | low-opacity overlay |
| Fireflies | gentle ambient glow particles |
| Fire | looping GIF or canvas particle version |
| Smoke | slow-rising particle layer |

---

### Touch & Pen Support

- Pan/pinch-to-zoom the GM preview on touch
- Pen-aware drawing tools (pressure → opacity/size)
- Player screen touch: pinch-to-zoom and handout dismiss

---

### Campaign & Notes Enhancements

- **Rich-text notes** — markdown formatting (bold, italic, headings, lists)
- **NPC / Location / Item cards** — reusable across sessions; NPC cards feed the initiative tracker
- **Party roster** — persistent player characters shared across sessions
- **Detachable panels** — float left/right panels as separate windows

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)

## Setup

```bash
npm install
```

## Test

```bash
npm test
```
