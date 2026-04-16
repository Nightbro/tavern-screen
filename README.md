# Tavern Screen

An Electron app for sharing a map on a second screen as a fullscreen display. Designed for tabletop RPG sessions.

## Tech Stack

- **Framework:** Electron (Node.js)
- **Renderer:** HTML/CSS/JS in an Electron window
- **Map & Grid:** Canvas API

## Project Structure

```
tavern-screen/
├── main.js              # Electron main process
├── renderer/
│   ├── index.html       # Renderer entry point
│   ├── style.css        # Styles
│   └── renderer.js      # Canvas rendering logic
└── package.json
```

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
