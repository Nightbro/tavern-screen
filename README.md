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
├── windowManager.js         # Window lifecycle, map library, preview capture
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
│   └── windowManager.test.js
└── package.json
```

## GM Screen Layout

| Panel | Contents |
|-------|----------|
| **Left — Map Library** | Upload images, thumbnail grid, click to switch active map, remove button |
| **Center** | Monitor selector map, monitor cards, live player screen preview with refresh |
| **Right — Settings** | Grid toggle, cell size, color/opacity, DPI calibration, zoom |

## Player Screen

- Fullscreen Canvas on the selected monitor
- Map image displayed behind the grid (contain-fit, centered)
- Grid overlay with configurable size, color, opacity
- Zoom applies to both map and grid together

## Screen Settings

| Setting | Description |
|---------|-------------|
| **Show grid** | Toggle grid overlay |
| **Cell size** | Grid cell size in inches (default 1.0) |
| **Color / Opacity** | Grid line color and transparency |
| **DPI** | Auto-suggested from display scale factor. Adjust until 1 cell = 1 physical inch |
| **Zoom** | Scale the view 25%–400% |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

## Test

```bash
npm test
```
