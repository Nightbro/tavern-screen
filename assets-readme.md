# Assets System

This document describes the design and structure of the asset system in Tavern Screen.

---

## Overview

Assets are media files used across the application — character portraits, battle maps, handouts, tokens, animated GIFs, videos, and similar. They exist at two scopes:

- **Global assets** — shared across all campaigns, stored in `userdata/assets/`
- **Campaign assets** — scoped to a specific campaign, stored in `userdata/campaigns/<campaign>/assets/`

The `userdata/` directory is fixed at the app root (next to `main.js`). There is no user-configurable folder location.

Users can upload assets to either scope, and can move assets between global and campaign pools at any time.

---

## Supported File Formats

| Category | Extensions | Layer type when added to scene |
|----------|-----------|-------------------------------|
| Images | `png`, `jpg`, `jpeg`, `webp`, `bmp`, `svg` | `image` |
| Animated GIF | `gif` | `gif` — plays at native frame rate on player screen |
| Video | `mp4`, `webm` | `video` — looping, muted; covers player viewport in screen space |
| Documents | `pdf` | *(preview only, not addable to scene)* |

---

## Folder Structure

```
userdata/
  assets/
    assets.json                  ← global index: types + asset metadata
    general/
      <uuid>/
        asset.json               ← asset metadata (name, type, ...)
        <file>                   ← the actual file
    characters/
      <uuid>/
        asset.json
        <file>
    maps/
    handouts/
    objects/
  campaigns/
    My Campaign/
      assets/
        assets.json              ← campaign-scoped index (same shape as global)
        characters/
          <uuid>/
            asset.json
            <file>
```

Each asset lives in its own UUID-named folder inside its type directory. The folder approach allows multiple files per asset in future without any migration.

---

## Asset Identity

Assets are identified by **UUID**, not by name or filename. The UUID is assigned at creation and never changes. This means:

- Renaming an asset only updates metadata — no files move
- Changing an asset's **type** moves the folder on disk to the new type directory
- Moving an asset between global and campaign scope moves the folder and updates both index files
- Scene references to assets remain valid across renames and type changes

---

## assets.json

Each scope (global and per-campaign) has an `assets.json` index file. This allows the application to search, filter, and list assets without crawling the filesystem on every operation.

### Schema

```json
{
  "types": ["general", "characters", "maps", "objects", "handouts"],
  "assets": [
    {
      "id": "a1b2c3d4-...",
      "name": "Goblin Scout",
      "type": "characters",
      "fileName": "goblin-scout.png"
    }
  ]
}
```

### Fields

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | UUID, matches the folder name |
| `name` | yes | Display name, user-editable |
| `type` | yes | Must match an entry in `types` |
| `fileName` | yes | Actual filename inside the asset folder; used to construct `file://` URLs without a filesystem scan |

The `types` array in the **global** `assets.json` is the master list of asset types for the application. Campaign `assets.json` files only list campaign-specific assets — at query time the application merges global and campaign assets together.

---

## asset.json (per asset)

Each asset folder contains an `asset.json` with the same metadata as the index entry. This acts as a source of truth — if `assets.json` becomes out of sync or corrupted, the index can be reconstructed by crawling asset folders.

```json
{
  "id": "a1b2c3d4-...",
  "name": "Goblin Scout",
  "type": "characters",
  "fileName": "goblin-scout.png"
}
```

---

## Asset Types

Asset types are **user-defined strings**, not hardcoded enums. The master list lives in the global `assets.json` under `types`. Users can add and remove types via the **Types** button in the GM screen.

### Default types

| Type | Protected |
|------|-----------|
| `general` | **Yes** — cannot be deleted; used for uncategorised assets |
| `characters` | No |
| `maps` | No |
| `objects` | No |
| `handouts` | No |

Protected types cannot be removed even via the type manager. All other types can be deleted (the type label is removed; assets already using that type are preserved under their existing folder).

---

## Adding Assets

Assets can be added in three ways:

1. **+ Add Asset button** — opens a file dialog (multi-select); selected files are copied into the appropriate folder
2. **Drag & drop from OS** — drop one or more files onto any type section in the asset list; unsupported extensions are silently skipped
3. **Asset copy** — the ⧉ button duplicates an existing asset (new UUID, name appended with " (copy)")

The file's base name (without extension) is used as the default asset name. The name can be edited at any time without moving files.

---

## Editing Assets

Click the ✏ button on an asset card to open the inline edit form:

| Field | What changes |
|-------|-------------|
| **Name** | Display name only — no files moved |
| **Type** | Asset folder moves from `<old-type>/<uuid>/` to `<new-type>/<uuid>/` on disk |
| **Scope** | Asset folder moves between `userdata/assets/` and `userdata/campaigns/<id>/assets/` |

---

## Moving Assets Between Scopes

Moving an asset from campaign scope to global (or vice versa) involves:

1. Moving the `<uuid>/` folder to the destination type directory
2. Removing the entry from the source `assets.json`
3. Adding the entry to the destination `assets.json`

The asset UUID and all metadata remain unchanged. Scene references remain valid.

Assets can also be moved by dragging a card onto a scope header or a different type section in the GM UI.

---

## Adding Assets to the Scene

From the asset panel in the GM screen (Advanced Mode only):

- **Click** an asset card → preview appears in the panel
- **+ Add to Scene** → adds as a layer centred on the canvas (images/GIFs at natural pixel size; videos fill the viewport)
- **Drag to preview** → drops the asset as a layer centred on the cursor position
- **Quick Asset (single click)** → enter region-select mode; drag on the preview to define exact placement bounds
- **Quick Asset (double click)** → immediately adds as a full-scene layer

---

## Performance

The `assets.json` index is the primary interface for listing and searching assets — the app loads it once at startup and keeps it in memory. Individual asset folders are only accessed when loading or displaying a specific asset. The `fileName` field in the index means thumbnails and layer sources can be constructed as `file://` URLs without any filesystem scan at render time.
