# Picture Engraver - Implementation Plan

## Project Overview

A web application that converts uploaded images into XCS files for laser engraving on stainless steel, with color-aware layer separation.

## Tech Stack

- **Framework**: Vite + Vanilla JavaScript
- **Styling**: Custom CSS with dark theme
- **Image Processing**: Canvas API + custom algorithms
- **Vectorization**: Potrace.js (browser-based)
- **Storage**: Cookies / LocalStorage for settings
- **Output**: XCS file generation (client-side)

---

## Laser Settings Reference

### Base Settings (Constant)
| Parameter | Value |
|-----------|-------|
| Power | 70% |
| Speed | 425 mm/s |
| Passes | 1 |
| Cross Hatch | Enabled |

### Variable Parameters (Color Control)
| Parameter | Range | Effect |
|-----------|-------|--------|
| Frequency | 40 - 80 kHz | Color temperature/hue |
| Lines Per Inch (LPI/Density) | 300 - 800 | Color intensity/saturation |

### Color Matrix (9 columns × 11 rows = 99 combinations)
- **Columns (Frequency)**: 40, 45, 50, 55, 60, 65, 70, 75, 80 kHz
- **Rows (LPI)**: 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300

---

## Preset Image Sizes

| Name | Width | Height |
|------|-------|--------|
| Default (Square) | 200 mm | 200 mm |
| Business Card | 85 mm | 55 mm |

---

## Task List

### Phase 1: Project Setup ✅
- [x] Create Vite project
- [x] Set up folder structure
- [x] Create base HTML/CSS with dark theme
- [ ] Add responsive layout

### Phase 2: Image Upload & Resize
- [ ] Implement drag & drop upload zone
- [ ] Add file input as fallback
- [ ] Validate image formats (PNG, JPG, WebP)
- [ ] Implement image resizing (mm-based)
- [ ] Store size preferences in cookies
- [ ] Add preset size selector

### Phase 3: Color Quantization
- [ ] Implement color quantization algorithm (median cut or k-means)
- [ ] Create slider for number of colors (2-16)
- [ ] Display color palette preview
- [ ] Show quantized image preview

### Phase 4: Layer Separation
- [ ] Extract each color as separate layer/mask
- [ ] Display layer previews
- [ ] Allow layer visibility toggle
- [ ] Allow layer reordering

### Phase 5: Vectorization
- [ ] Integrate Potrace.js
- [ ] Convert each layer bitmap to SVG paths
- [ ] Optimize/simplify paths
- [ ] Preview vector output

### Phase 6: Color-to-Settings Mapping
- [ ] Create default color palette from test grid
- [ ] Build color picker for each layer
- [ ] Implement "closest color" matching algorithm
- [ ] Map selected colors to frequency/LPI settings

### Phase 7: XCS Generation
- [ ] Convert SVG paths to XCS dPath format
- [ ] Generate layer structure
- [ ] Assign engraving parameters per layer
- [ ] Create downloadable XCS file
- [ ] Add filename customization

### Phase 8: Test Grid Generator
- [ ] Create grid layout generator UI
- [ ] Configure frequency range and steps
- [ ] Configure LPI range and steps
- [ ] Generate labeled rectangles
- [ ] Export as XCS file

### Phase 9: Grid Analysis (Future)
- [ ] Upload photo of engraved test grid
- [ ] Detect grid cells
- [ ] Extract average color per cell
- [ ] Build custom color-to-settings database
- [ ] Save to cookies/localStorage

---

## File Structure

```
Picture Engraver/
├── docs/
│   ├── XCS_FILE_FORMAT.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── COLOR_REFERENCE.md
├── src/
│   ├── index.html
│   ├── main.js
│   ├── style.css
│   ├── lib/
│   │   ├── xcs-generator.js
│   │   ├── image-processor.js
│   │   ├── color-quantizer.js
│   │   ├── vectorizer.js
│   │   └── settings-storage.js
│   └── assets/
│       └── (icons, fonts, etc.)
├── test_overlapping_rectangles.xcs
├── Woman-color_steel.xcs
├── package.json
└── vite.config.js
```

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎨 Picture Engraver                               [Settings ⚙] [Grid 📊]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────┐    ┌──────────────────────────────────┐ │
│  │                           │    │  LAYERS                          │ │
│  │   📁 Drop image here      │    │  ───────────────────────────────│ │
│  │      or click to browse   │    │  ☑ Layer 1  ████  [40kHz/800] ▼ │ │
│  │                           │    │  ☑ Layer 2  ████  [55kHz/600] ▼ │ │
│  │   Formats: PNG, JPG, WebP │    │  ☑ Layer 3  ████  [70kHz/450] ▼ │ │
│  │                           │    │  ☑ Layer 4  ████  [80kHz/300] ▼ │ │
│  └───────────────────────────┘    │                                  │ │
│                                   │  [🎯 Auto-Assign Colors]         │ │
│  Size: [200×200mm ▼]              └──────────────────────────────────┘ │
│  Colors: [4] ◀━━━━━━━━━━━━━▶                                           │
│                                                                         │
│  ┌───────────────────────────┐    ┌──────────────────────────────────┐ │
│  │      ORIGINAL             │    │      PREVIEW                     │ │
│  │  ┌─────────────────────┐  │    │  ┌─────────────────────────────┐ │ │
│  │  │                     │  │    │  │                             │ │ │
│  │  │    (uploaded        │  │    │  │    (quantized/vectorized   │ │ │
│  │  │     image)          │  │    │  │     preview)               │ │ │
│  │  │                     │  │    │  │                             │ │ │
│  │  └─────────────────────┘  │    │  └─────────────────────────────┘ │ │
│  └───────────────────────────┘    └──────────────────────────────────┘ │
│                                                                         │
│              [ 💾 Generate XCS ]    [ ⬇ Download ]                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Color Reference (Approximate from Test Grid)

Based on the provided test grid image, here are estimated color mappings:

| Frequency | LPI | Approximate Color |
|-----------|-----|-------------------|
| 40 kHz | 800 | Brown/Bronze |
| 45 kHz | 800 | Teal |
| 50 kHz | 800 | Blue |
| 55 kHz | 800 | Purple/Pink |
| 60 kHz | 800 | Red/Orange |
| 65 kHz | 800 | Gold |
| 70 kHz | 800 | Yellow-Green |
| 75 kHz | 800 | Light Gray |
| 80 kHz | 800 | Near-invisible |
| ... | ... | ... |
| 40 kHz | 300 | Dark visible |
| 80 kHz | 300 | Very faint |

*Note: Actual colors will be calibrated using the test grid analysis feature.*

---

## Next Steps

1. Initialize Vite project
2. Create base UI structure
3. Implement image upload functionality
4. Build color quantization
5. (Continue through phases...)
