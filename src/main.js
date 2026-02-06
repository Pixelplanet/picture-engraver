/**
 * Picture Engraver - Main Application
 * Converts images to XCS laser engraving files
 */

import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import { TestGridGenerator } from './lib/test-grid-generator.js';
import { SettingsStorage } from './lib/settings-storage.js';
import { ImageProcessor } from './lib/image-processor.js';
import { ColorQuantizer } from './lib/color-quantizer.js';
import { EnhancedQuantizer } from './lib/enhanced-quantizer.js';
import { Vectorizer } from './lib/vectorizer.js';
import { XCSGenerator } from './lib/xcs-generator.js';
import { showToast } from './lib/toast.js';
import { Logger } from './lib/logger.js';
import { LandingPage } from './lib/landing-page.js';
import { OnboardingManager } from './lib/onboarding.js';
import { GridDetector } from './lib/grid-detector.js';
import { multiGridPalette, initializeMultiGridPalette } from './lib/multi-grid-palette.js';
import { GridImagePicker } from './lib/grid-image-picker.js';



// Application State
// ===================================
const state = {
    originalImage: null,
    processedImage: null,
    layers: [],
    vectorizedLayers: [],
    palette: [],
    outputSize: { width: 200, height: 200 },
    settings: null,
    editingLayerId: null,
    gridPicker: null, // GridImagePicker instance
    currentMiniPickerMapId: null // Current grid in picker
};

// ===================================
// Analyzer State
// ===================================
const analyzerState = {
    corners: [],
    freqValues: [],
    lpiValues: [],
    numCols: 0,
    numRows: 0,
    isActive: false,
    selectedCell: null,
    extractedColors: [], // RGB colors from the test grid photo
    originalImg: null,
    // Auto-detection results
    autoDetected: false,
    detectedCells: null, // Array of cell objects with centers
    qrRegion: null, // Excluded QR code region
    gridDetector: new GridDetector(),
    // Corner adjustment
    selectedCornerIndex: null, // Index of currently selected corner (0-3)
    isDraggingCorner: false
};

// ===================================
// DOM Elements
// ===================================
const elements = {
    // Upload
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    originalCanvas: document.getElementById('originalCanvas'),
    originalPreviewContainer: document.getElementById('originalPreviewContainer'),
    btnClearImage: document.getElementById('btnClearImage'),

    // Controls
    controlsSection: document.getElementById('controlsSection'),
    sizeSelect: document.getElementById('sizeSelect'),
    customSizeGroup: document.getElementById('customSizeGroup'),
    customWidth: document.getElementById('customWidth'),
    customHeight: document.getElementById('customHeight'),
    colorSlider: document.getElementById('colorSlider'),
    colorCountDisplay: document.getElementById('colorCountDisplay'),
    btnProcess: document.getElementById('btnProcess'),
    btnSaveMap: document.getElementById('btnSaveMap'),

    // Mini Color Picker
    miniColorPicker: document.getElementById('miniColorPicker'),
    closeMiniPicker: document.getElementById('closeMiniPicker'),
    miniPickerCanvas: document.getElementById('miniPickerCanvas'),
    miniPickerCoords: document.getElementById('miniPickerCoords'),
    miniPickerValues: document.getElementById('miniPickerValues'),
    miniPickerGridSelect: document.getElementById('miniPickerGridSelect'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnZoomReset: document.getElementById('btnZoomReset'),

    // Layers
    layersPanel: document.getElementById('layersPanel'),
    layersList: document.getElementById('layersList'),
    btnAutoAssign: document.getElementById('btnAutoAssign'),

    // Preview
    previewPanel: document.getElementById('previewPanel'),
    quantizedCanvas: document.getElementById('quantizedCanvas'),
    previewTabs: document.querySelectorAll('.tab'),
    previewQuantized: document.getElementById('previewQuantized'),
    previewVectors: document.getElementById('previewVectors'),
    vectorSvgContainer: document.getElementById('previewVectors'),

    // Export
    btnDownloadXCS: document.getElementById('btnDownloadXCS'),

    // Modals
    settingsModal: document.getElementById('settingsModal'),
    testGridModal: document.getElementById('testGridModal'),
    btnSettings: document.getElementById('btnSettings'),
    btnTestGrid: document.getElementById('btnTestGrid'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    closeTestGridModal: document.getElementById('closeTestGridModal'),
    mergeModal: document.getElementById('mergeModal'),
    closeMergeModal: document.getElementById('closeMergeModal'),
    mergeSuggestionsList: document.getElementById('mergeSuggestionsList'),
    btnCancelMerge: document.getElementById('btnCancelMerge'),
    btnConfirmMerge: document.getElementById('btnConfirmMerge'),

    // Color Grids Management
    colorGridsList: document.getElementById('colorGridsList'),
    gridStatsText: document.getElementById('gridStatsText'),
    btnExportGrids: document.getElementById('btnExportGrids'),
    btnImportGrids: document.getElementById('btnImportGrids'),
    gridImportFileInput: document.getElementById('gridImportFileInput'),

    // Settings inputs
    settingPower: document.getElementById('settingPower'),
    settingSpeed: document.getElementById('settingSpeed'),
    settingPasses: document.getElementById('settingPasses'),
    settingCrossHatch: document.getElementById('settingCrossHatch'),
    settingPulseWidth: document.getElementById('settingPulseWidth'),
    rowPulseWidth: document.getElementById('rowPulseWidth'),
    settingFreqMin: document.getElementById('settingFreqMin'),
    settingFreqMax: document.getElementById('settingFreqMax'),
    settingLpiMin: document.getElementById('settingLpiMin'),
    settingLpiMax: document.getElementById('settingLpiMax'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnResetSettings: document.getElementById('btnResetSettings'),

    // Standard Color Settings
    settingBlackFreq: document.getElementById('settingBlackFreq'),
    settingBlackLpi: document.getElementById('settingBlackLpi'),
    settingBlackSpeed: document.getElementById('settingBlackSpeed'),
    settingBlackPower: document.getElementById('settingBlackPower'),
    settingWhiteFreq: document.getElementById('settingWhiteFreq'),
    settingWhiteLpi: document.getElementById('settingWhiteLpi'),
    settingWhiteSpeed: document.getElementById('settingWhiteSpeed'),
    settingWhitePower: document.getElementById('settingWhitePower'),

    // Test Grid
    gridCols: document.getElementById('gridCols'),
    gridRows: document.getElementById('gridRows'),
    gridCellSize: document.getElementById('gridCellSize'),
    gridCellGap: document.getElementById('gridCellGap'),
    gridPreviewCanvas: document.getElementById('gridPreviewCanvas'),
    btnPreviewGrid: document.getElementById('btnPreviewGrid'),
    btnGenerateGrid: document.getElementById('btnGenerateGrid'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Status Bar
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),

    // Analyzer
    analyzerCanvas: document.getElementById('analyzerCanvas'),
    analyzerDropZone: document.getElementById('analyzerDropZone'),
    analysisPreview: document.getElementById('analysisPreview'),
    colorMapSection: document.getElementById('colorMapSection'),

    // Layer Edit Modal
    layerEditModal: document.getElementById('layerEditModal'),
    closeLayerEditModal: document.getElementById('closeLayerEditModal'),
    layerEditName: document.getElementById('layerEditName'),
    layerEditFreq: document.getElementById('layerEditFreq'),
    layerEditLpi: document.getElementById('layerEditLpi'),
    layerEditSpeed: document.getElementById('layerEditSpeed'),
    layerEditPower: document.getElementById('layerEditPower'),
    layerEditColorGrid: document.getElementById('layerEditColorGrid'),
    btnSaveLayerEdit: document.getElementById('btnSaveLayerEdit'),
    btnCancelLayerEdit: document.getElementById('btnCancelLayerEdit'),
    // Calibration Visualization
    layerCalibrationPreview: document.getElementById('layerCalibrationPreview'),
    layerCalibrationCanvas: document.getElementById('layerCalibrationCanvas'),
    layerCalibrationText: document.getElementById('layerCalibrationText'),
    layerEditSourcePreview: document.getElementById('layerEditSourcePreview'),
    layerEditSourceCanvas: document.getElementById('layerEditSourceCanvas')
};

// ===================================
// geometric Utils
// ===================================
function interpolate(p1, p2, t) {
    return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
    };
}

function interpolateCorner(corners, tx, ty) {
    const pTop = interpolate(corners[0], corners[1], tx);
    const pBottom = interpolate(corners[3], corners[2], tx);
    return interpolate(pTop, pBottom, ty);
}

/**
 * Calculate intersection of two line segments (p1-p2 and p3-p4)
 * Returns point {x,y} or null if no intersection
 */
function getLineIntersection(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (d === 0) return null; // Parallel

    const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        return {
            x: p1.x + u * (p2.x - p1.x),
            y: p1.y + u * (p2.y - p1.y)
        };
    }
    return null;
}

/**
 * Calculate QR code exclusion zone based on physical dimensions
 * QR code is always 17mm x 17mm with 1mm gap around it
 * @param {number} numCols - Total number of grid columns
 * @param {number} numRows - Total number of grid rows
 * @param {number} cellSize - Cell size in mm (default 5)
 * @param {number} cellGap - Cell gap in mm (default 1)
 * @returns {{ startCol: number, startRow: number, colsExcluded: number, rowsExcluded: number }}
 */
function calculateQRExclusionZone(numCols, numRows, cellSize = null, cellGap = null) {
    const QR_SIZE_MM = 17;
    const QR_GAP_MM = 1;

    // Total space needed for QR code + gap
    const qrSpaceW = QR_SIZE_MM + QR_GAP_MM;
    const qrSpaceH = QR_SIZE_MM + QR_GAP_MM;

    // Standard Business Card dimensions (default test grid)
    const CARD_WIDTH = 85;
    const CARD_HEIGHT = 55;
    const MARGIN = 1;

    // Estimate pitch based on detected grid dimensions and physical card size
    // This is more robust than relying on manual inputs which might default to 5mm
    // Usable Width = Card Width - Margins
    // Avg Pitch = Usable Width / Num Cols

    const usableW = CARD_WIDTH - (MARGIN * 2);
    const usableH = CARD_HEIGHT - (MARGIN * 2);

    // Guard against divide by zero
    if (numCols <= 0 || numRows <= 0) {
        return { startCol: 0, startRow: 0, colsExcluded: 0, rowsExcluded: 0 };
    }

    const estColPitch = usableW / numCols;
    const estRowPitch = usableH / numRows;

    // Calculate how many columns/rows need to be excluded
    const colsExcluded = Math.ceil(qrSpaceW / estColPitch);
    const rowsExcluded = Math.ceil(qrSpaceH / estRowPitch);

    // Start indices for exclusion (from the bottom-right corner)
    const startCol = Math.max(0, numCols - colsExcluded);
    const startRow = Math.max(0, numRows - rowsExcluded);

    return {
        startCol,
        startRow,
        colsExcluded,
        rowsExcluded
    };
}

/**
 * Crops a bounding box area from an image based on analyzer corners
 */


// ===================================
// Initialization
// ===================================
/**
 * Draws the source grid image on a canvas with a red square highlight
 */
function drawSourceHighlightOnCanvas(canvas, gridImage, gridPos, numCols, numRows) {
    if (!gridImage || !gridPos) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = gridImage.base64;
    img.onload = () => {
        // Force a reasonable display size
        const maxWidth = 400;
        let w = gridImage.width;
        let h = gridImage.height;
        if (w > maxWidth) {
            h = (h * maxWidth) / w;
            w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        if (gridImage.relativeCorners) {
            const scaleX = w / gridImage.width;
            const scaleY = h / gridImage.height;
            const corners = gridImage.relativeCorners.map(c => ({
                x: c.x * scaleX,
                y: c.y * scaleY
            }));

            const tx = (gridPos.col + 0.5) / (numCols || 1);
            const ty = (gridPos.row + 0.5) / (numRows || 1);

            const center = interpolateCorner(corners, tx, ty);

            // Draw red highlight square
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;

            const size = Math.max(10, Math.min(w, h) / Math.max(numCols, numRows));
            ctx.strokeRect(center.x - size / 2, center.y - size / 2, size, size);

            // Draw crosshair
            ctx.beginPath();
            ctx.moveTo(center.x - size, center.y);
            ctx.lineTo(center.x + size, center.y);
            ctx.moveTo(center.x, center.y - size);
            ctx.lineTo(center.x, center.y + size);
            ctx.stroke();
        }
    };
}

function updateLayerCalibrationPreview(layerId) {
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer || !layer.sourceMapId || !layer.sourceGridPos) {
        elements.layerCalibrationPreview.style.display = 'none';
        return;
    }

    const maps = SettingsStorage.getColorMaps();
    const map = maps.find(m => m.id === layer.sourceMapId);
    if (!map || !map.data.gridImage) {
        elements.layerCalibrationPreview.style.display = 'none';
        return;
    }

    elements.layerCalibrationPreview.style.display = 'block';
    elements.layerCalibrationText.textContent = `${map.name} | ${Math.round(layer.frequency)}kHz @ ${Math.round(layer.lpi)}LPC`;

    drawSourceHighlightOnCanvas(elements.layerCalibrationCanvas, map.data.gridImage, layer.sourceGridPos, map.data.numCols, map.data.numRows);
}

// ===================================
// Mini Color Picker
// ===================================

function initMiniPicker() {
    if (!elements.miniColorPicker) return;

    elements.closeMiniPicker.addEventListener('click', closeMiniPicker);

    // Global listener to close on click outside
    document.addEventListener('mousedown', (e) => {
        if (!elements.miniColorPicker.classList.contains('active')) return;

        const isClickInside = elements.miniColorPicker.contains(e.target);
        const isColorSquare = e.target.closest('.layer-color.assigned');
        const isEditBtn = e.target.closest('[data-action="edit"]');

        if (!isClickInside && !isColorSquare && !isEditBtn) {
            closeMiniPicker();
        }
    });

    // Canvas interaction (will be replaced by GridImagePicker)
    elements.miniPickerCanvas.addEventListener('mousedown', handleMiniPickerClick);
    elements.miniPickerCanvas.addEventListener('mousemove', handleMiniPickerHover);

    // Touch support
    elements.miniPickerCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleMiniPickerClick(touch);
    }, { passive: false });

    // Zoom controls
    if (elements.btnZoomIn) {
        elements.btnZoomIn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.gridPicker) state.gridPicker.zoomIn();
        });
    }
    if (elements.btnZoomOut) {
        elements.btnZoomOut.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.gridPicker) state.gridPicker.zoomOut();
        });
    }
    if (elements.btnZoomReset) {
        elements.btnZoomReset.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.gridPicker) state.gridPicker.resetZoom();
        });
    }

    // Mouse wheel zoom on canvas
    elements.miniPickerCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (state.gridPicker) {
            // GridImagePicker handles wheel internally
        }
    }, { passive: false });

    // Grid dropdown change
    if (elements.miniPickerGridSelect) {
        elements.miniPickerGridSelect.addEventListener('change', (e) => {
            const selectedMapId = e.target.value;
            if (selectedMapId && state.editingLayerId) {
                state.currentMiniPickerMapId = selectedMapId;
                const layer = state.layers.find(l => l.id === state.editingLayerId);
                if (layer) {
                    const targetEl = document.querySelector(`[data-layer-id="${layer.id}"] .layer-color`);
                    openMiniPicker(layer.id, targetEl, selectedMapId);
                }
            }
        });
    }

    // Grid Lines Toggle
    const cbShowGridLines = document.getElementById('cbShowGridLines');
    if (cbShowGridLines) {
        // Load saved setting
        const savedSetting = localStorage.getItem('pictureEngraver_settings_ui');
        if (savedSetting) {
            try {
                const parsed = JSON.parse(savedSetting);
                if (parsed.showGridLines !== undefined) {
                    cbShowGridLines.checked = parsed.showGridLines;
                }
            } catch (e) {
                console.warn('Failed to parse UI settings');
            }
        }

        cbShowGridLines.addEventListener('change', (e) => {
            const isChecked = e.target.checked;

            // Update picker if active
            if (state.gridPicker) {
                state.gridPicker.setShowGridLines(isChecked);
            }

            // Save setting
            const uiSettings = {
                showGridLines: isChecked
            };
            localStorage.setItem('pictureEngraver_settings_ui', JSON.stringify(uiSettings));
        });
    }
}

function cropGridImage(img, corners) {
    try {
        console.log('Generating rectified grid image (Source: Original Image)...');

        if (!img) {
            console.error('No source image provided for grid cropping');
            return null;
        }

        // Calculate scale factor between display canvas (which might be downsampled) and original image
        // 'corners' are in canvas coordinate space, so we need to scale them up to original image space
        const displayCanvas = elements.analyzerCanvas;
        let scaleX = 1;
        let scaleY = 1;

        if (displayCanvas) {
            scaleX = img.width / displayCanvas.width;
            scaleY = img.height / displayCanvas.height;
        }

        const scaledCorners = corners.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY
        }));

        // Use a temporary canvas to extract clean ImageData from the original image
        // This avoids capturing grid lines or other UI elements drawn on the display canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

        // 2. Warp using GridDetector with SCALED corners
        if (!analyzerState.gridDetector) {
            analyzerState.gridDetector = new GridDetector();
        }

        const warpedResult = analyzerState.gridDetector.warpImage(imageData, scaledCorners);

        // 3. Convert warped ImageData back to Base64
        const resCanvas = document.createElement('canvas');
        resCanvas.width = warpedResult.width;
        resCanvas.height = warpedResult.height;
        const resCtx = resCanvas.getContext('2d');
        resCtx.putImageData(warpedResult.imageData, 0, 0);

        // High quality to ensure color picker works best
        const base64 = resCanvas.toDataURL('image/jpeg', 1.0);
        console.log('rectified grid image generated', { w: warpedResult.width, h: warpedResult.height, len: base64.length });

        return {
            base64: base64,
            width: warpedResult.width,
            height: warpedResult.height,
            offsetX: 0,
            offsetY: 0,
            relativeCorners: null
        };

    } catch (e) {
        console.error("Failed to crop/warp grid image", e);
        return null;
    }
}


function openMiniPicker(layerId, targetEl, mapId = null) {
    // Redirect to standard modal for virtual/SVG devices (to provide simple color picker)
    if (SettingsStorage.isCurrentDeviceVirtual()) {
        openLayerEditModal(layerId);
        return;
    }

    const layer = state.layers.find(l => l.id === layerId);
    if (!layer) return;

    state.editingLayerId = layerId;

    // Get all maps
    const maps = SettingsStorage.getColorMaps();

    // Determine which map to show
    let activeMap;
    if (mapId) {
        activeMap = maps.find(m => m.id === mapId);
    }

    // Fallback if ID invalid or not provided: state.currentMiniPickerMapId -> Active -> First
    if (!activeMap && state.currentMiniPickerMapId) {
        activeMap = maps.find(m => m.id === state.currentMiniPickerMapId);
    }
    if (!activeMap) {
        activeMap = maps.find(m => m.active) || maps[0];
    }

    // Persist current selection
    state.currentMiniPickerMapId = activeMap ? activeMap.id : null;

    if (!activeMap || !activeMap.data.gridImage) {
        showToast('No calibration grid image found. Please run a test grid analysis.', 'warning');
        return;
    }

    const { gridImage, entries, numCols, numRows } = activeMap.data;

    // Populate grid dropdown
    if (elements.miniPickerGridSelect) {
        elements.miniPickerGridSelect.innerHTML = '';
        maps.forEach(map => {
            const option = document.createElement('option');
            option.value = map.id;
            option.textContent = `${map.name} (${map.data?.entries?.length || '?'} colors)`;
            option.selected = map.id === activeMap.id;
            elements.miniPickerGridSelect.appendChild(option);
        });
    }

    // Initialize GridImagePicker if not already done
    if (!state.gridPicker) {
        state.gridPicker = new GridImagePicker({
            canvas: elements.miniPickerCanvas,
            onHover: (entry, gridPos) => {
                if (entry && gridPos) {
                    elements.miniPickerCoords.textContent = `Col ${gridPos.col + 1} Row ${gridPos.row + 1}`;
                    elements.miniPickerValues.textContent = `F: ${Math.round(entry.frequency)}kHz  LPC: ${Math.round(entry.lpi)}`;
                } else {
                    elements.miniPickerCoords.textContent = 'Col: - Row: -';
                    elements.miniPickerValues.textContent = 'F: - LPC: -';
                }
            },
            onSelect: (entry, gridPos) => {
                if (entry && state.editingLayerId) {
                    applyMiniPickerSelection(entry, activeMap.id, gridPos);
                }
            }
        });

        // Apply initial grid lines setting
        const cbShowGridLines = document.getElementById('cbShowGridLines');
        if (cbShowGridLines) {
            state.gridPicker.setShowGridLines(cbShowGridLines.checked);
        }
    }


    // Setup Canvas
    const canvas = elements.miniPickerCanvas;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
        const finishLoading = (loadedImage) => {
            // Load data into GridImagePicker for zoom/pan support
            if (state.gridPicker) {
                state.gridPicker.loadGrid({
                    image: loadedImage,
                    entries: entries,
                    numCols: numCols,
                    numRows: numRows
                });

                // Set currently selected entry for highlighting
                if (layer.frequency !== undefined && layer.lpi !== undefined) {
                    const selectedEntry = entries.find(e =>
                        Math.round(e.frequency) === Math.round(layer.frequency) &&
                        Math.round(e.lpi) === Math.round(layer.lpi)
                    );
                    if (selectedEntry) {
                        state.gridPicker.setSelectedEntry(selectedEntry);
                    }
                }
            }
        };

        // Handle Legacy Maps: If relativeCorners exist, we must warp the image on the fly
        if (gridImage.relativeCorners && gridImage.relativeCorners.length === 4) {
            // Ensure GridDetector is available
            if (!analyzerState.gridDetector) {
                analyzerState.gridDetector = new GridDetector();
            }

            try {
                // Convert image to ImageData
                const tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = img.width;
                tmpCanvas.height = img.height;
                const tmpCtx = tmpCanvas.getContext('2d');
                tmpCtx.drawImage(img, 0, 0);
                const imgData = tmpCtx.getImageData(0, 0, img.width, img.height);

                // Warp
                const result = analyzerState.gridDetector.warpImage(imgData, gridImage.relativeCorners);

                // Draw warped
                canvas.width = result.width;
                canvas.height = result.height;
                const resCtx = canvas.getContext('2d');
                resCtx.putImageData(result.imageData, 0, 0);

                // Create image from warped result for GridImagePicker
                const warpedImg = new Image();
                warpedImg.onload = () => finishLoading(warpedImg);
                warpedImg.src = canvas.toDataURL();
            } catch (e) {
                console.error("Legacy Warp Failed", e);
                // Fallback to raw image
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                finishLoading(img);
            }
        } else {
            // New Maps: Image is already rectified
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            finishLoading(img);
        }
    };



    // Fallback: Highlight currently selected color on canvas (for non-GridImagePicker path)
    if (!state.gridPicker && layer.frequency !== undefined && layer.lpi !== undefined) {
        const entry = activeMap.data.entries.find(e =>
            Math.round(e.frequency) === Math.round(layer.frequency) &&
            Math.round(e.lpi) === Math.round(layer.lpi)
        );

        if (entry && entry.gridPos) {
            const cw = canvas.width / numCols;
            const ch = canvas.height / numRows;

            // Simple grid coordinates
            const x = Math.floor(entry.gridPos.col * cw);
            const y = Math.floor(entry.gridPos.row * ch);
            const w = Math.floor(cw);
            const h = Math.floor(ch);

            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

            // Add a small inner white glow to make it pop on dark colors
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
        }
    }

    // Position the picker to the right of the target element
    // Position the picker to the right of the target element
    if (targetEl) {
        const rect = targetEl.getBoundingClientRect();

        let left = rect.right + 15;
        let top = rect.top - 100; // Center vertically-ish

        // Viewport constraints
        if (left + 510 > window.innerWidth) {
            left = rect.left - 520;
        }
        if (top + 500 > window.innerHeight) {
            top = window.innerHeight - 520;
        }
        if (top < 10) top = 10;
        if (left < 10) left = 10;

        elements.miniColorPicker.style.left = `${left + window.scrollX}px`;
        elements.miniColorPicker.style.top = `${top + window.scrollY}px`;
        elements.miniColorPicker.style.transform = 'none';
    } else {
        // Fallback: Center on screen
        elements.miniColorPicker.style.left = '50%';
        elements.miniColorPicker.style.top = '50%';
        elements.miniColorPicker.style.transform = 'translate(-50%, -50%)';
    }
    elements.miniColorPicker.classList.add('active');

    // Onboarding action: Mini Picker Opened (with delay to ensure rendering)
    setTimeout(() => {
        if (window.onboarding) window.onboarding.handleAction('edit-modal-open');
    }, 100);

    img.src = gridImage.base64;
}

function closeMiniPicker() {
    if (elements.miniColorPicker) {
        elements.miniColorPicker.classList.remove('active');
    }
    state.editingLayerId = null;
}

/**
 * Apply selection from GridImagePicker
 * @param {Object} entry - Selected color entry
 * @param {string} mapId - Source map ID
 * @param {Object} gridPos - Grid position {row, col}
 */
function applyMiniPickerSelection(entry, mapId, gridPos) {
    const layer = state.layers.find(l => l.id === state.editingLayerId);
    if (!layer || !entry) return;

    layer.color = { ...entry.color };
    layer.frequency = entry.frequency;
    layer.lpi = entry.lpi;
    layer.sourceGridId = mapId;
    layer.sourceGridPos = gridPos;

    displayLayers();
    displayVectorPreview();
    closeMiniPicker();

    // Onboarding action: Color Picked
    if (window.onboarding) {
        window.onboarding.handleAction('color-picked');
        setTimeout(() => {
            if (window.onboarding) window.onboarding.handleAction('save-edit');
        }, 100);
    }

    showToast(`Assigned ${Math.round(layer.frequency)}kHz / ${layer.lpi}LPC`, 'success');
}

function handleMiniPickerClick(e) {
    const rect = elements.miniPickerCanvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const scaleX = elements.miniPickerCanvas.width / rect.width;
    const scaleY = elements.miniPickerCanvas.height / rect.height;

    const cell = getCellFromCoords(x * scaleX, y * scaleY);
    if (cell && state.editingLayerId) {
        const layer = state.layers.find(l => l.id === state.editingLayerId);
        if (layer) {
            layer.color = { ...cell.color };
            layer.frequency = cell.frequency;
            layer.lpi = cell.lpi;

            displayLayers();
            displayVectorPreview();
            closeMiniPicker();

            // Onboarding action: Color Picked
            if (window.onboarding) {
                window.onboarding.handleAction('color-picked');
                // Trigger save-edit immediately since mini picker is instant
                setTimeout(() => {
                    if (window.onboarding) window.onboarding.handleAction('save-edit');
                }, 100);
            }

            showToast(`Assigned ${Math.round(layer.frequency)}kHz / ${layer.lpi}LPC`, 'success');
        }
    }
}

function handleMiniPickerHover(e) {
    const rect = elements.miniPickerCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = elements.miniPickerCanvas.width / rect.width;
    const scaleY = elements.miniPickerCanvas.height / rect.height;

    const cell = getCellFromCoords(x * scaleX, y * scaleY);
    const coordsEl = elements.miniPickerCoords;
    const valuesEl = elements.miniPickerValues;

    if (cell) {
        if (coordsEl) coordsEl.textContent = `Col: ${cell.gridPos.col} Row: ${cell.gridPos.row}`;
        if (valuesEl) valuesEl.textContent = `${Math.round(cell.frequency)}kHz / ${cell.lpi}LPC`;
    } else {
        if (coordsEl) coordsEl.textContent = `Col: - Row: -`;
        if (valuesEl) valuesEl.textContent = `Searching grid...`;
    }
}

// Navigation Helper
function navigateMiniPickerGrid(direction) {
    const maps = SettingsStorage.getColorMaps();
    if (!maps || maps.length === 0) return;

    // Use current ID, or fallback to active, or first
    const currentId = state.currentMiniPickerMapId || (maps.find(m => m.active) || maps[0]).id;
    const currentIndex = maps.findIndex(m => m.id === currentId);

    if (currentIndex === -1) {
        // Should not happen, but safe fallback
        openMiniPicker(state.editingLayerId, null, maps[0].id);
        return;
    }

    // Calculate new index wrapping around
    let newIndex = (currentIndex + direction) % maps.length;
    if (newIndex < 0) newIndex = maps.length - 1;

    const newMapId = maps[newIndex].id;

    // Refresh Picker
    openMiniPicker(state.editingLayerId, null, newMapId);
}

function getCellFromCoords(x, y) {
    const maps = SettingsStorage.getColorMaps();

    // Use current picker map if set, otherwise active
    const mapId = state.currentMiniPickerMapId;
    let activeMap;
    if (mapId) {
        activeMap = maps.find(m => m.id === mapId);
    }

    if (!activeMap) {
        activeMap = maps.find(m => m.active) || maps[0];
    }

    if (!activeMap) return null;

    const { entries, numCols, numRows } = activeMap.data;

    // Normalize coordinates to 0..1
    const tx = x / elements.miniPickerCanvas.width;
    const ty = y / elements.miniPickerCanvas.height;

    if (tx < 0 || tx > 1 || ty < 0 || ty > 1) return null;

    const col = Math.floor(tx * numCols);
    const row = Math.floor(ty * numRows);

    return entries.find(e => e.gridPos.col === col && e.gridPos.row === row);
}

async function init() {
    // 1. Initialize Settings Storage & Defaults
    SettingsStorage.ensureSystemDefaultMap();

    // 1b. Initialize Multi-Grid Palette with k-d tree index
    await initializeMultiGridPalette(SettingsStorage);

    initMiniPicker();

    // 2. Initialize Landing Page for Device Selection
    const landingPage = new LandingPage(SettingsStorage, (deviceId) => {

        // RELOAD Settings completely to get the correct defaults for this device
        state.settings = SettingsStorage.load();

        // Update UI with new settings (ranges, defaults)
        applySettingsToUI();

        // Update Header/UI to show current device
        updateDeviceUI(deviceId);
    });

    // 3. Show Landing Page (if needed)
    // This will either trigger the callback immediately (if saved) or show UI
    landingPage.show();

    // Setup event listeners
    setupDropZone();
    setupControls();
    setupModals();
    setupLayers();
    setupPreview();
    setupExport();
    setupTestGrid();
    setupAnalyzer();
    setupAdvancedAnalyzer();
    setupLightbox();
    setupColorGridsManagement();

    Logger.info('Picture Engraver initialized', { appVersion: '2.0.0' });

    // Initialize Onboarding Logic
    window.onboarding = new OnboardingManager();
    window.onboarding.init();

    // Hook Help Button
    document.getElementById('btnHelp').addEventListener('click', () => {
        window.onboarding.showWelcomeModal();
    });

    // Add "Switch Device" capability (e.g., via title click or new button)
    // For now, let's just make the title in header clickable if in dev mode?
    // Or add a small indicator.
    setupDeviceSwitching(landingPage);
}

function updateDeviceUI(deviceId) {
    const profiles = SettingsStorage.getProfiles();
    const profile = profiles[deviceId];
    const isVirtual = SettingsStorage.isVirtualDevice(deviceId);

    if (profile) {
        // Update Title or Add Badge
        const titleContainer = document.querySelector('.title-container .brand-subtitle');
        if (titleContainer) {
            const badgeColor = isVirtual ? 'rgba(100,200,100,0.2)' : 'rgba(255,255,255,0.1)';
            titleContainer.innerHTML = `by lasertools.org &nbsp; <span class="device-badge" style="background: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; cursor:pointer;" title="Click to switch device">📍 ${profile.name}</span>`;

            // Add click listener to the badge to re-open landing page
            const badge = titleContainer.querySelector('.device-badge');
            badge.addEventListener('click', () => {
                // We need to access landingPage instance. 
                // Since this is inside a function, we might need a global ref or pass it.
                // See setupDeviceSwitching below which handles the logic easier.
                // We'll leave the click handling to setupDeviceSwitching mostly, 
                // but here we just render the visual.
            });
        }
    }

    // Toggle UI elements based on virtual device mode
    toggleVirtualModeUI(isVirtual);
}

/**
 * Toggle UI elements visibility based on virtual device mode (SVG export)
 * @param {boolean} isVirtual - True if current device is virtual (SVG mode)
 */
function toggleVirtualModeUI(isVirtual) {
    // 1. Hide/show the "Analyze Grid" tab in the test grid modal
    const analyzerTabBtn = document.querySelector('[data-modal-tab="analyzer"]');
    if (analyzerTabBtn) {
        analyzerTabBtn.style.display = isVirtual ? 'none' : '';
    }

    // 2. Hide/show laser-related settings in the settings modal
    const laserSettingGroups = document.querySelectorAll('#settingsModal .setting-group');
    laserSettingGroups.forEach((group, index) => {
        // First group (index 0) is engraving settings (Power, Speed, etc.)
        // Hide all but width/height when in virtual mode
        // For now, hide all groups except those we might want to keep
        if (isVirtual && index < 4) { // Hide first 4 groups (laser-specific)
            group.style.display = 'none';
        } else {
            group.style.display = '';
        }
    });

    // 3. Change export button text and behavior
    const exportBtn = document.getElementById('btnDownloadXCS');
    if (exportBtn) {
        if (isVirtual) {
            exportBtn.innerHTML = '<span>📁</span> Download SVG';
            exportBtn.dataset.exportMode = 'svg';
            exportBtn.disabled = false; // Force enable in SVG mode to fix persistent disabled state
        } else {
            exportBtn.innerHTML = '<span>💾</span> Download XCS';
            exportBtn.dataset.exportMode = 'xcs';
            exportBtn.disabled = false; // Force enable in XCS mode
        }
    }

    // 4. Hide/show the "Auto-Assign Colors" button (not relevant for SVG mode)
    const autoAssignBtn = document.getElementById('btnAutoAssign');
    if (autoAssignBtn) {
        autoAssignBtn.style.display = isVirtual ? 'none' : '';
    }

    // 5. Hide/show the Test Grid modal button if needed
    // For SVG mode, test grids are not relevant
    const testGridBtn = document.getElementById('btnTestGrid');
    if (testGridBtn) {
        testGridBtn.style.display = isVirtual ? 'none' : '';
    }

    // 6. Hide/show focus warning messages (only relevant for laser engraving)
    const focusWarnings = document.querySelectorAll('.focus-warning');
    focusWarnings.forEach(el => el.style.display = isVirtual ? 'none' : '');

    // 7. Hide/show Calibration Status text (not relevant for SVG mode)
    const calStatus = document.getElementById('calibrationStatus');
    if (calStatus) {
        calStatus.style.display = isVirtual ? 'none' : '';
    }

    // 8. Hide/show Help and Settings buttons (SVG mode is simplified)
    const helpBtn = document.getElementById('btnHelp');
    if (helpBtn) {
        helpBtn.style.display = isVirtual ? 'none' : '';
    }
    const settingsBtn = document.getElementById('btnSettings');
    if (settingsBtn) {
        settingsBtn.style.display = isVirtual ? 'none' : '';
    }
}

function setupDeviceSwitching(landingPage) {
    // Attach listener to the badge we created in updateDeviceUI
    // Since badge is dynamic, we use event delegation or just re-attach
    // Actually, simpler: let's add a button to the header right

    // OR, just make the subtitle clickable as implemented above, 
    // but we need to ensure the element exists.

    const titleContainer = document.querySelector('.title-container');
    titleContainer.addEventListener('click', (e) => {
        if (e.target.closest('.device-badge')) {
            landingPage.show(true); // Force show
        }
    });
}

function updateStatus(msg, progress = -1) {
    if (!elements.statusBar) return;
    elements.statusBar.style.display = 'flex';
    elements.statusText.textContent = msg;
    if (progress >= 0) {
        elements.progressContainer.style.display = 'block';
        elements.progressFill.style.width = `${progress}%`;
    } else {
        elements.progressContainer.style.display = 'none';
    }
}

// ===================================
// Drop Zone Setup
// ===================================
function setupDropZone() {
    const { dropZone, fileInput } = elements;

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // File selected
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Clear image
    elements.btnClearImage.addEventListener('click', clearImage);
}

// ===================================
// File Handling
// ===================================
function handleFile(file) {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please use PNG, JPG, or WebP.', 'error');
        return;
    }

    // Load image
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.originalImage = img;
            displayOriginalImage(img);
            showControls();

            // Advance onboarding if active
            if (window.onboarding) window.onboarding.handleAction('upload');

            showToast('Image loaded successfully!', 'success');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function displayOriginalImage(img) {
    const canvas = elements.originalCanvas;
    const ctx = canvas.getContext('2d');

    // Scale to fit preview
    const maxSize = 280;
    let width = img.width;
    let height = img.height;

    if (width > height) {
        if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
        }
    } else {
        if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
        }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    // Show preview container, hide drop zone
    elements.dropZone.style.display = 'none';
    elements.originalPreviewContainer.style.display = 'flex';
}

function clearImage() {
    state.originalImage = null;
    state.processedImage = null;
    state.layers = [];

    // Reset UI
    elements.dropZone.style.display = 'block';
    elements.originalPreviewContainer.style.display = 'none';
    elements.controlsSection.style.display = 'none';
    elements.layersPanel.style.display = 'none';
    elements.previewPanel.style.display = 'none';
    elements.fileInput.value = '';

    showToast('Image cleared', 'success');
}

function showControls() {
    elements.controlsSection.style.display = 'flex';
}

// ===================================
// Controls Setup
// ===================================
function setupControls() {
    const { sizeSelect, customSizeGroup, colorSlider, colorCountDisplay, btnProcess } = elements;

    // Size selection
    sizeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customSizeGroup.style.display = 'block';
        } else {
            customSizeGroup.style.display = 'none';
        }
    });

    // Color count slider
    colorSlider.addEventListener('input', (e) => {
        colorCountDisplay.textContent = e.target.value;
    });

    // Process button
    btnProcess.addEventListener('click', processImage);

    // Merge Modal listeners
    elements.closeMergeModal.addEventListener('click', () => {
        elements.mergeModal.classList.remove('active');
        if (window.onboarding) window.onboarding.handleAction('merge-complete');
    });
    elements.btnCancelMerge.addEventListener('click', () => {
        elements.mergeModal.classList.remove('active');
        if (window.onboarding) window.onboarding.handleAction('merge-complete');
    });
}

// ===================================
// Image Processing
// ===================================
async function processImage() {
    if (!state.originalImage) {
        showToast('Please upload an image first', 'error');
        return;
    }

    // UI Loading
    const btnHtml = elements.btnProcess.innerHTML;
    elements.btnProcess.innerHTML = '<span>⏳</span> Processing...';
    elements.btnProcess.disabled = true;
    updateStatus('Preparing image...', 5);

    setTimeout(() => {
        try {
            // Get settings
            const numColors = parseInt(elements.colorSlider.value);
            const size = getOutputSize();
            state.outputSize = size;

            Logger.info('Starting image processing', {
                numColors,
                width: size.width,
                height: size.height
            });

            updateStatus('Resizing image...', 15);

            // Process image
            const processor = new ImageProcessor();
            const resized = processor.resize(state.originalImage, size.width, size.height);

            // Update output size to match actual resized dimensions (remove padding)
            state.outputSize = {
                width: resized.width / 10, // Convert px back to mm (assuming 10px/mm)
                height: resized.height / 10
            };

            updateStatus('Quantizing colors...', 30);

            setTimeout(() => {
                try {
                    // Smart quantization: for higher color counts, use gradient expansion
                    const BASE_COLOR_THRESHOLD = 12;
                    let quantizedImage, palette;

                    if (numColors <= BASE_COLOR_THRESHOLD) {
                        // Standard quantization for low color counts
                        const quantizer = new ColorQuantizer();
                        const result = quantizer.quantize(resized, numColors);
                        quantizedImage = result.quantizedImage;
                        palette = result.palette;
                    } else {
                        // For higher color counts: base quantization + gradient expansion
                        // Base colors = min(12, numColors/3) for optimal gradient distribution
                        const baseColors = Math.min(12, Math.max(4, Math.floor(numColors / 3)));

                        updateStatus(`Quantizing to ${baseColors} base colors...`, 35);

                        const baseQuantizer = new ColorQuantizer();
                        const baseResult = baseQuantizer.quantize(resized, baseColors);

                        updateStatus(`Expanding to ${numColors} colors with gradients...`, 45);

                        // Expand with gradient interpolation
                        const enhancedQuantizer = new EnhancedQuantizer();
                        const expandedResult = enhancedQuantizer.expandAndRequantize(
                            resized,
                            baseResult.palette,
                            numColors
                        );

                        // Convert plain object back to ImageData for canvas display
                        quantizedImage = new ImageData(
                            new Uint8ClampedArray(expandedResult.quantizedImage.data),
                            expandedResult.quantizedImage.width,
                            expandedResult.quantizedImage.height
                        );
                        palette = expandedResult.palette.map(c => ({ r: c.r, g: c.g, b: c.b }));

                        Logger.info('Gradient expansion complete', {
                            baseColors: baseResult.palette.length,
                            expandedColors: palette.length,
                            interpolatedCount: expandedResult.stats?.interpolatedColors || 0
                        });
                    }

                    // Sync UI if image has fewer colors than requested
                    if (palette.length < numColors) {
                        elements.colorSlider.value = palette.length;
                        elements.colorCountDisplay.textContent = palette.length;
                        showToast(`Note: Image contains only ${palette.length} distinct colors. Adjusted layer count.`, 'info');
                    }


                    state.processedImage = quantizedImage;
                    state.palette = palette;

                    state.layers = palette.map((color, index) => ({
                        id: `layer-${index}`,
                        name: `Layer ${index + 1}`,
                        color: null, // Explicitly null until assigned
                        originalColor: { ...color }, // Store static original color
                        visible: true,
                        frequency: null,
                        lpi: null,
                        outline: false,
                        paths: []
                    }));

                    // Display results
                    displayQuantizedImage(quantizedImage);
                    displayLayers();

                    // Show panels
                    elements.layersPanel.style.display = 'flex';
                    elements.previewPanel.style.display = 'flex';

                    updateStatus('Vectorizing layers (may take a moment)...', 60);

                    // Vectorize layers
                    setTimeout(async () => {
                        try {
                            await vectorizeLayers();

                            elements.btnProcess.innerHTML = btnHtml;
                            elements.btnProcess.disabled = false;
                            updateStatus('Complete', 100);

                            // Advance onboarding if active
                            if (window.onboarding) window.onboarding.handleAction('process');

                            setTimeout(() => { if (elements.statusBar) elements.statusBar.style.display = 'none'; }, 3000);
                        } catch (error) {
                            console.error('Vectorization error:', error);
                            showToast('Vectorization failed: ' + error.message, 'error');
                            elements.btnProcess.innerHTML = btnHtml;
                            elements.btnProcess.disabled = false;
                            updateStatus('Error', 0);
                        }
                    }, 50);

                } catch (error) { throw error; }
            }, 50);

        } catch (error) {
            Logger.error('Processing error', { error: error.message });
            console.error('Processing error:', error);
            showToast('Error processing image: ' + error.message, 'error');
            elements.btnProcess.innerHTML = btnHtml;
            elements.btnProcess.disabled = false;
            updateStatus('Error', 0);
        }
    }, 50);
}

function getOutputSize() {
    const sizeValue = elements.sizeSelect.value;

    if (sizeValue === 'custom') {
        return {
            width: parseInt(elements.customWidth.value),
            height: parseInt(elements.customHeight.value)
        };
    }

    const [width, height] = sizeValue.split('x').map(Number);
    return { width, height };
}

function calculateFrequency(index, total) {
    const { freqMin, freqMax } = state.settings;
    return freqMin + ((freqMax - freqMin) * index) / (total - 1);
}

function calculateLPI(index, total) {
    const { lpiMin, lpiMax } = state.settings;
    return lpiMax - ((lpiMax - lpiMin) * index) / (total - 1);
}

function displayQuantizedImage(imageData) {
    const canvas = elements.quantizedCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
}

async function vectorizeLayers() {
    try {
        const vectorizer = new Vectorizer();
        const pxPerMm = 10;

        // Vectorize each layer
        state.vectorizedLayers = vectorizer.vectorizeAllLayers(
            state.processedImage,
            state.palette,
            pxPerMm
        );

        // Copy paths to layer objects
        state.vectorizedLayers.forEach((vLayer, index) => {
            if (state.layers[index]) {
                state.layers[index].paths = vLayer.paths;
            }
        });

        // Generate and display SVG preview
        displayVectorPreview();

        showToast('Vectorization complete!', 'success');
    } catch (error) {
        console.error('Vectorization error:', error);
        showToast('Vectorization failed: ' + error.message, 'error');
    }
}

function displayVectorPreview() {
    const { width, height } = state.outputSize;
    const container = elements.vectorSvgContainer;

    // Use array accumulation for better performance with many paths
    const svgParts = [`<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="background: #fff;">`];

    state.layers.forEach(layer => {
        if (!layer.visible) return;

        // Fallback to originalColor if calibrated color is not yet assigned
        const displayColor = layer.color || layer.originalColor;
        const colorStr = `rgb(${displayColor.r}, ${displayColor.g}, ${displayColor.b})`;

        // Batch paths for this layer
        layer.paths.forEach(path => {
            if (path && path.length > 0) {
                // Use fill-rule: evenodd to handle holes correctly in combined paths
                svgParts.push(`<path d="${path}" fill="${colorStr}" stroke="none" fill-opacity="0.9"/>`);
            }
        });
    });

    svgParts.push('</svg>');
    container.innerHTML = svgParts.join('');
}

// ===================================
// Layers
// ===================================
function setupLayers() {
    elements.btnAutoAssign.addEventListener('click', autoAssignColors);

    // Event delegation for layer interactions
    elements.layersList.addEventListener('click', (e) => {
        const layerItem = e.target.closest('.layer-item');
        if (layerItem) {
            const checkbox = layerItem.querySelector('.layer-checkbox');
            const layerId = checkbox?.dataset.layerId;
            if (layerId) {
                // Determine if we should open edit or just highlight
                const isColorClick = e.target.closest('.layer-color.assigned');
                const isEditBtn = e.target.closest('[data-action="edit"]');

                if (isColorClick || isEditBtn) {
                    const targetEl = isColorClick || isEditBtn;
                    openMiniPicker(layerId, targetEl);
                } else {
                    // Visual selection of the layer item
                    document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('selected'));
                    layerItem.classList.add('selected');
                }
            }
        }
    });
}

function displayLayers() {
    const container = elements.layersList;
    container.innerHTML = '';

    state.layers.forEach((layer, index) => {
        const layerEl = document.createElement('div');
        layerEl.className = 'layer-item';

        // Indent outline layers
        if (layer.type === 'outline') {
            layerEl.style.marginLeft = '20px';
            layerEl.style.borderLeft = '3px solid #666';
        }

        const isOutline = layer.type === 'outline';
        const isVirtual = SettingsStorage.isCurrentDeviceVirtual();

        let actionsHtml = '';
        let settingsHtml = '';

        if (isOutline) {
            // Outline Layer: Show Thickness Input + Apply + Delete
            const thickness = layer.thickness || 5;

            // Adjust settings display just for outline? Or keep frequency/LPC?
            // Usually outlines share settings with parent or have their own. 
            // For now, let's keep the settings info but maybe smaller.
            // And add the controls in the actions area or settings area.

            // We'll put the controls in a compact flex row
            actionsHtml = `
                <div style="display:flex; align-items:center; gap:2px; margin-right:5px;">
                    <input type="number" class="outline-thickness-input" value="${thickness}" min="1" max="50" style="width: 40px; padding: 2px; font-size: 0.8em;" data-layer-id="${layer.id}">
                    <button class="btn btn-icon btn-sm btn-update-outline" title="Apply Thickness" data-layer-id="${layer.id}" style="color: #4CAF50;">✔️</button>
                    <button class="btn btn-icon btn-sm btn-delete-layer" title="Delete Layer" data-layer-id="${layer.id}" style="color: #ff4444;">🗑️</button>
                </div>
            `;

            settingsHtml = `<div class="layer-settings">Offset: ${thickness}px</div>`;

        } else {
            // Check if this layer already has an outline
            const hasOutline = state.layers.some(l => l.type === 'outline' && l.parentId === layer.id);

            // Normal Layer: Add Outline + Edit
            const outlineBtn = (isVirtual || hasOutline) ? '' : `
                <button class="btn btn-sm btn-primary btn-add-outline" title="Add Outline Layer" data-layer-id="${layer.id}" style="margin-right: 5px; font-size: 0.8em; display:flex; align-items:center; gap:4px;"><span>+</span> Add Outline</button>
            `;

            actionsHtml = `
                ${outlineBtn}
            `;
            // isVirtual defined above
            // const isVirtual = SettingsStorage.isCurrentDeviceVirtual();

            const hasSettings = layer.frequency !== null && layer.lpi !== null;
            let settingsText = '⚠️ Settings Pending';
            let matchQualityClass = '';
            let sourceTooltip = '';

            if (isVirtual) {
                settingsText = 'Ready for Export';
            } else if (hasSettings) {
                // Primary settings: frequency and LPC
                settingsText = `${Math.round(layer.frequency)}kHz / ${Math.round(layer.lpi)}LPC`;

                // Add source grid info if available
                if (layer.sourceGridName) {
                    settingsText += ` · ${layer.sourceGridName}`;
                }

                // Add match quality indicator
                if (layer.matchQuality) {
                    const qualityIcons = {
                        'Excellent': '✓',
                        'Good': '●',
                        'Approximate': '◐',
                        'Poor': '○'
                    };
                    const icon = qualityIcons[layer.matchQuality] || '';
                    matchQualityClass = `match-${layer.matchQuality.toLowerCase()}`;
                    settingsText = `${icon} ${settingsText}`;
                }

                // Build tooltip with alternative sources
                if (layer.alternativeSources && layer.alternativeSources.length > 0) {
                    const altNames = layer.alternativeSources.map(s => s.gridName).join(', ');
                    sourceTooltip = `Also available in: ${altNames}`;
                }
            }

            const isValid = hasSettings || isVirtual;
            const tooltipAttr = sourceTooltip ? `title="${sourceTooltip}"` : '';
            settingsHtml = `<div class="layer-settings ${isValid ? '' : 'pending'} ${matchQualityClass}" ${tooltipAttr} style="${isVirtual ? 'color:#4CAF50;' : ''}">${settingsText}</div>`;
        }

        let colorHtml = '';
        if (isOutline) {
            const displayColor = layer.color || layer.originalColor;
            colorHtml = `<div class="layer-color" style="background-color: rgb(${displayColor.r}, ${displayColor.g}, ${displayColor.b});" data-layer-id="${layer.id}"></div>`;
        } else {
            const assignedColor = layer.color;
            const assignedStyle = assignedColor
                ? `background-color: rgb(${assignedColor.r}, ${assignedColor.g}, ${assignedColor.b});`
                : `background: #2e2e2e; border: 1px dashed #555; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #888;`;

            const assignedContent = assignedColor ? '' : '<span>?</span>';

            colorHtml = `
                <div class="layer-colors-container">
                    <div class="layer-color original" style="background-color: rgb(${layer.originalColor.r}, ${layer.originalColor.g}, ${layer.originalColor.b}); pointer-events: none;" title="Original detected color"></div>
                    <div class="layer-color assigned" ${index === 0 ? 'id="tour-target-layer-color"' : ''} style="${assignedStyle} cursor: pointer;" data-layer-id="${layer.id}" title="${assignedColor ? 'Assigned calibrated color - Click to edit' : 'No color assigned - Click to pick'}">${assignedContent}</div>
                </div>
            `;
        }

        layerEl.innerHTML = `
      <input type="checkbox" class="layer-checkbox" ${layer.visible ? 'checked' : ''} data-layer-id="${layer.id}">
      ${colorHtml}
      <div class="layer-info">
        <div class="layer-name">${layer.name}</div>
        ${settingsHtml}
      </div>
      <div class="layer-actions" style="display: flex; align-items: center;">
        ${actionsHtml}
      </div>
    `;
        container.appendChild(layerEl);
    });

    // Add event listeners for Visibility
    container.querySelectorAll('.layer-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const layerId = e.target.dataset.layerId;
            const layer = state.layers.find(l => l.id === layerId);
            if (layer) {
                layer.visible = e.target.checked;
                displayVectorPreview(); // Refresh preview when visibility changes
            }
        });
    });

    // Add event listeners for Color Click
    container.querySelectorAll('.layer-color.assigned').forEach(colorEl => {
        colorEl.addEventListener('click', (e) => {
            const layerId = e.target.dataset.layerId;
            openMiniPicker(layerId, colorEl);
        });
    });

    // Add event listeners for Add Outline (New Logic: Default 5px, no prompt)
    container.querySelectorAll('.btn-add-outline').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const layerId = e.target.dataset.layerId || e.target.closest('button').dataset.layerId;
            const layer = state.layers.find(l => l.id === layerId);

            if (layer) {
                try {
                    const thickness = 5; // Default

                    const btnEl = e.target.closest('button');
                    if (btnEl.disabled) return;

                    const originalText = btnEl.innerHTML;
                    btnEl.innerHTML = '⏳ Gener...';
                    btnEl.disabled = true;

                    // Small delay
                    await new Promise(r => setTimeout(r, 10));

                    const vectorizer = new Vectorizer();
                    const pxPerMm = 10;

                    const paths = vectorizer.generateOutline(
                        {
                            data: state.processedImage.data,
                            width: state.processedImage.width,
                            height: state.processedImage.height
                        },
                        layer.originalColor,
                        thickness,
                        pxPerMm
                    );

                    const outlineLayer = {
                        id: layer.id + '_outline_' + Date.now(), // Unique ID
                        name: layer.name + ' Outline',
                        type: 'outline',
                        color: { r: 0, g: 0, b: 0 }, // Default to Black
                        sourceColor: { ...layer.originalColor }, // Store original source color
                        paths: paths,
                        visible: true,
                        parentId: layer.id,
                        frequency: state.settings.blackFreq,
                        lpi: state.settings.blackLpi,
                        speed: state.settings.blackSpeed,
                        power: state.settings.blackPower,
                        bounds: layer.bounds,
                        thickness: thickness // Store thickness state
                    };

                    const idx = state.layers.findIndex(l => l.id === layer.id);
                    if (idx !== -1) {
                        state.layers.splice(idx + 1, 0, outlineLayer);
                    }

                    displayLayers();
                    displayVectorPreview();
                    showToast('Outline layer added', 'success');

                } catch (err) {
                    console.error('Outline generation failed:', err);
                    showToast('Failed to generate outline', 'error');
                    displayLayers();
                }
            }
        });
    });

    // Add event listeners for Apply/Update Outline Thickness
    container.querySelectorAll('.btn-update-outline').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const layerId = e.target.dataset.layerId || e.target.closest('button').dataset.layerId;
            const layer = state.layers.find(l => l.id === layerId);

            if (layer && layer.type === 'outline') {
                const row = e.target.closest('.layer-item');
                const input = row.querySelector('.outline-thickness-input');
                const newThickness = parseInt(input.value);

                if (newThickness && newThickness > 0) {
                    try {
                        const btnEl = e.target.closest('button');
                        btnEl.innerHTML = '⏳';
                        btnEl.disabled = true;

                        await new Promise(r => setTimeout(r, 10));

                        const vectorizer = new Vectorizer();
                        const pxPerMm = 10;

                        // Use stored sourceColor or fallback to parent lookup or current color
                        // Best is sourceColor if available.
                        let colorToTrace = layer.sourceColor;
                        if (!colorToTrace) {
                            // Fallback for older outlines
                            const parentLayer = state.layers.find(l => l.id === layer.parentId);
                            colorToTrace = parentLayer ? parentLayer.color : layer.color;
                        }

                        const paths = vectorizer.generateOutline(
                            {
                                data: state.processedImage.data,
                                width: state.processedImage.width,
                                height: state.processedImage.height
                            },
                            colorToTrace,
                            newThickness,
                            pxPerMm
                        );

                        // Update layer
                        layer.paths = paths;
                        layer.thickness = newThickness;

                        displayLayers();
                        displayVectorPreview();
                        showToast('Outline updated', 'success');

                    } catch (err) {
                        console.error('Outline update failed:', err);
                        showToast('Failed to update outline', 'error');
                        displayLayers();
                    }
                }
            }
        });
    });

    // Add event listeners for Delete Outline
    container.querySelectorAll('.btn-delete-layer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const layerId = e.target.dataset.layerId || e.target.closest('button').dataset.layerId;
            const idx = state.layers.findIndex(l => l.id === layerId);
            if (idx !== -1) {
                state.layers.splice(idx, 1);
                displayLayers();
                displayVectorPreview();
            }
        });
    });

    // Add event listeners for Edit Button
    container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const layerId = e.target.dataset.layerId || e.target.closest('button').dataset.layerId;
            openMiniPicker(layerId, btn);
        });
    });

    updateCalibrationStatus();
    updateDownloadButtonState();
}

/**
 * Update the download button state based on layer assignments
 */
function updateDownloadButtonState() {
    if (!elements.btnDownloadXCS) return;

    const isVirtual = SettingsStorage.isCurrentDeviceVirtual();
    const btn = elements.btnDownloadXCS;

    // In virtual mode (SVG Export), we don't need color/settings assignment
    if (isVirtual) {
        btn.disabled = false;
        btn.title = 'Download SVG File';
        btn.style.opacity = '1';
        return;
    }

    const unassignedLayers = state.layers.filter(l => l.visible && (l.frequency === null || l.lpi === null));

    if (unassignedLayers.length > 0 && state.layers.length > 0) {
        btn.disabled = true;
        btn.title = `Please assign colors/settings to all ${unassignedLayers.length} pending layers first`;
        btn.style.opacity = '0.5';
    } else {
        btn.disabled = false;
        btn.title = 'Download XCS File';
        btn.style.opacity = '1';
    }
}

function updateCalibrationStatus() {
    const statusEl = document.getElementById('calibrationStatus');
    if (!statusEl) return;

    if (SettingsStorage.hasColorMap()) {
        const map = SettingsStorage.loadColorMap();
        const date = map.savedAt ? new Date(map.savedAt).toLocaleDateString() : 'Active';
        statusEl.innerHTML = `✅ Calibrated using ${map.entries.length} colors (${date})`;
        statusEl.style.color = 'var(--accent-success)';
    } else {
        statusEl.innerHTML = `⚠️ No calibration data found. Use <strong>Test Grid > Analyze</strong> to calibrate.`;
        statusEl.style.color = 'var(--accent-warning)';
    }
}

function autoAssignColors() {
    // Check if multi-grid palette has colors
    const stats = multiGridPalette.getStats();

    if (stats.uniqueColors === 0) {
        showToast('No color grids found! Please calibrate colors in the Test Grid > Analyze Grid tab first.', 'error');
        return;
    }

    if (state.layers.length === 0) {
        showToast('No layers to assign colors to. Process an image first.', 'error');
        return;
    }

    Logger.info(`Auto-assigning colors using ${stats.uniqueColors} unique colors from ${stats.gridCount} grid(s)`);

    // Disable button and show loading state
    const btn = elements.btnAutoAssign;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Assigning...';

    // Allow UI to update before processing
    setTimeout(() => {
        try {
            // Standard Colors (black/white) with custom speed/power
            const s = state.settings;
            const standardColors = [
                {
                    color: { r: 0, g: 0, b: 0 },
                    frequency: s.blackFreq, lpi: s.blackLpi,
                    speed: s.blackSpeed, power: s.blackPower,
                    gridName: 'Standard',
                    isStandard: true
                },
                {
                    color: { r: 255, g: 255, b: 255 },
                    frequency: s.whiteFreq, lpi: s.whiteLpi,
                    speed: s.whiteSpeed, power: s.whitePower,
                    gridName: 'Standard',
                    isStandard: true
                }
            ];

            // For each layer, find the closest matching color
            state.layers.forEach(layer => {
                // Skip outline layers - they have fixed settings/colors and shouldn't be auto-matched
                if (layer.type === 'outline') return;

                // First check standard colors (exact match for pure black/white)
                const layerColor = layer.originalColor;
                let bestMatch = null;

                // Check for exact black/white match first
                for (const std of standardColors) {
                    const dist = Math.sqrt(
                        Math.pow(layerColor.r - std.color.r, 2) +
                        Math.pow(layerColor.g - std.color.g, 2) +
                        Math.pow(layerColor.b - std.color.b, 2)
                    );
                    if (dist < 20) { // Near-exact match for black/white
                        bestMatch = { ...std, matchDistance: dist, matchQuality: 'Excellent' };
                        break;
                    }
                }

                // If not a standard color, use k-d tree for fast matching
                if (!bestMatch) {
                    bestMatch = multiGridPalette.findBestMatch(layerColor);
                }

                if (bestMatch) {
                    layer.frequency = bestMatch.frequency;
                    layer.lpi = bestMatch.lpi;

                    // Only apply speed/power if they are defined (standard colors)
                    if (bestMatch.speed !== undefined) layer.speed = bestMatch.speed;
                    if (bestMatch.power !== undefined) layer.power = bestMatch.power;

                    // Use the actual calibrated color
                    layer.color = { ...bestMatch.color };

                    // Store source mapping
                    layer.sourceGridId = bestMatch.gridId || null;
                    layer.sourceGridName = bestMatch.gridName || null;
                    layer.sourceGridPos = bestMatch.gridPos || null;
                    layer.matchDistance = bestMatch.matchDistance || null;
                    layer.matchQuality = bestMatch.matchQuality || null;
                    layer.alternativeSources = bestMatch.alternativeSources || [];
                }
            });

            // Refresh the layers display and preview
            displayLayers();
            if (state.vectorizedLayers.length > 0) {
                displayVectorPreview();
            }

            Logger.info('Auto-assign colors completed', {
                layersUpdated: state.layers.length,
                uniqueColors: stats.uniqueColors,
                indexBuildTime: stats.indexBuildTimeMs
            });
            showToast(`Colors auto-assigned using ${stats.uniqueColors} calibrated colors!`, 'success');

            // Detect and offer to merge layers with identical assignments
            const assignments = new Map();
            state.layers.forEach(layer => {
                if (layer.frequency !== null && layer.lpi !== null) {
                    const key = `${Math.round(layer.frequency)}-${layer.lpi}`;
                    if (!assignments.has(key)) assignments.set(key, []);
                    assignments.get(key).push(layer);
                }
            });

            let dupCount = 0;
            for (const [key, group] of assignments) {
                if (group.length > 1) {
                    dupCount += (group.length - 1);
                }
            }

            if (dupCount > 0) {
                // Onboarding: Add the merge step if needed
                if (window.onboarding) window.onboarding.injectMergeStep();

                setTimeout(() => {
                    showMergeOpportunity(assignments);
                    // Trigger onboarding advance AFTER modal is shown
                    if (window.onboarding) window.onboarding.handleAction('auto-assign');
                }, 500); // Small delay to let the success toast show first
            } else {
                // No duplicates, proceed immediately
                if (window.onboarding) window.onboarding.handleAction('auto-assign');
            }
        } catch (error) {
            Logger.error('Auto-assign error', { error: error.message });
            showToast('Failed to assign colors: ' + error.message, 'error');
        } finally {
            // Re-enable button
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }, 50);
}

/**
 * Shows the merge opportunity modal with details about overlapping assignments
 * @param {Map} assignments - Map of key to array of layers
 */
function showMergeOpportunity(assignments) {
    const list = elements.mergeSuggestionsList;
    list.innerHTML = '';

    // Track which merge groups are selected (all selected by default)
    const selectedGroups = new Map();

    for (const [key, group] of assignments) {
        if (group.length <= 1) continue;

        // Select by default
        selectedGroups.set(key, true);

        const primary = group[0];
        const groupEl = document.createElement('div');
        groupEl.className = 'merge-group';
        groupEl.dataset.key = key;

        // Header with checkbox: Assigned Color & Settings
        const header = document.createElement('div');
        header.className = 'merge-group-target';
        header.style.cursor = 'pointer';
        header.innerHTML = `
            <input type="checkbox" class="merge-checkbox" data-key="${key}" checked style="width: 18px; height: 18px; margin-right: 10px; cursor: pointer;">
            <div class="merge-swatch" style="background: rgb(${primary.color.r}, ${primary.color.g}, ${primary.color.b}); width: 24px; height: 24px;"></div>
            <div style="flex: 1;">
                <div class="target-label">${Math.round(primary.frequency)}kHz / ${primary.lpi}LPC</div>
                <div style="font-size: 0.8em; color: var(--text-tertiary);">${group.length} layers → 1</div>
            </div>
        `;

        // Toggle checkbox when clicking anywhere on header
        header.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = header.querySelector('.merge-checkbox');
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        groupEl.appendChild(header);

        // Sources: List of layers being merged
        const sources = document.createElement('div');
        sources.className = 'merge-group-sources';
        group.forEach(layer => {
            const item = document.createElement('div');
            item.className = 'merge-source-item';
            item.innerHTML = `
                <div class="merge-swatch" style="background: rgb(${layer.originalColor.r}, ${layer.originalColor.g}, ${layer.originalColor.b})"></div>
                <span>${layer.name}</span>
            `;
            sources.appendChild(item);
        });
        groupEl.appendChild(sources);

        list.appendChild(groupEl);
    }

    // Add change listeners to checkboxes
    list.querySelectorAll('.merge-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            selectedGroups.set(e.target.dataset.key, e.target.checked);
            // Update visual state
            const groupEl = e.target.closest('.merge-group');
            if (groupEl) {
                groupEl.style.opacity = e.target.checked ? '1' : '0.5';
            }
            // Update button state
            const anySelected = Array.from(selectedGroups.values()).some(v => v);
            elements.btnConfirmMerge.disabled = !anySelected;
        });
    });

    // Set up button handlers for this specific session
    const confirmBtn = elements.btnConfirmMerge;
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    elements.btnConfirmMerge = newConfirmBtn; // Update reference

    elements.btnConfirmMerge.addEventListener('click', () => {
        const btn = elements.btnConfirmMerge;
        const originalContent = btn.innerHTML;

        // Show loading state and disable button
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Merging...';

        // Use setTimeout to allow UI to update before heavy operation
        setTimeout(() => {
            // Filter assignments to only include selected groups
            const selectedAssignments = new Map();
            for (const [key, value] of assignments) {
                if (selectedGroups.get(key)) {
                    selectedAssignments.set(key, value);
                }
            }
            mergeDuplicateLayers(selectedAssignments);

            // Restore button and close modal
            btn.innerHTML = originalContent;
            btn.disabled = false;
            elements.mergeModal.classList.remove('active');

            // Onboarding action: Merge Complete
            if (window.onboarding) window.onboarding.handleAction('merge-complete');
        }, 50);
    });

    elements.mergeModal.classList.add('active');
}

/**
 * Merges layers that have identical frequency/lpi settings
 * Optimized for performance with large path arrays
 * @param {Map} assignments - Map of key to array of layers
 */
function mergeDuplicateLayers(assignments) {
    const newLayers = [];
    const processedKeys = new Set();

    state.layers.forEach(layer => {
        // Only consider layers with assignments
        if (layer.frequency === null || layer.lpi === null) {
            newLayers.push(layer);
            return;
        }

        const key = `${Math.round(layer.frequency)}-${layer.lpi}`;
        if (processedKeys.has(key)) return;

        const group = assignments.get(key);
        if (group && group.length > 1) {
            // Keep the first layer and merge paths from others
            const primary = group[0];

            // Optimization: Use push with spread to avoid creating intermediate arrays
            // This is faster than repeated concat() for large arrays
            for (let i = 1; i < group.length; i++) {
                if (group[i].paths && group[i].paths.length > 0) {
                    primary.paths.push(...group[i].paths);
                }
            }

            newLayers.push(primary);
            processedKeys.add(key);
        } else {
            newLayers.push(layer);
        }
    });

    state.layers = newLayers;

    // Sync the color slider to reflect the new layer count
    elements.colorSlider.value = state.layers.length;
    elements.colorCountDisplay.textContent = state.layers.length;

    // Defer DOM updates to next frame for smoother UI
    requestAnimationFrame(() => {
        displayLayers();
        displayVectorPreview();
        showToast(`${state.layers.length} layers remaining after merge.`, 'info');
    });
}

/**
 * Find the closest matching color from the calibration entries
 * Uses Euclidean distance in RGB color space
 * @param {Object} targetColor - The color to match {r, g, b}
 * @param {Array} entries - Calibration entries with {color, frequency, lpi}
 * @returns {Object|null} The best matching entry or null
 */
function findClosestCalibrationColor(targetColor, entries) {
    let bestMatch = null;
    let bestDistance = Infinity;

    for (const entry of entries) {
        const entryColor = entry.color;

        // Calculate Euclidean distance in RGB space
        const dr = targetColor.r - entryColor.r;
        const dg = targetColor.g - entryColor.g;
        const db = targetColor.b - entryColor.b;
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);

        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = entry;
        }
    }

    return bestMatch;
}

function openLayerEditModal(layerId) {
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer) return;

    state.editingLayerId = layerId;

    // Check if in SVG mode
    const isVirtual = SettingsStorage.isCurrentDeviceVirtual();

    // Populate inputs
    elements.layerEditName.value = layer.name;
    elements.layerEditFreq.value = layer.frequency !== null ? Math.round(layer.frequency) : '';
    elements.layerEditLpi.value = layer.lpi !== null ? Math.round(layer.lpi) : '';

    // Check if layer has specific speed/power, else fall back to global settings
    const speed = layer.speed !== undefined ? layer.speed : state.settings.speed;
    const power = layer.power !== undefined ? layer.power : state.settings.power;

    elements.layerEditSpeed.value = speed;
    elements.layerEditPower.value = power;

    // Toggle visibility of laser-specific fields
    const laserFields = [
        elements.layerEditFreq?.closest('.setting-row'),
        elements.layerEditLpi?.closest('.setting-row'),
        elements.layerEditSpeed?.closest('.setting-row'),
        elements.layerEditPower?.closest('.setting-row')
    ];
    laserFields.forEach(field => {
        if (field) field.style.display = isVirtual ? 'none' : '';
    });

    // Render Color Grid from Calibration (or simple color picker for SVG mode)
    renderLayerColorGrid();

    // Update Modal Title/Description for SVG mode to remove calibration text
    const pickerContainer = elements.layerEditColorGrid?.closest('.setting-group');
    if (pickerContainer) {
        const title = pickerContainer.querySelector('h3');
        const desc = pickerContainer.querySelector('.modal-description');

        if (isVirtual) {
            if (title) title.innerText = 'Pick Layer Color';
            if (desc) desc.innerText = 'Select a color for this vector layer.';
        } else {
            if (title) title.innerText = 'Pick from Calibrated Colors';
            if (desc) desc.innerText = 'Select a color from your test grid to apply its settings.';
        }
    }

    if (elements.layerEditSourcePreview) elements.layerEditSourcePreview.style.display = 'none';

    openModal(elements.layerEditModal);

    // Onboarding action: Edit Modal Opened
    if (window.onboarding) window.onboarding.handleAction('edit-modal-open');
}

function renderLayerColorGrid() {
    const grid = elements.layerEditColorGrid;
    grid.innerHTML = '';

    // Reset grid display style (in case it was overridden by SVG mode)
    grid.style.display = '';

    // Check if in SVG mode - show simple color picker instead of calibration grid
    const isVirtual = SettingsStorage.isCurrentDeviceVirtual();
    if (isVirtual) {
        renderSimpleColorPicker(grid);
        return;
    }

    const colorMap = SettingsStorage.loadColorMap();
    let entries = [];

    // Always add Black and White as standard colors
    // Unified Palette Logic
    // Group colors by source map for better visualization

    // Always add Black and White as standard colors
    // Standard colors from settings
    const s = state.settings;
    if (!s) return;

    const standardColors = [
        {
            color: { r: 0, g: 0, b: 0 },
            frequency: s.blackFreq,
            lpi: s.blackLpi,
            speed: s.blackSpeed,
            power: s.blackPower,
            name: 'Standard Black'
        },
        {
            color: { r: 255, g: 255, b: 255 },
            frequency: s.whiteFreq,
            lpi: s.whiteLpi,
            speed: s.whiteSpeed,
            power: s.whitePower,
            name: 'Standard White'
        }
    ];

    if (colorMap && colorMap.entries && colorMap.entries.length > 0) {
        entries = [...standardColors, ...colorMap.entries];
    } else {
        entries = [...standardColors];
        // If no calibration, we still show standard colors, but maybe warn if user wants more
        if (!colorMap) {
            const warning = document.createElement('div');
            warning.style.gridColumn = '1 / -1';
            warning.style.fontSize = '0.8rem';
            warning.style.color = '#888';
            warning.style.marginBottom = '5px';
            warning.innerText = 'No active calibration maps found.';
            grid.appendChild(warning);
        }
    }

    // Helper to separate groups
    let lastSource = null;
    let groupContainer = null;

    // We treat standard colors as one group
    // Then mapped colors as others

    // Optimization: Render a simple list of cells, but maybe add headers if we have multiple maps
    // But CSS Grid layout makes headers tricky unless we flatten differently.
    // Let's stick to tooltip info for now, but maybe add a visual break?

    entries.forEach(entry => {
        const { color, frequency, lpi, _sourceMap } = entry;
        const div = document.createElement('div');
        div.className = 'color-cell';
        div.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;

        let title = `R:${color.r} G:${color.g} B:${color.b}\nFreq: ${frequency}kHz, LPC: ${lpi}`;
        if (_sourceMap) title += `\nSource: ${_sourceMap}`;

        div.title = title;

        // Visual indicator for standard colors
        if (entry.name && entry.name.startsWith('Standard')) {
            div.style.border = '2px solid #666';
        }

        // Add click listener to apply settings
        div.addEventListener('click', () => {
            elements.layerEditFreq.value = frequency;
            elements.layerEditLpi.value = lpi;

            // Apply speed/power if present (Standard Colors or advanced map data)
            // If checking a calibrated map that doesn't have speed/power, we might want to keep current or use defaults?
            // For now, if present in entry, use it.
            if (entry.speed) elements.layerEditSpeed.value = entry.speed;
            if (entry.power) elements.layerEditPower.value = entry.power;

            // Visual feedback
            Array.from(grid.children).forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');

            // Temporarily store the selected color to be applied on save
            state.pendingLayerColor = color;
            // Also store the options to apply
            state.pendingLayerOptions = { speed: entry.speed, power: entry.power };

            // Store source mapping for the layer save action
            state.pendingLayerSource = {
                sourceMapId: entry._sourceMapId,
                gridPos: entry.gridPos
            };

            // Show source preview in modal
            if (entry._gridImage && entry.gridPos) {
                elements.layerEditSourcePreview.style.display = 'flex';
                drawSourceHighlightOnCanvas(elements.layerEditSourceCanvas, entry._gridImage, entry.gridPos, entry._numCols, entry._numRows);
            } else {
                elements.layerEditSourcePreview.style.display = 'none';
            }

            // Onboarding action: Color Picked from Grid
            if (window.onboarding) window.onboarding.handleAction('color-picked');
        });

        grid.appendChild(div);
    });
}

/**
 * Render a simple color picker for SVG mode (no laser calibration needed)
 * Shows an HTML5 color picker plus a palette of common colors
 */
function renderSimpleColorPicker(container) {
    // Override grid display to block to prevent grid column constraints squashing the UI
    container.style.display = 'block';

    // Get current layer color
    const layer = state.layers.find(l => l.id === state.editingLayerId);
    const currentColor = layer?.color || { r: 128, g: 128, b: 128 };
    const hexColor = rgbToHex(currentColor.r, currentColor.g, currentColor.b);

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 15px; align-items: center;';

    // HTML5 Color Picker
    const pickerRow = document.createElement('div');
    pickerRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const label = document.createElement('label');
    label.textContent = 'Custom Color:';
    label.style.fontWeight = '500';

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = hexColor;
    picker.style.cssText = 'width: 60px; height: 40px; cursor: pointer; border: none; padding: 0;';

    picker.addEventListener('input', (e) => {
        const hex = e.target.value;
        const rgb = hexToRgb(hex);
        state.pendingLayerColor = rgb;
        // Update visual selection
        container.querySelectorAll('.color-cell').forEach(c => c.classList.remove('selected'));
    });

    pickerRow.appendChild(label);
    pickerRow.appendChild(picker);
    wrapper.appendChild(pickerRow);

    // Preset Palette
    const paletteLabel = document.createElement('div');
    paletteLabel.textContent = 'Or choose from palette:';
    paletteLabel.style.cssText = 'font-size: 0.9em; color: #666; margin-top: 5px;';
    wrapper.appendChild(paletteLabel);

    const palette = document.createElement('div');
    palette.style.cssText = 'display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px;';

    // Common colors palette
    const presetColors = [
        '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
        '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
        '#008000', '#000080', '#800000', '#008080', '#808000',
        '#C0C0C0', '#808080', '#404040', '#FF6B6B', '#4ECDC4',
        '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#74B9FF',
        '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00B894'
    ];

    presetColors.forEach(hex => {
        const cell = document.createElement('div');
        cell.className = 'color-cell';
        cell.style.cssText = `background-color: ${hex}; width: 30px; height: 30px; border-radius: 4px; cursor: pointer; border: 1px solid #ccc;`;
        cell.title = hex;

        cell.addEventListener('click', () => {
            const rgb = hexToRgb(hex);
            state.pendingLayerColor = rgb;
            picker.value = hex;
            // Visual feedback
            container.querySelectorAll('.color-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
        });

        palette.appendChild(cell);
    });

    wrapper.appendChild(palette);
    container.appendChild(wrapper);
}

/**
 * Convert RGB to Hex color string
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Convert Hex color string to RGB object
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 128, g: 128, b: 128 };
}

function saveLayerEdit() {
    if (!state.editingLayerId) return;

    const layer = state.layers.find(l => l.id === state.editingLayerId);
    if (layer) {
        layer.name = elements.layerEditName.value;
        layer.frequency = parseFloat(elements.layerEditFreq.value);
        layer.lpi = parseFloat(elements.layerEditLpi.value);

        // Save Speed and Power if valid
        const speed = parseInt(elements.layerEditSpeed.value);
        if (!isNaN(speed)) layer.speed = speed;

        const power = parseInt(elements.layerEditPower.value);
        if (!isNaN(power)) layer.power = power;

        // If a color was selected from the grid
        if (state.pendingLayerColor) {
            layer.color = { ...state.pendingLayerColor };

            if (state.pendingLayerSource) {
                layer.sourceMapId = state.pendingLayerSource.sourceMapId;
                layer.sourceGridPos = state.pendingLayerSource.gridPos;
                state.pendingLayerSource = null;
            } else {
                // If picked a standard color or cleared the source
                layer.sourceMapId = null;
                layer.sourceGridPos = null;
            }

            state.pendingLayerColor = null; // Reset
            state.pendingLayerOptions = null;
        }

        displayLayers();
        displayVectorPreview(); // Refresh vector preview as color might have changed
        showToast('Layer updated successfully', 'success');
    }

    closeModal(elements.layerEditModal);
    state.editingLayerId = null;

    // Onboarding action: Saved edit (Trigger AFTER closing modal)
    if (window.onboarding) window.onboarding.handleAction('save-edit');
}

// ===================================
// Preview
// ===================================
function setupPreview() {
    elements.previewTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchPreviewTab(tabName);
        });
    });
}

function switchPreviewTab(tabName) {
    elements.previewTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    elements.previewQuantized.style.display = tabName === 'quantized' ? 'block' : 'none';
    elements.previewVectors.style.display = tabName === 'vectors' ? 'block' : 'none';
}

// ===================================
// Export
// ===================================
function setupExport() {
    elements.btnDownloadXCS.addEventListener('click', downloadXCS);
}

/**
 * Generate and download XCS in one click
 * Combined for faster workflow since generation is now very fast
 */
async function downloadXCS() {
    // Check if we're in SVG export mode
    if (SettingsStorage.isCurrentDeviceVirtual()) {
        return downloadSVG();
    }

    if (state.layers.length === 0) {
        showToast('Please process an image first', 'error');
        return;
    }

    // Check if any visible layer is missing settings
    const unassignedLayers = state.layers.filter(l => l.visible && (l.frequency === null || l.lpi === null));
    if (unassignedLayers.length > 0) {
        showToast(`${unassignedLayers.length} layers have no color/settings assigned! Use "Auto Assign" or click the squares to pick colors manually.`, 'error');
        return;
    }

    const btn = elements.btnDownloadXCS;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Generating...';

    try {
        // Generate XCS
        const generator = new XCSGenerator(state.settings);
        const xcsContent = generator.generate(state.processedImage, state.layers, getOutputSize());

        // Download immediately
        const blob = new Blob([xcsContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `engraving_${Date.now()}.xcs`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('XCS file downloaded!', 'success');

        // Complete Onboarding if active
        if (window.onboarding) window.onboarding.handleAction('download');
    } catch (error) {
        console.error('XCS generation error:', error);
        showToast('Error generating XCS: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Generate and download SVG file (for virtual/SVG export mode)
 * Produces a clean SVG with colored layers, no laser settings required
 */
async function downloadSVG() {
    if (state.vectorizedLayers.length === 0) {
        showToast('Please process an image first', 'error');
        return;
    }

    const btn = elements.btnDownloadXCS;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Generating SVG...';

    try {
        const outputSize = getOutputSize();
        const width = outputSize.width;
        const height = outputSize.height;

        // Build SVG content
        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by Picture Engraver - lasertools.org -->
<!-- Date: ${new Date().toISOString()} -->
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${width}mm" 
     height="${height}mm" 
     viewBox="0 0 ${width} ${height}">
`;

        // Add each visible layer
        state.vectorizedLayers.forEach((layer, index) => {
            const layerState = state.layers[index];
            // Check visibility from state.layers (UI state), not vectorized layer
            if (layerState && !layerState.visible) return;
            const color = layerState?.color || layer.color;
            const colorStr = `rgb(${color.r}, ${color.g}, ${color.b})`;
            const layerName = layerState?.name || `Layer ${index + 1}`;

            svgContent += `  <!-- ${layerName} -->\n`;
            svgContent += `  <g id="layer-${index}" fill="${colorStr}" stroke="none">\n`;

            layer.paths.forEach(pathD => {
                svgContent += `    <path d="${pathD}"/>\n`;
            });

            svgContent += `  </g>\n`;
        });

        svgContent += '</svg>';

        // Download
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vector_${Date.now()}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('SVG file downloaded!', 'success');

        // Complete Onboarding if active
        if (window.onboarding) window.onboarding.handleAction('download');
    } catch (error) {
        console.error('SVG generation error:', error);
        showToast('Error generating SVG: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ===================================
// Modals
// ===================================
function setupModals() {
    // Settings modal
    elements.btnSettings.addEventListener('click', () => openModal(elements.settingsModal));
    elements.closeSettingsModal.addEventListener('click', () => closeModal(elements.settingsModal));
    elements.btnSaveSettings.addEventListener('click', saveSettings);
    elements.btnResetSettings.addEventListener('click', resetSettings);

    // Test grid modal
    elements.btnTestGrid.addEventListener('click', () => {
        openModal(elements.testGridModal);

        // Show Test Grid Info if needed
        if (window.onboarding && !window.onboarding.hasCompletedTestGridTour()) {
            setTimeout(() => window.onboarding.showTestGridInfoModal(), 500);
        }
    });
    elements.closeTestGridModal.addEventListener('click', () => closeModal(elements.testGridModal));

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closeModal(backdrop.closest('.modal'));
        });
    });

    // Layer Edit Modal
    elements.closeLayerEditModal.addEventListener('click', () => closeModal(elements.layerEditModal));
    elements.btnCancelLayerEdit.addEventListener('click', () => closeModal(elements.layerEditModal));
    elements.btnSaveLayerEdit.addEventListener('click', saveLayerEdit);
}

function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function applySettingsToUI() {
    const s = state.settings;
    elements.settingPower.value = s.power;
    elements.settingSpeed.value = s.speed;
    elements.settingPasses.value = s.passes;
    elements.settingCrossHatch.checked = s.crossHatch;
    elements.settingFreqMin.value = s.freqMin;
    elements.settingFreqMax.value = s.freqMax;
    elements.settingLpiMin.value = s.lpiMin;
    elements.settingLpiMax.value = s.lpiMax;

    // Separation Logic: Pulse Width
    const isMopa = s.activeDevice === 'f2_ultra_mopa' || s.activeDevice === 'f2_ultra_base'; // Support legacy
    if (elements.rowPulseWidth) {
        elements.rowPulseWidth.style.display = isMopa ? 'flex' : 'none';
        if (isMopa) {
            elements.settingPulseWidth.value = s.pulseWidth || 80;
        }
    }

    // Standard Colors (Black & White)
    document.getElementById('settingBlackFreq').value = s.blackFreq;
    document.getElementById('settingBlackLpi').value = s.blackLpi;
    document.getElementById('settingBlackSpeed').value = s.blackSpeed;
    document.getElementById('settingBlackPower').value = s.blackPower;

    document.getElementById('settingWhiteFreq').value = s.whiteFreq;
    document.getElementById('settingWhiteLpi').value = s.whiteLpi;
    document.getElementById('settingWhiteSpeed').value = s.whiteSpeed;
    document.getElementById('settingWhitePower').value = s.whitePower;
}

function saveSettings() {
    state.settings = {
        ...state.settings,
        power: parseInt(elements.settingPower.value),
        speed: parseInt(elements.settingSpeed.value),
        passes: parseInt(elements.settingPasses.value),
        crossHatch: elements.settingCrossHatch.checked,
        pulseWidth: parseInt(elements.settingPulseWidth ? elements.settingPulseWidth.value : 80),
        freqMin: parseInt(elements.settingFreqMin.value),
        freqMax: parseInt(elements.settingFreqMax.value),
        lpiMin: parseInt(elements.settingLpiMin.value),
        lpiMax: parseInt(elements.settingLpiMax.value),

        // Standard Colors
        blackFreq: parseInt(document.getElementById('settingBlackFreq').value),
        blackLpi: parseInt(document.getElementById('settingBlackLpi').value),
        blackSpeed: parseInt(document.getElementById('settingBlackSpeed').value),
        blackPower: parseInt(document.getElementById('settingBlackPower').value),

        whiteFreq: parseInt(document.getElementById('settingWhiteFreq').value),
        whiteLpi: parseInt(document.getElementById('settingWhiteLpi').value),
        whiteSpeed: parseInt(document.getElementById('settingWhiteSpeed').value),
        whitePower: parseInt(document.getElementById('settingWhitePower').value)
    };

    SettingsStorage.save(state.settings);
    closeModal(elements.settingsModal);
    showToast('Settings saved!', 'success');
}

function resetSettings() {
    state.settings = SettingsStorage.getDefaults();
    applySettingsToUI();
    showToast('Settings reset to defaults', 'success');
}

// ===================================
// Color Grids Management
// ===================================

/**
 * Render the color grids list in settings
 */
function renderColorGridsList() {
    if (!elements.colorGridsList) return;

    const maps = SettingsStorage.getColorMaps();
    const stats = multiGridPalette.getStats();

    // Update stats summary
    if (elements.gridStatsText) {
        if (stats.gridCount > 0) {
            elements.gridStatsText.innerHTML = `
                <strong>${stats.uniqueColors}</strong> unique colors from 
                <strong>${stats.gridCount}</strong> grid${stats.gridCount !== 1 ? 's' : ''}
                ${stats.duplicatesRemoved > 0 ? ` · <span style="color: var(--accent-success);">${stats.duplicatesRemoved} merged</span>` : ''}
            `;
        } else {
            elements.gridStatsText.textContent = 'No grids loaded. Analyze a test grid to add colors.';
        }
    }

    // Render grid list
    if (maps.length === 0) {
        elements.colorGridsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No color grids saved yet. Use the <strong>Test Grid</strong> tool to create one.
            </div>
        `;
        return;
    }

    elements.colorGridsList.innerHTML = maps.map(map => {
        const colorCount = map.data?.entries?.length || 0;
        const isSystem = map.isSystem || map.name?.includes('System') || map.name?.includes('Default');

        return `
            <div class="color-grid-item ${isSystem ? 'system-grid' : ''}" data-grid-id="${map.id}">
                <input type="checkbox" class="grid-select-checkbox" data-grid-id="${map.id}" title="Select for export">
                <label class="color-grid-toggle">
                    <input type="checkbox" class="grid-active-toggle" ${map.active ? 'checked' : ''} data-grid-id="${map.id}" title="Toggle active for Auto-Assign">
                    <span class="slider"></span>
                </label>
                <div class="color-grid-info">
                    <div class="color-grid-name">${map.name}</div>
                    <div class="color-grid-meta">
                        ${colorCount} colors${isSystem ? ' · System' : ''}
                    </div>
                </div>
                <div class="color-grid-actions">
                    <button class="btn-grid-action" data-action="export" data-grid-id="${map.id}" title="Export this grid">📤</button>
                    ${!isSystem ? `<button class="btn-grid-action danger" data-action="delete" data-grid-id="${map.id}" title="Delete grid">🗑️</button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add active toggle listeners
    elements.colorGridsList.querySelectorAll('.grid-active-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const gridId = e.target.dataset.gridId;
            const isActive = e.target.checked;

            // Update in storage
            const maps = SettingsStorage.getColorMaps();
            const map = maps.find(m => m.id === gridId);
            if (map) {
                map.active = isActive;
                SettingsStorage.saveColorMaps(maps);

                // Reinitialize multi-grid palette
                await initializeMultiGridPalette(SettingsStorage);
                renderColorGridsList();

                showToast(`Grid "${map.name}" ${isActive ? 'enabled' : 'disabled'}`, 'success');
            }
        });
    });

    // Add individual export button listeners
    elements.colorGridsList.querySelectorAll('[data-action="export"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gridId = e.target.dataset.gridId;
            const maps = SettingsStorage.getColorMaps();
            const map = maps.find(m => m.id === gridId);

            if (map) {
                exportGrids([map]);
            }
        });
    });

    // Add delete listeners
    elements.colorGridsList.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const gridId = e.target.dataset.gridId;
            const maps = SettingsStorage.getColorMaps();
            const map = maps.find(m => m.id === gridId);

            if (map && confirm(`Delete grid "${map.name}"? This cannot be undone.`)) {
                SettingsStorage.deleteColorMap(gridId);
                await initializeMultiGridPalette(SettingsStorage);
                renderColorGridsList();
                showToast(`Grid "${map.name}" deleted`, 'success');
            }
        });
    });
}

/**
 * Export grids to JSON file
 * @param {Array} grids - Array of grid objects to export
 */
function exportGrids(grids) {
    if (!grids || grids.length === 0) {
        showToast('No grids to export', 'warning');
        return;
    }

    const exportData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        grids: grids
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = grids.length === 1
        ? `${grids[0].name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
        : `color-grids-${new Date().toISOString().slice(0, 10)}.json`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${grids.length} grid(s)`, 'success');
}


/**
 * Setup color grids management event listeners
 */
function setupColorGridsManagement() {
    // Export grids button - exports selected or all
    if (elements.btnExportGrids) {
        elements.btnExportGrids.addEventListener('click', () => {
            // Get selected grids from checkboxes
            const selectedIds = [];
            document.querySelectorAll('.grid-select-checkbox:checked').forEach(cb => {
                selectedIds.push(cb.dataset.gridId);
            });

            const allMaps = SettingsStorage.getColorMaps();

            // If none selected, export all
            const gridsToExport = selectedIds.length > 0
                ? allMaps.filter(m => selectedIds.includes(m.id))
                : allMaps;

            exportGrids(gridsToExport);
        });
    }

    // Import grids button
    if (elements.btnImportGrids && elements.gridImportFileInput) {
        elements.btnImportGrids.addEventListener('click', () => {
            elements.gridImportFileInput.click();
        });

        elements.gridImportFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate format
                if (!data.grids || !Array.isArray(data.grids)) {
                    throw new Error('Invalid grid file format');
                }

                // Import grids
                let imported = 0;
                for (const grid of data.grids) {
                    if (grid.id && grid.data) {
                        // Check if grid already exists
                        const existing = SettingsStorage.getColorMaps().find(m => m.id === grid.id);
                        if (!existing) {
                            SettingsStorage.saveColorMap(grid);
                            imported++;
                        }
                    }
                }

                // Reinitialize palette
                await initializeMultiGridPalette(SettingsStorage);
                renderColorGridsList();

                showToast(`Imported ${imported} new grid(s)`, 'success');
            } catch (err) {
                console.error('Import failed:', err);
                showToast('Failed to import grids: ' + err.message, 'error');
            }

            // Reset file input
            e.target.value = '';
        });
    }

    // Render grid list when Test Grid modal opens
    if (elements.btnTestGrid) {
        elements.btnTestGrid.addEventListener('click', () => {
            // Delay to allow modal to open
            setTimeout(renderColorGridsList, 100);
        });
    }

    // Also render when Analyzer tab is clicked
    const analyzerTab = document.querySelector('[data-modal-tab="analyzer"]');
    if (analyzerTab) {
        analyzerTab.addEventListener('click', () => {
            setTimeout(renderColorGridsList, 100);
        });
    }
}

// ===================================
// Test Grid
// ===================================

let activeGridGenerator = null;

function setupTestGrid() {
    // Generator Tab Controls (Custom)
    const generatorInputs = [
        'gridFreqMin', 'gridFreqMax', 'gridLpiMin', 'gridLpiMax',
        'gridCellSize', 'gridCellGap', 'gridPower', 'gridSpeed',
        'gridPasses', 'gridCrossHatch', 'gridFillGaps'
    ];

    // Add event listeners for live preview update
    generatorInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateGridPreview);
        if (id === 'gridCellSize' && el) {
            el.addEventListener('input', (e) => {
                let val = parseInt(e.target.value);
                if (val < 1) e.target.value = 1;
                if (val > 10) e.target.value = 10;
            });
        }
        if (id === 'gridCellGap' && el) {
            el.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                if (val < 0) e.target.value = 0;
                if (val > 5) e.target.value = 5;
            });
        }
    });



    // Buttons
    document.getElementById('btnPreviewGrid').addEventListener('click', updateGridPreview);
    document.getElementById('btnGenerateGrid').addEventListener('click', generateCustomGridXCS);

    // Standard Grid Button
    const btnStd = document.getElementById('btnGenerateStandard');
    if (btnStd) {
        btnStd.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent # navigation
            generateStandardGridXCS();
        });
    }

    // Modal Tabs
    const tabs = document.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetId = e.target.dataset.modalTab;

            // Toggle tabs
            tabs.forEach(t => t.classList.toggle('active', t === e.target));

            // Toggle content
            document.querySelectorAll('.modal-tab-content').forEach(c => {
                c.classList.toggle('active', c.id === `tab${targetId.charAt(0).toUpperCase() + targetId.slice(1)}`);
            });

            if (targetId === 'custom') {
                updateGridPreview();
            } else if (targetId === 'standard') {
                updateStandardPreview();
            }
        });
    });

    // Analyzer Drop Zone
    const dropZone = document.getElementById('analyzerDropZone');
    const fileInput = document.getElementById('analyzerFileInput');

    // ... Dropzone listeners are in next block (I'll keep them) ...
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleAnalyzerFile(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleAnalyzerFile(e.dataTransfer.files[0]);
    });
    // Fallback button
    document.getElementById('btnUseDefaultGrid').addEventListener('click', useDefaultGridSettings);

    // Save Color Map button
    const btnSaveColorMap = document.getElementById('btnSaveColorMap');
    if (btnSaveColorMap) {
        btnSaveColorMap.addEventListener('click', saveColorMap);
    }

    // Initialize preview
    updateStandardPreview();
}

function setupAnalyzer() {
    // Small canvas is preview-only - click to open fullscreen alignment
    const canvas = document.getElementById('analyzerCanvas');
    canvas.addEventListener('click', openFullscreenAlignment);

    // Fullscreen alignment modal events
    const alignCanvas = document.getElementById('alignmentCanvas');
    if (alignCanvas) {
        alignCanvas.addEventListener('click', handleAlignmentCanvasClick);
        alignCanvas.addEventListener('mousedown', handleAlignmentCanvasMouseDown);
        alignCanvas.addEventListener('mousemove', handleAlignmentCanvasMouseMove);
        alignCanvas.addEventListener('mouseup', handleAlignmentCanvasMouseUp);
        alignCanvas.addEventListener('mouseleave', handleAlignmentCanvasMouseUp);
    }

    // Keyboard events for corner adjustment
    document.addEventListener('keydown', handleAlignmentKeyDown);

    // Alignment modal buttons
    const btnReset = document.getElementById('btnResetCorners');
    if (btnReset) btnReset.addEventListener('click', resetAlignmentCorners);

    const btnApply = document.getElementById('btnApplyAlignment');
    if (btnApply) btnApply.addEventListener('click', applyAlignmentAndClose);

    const btnClose = document.getElementById('btnCloseAlignment');
    if (btnClose) btnClose.addEventListener('click', closeAlignmentModal);

    // Clear Button
    const btnClear = document.getElementById('btnClearAnalyzer');
    if (btnClear) btnClear.addEventListener('click', resetAnalyzer);

    // Rotate Button
    const btnRotate = document.getElementById('btnRotateAnalyzer');
    if (btnRotate) btnRotate.addEventListener('click', rotateAnalyzerImage);

    // Manual Settings
    const btnToggle = document.getElementById('btnToggleManualSettings');
    if (btnToggle) btnToggle.addEventListener('click', toggleManualSettings);

    const btnApplyManual = document.getElementById('btnApplyManualSettings');
    if (btnApplyManual) btnApplyManual.addEventListener('click', applyManualSettings);
}

/**
 * Open fullscreen alignment modal
 */
function openFullscreenAlignment() {
    const img = analyzerState.originalImg;
    if (!img) {
        showToast('Please upload an image first', 'warning');
        return;
    }

    const modal = document.getElementById('alignmentModal');
    const canvas = document.getElementById('alignmentCanvas');
    if (!modal || !canvas) return;

    // Size canvas to fit screen while maintaining aspect ratio
    const maxWidth = window.innerWidth - 80;
    const maxHeight = window.innerHeight - 180;
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);

    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    // Store scale for coordinate conversion
    analyzerState.alignmentScale = scale;

    // Draw image
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw existing corners if any
    if (analyzerState.corners.length > 0) {
        drawAlignmentUI();
    }

    // Show modal
    modal.style.display = 'flex';

    // Update status
    updateAlignmentStatus();

    // Focus canvas for keyboard events
    canvas.focus();
    canvas.setAttribute('tabindex', '0');
}

/**
 * Close fullscreen alignment modal
 */
function closeAlignmentModal() {
    const modal = document.getElementById('alignmentModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Reset corners in alignment modal
 */
function resetAlignmentCorners() {
    analyzerState.corners = [];
    analyzerState.selectedCornerIndex = null;
    drawAlignmentUI();
    updateAlignmentStatus();
    showToast('Corners reset. Click the 4 corners of the color grid.', 'info');
}

/**
 * Apply alignment and close modal
 */
function applyAlignmentAndClose() {
    if (analyzerState.corners.length !== 4) {
        showToast('Please place all 4 corners first.', 'warning');
        return;
    }

    // Scale corners back to small canvas coordinates
    const smallCanvas = document.getElementById('analyzerCanvas');
    const scale = analyzerState.alignmentScale || 1;
    const smallScale = smallCanvas.width / analyzerState.originalImg.width;

    // Convert corners from alignment canvas to small canvas coordinates
    analyzerState.corners = analyzerState.corners.map(c => ({
        x: (c.x / scale) * smallScale,
        y: (c.y / scale) * smallScale
    }));

    // Update small canvas display
    drawAnalyzerUI();

    // Extract colors
    updateExtractedColors();

    // Hide click overlay or update to show "re-align" option
    const overlay = document.getElementById('analyzerClickOverlay');
    if (overlay) {
        overlay.innerHTML = `
            <div style="text-align: center; color: #fff;">
                <div style="font-size: 24px; margin-bottom: 8px;">✅</div>
                <div style="font-size: 12px; font-weight: 500;">Aligned</div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">Click to re-adjust</div>
            </div>
        `;
        overlay.style.background = 'rgba(0,0,0,0.3)';
    }

    // Close modal
    closeAlignmentModal();

    showToast('Grid aligned! Opening color editor...', 'success');

    // Auto-open advanced analyzer
    setTimeout(() => {
        openAdvancedAnalyzer();
    }, 300);
}

/**
 * Update alignment status text and button visibility
 */
function updateAlignmentStatus() {
    const status = document.getElementById('alignmentStatus');
    const footer = document.getElementById('alignmentFooter');
    const btnApply = document.getElementById('btnApplyAlignment');
    const cornerLabel = document.getElementById('selectedCornerLabel');

    const count = analyzerState.corners.length;

    if (count < 4) {
        status.textContent = `Click corner ${count + 1} of 4 on the COLOR GRID`;
        status.style.color = '#ffd700';
        if (footer) footer.style.display = 'none';
        if (btnApply) btnApply.style.display = 'none';
    } else {
        status.textContent = '✅ All corners placed! Click a corner to adjust, or Apply to finish.';
        status.style.color = '#4ade80';
        if (footer) footer.style.display = 'block';
        if (btnApply) btnApply.style.display = 'inline-flex';
    }

    if (cornerLabel) {
        cornerLabel.textContent = analyzerState.selectedCornerIndex !== null
            ? ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'][analyzerState.selectedCornerIndex]
            : '-';
    }
}

/**
 * Handle click on alignment canvas
 */
function handleAlignmentCanvasClick(e) {
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.target.height;

    // If we have 4 corners, check if clicking on a corner to select it
    if (analyzerState.corners.length === 4) {
        const clickRadius = 20; // Larger radius for easier selection
        for (let i = 0; i < analyzerState.corners.length; i++) {
            const corner = analyzerState.corners[i];
            const dist = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
            if (dist < clickRadius) {
                analyzerState.selectedCornerIndex = i;
                drawAlignmentUI();
                updateAlignmentStatus();
                return;
            }
        }

        // Clicked away from corners - deselect
        if (analyzerState.selectedCornerIndex !== null) {
            analyzerState.selectedCornerIndex = null;
            drawAlignmentUI();
            updateAlignmentStatus();
        }
        return;
    }

    // Add new corner
    analyzerState.corners.push({ x, y });

    if (analyzerState.corners.length === 4) {
        // Sort corners into correct order
        sortCornersToQuadrilateral();
        analyzerState.selectedCornerIndex = null;

        // Auto-apply manual settings if grid settings are missing (e.g. QR failed)
        if (!analyzerState.numCols || analyzerState.numCols === 0) {
            applyManualSettings();
        }
    } else {
        analyzerState.selectedCornerIndex = analyzerState.corners.length - 1;
    }

    drawAlignmentUI();
    updateAlignmentStatus();
}

/**
 * Handle mouse down for dragging corners
 */
function handleAlignmentCanvasMouseDown(e) {
    if (analyzerState.corners.length !== 4) return;

    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.target.height;

    const clickRadius = 20;
    for (let i = 0; i < analyzerState.corners.length; i++) {
        const corner = analyzerState.corners[i];
        const dist = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
        if (dist < clickRadius) {
            analyzerState.selectedCornerIndex = i;
            analyzerState.isDraggingCorner = true;
            e.target.style.cursor = 'grabbing';
            drawAlignmentUI();
            updateAlignmentStatus();
            return;
        }
    }
}

/**
 * Handle mouse move for dragging corners
 */
function handleAlignmentCanvasMouseMove(e) {
    if (!analyzerState.isDraggingCorner || analyzerState.selectedCornerIndex === null) return;

    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.target.height;

    analyzerState.corners[analyzerState.selectedCornerIndex] = { x, y };
    drawAlignmentUI();
}

/**
 * Handle mouse up for dragging corners
 */
function handleAlignmentCanvasMouseUp(e) {
    if (analyzerState.isDraggingCorner) {
        analyzerState.isDraggingCorner = false;
        e.target.style.cursor = 'crosshair';
    }
}

/**
 * Handle keyboard events in alignment modal
 */
function handleAlignmentKeyDown(e) {
    const modal = document.getElementById('alignmentModal');
    if (!modal || modal.style.display !== 'flex') return;

    // Escape to close
    if (e.key === 'Escape') {
        if (analyzerState.selectedCornerIndex !== null) {
            analyzerState.selectedCornerIndex = null;
            drawAlignmentUI();
            updateAlignmentStatus();
        } else {
            closeAlignmentModal();
        }
        e.preventDefault();
        return;
    }

    // Enter to apply
    if (e.key === 'Enter' && analyzerState.corners.length === 4) {
        applyAlignmentAndClose();
        e.preventDefault();
        return;
    }

    // Arrow keys to move selected corner
    if (analyzerState.selectedCornerIndex === null || analyzerState.corners.length !== 4) return;

    const step = e.shiftKey ? 10 : 2; // Larger steps for fullscreen
    const corner = analyzerState.corners[analyzerState.selectedCornerIndex];

    switch (e.key) {
        case 'ArrowUp':
            corner.y -= step;
            e.preventDefault();
            break;
        case 'ArrowDown':
            corner.y += step;
            e.preventDefault();
            break;
        case 'ArrowLeft':
            corner.x -= step;
            e.preventDefault();
            break;
        case 'ArrowRight':
            corner.x += step;
            e.preventDefault();
            break;
        case 'Tab':
            analyzerState.selectedCornerIndex = (analyzerState.selectedCornerIndex + (e.shiftKey ? 3 : 1)) % 4;
            e.preventDefault();
            break;
        default:
            return;
    }

    drawAlignmentUI();
    updateAlignmentStatus();
}



function resetAnalyzer() {
    analyzerState.corners = [];
    analyzerState.originalImg = null;
    analyzerState.extractedColors = [];
    analyzerState.isActive = false;
    analyzerState.selectedCell = null;
    analyzerState.selectedCornerIndex = null;
    analyzerState.isDraggingCorner = false;

    // Clear canvas
    const canvas = document.getElementById('analyzerCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reset inputs
    document.getElementById('analyzerFileInput').value = '';

    // Hide preview panels
    document.getElementById('analysisPreview').style.display = 'none';
    document.getElementById('analyzerDropZone').style.display = 'block';

    // Hide color map
    document.getElementById('colorMapSection').style.display = 'none';
    document.getElementById('colorMapGrid').innerHTML = '';

    showToast('Analyzer reset', 'info');
}

function rotateAnalyzerImage() {
    if (!analyzerState.originalImg) return;

    const img = analyzerState.originalImg;
    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const newImg = new Image();
    newImg.onload = () => {
        analyzerState.originalImg = newImg;
        analyzerState.corners = []; // Reset corners

        // Update canvas size
        const displayCanvas = document.getElementById('analyzerCanvas');
        displayCanvas.width = newImg.width;
        displayCanvas.height = newImg.height;

        drawAnalyzerUI();
        showToast('Image rotated 90°', 'info');
    };
    newImg.src = canvas.toDataURL();
}

function toggleManualSettings() {
    const panel = document.getElementById('manualSettingsPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function applyManualSettings() {
    const cols = parseInt(document.getElementById('manualCols').value) || 14;
    const rows = parseInt(document.getElementById('manualRows').value) || 9;
    const freqMin = parseInt(document.getElementById('manualFreqMin').value) || 40;
    const freqMax = parseInt(document.getElementById('manualFreqMax').value) || 80;
    const lpiMin = parseInt(document.getElementById('manualLpiMin').value) || 200;
    const lpiMax = parseInt(document.getElementById('manualLpiMax').value) || 300;

    // Update state
    analyzerState.numCols = cols;
    analyzerState.numRows = rows;

    // Generate values
    const generator = new TestGridGenerator({ freqMin, freqMax, lpiMin, lpiMax });
    analyzerState.lpiValues = generator.linspace(lpiMax, lpiMin, cols);
    analyzerState.freqValues = generator.linspace(freqMin, freqMax, rows);

    // Update UI
    const settingsDiv = document.getElementById('analysisSettings');
    settingsDiv.innerHTML = `
        <div class="detected-value"><span>Frequency (Manual)</span> <span>${freqMin}-${freqMax}kHz</span></div>
        <div class="detected-value"><span>LPC (Manual)</span> <span>${lpiMax}-${lpiMin}</span></div>
        <div class="detected-value"><span>Grid Size</span> <span>${cols}×${rows}</span></div>
    `;

    document.getElementById('analyzerFallback').style.display = 'none';

    if (analyzerState.corners.length === 4) {
        showToast('Settings updated! Re-calculating colors...', 'info');
        drawAnalyzerUI();
        updateExtractedColors();
    } else {
        showToast('Manual settings applied! Click the 4 corners of the grid.', 'success');
    }
}

function handleAnalyzerCanvasClick(e) {
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.target.height;

    // If we have 4 corners, check if user clicked near an existing corner to select it
    if (analyzerState.corners.length === 4) {
        const clickRadius = 15; // pixels
        for (let i = 0; i < analyzerState.corners.length; i++) {
            const corner = analyzerState.corners[i];
            const dist = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
            if (dist < clickRadius) {
                // Select this corner for adjustment
                analyzerState.selectedCornerIndex = i;
                drawAnalyzerUI();
                showToast(`Corner ${['TL', 'TR', 'BR', 'BL'][i]} selected. Drag or use arrow keys to adjust.`, 'info');
                return;
            }
        }

        // Clicked away from corners - deselect
        if (analyzerState.selectedCornerIndex !== null) {
            analyzerState.selectedCornerIndex = null;
            drawAnalyzerUI();
            return;
        }

        // Double-click to reset corners
        analyzerState.corners = [];
        analyzerState.selectedCornerIndex = null;
        showToast('Corners reset. Click 4 new corners.', 'info');
    }

    // Add new corner
    analyzerState.corners.push({ x, y });
    analyzerState.selectedCornerIndex = analyzerState.corners.length - 1;
    drawAnalyzerUI();

    if (analyzerState.corners.length === 4) {
        // Sort corners into correct order: TL, TR, BR, BL
        sortCornersToQuadrilateral();
        drawAnalyzerUI();
        showToast('Grid aligned! Click a corner to adjust, or drag to reposition.', 'success');
        updateExtractedColors();
    } else {
        showToast(`Corner ${analyzerState.corners.length}/4 placed. Click the next corner.`, 'info');
    }
}
/**
 * Sort 4 corners into proper quadrilateral order: TL, TR, BR, BL
 * This ensures the grid is never twisted regardless of click order
 */

function sortCornersToQuadrilateral() {
    const corners = analyzerState.corners;
    if (corners.length !== 4) return;

    // Find center point
    const centerX = corners.reduce((sum, p) => sum + p.x, 0) / 4;
    const centerY = corners.reduce((sum, p) => sum + p.y, 0) / 4;

    // Calculate angle from center for each corner
    const withAngles = corners.map(p => ({
        ...p,
        angle: Math.atan2(p.y - centerY, p.x - centerX)
    }));

    // Sort by angle (counter-clockwise from right)
    withAngles.sort((a, b) => a.angle - b.angle);

    // Now we have corners sorted counter-clockwise
    // Find the top-left corner (smallest sum of x+y)
    let minSum = Infinity;
    let tlIndex = 0;
    withAngles.forEach((p, i) => {
        const sum = p.x + p.y;
        if (sum < minSum) {
            minSum = sum;
            tlIndex = i;
        }
    });

    // Rotate array so TL is first, then order is TL, TR, BR, BL (clockwise)
    // Since withAngles is counter-clockwise, we need to reverse after rotation
    const rotated = [];
    for (let i = 0; i < 4; i++) {
        rotated.push(withAngles[(tlIndex + i) % 4]);
    }

    // Check if order is clockwise or counter-clockwise
    // If we're going TL -> next and y increases, it's going down (toward BL), so reverse
    const nextCorner = rotated[1];
    const tlCorner = rotated[0];

    // Determine if next corner is to the right (TR) or below (BL)
    if (nextCorner.x < tlCorner.x || (nextCorner.x === tlCorner.x && nextCorner.y > tlCorner.y)) {
        // Going counter-clockwise (TL -> BL), need to reverse to get TL -> TR -> BR -> BL
        analyzerState.corners = [rotated[0], rotated[3], rotated[2], rotated[1]];
    } else {
        // Already clockwise
        analyzerState.corners = rotated.map(p => ({ x: p.x, y: p.y }));
    }
}

function handleAnalyzerCanvasMouseDown(e) {
    if (analyzerState.corners.length !== 4) return;

    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.target.height;

    // Check if clicking on a corner
    const clickRadius = 15;
    for (let i = 0; i < analyzerState.corners.length; i++) {
        const corner = analyzerState.corners[i];
        const dist = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
        if (dist < clickRadius) {
            analyzerState.selectedCornerIndex = i;
            analyzerState.isDraggingCorner = true;
            e.target.style.cursor = 'grabbing';
            return;
        }
    }
}

function handleAnalyzerCanvasMouseMove(e) {
    if (!analyzerState.isDraggingCorner || analyzerState.selectedCornerIndex === null) return;

    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.target.height;

    // Update corner position
    analyzerState.corners[analyzerState.selectedCornerIndex] = { x, y };
    drawAlignmentUI();
}

function handleAnalyzerCanvasMouseUp(e) {
    if (analyzerState.isDraggingCorner) {
        analyzerState.isDraggingCorner = false;
        e.target.style.cursor = 'crosshair';

        // Recalculate colors after drag
        if (analyzerState.corners.length === 4) {
            updateExtractedColors();
        }
    }
}



/**
 * Draw the alignment UI (corners, grid, centers) on the fullscreen canvas
 */
function drawAlignmentUI() {
    const canvas = document.getElementById('alignmentCanvas');
    const img = analyzerState.originalImg;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');

    // Redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw grid if 4 corners
    if (analyzerState.corners.length === 4) {
        drawAlignmentGrid(ctx, analyzerState.corners, analyzerState.numCols, analyzerState.numRows);

        // Draw centers and sampling points for visual verification
        const corners = analyzerState.corners;
        const cols = analyzerState.numCols;
        const rows = analyzerState.numRows;

        // QR region
        // QR region
        const qrExclusion = calculateQRExclusionZone(cols, rows);
        const qrStartCol = qrExclusion.startCol;
        const qrStartRow = qrExclusion.startRow;

        ctx.fillStyle = '#00d4ff'; // Cyan for centers

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Skip QR region for sampling dots
                if (c >= qrStartCol && r >= qrStartRow) continue;

                // Calculate cell bounds
                const cellTL = interpolateCorner(corners, c / cols, r / rows);
                const cellTR = interpolateCorner(corners, (c + 1) / cols, r / rows);
                const cellBL = interpolateCorner(corners, c / cols, (r + 1) / rows);
                const cellBR = interpolateCorner(corners, (c + 1) / cols, (r + 1) / rows);

                // Find center
                let center = getLineIntersection(cellTL, cellBR, cellTR, cellBL);
                if (!center) {
                    center = {
                        x: (cellTL.x + cellTR.x + cellBL.x + cellBR.x) / 4,
                        y: (cellTL.y + cellTR.y + cellBL.y + cellBR.y) / 4
                    };
                }

                // Draw center dot
                ctx.beginPath();
                ctx.arc(center.x, center.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Draw corners (existing code)
    analyzerState.corners.forEach((p, i) => {
        const isSelected = i === analyzerState.selectedCornerIndex;
        const labels = ['TL', 'TR', 'BR', 'BL'];
        const fullLabels = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];

        // ... (rest of corner drawing remains same) ...
        if (isSelected) {
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#ff3b30';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        const label = isSelected ? fullLabels[i] : labels[i];
        ctx.font = isSelected ? 'bold 16px Inter, sans-serif' : '14px Inter, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const labelX = p.x + 20;
        const labelY = p.y + 5;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(labelX - 4, labelY - 14, textWidth + 8, 20);

        ctx.fillStyle = isSelected ? '#00d4ff' : '#fff';
        ctx.fillText(label, labelX, labelY);
    });
}

function drawAnalyzerUI() {
    const canvas = document.getElementById('analyzerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const img = analyzerState.originalImg;
    if (!img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw grid if 4 corners
    if (analyzerState.corners.length === 4) {
        drawAlignmentGrid(ctx, analyzerState.corners, analyzerState.numCols, analyzerState.numRows);
    }

    // Draw simple corners for preview (without labels/interaction hints)
    analyzerState.corners.forEach((p, i) => {
        ctx.fillStyle = '#ff3b30'; // Red
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
}

function drawAlignmentGrid(ctx, corners, cols, rows) {
    // Draw cell backgrounds for better visibility
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';

    // QR region calculation
    const qrExclusion = calculateQRExclusionZone(cols, rows);
    const qrStartCol = qrExclusion.startCol;
    const qrStartRow = qrExclusion.startRow;

    // Draw each cell with subtle fill
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const t1x = c / cols;
            const t2x = (c + 1) / cols;
            const t1y = r / rows;
            const t2y = (r + 1) / rows;

            const topLeft = interpolate(
                interpolate(corners[0], corners[1], t1x),
                interpolate(corners[3], corners[2], t1x),
                t1y
            );
            const topRight = interpolate(
                interpolate(corners[0], corners[1], t2x),
                interpolate(corners[3], corners[2], t2x),
                t1y
            );
            const bottomRight = interpolate(
                interpolate(corners[0], corners[1], t2x),
                interpolate(corners[3], corners[2], t2x),
                t2y
            );
            const bottomLeft = interpolate(
                interpolate(corners[0], corners[1], t1x),
                interpolate(corners[3], corners[2], t1x),
                t2y
            );

            // Fill QR region with red, others with white
            if (c >= qrStartCol && r >= qrStartRow) {
                ctx.fillStyle = 'rgba(255, 59, 48, 0.3)'; // Red for QR
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; // Subtle white for cells
            }

            ctx.beginPath();
            ctx.moveTo(topLeft.x, topLeft.y);
            ctx.lineTo(topRight.x, topRight.y);
            ctx.lineTo(bottomRight.x, bottomRight.y);
            ctx.lineTo(bottomLeft.x, bottomLeft.y);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Draw horizontal lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;

    for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        const pLeft = interpolate(corners[0], corners[3], t);
        const pRight = interpolate(corners[1], corners[2], t);
        ctx.beginPath();
        ctx.moveTo(pLeft.x, pLeft.y);
        ctx.lineTo(pRight.x, pRight.y);
        ctx.stroke();
    }

    // Draw vertical lines
    for (let c = 0; c <= cols; c++) {
        const t = c / cols;
        const pTop = interpolate(corners[0], corners[1], t);
        const pBottom = interpolate(corners[3], corners[2], t);
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pBottom.x, pBottom.y);
        ctx.stroke();
    }

    // Draw thicker border around QR region
    ctx.strokeStyle = 'rgba(255, 59, 48, 0.9)';
    ctx.lineWidth = 2;

    const qrTL = interpolate(
        interpolate(corners[0], corners[1], qrStartCol / cols),
        interpolate(corners[3], corners[2], qrStartCol / cols),
        qrStartRow / rows
    );
    const qrTR = interpolate(
        interpolate(corners[0], corners[1], 1),
        interpolate(corners[3], corners[2], 1),
        qrStartRow / rows
    );
    const qrBR = interpolate(
        interpolate(corners[0], corners[1], 1),
        interpolate(corners[3], corners[2], 1),
        1
    );
    const qrBL = interpolate(
        interpolate(corners[0], corners[1], qrStartCol / cols),
        interpolate(corners[3], corners[2], qrStartCol / cols),
        1
    );

    ctx.beginPath();
    ctx.moveTo(qrTL.x, qrTL.y);
    ctx.lineTo(qrTR.x, qrTR.y);
    ctx.lineTo(qrBR.x, qrBR.y);
    ctx.lineTo(qrBL.x, qrBL.y);
    ctx.closePath();
    ctx.stroke();

    // Add "QR" label
    const qrCenter = {
        x: (qrTL.x + qrBR.x) / 2,
        y: (qrTL.y + qrBR.y) / 2
    };
    ctx.fillStyle = 'rgba(255, 59, 48, 0.9)';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QR', qrCenter.x, qrCenter.y);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}



function updateExtractedColors() {
    try {
        const { corners, numCols, numRows, qrRegion } = analyzerState;

        if (!corners || corners.length !== 4) {
            return;
        }

        // Use the VISIBLE preview canvas for extraction. 
        // This is much faster, uses less memory, and guarantees coordinate matching.
        const previewCanvas = document.getElementById('analyzerCanvas');
        if (!previewCanvas) return;

        const ctx = previewCanvas.getContext('2d', { willReadFrequently: true });
        const width = previewCanvas.width;
        const height = previewCanvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const colors = [];
        const rgbColors = []; // Store as {r, g, b} objects

        // QR region definition - calculate based on physical dimensions (17mm + 1mm gap)
        // Get cell size and gap from current grid settings or use defaults
        const cellSize = parseFloat(document.getElementById('gridCellSize')?.value) || 5;
        const cellGap = parseFloat(document.getElementById('gridCellGap')?.value) || 1;

        const qrExclusion = calculateQRExclusionZone(numCols, numRows, cellSize, cellGap);
        const qrRegionInfo = qrExclusion;
        const qrStartCol = qrExclusion.startCol;
        const qrStartRow = qrExclusion.startRow;

        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const isQR = c >= qrStartCol && r >= qrStartRow;

                // Calculate cell bounds using corners (which are already in preview canvas coordinates)
                const cellTL = interpolateCorner(corners, c / numCols, r / numRows);
                const cellTR = interpolateCorner(corners, (c + 1) / numCols, r / numRows);
                const cellBL = interpolateCorner(corners, c / numCols, (r + 1) / numRows);
                const cellBR = interpolateCorner(corners, (c + 1) / numCols, (r + 1) / numRows);

                if (isQR) {
                    colors.push('transparent');
                    rgbColors.push({ r: 0, g: 0, b: 0, isQR: true });
                    continue;
                }

                // Find visual center using diagonal intersection
                let center = getLineIntersection(cellTL, cellBR, cellTR, cellBL);

                if (!center) {
                    center = {
                        x: (cellTL.x + cellTR.x + cellBL.x + cellBR.x) / 4,
                        y: (cellTL.y + cellTR.y + cellBL.y + cellBR.y) / 4
                    };
                }

                // Sample 5x5 area around center
                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                const sampleSize = 5;
                const halfSize = Math.floor(sampleSize / 2);

                for (let sy = -halfSize; sy <= halfSize; sy++) {
                    for (let sx = -halfSize; sx <= halfSize; sx++) {
                        const px = Math.floor(center.x + sx);
                        const py = Math.floor(center.y + sy);

                        if (px >= 0 && px < width && py >= 0 && py < height) {
                            const offset = (py * width + px) * 4;
                            rSum += data[offset];
                            gSum += data[offset + 1];
                            bSum += data[offset + 2];
                            count++;
                        }
                    }
                }

                const rf = count > 0 ? Math.round(rSum / count) : 0;
                const gf = count > 0 ? Math.round(gSum / count) : 0;
                const bf = count > 0 ? Math.round(bSum / count) : 0;

                colors.push(`rgb(${rf}, ${gf}, ${bf})`);
                rgbColors.push({ r: rf, g: gf, b: bf, isQR: false });
            }
        }

        analyzerState.extractedColors = rgbColors;
        analyzerState.qrRegion = qrRegionInfo;

        // safe call to draw UI
        if (typeof drawAnalyzerUI === 'function') drawAnalyzerUI();

        if (typeof generateColorMapWithData === 'function') {
            generateColorMapWithData(analyzerState.freqValues, analyzerState.lpiValues, colors);
        }

        const saveSection = document.getElementById('saveColorMapSection');
        if (saveSection) {
            saveSection.style.display = 'block';
        }
    } catch (err) {
        console.error("Error in updateExtractedColors:", err);
    }
}

function _old_updateExtractedColors() {
    const { originalImg, corners, numCols, numRows, qrRegion } = analyzerState;
    if (!originalImg || corners.length !== 4) return;

    // Use a temporary canvas to extract pixel data
    const canvas = document.createElement('canvas');
    canvas.width = originalImg.width;
    canvas.height = originalImg.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImg, 0, 0);

    const colors = [];
    const rgbColors = []; // Store as {r, g, b} objects

    // QR region definition - calculate based on physical dimensions (17mm + 1mm gap)
    // Get cell size and gap from current grid settings or use defaults
    const cellSize = parseFloat(document.getElementById('gridCellSize')?.value) || 5;
    const cellGap = parseFloat(document.getElementById('gridCellGap')?.value) || 1;

    const qrRegionInfo = calculateQRExclusionZone(numCols, numRows, cellSize, cellGap);
    const qrStartCol = qrRegionInfo.startCol;
    const qrStartRow = qrRegionInfo.startRow;

    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            // Check if this is a QR code cell (or in excluded region)
            const isQR = c >= qrStartCol && r >= qrStartRow;

            // Calculate cell bounds
            const cellTL = interpolateCorner(corners, c / numCols, r / numRows);
            const cellTR = interpolateCorner(corners, (c + 1) / numCols, r / numRows);
            const cellBL = interpolateCorner(corners, c / numCols, (r + 1) / numRows);
            const cellBR = interpolateCorner(corners, (c + 1) / numCols, (r + 1) / numRows);

            if (isQR) {
                // QR Cell - Mark as such and skip sampling
                colors.push('transparent');
                rgbColors.push({ r: 0, g: 0, b: 0, isQR: true });
                continue;
            }

            // Find visual center using diagonal intersection (better for perspective)
            let center = getLineIntersection(cellTL, cellBR, cellTR, cellBL);

            // Fallback to average if intersection fails (rare)
            if (!center) {
                center = {
                    x: (cellTL.x + cellTR.x + cellBL.x + cellBR.x) / 4,
                    y: (cellTL.y + cellTR.y + cellBL.y + cellBR.y) / 4
                };
            }

            // Sample 5x5 area
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            const sampleSize = 5;
            const halfSize = Math.floor(sampleSize / 2);

            for (let y = center.y - halfSize; y <= center.y + halfSize; y++) {
                for (let x = center.x - halfSize; x <= center.x + halfSize; x++) {
                    const px = Math.floor(x);
                    const py = Math.floor(y);
                    if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                        const pixel = ctx.getImageData(px, py, 1, 1).data;
                        rSum += pixel[0];
                        gSum += pixel[1];
                        bSum += pixel[2];
                        count++;
                    }
                }
            }

            const r = Math.round(rSum / count);
            const g = Math.round(gSum / count);
            const b = Math.round(bSum / count);

            colors.push(`rgb(${r}, ${g}, ${b})`);
            rgbColors.push({ r, g, b, isQR: false });
        }
    }

    // Update state
    analyzerState.extractedColors = rgbColors;
    analyzerState.qrRegion = qrRegionInfo;

    // Update UI
    drawAnalyzerUI();

    // We don't draw sampling markers on the small preview anymore as it's too cluttered
    // The fullscreen alignment view shows them now

    generateColorMapWithData(analyzerState.freqValues, analyzerState.lpiValues, colors);

    // Show the save button section
    const saveSection = document.getElementById('saveColorMapSection');
    if (saveSection) {
        saveSection.style.display = 'block';
    }
}

/**
 * Draw visible sampling markers on the grid to show where colors are being sampled
 */
function drawSamplingMarkers(ctx, corners, numCols, numRows, qrStartCol, qrStartRow) {
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Skip QR region
            if (col >= qrStartCol && row >= qrStartRow) continue;

            const tx = (col + 0.5) / numCols;
            const ty = (row + 0.5) / numRows;

            const pTop = interpolate(corners[0], corners[1], tx);
            const pBottom = interpolate(corners[3], corners[2], tx);
            const center = interpolate(pTop, pBottom, ty);

            // Draw small green dot at sampling point
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
            ctx.fill();

            // Draw small crosshair
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(center.x - 5, center.y);
            ctx.lineTo(center.x + 5, center.y);
            ctx.moveTo(center.x, center.y - 5);
            ctx.lineTo(center.x, center.y + 5);
            ctx.stroke();
        }
    }

    // Draw X markers on QR region
    for (let row = qrStartRow; row < numRows; row++) {
        for (let col = qrStartCol; col < numCols; col++) {
            const tx = (col + 0.5) / numCols;
            const ty = (row + 0.5) / numRows;

            const pTop = interpolate(corners[0], corners[1], tx);
            const pBottom = interpolate(corners[3], corners[2], tx);
            const center = interpolate(pTop, pBottom, ty);

            // Draw red X to indicate excluded QR region
            ctx.strokeStyle = 'rgba(255, 59, 48, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(center.x - 6, center.y - 6);
            ctx.lineTo(center.x + 6, center.y + 6);
            ctx.moveTo(center.x + 6, center.y - 6);
            ctx.lineTo(center.x - 6, center.y + 6);
            ctx.stroke();
        }
    }
}

function getCustomGridSettings() {
    return {
        freqMin: parseInt(document.getElementById('gridFreqMin').value),
        freqMax: parseInt(document.getElementById('gridFreqMax').value),
        lpiMin: parseInt(document.getElementById('gridLpiMin').value),
        lpiMax: parseInt(document.getElementById('gridLpiMax').value),

        cellSize: Math.max(1, Math.min(10, parseInt(document.getElementById('gridCellSize').value) || 5)),
        cellGap: (() => {
            const val = parseFloat(document.getElementById('gridCellGap').value);
            return Math.max(0, Math.min(5, isNaN(val) ? 1 : val));
        })(),
        power: parseInt(document.getElementById('gridPower').value),
        speed: parseInt(document.getElementById('gridSpeed').value),
        passes: parseInt(document.getElementById('gridPasses').value),
        crossHatch: document.getElementById('gridCrossHatch').checked,
        fillGaps: document.getElementById('gridFillGaps').checked
    };
}

function updateGridPreview() {
    const settings = getCustomGridSettings();
    const gridInfo = drawGridToCanvas('gridPreviewCanvas', settings);

    if (gridInfo) {
        const infoSize = document.getElementById('gridInfoSize');
        if (infoSize) infoSize.textContent = `${gridInfo.numCols} × ${gridInfo.numRows}`;
        const infoCells = document.getElementById('gridInfoCells');
        if (infoCells) infoCells.textContent = gridInfo.totalCells;
    }
}
/*
function unused_updateGridPreview() {
    const settings = getCustomGridSettings();
    activeGridGenerator = new TestGridGenerator(settings);

    // Generate grid data but don't create full XCS yet
    const { gridInfo } = activeGridGenerator.generateBusinessCardGrid();

    // Update Info
    document.getElementById('gridInfoSize').textContent = `${gridInfo.numCols} × ${gridInfo.numRows}`;
    document.getElementById('gridInfoCells').textContent = gridInfo.totalCells;

    // Draw Preview
    const canvas = document.getElementById('gridPreviewCanvas');
    const ctx = canvas.getContext('2d');

    // Scale for preview (card is 85x55mm)
    const scale = 4; // pixels per mm
    canvas.width = gridInfo.width * scale;
    canvas.height = gridInfo.height * scale;

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells (simplified preview)
    const margin = settings.margin || 1;
    const cellSize = settings.cellSize;
    const gap = settings.cellGap;

    const qrExclusion = calculateQRExclusionZone(gridInfo.numCols, gridInfo.numRows, settings.cellSize, settings.cellGap);
    const qrStartCol = qrExclusion.startCol;
    const qrStartRow = qrExclusion.startRow;

    for (let row = 0; row < gridInfo.numRows; row++) {
        for (let col = 0; col < gridInfo.numCols; col++) {
            // QR Hole
            if (col >= qrStartCol && row >= qrStartRow) continue;

            const x = (margin + col * (cellSize + gap)) * scale;
            const y = (margin + row * (cellSize + gap)) * scale;
            const size = cellSize * scale;

            // Color gradient visualization
            // Hue based on LPC (cols), Lightness based on Freq (rows)
            const hue = (col / gridInfo.numCols) * 240;
            const sat = 70;
            const light = 40 + (row / gridInfo.numRows) * 40;

            ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.fillRect(x, y, size, size);
        }
    }

    // QR Placeholder in Preview
    const qrSize = ((qrCells * (cellSize + gap)) - gap) * scale;
    const qrX = (margin + qrStartCol * (cellSize + gap)) * scale;
    const qrY = (margin + qrStartRow * (cellSize + gap)) * scale;

    ctx.fillStyle = '#000';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
}
*/


function getSmartGridFilename(prefix, settings, deviceId) {
    const devLabel = deviceId.includes('mopa') || deviceId.includes('base') ? 'MOPA' : 'UV';
    let name = `${prefix}_F2_${devLabel}`;

    if (devLabel === 'MOPA') {
        name += `_S${settings.speedMin}-${settings.speedMax}_F${settings.freqMin}-${settings.freqMax}`;
    } else {
        const lpiUnit = settings.highLpiMode ? 'LPC' : 'LPC';
        name += `_${lpiUnit}${settings.lpiMin}-${settings.lpiMax}_F${settings.freqMin}-${settings.freqMax}`;
    }
    return name;
}

function generateStandardGridXCS() {
    const currentSettings = SettingsStorage.load();
    const deviceId = currentSettings.activeDevice || 'f2_ultra_uv';
    const isMopa = deviceId.includes('mopa') || deviceId.includes('base');

    const filename = isMopa ? 'default_test_grid_MOPA.xcs' : 'default_test_grid_UV.xcs';
    const encodedFilename = encodeURIComponent(filename);

    const a = document.createElement('a');
    a.href = `/${encodedFilename}`; // Public root
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast(`Downloaded standard grid for ${isMopa ? 'MOPA' : 'UV'}`, 'success');
}

function generateCustomGridXCS() {
    const customSettings = getCustomGridSettings();
    if (!activeGridGenerator) activeGridGenerator = new TestGridGenerator(customSettings);

    // Always regenerate to capture latest settings if reused
    const generator = new TestGridGenerator(customSettings);
    const { xcs } = generator.generateBusinessCardGrid();

    const deviceId = state.settings.activeDevice || 'f2_ultra_uv';
    const filename = getSmartGridFilename('CustomGrid', customSettings, deviceId);

    downloadTestGridXCS(xcs, filename);
}

function drawGridToCanvas(canvasId, settings) {
    const generator = new TestGridGenerator(settings);
    const { gridInfo } = generator.generateBusinessCardGrid();

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    const scale = 4; // pixels per mm
    canvas.width = gridInfo.width * scale;
    canvas.height = gridInfo.height * scale;

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells
    const margin = settings.margin || 1;
    const cellSize = settings.cellSize || 5;

    // Gaps (Use effective gaps if provided, fallback to standard)
    const gapX = gridInfo.gapX !== undefined ? gridInfo.gapX : (settings.cellGap || 1);
    const gapY = gridInfo.gapY !== undefined ? gridInfo.gapY : (settings.cellGap || 1);

    // Calculate Offsets for Centering
    const availableWidth = gridInfo.width - (margin * 2);
    const availableHeight = gridInfo.height - (margin * 2);

    // Effective Grid Size
    // If not provided in gridInfo, recalculate roughly
    const effectiveGridW = gridInfo.effectiveGridW || (gridInfo.numCols * cellSize + (gridInfo.numCols - 1) * gapX);
    const effectiveGridH = gridInfo.effectiveGridH || (gridInfo.numRows * cellSize + (gridInfo.numRows - 1) * gapY);

    const startX = margin + (availableWidth - effectiveGridW) / 2;
    const startY = margin + (availableHeight - effectiveGridH) / 2;

    // QR Exclusion Indices (If not provided, default to no exclusion or fallback)
    const excStartCol = gridInfo.excStartCol !== undefined ? gridInfo.excStartCol : 9999;
    const excStartRow = gridInfo.excStartRow !== undefined ? gridInfo.excStartRow : 9999;

    for (let row = 0; row < gridInfo.numRows; row++) {
        for (let col = 0; col < gridInfo.numCols; col++) {

            // Quantized Exclusion Check
            if (col >= excStartCol && row >= excStartRow) {
                continue;
            }

            const x = (startX + col * (cellSize + gapX)) * scale;
            const y = (startY + row * (cellSize + gapY)) * scale;
            const size = cellSize * scale;

            // Hue based on LPI (cols), Lightness based on Freq (rows)
            const hue = (col / gridInfo.numCols) * 240;
            const sat = 70;
            const light = 40 + (row / gridInfo.numRows) * 40;

            ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.fillRect(x, y, size, size);
        }
    }

    // QR Placeholder
    // Position relative to Effective Grid Bottom-Right
    const qrSizeMM = gridInfo.qrSize || 17;
    // qrX/Y in gridInfo are absolute to workspace. We need relative to card.
    // Logic: globalOffsetX = cardOffsetX + contentOffsetX.
    // contentOffsetX = startX.
    // so qrX_on_card = startX + effectiveGridW - qrSizeMM.

    const qrX = (startX + effectiveGridW - qrSizeMM) * scale;
    const qrY = (startY + effectiveGridH - qrSizeMM) * scale;
    const qrSize = qrSizeMM * scale;

    // Real QR Rendering
    if (gridInfo.qrData) {
        const qrPathStr = generator.generateQRPath(gridInfo.qrData, qrX, qrY, qrSize);
        const p = new Path2D(qrPathStr);
        ctx.fillStyle = '#000';
        ctx.fill(p);
    } else {
        // Fallback for older grids or errors
        ctx.fillStyle = '#000';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
    }

    return gridInfo;
}

function updateStandardPreview() {
    const currentSettings = SettingsStorage.load();
    drawGridToCanvas('standardPreviewCanvas', currentSettings);
}

function downloadTestGridXCS(xcsContent, filename) {
    const blob = new Blob([xcsContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Ensure extension
    if (!filename.endsWith('.xcs')) {
        filename += '.xcs';
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded: ${filename}`, 'success');
}

// Analyzer Functions
function handleAnalyzerFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            analyzeGridImage(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function analyzeGridImage(img) {
    const canvas = document.getElementById('analyzerCanvas');
    const ctx = canvas.getContext('2d');

    // Resize to reasonable size for analysis
    const maxSize = 800;
    let w = img.width;
    let h = img.height;
    if (w > h && w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
    else if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    analyzerState.originalImg = img;
    analyzerState.autoDetected = false;
    analyzerState.detectedCells = null;

    // Show preview area
    document.getElementById('analyzerDropZone').style.display = 'none';
    document.getElementById('analysisPreview').style.display = 'flex';
    document.getElementById('colorMapSection').style.display = 'block';
    document.getElementById('alignmentHint').style.display = 'block';

    // Try to detect QR Code for settings
    const imageData = ctx.getImageData(0, 0, w, h);
    const generator = new TestGridGenerator();
    const qrResult = await generator.analyzeImage(imageData);

    const settingsDiv = document.getElementById('analysisSettings');

    if (qrResult.found && !qrResult.error) {
        const s = qrResult.data;
        analyzerState.numCols = s.lpi[2];
        analyzerState.numRows = s.freq[2];
        analyzerState.freqValues = qrResult.freqValues;
        analyzerState.lpiValues = qrResult.lpiValues;

        settingsDiv.innerHTML = `
            <div class="detected-value"><span>Frequency Range</span> <span>${s.freq[0]} - ${s.freq[1]} kHz</span></div>
            <div class="detected-value"><span>LPC Range</span> <span>${s.lpi[0]} - ${s.lpi[1]} LPC</span></div>
            <div class="detected-value"><span>Grid Size</span> <span>${s.lpi[2]} × ${s.freq[2]}</span></div>
            <div class="detected-value"><span>Power / Speed</span> <span>${s.pwr}% / ${s.spd} mm/s</span></div>
            <div class="detected-value"><span>Laser Type</span> <span>${(s.type || 'UV').toUpperCase()}</span></div>
        `;
        document.getElementById('analyzerFallback').style.display = 'none';
        showToast('QR Code detected! Click the 4 corners of the COLOR GRID (not the whole card).', 'success');
    } else {
        settingsDiv.innerHTML = `
            <div class="text-center text-muted">
                <p>⚠️ No QR code detected.</p>
                <p>Use the manual settings below, then click the 4 corners of the color grid.</p>
            </div>
        `;
        document.getElementById('analyzerFallback').style.display = 'block';
        showToast('No QR detected. Enter settings manually and click the 4 corners.', 'warning');
    }
}

/**
 * Extract colors using auto-detected cell centers
 */
function updateExtractedColorsFromDetection() {
    const canvas = document.getElementById('analyzerCanvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const { detectedCells, gridDetector } = analyzerState;

    if (!detectedCells || detectedCells.length === 0) {
        return;
    }

    // Sort cells by row then column for consistent ordering
    const sortedCells = [...detectedCells].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });

    const colors = [];
    const rgbColors = [];

    sortedCells.forEach(cell => {
        const color = gridDetector.sampleCellColor(imageData, cell);
        colors.push(`rgb(${color.r}, ${color.g}, ${color.b})`);
        rgbColors.push(color);
    });

    analyzerState.extractedColors = rgbColors;

    // Update the color map grid
    generateColorMapFromDetection(sortedCells, colors);

    // Show save button
    const saveSection = document.getElementById('saveColorMapSection');
    if (saveSection) {
        saveSection.style.display = 'block';
    }
}

/**
 * Generate color map grid from detected cells
 */
function generateColorMapFromDetection(cells, colors) {
    const grid = document.getElementById('colorMapGrid');
    grid.innerHTML = '';

    const numCols = Math.max(...cells.map(c => c.col)) + 1;
    grid.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;

    cells.forEach((cell, idx) => {
        const freq = analyzerState.freqValues[cell.row] || '??';
        const lpi = analyzerState.lpiValues[cell.col] || '??';

        const cellElem = document.createElement('div');
        cellElem.className = 'color-cell';
        cellElem.style.backgroundColor = colors[idx];
        cellElem.title = `${freq}kHz / ${lpi} LPC`;

        cellElem.addEventListener('click', () => {
            document.querySelectorAll('.color-cell').forEach(c => c.classList.remove('selected'));
            cellElem.classList.add('selected');

            const box = document.getElementById('activeSelectionBox');
            const text = document.getElementById('activeSelectionText');
            box.style.display = 'block';
            text.textContent = `${freq}kHz / ${lpi} LPC`;
            box.style.borderColor = colors[idx];

            showToast(`Mapped: ${freq}kHz @ ${lpi} LPC`, 'info');
        });

        grid.appendChild(cellElem);
    });
}

function useDefaultGridSettings() {
    // Standard grid parameters
    const s = SettingsStorage.getDefaults();
    const numCols = 14;
    const numRows = 9;

    const generator = new TestGridGenerator(s);
    const lpiValues = generator.linspace(s.lpiMax, s.lpiMin, numCols);
    const freqValues = generator.linspace(s.freqMin, s.freqMax, numRows);

    analyzerState.numCols = numCols;
    analyzerState.numRows = numRows;
    analyzerState.freqValues = freqValues;
    analyzerState.lpiValues = lpiValues;

    const settingsDiv = document.getElementById('analysisSettings');
    settingsDiv.innerHTML = `
        <div class="detected-value"><span>Frequency (Default)</span> <span>${s.freqMin}-${s.freqMax}kHz</span></div>
        <div class="detected-value"><span>LPC (Default)</span> <span>${s.lpiMax}-${s.lpiMin}</span></div>
        <div class="detected-value"><span>Grid Size</span> <span>${numCols}×${numRows}</span></div>
    `;

    showToast('Applied default settings. Click the 4 corners of the card now.', 'success');
    document.getElementById('analyzerFallback').style.display = 'none';
}

function generateColorMapWithData(freqValues, lpiValues, extractedColors) {
    const grid = document.getElementById('colorMapGrid');
    grid.innerHTML = '';

    const { numCols, numRows, qrRegion } = analyzerState;
    grid.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;

    // QR region info
    // QR region info - use dynamic calculation
    const cellSize = parseFloat(document.getElementById('gridCellSize')?.value) || 5;
    const cellGap = parseFloat(document.getElementById('gridCellGap')?.value) || 1;
    const qrExclusion = calculateQRExclusionZone(numCols, numRows, cellSize, cellGap);

    const qrStartCol = qrExclusion.startCol;
    const qrStartRow = qrExclusion.startRow;

    let colorIdx = 0;
    for (let row = 0; row < numRows; row++) {
        const freq = freqValues[row] || '??';
        for (let col = 0; col < numCols; col++) {
            const lpi = lpiValues[col] || '??';
            const color = extractedColors ? extractedColors[colorIdx] : '#ddd';

            const cell = document.createElement('div');
            cell.className = 'color-cell';

            // Check if this is a QR cell
            if (col >= qrStartCol && row >= qrStartRow) {
                cell.classList.add('qr-excluded');
                cell.style.backgroundColor = 'transparent';
                cell.style.border = '1px dashed rgba(255, 59, 48, 0.5)';
                cell.title = 'QR Code Region (Excluded)';
            } else {
                cell.style.backgroundColor = color;
                cell.title = `${freq}kHz / ${lpi} LPC`;

                cell.addEventListener('click', () => {
                    document.querySelectorAll('.color-cell').forEach(c => c.classList.remove('selected'));
                    cell.classList.add('selected');

                    const box = document.getElementById('activeSelectionBox');
                    const text = document.getElementById('activeSelectionText');
                    box.style.display = 'block';
                    text.textContent = `${freq}kHz / ${lpi} LPC`;
                    box.style.borderColor = color;

                    showToast(`Mapped: ${freq}kHz @ ${lpi} LPC`, 'info');
                });
            }

            grid.appendChild(cell);
            colorIdx++;
        }
    }
}

/**
 * Save the color map from the analyzer to localStorage
 * The color map contains RGB values mapped to their frequency/LPI settings
 */
/**
 * Save the color map from the analyzer to localStorage
 * The color map contains RGB values mapped to their frequency/LPI settings
 */
function saveColorMap() {
    const { extractedColors, freqValues, lpiValues, numCols, numRows, corners, originalImg } = analyzerState;

    if (!extractedColors || extractedColors.length === 0) {
        showToast('No colors to save. Please align the grid first.', 'error');
        return;
    }

    // Build the color map data structure (skip QR cells)
    const colorEntries = [];
    let colorIdx = 0;

    // QR region info
    // QR region info
    // Get settings for exclusion calculation
    const cellSize = parseFloat(document.getElementById('gridCellSize')?.value) || 5;
    const cellGap = parseFloat(document.getElementById('gridCellGap')?.value) || 1;
    const qrExclusion = calculateQRExclusionZone(numCols, numRows, cellSize, cellGap);

    const qrStartCol = qrExclusion.startCol;
    const qrStartRow = qrExclusion.startRow;

    for (let row = 0; row < numRows; row++) {
        const freq = freqValues[row];
        for (let col = 0; col < numCols; col++) {
            const lpi = lpiValues[col];
            const color = extractedColors[colorIdx];

            // Skip QR region cells
            if (!(col >= qrStartCol && row >= qrStartRow) && color && !color.isQR) {
                colorEntries.push({
                    color: color,
                    frequency: freq,
                    lpi: lpi,
                    gridPos: { col, row }
                });
            }
            colorIdx++;
        }
    }

    // Crop the image
    let gridImage = null;
    if (originalImg && corners && corners.length === 4) {
        gridImage = cropGridImage(originalImg, corners);
        if (!gridImage) {
            console.warn('saveColorMap: Failed to generate grid image.');
            showToast('Warning: Could not save grid preview image.', 'warning');
        }
    } else {
        console.warn('saveColorMap: Missing image or corners', { hasImg: !!originalImg, corners: corners?.length });
    }

    const colorMapData = {
        entries: colorEntries,
        numCols,
        numRows,
        freqRange: [freqValues[0], freqValues[freqValues.length - 1]],
        lpiRange: [lpiValues[0], lpiValues[lpiValues.length - 1]],
        savedAt: new Date().toISOString(),
        gridImage: gridImage
    };

    // Prompt for name
    const defaultName = `Grid ${new Date().toLocaleDateString()} (${numCols}x${numRows})`;
    const name = prompt("Enter a name for this color map:", defaultName);

    if (name === null) return; // Users cancelled

    if (SettingsStorage.saveColorMap(colorMapData, name)) {
        showToast(`Color map "${name}" saved successfully!`, 'success');

        // Show the success message
        const statusDiv = document.getElementById('savedColorMapStatus');
        if (statusDiv) {
            statusDiv.style.display = 'block';
        }

        // Refresh the Color Grids list
        initializeMultiGridPalette(SettingsStorage).then(() => renderColorGridsList());

    } else {
        showToast('Failed to save color map.', 'error');
    }
}

// ===================================
// Advanced Analyzer
// ===================================

const advancedAnalyzerState = {
    colorMetadata: [], // Array of {excluded: boolean, name: string} per cell
    selectedIndex: null,
    similarGroups: [], // Groups of similar color indices
    highlightedCell: null // {row, col} for canvas highlight
};

function setupAdvancedAnalyzer() {
    // Open button
    const btnOpen = document.getElementById('btnAdvancedAnalyzer');
    if (btnOpen) {
        btnOpen.addEventListener('click', openAdvancedAnalyzer);
    }

    // Close buttons
    const btnClose = document.getElementById('closeAdvancedAnalyzer');
    if (btnClose) {
        btnClose.addEventListener('click', closeAdvancedAnalyzer);
    }

    const btnCancel = document.getElementById('btnCancelAdvanced');
    if (btnCancel) {
        btnCancel.addEventListener('click', closeAdvancedAnalyzer);
    }

    // Modal backdrop click
    const modal = document.getElementById('advancedAnalyzerModal');
    if (modal) {
        modal.querySelector('.modal-backdrop').addEventListener('click', closeAdvancedAnalyzer);
    }

    // Save button
    const btnSave = document.getElementById('btnSaveAdvanced');
    if (btnSave) {
        btnSave.addEventListener('click', saveAdvancedColorMap);
    }

    // Delete/Restore buttons
    const btnDelete = document.getElementById('btnDeleteColor');
    if (btnDelete) {
        btnDelete.addEventListener('click', () => toggleColorExclusion(advancedAnalyzerState.selectedIndex));
    }

    const btnRestore = document.getElementById('btnRestoreColor');
    if (btnRestore) {
        btnRestore.addEventListener('click', () => toggleColorExclusion(advancedAnalyzerState.selectedIndex));
    }

    // Name input
    const nameInput = document.getElementById('colorNameInput');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            if (advancedAnalyzerState.selectedIndex !== null) {
                advancedAnalyzerState.colorMetadata[advancedAnalyzerState.selectedIndex].name = e.target.value;
                updateAdvancedGrid();
            }
        });
    }

    // Similar colors toggle
    const btnShowSimilar = document.getElementById('btnShowSimilar');
    if (btnShowSimilar) {
        btnShowSimilar.addEventListener('click', () => {
            const list = document.getElementById('similarColorsList');
            if (list) {
                const isHidden = list.style.display === 'none';
                list.style.display = isHidden ? 'block' : 'none';
                btnShowSimilar.textContent = isHidden ? 'Hide Details' : 'Show Details';
            }
        });
    }
}

function openAdvancedAnalyzer() {
    const { extractedColors, numCols, numRows, freqValues, lpiValues, corners, originalImg, qrRegion } = analyzerState;

    if (!extractedColors || extractedColors.length === 0) {
        showToast('No colors detected. Please align the grid first.', 'error');
        return;
    }

    // QR region info
    // QR region info
    const cellSize = parseFloat(document.getElementById('gridCellSize')?.value) || 5;
    const cellGap = parseFloat(document.getElementById('gridCellGap')?.value) || 1;
    const qrExclusion = calculateQRExclusionZone(numCols, numRows, cellSize, cellGap);

    const qrStartCol = qrExclusion.startCol;
    const qrStartRow = qrExclusion.startRow;

    // Initialize metadata for each color, marking QR cells as excluded
    advancedAnalyzerState.colorMetadata = extractedColors.map((color, idx) => {
        const row = Math.floor(idx / numCols);
        const col = idx % numCols;
        const isQR = col >= qrStartCol && row >= qrStartRow;
        return {
            excluded: isQR || (color && color.isQR),
            name: isQR ? 'QR Code' : ''
        };
    });
    advancedAnalyzerState.selectedIndex = null;
    advancedAnalyzerState.similarGroups = [];

    // Copy source image to advanced canvas - use SAME dimensions as simple analyzer canvas
    // The corners were recorded relative to that canvas size
    const simpleCanvas = document.getElementById('analyzerCanvas');
    const advancedCanvas = document.getElementById('advancedAnalyzerCanvas');

    if (advancedCanvas && originalImg && simpleCanvas) {
        // Use same dimensions as the simple analyzer canvas to match corner coordinates
        advancedCanvas.width = simpleCanvas.width;
        advancedCanvas.height = simpleCanvas.height;
        const ctx = advancedCanvas.getContext('2d');
        ctx.drawImage(originalImg, 0, 0, advancedCanvas.width, advancedCanvas.height);

        // Draw corner markers and grid if corners exist
        if (corners && corners.length === 4) {
            drawAdvancedGridOverlay(ctx, corners, numCols, numRows);
        }
    }

    // Render the grid
    renderAdvancedGrid();

    // Update stats
    updateAdvancedStats();

    // Hide detail panel initially
    document.getElementById('colorDetailPanel').style.display = 'none';

    // Open modal
    const modal = document.getElementById('advancedAnalyzerModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAdvancedAnalyzer() {
    const modal = document.getElementById('advancedAnalyzerModal');
    if (modal) {
        modal.classList.remove('active');
    }

    // Clear highlight
    clearSourceHighlight();
}

function drawAdvancedGridOverlay(ctx, corners, numCols, numRows) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;

    // Draw grid lines
    for (let r = 0; r <= numRows; r++) {
        const t = r / numRows;
        const pLeft = interpolate(corners[0], corners[3], t);
        const pRight = interpolate(corners[1], corners[2], t);
        ctx.beginPath();
        ctx.moveTo(pLeft.x, pLeft.y);
        ctx.lineTo(pRight.x, pRight.y);
        ctx.stroke();
    }

    for (let c = 0; c <= numCols; c++) {
        const t = c / numCols;
        const pTop = interpolate(corners[0], corners[1], t);
        const pBottom = interpolate(corners[3], corners[2], t);
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pBottom.x, pBottom.y);
        ctx.stroke();
    }
}

function renderAdvancedGrid() {
    const grid = document.getElementById('advancedColorGrid');
    if (!grid) return;

    const { extractedColors, numCols, freqValues, lpiValues, numRows } = analyzerState;
    const { colorMetadata, selectedIndex, similarGroups } = advancedAnalyzerState;

    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;

    // Build set of similar indices for quick lookup
    const similarIndices = new Set();
    similarGroups.forEach(group => {
        group.forEach(idx => similarIndices.add(idx));
    });

    extractedColors.forEach((color, idx) => {
        const row = Math.floor(idx / numCols);
        const col = idx % numCols;
        const freq = freqValues[row];
        const lpi = lpiValues[col];
        const meta = colorMetadata[idx];

        const cell = document.createElement('div');
        cell.className = 'color-cell';
        cell.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        cell.title = `${freq}kHz / ${lpi} LPC${meta.name ? ` - ${meta.name}` : ''}`;
        cell.dataset.index = idx;

        // Apply state classes
        if (meta.excluded) cell.classList.add('deleted');
        if (idx === selectedIndex) cell.classList.add('selected');
        if (meta.name) cell.classList.add('has-name');

        cell.addEventListener('click', () => selectAdvancedColor(idx));

        grid.appendChild(cell);
    });
}

function updateAdvancedGrid() {
    // Re-render just updates classes without full rebuild
    const grid = document.getElementById('advancedColorGrid');
    if (!grid) return;

    const { colorMetadata, selectedIndex, similarGroups } = advancedAnalyzerState;

    const similarIndices = new Set();
    similarGroups.forEach(group => {
        group.forEach(idx => similarIndices.add(idx));
    });

    grid.querySelectorAll('.color-cell').forEach((cell, idx) => {
        const meta = colorMetadata[idx];

        cell.classList.toggle('deleted', meta.excluded);
        cell.classList.toggle('selected', idx === selectedIndex);
        cell.classList.toggle('similar', similarIndices.has(idx) && !meta.excluded);
        cell.classList.toggle('has-name', !!meta.name);
    });

    updateAdvancedStats();
}

function selectAdvancedColor(index) {
    const { extractedColors, numCols, freqValues, lpiValues } = analyzerState;
    const { colorMetadata } = advancedAnalyzerState;

    advancedAnalyzerState.selectedIndex = index;

    const row = Math.floor(index / numCols);
    const col = index % numCols;
    const color = extractedColors[index];
    const freq = freqValues[row];
    const lpi = lpiValues[col];
    const meta = colorMetadata[index];

    // Update detail panel
    const panel = document.getElementById('colorDetailPanel');
    panel.style.display = 'block';

    document.getElementById('colorDetailSwatch').style.backgroundColor =
        `rgb(${color.r}, ${color.g}, ${color.b})`;
    document.getElementById('colorDetailSettings').textContent = `${freq} kHz / ${lpi} LPC`;
    document.getElementById('colorDetailPosition').textContent = `Row ${row + 1}, Col ${col + 1}`;
    document.getElementById('colorNameInput').value = meta.name || '';

    // Toggle delete/restore buttons
    document.getElementById('btnDeleteColor').style.display = meta.excluded ? 'none' : 'inline-flex';
    document.getElementById('btnRestoreColor').style.display = meta.excluded ? 'inline-flex' : 'none';

    // Highlight on source
    highlightSourceCell(row, col);

    // Update grid selection
    renderAdvancedGrid();
}

function highlightSourceCell(row, col) {
    const { corners, numCols, numRows, originalImg, autoDetected, detectedCells } = analyzerState;

    // For auto-detected mode, we don't require corners
    if (!autoDetected && (!corners || corners.length !== 4)) return;

    const canvas = document.getElementById('advancedAnalyzerCanvas');
    if (!canvas) return;

    // Store the currently highlighted cell for redraw
    advancedAnalyzerState.highlightedCell = { row, col };

    // Redraw the canvas with the highlight
    redrawAdvancedCanvas();
}

function redrawAdvancedCanvas() {
    const { corners, numCols, numRows, originalImg, autoDetected, detectedCells } = analyzerState;
    const { highlightedCell } = advancedAnalyzerState;

    const simpleCanvas = document.getElementById('analyzerCanvas');
    const canvas = document.getElementById('advancedAnalyzerCanvas');
    if (!canvas || !originalImg || !simpleCanvas) return;

    const ctx = canvas.getContext('2d');

    // Redraw base image at same size as simple analyzer
    canvas.width = simpleCanvas.width;
    canvas.height = simpleCanvas.height;
    ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);

    // Draw grid overlay based on detection method
    if (autoDetected && detectedCells && detectedCells.length > 0) {
        // Draw detected cell boundaries
        drawDetectedCellsOverlay(ctx, detectedCells);
    } else if (corners && corners.length === 4) {
        // Use manual corner-based grid
        drawAdvancedGridOverlay(ctx, corners, numCols, numRows);
    }

    // Draw highlight for selected cell if any
    if (highlightedCell) {
        const { row, col } = highlightedCell;

        if (autoDetected && detectedCells) {
            // Find the detected cell matching this row/col
            const cell = detectedCells.find(c => c.row === row && c.col === col);
            if (cell && cell.bounds) {
                drawCellHighlight(ctx, cell.bounds);
            }
        } else if (corners && corners.length === 4) {
            // Calculate cell corner positions using manual corner interpolation
            const t1x = col / numCols;
            const t2x = (col + 1) / numCols;
            const t1y = row / numRows;
            const t2y = (row + 1) / numRows;

            const topLeft = getCellCorner(corners, t1x, t1y);
            const topRight = getCellCorner(corners, t2x, t1y);
            const bottomRight = getCellCorner(corners, t2x, t2y);
            const bottomLeft = getCellCorner(corners, t1x, t2y);

            drawCellHighlightQuad(ctx, topLeft, topRight, bottomRight, bottomLeft);
        }
    }
}

/**
 * Draw overlay for auto-detected cells
 */
function drawDetectedCellsOverlay(ctx, cells) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;

    cells.forEach(cell => {
        if (!cell.bounds) return;
        const { top, bottom, left, right } = cell.bounds;
        ctx.strokeRect(left, top, right - left, bottom - top);
    });
}

/**
 * Draw highlight for a cell using detected bounds
 */
function drawCellHighlight(ctx, bounds) {
    const { top, bottom, left, right } = bounds;
    const margin = 2;

    // Draw filled rectangle with semi-transparent red
    ctx.fillStyle = 'rgba(255, 59, 48, 0.3)';
    ctx.fillRect(left + margin, top + margin, right - left - margin * 2, bottom - top - margin * 2);

    // Draw solid red border
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 3;
    ctx.strokeRect(left + margin, top + margin, right - left - margin * 2, bottom - top - margin * 2);

    // Draw corner markers
    ctx.fillStyle = '#ff3b30';
    [[left, top], [right, top], [right, bottom], [left, bottom]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

/**
 * Draw highlight for a cell using interpolated quadrilateral corners
 */
function drawCellHighlightQuad(ctx, topLeft, topRight, bottomRight, bottomLeft) {
    // Draw filled quadrilateral with semi-transparent red
    ctx.fillStyle = 'rgba(255, 59, 48, 0.3)';
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();

    // Draw solid red border
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    // Draw corner markers
    ctx.fillStyle = '#ff3b30';
    [topLeft, topRight, bottomRight, bottomLeft].forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

function getCellCorner(corners, tx, ty) {
    // Same interpolation as updateExtractedColors uses
    const pTop = interpolate(corners[0], corners[1], tx);
    const pBottom = interpolate(corners[3], corners[2], tx);
    return interpolate(pTop, pBottom, ty);
}

function clearSourceHighlight() {
    advancedAnalyzerState.highlightedCell = null;
    redrawAdvancedCanvas();
}

function toggleColorExclusion(index) {
    if (index === null) return;

    const meta = advancedAnalyzerState.colorMetadata[index];
    meta.excluded = !meta.excluded;

    // Update buttons
    document.getElementById('btnDeleteColor').style.display = meta.excluded ? 'none' : 'inline-flex';
    document.getElementById('btnRestoreColor').style.display = meta.excluded ? 'inline-flex' : 'none';

    updateAdvancedGrid();
    showToast(meta.excluded ? 'Color removed from map' : 'Color restored', 'info');
}


function colorDistance(c1, c2) {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function renderSimilarColorsList(groups) {
    const list = document.getElementById('similarColorsList');
    if (!list) return;

    const { extractedColors, numCols, freqValues, lpiValues } = analyzerState;

    list.innerHTML = '';

    groups.forEach((group, gIdx) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'similar-color-group';
        groupEl.innerHTML = `<strong style="color: var(--accent-warning); margin-right: 8px;">Group ${gIdx + 1}:</strong>`;

        group.forEach(idx => {
            const color = extractedColors[idx];
            const row = Math.floor(idx / numCols);
            const col = idx % numCols;
            const lpi = lpiValues[col];

            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
            swatch.style.cursor = 'pointer';
            swatch.title = `${freqValues[row]}kHz / ${lpi} LPC - Click to select`;
            swatch.addEventListener('click', () => selectAdvancedColor(idx));
            groupEl.appendChild(swatch);
        });

        // Add hint about lowest LPC
        const lowestLpiIdx = group.reduce((minIdx, idx) => {
            const col = idx % numCols;
            const minCol = minIdx % numCols;
            return lpiValues[col] < lpiValues[minCol] ? idx : minIdx;
        }, group[0]);

        const hint = document.createElement('span');
        hint.className = 'color-info';
        hint.innerHTML = `<em>💡 Keep lowest LPC for faster engraving</em>`;
        groupEl.appendChild(hint);

        list.appendChild(groupEl);
    });
}

function updateAdvancedStats() {
    const { extractedColors } = analyzerState;
    const { colorMetadata } = advancedAnalyzerState;

    const total = extractedColors.length;
    const excluded = colorMetadata.filter(m => m.excluded).length;

    document.getElementById('advancedColorCount').textContent = `${total - excluded} colors`;
    document.getElementById('advancedExcludedCount').textContent = excluded > 0 ? `${excluded} excluded` : '';
}

function saveAdvancedColorMap() {
    const { extractedColors, freqValues, lpiValues, numCols, numRows } = analyzerState;
    const { colorMetadata } = advancedAnalyzerState;

    // Build entries, excluding deleted ones
    const colorEntries = [];
    let idx = 0;

    for (let row = 0; row < numRows; row++) {
        const freq = freqValues[row];
        for (let col = 0; col < numCols; col++) {
            const lpi = lpiValues[col];
            const color = extractedColors[idx];
            const meta = colorMetadata[idx];

            if (!meta.excluded) {
                const entry = {
                    color: color,
                    frequency: freq,
                    lpi: lpi,
                    gridPos: { col, row }
                };
                if (meta.name) {
                    entry.name = meta.name;
                }
                colorEntries.push(entry);
            }
            idx++;
        }
    }

    if (colorEntries.length === 0) {
        showToast('No colors to save. All colors have been excluded.', 'error');
        return;
    }

    // Crop the image
    let gridImage = null;
    const { corners, originalImg } = analyzerState;
    if (originalImg && corners && corners.length === 4) {
        gridImage = cropGridImage(originalImg, corners);
    }

    const colorMapData = {
        entries: colorEntries,
        numCols,
        numRows,
        freqRange: [freqValues[0], freqValues[freqValues.length - 1]],
        lpiRange: [lpiValues[0], lpiValues[lpiValues.length - 1]],
        savedAt: new Date().toISOString(),
        gridImage: gridImage
    };

    // Prompt for name
    const defaultName = `Grid ${new Date().toLocaleDateString()} (${colorEntries.length} colors)`;
    const name = prompt("Enter a name for this color map:", defaultName);

    if (name === null) return;

    if (SettingsStorage.saveColorMap(colorMapData, name)) {
        showToast(`Color map "${name}" saved with ${colorEntries.length} colors!`, 'success');
        closeAdvancedAnalyzer();

        // Refresh the Color Grids list
        initializeMultiGridPalette(SettingsStorage).then(() => renderColorGridsList());

        // Also update the simple view status
        const statusDiv = document.getElementById('savedColorMapStatus');
        if (statusDiv) {
            statusDiv.style.display = 'block';
        }
    } else {
        showToast('Failed to save color map.', 'error');
    }
}


// ===================================
// Start Application
// ===================================
document.addEventListener('DOMContentLoaded', init);

// ===================================
// Lightbox Logic
// ===================================
function setupLightbox() {
    const modal = document.getElementById('lightboxModal');
    const content = document.getElementById('lightboxContent');
    const closeBtn = document.getElementById('closeLightbox');

    if (!modal || !content || !closeBtn) return;

    function openLightbox(el) {
        content.innerHTML = '';
        if (el.tagName === 'CANVAS') {
            const img = new Image();
            img.src = el.toDataURL();
            content.appendChild(img);
        } else {
            // SVG container or plain element
            const clone = el.cloneNode(true);
            clone.style.height = 'auto';

            // If vectorSvgContainer, fix SVG sizing
            const svg = clone.querySelector('svg');
            if (svg) {
                // Ensure SVG scales
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.style.width = '100%';
                svg.style.height = '100%';
            }
            content.appendChild(clone);
        }
        modal.classList.add('active');
    }

    // Bind
    const previewQ = document.getElementById('previewQuantized');
    if (previewQ) {
        previewQ.addEventListener('click', () => {
            const canvas = document.getElementById('quantizedCanvas');
            if (canvas) openLightbox(canvas);
        });
    }

    const previewV = document.getElementById('previewVectors');
    if (previewV) {
        previewV.addEventListener('click', () => {
            const container = document.getElementById('vectorSvgContainer');
            if (container) openLightbox(container);
        });
    }

    // Analyzer and Original Canvas
    const analyzerC = document.getElementById('analyzerCanvas');
    if (analyzerC) {
        analyzerC.addEventListener('click', (e) => {
            // Only open lightbox if NOT defining corners (corners need clicks)
            if (analyzerState.corners.length === 4) {
                openLightbox(analyzerC);
            }
        });
    }

    const originalC = document.getElementById('originalCanvas');
    if (originalC) originalC.addEventListener('click', () => openLightbox(originalC));

    // Close
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.remove('active');
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}
