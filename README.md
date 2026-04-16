# Tavern Screen

An Electron app for sharing a map on a second screen as a fullscreen display. Designed for tabletop RPG sessions.

## Tech Stack

- **Framework:** Electron (Node.js)
- **Renderer:** HTML/CSS/JS in Electron windows
- **Map & Grid:** Canvas API

## Project Structure

```
tavern-screen/
├── main.js                  # Electron main process, window & IPC management
├── preload.js               # IPC bridge (contextIsolation)
├── renderer/
│   ├── gm/                  # GM screen — monitor selection + settings
│   │   ├── index.html
│   │   ├── style.css
│   │   └── gm.js
│   └── screen/              # Player screen — fullscreen map + grid display
│       ├── index.html
│       ├── style.css
│       └── screen.js
└── package.json
```

## Windows

| Window | Description |
|--------|-------------|
| **GM Screen** | Monitor selection map + screen settings (grid, zoom, calibration). |
| **Player Screen** | Fullscreen Canvas on the selected monitor with grid overlay. |

## Screen Settings (GM panel)

| Setting | Description |
|---------|-------------|
| **Show grid** | Toggle grid overlay on/off |
| **Cell size** | Grid cell size in inches (default 1.0) |
| **Color / Opacity** | Grid line color and transparency |
| **DPI** | Pixels per inch — auto-suggested from display scale factor. Adjust until 1 cell = 1 physical inch |
| **Zoom** | Scale the view from 25% to 400% |

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
