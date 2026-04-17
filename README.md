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
| **Left — Maps tab** | Persistent folder-based image library with projects (subfolders), drag & drop, refresh |
| **Left — Campaign tab** | Campaign selector, sessions list, notes editor |
| **Center** | Collapsible monitor selector (auto-collapses after selection); live player screen preview with viewport zoom-region overlay |
| **Right — Settings tab** | Grid toggle, cell size, color/opacity, DPI calibration, zoom |
| **Right — Layers tab** | Screen mode toggle, viewport zoom, layer stack, layer detail editor, HUD management |

All three panels are resizable: drag the thin divider between any two panels. Side panels show scrollbars when their content exceeds the panel height.

### Layers Tab (Advanced Mode)

Enabled by toggling **Advanced (Layer) Mode** in the Layers tab. Switching reloads the player screen with the layer renderer.

| Section | Controls |
|---------|----------|
| **Viewport** | Zoom in/out/reset slider; drag the gold viewport rectangle on the preview to pan; 🎯 Ping button — click then click the preview to send a pulsing marker to the player screen |
| **Layers** | Add Image / Light / Fog / Weather layers; eye icon to show/hide; ⠿ grip to drag-and-drop reorder; click row to expand detail editor; × to delete (with confirmation) |
| **Layer detail** | Type-specific fields: source file (image/gif/video), color + opacity (light), weather type + intensity |
| **HUDs** | Add Initiative Tracker; eye icon to show/hide; click row to expand editor |
| **Initiative** | Add entries (name, roll, hidden checkbox); Start/Stop combat; Next/Prev turn |
| **Scene** | 💾 Save scene to JSON; 📂 Load scene from JSON; ↺ Reset to empty |

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
                └── notes.md     # session notes
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

- **Layer stack** — image, GIF, video, light/shadow, fog of war, weather particle layers; drag ⠿ grip to reorder
- **Layer move/resize** — drag any layer on the GM preview to move it; resize via 8-point handles; all layer types (including fog and weather) supported; images added from the library appear at natural pixel size, centred
- **Viewport zoom & pan** — GM zooms and drags the gold region rectangle on the preview to choose what the player sees; viewport rect dims everything outside the visible area
- **HUD overlays** — screen-space panels unaffected by pan/zoom: initiative tracker with combat turn tracking
- **Ping** — GM clicks preview → pulsing ring + dot appears at that position on the player screen
- **Scene persistence** — save/load full layer state as JSON

## Roadmap

### Advanced Screen — Remaining enhancements

The core Advanced screen is implemented. Remaining polish items:

- **Per-layer delayed reveal** — countdown shown on the player screen before the object appears
- **Fog of War reveal tool** — GM draws on the preview to erase fog; currently fog is a static full-screen layer
- **Default assets** — bundled quick-insert objects (fire GIF, fireflies, etc.)
- **Status panel HUD** — names + status badges, no turn management
- **Initiative enhancements** — sort by roll, per-entry status badge management, "???" hidden slot mode

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
│   │   ├── scenes/    # scene presets used in this session
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

- **Scene presets** — save the complete state (active map + all layers + zoom) as a named preset; switch scenes instantly from a preset list; presets are attached to sessions in the campaign
- **Status panel** promotion — if the status panel grows complex enough, consider making it a full dockable window like the initiative tracker


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
