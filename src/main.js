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
import { Vectorizer } from './lib/vectorizer.js';
import { XCSGenerator } from './lib/xcs-generator.js';
import { showToast } from './lib/toast.js';
import { Logger } from './lib/logger.js';
import { LandingPage } from './lib/landing-page.js';
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
    settings: null,
    editingLayerId: null
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

    // Layer Edit Modal
    layerEditModal: document.getElementById('layerEditModal'),
    closeLayerEditModal: document.getElementById('closeLayerEditModal'),
    layerEditName: document.getElementById('layerEditName'),
    layerEditFreq: document.getElementById('layerEditFreq'),
    layerEditLpi: document.getElementById('layerEditLpi'),
    layerEditSpeed: document.getElementById('layerEditSpeed'),
    layerEditPower: document.getElementById('layerEditPower'),
    layerEditColorGrid: document.getElementById('layerEditColorGrid'),
    btnCancelLayerEdit: document.getElementById('btnCancelLayerEdit'),
    btnSaveLayerEdit: document.getElementById('btnSaveLayerEdit')
};

// ===================================
// Initialization
// ===================================
function init() {
    // 1. Initialize Settings Storage & Defaults
    SettingsStorage.ensureSystemDefaultMap();

    // 2. Initialize Landing Page for Device Selection
    const landingPage = new LandingPage(SettingsStorage, (deviceId) => {
        console.log('Device selected:', deviceId);

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
    setupLightbox();

    Logger.info('Picture Engraver initialized', { appVersion: '1.6.2' });

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

    if (profile) {
        // Update Title or Add Badge
        const titleContainer = document.querySelector('.title-container .brand-subtitle');
        if (titleContainer) {
            titleContainer.innerHTML = `by lasertools.org &nbsp; <span class="device-badge" style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; cursor:pointer;" title="Click to switch device">📍 ${profile.name}</span>`;

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

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto; background: #fff;">`;

    state.layers.forEach(layer => {
        if (!layer.visible) return;

        // Fallback to originalColor if calibrated color is not yet assigned
        const displayColor = layer.color || layer.originalColor;
        const colorStr = `rgb(${displayColor.r}, ${displayColor.g}, ${displayColor.b})`;
        layer.paths.forEach(path => {
            if (path && path.length > 0) {
                // Use fill-rule: evenodd to handle holes correctly in combined paths
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

        // Indent outline layers
        if (layer.type === 'outline') {
            layerEl.style.marginLeft = '20px';
            layerEl.style.borderLeft = '3px solid #666';
        }

        const isOutline = layer.type === 'outline';

        let actionsHtml = '';
        let settingsHtml = '';

        if (isOutline) {
            // Outline Layer: Show Thickness Input + Apply + Delete
            const thickness = layer.thickness || 5;

            // Adjust settings display just for outline? Or keep frequency/LPI?
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
            // Normal Layer: Add Outline + Edit
            actionsHtml = `
                <button class="btn btn-sm btn-primary btn-add-outline" title="Add Outline Layer" data-layer-id="${layer.id}" style="margin-right: 5px; font-size: 0.8em; display:flex; align-items:center; gap:4px;"><span>+</span> Add Outline</button>
                <button class="btn btn-icon btn-sm" title="Edit" data-action="edit" data-layer-id="${layer.id}">✏️</button>
            `;
            const hasSettings = layer.frequency !== null && layer.lpi !== null;
            let settingsText = '⚠️ Settings Pending';
            if (hasSettings) {
                settingsText = `${Math.round(layer.frequency)}kHz / ${Math.round(layer.lpi)}LPI`;
                if (layer.speed) settingsText += ` / ${layer.speed}mm/s`;
                if (layer.power) settingsText += ` / ${layer.power}%`;
            }
            settingsHtml = `<div class="layer-settings ${hasSettings ? '' : 'pending'}">${settingsText}</div>`;
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
                    <div class="layer-color original" style="background-color: rgb(${layer.originalColor.r}, ${layer.originalColor.g}, ${layer.originalColor.b});" title="Original detected color"></div>
                    <div class="layer-color assigned" style="${assignedStyle} cursor: pointer;" data-layer-id="${layer.id}" title="${assignedColor ? 'Assigned calibrated color - Click to edit' : 'No color assigned - Click to pick'}">${assignedContent}</div>
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
            openLayerEditModal(layerId);
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
                        layer.color,
                        thickness,
                        pxPerMm
                    );

                    const outlineLayer = {
                        id: layer.id + '_outline_' + Date.now(), // Unique ID
                        name: layer.name + ' Outline',
                        type: 'outline',
                        color: { r: 0, g: 0, b: 0 }, // Default to Black
                        sourceColor: { ...layer.color }, // Store original source color
                        paths: paths,
                        visible: true,
                        parentId: layer.id,
                        frequency: layer.frequency,
                        lpi: layer.lpi,
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
            openLayerEditModal(layerId);
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

    const unassignedLayers = state.layers.filter(l => l.visible && (l.frequency === null || l.lpi === null));
    const btn = elements.btnDownloadXCS;

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
            // Pool for matching: Standard Colors + Calibrated Map
            const s = state.settings;
            const standardColors = [
                {
                    color: { r: 0, g: 0, b: 0 },
                    frequency: s.blackFreq, lpi: s.blackLpi,
                    speed: s.blackSpeed, power: s.blackPower
                },
                {
                    color: { r: 255, g: 255, b: 255 },
                    frequency: s.whiteFreq, lpi: s.whiteLpi,
                    speed: s.whiteSpeed, power: s.whitePower
                }
            ];
            const matchPool = [...standardColors, ...colorMap.entries];

            // For each layer, find the closest matching color from the pool
            state.layers.forEach(layer => {
                const bestMatch = findClosestCalibrationColor(layer.originalColor, matchPool);

                if (bestMatch) {
                    layer.frequency = bestMatch.frequency;
                    layer.lpi = bestMatch.lpi;
                    layer.speed = bestMatch.speed;
                    layer.power = bestMatch.power;
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

            // Onboarding action: Auto Assigning
            if (window.onboarding) window.onboarding.handleAction('auto-assign');
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

function openLayerEditModal(layerId) {
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer) return;

    state.editingLayerId = layerId;

    // Populate inputs
    elements.layerEditName.value = layer.name;
    elements.layerEditFreq.value = layer.frequency !== null ? Math.round(layer.frequency) : '';
    elements.layerEditLpi.value = layer.lpi !== null ? Math.round(layer.lpi) : '';

    // Check if layer has specific speed/power, else fall back to global settings
    const speed = layer.speed !== undefined ? layer.speed : state.settings.speed;
    const power = layer.power !== undefined ? layer.power : state.settings.power;

    elements.layerEditSpeed.value = speed;
    elements.layerEditPower.value = power;

    // Render Color Grid from Calibration
    renderLayerColorGrid();

    openModal(elements.layerEditModal);

    // Onboarding action: Edit Modal Opened
    if (window.onboarding) window.onboarding.handleAction('edit-modal-open');
}

function renderLayerColorGrid() {
    const grid = elements.layerEditColorGrid;
    grid.innerHTML = '';

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

        let title = `R:${color.r} G:${color.g} B:${color.b}\nFreq: ${frequency}kHz, LPI: ${lpi}`;
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

            // Onboarding action: Color Picked from Grid
            if (window.onboarding) window.onboarding.handleAction('color-picked');
        });

        grid.appendChild(div);
    });
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

            // If the selected color had specific options (like standard colors with speed/power)
            // But wait, the user might have edited them in the inputs after clicking.
            // The inputs are the source of truth now.

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

    // Setup Export Data
    const btnExport = document.getElementById('btnExportData');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const json = SettingsStorage.exportColorMaps();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `picture_engraver_data_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Data exported successfully!', 'success');
        });
    }

    // Setup Import Data
    const btnImport = document.getElementById('btnImportData');
    const importInput = document.getElementById('importFileInput');
    if (btnImport && importInput) {
        btnImport.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const count = SettingsStorage.importColorMaps(ev.target.result);
                        showToast(`Imported ${count} color maps! Reloading...`, 'success');
                        setTimeout(() => location.reload(), 1500);
                    } catch (err) {
                        showToast('Import failed: ' + err.message, 'error');
                    }
                };
                reader.readAsText(e.target.files[0]);
            }
        });
    }
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
    const canvas = document.getElementById('analyzerCanvas');
    canvas.addEventListener('click', handleAnalyzerCanvasClick);

    // Clear Button
    const btnClear = document.getElementById('btnClearAnalyzer');
    if (btnClear) btnClear.addEventListener('click', resetAnalyzer);

    // Rotate Button
    const btnRotate = document.getElementById('btnRotateAnalyzer');
    if (btnRotate) btnRotate.addEventListener('click', rotateAnalyzerImage);

    // Manual Settings
    const btnToggle = document.getElementById('btnToggleManualSettings');
    if (btnToggle) btnToggle.addEventListener('click', toggleManualSettings);

    const btnApply = document.getElementById('btnApplyManualSettings');
    if (btnApply) btnApply.addEventListener('click', applyManualSettings);

    // Initialize Map Management UI
    setupMapManagement();
}

function resetAnalyzer() {
    analyzerState.corners = [];
    analyzerState.originalImg = null;
    analyzerState.extractedColors = [];
    analyzerState.isActive = false;
    analyzerState.selectedCell = null;

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
        <div class="detected-value"><span>LPI (Manual)</span> <span>${lpiMax}-${lpiMin}</span></div>
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


function getSmartGridFilename(prefix, settings, deviceId) {
    const devLabel = deviceId.includes('mopa') || deviceId.includes('base') ? 'MOPA' : 'UV';
    let name = `${prefix}_F2_${devLabel}`;

    if (devLabel === 'MOPA') {
        name += `_S${settings.speedMin}-${settings.speedMax}_F${settings.freqMin}-${settings.freqMax}`;
    } else {
        const lpiUnit = settings.highLpiMode ? 'LPC' : 'LPI';
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
            <div class="detected-value"><span>Laser Type</span> <span>${(s.type || 'UV').toUpperCase()}</span></div>
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
    const colorEntries = [];
    let colorIdx = 0;

    for (let row = 0; row < numRows; row++) {
        const freq = freqValues[row];
        for (let col = 0; col < numCols; col++) {
            const lpi = lpiValues[col];
            const color = extractedColors[colorIdx];

            colorEntries.push({
                color: color,
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

        // Refresh the Manage Maps UI
        renderManageMapsUI();

    } else {
        showToast('Failed to save color map.', 'error');
    }
}

// ===================================
// Map Management UI (Injected)
// ===================================

function setupMapManagement() {
    // Locate where to inject the management panel. 
    // We'll put it in the #tabAnalyzer to ensure it's always visible even without active analysis
    const container = document.getElementById('tabAnalyzer');
    if (!container) return; // Should not happen if DOM matches

    // Create section if not exists
    let manageSection = document.getElementById('manageMapsSection');
    if (!manageSection) {
        manageSection = document.createElement('div');
        manageSection.id = 'manageMapsSection';
        manageSection.className = 'info-panel';
        manageSection.style.marginTop = '20px';
        manageSection.style.borderTop = '1px solid var(--border-color)';
        manageSection.style.paddingTop = '15px';

        container.appendChild(manageSection);
    }

    renderManageMapsUI();
}

function renderManageMapsUI() {
    const section = document.getElementById('manageMapsSection');
    if (!section) return;

    const maps = SettingsStorage.getColorMaps();

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h4 style="margin:0;">Manage Color Maps (${maps.length})</h4>
            <div style="gap:5px; display:flex;">
                 <button id="btnImportMaps" class="btn btn-sm btn-secondary" title="Import JSON file">📥 Import</button>
                 <button id="btnExportMaps" class="btn btn-sm btn-secondary" title="Export all maps to JSON">📤 Export</button>
                 <input type="file" id="fileImportMaps" accept=".json" style="display:none">
            </div>
        </div>
        
        <div class="maps-list" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
    `;

    if (maps.length === 0) {
        html += `<div style="color: #888; font-style: italic; text-align: center;">No saved color maps yet. Analyze a grid to save one.</div>`;
    } else {
        maps.forEach(map => {
            const date = new Date(map.createdAt).toLocaleDateString();
            const checked = map.active ? 'checked' : '';
            const opacity = map.active ? '1' : '0.6';

            html += `
                <div class="map-item" style="display:flex; align-items:center; background: var(--bg-secondary); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); opacity: ${opacity};">
                    <input type="checkbox" class="map-toggle" data-id="${map.id}" ${checked} title="Enable/Disable this map" style="margin-right: 10px; cursor: pointer;">
                    
                    <div style="flex:1;">
                        <div style="font-weight: 500;">${map.name}</div>
                        <div style="font-size: 0.8em; color: #888;">${date} • ${map.data.entries.length} Colors</div>
                    </div>
                    
                    <button class="btn btn-icon btn-sm btn-export-single-map" data-id="${map.id}" title="Export this map" style="color: #4a90e2; margin-left:10px;">📤</button>
                    <button class="btn btn-icon btn-sm btn-delete-map" data-id="${map.id}" title="Delete" style="color: #ff4444; margin-left:5px;">🗑️</button>
                </div>
            `;
        });
    }

    html += `</div>`;

    section.innerHTML = html;

    // Bind Events

    // Export
    document.getElementById('btnExportMaps').addEventListener('click', () => {
        const json = SettingsStorage.exportColorMaps();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `picture_engraver_maps_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Configuration exported!', 'success');
    });

    // Import Trigger
    const fileInput = document.getElementById('fileImportMaps');
    document.getElementById('btnImportMaps').addEventListener('click', () => fileInput.click());

    // Import Action
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const count = SettingsStorage.importColorMaps(evt.target.result);
                    showToast(`Imported ${count} color maps successfully!`, 'success');
                    renderManageMapsUI();
                } catch (err) {
                    showToast('Import failed: ' + err.message, 'error');
                }
                fileInput.value = ''; // Reset
            };
            reader.readAsText(e.target.files[0]);
        }
    });

    // Export Single Map
    section.querySelectorAll('.btn-export-single-map').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            const map = maps.find(m => m.id === id);
            if (map) {
                const exportData = { version: 1, exportedAt: new Date().toISOString(), maps: [map] };
                const json = JSON.stringify(exportData, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${map.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        });
    });

    // Toggle Active
    section.querySelectorAll('.map-toggle').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            SettingsStorage.toggleColorMapActive(id, e.target.checked);
            renderManageMapsUI(); // Refresh style
            showToast('Map status updated', 'success');
        });
    });

    // Delete Map
    section.querySelectorAll('.btn-delete-map').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this color map?')) {
                if (SettingsStorage.deleteColorMap(id)) {
                    renderManageMapsUI();
                    showToast('Color map deleted', 'success');
                }
            }
        });
    });
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
