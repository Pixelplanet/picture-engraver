/**
 * Complete Browser-Based Image Processing Solution
 * 
 * Combines:
 * 1. Color interpolation (testgrid-based)
 * 2. Image quantization (k-means)
 * 3. Vectorization (marching squares)
 * 
 * ALL runs in browser - zero server processing
 */

class CompleteBrowserSolution {
    constructor(testgridData) {
        this.interpolator = new BrowserColorInterpolator(testgridData);
        this.quantizer = new BrowserImageQuantizer(this.interpolator);
        this.vectorizer = new ImageVectorizer({
            simplifyTolerance: 0.5,
            minAreaThreshold: 4,
            smoothing: true
        });
    }
    
    /**
     * Complete workflow: Image → Quantized → Interpolated → Vectorized
     */
    async processImage(imageFile, options = {}) {
        const {
            baseColors = 8,
            expandedColors = 32,
            progressCallback = null
        } = options;
        
        // Step 1: Load image
        if (progressCallback) progressCallback(0.1, 'Loading image...');
        const imageData = await this.loadImageFile(imageFile);
        
        // Step 2: Initial quantization
        if (progressCallback) progressCallback(0.2, 'Quantizing to base colors...');
        const baseQuantization = await this.quantizer.quantizeInitial(
            imageData, 
            baseColors,
            progressCallback
        );
        
        // Step 3: Expand with interpolation (if requested)
        let finalQuantization = baseQuantization;
        if (expandedColors > baseColors) {
            if (progressCallback) progressCallback(0.6, 'Expanding with interpolation...');
            finalQuantization = await this.expandQuantization(
                imageData,
                baseQuantization,
                expandedColors
            );
        }
        
        // Step 4: Vectorize
        if (progressCallback) progressCallback(0.8, 'Vectorizing layers...');
        const vectorData = await this.vectorizer.vectorizeLayers(
            finalQuantization.quantizedImageData,
            finalQuantization.layers,
            progressCallback
        );
        
        if (progressCallback) progressCallback(1.0, 'Complete!');
        
        return {
            original: imageData,
            quantized: finalQuantization,
            vectors: vectorData
        };
    }
    
    /**
     * Load image file into ImageData
     */
    async loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            
            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
                };
                img.src = e.target.result;
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Expand quantization using gradient interpolation
     */
    async expandQuantization(originalImage, baseResult, targetColors) {
        const { layers: baseLayers } = baseResult;
        
        // Generate intermediate colors between base colors
        const expandedPalette = this.generateGradientPalette(baseLayers, targetColors);
        
        // Requantize to expanded palette
        return await this.requantizeToPalette(originalImage, expandedPalette);
    }
    
    /**
     * Generate gradient palette between base colors
     */
    generateGradientPalette(baseLayers, targetColors) {
        // Sort by brightness
        const sorted = [...baseLayers].sort((a, b) => {
            const brightA = 0.299 * a.color.r + 0.587 * a.color.g + 0.114 * a.color.b;
            const brightB = 0.299 * b.color.r + 0.587 * b.color.g + 0.114 * b.color.b;
            return brightB - brightA;
        });
        
        const palette = [];
        const stepsPerGradient = Math.floor((targetColors - baseLayers.length) / (baseLayers.length - 1));
        
        for (let i = 0; i < sorted.length - 1; i++) {
            const colorA = sorted[i].color;
            const colorB = sorted[i + 1].color;
            
            // Add base color
            palette.push({
                color: colorA,
                ...this.interpolator.interpolateSettings(colorA.r, colorA.g, colorA.b)
            });
            
            // Add intermediate colors
            for (let j = 1; j <= stepsPerGradient; j++) {
                const t = j / (stepsPerGradient + 1);
                const r = Math.round(colorA.r * (1 - t) + colorB.r * t);
                const g = Math.round(colorA.g * (1 - t) + colorB.g * t);
                const b = Math.round(colorA.b * (1 - t) + colorB.b * t);
                
                const settings = this.interpolator.interpolateSettings(r, g, b);
                palette.push({
                    color: { r, g, b },
                    frequency: settings.frequency,
                    lpi: settings.lpi,
                    interpolated: true
                });
            }
        }
        
        // Add last base color
        const lastColor = sorted[sorted.length - 1].color;
        palette.push({
            color: lastColor,
            ...this.interpolator.interpolateSettings(lastColor.r, lastColor.g, lastColor.b)
        });
        
        return palette;
    }
    
    /**
     * Requantize image to specific palette
     */
    async requantizeToPalette(imageData, palette) {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = [];
        
        // Extract pixels
        for (let i = 0; i < imageData.data.length; i += 4) {
            pixels.push([
                imageData.data[i],
                imageData.data[i + 1],
                imageData.data[i + 2]
            ]);
        }
        
        // Find nearest palette color for each pixel
        const labels = new Uint8Array(pixels.length);
        for (let i = 0; i < pixels.length; i++) {
            let minDist = Infinity;
            let closestIdx = 0;
            
            for (let p = 0; p < palette.length; p++) {
                const pColor = palette[p].color;
                const dist = Math.sqrt(
                    Math.pow(pixels[i][0] - pColor.r, 2) +
                    Math.pow(pixels[i][1] - pColor.g, 2) +
                    Math.pow(pixels[i][2] - pColor.b, 2)
                );
                
                if (dist < minDist) {
                    minDist = dist;
                    closestIdx = p;
                }
            }
            
            labels[i] = closestIdx;
        }
        
        // Create layers
        const layers = palette.map((entry, idx) => {
            const pixelCount = labels.filter(l => l === idx).length;
            return {
                layerId: idx,
                color: entry.color,
                frequency: entry.frequency,
                lpi: entry.lpi,
                interpolated: entry.interpolated || false,
                pixelCount,
                percentage: (pixelCount / pixels.length * 100).toFixed(2)
            };
        }).filter(l => l.pixelCount > 0);
        
        // Create quantized image
        const quantizedImageData = new ImageData(width, height);
        for (let i = 0; i < pixels.length; i++) {
            const layer = layers[labels[i]];
            const pixelIdx = i * 4;
            quantizedImageData.data[pixelIdx] = layer.color.r;
            quantizedImageData.data[pixelIdx + 1] = layer.color.g;
            quantizedImageData.data[pixelIdx + 2] = layer.color.b;
            quantizedImageData.data[pixelIdx + 3] = 255;
        }
        
        return {
            nColors: layers.length,
            layers,
            quantizedImageData,
            labels
        };
    }
    
    /**
     * Download SVG
     */
    downloadSVG(vectorData, filename = 'engraving.svg') {
        this.vectorizer.downloadSVG(vectorData, filename);
    }
    
    /**
     * Get statistics
     */
    getStats(result) {
        return {
            originalSize: `${result.original.width} × ${result.original.height}`,
            baseColors: result.quantized.nColors,
            totalPaths: result.vectors.totalPaths,
            estimatedSVGSize: this.estimateSVGSize(result.vectors),
            comparison: {
                pixelMethod: {
                    paths: result.original.width * result.original.height,
                    sizeMB: ((result.original.width * result.original.height * 100) / (1024 * 1024)).toFixed(1)
                },
                contourMethod: {
                    paths: result.vectors.totalPaths,
                    sizeKB: (this.estimateSVGSize(result.vectors) / 1024).toFixed(0)
                }
            }
        };
    }
    
    estimateSVGSize(vectorData) {
        // Rough estimate: ~100 bytes per path + overhead
        return vectorData.totalPaths * 100 + 1000;
    }
}

// Usage Example:
/*
// Load testgrid
const testgridData = await fetch('testgrid.json').then(r => r.json());

// Initialize
const processor = new CompleteBrowserSolution(testgridData);

// Process image
const result = await processor.processImage(imageFile, {
    baseColors: 8,
    expandedColors: 32,
    progressCallback: (progress, message) => {
        console.log(`${(progress * 100).toFixed(0)}% - ${message}`);
    }
});

// Download SVG
processor.downloadSVG(result.vectors, 'my-engraving.svg');

// Get stats
const stats = processor.getStats(result);
console.log(`Reduced from ${stats.comparison.pixelMethod.paths} paths to ${stats.comparison.contourMethod.paths} paths!`);
*/
