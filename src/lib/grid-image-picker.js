/**
 * Grid Image Picker - Interactive canvas-based color picker with zoom/pan
 * 
 * Features:
 * - Larger grid display by default
 * - Zoom in/out with mouse wheel
 * - Pan when zoomed
 * - Hover preview with throttled updates
 * - Cell highlighting
 * - Dropdown grid switcher
 */

export class GridImagePicker {
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.ctx = this.canvas?.getContext('2d');

        // Grid data
        this.gridImage = null;
        this.entries = [];
        this.numCols = 0;
        this.numRows = 0;

        // View options
        this.showGridLines = false;

        // Zoom/pan state
        this.zoomLevel = 1;
        this.minZoom = 1;
        this.maxZoom = 5;
        this.panOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastPanPoint = null;

        // Hover state
        this.hoveredEntry = null;
        this.selectedEntry = null;

        // Callbacks
        this.onHover = options.onHover || (() => { });
        this.onSelect = options.onSelect || (() => { });

        // Throttle for hover
        this.lastHoverUpdate = 0;
        this.hoverThrottleMs = 16; // ~60fps

        // Bind event handlers
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._onMouseLeave = this._handleMouseLeave.bind(this);
        this._onWheel = this._handleWheel.bind(this);
        this._onClick = this._handleClick.bind(this);

        if (this.canvas) {
            this._attachEventListeners();
        }
    }

    /**
     * Set canvas element
     * @param {HTMLCanvasElement} canvas 
     */
    setCanvas(canvas) {
        // Remove old listeners
        if (this.canvas) {
            this._detachEventListeners();
        }

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this._attachEventListeners();
    }

    /**
     * Load grid data
     * @param {Object} gridData - { image: Image, entries: Array, numCols: number, numRows: number }
     */
    loadGrid(gridData) {
        this.gridImage = gridData.image;
        this.entries = gridData.entries || [];
        this.numCols = gridData.numCols || 1;
        this.numRows = gridData.numRows || 1;

        // Reset zoom/pan
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };

        // Resize canvas to match image
        if (this.canvas && this.gridImage) {
            this.canvas.width = this.gridImage.width;
            this.canvas.height = this.gridImage.height;
            this.redraw();
        }
    }

    /**
     * Set grid lines visibility
     * @param {boolean} visible 
     */
    setShowGridLines(visible) {
        this.showGridLines = !!visible;
        this.redraw();
    }

    /**
     * Main render function
     */
    redraw() {
        if (!this.ctx || !this.gridImage) return;

        const { width, height } = this.canvas;

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Save state for transform
        this.ctx.save();

        // Apply zoom and pan
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        // Draw grid image
        this.ctx.drawImage(this.gridImage, 0, 0);

        // Draw grid lines if enabled
        if (this.showGridLines) {
            this._drawGridLines();
        }

        // Highlight hovered cell
        if (this.hoveredEntry && this.hoveredEntry.gridPos) {
            this._drawCellHighlight(this.hoveredEntry.gridPos, 'rgba(255, 255, 255, 0.3)', 2);
        }

        // Highlight selected cell
        if (this.selectedEntry && this.selectedEntry.gridPos) {
            this._drawCellHighlight(this.selectedEntry.gridPos, '#ff0000', 3);
        }

        this.ctx.restore();

        // Draw zoom indicator if zoomed
        if (this.zoomLevel > 1.1) {
            this._drawZoomIndicator();
        }
    }

    /**
     * Draw cell highlight
     * @param {Object} gridPos - { row, col }
     * @param {string} color - Stroke color
     * @param {number} lineWidth - Stroke width
     */
    _drawCellHighlight(gridPos, color, lineWidth) {
        const cellWidth = this.gridImage.width / this.numCols;
        const cellHeight = this.gridImage.height / this.numRows;

        const x = gridPos.col * cellWidth;
        const y = gridPos.row * cellHeight;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth / this.zoomLevel;
        this.ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
    }

    /**
     * Draw zoom level indicator
     */
    _drawZoomIndicator() {
        const text = `${Math.round(this.zoomLevel * 100)}%`;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 50, 24);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, 35, 26);
    }

    /**
     * Draw grid lines overlay
     */
    _drawGridLines() {
        if (!this.gridImage || this.numCols <= 1 || this.numRows <= 1) return;

        const width = this.gridImage.width;
        const height = this.gridImage.height;
        const colStep = width / this.numCols;
        const rowStep = height / this.numRows;

        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'; // Cyan, semi-transparent
        this.ctx.lineWidth = 1 / this.zoomLevel; // Keep 1px screen width

        // Draw vertical lines
        for (let i = 1; i < this.numCols; i++) {
            const x = i * colStep;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
        }

        // Draw horizontal lines
        for (let i = 1; i < this.numRows; i++) {
            const y = i * rowStep;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
        }

        this.ctx.stroke();
    }

    /**
     * Convert screen coordinates to grid position
     * @param {number} screenX 
     * @param {number} screenY 
     * @returns {Object|null} { row, col } or null
     */
    _screenToGridPos(screenX, screenY) {
        if (!this.gridImage) return null;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Canvas coordinates
        const canvasX = screenX * scaleX;
        const canvasY = screenY * scaleY;

        // Undo pan and zoom
        const imageX = (canvasX - this.panOffset.x) / this.zoomLevel;
        const imageY = (canvasY - this.panOffset.y) / this.zoomLevel;

        // Check bounds
        if (imageX < 0 || imageX >= this.gridImage.width ||
            imageY < 0 || imageY >= this.gridImage.height) {
            return null;
        }

        // Grid cell
        const cellWidth = this.gridImage.width / this.numCols;
        const cellHeight = this.gridImage.height / this.numRows;

        const col = Math.floor(imageX / cellWidth);
        const row = Math.floor(imageY / cellHeight);

        return { row, col };
    }

    /**
     * Find entry at grid position
     * @param {Object} gridPos - { row, col }
     * @returns {Object|null}
     */
    _findEntryAt(gridPos) {
        if (!gridPos) return null;
        return this.entries.find(e =>
            e.gridPos && e.gridPos.col === gridPos.col && e.gridPos.row === gridPos.row
        );
    }

    /**
     * Set selected entry (highlighted in red)
     * @param {Object} entry 
     */
    setSelectedEntry(entry) {
        this.selectedEntry = entry;
        this.redraw();
    }

    /**
     * Zoom controls
     */
    zoomIn() {
        this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel * 1.25);
        this._constrainPan();
        this.redraw();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.minZoom, this.zoomLevel / 1.25);
        this._constrainPan();
        this.redraw();
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.redraw();
    }

    /**
     * Constrain pan to keep image visible
     */
    _constrainPan() {
        if (!this.gridImage) return;

        const scaledWidth = this.gridImage.width * this.zoomLevel;
        const scaledHeight = this.gridImage.height * this.zoomLevel;

        // Min/max bounds
        const maxX = 0;
        const minX = this.canvas.width - scaledWidth;
        const maxY = 0;
        const minY = this.canvas.height - scaledHeight;

        if (scaledWidth <= this.canvas.width) {
            this.panOffset.x = (this.canvas.width - scaledWidth) / 2;
        } else {
            this.panOffset.x = Math.max(minX, Math.min(maxX, this.panOffset.x));
        }

        if (scaledHeight <= this.canvas.height) {
            this.panOffset.y = (this.canvas.height - scaledHeight) / 2;
        } else {
            this.panOffset.y = Math.max(minY, Math.min(maxY, this.panOffset.y));
        }
    }

    // Event handlers
    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isPanning && this.lastPanPoint) {
            // Pan mode
            const dx = e.clientX - this.lastPanPoint.x;
            const dy = e.clientY - this.lastPanPoint.y;

            this.panOffset.x += dx;
            this.panOffset.y += dy;
            this._constrainPan();

            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            this.redraw();
            return;
        }

        // Hover mode (throttled)
        const now = performance.now();
        if (now - this.lastHoverUpdate < this.hoverThrottleMs) return;
        this.lastHoverUpdate = now;

        const gridPos = this._screenToGridPos(x, y);
        const entry = this._findEntryAt(gridPos);

        if (entry !== this.hoveredEntry) {
            this.hoveredEntry = entry;
            this.redraw();
            this.onHover(entry, gridPos);
        }
    }

    _handleMouseDown(e) {
        // Start panning if zoomed
        if (this.zoomLevel > 1 && e.button === 0) {
            this.isPanning = true;
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        }
    }

    _handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPanPoint = null;
            this.canvas.style.cursor = this.zoomLevel > 1 ? 'grab' : 'crosshair';
        }
    }

    _handleMouseLeave() {
        this.isPanning = false;
        this.lastPanPoint = null;
        this.hoveredEntry = null;
        this.redraw();
        this.onHover(null, null);
    }

    _handleWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Zoom toward mouse position
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));

        if (newZoom !== this.zoomLevel) {
            // Adjust pan to zoom toward cursor
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const canvasX = x * scaleX;
            const canvasY = y * scaleY;

            const zoomChange = newZoom / this.zoomLevel;
            this.panOffset.x = canvasX - (canvasX - this.panOffset.x) * zoomChange;
            this.panOffset.y = canvasY - (canvasY - this.panOffset.y) * zoomChange;

            this.zoomLevel = newZoom;
            this._constrainPan();
            this.redraw();

            // Update cursor
            this.canvas.style.cursor = this.zoomLevel > 1 ? 'grab' : 'crosshair';
        }
    }

    _handleClick(e) {
        // Don't select if we were panning
        if (this.isPanning) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const gridPos = this._screenToGridPos(x, y);
        const entry = this._findEntryAt(gridPos);

        if (entry) {
            this.selectedEntry = entry;
            this.redraw();
            this.onSelect(entry, gridPos);
        }
    }

    _attachEventListeners() {
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('mouseleave', this._onMouseLeave);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('click', this._onClick);
    }

    _detachEventListeners() {
        this.canvas.removeEventListener('mousemove', this._onMouseMove);
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        this.canvas.removeEventListener('mouseup', this._onMouseUp);
        this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
        this.canvas.removeEventListener('wheel', this._onWheel);
        this.canvas.removeEventListener('click', this._onClick);
    }

    /**
     * Cleanup
     */
    destroy() {
        this._detachEventListeners();
        this.gridImage = null;
        this.entries = [];
    }
}

/**
 * Create a grid switcher dropdown
 * @param {Array} grids - Array of { id, name, colorCount } objects
 * @param {string} activeId - Currently active grid ID
 * @param {Function} onChange - Callback when grid changes
 * @returns {HTMLSelectElement}
 */
export function createGridDropdown(grids, activeId, onChange) {
    const select = document.createElement('select');
    select.className = 'grid-dropdown';
    select.style.cssText = `
        padding: 4px 8px;
        font-size: 0.85em;
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        cursor: pointer;
        flex: 1;
        max-width: 200px;
        text-overflow: ellipsis;
    `;

    grids.forEach(grid => {
        const option = document.createElement('option');
        option.value = grid.id;
        option.textContent = `${grid.name} (${grid.colorCount || '?'} colors)`;
        option.selected = grid.id === activeId;
        select.appendChild(option);
    });

    select.addEventListener('change', () => {
        onChange(select.value);
    });

    return select;
}
