# Assets System

This document describes the design and structure of the asset system in Tavern Screen.

---

## Overview

Assets are media files (images, PDFs, etc.) used across the application — character portraits, battle maps, handouts, tokens, and similar. They exist at two scopes:

- **Global assets** — shared across all campaigns, stored in `userdata/assets/`
- **Campaign assets** — scoped to a specific campaign, stored in `userdata/campaigns/<campaign>/assets/`

Users can upload assets to either scope, and can move assets between global and campaign pools at any time for better organisation.

---

## Folder Structure

```
userdata/
  assets/
    assets.json                  ← global index: types + asset metadata
    characters/
      <uuid>/
        asset.json               ← asset metadata (name, type, tags, description, ...)
        <file>                   ← the actual file (image, pdf, etc.)
    maps/
      <uuid>/
        asset.json
        <file>
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

Each asset lives in its own UUID-named folder inside its type directory. The folder approach allows multiple files per asset in future (e.g. portrait + token image + stat sheet) without any migration.

---

## Asset Identity

Assets are identified by **UUID**, not by name or filename. The UUID is assigned at creation and never changes. This means:

- Renaming an asset only updates metadata — no files move
- Moving an asset between global and campaign scope moves the folder and updates both index files
- Scene references to assets remain valid across renames and moves

---

## assets.json

Each scope (global and per-campaign) has an `assets.json` index file. This allows the application to search, filter, and list assets without crawling the filesystem on every operation.

### Schema

```json
{
  "types": ["characters", "maps", "objects", "handouts"],
  "assets": [
    {
      "id": "a1b2c3d4-...",
      "name": "Goblin Scout",
      "type": "characters",
      "tags": [],
      "description": ""
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
| `tags` | no | Array of strings for filtering |
| `description` | no | Freeform text |

The `types` array in the **global** `assets.json` is the master list of asset types for the application. Campaign `assets.json` files only list campaign-specific assets — at query time the application merges global and campaign assets together.

Additional metadata fields can be added to asset entries in future without breaking existing data.

---

## asset.json (per asset)

Each asset folder contains an `asset.json` with the same metadata as the index entry. This acts as a source of truth — if `assets.json` becomes out of sync or corrupted, the index can be reconstructed by crawling asset folders.

```json
{
  "id": "a1b2c3d4-...",
  "name": "Goblin Scout",
  "type": "characters",
  "tags": [],
  "description": ""
}
```

---

## Asset Types

Asset types are **user-defined strings**, not hardcoded enums. The master list lives in the global `assets.json` under `types`. Users can add new types as needed.

Initial default types:
- `characters`
- `maps`
- `objects`
- `handouts`

---

## Moving Assets Between Scopes

Moving an asset from campaign scope to global (or vice versa) involves:

1. Moving the `<uuid>/` folder to the destination type directory
2. Removing the entry from the source `assets.json`
3. Adding the entry to the destination `assets.json`

The asset UUID and all metadata remain unchanged. Scene references remain valid.

---

## Performance

The `assets.json` index is the primary interface for listing and searching assets — the app loads it once at startup and keeps it in memory. Individual asset folders are only accessed when loading or displaying a specific asset. This means folder count has no impact on search or list performance at any realistic scale.
