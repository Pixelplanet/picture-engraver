# Task: Fix Vector Padding and Test Grid Generation

## Status
- [x] Investigate and fix White Padding in Vector generation
- [x] Update Default Test Grid generation to match Custom Grid logic
- [x] Regenerate Default Test Grid file

## Details

### 1. White Padding on Vector Images
**Issue**: User reports white padding returning around generated vector images.
**Suspected Cause**: Canvas sizing or Potrace parameter mismatch.
**Action**:
- Check `main.js` or `image-processor.js` where vectorization occurs.
- Verify if `trim` logic is missing or if canvas is initialized larger than image.
- Ensure the alpha channel or white background is handled correctly before tracing.

### 2. Default Test Grid Fails to Open
**Issue**: Default XCS file fails to open, but Custom Grid (Browser-generated) works.
**Suspected Cause**: Discrepancy between Node.js script execution and Browser execution, possibly default settings or encoding.
**Action**:
- Align `TestGridGenerator` defaults with `index.html` inputs.
- Ensure `scripts/generate-static-grid.mjs` mimics `main.js` grid generation logic exactly.
- Regenerate `public/default_test_grid.xcs`.
