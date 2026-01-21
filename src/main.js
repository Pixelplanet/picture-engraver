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

// ===================================
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
    btnGenerate: document.getElementById('btnGenerate'),
    btnDownload: document.getElementById('btnDownload'),

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
    toastContainer: document.getElementById('toastContainer')
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

    console.log('Picture Engraver initialized');
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

    showToast('Processing image...', 'success');

    try {
        // Get settings
        const numColors = parseInt(elements.colorSlider.value);
        const size = getOutputSize();
        state.outputSize = size;

        // Process image
        const processor = new ImageProcessor();
        const resized = processor.resize(state.originalImage, size.width, size.height);

        // Update output size to match actual resized dimensions (remove padding)
        state.outputSize = {
            width: resized.width / 10, // Convert px back to mm (assuming 10px/mm)
            height: resized.height / 10
        };

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
            paths: []
        }));

        // Display results
        displayQuantizedImage(quantizedImage);
        displayLayers();

        // Show panels
        elements.layersPanel.style.display = 'flex';
        elements.previewPanel.style.display = 'flex';

        showToast('Quantization complete. Vectorizing...', 'success');

        // Vectorize layers
        setTimeout(() => vectorizeLayers(), 100);
    } catch (error) {
        console.error('Processing error:', error);
        showToast('Error processing image: ' + error.message, 'error');
    }
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
      <div class="layer-actions">
        <button class="btn btn-icon btn-sm" title="Edit" data-action="edit" data-layer-id="${layer.id}">✏️</button>
      </div>
    `;
        container.appendChild(layerEl);
    });

    // Add event listeners
    container.querySelectorAll('.layer-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const layerId = e.target.dataset.layerId;
            const layer = state.layers.find(l => l.id === layerId);
            if (layer) layer.visible = e.target.checked;
        });
    });
}

function autoAssignColors() {
    // TODO: Implement closest color matching
    showToast('Auto-assign colors feature coming soon!', 'warning');
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
    elements.btnGenerate.addEventListener('click', generateXCS);
    elements.btnDownload.addEventListener('click', downloadXCS);
}

let generatedXCS = null;

async function generateXCS() {
    if (state.layers.length === 0) {
        showToast('Please process an image first', 'error');
        return;
    }

    showToast('Generating XCS file...', 'success');

    try {
        const generator = new XCSGenerator(state.settings);
        generatedXCS = generator.generate(state.processedImage, state.layers, getOutputSize());

        elements.btnDownload.disabled = false;
        showToast('XCS file generated successfully!', 'success');
    } catch (error) {
        console.error('XCS generation error:', error);
        showToast('Error generating XCS: ' + error.message, 'error');
    }
}

function downloadXCS() {
    if (!generatedXCS) {
        showToast('Please generate XCS first', 'error');
        return;
    }

    const blob = new Blob([generatedXCS], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `engraving_${Date.now()}.xcs`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('XCS file downloaded!', 'success');
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
    elements.btnTestGrid.addEventListener('click', () => openModal(elements.testGridModal));
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
        'gridHighLpiMode', 'gridCellSize', 'gridCellGap', 'gridPower', 'gridSpeed'
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
    // Initialize preview
    updateStandardPreview();
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
        speed: parseInt(document.getElementById('gridSpeed').value)
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

    const qrCells = 2; // Fixed in generator
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

    const qrCells = 2;
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

    // Show preview area
    document.getElementById('analyzerDropZone').style.display = 'none';
    document.getElementById('analysisPreview').style.display = 'flex';
    document.getElementById('colorMapSection').style.display = 'block';

    // Analyze QR Code
    const imageData = ctx.getImageData(0, 0, w, h);
    const generator = new TestGridGenerator();
    const result = await generator.analyzeImage(imageData);

    const settingsDiv = document.getElementById('analysisSettings');

    if (result.found && !result.error) {
        const s = result.data;
        const date = new Date(s.ts).toLocaleDateString();

        settingsDiv.innerHTML = `
            <div class="detected-value"><span>Frequency Range</span> <span>${s.freq[0]} - ${s.freq[1]} kHz</span></div>
            <div class="detected-value"><span>LPI Range</span> <span>${s.lpi[0]} - ${s.lpi[1]} LPI</span></div>
            <div class="detected-value"><span>Grid Size</span> <span>${s.lpi[2]} × ${s.freq[2]}</span></div>
            <div class="detected-value"><span>Power / Speed</span> <span>${s.pwr}% / ${s.spd} mm/s</span></div>
            <div class="detected-value"><span>Created</span> <span>${date}</span></div>
        `;

        showToast('QR Code detected! Settings loaded.', 'success');
        generateColorMap(result.freqValues, result.lpiValues);
    } else {
        settingsDiv.innerHTML = `
            <div class="text-center text-muted">
                <p>⚠️ No QR code detected.</p>
                <p>Ensure the image is clear and contains the full grid.</p>
            </div>
        `;
        showToast('Could not detect QR code settings.', 'warning');
    }
}

function generateColorMap(freqValues, lpiValues) {
    const grid = document.getElementById('colorMapGrid');
    grid.innerHTML = '';

    // We recreate the visual grid map so user can click
    // Note: This relies on the image colors which we don't extract yet
    // For now we just show the structure

    freqValues.forEach(freq => {
        lpiValues.forEach(lpi => {
            const cell = document.createElement('div');
            cell.className = 'color-cell';
            cell.style.backgroundColor = '#ddd'; // Placeholder
            cell.title = `${freq}kHz / ${lpi} LPI`;

            cell.addEventListener('click', () => {
                document.querySelectorAll('.color-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                showToast(`Settings: ${freq}kHz @ ${lpi} LPI`, 'info');

                // TODO: In future, this would pick the color from the image 
                // and assign it to the current layer
            });

            grid.appendChild(cell);
        });
    });
}



// ===================================
// Start Application
// ===================================
document.addEventListener('DOMContentLoaded', init);
