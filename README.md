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
│   ├── gm/                  # GM screen — monitor selection UI
│   │   ├── index.html
│   │   ├── style.css
│   │   └── gm.js
│   └── screen/              # Player screen — fullscreen map display
│       ├── index.html
│       ├── style.css
│       └── screen.js
└── package.json
```

## Windows

| Window | Description |
|--------|-------------|
| **GM Screen** | Shows all detected monitors. Click a monitor to open the player screen fullscreen on it. |
| **Player Screen** | Fullscreen Canvas window shown on the selected monitor. |

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
