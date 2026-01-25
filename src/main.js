/**
 * Picture Engraver - Main Application
 * Converts images to XCS laser engraving files
 */

import { TestGridGenerator } from './lib/test-grid-generator.js';
import { SettingsStorage } from './lib/settings-storage.js';
import { ImageProcessor } from './lib/image-processor.js';
import { ColorQuantizer } from './lib/color-quantizer.js';
import { Vectorizer } from './lib/vectorizer.js';
import { XCSGenerator } from './lib/xcs-generator.js';
import { showToast } from './lib/toast.js';
import { Logger } from './lib/logger.js';
import { OnboardingManager } from './lib/onboarding.js';


// Application State
// ===================================
const state = {
    originalImage: null,
    processedImage: null,
    layers: [],
    vectorizedLayers: [],
    palette: [],
    outputSize: { width: 200, height: 200 },
    settings: null
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
    extractedColors: [] // RGB colors from the test grid photo
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

    // Layers
    layersPanel: document.getElementById('layersPanel'),
    layersList: document.getElementById('layersList'),
    btnAutoAssign: document.getElementById('btnAutoAssign'),

    // Preview
    previewPanel: document.getElementById('previewPanel'),
    quantizedCanvas: document.getElementById('quantizedCanvas'),
    vectorSvgContainer: document.getElementById('vectorSvgContainer'),
    previewTabs: document.querySelectorAll('.tab'),
    previewQuantized: document.getElementById('previewQuantized'),
    previewVectors: document.getElementById('previewVectors'),

    // Export
    btnDownloadXCS: document.getElementById('btnDownloadXCS'),

    // Modals
    settingsModal: document.getElementById('settingsModal'),
    testGridModal: document.getElementById('testGridModal'),
    btnSettings: document.getElementById('btnSettings'),
    btnTestGrid: document.getElementById('btnTestGrid'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    closeTestGridModal: document.getElementById('closeTestGridModal'),

    // Settings inputs
    settingPower: document.getElementById('settingPower'),
    settingSpeed: document.getElementById('settingSpeed'),
    settingPasses: document.getElementById('settingPasses'),
    settingCrossHatch: document.getElementById('settingCrossHatch'),
    settingFreqMin: document.getElementById('settingFreqMin'),
    settingFreqMax: document.getElementById('settingFreqMax'),
    settingLpiMin: document.getElementById('settingLpiMin'),
    settingLpiMax: document.getElementById('settingLpiMax'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnResetSettings: document.getElementById('btnResetSettings'),

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
    progressFill: document.getElementById('progressFill')
};

// ===================================
// Initialization
// ===================================
function init() {
    // Load settings
    state.settings = SettingsStorage.load();
    applySettingsToUI();

    // Setup event listeners
    setupDropZone();
    setupControls();
    setupModals();
    setupLayers();
    setupPreview();
    setupExport();
    setupTestGrid();
    setupAnalyzer();

    Logger.info('Picture Engraver initialized', { appVersion: '1.20.0' });

    // Initialize Onboarding Logic
    window.onboarding = new OnboardingManager();
    window.onboarding.init();

    // Hook Help Button
    document.getElementById('btnHelp').addEventListener('click', () => {
        window.onboarding.showWelcomeModal();
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
                    // Quantize colors
                    const quantizer = new ColorQuantizer();
                    const { quantizedImage, palette } = quantizer.quantize(resized, numColors);

                    state.processedImage = quantizedImage;
                    state.palette = palette;

                    state.layers = palette.map((color, index) => ({
                        id: `layer-${index}`,
                        name: `Layer ${index + 1}`,
                        color: color,
                        visible: true,
                        frequency: calculateFrequency(index, numColors),
                        lpi: calculateLPI(index, numColors),
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

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto; background: #fff;">`;

    state.layers.forEach(layer => {
        if (!layer.visible) return;

        const colorStr = `rgb(${layer.color.r}, ${layer.color.g}, ${layer.color.b})`;
        layer.paths.forEach(path => {
            if (path && path.length > 0) {
                svg += `<path d="${path}" fill="${colorStr}" stroke="none" fill-opacity="0.9"/>`;
            }
        });
    });

    svg += '</svg>';
    container.innerHTML = svg;
}

// ===================================
// Layers
// ===================================
function setupLayers() {
    elements.btnAutoAssign.addEventListener('click', autoAssignColors);
}

function displayLayers() {
    const container = elements.layersList;
    container.innerHTML = '';

    state.layers.forEach((layer, index) => {
        const layerEl = document.createElement('div');
        layerEl.className = 'layer-item';
        layerEl.innerHTML = `
      <input type="checkbox" class="layer-checkbox" ${layer.visible ? 'checked' : ''} data-layer-id="${layer.id}">
      <div class="layer-color" style="background-color: rgb(${layer.color.r}, ${layer.color.g}, ${layer.color.b})"></div>
      <div class="layer-info">
        <div class="layer-name">${layer.name}</div>
        <div class="layer-settings">${Math.round(layer.frequency)}kHz / ${Math.round(layer.lpi)} LPI</div>
      </div>
      <div class="layer-actions" style="display: flex; align-items: center;">
        <label class="layer-outline-control" style="margin-right: 10px; display: flex; align-items: center; font-size: 0.8em; color: var(--text-secondary);">
            <input type="checkbox" class="outline-checkbox" ${layer.outline ? 'checked' : ''} data-layer-id="${layer.id}">
            <span style="margin-left: 4px;">Outline</span>
        </label>
        <button class="btn btn-icon btn-sm" title="Edit" data-action="edit" data-layer-id="${layer.id}">✏️</button>
      </div>
    `;
        container.appendChild(layerEl);
    });

    // Add event listeners for Visibility
    container.querySelectorAll('.layer-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const layerId = e.target.dataset.layerId;
            const layer = state.layers.find(l => l.id === layerId);
            if (layer) layer.visible = e.target.checked;
        });
    });

    // Add event listeners for Outline
    container.querySelectorAll('.outline-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const layerId = e.target.dataset.layerId;
            const layer = state.layers.find(l => l.id === layerId);
            if (layer) layer.outline = e.target.checked;
        });
    });

    updateCalibrationStatus();
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
    // Load the saved color map
    const colorMap = SettingsStorage.loadColorMap();

    if (!colorMap || !colorMap.entries || colorMap.entries.length === 0) {
        showToast('No color map found! Please calibrate colors in the Test Grid > Analyze Grid tab first.', 'error');
        return;
    }

    if (state.layers.length === 0) {
        showToast('No layers to assign colors to. Process an image first.', 'error');
        return;
    }

    Logger.info(`Auto-assigning colors using ${colorMap.entries.length} calibrated colors`);

    // Disable button and show loading state
    const btn = elements.btnAutoAssign;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Assigning...';

    // Allow UI to update before processing
    setTimeout(() => {
        try {
            // For each layer, find the closest matching color from the calibration data
            state.layers.forEach(layer => {
                const bestMatch = findClosestCalibrationColor(layer.color, colorMap.entries);

                if (bestMatch) {
                    layer.frequency = bestMatch.frequency;
                    layer.lpi = bestMatch.lpi;
                    // Use the actual calibrated color as requested
                    layer.color = { ...bestMatch.color };
                }
            });

            // Refresh the layers display and preview
            displayLayers();
            if (state.vectorizedLayers.length > 0) {
                displayVectorPreview();
            }

            Logger.info('Auto-assign colors completed', { layersUpdated: state.layers.length });
            showToast(`Colors auto-assigned using calibrated color map!`, 'success');
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
    if (state.layers.length === 0) {
        showToast('Please process an image first', 'error');
        return;
    }

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
    } catch (error) {
        console.error('XCS generation error:', error);
        showToast('Error generating XCS: ' + error.message, 'error');
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

        // Start Test Grid Tour if needed
        if (window.onboarding && !window.onboarding.hasCompletedTestGridTour()) {
            setTimeout(() => window.onboarding.startTestGridTour(), 500);
        }
    });
    elements.closeTestGridModal.addEventListener('click', () => closeModal(elements.testGridModal));

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closeModal(backdrop.closest('.modal'));
        });
    });
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
}

function saveSettings() {
    state.settings = {
        power: parseInt(elements.settingPower.value),
        speed: parseInt(elements.settingSpeed.value),
        passes: parseInt(elements.settingPasses.value),
        crossHatch: elements.settingCrossHatch.checked,
        freqMin: parseInt(elements.settingFreqMin.value),
        freqMax: parseInt(elements.settingFreqMax.value),
        lpiMin: parseInt(elements.settingLpiMin.value),
        lpiMax: parseInt(elements.settingLpiMax.value)
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
// Test Grid
// ===================================

let activeGridGenerator = null;

function setupTestGrid() {
    // Generator Tab Controls (Custom)
    const generatorInputs = [
        'gridFreqMin', 'gridFreqMax', 'gridLpiMin', 'gridLpiMax',
        'gridHighLpiMode', 'gridCellSize', 'gridCellGap', 'gridPower', 'gridSpeed',
        'gridPasses', 'gridCrossHatch'
    ];

    // Add event listeners for live preview update
    generatorInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateGridPreview);
    });

    // High LPI Mode Toggle
    document.getElementById('gridHighLpiMode').addEventListener('change', (e) => {
        const maxInput = document.getElementById('gridLpiMax');
        if (e.target.checked) {
            maxInput.max = 4000;
            if (maxInput.value > 800) maxInput.value = 800;
        } else {
            maxInput.max = 800;
            if (maxInput.value > 800) maxInput.value = 800;
        }
        updateGridPreview();
    });

    // Buttons
    document.getElementById('btnPreviewGrid').addEventListener('click', updateGridPreview);
    document.getElementById('btnGenerateGrid').addEventListener('click', generateCustomGridXCS);

    /* Converted to direct link in HTML
    const btnStd = document.getElementById('btnGenerateStandard');
    if (btnStd) btnStd.addEventListener('click', generateStandardGridXCS);
    */

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
    const canvas = document.getElementById('analyzerCanvas');
    canvas.addEventListener('click', handleAnalyzerCanvasClick);
}

function handleAnalyzerCanvasClick(e) {
    if (analyzerState.corners.length >= 4) {
        analyzerState.corners = []; // Reset if already 4
    }

    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.target.height;

    analyzerState.corners.push({ x, y });
    drawAnalyzerUI();

    if (analyzerState.corners.length === 4) {
        showToast('Grid aligned! Extracting colors...', 'success');
        updateExtractedColors();
    }
}

function drawAnalyzerUI() {
    const canvas = document.getElementById('analyzerCanvas');
    const ctx = canvas.getContext('2d');

    // We can't easily clear just the UI without redrawing the image
    // In a real app we'd use a layered canvas, but let's just redraw for now
    // Actually, we'll redraw the image and then the points
    const img = analyzerState.originalImg;
    if (!img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw corners
    ctx.fillStyle = '#ff3b30';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    analyzerState.corners.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '10px Inter';
        ctx.fillText(['TL', 'TR', 'BR', 'BL'][i], p.x + 8, p.y + 4);
        ctx.fillStyle = '#ff3b30';
    });

    // Draw grid if 4 corners
    if (analyzerState.corners.length === 4) {
        drawProjectedGrid(ctx, analyzerState.corners, analyzerState.numCols, analyzerState.numRows);
    }
}

function drawProjectedGrid(ctx, corners, cols, rows) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        const pLeft = interpolate(corners[0], corners[3], t);
        const pRight = interpolate(corners[1], corners[2], t);
        ctx.beginPath();
        ctx.moveTo(pLeft.x, pLeft.y);
        ctx.lineTo(pRight.x, pRight.y);
        ctx.stroke();
    }

    for (let c = 0; c <= cols; c++) {
        const t = c / cols;
        const pTop = interpolate(corners[0], corners[1], t);
        const pBottom = interpolate(corners[3], corners[2], t);
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pBottom.x, pBottom.y);
        ctx.stroke();
    }
}

function interpolate(p1, p2, t) {
    return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
    };
}

function updateExtractedColors() {
    const canvas = document.getElementById('analyzerCanvas');
    const ctx = canvas.getContext('2d');
    const colors = [];
    const rgbColors = []; // Store as {r, g, b} objects

    const { corners, numCols, numRows } = analyzerState;

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Sample center of cell
            const tx = (col + 0.5) / numCols;
            const ty = (row + 0.5) / numRows;

            const pTop = interpolate(corners[0], corners[1], tx);
            const pBottom = interpolate(corners[3], corners[2], tx);
            const p = interpolate(pTop, pBottom, ty);

            const pixel = ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
            colors.push(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
            rgbColors.push({ r: pixel[0], g: pixel[1], b: pixel[2] });
        }
    }

    // Store in analyzer state for saving
    analyzerState.extractedColors = rgbColors;

    generateColorMapWithData(analyzerState.freqValues, analyzerState.lpiValues, colors);

    // Show the save button section
    const saveSection = document.getElementById('saveColorMapSection');
    if (saveSection) {
        saveSection.style.display = 'block';
    }
}

function getCustomGridSettings() {
    return {
        freqMin: parseInt(document.getElementById('gridFreqMin').value),
        freqMax: parseInt(document.getElementById('gridFreqMax').value),
        lpiMin: parseInt(document.getElementById('gridLpiMin').value),
        lpiMax: parseInt(document.getElementById('gridLpiMax').value),
        highLpiMode: document.getElementById('gridHighLpiMode').checked,
        cellSize: parseInt(document.getElementById('gridCellSize').value),
        cellGap: parseFloat(document.getElementById('gridCellGap').value),
        power: parseInt(document.getElementById('gridPower').value),
        speed: parseInt(document.getElementById('gridSpeed').value),
        passes: parseInt(document.getElementById('gridPasses').value),
        crossHatch: document.getElementById('gridCrossHatch').checked
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

    const qrCells = 3; // Must match generator (3x3 for version 5 QR codes)
    const qrStartCol = gridInfo.numCols - qrCells;
    const qrStartRow = gridInfo.numRows - qrCells;

    for (let row = 0; row < gridInfo.numRows; row++) {
        for (let col = 0; col < gridInfo.numCols; col++) {
            // QR Hole
            if (col >= qrStartCol && row >= qrStartRow) continue;

            const x = (margin + col * (cellSize + gap)) * scale;
            const y = (margin + row * (cellSize + gap)) * scale;
            const size = cellSize * scale;

            // Color gradient visualization
            // Hue based on LPI (cols), Lightness based on Freq (rows)
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

function generateStandardGridXCS() {
    const a = document.createElement('a');
    a.href = '/default_test_grid.xcs';
    a.download = 'default_test_grid.xcs';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Default grid downloaded.', 'success');
}

function generateCustomGridXCS() {
    if (!activeGridGenerator) activeGridGenerator = new TestGridGenerator(getCustomGridSettings());
    const { xcs } = activeGridGenerator.generateBusinessCardGrid();
    downloadTestGridXCS(xcs, 'custom_grid');
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
    const gap = settings.cellGap !== undefined ? settings.cellGap : 1;

    const qrCells = 3;
    const qrStartCol = gridInfo.numCols - qrCells;
    const qrStartRow = gridInfo.numRows - qrCells;

    for (let row = 0; row < gridInfo.numRows; row++) {
        for (let col = 0; col < gridInfo.numCols; col++) {
            if (col >= qrStartCol && row >= qrStartRow) continue;

            const x = (margin + col * (cellSize + gap)) * scale;
            const y = (margin + row * (cellSize + gap)) * scale;
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
    const qrSize = ((qrCells * (cellSize + gap)) - gap) * scale;
    const qrX = (margin + qrStartCol * (cellSize + gap)) * scale;
    const qrY = (margin + qrStartRow * (cellSize + gap)) * scale;

    ctx.fillStyle = '#000';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    return gridInfo;
}

function updateStandardPreview() {
    drawGridToCanvas('standardPreviewCanvas', {});
}

function downloadTestGridXCS(xcsContent, prefix) {
    const blob = new Blob([xcsContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${Date.now()}.xcs`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Grid XCS downloaded successfully!', 'success');
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

    // Show preview area
    document.getElementById('analyzerDropZone').style.display = 'none';
    document.getElementById('analysisPreview').style.display = 'flex';
    document.getElementById('colorMapSection').style.display = 'block';
    document.getElementById('alignmentHint').style.display = 'block';

    // Analyze QR Code
    const imageData = ctx.getImageData(0, 0, w, h);
    const generator = new TestGridGenerator();
    const result = await generator.analyzeImage(imageData);

    const settingsDiv = document.getElementById('analysisSettings');

    if (result.found && !result.error) {
        const s = result.data;

        analyzerState.numCols = s.lpi[2];
        analyzerState.numRows = s.freq[2];
        analyzerState.freqValues = result.freqValues;
        analyzerState.lpiValues = result.lpiValues;

        settingsDiv.innerHTML = `
            <div class="detected-value"><span>Frequency Range</span> <span>${s.freq[0]} - ${s.freq[1]} kHz</span></div>
            <div class="detected-value"><span>LPI Range</span> <span>${s.lpi[0]} - ${s.lpi[1]} LPI</span></div>
            <div class="detected-value"><span>Grid Size</span> <span>${s.lpi[2]} × ${s.freq[2]}</span></div>
            <div class="detected-value"><span>Power / Speed</span> <span>${s.pwr}% / ${s.spd} mm/s</span></div>
        `;

        showToast('QR Code detected! Now click the 4 corners of the card to align the grid.', 'success');
        document.getElementById('analyzerFallback').style.display = 'none';
    } else {
        settingsDiv.innerHTML = `
            <div class="text-center text-muted">
                <p>⚠️ No QR code detected.</p>
                <p>Use the default fallback below or try another photo.</p>
            </div>
        `;
        document.getElementById('analyzerFallback').style.display = 'block';
        showToast('Could not detect QR code settings.', 'warning');
    }
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
        <div class="detected-value"><span>LPI (Default)</span> <span>${s.lpiMax}-${s.lpiMin}</span></div>
        <div class="detected-value"><span>Grid Size</span> <span>${numCols}×${numRows}</span></div>
    `;

    showToast('Applied default settings. Click the 4 corners of the card now.', 'success');
    document.getElementById('analyzerFallback').style.display = 'none';
}

function generateColorMapWithData(freqValues, lpiValues, extractedColors) {
    const grid = document.getElementById('colorMapGrid');
    grid.innerHTML = '';

    grid.style.gridTemplateColumns = `repeat(${analyzerState.numCols}, 1fr)`;

    let colorIdx = 0;
    freqValues.forEach(freq => {
        lpiValues.forEach(lpi => {
            const cell = document.createElement('div');
            cell.className = 'color-cell';
            const color = extractedColors ? extractedColors[colorIdx] : '#ddd';
            cell.style.backgroundColor = color;
            cell.title = `${freq}kHz / ${lpi} LPI`;

            cell.addEventListener('click', () => {
                document.querySelectorAll('.color-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');

                const box = document.getElementById('activeSelectionBox');
                const text = document.getElementById('activeSelectionText');
                box.style.display = 'block';
                text.textContent = `${freq}kHz / ${lpi} LPI`;
                box.style.borderColor = color;

                showToast(`Mapped: ${freq}kHz @ ${lpi} LPI`, 'info');
            });

            grid.appendChild(cell);
            colorIdx++;
        });
    });
}

/**
 * Save the color map from the analyzer to localStorage
 * The color map contains RGB values mapped to their frequency/LPI settings
 */
function saveColorMap() {
    const { extractedColors, freqValues, lpiValues, numCols, numRows } = analyzerState;

    if (!extractedColors || extractedColors.length === 0) {
        showToast('No colors to save. Please align the grid first.', 'error');
        return;
    }

    // Build the color map data structure
    // Each entry maps a color to its freq/lpi settings
    const colorEntries = [];
    let colorIdx = 0;

    for (let row = 0; row < numRows; row++) {
        const freq = freqValues[row];
        for (let col = 0; col < numCols; col++) {
            const lpi = lpiValues[col];
            const color = extractedColors[colorIdx];

            colorEntries.push({
                color: color, // {r, g, b}
                frequency: freq,
                lpi: lpi
            });
            colorIdx++;
        }
    }

    const colorMapData = {
        entries: colorEntries,
        numCols,
        numRows,
        freqRange: [freqValues[0], freqValues[freqValues.length - 1]],
        lpiRange: [lpiValues[0], lpiValues[lpiValues.length - 1]],
        savedAt: new Date().toISOString()
    };

    if (SettingsStorage.saveColorMap(colorMapData)) {
        showToast('Color map saved successfully!', 'success');

        // Show the success message
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
