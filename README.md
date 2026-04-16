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
- **Light / Shadow** — semi-transparent blue-gray overlay shapes to simulate dim areas or darkness; drawn and resized like any other object
- **Default assets** — bundled objects (fire GIF, fireflies GIF, others) available from a quick-insert panel

#### Viewport / zoom
- GM can zoom into a region of the map; the player screen shows only that region
- GM preview shows a black border/overlay indicating the visible region
- Zoom in/out controls in the GM preview panel

#### Persistence
- Save a layer scene (all objects, positions, visibility, zoom state) as a JSON file
- Load scene from JSON; library panel can list saved scenes alongside maps

---

### Other planned features

- **Fog of War** — paintable dark overlay the GM reveals progressively; stored as a layer
- **Scene presets** — save the complete state (active map + layers + zoom) and switch scenes instantly
- **Ping / pointer tool** — GM clicks the preview and a pulsing marker appears on the player screen for a few seconds
- **Token layer** — circular tokens with image + label the GM can drag around the map
- **Audio layer** — ambient sounds (Web Audio / HTML audio) triggered and controlled from the GM side, played on the player screen; supports show/hide (mute) like other layers
- **Initiative / status HUD** — optional overlay on the player screen showing turn order or condition icons, managed from the GM panel

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
