---
description: Run images through the picture engraving pipeline and check output quality at each step
---

# Picture Engraver Pipeline Testing Workflow

This workflow enables rapid prototyping and testing of the Picture Engraver pipeline. It processes test images through each step and outputs diagnostic information for quality optimization.

## Pipeline Overview

The Picture Engraver pipeline consists of 4 main stages:

1. **Image Resize** (`ImageProcessor.resize`) - Scales image to target mm dimensions
2. **Color Quantization** (`ColorQuantizer.quantize`) - Reduces colors using median cut algorithm
3. **Vectorization** (`Vectorizer.vectorizeAllLayers`) - Converts bitmap layers to SVG paths
4. **XCS Generation** (`XCSGenerator.generate`) - Creates final .xcs file for xTool

## Quick Start

// turbo-all
### Run a complete pipeline test:
```bash
cd c:\Projects\Picture Engraver
node testfile/pipeline-test.mjs <image_path> [options]
```

### Options:
- `--colors <n>` - Number of colors (default: 6)
- `--width <mm>` - Output width in mm (default: 100)
- `--output <dir>` - Output directory (default: testfile/)
- `--verbose` - Show detailed diagnostics

## Test Procedure

### Step 1: Prepare Test Image
Place a test image in `testfile/` directory. Common test images:
- `test_image_cats.jpg` - Complex photo with many colors
- Simple geometric shapes for debugging

### Step 2: Run Pipeline Test Script
```bash
node testfile/pipeline-test.mjs testfile/test_image_cats.jpg --colors 6 --verbose
```

### Step 3: Check Stage Outputs

The script generates diagnostic files at each stage:

| Stage | Output File | What to Check |
|-------|-------------|---------------|
| Resize | `*_1_resized.png` | Correct aspect ratio, no distortion |
| Quantize | `*_2_quantized.png` | Color separation, palette quality |
| Vectorize | `*_3_vectors.svg` | Path accuracy, contour smoothness |
| XCS | `*_4_output.xcs` | Valid JSON, proper layer settings |

### Step 4: Review Pipeline Report
Check `*_report.json` for:
- Timing per stage
- Palette colors (RGB values)
- Layer statistics (path count, complexity)
- XCS file size

## Quality Metrics

### Good Quantization:
- Distinct color separation
- No banding artifacts  
- Maintains image detail

### Good Vectorization:
- Smooth contours (not pixelated)
- Minimal path count (efficient)
- Accurate shape representation

### Good XCS Output:
- Correct layer ordering
- Proper frequency/LPI mapping
- Valid path data (no empty layers)

## Common Issues & Fixes

### Issue: White borders in output
**Cause:** Aspect ratio mismatch
**Fix:** Check `ImageProcessor.resize()` padding logic

### Issue: Missing colors in palette
**Cause:** Colors too similar, merged by median cut
**Fix:** Increase color count or adjust tolerance in `ColorQuantizer`

### Issue: Jagged vector paths
**Cause:** Low resolution or insufficient smoothing
**Fix:** Increase `pxPerMm` or adjust `smoothContour()` iterations

### Issue: Empty layers in XCS
**Cause:** No pixels matched the color tolerance
**Fix:** Check `createLayerMask()` tolerance parameter

## Module Locations

| Module | File | Key Functions |
|--------|------|---------------|
| Image Processor | `src/lib/image-processor.js` | `resize()`, `getImageData()` |
| Color Quantizer | `src/lib/color-quantizer.js` | `quantize()`, `medianCut()`, `extractLayers()` |
| Vectorizer | `src/lib/vectorizer.js` | `vectorizeAllLayers()`, `traceLayer()`, `simplifyContour()` |
| XCS Generator | `src/lib/xcs-generator.js` | `generate()`, `createPathDisplayWithPath()` |

## Tunable Parameters

### Color Quantizer
- `numColors` - Number of output colors (2-16)

### Vectorizer
- `turdSize` - Minimum blob size to keep (0 = keep all)
- `tolerance` - Color matching tolerance (default: 10)
- `dilateBitmap.iterations` - Edge smoothing (0-3)

### XCS Generator
- `pxPerMm` - Resolution (10 = standard, 20 = high quality)
- `frequency` - Laser frequency per layer (40-80 kHz)
- `lpi` - Lines per inch per layer (300-800)

## Debugging Flow

1. **Check resize output** → If wrong, fix `ImageProcessor`
2. **Check quantized output** → If wrong, fix `ColorQuantizer`
3. **Check vector SVG** → If wrong, fix `Vectorizer`
4. **Open XCS in xTool** → If wrong, fix `XCSGenerator`

## Example: Testing a Fix

```bash
# 1. Run baseline test
node testfile/pipeline-test.mjs testfile/test_image_cats.jpg --colors 6 --output testfile/baseline/

# 2. Make code changes to src/lib/*.js

# 3. Run comparison test
node testfile/pipeline-test.mjs testfile/test_image_cats.jpg --colors 6 --output testfile/modified/

# 4. Compare outputs visually or with diff tools
```

## Automated Validation

The `pipeline-test.mjs` script performs these checks:

- ✅ XCS is valid JSON
- ✅ All layers have paths
- ✅ Path coordinates are in valid range
- ✅ Frequency/LPI values within expected ranges
- ✅ No zero-dimension displays

Failed checks are reported as errors in the console output.
