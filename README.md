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
| **Center** | Collapsible monitor selector (auto-collapses after selection); live player screen preview with viewport zoom-region overlay |
| **Right — Screen tab** | DPI calibration, zoom |
| **Right — Layers tab** | Grid (collapsible), screen mode toggle, viewport zoom, layer stack, layer detail editor, HUD management |

All three panels are resizable: drag the thin divider between any two panels. Side panels show scrollbars when their content exceeds the panel height.

### Layers Tab (Advanced Mode)

Advanced (Layer) Mode is the default. Toggle **Simple Mode** in the Layers tab to switch to the basic renderer (no layers, just a map image + grid). Switching reloads the player screen.

The **Grid** section at the top of the Layers tab is collapsible — click the title or the ▾ button to collapse/expand it. Grid settings (show/hide, cell size, color, opacity) were moved here from the Screen tab.

| Section | Controls |
|---------|----------|
| **Viewport** | Zoom in/out/reset slider; drag the gold viewport rectangle on the preview to pan; 🎯 Ping button — click then click the preview to send a pulsing marker to the player screen |
| **Layers** | Add Image / Light / Fog / Weather layers; eye icon to show/hide; ⠿ grip to drag-and-drop reorder; click row to expand detail editor; × to delete (with confirmation) |
| **Layer detail** | Type-specific fields: source file (image/gif/video), color + opacity (light), weather type + intensity |
| **HUDs** | Add Initiative Tracker (In) or Status Panel (St); eye icon to show/hide; click row to expand editor |
| **Initiative** | Full initiative tracker — see HUD section below for details |
| **Scene** | Named scenes auto-saved to the active campaign/session; scene list with load/delete; ⬆ Export to JSON file; ⬇ Import from JSON file; ↺ New (reset to empty) |

## HUD System — Initiative Tracker

### GM Controls (per tracker)

| Control | Description |
|---------|-------------|
| **Positions** | Check any combination of the four screen corners; each corner has its own **Facing** (Up / Down / Left / Right) so players seated on any side of the table can read the tracker |
| **Font size** | Scales all text in the HUD — title, entry names, badges, and HP — proportionally |
| **Status labels** | Toggle to show full condition names next to the coloured dots on the player screen (GM-controlled, not clickable by players) |
| **Custom Presets** | Add named colour presets that appear as quick-add buttons alongside the built-in Pathfinder 1e conditions |
| **Combat** | ▶ Start / ■ Stop combat mode; ◀ ▶ step through turns |

### Initiative Entries

Each entry has a main row and two sub-rows:

**Main row:**
- Name input, initiative roll, **? checkbox** (lurking — shows `???` to players), **👁 checkbox** (invisible — entry hidden from player list entirely), delete button
- New entries default to **lurking** so players are never spoiled accidentally; uncheck `?` to reveal

**Status sub-row:**
- Active conditions shown as coloured chips with `×` to remove
- Click `+ status` to open the status picker:
  - **Pathfinder 1e** — all 30 standard conditions (Blinded, Confused, Dying, Paralyzed, Stunned, etc.) with preset colours; one click to apply
  - **Custom** — any presets added in the Custom Presets section above
  - **Manual** — colour picker + free-text label for anything else

**HP sub-row:**
- `HP` — max HP input; red checkbox next to it hides the max from players (`current/???`)
- `dmg` — accumulated damage dealt (editable to correct mistakes)
- `| +dmg ↯` — type new damage and press ↯ to add it to the running total

### Player Screen Display

- Entry rows show: **initiative badge · name · HP · condition pips**
- **HP display logic:**
  - Lurking entry (`???` name) → `damage_dealt/???`
  - Revealed + max HP hidden → `current_hp/???`
  - Revealed + max HP shown → `current_hp/max_hp`
  - No max HP set, but damage tracked → `damage_dealt/???`
- Clicking `+ status` shows labels → toggled by **Status labels** checkbox in GM panel, not by players
- HUD panels are **draggable** by their title bar so any player can reposition them on their side of the screen; all other panel interactions are disabled

### Rotation

When a corner is set to a facing other than Up, the panel is rotated so the text points toward that side of the table:

| Facing | Readable from |
|--------|---------------|
| Up (default) | Bottom of screen |
| Down | Top of screen |
| Right | Right side of screen |
| Left | Left side of screen |

Multiple corners can be active simultaneously — useful for four-sided tables.

### Settings File

Built-in condition data lives in `renderer/gm/settings.js`. To change a condition colour or add house-rule conditions, edit that file — no other code needs to change. Custom per-session presets are saved to `localStorage` in the GM window.

## Persistence

All settings are saved automatically to Electron's `userData` directory (`config.json`):

| Key | What is saved |
|-----|--------------|
| `rootFolder` | Path to the maps root folder |
| `settings` | Grid visibility, cell size, color, opacity, DPI, zoom |

Settings are restored when the app next starts — the GM screen controls reflect the saved values immediately.

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
                └── scenes/
                    └── <uuid>.json  # auto-saved scenes
```

- **Campaigns** — create, rename, delete (with confirmation); switch via dropdown
- **Sessions** — create, rename, delete (with confirmation) within a campaign
- **Notes** — freeform text editor; auto-saves 800 ms after the last keystroke
  - When no session is selected: editing campaign-level notes
  - When a session is selected: editing that session's notes; click again to deselect
- Notes are plain `.md` files readable outside the app

## Player Screen — Simple Mode

- Fullscreen Canvas on the selected monitor
- Map image displayed behind the grid (contain-fit, centered)
- Grid overlay with configurable size, color, opacity
- Zoom applies to both map and grid

## Player Screen — Advanced Mode (Layer System)

Switched to via the Layers tab in the GM panel. Fully separate renderer (`screen-advanced`).

### Virtual Canvas

Advanced Mode uses a fixed **8192 × 8192 pixel virtual canvas**. All layer positions and sizes are stored as canvas pixels (integers). The viewport maps a window into this canvas onto the physical player screen.

**Coordinate system:**

| Concept | Unit |
|---------|------|
| Layer `x`, `y`, `w`, `h` | Canvas pixels (0 – 8192) |
| Viewport `cx`, `cy` | Canvas pixel coordinates of the screen centre |
| Viewport `zoom` | Screen pixels per canvas pixel (`1.0` = 1:1) |

The rendering transform is: `screenX = (canvasX − cx) × zoom + screenW/2`

### Features

- **Layer stack** — image, GIF, video, light/shadow, fog of war, weather particle layers; drag ⠿ grip to reorder
- **Layer move/resize** — drag any layer on the GM preview to move it; resize via 8-point handles; snap-to-grid toggle available; images added from the library are placed at their natural pixel size, centred on the canvas
- **GM camera** — the preview shows the full virtual canvas; scroll-wheel to zoom, middle-click or right-click drag to pan; ⊞ Fit View to auto-fit all layers
- **Canvas coordinates** — live pixel readout (bottom-left of preview) as the cursor moves
- **Viewport zoom & pan** — drag the gold rectangle to pan what the player sees; zoom slider adjusts screen pixels per canvas pixel
- **Background color** — configurable solid fill behind all layers
- **HUD overlays** — screen-space panels unaffected by pan/zoom; draggable by title bar; multi-corner with per-corner facing direction
- **Ping** — GM clicks preview → pulsing ring + dot appears at the corresponding canvas position on the player screen
- **Scene persistence** — named scenes auto-saved to the active campaign/session; export/import as JSON; scene survives screen reconnects

## Roadmap

### Future Implementation — GM HUD Preview

The GM screen will gain a dedicated **HUD Preview panel** — a scaled replica of the player screen where all HUD elements (initiative trackers, status panels, etc.) are visible and fully repositionable. The GM will be able to drag each HUD to any position, preview how multiple overlapping panels look, and confirm placement before it appears on the player screen. This removes the need for players to drag HUDs themselves and gives the GM full spatial control over the overlay layout.

---

### Advanced Screen — Remaining enhancements

The core Advanced screen is implemented. Remaining polish items:

- **Per-layer delayed reveal** — countdown shown on the player screen before the object appears
- **Fog of War reveal tool** — GM draws on the preview to erase fog; currently fog is a static full-screen layer
- **Default assets** — bundled quick-insert objects (fire GIF, fireflies, etc.)
- **Status panel HUD** — names + status badges, no turn management

---

### Tokens & Character Roster

A dedicated **Tokens** section (separate from but linked to the layer system).

- **Character / NPC cards** — each entry has: name, portrait image, type (PC / NPC / monster), notes
- **Token layer** — drag a character card onto the map to place a circular token; token shows the portrait; GM can move and resize it on the canvas
- **Initiative integration** — drag a character card directly into the initiative tracker to add them with their portrait already attached; portrait shown as a small avatar next to the name in the tracker
- **Persistence** — character roster saved as part of the scene JSON (or as a separate roster file reusable across scenes)
- Token card can be arranged and moved to each of the corners so the player can be seen who is playing who, something like cards representing hand

---

### Fade / Transition

- Fade to black (or custom color) on command from the GM side
- Configurable duration
- Player screen shows the fade while GM reorganises the scene behind it
- Optional hold on black until GM manually releases

---

### Spotlight

- GM places one or more circular light cones on the canvas via the preview
- Everything outside the lit area dims to a configurable darkness level
- Spotlight can be moved in real time (follow a creature, sweep a torch)
- Lives as a special layer type; supports show/hide and delayed reveal like other layers

---

### Drawing & Annotations

- Freehand paint tool on the GM preview; strokes appear live on the player screen
- Tools: freehand brush, straight line, arrow, circle, rectangle
- Color and opacity picker; adjustable brush size
- Pen/stylus pressure sensitivity on touch devices
- Modes:
  - **Temporary** — auto-clears after a configurable timer, or on GM command
  - **Persistent** — saved as a drawing layer in the scene JSON
- Eraser tool to remove individual strokes
- Clear-all button

---

### Weather & Atmosphere Effects

Canvas particle / overlay effects added as built-in layer types:

| Effect | Notes |
|--------|-------|
| Rain | light / heavy variants |
| Snow | light / blizzard variants |
| Falling embers / ash | for fire scenes |
| Drifting fog / mist | low-opacity overlay |
| Fireflies | gentle ambient glow particles |
| Fire | looping GIF or canvas particle version |
| Smoke | slow-rising particle layer |

- Intensity slider per effect
- Show/hide and delayed reveal like any other layer
- Multiple effects can be stacked (e.g. fog + rain)

---

### Handouts & Notable Items

- GM opens a handout panel and selects any image from the library (or a dedicated handouts folder)
- Selected image pops onto the player screen as a floating overlay — centered or pinned to a corner
- Multiple handouts can be shown simultaneously, each independently dismissible
- Optional title label below the image
- Useful for: letters, portraits, item art, map fragments, clues
- Handouts do not interact with the layer system; they are always on top
- Handouts can be shown in all 4 directions in order for all players to be able to see them

---

### Touch & Pen Support

Support for touch and stylus input on both GM and player screens (targeted at laptops with touchscreens and active pens).

**GM screen (touch)**
- Pan the preview with one finger
- Pinch-to-zoom the preview
- Tap to select / activate map or layer objects
- Drag objects (tokens, spotlight, annotations) with finger or pen
- Drawing tools fully pen-aware: pressure → brush opacity/size

**Player screen (touch)**
- Pinch-to-zoom and pan (if zoom-to-region feature is enabled and GM allows player zoom)
- Tap to acknowledge a handout / dismiss overlay

**Pen-specific**
- Barrel button mapped to eraser in drawing mode
- Hover preview of brush stroke before contact

---

### Campaign & Notes

A campaign is a top-level container that groups everything belonging to a single story — similar to how projects organise maps, but richer. Multiple campaigns can exist side by side.

#### Structure
```
Campaign/
├── Sessions/          # one entry per session played
│   ├── Session 1/
│   │   ├── notes.md   # freeform session notes
│   │   ├── scenes/    # named scene saves for this session (JSON)
│   │   └── handouts/  # handouts shown in this session
│   └── Session 2/ …
├── NPCs/              # reusable NPC cards (linked to character roster)
├── Locations/         # location notes with optional map thumbnail
├── Items/             # notable items / handout images
└── Party/             # player characters (linked to token roster)
```

#### Sessions
- Create, rename, delete sessions
- Each session has a **notes editor** — freeform markdown text with basic formatting (bold, italic, headings, bullet lists)
- Notes are searchable across all sessions in a campaign
- Attach maps to a session (links to the map library project)
- Attach scene presets and handouts; re-open them directly from the session view

#### NPC / Location / Item cards
- Name, image/portrait, tags, and a freeform notes field per card
- NPC cards feed directly into the **character roster** and **initiative tracker**
- Location cards can hold a map thumbnail and a link to the map library entry
- Item cards double as handout sources — send an item's image to the player screen as a handout with one click

#### Party
- Persistent player character cards (name, portrait, player name, class/race, notes)
- Shared across all sessions in the campaign
- Automatically available in the initiative tracker and token roster

#### Persistence
- Each campaign stored as a folder on disk (inside or alongside the maps root)
- Notes saved as plain `.md` files; everything else as JSON
- Campaigns listed in the library panel alongside map projects; switchable from the GM screen

---

### Other planned features

- **Status panel** promotion — if the status panel grows complex enough, consider making it a full dockable window like the initiative tracker
- **Detachable panels** — allow left/right panels to be dragged off and repositioned as floating windows
- **Rich-text campaign notes** — markdown formatting in notes editor (bold, italic, headings, lists)
- **Both notes visible** — split view or tabs to show campaign notes and session notes simultaneously
- **Status HUD enhancements** — health tracking, handout display, NPC cards in status panel


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
