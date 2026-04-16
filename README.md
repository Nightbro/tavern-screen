# Tavern Screen

An Electron app for sharing a map on a second screen as a fullscreen display. Designed for tabletop RPG sessions.

## Tech Stack

- **Framework:** Electron (Node.js)
- **Renderer:** HTML/CSS/JS in Electron windows
- **Map & Grid:** Canvas API

## Project Structure

```
tavern-screen/
├── main.js                  # Electron main process, IPC wiring
├── preload.js               # IPC bridge (contextIsolation)
├── windowManager.js         # Window lifecycle, active map, preview capture
├── library.js               # File-system map library (projects, copy, move, delete)
├── config.js                # Key-value config backed by JSON (settings + folder persistence)
├── renderer/
│   ├── gm/                  # GM screen (3-panel layout)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── gm.js
│   └── screen/              # Player screen — fullscreen map + grid
│       ├── index.html
│       ├── style.css
│       └── screen.js
├── test/
│   ├── config.test.js
│   ├── library.test.js
│   └── windowManager.test.js
├── run.bat                  # Double-click to start the app
├── build.bat                # Double-click to build the Windows installer + portable exe
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
| **Left — Map Library** | Persistent folder-based image library with projects (subfolders), drag & drop, refresh |
| **Center** | Monitor selector, live player screen preview |
| **Right — Settings** | Grid toggle, cell size, color/opacity, DPI calibration, zoom |

## Persistence

All settings are saved automatically to Electron's `userData` directory (`config.json`):

| Key | What is saved |
|-----|--------------|
| `rootFolder` | Path to the maps root folder |
| `settings` | Grid visibility, cell size, color, opacity, DPI, zoom |

Settings are restored when the app next starts — the GM screen controls reflect the saved values immediately.

## Map Library

- **Select Folder** — pick any folder; a `maps/` subdirectory is created inside it
- **Projects** — subfolders inside `maps/`; create, rename, delete (maps moved to Unsorted on delete)
- **Add Images** — file dialog (multi-select) or drag & drop from the OS
- **Switch Maps** — click any thumbnail to send it to the player screen instantly
- **Move between projects** — drag a map card onto another project section
- **Refresh** — re-scans the folder without restarting

## Player Screen

- Fullscreen Canvas on the selected monitor
- Map image displayed behind the grid (contain-fit, centered)
- Grid overlay with configurable size, color, opacity
- Zoom applies to both map and grid

## Roadmap

### Layer Screen (Advanced Screen Type)

The current player screen (image + grid) becomes the **Simple** mode. A new **Advanced** screen type introduces a full layer system.

#### Core layer system
- Layer panel on the GM side (Photoshop-style): list of all objects with eye icon to show/hide each one
- Each object is its own layer (image, gif, video, light/shadow shape, default asset)
- Drag to reorder layers
- Per-layer delayed reveal: configurable countdown shown on the player screen before the object appears (especially useful for video)

#### Object types
- **Image** — add, move, resize freely on the canvas via the GM preview
- **GIF** — animated, same controls as image
- **Video** — playback controlled from GM side; supports delayed reveal countdown
- **Light / Shadow** — semi-transparent overlay shapes (blue-gray tint) to paint atmosphere/darkness onto areas; drawn and resized like any other object
- **Fog of War** — separate from light/shadow; starts fully covering the map, GM reveals areas by erasing. Light/shadow is *additive* (paint darkness on top); Fog of War is *subtractive* (everything hidden by default, GM uncovers it)
- **Weather / atmosphere** — canvas particle layers: rain, snow, falling embers, drifting fog; available as built-in layer types alongside the default assets
- **Default assets** — bundled objects (fire GIF, fireflies GIF, others) available from a quick-insert panel

#### Viewport / zoom
- GM can zoom into a region of the map; the player screen shows only that region
- GM preview shows a black border/overlay indicating the visible region
- Zoom in/out controls in the GM preview panel

#### Persistence
- Save a layer scene (all objects, positions, visibility, zoom state) as a JSON file
- Load scene from JSON; library panel can list saved scenes alongside maps

#### HUD overlays (screen-space, not scene-space)
These overlays are fixed to the player screen corners — they do not move or scale when the GM pans/zooms the map. Multiple instances can be added and repositioned independently relative to the screen edges.

- **Initiative tracker**
  - Drag-and-drop reordered list; selectable rows; highlights the current turn
  - Buttons + keyboard shortcuts: Start, Next, Previous
  - Hidden entries: can be fully hidden from the list *or* shown as a nameless slot ("???") to hint something is lurking
  - Triggerable initiative roll: auto-sorts the list by initiative value
  - Per-row status badges (colored tags after the name, e.g. Poisoned, Stunned) — triggerable from the GM side
  - Triggerable reveal: GM can un-hide or un-anonymise an entry mid-combat

- **Status panel** — simpler variant of the initiative tracker; no turn management, just names with colored status tags; useful for persistent conditions or party-wide states

- **Ping / pointer** — GM clicks on the preview; a pulsing marker appears at that map position on the player screen for a few seconds

---

### Tokens & Character Roster

A dedicated **Tokens** section (separate from but linked to the layer system).

- **Character / NPC cards** — each entry has: name, portrait image, type (PC / NPC / monster), notes
- **Token layer** — drag a character card onto the map to place a circular token; token shows the portrait; GM can move and resize it on the canvas
- **Initiative integration** — drag a character card directly into the initiative tracker to add them with their portrait already attached; portrait shown as a small avatar next to the name in the tracker
- **Persistence** — character roster saved as part of the scene JSON (or as a separate roster file reusable across scenes)

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

### Other planned features

- **Scene presets** — save the complete state (active map + all layers + zoom) as a named preset; switch scenes instantly from a preset list
- **Status panel** promotion — if the status panel grows complex enough, consider making it a full dockable window like the initiative tracker
- **Ping / pointer** — already listed under HUD overlays above

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
