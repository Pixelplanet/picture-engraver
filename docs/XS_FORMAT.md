# xTool Studio `.xs` File Format — Reverse Engineering Notes

> Reverse-engineered by comparing the same project saved in both formats:
> - Old: `engraving_bg-removed-image__1__F2_Ultra_UV__UV_Stainless.xcs` (4,233,451 bytes)
> - New: `engraving_bg-removed-image__1__F2_Ultra_UV__UV_Stainless.xs`  (840,905 bytes)
>
> The new format produces a ~5× smaller file for this project, primarily through
> deduplicated/normalized vector storage and ZIP (DEFLATE) compression.

---

## 1. High-level summary

| Aspect            | `.xcs` (old, v1)                              | `.xs` (new, v2)                                          |
| ----------------- | --------------------------------------------- | -------------------------------------------------------- |
| Container         | Plain UTF-8 JSON file                         | **ZIP archive** (DEFLATE), magic `50 4B 03 04`           |
| Schema            | Single monolithic JSON document               | Multi-file "directory" layout inside the ZIP             |
| Schema version    | `version: "1.3.6"` field at root              | `meta/persistence-meta.json` → `schemaVersion: "2.0.0"`  |
| Format protocol   | (implicit)                                    | `protocol: "xcs-workspace-v2"`                           |
| Vector storage    | `dPath` strings inlined in every display      | Content-addressed bucket keyed by SHA-256 of the path    |
| Display chunking  | All in one `displays` array                   | Split into `displays-N.json` chunks (see `chunkLayout`)  |
| Devices           | Single `device` object at root                | One file per device in `devices/`                        |
| Profiles          | Embedded per-display                          | Centralized in `profiles.json`                           |
| Cover image       | Embedded (likely base64) or absent            | Stored as a real PNG file in `resources/`                |

A `.xs` file can be opened with any ZIP tool (just rename to `.zip`, or use
`unzip` / `Expand-Archive` after renaming).

---

## 2. Archive layout

```
<root>/
├── .format                                  # 2 bytes: "v2"
├── meta/
│   └── persistence-meta.json                # { schemaVersion, protocol }
├── project.json                             # top-level project metadata
├── profiles.json                            # processing profiles (speed/power/…)
├── canvases/
│   ├── <canvasId>.json                      # canvas header (layers, chunk layout)
│   └── <canvasId>/
│       └── displays-0.json                  # chunk 0 of display objects
│       └── displays-1.json                  # (more chunks if needed)
├── devices/
│   └── device-<deviceId>.json               # one file per device binding
├── resources/
│   ├── project-cover.png                    # binary asset
│   └── project-cover.png.meta.json          # asset metadata sidecar
└── vectors/
    └── svg/                                 # bucket; the "svg" subtype
        ├── index.json                       # { hash → { hash, size } }
        └── data-0.json                      # { entries: { hash → dPath } }
```

Observed file names in the sample: see [xs_extracted/](xs_extracted).

---

## 3. File-by-file reference

### 3.1 `.format`
Two-byte ASCII sentinel: `v2\n`. Likely used as a fast format-version probe
without needing to read JSON.

### 3.2 `meta/persistence-meta.json`
```json
{ "schemaVersion": "2.0.0", "protocol": "xcs-workspace-v2" }
```

### 3.3 `project.json`
Top-level project metadata. Key fields observed:

| Field                        | Notes                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| `__v2__: true`               | Format flag                                                  |
| `version: "2.0.0"`           | Schema version                                               |
| `schemaMeta`                 | `{ schemaVersion, format: "directory", migratedFrom: "v1", migratedAt: <ms> }` — present because this file was migrated from a v1 `.xcs` |
| `projectId`, `projectTraceID`| UUIDs                                                        |
| `projectName`                | Display name                                                 |
| `activeCanvasId`             | UUID of currently-selected canvas                            |
| `activeDeviceId`             | e.g. `"GS009-CLASS-4-1"`                                     |
| `versionInfo`                | `source`, `appVersion`, `savedAt` (epoch ms), `ua`, `minRequiredVersion`, `appMinRequiredVersion`, `webMinRequiredVersion` |
| `created`, `modify`          | epoch ms                                                     |
| `modules.canvases` / `.devices` | Arrays of IDs whose files live under `canvases/` / `devices/` |
| `cover`                      | Relative path to the cover asset (`resources/project-cover.png`) |
| `customProjectData`          | App-specific blob                                            |

### 3.4 `profiles.json`
Centralizes processing parameters previously inlined per display. Sample:
```json
{
  "profiles": {
    "profile_02ec6224": {
      "id": "profile_02ec6224",
      "processingType": "FILL_VECTOR_ENGRAVING",
      "values": {
        "bitmapEngraveMode": "normal",
        "speed": 425, "density": 683, "dotDuration": 100, "dpi": 683,
        "power": 70, "repeat": 1,
        "defocus": false, "defocus_distance": 1,
        "bitmapScanMode": "crossMode",
        "frequency": 80, "scanAngle": 0, "angleType": 2, "crossAngle": true,
        "enableDelayPerLine": false, "delayPerLine": 0.3,
        "outlineTrace": false, "needGapNumDensity": true,
        "enableKerf": false, "kerfDistance": 0,
        "processingLightSource": "red",
        "processingType": "FILL_VECTOR_ENGRAVING"
      }
    }
  }
}
```
Devices (`devices/*.json` → `processing.<canvasId>.modes.LASER_PLANE`) reference
these profile IDs.

### 3.5 `canvases/<canvasId>.json`
Header for one canvas. Notable fields:

- `id`, `title`, `hidden`
- `layerData`: map keyed by color hex (e.g. `#fe0002`) → `{ name, order, visible }`
- `groupData`: shape-group definitions (empty in the sample)
- `extendInfo`: `{ version, minCanvasVersion, displayProcessConfigMap, rulerPluginData, type: "2d" }`
- **`chunkLayout`**: how displays are split:
  ```json
  { "displayCount": 8, "chunkCount": 1, "chunkIndexes": [0] }
  ```
  → load `displays-0.json` … `displays-(chunkCount-1).json` from
  `canvases/<canvasId>/`. The sum of `displays[*].length` across chunks must
  equal `displayCount`.

### 3.6 `canvases/<canvasId>/displays-N.json`
```json
{
  "canvasId": "<uuid>",
  "chunkIndex": 0,
  "displays": [ <display>, <display>, … ]
}
```

Each `display` is essentially the same object as in v1 (`x`, `y`, `angle`,
`scale`, `skew`, `pivot`, `offsetX`, `offsetY`, `zOrder`, `groupTag`,
`layerTag`, `fill`, `stroke`, `effects`, `width`, `height`, …). Two
substantive differences vs v1:

1. **Vectors are externalized.** Where a v1 `PATH` display had `dPath: "M14.3 0 …"`,
   the v2 display has:
   ```json
   "vectorRef": {
     "vectorHash":    "<sha256-hex>",
     "bucketType":    "svg",
     "originalField": "dPath"
   }
   ```
   The reader must resolve `vectorRef.vectorHash` against the bucket named by
   `vectorRef.bucketType` (`vectors/<bucketType>/…`), then re-inject the
   resolved string under the key named by `originalField`.

2. `TEXT` displays still embed their vector data inline (`fontData.glyphData[*].dPath`,
   `charJSONs`) — only top-level PATH `dPath`s are externalized in this sample.

Other observed display types: `TEXT`, `PATH`. Display fields in the sample
(union over all 8 displays):

```
id, name, type, x, y, angle, scale, skew, pivot, localSkew,
offsetX, offsetY, lockRatio, isClosePath, zOrder, sourceId,
groupTags, groupTag, layerTag, layerColor, visible, originColor,
enableTransform, visibleState, lockState, resourceOrigin, customData,
rootComponentId, minCanvasVersion, alpha, fill, stroke, effects,
width, height, isFill, lineColor, fillColor, points, fillRule,
graphicX, graphicY, isCompoundPath, vectorRef,                  ← PATH-only
text, resolution, style, fontData, charJSONs                    ← TEXT-only
```

### 3.7 `devices/device-<deviceId>.json`
Per-device binding. Top-level keys:
`id, deviceCode, extId, extName, power, processing, customProjectData`.

- `processing` is a map keyed by **canvasId**:
  ```json
  "<canvasId>": {
    "id": "<canvasId>",
    "activeMode": "LASER_PLANE",
    "modes": { "LASER_PLANE": { "ignoredDisplayIds": [ … ], … } }
  }
  ```
- Inside each mode you find references to profile IDs from `profiles.json`
  and per-display overrides (the sample also lists `ignoredDisplayIds`, e.g.
  the `TEXT` warning label is excluded from machining).

### 3.8 `resources/`
Binary assets are stored as actual files (PNG, JPEG, etc.) with a JSON sidecar
named `<filename>.meta.json`:
```json
{
  "ref": "resources/project-cover.png",
  "metadata": {
    "kind": "image",
    "source": { "type": "workspace", "value": "project-cover.png" },
    "mimeType": "image/png"
  }
}
```
This is a major space win vs base64-embedding into JSON (~33 % smaller, no
escaping overhead, and the ZIP container then DEFLATEs everything).

### 3.9 `vectors/<bucketType>/` — content-addressed vector bucket

This is the key new mechanism. There is one bucket directory per vector
sub-type; in the sample only `svg` exists.

**`vectors/svg/index.json`**
```json
{
  "bucketType": "svg",
  "version": "1.0",
  "entryCount": 7,
  "entries": {
    "<sha256-hex>": { "hash": "<sha256-hex>", "size": 735013 },
    …
  }
}
```

**`vectors/svg/data-N.json`** — chunked bucket data:
```json
{
  "bucketType": "svg",
  "chunkIndex": 0,
  "entries": {
    "<sha256-hex>": "M14.300 0.000 L14.500 0.000 L14.500 0.100 …"
  }
}
```

The hash is the lowercase-hex **SHA-256 of the UTF-8 bytes of the value
string** (verified: all 7 entries in the sample reproduce their key under
`hashlib.sha256(v.encode('utf-8')).hexdigest()`). Same identity holds against
the old `.xcs` file: every `dPath` from the v1 `displays[*]` hashes to one of
the bucket keys, proving the contents are byte-identical and the new
container is a pure repack — no lossy re-encoding.

This is a deduplicating, **content-addressable store**. Two displays that
share an identical path string would share a single bucket entry. The index
file allows the loader to materialize the bucket map (with sizes) without
parsing the giant `data-*.json` chunks until they are actually needed.

---

## 4. How to load a `.xs` file (algorithm)

1. Open as a ZIP archive (it is one; magic `PK\x03\x04`).
2. Read `.format` → must start with `v2`.
3. Read `meta/persistence-meta.json` → check `protocol == "xcs-workspace-v2"`.
4. Read `project.json` for IDs, app version, active canvas/device, and the
   `modules.canvases` / `modules.devices` lists.
5. Read `profiles.json` into a `id → profile` map.
6. For each bucket directory under `vectors/`:
   a. Read `index.json` to learn which hashes exist.
   b. Lazily (or eagerly) read `data-*.json` chunks and merge their `entries`
      into a single `hash → string` map.
7. For each canvas ID in `modules.canvases`:
   a. Read `canvases/<id>.json` (header + `chunkLayout`).
   b. Read each `canvases/<id>/displays-N.json` for `N in [0, chunkCount)`.
   c. For every display with a `vectorRef`, look up
      `vectorRef.vectorHash` in the bucket named by `vectorRef.bucketType`
      and assign the resolved string back under the key
      `vectorRef.originalField` (e.g. `dPath`). Optionally drop `vectorRef`.
8. For each device ID in `modules.devices`, read
   `devices/device-<deviceId>.json`; resolve any embedded profile references
   against the map from step 5.
9. Resources referenced by path (e.g. `project.json.cover`) are read directly
   as binary streams from `resources/`. Their sidecars (`*.meta.json`)
   describe MIME type / origin.

## 5. How to write a `.xs` file (algorithm)

To save a v2 file from an in-memory v1-style model:

1. Walk all displays. For every top-level `dPath` (and any other large
   vector-like string you wish to deduplicate), compute its SHA-256 hex
   digest of the UTF-8 bytes. Replace the field with a `vectorRef` object
   and add the string to the appropriate bucket (`svg` for path data).
2. Chunk displays per canvas (the sample uses a single chunk of 8 displays;
   the threshold is not directly observable here but `chunkLayout` is the
   contract the reader honors).
3. Extract any binary asset that was inlined as base64 into a real file
   under `resources/`, and emit a matching `*.meta.json` sidecar.
4. Hoist per-display processing parameters into `profiles.json` and store
   only profile IDs in `devices/*.json`.
5. Emit `.format` (`v2\n`), `meta/persistence-meta.json`,
   `project.json` (with `__v2__: true`, `schemaMeta.format: "directory"`,
   etc.), then write everything to a ZIP archive. Rename the archive to
   `.xs`.

---

## 6. Compression source-of-truth (sample numbers)

| Component                                        | Uncompressed | In ZIP   |
| ------------------------------------------------ | -----------: | -------: |
| `vectors/svg/data-0.json` (7 path strings)       |   4,221,164  |  777,968 |
| `canvases/<id>/displays-0.json`                  |     143,501  |   16,854 |
| `resources/project-cover.png`                    |      41,956  |   40,477 |
| `devices/device-GS009-CLASS-4-1.json`            |      14,456  |    1,549 |
| everything else (small JSON)                     |       ~5 KB  |   ~2 KB  |
| **Archive total**                                | **~4.43 MB** | **~821 KB** |
| Equivalent `.xcs` (monolithic JSON, uncompressed) | **4.23 MB** | —        |

So the headline savings vs `.xcs` for this project come from:
1. **DEFLATE compression of the JSON** (the `.xcs` is uncompressed JSON; the
   `.xs` is a ZIP of JSON).
2. **Dedup-by-hash of path strings** would compound the win on projects that
   reuse the same shape across displays/canvases. In this sample all 7 paths
   are unique, so the win is purely from compression + a small structural
   tidy-up.

---

## 7. Open questions / not yet observed

- `chunkLayout.chunkCount` threshold — when does Studio split into multiple
  `displays-N.json`? Needs a larger sample.
- Other `bucketType` values beyond `svg` (perhaps `image`, `mesh`, etc. for
  the 3D/UV modes referenced by `extendInfo.type`).
- `groupData` schema (empty in this sample).
- Per-mode keys other than `LASER_PLANE` inside `devices/*.processing`.
- Whether `vectorRef` is also emitted for `TEXT` glyph dPaths in newer
  Studio builds (it is *not* in this sample; only top-level PATH `dPath`s
  are externalized).

---

## 8. Helper scripts

These were used to produce the findings above and are kept in the workspace:

- [_analyze.py](_analyze.py) — dumps display top-level keys and `vectorRef`s
- [_analyze2.py](_analyze2.py) — inspects `vectors/svg/data-0.json` & devices
- [_analyze3.py](_analyze3.py) — schema of a vector bucket data file
- [_compare.py](_compare.py) — proves every old `dPath` SHA-256s to a new bucket key
- [_compare2.py](_compare2.py) — prints old `.xcs` structure for side-by-side
